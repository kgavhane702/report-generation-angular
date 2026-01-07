import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EffectRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  effect,
  inject,
  OnInit,
  signal,
  ElementRef,
  ViewChild,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import type { GhostColLine, GhostRowLine } from './resize/table-resize-overlay.component';
import {
  TABLE_INITIAL_ROW_PX,
  TABLE_MIN_COL_PX,
  TABLE_MIN_ROW_PX,
  TABLE_MIN_SPLIT_COL_PX,
  TABLE_MIN_SPLIT_ROW_PX,
} from '../table-constants';

import {
  TableWidgetProps,
  TableRow,
  TableCell,
  TableCellSplit,
  TableMergedRegion,
  TableCellStyle,
  WidgetModel,
} from '../../../../../models/widget.model';
import {
  CellBorderRequest,
  SplitCellRequest,
  TableDeleteRequest,
  TableFitRowRequest,
  TableInsertRequest,
  TableImportFromExcelRequest,
  TableToolbarService,
} from '../../../../../core/services/table-toolbar.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { PendingChangesRegistry, FlushableWidget } from '../../../../../core/services/pending-changes-registry.service';
import { DraftStateService } from '../../../../../core/services/draft-state.service';
import { LoggerService } from '../../../../../core/services/logger.service';
import { TableConditionalFormattingService } from '../services/table-conditional-formatting.service';
import { RemoteWidgetAutoLoadService } from '../../../../../core/services/remote-widget-auto-load.service';

type ColResizeSegment = { boundaryIndex: number; leftPercent: number; topPercent: number; heightPercent: number };
type RowResizeSegment = { boundaryIndex: number; topPercent: number; leftPercent: number; widthPercent: number };

type SharedSplitColSegment = { boundaryAbs: number; leftPercent: number; topPercent: number; heightPercent: number };
type SharedSplitRowSegment = { boundaryAbs: number; topPercent: number; leftPercent: number; widthPercent: number };

/**
 * TableWidgetComponent
 * 
 * A table widget with contenteditable cells for inline editing.
 * Follows the same architecture as TextWidgetComponent:
 * - Local editing state during typing
 * - Changes emitted only on blur
 * - FlushableWidget interface for pending changes
 */
@Component({
  selector: 'app-table-widget',
  templateUrl: './table-widget.component.html',
  styleUrls: ['./table-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TableWidgetComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy, FlushableWidget {
  private readonly maxSplitDepth = 4;
  private readonly minColPx = TABLE_MIN_COL_PX;
  private readonly minRowPx = TABLE_MIN_ROW_PX;
  // Split sub-cells can be smaller than top-level table cells.
  private readonly minSplitColPx = TABLE_MIN_SPLIT_COL_PX;
  private readonly minSplitRowPx = TABLE_MIN_SPLIT_ROW_PX;

  /**
   * For JSON-imported documents: URL-based tables auto-load their data after open.
   * In that scenario we preserve the widget frame (width/height) and instead "auto-fit" the text/padding
   * so content doesn't get clipped in dense tables.
   *
   * This is transient UI state (not persisted).
   */
  private autoFitTextToFrame = false;

  /**
   * Unified sizing state for the table. Controls how auto-fit, widget resize, and column resize behave.
   *
   * - 'auto': Normal behavior - auto-fit grows height iteratively, rows redistribute freely.
   * - 'preserved': URL import with fixed frame - widget size is locked, content must fit within frame.
   *                Column resize should NOT trigger auto-fit height growth.
   * - 'fitted': After widget resize completed - rows are tightly fitted to content.
   *             Next column resize uses single-pass auto-fit (full growth at once), then resets to 'auto'.
   *
   * This is transient UI state (not persisted).
   */
  private sizingState: 'auto' | 'preserved' | 'fitted' = 'auto';

  /**
   * Guard to prevent store-driven `ngOnChanges` sync from overwriting local fractions while we are
   * doing an internal auto-fit pass.
   *
   * Why: auto-fit may update widget draft height (via DraftStateService). If the parent re-computes
   * a new `widget` input object for that draft size, `ngOnChanges` would normally re-run
   * `initializeFractionsFromProps()` and overwrite the *newly applied* `columnFractions` from a
   * column-resize that hasn't been persisted yet. That manifests as: "column doesn't shrink, only row height grows".
   */
  private suppressWidgetSyncDuringAutoFit = false;

  // (debug-only instrumentation removed)

  /** In preserved-frame URL-import mode: keep overlay until the first post-import fit completes (avoids visible font "pop"). */
  private preservedImportFitInProgress = false;

  // (debug-only clipping logger removed)

  /**
   * When a URL-based table is exported, we replace rows with a 1x1 placeholder but we now preserve
   * the user's saved sizing fractions in the JSON. On import, the widget initially renders the 1x1
   * grid so the fractions length doesn't match and would normally be discarded.
   *
   * We keep the raw fractions here so that when the URL data loads (real rows arrive),
   * we can re-apply the user's saved sizing (header row height, column widths, etc.).
   */
  private pendingPropsColumnFractions: number[] | null = null;
  private pendingPropsRowFractions: number[] | null = null;

  // ==========================
  // Column conditional rules (delegated to service)
  // ==========================

  getConditionalCellSurfaceClass(rowIndex: number, colIndex: number, _path: string, cell: TableCell): string | null {
    return this.condFormatSvc.getConditionalCellSurfaceClass(
      rowIndex,
      colIndex,
      cell,
      this.tableProps.columnRules,
      this.localRows(),
      this.getEffectiveHeaderRowCountFromProps(this.tableProps)
    );
  }

  getConditionalCellSurfaceStyle(rowIndex: number, colIndex: number, _path: string, cell: TableCell): Partial<TableCellStyle> {
    return this.condFormatSvc.getConditionalCellSurfaceStyle(
      rowIndex,
      colIndex,
      cell,
      this.tableProps.columnRules,
      this.localRows(),
      this.getEffectiveHeaderRowCountFromProps(this.tableProps)
    );
  }

  getConditionalTooltip(rowIndex: number, colIndex: number, _path: string, cell: TableCell): string | null {
    return this.condFormatSvc.getConditionalTooltip(
      rowIndex,
      colIndex,
      cell,
      this.tableProps.columnRules,
      this.localRows(),
      this.getEffectiveHeaderRowCountFromProps(this.tableProps)
    );
  }

  /**
   * Manual top-level row minimum heights (in widget layout px).
   * When set (>0), live auto-fit will NOT shrink the row below this value (PPT-like behavior).
   *
   * NOTE: This is in-memory (non-persisted). It is updated only by manual row-resize interactions.
   */
  private manualTopLevelRowMinHeightsPx: number[] = [];

  /**
   * Track last known content size per leaf so we only auto-shrink on content-decreasing edits
   * (delete/backspace), not on normal typing which feels like the table is "jumping".
   */
  private readonly lastLeafTextLen = new Map<string, number>();

  private autoFitRowHeightRaf: number | null = null;
  private postImportFitHeaderRaf: number | null = null;
  private outerResizeFitRaf: number | null = null;
  private outerResizeCommitRaf: number | null = null;
  private wasOuterResizingThisWidget = false;
  private outerResizeStartSize: { width: number; height: number } | null = null;
  private resizeEndEffectRef?: EffectRef;
  private minHeightEffectRef?: EffectRef;
  private computeMinHeightRaf: number | null = null;

  /** Content-based minimum total table height (px) so no top-level row clips. Used by outer (widget) resizer. */
  private contentMinTableHeightPx = 20;
  /**
   * Unclamped minimum required table height (px) so no top-level row clips.
   *
   * For 'preserved' (URL) tables we intentionally clamp `contentMinTableHeightPx` to the current widget height
   * so the outer resizer doesn't force the widget to grow. But we still need the *true* required height to:
   * - compute runtime font/padding scaling (so content isn't hidden when saved styles are missing)
   * - debug/diagnose dense-table scenarios
   */
  private contentRequiredTableHeightPx = 20;

  /** Exposed to the template/host for outer-resize clamping in `WidgetContainerComponent`. */
  get minTableHeightPx(): number {
    return this.contentMinTableHeightPx;
  }

  private setContentMinHeights(requiredPx: number): void {
    const req = Math.max(20, Math.ceil(Number.isFinite(requiredPx) ? requiredPx : 20));
    // IMPORTANT for preserved-frame (URL) tables:
    // `contentRequiredTableHeightPx` drives runtime-only `autoFitTextScale`.
    // We must keep it stable across focus/selection changes, otherwise the scale (and thus font size)
    // will "flip" when clicking different cells.
    //
    // In preserved mode we therefore keep the required height monotonic (never decrease within a session).
    const effectiveReq =
      this.sizingState === 'preserved' ? Math.max(this.contentRequiredTableHeightPx, req) : req;
    this.contentRequiredTableHeightPx = effectiveReq;

    if (this.sizingState === 'preserved') {
      const currentWidgetHeight = this.widget?.size?.height ?? 0;
      if (Number.isFinite(currentWidgetHeight) && currentWidgetHeight > 0) {
        this.contentMinTableHeightPx = Math.max(20, Math.min(effectiveReq, Math.ceil(currentWidgetHeight)));
        return;
      }
    }

    this.contentMinTableHeightPx = effectiveReq;
  }

  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<TableWidgetProps>>();

  @ViewChild('tableContainer', { static: false }) tableContainer?: ElementRef<HTMLElement>;

  readonly toolbarService = inject(TableToolbarService);
  private readonly uiState = inject(UIStateService);
  private readonly pendingChangesRegistry = inject(PendingChangesRegistry);
  private readonly draftState = inject(DraftStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly logger = inject(LoggerService);
  private readonly condFormatSvc = inject(TableConditionalFormattingService);
  private readonly remoteAutoLoad = inject(RemoteWidgetAutoLoadService);

  /** Local copy of rows during editing */
  private readonly localRows = signal<TableRow[]>([]);
  /** Optional transient loading state (e.g. placeholder widget while importing). */
  private readonly isLoadingSig = signal<boolean>(false);

  /** Persisted sizing state (fractions that sum to 1) */
  private readonly columnFractions = signal<number[]>([]);
  private readonly rowFractions = signal<number[]>([]);

  /** Live preview during resize drag */
  private readonly previewColumnFractions = signal<number[] | null>(null);
  private readonly previewRowFractions = signal<number[] | null>(null);

  /** Ghost preview lines during resize drag (PPT-like). Values are in percent (0..100). */
  private readonly ghostTopColPercent = signal<number | null>(null);
  private readonly ghostTopRowPercent = signal<number | null>(null);
  private readonly ghostSharedSplitColPercent = signal<number | null>(null);
  private readonly ghostSharedSplitRowPercent = signal<number | null>(null);
  private readonly ghostSplitColWithinPercent = signal<Map<string, number>>(new Map());
  private readonly ghostSplitRowWithinPercent = signal<Map<string, number>>(new Map());

  // ============================================
  // Segmented resize handles (gap-aware)
  // ============================================

  private readonly colResizeSegmentsSig = signal<ColResizeSegment[]>([]);
  private readonly rowResizeSegmentsSig = signal<RowResizeSegment[]>([]);

  private readonly sharedSplitColSegmentsSig = signal<SharedSplitColSegment[]>([]);
  private readonly sharedSplitRowSegmentsSig = signal<SharedSplitRowSegment[]>([]);

  private resizeSegmentsRaf: number | null = null;
  private resizeObserver?: ResizeObserver;
  private zoomEffectRef?: EffectRef;

  private isResizingGrid = false;
  private activeGridResize:
    | {
        kind: 'col' | 'row';
        boundaryIndex: number; // boundary between (i-1) and i
        startClientX: number;
        startClientY: number;
        startFractions: number[];
        tableWidthPx: number; // unscaled layout px
        tableHeightPx: number; // unscaled layout px
        zoomScale: number; // 1.0 = 100%
        /** For top-level row resize: minimum allowed height for the resized row (px). */
        minTopRowHeightPx?: number;
      }
    | null = null;

  // ============================================
  // Split-grid resize (per split cell)
  // ============================================

  private isResizingSplitGrid = false;
  private activeSplitResize:
    | {
        kind: 'col' | 'row';
        ownerLeafId: string; // leaf id of the split owner cell (row-col[-path])
        boundaryIndex: number; // boundary between (i-1) and i within split grid
        /**
         * Absolute boundary anchor (0..1) within the top-level table.
         * Used to resize multiple split-grids together when their boundaries align.
         */
        sharedBoundaryAbs?: number;
        /** Starting abs boundary (0..1) when resizing a shared boundary. */
        startSharedBoundaryAbs?: number;
        /** Top-level table size at drag start (for shared-abs ghost). */
        tableWidthPx?: number;
        tableHeightPx?: number;
        /** Cached container sizes for all participating owners (for correct min constraints). */
        ownerContainerWidthPx?: Map<string, number>;
        ownerContainerHeightPx?: Map<string, number>;
        /** For aligned propagation: the boundaryIndex to apply for each owner. */
        ownerBoundaryIndexMap?: Map<string, number>;
        /** Content-based minimums for the two rows adjacent to the resized boundary (px). */
        ownerMinSplitRowTopPx?: Map<string, number>;
        ownerMinSplitRowBottomPx?: Map<string, number>;
        /** Other split owners that share the same continuous boundary line. */
        sharedOwnerLeafIds?: string[];
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startFractions: number[];
        containerWidthPx: number; // unscaled layout px
        containerHeightPx: number; // unscaled layout px
        zoomScale: number; // 1.0 = 100%
      }
    | null = null;

  /**
   * Pending split fractions computed during drag (commit on pointerup).
   * IMPORTANT: these are NOT used for rendering; rendering stays stable until commit.
   */
  private readonly pendingSplitColFractions = signal<Map<string, number[]>>(new Map());
  private readonly pendingSplitRowFractions = signal<Map<string, number[]>>(new Map());

  /**
   * During a split resize, we want aligned boundaries (same continuous line) across different split owners
   * to resize together. We detect alignment via an absolute boundary fraction (0..1) within the top-level table.
   */
  private readonly sharedSplitBoundaryEpsilon = 0.004;
  
  /** Track if we're actively editing */
  private readonly isActivelyEditing = signal<boolean>(false);
  
  /** Rows at edit start for comparison */
  private rowsAtEditStart: TableRow[] = [];
  
  /** Currently active cell element */
  private activeCellElement: HTMLElement | null = null;
  
  /** Active cell coordinates */
  private activeCellId: string | null = null;
  
  /** Blur timeout for delayed blur handling */
  private blurTimeoutId: number | null = null;

  /** Clipboard handlers (Excel-style multi-cell paste/copy) */
  private clipboardPasteListener: ((ev: ClipboardEvent) => void) | null = null;
  private clipboardCopyListener: ((ev: ClipboardEvent) => void) | null = null;

  /**
   * Debounced autosave while editing.
   * Lets global undo/redo get incremental steps without requiring the user to blur/click outside.
   */
  private autosaveTimeoutId: number | null = null;
  private readonly autosaveDelayMs = 650;
   private pendingAutosaveLeafId: string | null = null;
   private pendingAutosaveElement: HTMLElement | null = null;

  private splitSubscription?: Subscription;
  private mergeSubscription?: Subscription;
  private insertSubscription?: Subscription;
  private deleteSubscription?: Subscription;
  private fitRowSubscription?: Subscription;
  private textAlignSubscription?: Subscription;
  private verticalAlignSubscription?: Subscription;
  private cellBackgroundSubscription?: Subscription;
  private cellBorderSubscription?: Subscription;
  private fontFamilySubscription?: Subscription;
  private fontSizeSubscription?: Subscription;
  private fontWeightSubscription?: Subscription;
  private fontStyleSubscription?: Subscription;
  private textDecorationSubscription?: Subscription;
  private textColorSubscription?: Subscription;
  private textHighlightSubscription?: Subscription;
  private lineHeightSubscription?: Subscription;
  // private formatPainterSubscription?: Subscription; // format painter removed
  private tableOptionsSubscription?: Subscription;
  private preserveHeaderOnUrlLoadSubscription?: Subscription;
  private columnRulesSubscription?: Subscription;
  private importSubscription?: Subscription;

  // One-shot format painter state removed

  /** Multi-cell selection state */
  private readonly selectedCells = signal<Set<string>>(new Set());
  private isSelecting = false;
  private selectionMode: 'table' | 'leafRect' | null = null;
  private selectionStart: { row: number; col: number } | null = null;
  private selectionEnd: { row: number; col: number } | null = null;
  private leafRectStart: { x: number; y: number } | null = null;
  private tableRectStart: { x: number; y: number } | null = null;
  /** Used to distinguish a simple click (should focus the editor) vs drag-selecting cells. */
  private didDragSelectSinceMouseDown = false;
  private readonly dragSelectThresholdPx = 4;

  get editing(): boolean {
    return this.isActivelyEditing();
  }

  // isFormatPainterActive removed

  get tableProps(): TableWidgetProps {
    return this.widget.props as TableWidgetProps;
  }

  get isLoading(): boolean {
    return this.isLoadingSig();
  }

  get loadingMessage(): string {
    return this.tableProps.loadingMessage || 'Loading…';
  }

  get errorMessage(): string | undefined {
    return this.tableProps.errorMessage;
  }

  get hasError(): boolean {
    return !!this.errorMessage && !this.isLoading;
  }

  get canRetry(): boolean {
    return this.hasError && !!this.tableProps.dataSource;
  }

  private get headerRowEnabled(): boolean {
    return !!this.tableProps.headerRow;
  }

  private get firstColumnEnabled(): boolean {
    return !!this.tableProps.firstColumn;
  }

  private get totalRowEnabled(): boolean {
    return !!this.tableProps.totalRow;
  }

  private get lastColumnEnabled(): boolean {
    return !!this.tableProps.lastColumn;
  }

  private get topLevelRowCount(): number {
    return this.getTopLevelRowCount(this.localRows());
  }

  private get topLevelColCount(): number {
    return this.getTopLevelColCount(this.localRows());
  }

  /**
   * PPT-like section styling: header row, total row, first/last column.
   * Returns only style overrides; user styles still apply.
   */
  getSectionStyle(rowIndex: number, colIndex: number): Partial<TableCellStyle> {
    const rowCount = this.topLevelRowCount;
    const colCount = this.topLevelColCount;
    const isHeaderRow = this.headerRowEnabled && rowIndex === 0;
    const isTotalRow = this.totalRowEnabled && rowIndex === rowCount - 1 && rowCount > 1;
    const isFirstCol = this.firstColumnEnabled && colIndex === 0;
    const isLastCol = this.lastColumnEnabled && colIndex === colCount - 1 && colCount > 1;

    // If multiple sections overlap, apply strongest semantics.
    // Header/Total rows typically win background; first/last cols win weight.
    const patch: Partial<TableCellStyle> = {};

    if (isHeaderRow) {
      patch.fontWeight = 'bold';
      patch.backgroundColor = '#e5e7eb';
      patch.verticalAlign = 'middle';
    }

    if (isTotalRow) {
      patch.fontWeight = 'bold';
      patch.backgroundColor = patch.backgroundColor ?? '#eef2f7';
      // Emphasize totals with a slightly stronger top border when borders are enabled.
      patch.borderStyle = patch.borderStyle ?? 'solid';
      patch.borderWidth = Math.max(patch.borderWidth ?? 1, 2);
    }

    if (isFirstCol || isLastCol) {
      patch.fontWeight = patch.fontWeight ?? 'bold';
      patch.backgroundColor = patch.backgroundColor ?? '#f1f5f9';
    }

    return patch;
  }

  get rows(): TableRow[] {
    return this.localRows();
  }

  get colFractions(): number[] {
    const cols = this.getTopLevelColCount(this.localRows());
    // Ghost-only resize: do not apply any live preview fractions to layout.
    const current = this.columnFractions();
    return this.normalizeFractions(current, cols);
  }

  get rowFractionsView(): number[] {
    const rows = this.getTopLevelRowCount(this.localRows());
    // Ghost-only resize: do not apply any live preview fractions to layout.
    const current = this.rowFractions();
    return this.normalizeFractions(current, rows);
  }

  get topLevelGridTemplateColumns(): string {
    return this.colFractions.map((f) => `${f * 100}%`).join(' ');
  }

  get topLevelGridTemplateRows(): string {
    return this.rowFractionsView.map((f) => `${f * 100}%`).join(' ');
  }

  get colResizeHandles(): Array<{ boundaryIndex: number; leftPercent: number }> {
    const f = this.colFractions;
    if (f.length <= 1) return [];
    const out: Array<{ boundaryIndex: number; leftPercent: number }> = [];
    let acc = 0;
    for (let i = 1; i < f.length; i++) {
      acc += f[i - 1];
      out.push({ boundaryIndex: i, leftPercent: acc * 100 });
    }
    return out;
  }

  get rowResizeHandles(): Array<{ boundaryIndex: number; topPercent: number }> {
    const f = this.rowFractionsView;
    if (f.length <= 1) return [];
    const out: Array<{ boundaryIndex: number; topPercent: number }> = [];
    let acc = 0;
    for (let i = 1; i < f.length; i++) {
      acc += f[i - 1];
      out.push({ boundaryIndex: i, topPercent: acc * 100 });
    }
    return out;
  }

  get colResizeSegments(): ColResizeSegment[] {
    return this.colResizeSegmentsSig();
  }

  get rowResizeSegments(): RowResizeSegment[] {
    return this.rowResizeSegmentsSig();
  }

  get sharedSplitColResizeSegments(): SharedSplitColSegment[] {
    return this.sharedSplitColSegmentsSig();
  }

  get sharedSplitRowResizeSegments(): SharedSplitRowSegment[] {
    return this.sharedSplitRowSegmentsSig();
  }

  get ghostTopCols(): GhostColLine[] {
    const p = this.ghostTopColPercent();
    return p === null ? [] : [{ leftPercent: p }];
  }

  get ghostTopRows(): GhostRowLine[] {
    const p = this.ghostTopRowPercent();
    return p === null ? [] : [{ topPercent: p }];
  }

  get ghostSharedCols(): GhostColLine[] {
    const p = this.ghostSharedSplitColPercent();
    return p === null ? [] : [{ leftPercent: p }];
  }

  get ghostSharedRows(): GhostRowLine[] {
    const p = this.ghostSharedSplitRowPercent();
    return p === null ? [] : [{ topPercent: p }];
  }

  getSplitGhostCols(rowIndex: number, cellIndex: number, path: string): GhostColLine[] {
    const ownerLeafId = this.composeLeafId(rowIndex, cellIndex, path);
    const p = this.ghostSplitColWithinPercent().get(ownerLeafId);
    return p === undefined ? [] : [{ leftPercent: p }];
  }

  getSplitGhostRows(rowIndex: number, cellIndex: number, path: string): GhostRowLine[] {
    const ownerLeafId = this.composeLeafId(rowIndex, cellIndex, path);
    const p = this.ghostSplitRowWithinPercent().get(ownerLeafId);
    return p === undefined ? [] : [{ topPercent: p }];
  }

  private clearGhosts(): void {
    this.ghostTopColPercent.set(null);
    this.ghostTopRowPercent.set(null);
    this.ghostSharedSplitColPercent.set(null);
    this.ghostSharedSplitRowPercent.set(null);
    this.ghostSplitColWithinPercent.set(new Map());
    this.ghostSplitRowWithinPercent.set(new Map());
  }

  get widgetId(): string {
    return this.widget.id;
  }

  get selection(): Set<string> {
    return this.selectedCells();
  }

  getRenderableRowCells(rowIndex: number): Array<{ colIndex: number; cell: TableCell }> {
    const row = this.localRows()?.[rowIndex];
    if (!row) return [];
    return row.cells
      .map((cell, colIndex) => ({ cell, colIndex }))
      .filter(({ cell }) => !cell.coveredBy);
  }

  constructor() {
    // Recompute on zoom changes (canvas is scaled via transform: scale(...)).
    // IMPORTANT: effect() must be created in an injection context (constructor is OK).
    this.zoomEffectRef = effect(() => {
      this.uiState.zoomLevel();
      this.scheduleRecomputeResizeSegments();
    });

    // When the OUTER widget resizer is released, persist the fitted row fractions so the layout is stable.
    // This avoids the "header blocks shrink" problem by shrinking slack rows first.
    this.resizeEndEffectRef = effect(() => {
      const resizingId = this.uiState.resizingWidgetId();
      const myId = this.widget?.id;
      const isResizingMe = !!myId && resizingId === myId;
      const was = this.wasOuterResizingThisWidget;
      this.wasOuterResizingThisWidget = isResizingMe;

      // Capture the widget size at the start of the outer resize gesture so we can distinguish:
      // - width-only resizes (where auto-shrink-to-content is desirable)
      // - height-increasing resizes (where we should respect the user's chosen slack and NOT snap back)
      if (!was && isResizingMe) {
        const w = this.widget?.size?.width ?? null;
        const h = this.widget?.size?.height ?? null;
        this.outerResizeStartSize =
          Number.isFinite(w as number) && Number.isFinite(h as number) && (w as number) > 0 && (h as number) > 0
            ? { width: w as number, height: h as number }
            : null;
      }

      if (was && !isResizingMe) {
        this.scheduleOuterResizeCommitFit();
      }
    });

    // For ALL tables: compute and expose the true minimum table height (no clipping) whenever the table is selected.
    // This makes the outer widget resizer clamp consistently, not only for exported→imported URL tables.
    this.minHeightEffectRef = effect(() => {
      // IMPORTANT: don't early-return before reading signals, otherwise this effect may never re-run
      // (constructor runs before @Input is set).
      const activeId = this.uiState.activeWidgetId();
      this.uiState.zoomLevel();
      this.localRows();
      this.rowFractions();

      const myId = this.widget?.id;
      if (!myId || activeId !== myId) return;

      this.scheduleComputeContentMinTableHeight();
    });
  }

  ngOnInit(): void {
    const initialRows = this.cloneRows(this.tableProps.rows);
    const migrated = this.migrateLegacyMergedRegions(initialRows, this.tableProps.mergedRegions ?? []);
    this.localRows.set(migrated);
    this.initializeFractionsFromProps();
    this.isLoadingSig.set(!!this.tableProps.loading);

    // Sync persisted table options into toolbar state on init.
    this.toolbarService.syncTableOptionsFromProps(this.tableProps);
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    
    // Register cell getter with toolbar service
    this.toolbarService.setSelectedCellsGetter(() => this.getSelectedCellElements());

    this.splitSubscription = this.toolbarService.splitCellRequested$.subscribe((request) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applySplitToSelection(request);
    });

    this.mergeSubscription = this.toolbarService.mergeCellsRequested$.subscribe(() => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyMergeSelection();
    });

    this.insertSubscription = this.toolbarService.insertRequested$.subscribe((request: TableInsertRequest) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyInsert(request);
    });

    this.deleteSubscription = this.toolbarService.deleteRequested$.subscribe((request: TableDeleteRequest) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyDelete(request);
    });

    this.fitRowSubscription = this.toolbarService.fitRowRequested$.subscribe((request: TableFitRowRequest) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      if (request.kind !== 'fit-active-or-selection') {
        return;
      }
      this.fitActiveOrSelectedRowsToContent();
    });

    this.tableOptionsSubscription = this.toolbarService.tableOptionsRequested$.subscribe(({ options, widgetId }) => {
      // Only respond if the event is for THIS table widget.
      if (widgetId !== this.widget.id) {
        return;
      }
      // Persist as discrete, undoable change.
      const nextHeaderRow = !!options.headerRow;
      const patch: Partial<TableWidgetProps> = {
        headerRow: nextHeaderRow,
        firstColumn: !!options.firstColumn,
        totalRow: !!options.totalRow,
        lastColumn: !!options.lastColumn,
      };

      // Keep header metadata consistent:
      // - If header row is disabled, also disable URL header preservation.
      // - If header row is enabled, ensure headerRowCount is at least 1 (if unset).
      if (!nextHeaderRow) {
        patch.headerRowCount = 0;
        patch.preserveHeaderOnUrlLoad = false;
      } else {
        const curCount =
          typeof this.tableProps.headerRowCount === 'number' && Number.isFinite(this.tableProps.headerRowCount)
            ? Math.max(1, Math.trunc(this.tableProps.headerRowCount))
            : 1;
        patch.headerRowCount = curCount;
      }

      this.propsChange.emit(patch);
    });

    this.preserveHeaderOnUrlLoadSubscription = this.toolbarService.preserveHeaderOnUrlLoadRequested$.subscribe(
      ({ widgetId, enabled }) => {
        if (widgetId !== this.widget.id) {
          return;
        }

        const patch: Partial<TableWidgetProps> = {
          preserveHeaderOnUrlLoad: !!enabled,
        };

        // Enabling this option implies we must have a header row to preserve.
        if (enabled) {
          patch.headerRow = true;
          const curCount =
            typeof this.tableProps.headerRowCount === 'number' && Number.isFinite(this.tableProps.headerRowCount)
              ? Math.max(1, Math.trunc(this.tableProps.headerRowCount))
              : 1;
          patch.headerRowCount = curCount;
        }

        this.propsChange.emit(patch);
      }
    );

    this.columnRulesSubscription = this.toolbarService.columnRulesRequested$.subscribe(({ widgetId, columnRules }) => {
      if (widgetId !== this.widget.id) {
        return;
      }
      this.propsChange.emit({
        columnRules: Array.isArray(columnRules) ? columnRules : [],
      });
    });

    this.importSubscription = this.toolbarService.importFromExcelRequested$.subscribe((req) => {
      if (req.widgetId !== this.widget.id) {
        return;
      }
      this.applyExcelImport(req);
    });

    this.textAlignSubscription = this.toolbarService.textAlignRequested$.subscribe((align) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ textAlign: align });
    });

    this.verticalAlignSubscription = this.toolbarService.verticalAlignRequested$.subscribe((align) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ verticalAlign: align });
    });

    this.cellBackgroundSubscription = this.toolbarService.cellBackgroundColorRequested$.subscribe((color) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ backgroundColor: color });
    });

    this.cellBorderSubscription = this.toolbarService.cellBorderRequested$.subscribe((border: CellBorderRequest) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({
        borderColor: border.color ?? undefined,
        borderWidth: border.width ?? undefined,
        borderStyle: border.style ?? undefined,
      });
    });

    this.fontFamilySubscription = this.toolbarService.fontFamilyRequested$.subscribe((fontFamily: string) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ fontFamily: fontFamily || undefined });
    });

    this.fontSizeSubscription = this.toolbarService.fontSizeRequested$.subscribe((fontSizePx: number | null) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ fontSizePx: fontSizePx ?? undefined });
    });

    this.fontWeightSubscription = this.toolbarService.fontWeightRequested$.subscribe((fontWeight: 'normal' | 'bold') => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ fontWeight });
    });

    this.fontStyleSubscription = this.toolbarService.fontStyleRequested$.subscribe((fontStyle: 'normal' | 'italic') => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ fontStyle });
    });

    this.textDecorationSubscription = this.toolbarService.textDecorationRequested$.subscribe(
      (textDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through') => {
        if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
          return;
        }
        this.applyStyleToSelection({ textDecoration });
      }
    );

    this.textColorSubscription = this.toolbarService.textColorRequested$.subscribe((color: string) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ color: color || undefined });
    });

    this.textHighlightSubscription = this.toolbarService.textHighlightRequested$.subscribe((color: string) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ textHighlightColor: color || undefined });
    });

    this.lineHeightSubscription = this.toolbarService.lineHeightRequested$.subscribe((lineHeight: string) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyStyleToSelection({ lineHeight: lineHeight || undefined });
    });

    // format painter subscription removed

    // Compute initial resize segments once the table is painted (RAF).
    this.scheduleRecomputeResizeSegments();
  }

  private applyExcelImport(req: TableImportFromExcelRequest): void {
    const preserveWidgetFrame = req.preserveWidgetFrame === true;
    const existingBeforeImport = this.localRows();
    const isUrlAutoLoad = preserveWidgetFrame && (this.tableProps.dataSource as any)?.kind === 'http';
    const preserveHeaderOnUrlLoad = isUrlAutoLoad && this.tableProps.preserveHeaderOnUrlLoad === true;
    const headerRowCountForTemplate =
      preserveHeaderOnUrlLoad ? this.getEffectiveHeaderRowCountFromProps(this.tableProps) : 0;

    // URL tables (export→import): preserve user formatting even though we strip remote data.
    // ExportService keeps a single empty "body template" row with cell styles (font-size/family/etc.).
    // When the real remote rows load, copy those template styles onto the incoming cells so the table
    // looks consistent with what the user designed, independent of the dynamic data payload.
    const templateRow =
      (Array.isArray(existingBeforeImport) && existingBeforeImport.length > 0
        ? existingBeforeImport[Math.min(existingBeforeImport.length - 1, headerRowCountForTemplate)]
        : null) ?? null;
    const templateCells: TableCell[] = Array.isArray(templateRow?.cells) ? (templateRow!.cells as any) : [];

    // Import is complete once we reach this point (backend response already received).
    // For preserved-frame (URL) imports, keep the overlay until the first fit pass completes,
    // otherwise the user sees a "font compute" pop as auto-fit scale stabilizes.
    if (preserveWidgetFrame) {
      this.preservedImportFitInProgress = true;
      this.isLoadingSig.set(true);
    } else {
      this.isLoadingSig.set(false);
    }

    // Map imported data into our row model.
    const importedRows: TableRow[] = req.rows.map((r, rowIndex) => ({
      id: r.id || `r-${rowIndex}`,
      cells: r.cells.map((c, colIndex) => ({
        id: c.id || `${rowIndex}-${colIndex}`,
        contentHtml: c.contentHtml ?? '',
        ...(isUrlAutoLoad && templateCells[colIndex]?.style ? { style: { ...(templateCells[colIndex].style as any) } } : {}),
        merge: c.merge ?? undefined,
        coveredBy: c.coveredBy ?? undefined,
      })),
    }));

    // URL auto-load mode: optionally preserve the existing header row(s) and replace only the body.
    const headerRowCount = headerRowCountForTemplate;

    const preservedHeaderRows =
      preserveHeaderOnUrlLoad && headerRowCount > 0
        ? this.cloneRows(existingBeforeImport.slice(0, Math.min(headerRowCount, existingBeforeImport.length)))
        : [];

    const targetColCount =
      preservedHeaderRows.length > 0
        ? this.getTopLevelColCount(preservedHeaderRows)
        : this.getTopLevelColCount(importedRows);

    const normalizedImportedBodyRows =
      preserveHeaderOnUrlLoad && preservedHeaderRows.length > 0
        ? this.normalizeImportedRowsToColumnCount(importedRows, targetColCount)
        : importedRows;

    // If the URL data includes its own header row, drop it when we already have a preserved header.
    const bodyRows =
      preserveHeaderOnUrlLoad && preservedHeaderRows.length > 0
        ? this.dropIncomingHeaderRowIfLikely(preservedHeaderRows, normalizedImportedBodyRows)
        : normalizedImportedBodyRows;

    // Final table content after import/load.
    const rows: TableRow[] =
      preserveHeaderOnUrlLoad && preservedHeaderRows.length > 0
        ? [...preservedHeaderRows, ...bodyRows]
        : bodyRows;

    // Reset transient UI state that may now point at non-existent leaves.
    this.clearSelection();
    this.activeCellElement = null;
    this.activeCellId = null;
    this.toolbarService.setActiveCell(null, this.widget.id);
    this.manualTopLevelRowMinHeightsPx = [];
    this.lastLeafTextLen.clear();

    this.localRows.set(this.cloneRows(rows));
    this.rowsAtEditStart = this.cloneRows(rows);

    const rowCount = this.getTopLevelRowCount(rows);
    const colCount = this.getTopLevelColCount(rows);

    const curW = this.widget?.size?.width ?? 0;
    const curH = this.widget?.size?.height ?? 0;

    this.autoFitTextToFrame = preserveWidgetFrame;

    // Set sizing state based on import mode:
    // - 'preserved' for URL tables: lock widget size, skip auto-fit on column resize
    // - 'auto' for user-triggered imports: normal auto-fit behavior
    this.sizingState = preserveWidgetFrame ? 'preserved' : 'auto';

    // By default (user-triggered imports), we make sure the widget is large enough so imported tables
    // don't start out with "microscopic" rows/cols, and then run AutoFit to avoid clipped content.
    //
    // For URL-based auto-load after JSON import/open, we MUST preserve the user's saved widget size
    // (height/width). Otherwise tables can "grow" significantly (often ~2x) when data is loaded.
    let targetW = curW;
    let targetH = curH;

    if (!preserveWidgetFrame) {
      const minW = Math.max(20, colCount * this.minColPx);
      // Use the same baseline row height as a freshly inserted table so single-line imports fit immediately.
      const baselineRowPx = Math.max(this.minRowPx, TABLE_INITIAL_ROW_PX);
      const minH = Math.max(20, rowCount * baselineRowPx);
      targetW = Math.max(curW, minW);
      targetH = Math.max(curH, minH);

      const dw = targetW - curW;
      const dh = targetH - curH;
      if ((dw !== 0 || dh !== 0) && Number.isFinite(dw) && Number.isFinite(dh)) {
        // Draft-only for now: committing size updates the store and would trigger ngOnChanges.
        // We must persist the imported rows/fractions first, otherwise the widget would re-render with the old (empty) props.
        this.growWidgetSizeBy(dw, dh, { commit: false });
      }
    }

    // Choose sizing fractions:
    // - For preserveWidgetFrame (URL auto-load after JSON import): prefer existing persisted fractions
    //   so the table retains the user's previous column/row sizing as much as possible.
    // - Otherwise (user-triggered imports): compute a content-weighted distribution (PPT-like).

    const existingCols = this.columnFractions();
    const existingRows = this.rowFractions();
    const pendingCols = this.pendingPropsColumnFractions;
    const pendingRows = this.pendingPropsRowFractions;

    const normalizedCols = (() => {
      if (preserveWidgetFrame && Array.isArray(existingCols) && existingCols.length === colCount) {
        return this.normalizeFractions(existingCols, colCount);
      }
      if (preserveWidgetFrame && Array.isArray(pendingCols) && pendingCols.length === colCount) {
        return this.normalizeFractions(pendingCols, colCount);
      }
      if (Array.isArray(req.columnFractions) && req.columnFractions.length === colCount) {
        return this.normalizeFractions(req.columnFractions, colCount);
      }
      const nextColFractions = this.computeImportColumnFractionsFromRows(rows, this.minColPx, targetW);
      return this.normalizeFractions(nextColFractions, colCount);
    })();

    const normalizedRows = (() => {
      if (preserveWidgetFrame && Array.isArray(existingRows) && existingRows.length === rowCount) {
        return this.normalizeFractions(existingRows, rowCount);
      }
      if (preserveWidgetFrame && Array.isArray(pendingRows)) {
        if (pendingRows.length === rowCount) {
          return this.normalizeFractions(pendingRows, rowCount);
        }
        // Fallback: preserve the header row share (and total row share if enabled) even if row count changed.
        const mapped = this.mapSavedRowFractionsToNewRowCount(pendingRows, rowCount);
        if (mapped) {
          return this.normalizeFractions(mapped, rowCount);
        }
      }
      if (Array.isArray(req.rowFractions) && req.rowFractions.length === rowCount) {
        return this.normalizeFractions(req.rowFractions, rowCount);
      }
      const nextRowFractions = Array.from({ length: rowCount }, () => 1 / rowCount);
      return this.normalizeFractions(nextRowFractions, rowCount);
    })();
    this.columnFractions.set(normalizedCols);
    this.rowFractions.set(normalizedRows);

    // Once we've applied real fractions for the real row/col counts, we can drop the pending copies.
    this.pendingPropsColumnFractions = null;
    this.pendingPropsRowFractions = null;

    // Persist imported rows + sizing to the document model immediately.
    // (This ensures a subsequent store-driven widget update doesn't overwrite the imported content.)
    this.propsChange.emit({
      rows,
      mergedRegions: [],
      columnFractions: normalizedCols,
      rowFractions: normalizedRows,
      loading: false,
      loadingMessage: undefined,
    });

    // Now commit any draft size we applied above (if any).
    queueMicrotask(() => {
      if (this.draftState.hasDraft(this.widget.id)) {
        this.draftState.commitDraft(this.widget.id);
      }
    });

    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();

    if (!preserveWidgetFrame) {
      // Run a deterministic AutoFit pass AFTER the DOM updates so no imported content is clipped.
      // (Uses the same proven flow as post-column-resize, but triggered on import.)
      window.requestAnimationFrame(() => {
        this.startAutoFitAfterTopColResize();
      });
    } else {
      // URL auto-load after JSON import/open: keep widget frame and preserve saved fractions,
      // but ensure NO rows are clipped by redistributing height within the current table frame.
      this.schedulePostImportFitHeaderRow();
    }
  }

  private getEffectiveHeaderRowCountFromProps(props: TableWidgetProps): number {
    if (!props?.headerRow) return 0;
    const n =
      typeof props.headerRowCount === 'number' && Number.isFinite(props.headerRowCount)
        ? Math.trunc(props.headerRowCount)
        : 1;
    return Math.max(0, n);
  }

  /**
   * URL table safety: normalize remote rows to our current column count so schema drift doesn't break layout.
   * Option 1: truncate extra columns; pad missing with empty cells.
   */
  private normalizeImportedRowsToColumnCount(rows: TableRow[], targetColCount: number): TableRow[] {
    const colCount = Math.max(1, Math.trunc(targetColCount || 0));

    return rows.map((r, rowIndex) => {
      const srcCells = Array.isArray(r?.cells) ? r.cells : [];
      const nextCells = Array.from({ length: colCount }, (_, colIndex) => {
        const c: any = srcCells[colIndex];
        return {
          id: c?.id || `${r.id || `r-${rowIndex}`}-${colIndex}`,
          contentHtml: c?.contentHtml ?? '',
          merge: c?.merge ?? undefined,
          coveredBy: c?.coveredBy ?? undefined,
        } as any;
      });

      // Clamp merge spans and drop invalid coveredBy that point outside the normalized column range.
      for (let colIndex = 0; colIndex < nextCells.length; colIndex++) {
        const cell: any = nextCells[colIndex];
        if (cell?.merge) {
          const rowSpan = Math.max(1, Math.trunc(cell.merge.rowSpan ?? 1));
          const maxColSpan = Math.max(1, colCount - colIndex);
          const colSpan = Math.max(1, Math.min(maxColSpan, Math.trunc(cell.merge.colSpan ?? 1)));
          cell.merge = { rowSpan, colSpan };
        }
        if (cell?.coveredBy) {
          const cbCol = Number(cell.coveredBy.col);
          const cbRow = Number(cell.coveredBy.row);
          if (!Number.isFinite(cbCol) || cbCol < 0 || cbCol >= colCount || !Number.isFinite(cbRow) || cbRow < 0) {
            cell.coveredBy = undefined;
          }
        }
      }

      return { id: r.id, cells: nextCells } as TableRow;
    });
  }

  /**
   * When preserving a custom header, we want incoming URL data to be BODY-only.
   * Some sources include a header row in the returned dataset; drop it if it looks like a header.
   */
  private dropIncomingHeaderRowIfLikely(preservedHeaderRows: TableRow[], incomingRows: TableRow[]): TableRow[] {
    if (!Array.isArray(incomingRows) || incomingRows.length === 0) return incomingRows;
    if (!Array.isArray(preservedHeaderRows) || preservedHeaderRows.length === 0) return incomingRows;

    const preservedHeader = preservedHeaderRows[0];
    const incomingFirst = incomingRows[0];
    const colCount = Math.max(
      1,
      Math.min(Array.isArray(preservedHeader?.cells) ? preservedHeader.cells.length : 0, Array.isArray(incomingFirst?.cells) ? incomingFirst.cells.length : 0)
    );

    const norm = (html: string) =>
      (html ?? '')
        .toString()
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    let comparable = 0;
    let exactMatches = 0;
    let incomingAllTextLike = true;

    for (let i = 0; i < colCount; i++) {
      const h = norm((preservedHeader?.cells?.[i] as any)?.contentHtml ?? '');
      const v = norm((incomingFirst?.cells?.[i] as any)?.contentHtml ?? '');
      if (h || v) {
        comparable++;
        if (h && v && h === v) exactMatches++;
      }
      // Heuristic: headers are typically non-numeric text labels across most columns.
      if (v && /[0-9]/.test(v) && !/^[0-9.\-+, ]+$/.test(v)) {
        // mixed content; keep as text-like
      } else if (v && /^[0-9.\-+, ]+$/.test(v)) {
        incomingAllTextLike = false;
      }
    }

    const matchRatio = comparable > 0 ? exactMatches / comparable : 0;
    const shouldDrop = matchRatio >= 0.5 || (comparable >= Math.max(1, Math.floor(colCount * 0.5)) && incomingAllTextLike);

    return shouldDrop ? incomingRows.slice(1) : incomingRows;
  }

  private schedulePostImportFitHeaderRow(): void {
    if (this.postImportFitHeaderRaf !== null) {
      cancelAnimationFrame(this.postImportFitHeaderRaf);
      this.postImportFitHeaderRaf = null;
    }

    // Two RAFs: wait for rows+fractions to render, then measure real DOM sizes.
    this.postImportFitHeaderRaf = window.requestAnimationFrame(() => {
      this.postImportFitHeaderRaf = null;
      window.requestAnimationFrame(() => {
        this.runPostImportFitHeaderRow();
      });
    });
  }

  /**
   * URL auto-load flow: we temporarily enter a special "preserved frame" mode so the widget does not
   * unexpectedly grow while data is loading. Once the first post-import fit stabilizes the layout,
   * we MUST return to normal behavior so the table behaves like any manually created/imported table.
   */
  private finalizePreservedImport(): void {
    if (!this.preservedImportFitInProgress) return;

    this.preservedImportFitInProgress = false;
    this.isLoadingSig.set(false);

    // Stop runtime-only shrink-to-fit. After initial render, URL tables should behave normally.
    this.autoFitTextToFrame = false;

    // Exit preserved sizing mode so widget/row/col resizing behaves like a normal table.
    if (this.sizingState === 'preserved') {
      this.sizingState = 'auto';
    }

    // Ensure the overlay + CSS scale update immediately under OnPush.
    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();
  }

  private runPostImportFitHeaderRow(): void {
    // If something disabled preserved mode before the RAF runs, still finalize and unlock normal behavior.
    if (!this.autoFitTextToFrame) {
      this.finalizePreservedImport();
      return;
    }

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 1) {
      // Nothing meaningful to fit; still finalize so the table doesn't remain "special" forever.
      this.finalizePreservedImport();
      return;
    }

    const rect = this.getTableRect();
    if (!rect) {
      // Can't measure right now; don't keep the table locked in preserved mode.
      this.finalizePreservedImport();
      return;
    }

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const tableHeightPx = Math.max(1, rect.height / zoomScale);

    const baseFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const heightsPx = baseFractions.map((f) => f * tableHeightPx);

    // Fit ALL rows: compute each row's content-min and redistribute within the fixed height.
    const fit = this.fitTopLevelRowsToContentWithinHeight(heightsPx, tableHeightPx, zoomScale);
    if (!fit) {
      this.finalizePreservedImport();
      return;
    }

    // Update layout immediately.
    this.rowFractions.set(this.normalizeFractions(fit.nextFractions, rowCount));
    // Keep the min-height clamp synced (preserved mode clamps to current widget height).
    this.setContentMinHeights(fit.minRequiredTableHeightPx);

    // If the imported URL data cannot fit within the current widget height, auto-grow once so content isn't clipped.
    // This addresses the "text is clipped until click/resize" issue for exported→reopened URL tables where the user
    // previously resized the widget smaller than the content requires.
    if (fit.minRequiredTableHeightPx > tableHeightPx + 1) {
      const bufferPx = 4;
      const stepPx = 8;
      const deficitPx = Math.max(0, fit.minRequiredTableHeightPx - tableHeightPx);
      const growPx = Math.min(1600, this.roundUpPx(deficitPx + bufferPx, stepPx));

      if (Number.isFinite(growPx) && growPx > 0.5) {
        const growRes = this.growWidgetSizeBy(0, growPx, { commit: true });
        const appliedGrowPx = growRes?.appliedHeightPx ?? 0;
        if (Number.isFinite(appliedGrowPx) && appliedGrowPx > 0.5) {
          const newTotalH = tableHeightPx + appliedGrowPx;

          // Grow only deficit rows (keep other rows' pixel heights stable) to minimize layout jump.
          const manualMins = this.ensureManualTopLevelRowMinHeightsPx(rowCount);
          const minHeightsPx = Array.from({ length: rowCount }, (_, r) => {
            const contentMin = this.computeMinTopLevelRowHeightPx(r, heightsPx, zoomScale, 'autoFit');
            const manualMin = manualMins[r] ?? 0;
            return Math.max(this.minRowPx, contentMin, manualMin);
          });

          const deficitRows: Array<{ r: number; deficitPx: number }> = [];
          let deficitSumPx = 0;
          for (let r = 0; r < rowCount; r++) {
            const cur = heightsPx[r] ?? 0;
            const min = minHeightsPx[r] ?? this.minRowPx;
            const d = Math.max(0, min - cur);
            if (d > 0.5) {
              deficitRows.push({ r, deficitPx: d });
              deficitSumPx += d;
            }
          }

          const nextHeights = [...heightsPx];
          if (deficitRows.length > 0) {
            const extraPx = Math.max(0, appliedGrowPx - deficitSumPx);
            for (const { r, deficitPx } of deficitRows) {
              const extraShare = deficitSumPx > 0 ? extraPx * (deficitPx / deficitSumPx) : 0;
              nextHeights[r] = (nextHeights[r] ?? 0) + deficitPx + extraShare;
            }
          } else {
            // If we couldn't detect a specific deficit row (edge cases), distribute extra to the last row.
            if (rowCount > 0) {
              nextHeights[rowCount - 1] = (nextHeights[rowCount - 1] ?? 0) + appliedGrowPx;
            }
          }

          const nextFractions = nextHeights.map((px) => px / newTotalH);
          this.rowFractions.set(this.normalizeFractions(nextFractions, rowCount));
          // Re-apply required height so preserved-mode clamp can track the new widget height.
          this.setContentMinHeights(fit.minRequiredTableHeightPx);
        }
      }
    }

    // Persist immediately so the user sees a stable, correct result without manual clicking.
    this.emitPropsChange(this.localRows());
    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();

    // Preserved-frame URL import: we intentionally kept the overlay up during the first fit pass.
    // Now that the layout + required height are stable, reveal the table.
    this.finalizePreservedImport();
  }

  private fitTopLevelRowsToContentWithinHeight(
    currentRowHeightsPx: number[],
    tableHeightPx: number,
    zoomScale: number,
    options?: { respectManualMins?: boolean }
  ): { nextFractions: number[]; minRequiredTableHeightPx: number; contentMinTableHeightPx: number } | null {
    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 0) return null;

    const safeH = Math.max(1, Number.isFinite(tableHeightPx) ? tableHeightPx : 0);
    const safeScale = Math.max(0.1, Number.isFinite(zoomScale) ? zoomScale : 1);
    const respectManualMins = options?.respectManualMins !== false;

    let heights = Array.isArray(currentRowHeightsPx) ? [...currentRowHeightsPx] : [];
    if (heights.length !== rowCount) {
      const base = this.normalizeFractions(this.rowFractions(), rowCount);
      heights = base.map((f) => f * safeH);
    }

    const maxIterations = 3;
    let minHeights: number[] = [];
    let contentMinSum = this.minRowPx * rowCount;
    let requiredMinSum = contentMinSum;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Compute min height for each row at current distribution.
      const contentMins = Array.from({ length: rowCount }, (_, r) =>
        this.computeMinTopLevelRowHeightPx(r, heights, safeScale, 'autoFit')
      );

      // Content-only minimums (for outer widget clamp).
      const contentMinHeights = contentMins.map((h) => Math.max(this.minRowPx, h ?? this.minRowPx));
      contentMinSum = contentMinHeights.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);

      // Effective minimums for this fitting pass. This may include manual mins (for auto-fit behavior),
      // but we intentionally do NOT expose them to the outer widget min-height clamp.
      minHeights = [...contentMinHeights];
      if (respectManualMins) {
        const manualMins = this.ensureManualTopLevelRowMinHeightsPx(rowCount);
        for (let r = 0; r < rowCount; r++) {
          const contentMin = minHeights[r] ?? this.minRowPx;
          const manualMin = manualMins[r] ?? 0;
          minHeights[r] = Math.max(this.minRowPx, contentMin, manualMin);
        }
      }

      requiredMinSum = minHeights.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);

      // Keep the outer resizer clamp synced to content-only min height.
      this.setContentMinHeights(contentMinSum);

      // If impossible to fit within current height, we can't redistribute enough.
      if (requiredMinSum > safeH + 1) {
        return {
          nextFractions: this.normalizeFractions(this.rowFractions(), rowCount),
          minRequiredTableHeightPx: requiredMinSum,
          contentMinTableHeightPx: this.contentMinTableHeightPx,
        };
      }

      let deficitSum = 0;
      let slackSum = 0;
      const deficit = Array.from({ length: rowCount }, () => 0);
      const slack = Array.from({ length: rowCount }, () => 0);

      for (let r = 0; r < rowCount; r++) {
        const cur = heights[r] ?? 0;
        const min = minHeights[r] ?? this.minRowPx;
        const d = Math.max(0, min - cur);
        const s = Math.max(0, cur - min);
        deficit[r] = d;
        slack[r] = s;
        deficitSum += d;
        slackSum += s;
      }

      if (deficitSum <= 1 || slackSum <= 1) {
        break;
      }

      const takeTotal = Math.min(deficitSum, slackSum);

      // Add to deficit rows.
      for (let r = 0; r < rowCount; r++) {
        const d = deficit[r] ?? 0;
        if (d <= 0) continue;
        heights[r] = (heights[r] ?? 0) + takeTotal * (d / deficitSum);
      }

      // Subtract from slack rows.
      for (let r = 0; r < rowCount; r++) {
        const s = slack[r] ?? 0;
        if (s <= 0) continue;
        heights[r] = Math.max(0, (heights[r] ?? 0) - takeTotal * (s / slackSum));
      }

      // Normalize total back to safeH to avoid drift due to rounding.
      const sum = heights.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
      if (Number.isFinite(sum) && sum > 0) {
        const scale = safeH / sum;
        heights = heights.map((px) => px * scale);
      }
    }

    const nextFractions = heights.map((px) => px / safeH);
    // Ensure clamp reflects the last computed content min height.
    this.setContentMinHeights(contentMinSum);
    return {
      nextFractions: this.normalizeFractions(nextFractions, rowCount),
      minRequiredTableHeightPx: requiredMinSum,
      contentMinTableHeightPx: this.contentMinTableHeightPx,
    };
  }

  private fitActiveOrSelectedRowsToContent(): void {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    // Ensure our model reflects any in-progress DOM edits before measuring.
    this.syncCellContent();

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 0) return;

    const ids = this.selectedCells().size > 0 ? Array.from(this.selectedCells()) : (this.activeCellId ? [this.activeCellId] : []);
    if (ids.length === 0) return;

    const targetRows = new Set<number>();
    for (const id of ids) {
      const parsed = this.parseLeafId(id);
      if (!parsed) continue;
      const r = Math.max(0, Math.min(rowCount - 1, Math.trunc(parsed.row)));
      targetRows.add(r);
    }
    if (targetRows.size === 0) return;

    const rect = this.getTableRect();
    if (!rect) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const tableHeightPx = Math.max(1, rect.height / zoomScale);

    const baseFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const currentHeightsPx = baseFractions.map((f) => f * tableHeightPx);

    const contentMinHeightsPx = Array.from({ length: rowCount }, (_, r) =>
      Math.max(this.minRowPx, this.computeMinTopLevelRowHeightPx(r, currentHeightsPx, zoomScale, 'autoFit'))
    );
    const contentMinSumPx = contentMinHeightsPx.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
    if (Number.isFinite(contentMinSumPx) && contentMinSumPx > 0) {
      this.setContentMinHeights(contentMinSumPx);
    }

    const desiredHeightsPx = [...currentHeightsPx];
    for (const r of targetRows) {
      desiredHeightsPx[r] = contentMinHeightsPx[r] ?? this.minRowPx;
    }

    const sumDesired = desiredHeightsPx.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);

    const sinkIndex = Math.max(0, rowCount - 1);

    // Case 1: Fits within existing widget height. Keep target rows tight, and let the bottom row absorb any remainder.
    if (sumDesired <= tableHeightPx + 0.5) {
      const remainder = Math.max(0, tableHeightPx - sumDesired);
      desiredHeightsPx[sinkIndex] = (desiredHeightsPx[sinkIndex] ?? 0) + remainder;

      const nextFractions = desiredHeightsPx.map((px) => px / tableHeightPx);
      this.rowFractions.set(this.normalizeFractions(nextFractions, rowCount));

      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    // Case 2: Need more height. First shrink non-target rows down to their content minimums.
    let excessPx = Math.max(0, sumDesired - tableHeightPx);
    let slackSumPx = 0;
    for (let r = 0; r < rowCount; r++) {
      if (targetRows.has(r)) continue;
      const slack = Math.max(0, (desiredHeightsPx[r] ?? 0) - (contentMinHeightsPx[r] ?? this.minRowPx));
      slackSumPx += slack;
    }

    if (slackSumPx >= excessPx - 0.5 && slackSumPx > 0.5) {
      // Redistribute by taking proportionally from slack.
      for (let r = 0; r < rowCount; r++) {
        if (targetRows.has(r)) continue;
        const min = contentMinHeightsPx[r] ?? this.minRowPx;
        const cur = desiredHeightsPx[r] ?? 0;
        const slack = Math.max(0, cur - min);
        if (slack <= 0) continue;
        const take = excessPx * (slack / slackSumPx);
        desiredHeightsPx[r] = Math.max(min, cur - take);
      }

      // Normalize totals back to tableHeightPx to avoid drift.
      const sumAfter = desiredHeightsPx.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
      const fix = Number.isFinite(sumAfter) ? tableHeightPx - sumAfter : 0;
      if (Number.isFinite(fix) && Math.abs(fix) > 0.5) {
        desiredHeightsPx[sinkIndex] = Math.max(contentMinHeightsPx[sinkIndex] ?? this.minRowPx, (desiredHeightsPx[sinkIndex] ?? 0) + fix);
      }

      const nextFractions = desiredHeightsPx.map((px) => px / tableHeightPx);
      this.rowFractions.set(this.normalizeFractions(nextFractions, rowCount));

      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    // Not enough slack: shrink everything possible, then grow widget so the fitted rows don't clip.
    for (let r = 0; r < rowCount; r++) {
      if (targetRows.has(r)) continue;
      desiredHeightsPx[r] = contentMinHeightsPx[r] ?? this.minRowPx;
    }

    const sumAfterShrink = desiredHeightsPx.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
    const deficitPx = Math.max(0, sumAfterShrink - tableHeightPx);
    if (deficitPx > 0.5) {
      const bufferPx = 4;
      const stepPx = 8;
      const growPx = Math.min(1600, this.roundUpPx(deficitPx + bufferPx, stepPx));
      const growRes = this.growWidgetSizeBy(0, growPx, { commit: true });
      const appliedGrowPx = growRes?.appliedHeightPx ?? 0;
      if (Number.isFinite(appliedGrowPx) && appliedGrowPx > 0.5) {
        const newTotalH = tableHeightPx + appliedGrowPx;
        const sumNow = desiredHeightsPx.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
        const extra = Math.max(0, newTotalH - sumNow);
        desiredHeightsPx[sinkIndex] = (desiredHeightsPx[sinkIndex] ?? 0) + extra;

        const nextFractions = desiredHeightsPx.map((px) => px / newTotalH);
        this.rowFractions.set(this.normalizeFractions(nextFractions, rowCount));
      }
    }

    this.emitPropsChange(this.localRows());
    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();
  }

  /**
   * When preserving the widget frame (URL auto-load after JSON import/open), tables can become "dense"
   * (many rows squeezed into a fixed height). We scale down padding/font-size to avoid clipped text
   * without changing the widget size.
   */
  get autoFitTextScale(): number {
    if (!this.autoFitTextToFrame) return 1;
    // Runtime-only scaling for dense URL tables when we preserve the widget frame.
    // This is intentionally NOT persisted into cell styles; it only adjusts rendering so text is not hidden.
    const rect = this.getTableRect();
    if (!rect) return 1;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const tableHeightPx = Math.max(1, rect.height / zoomScale);

    const required = Math.max(20, this.contentRequiredTableHeightPx);
    if (!Number.isFinite(required) || required <= 0) return 1;

    // If everything fits, keep normal sizing.
    if (required <= tableHeightPx + 1) return 1;

    // Scale down font + padding just enough to match the available height (with a small buffer).
    const bufferPx = 2;
    const ratio = Math.max(0.1, (tableHeightPx - bufferPx) / required);
    return this.clamp(ratio, 0.65, 1);
  }

  private mapSavedRowFractionsToNewRowCount(saved: number[], newRowCount: number): number[] | null {
    const n = Math.max(1, Math.trunc(newRowCount));
    if (!Array.isArray(saved) || saved.length === 0) return null;
    if (n === 1) return [1];

    // Normalize the saved array to weights (independent of its original length).
    const cleaned = saved.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
    const sum = cleaned.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sum) || sum <= 0) return null;
    const norm = cleaned.map((x) => x / sum);

    const preserveHeader = this.headerRowEnabled;
    const preserveTotal = this.totalRowEnabled;

    let first = preserveHeader ? (norm[0] ?? 0) : 0;
    let last = preserveTotal ? (norm[norm.length - 1] ?? 0) : 0;

    // Safety clamps so we always leave room for the other rows.
    first = this.clamp(first, 0, 0.6);
    last = this.clamp(last, 0, 0.6);
    const reserved = first + last;
    const remaining = Math.max(0.05, 1 - reserved);

    const out = Array.from({ length: n }, () => 0);
    out[0] = preserveHeader ? first : 0;
    out[n - 1] = preserveTotal ? last : 0;

    const midCount = n - 2;
    const midShare = midCount > 0 ? remaining / midCount : remaining;
    for (let i = 1; i <= n - 2; i++) {
      out[i] = midShare;
    }

    // If we didn't preserve header/total, distribute evenly.
    if (!preserveHeader && !preserveTotal) {
      return Array.from({ length: n }, () => 1 / n);
    }

    // Renormalize to sum to 1 (handles reserved clamping + remaining floor).
    const outSum = out.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(outSum) || outSum <= 0) return null;
    return out.map((x) => x / outSum);
  }

  private computeImportColumnFractionsFromRows(rows: TableRow[], minColPx: number, tableWidthPx: number): number[] {
    const colCount = this.getTopLevelColCount(rows);
    const safeMinColPx = Math.max(1, Math.round(Number.isFinite(minColPx) ? minColPx : 40));
    const safeW = Math.max(colCount * safeMinColPx, Math.round(Number.isFinite(tableWidthPx) ? tableWidthPx : 0));
    if (!Number.isFinite(safeW) || safeW <= 0) {
      return Array.from({ length: colCount }, () => 1 / colCount);
    }

    // Base weight = 1 so empty columns still get a share of the width.
    const weights = Array.from({ length: colCount }, () => 1);

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const cells = row?.cells ?? [];
      for (let c = 0; c < Math.min(colCount, cells.length); c++) {
        const cell = cells[c];
        if (!cell || cell.coveredBy) continue;

        const span = Math.max(1, Math.trunc(cell.merge?.colSpan ?? 1));
        const raw = this.htmlToPlainTextForSizing(cell.contentHtml ?? '');
        const text = (raw ?? '').trim();
        if (!text) continue;

        const score = this.computeTextSizingScore(text);
        // Compress extremes so one giant paragraph doesn't steal all width.
        const weight = Math.max(1, Math.sqrt(score + 1));
        const per = weight / span;
        const end = Math.min(colCount - 1, c + span - 1);
        for (let cc = c; cc <= end; cc++) {
          weights[cc] = Math.max(weights[cc] ?? 1, per);
        }
      }
    }

    const sumW = weights.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    if (!Number.isFinite(sumW) || sumW <= 0) {
      return Array.from({ length: colCount }, () => 1 / colCount);
    }

    const baseTotal = colCount * safeMinColPx;
    const extra = Math.max(0, safeW - baseTotal);
    const widthsPx = weights.map((w) => safeMinColPx + extra * (w / sumW));
    const fractions = widthsPx.map((px) => px / safeW);
    return this.normalizeFractions(fractions, colCount);
  }

  private htmlToPlainTextForSizing(html: string): string {
    const raw = (html ?? '').toString();
    if (!raw) return '';
    try {
      // Preserve <br> as a measurable newline.
      const withBreaks = raw.replace(/<br\s*\/?>/gi, '\n');
      const el = document.createElement('div');
      el.innerHTML = withBreaks;
      return (el.textContent ?? '').replace(/\r\n/g, '\n');
    } catch {
      return raw.replace(/<[^>]+>/g, ' ');
    }
  }

  private hasTextSelectionInActiveCell(): boolean {
    const cell = this.activeCellElement;
    if (!cell) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const r = sel.getRangeAt(0);
    if (r.collapsed) return false;
    const a = sel.anchorNode;
    const f = sel.focusNode;
    if (!a || !f) return false;
    return cell.contains(a) && cell.contains(f);
  }

  private escapeHtml(text: string): string {
    const s = (text ?? '').toString();
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private cellTextToHtml(text: string): string {
    const v = (text ?? '').toString();
    if (!v) return '';
    // Preserve intra-cell line breaks without introducing untrusted HTML.
    return this.escapeHtml(v).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
  }

  private parseClipboardTabularGrid(html: string, text: string): string[][] | null {
    // Prefer HTML tables (Excel/Sheets provides rich HTML).
    const rawHtml = (html ?? '').toString();
    if (rawHtml && typeof DOMParser !== 'undefined') {
      try {
        const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
        const table = doc.querySelector('table');
        if (table) {
          const out: string[][] = [];
          const rows = Array.from(table.querySelectorAll('tr'));
          for (const tr of rows) {
            const cells = Array.from(tr.children).filter((c) => {
              const tag = (c as HTMLElement).tagName?.toLowerCase?.() ?? '';
              return tag === 'td' || tag === 'th';
            }) as HTMLElement[];
            if (cells.length === 0) continue;
            out.push(cells.map((c) => (c.textContent ?? '').replace(/\r\n/g, '\n')));
          }

          while (out.length > 0 && out[out.length - 1].every((v) => (v ?? '').trim() === '')) {
            out.pop();
          }
          if (out.length === 0) return null;

          const maxCols = Math.max(1, ...out.map((r) => r.length));
          for (const r of out) {
            while (r.length < maxCols) r.push('');
          }
          return out;
        }
      } catch {
        // fall through
      }
    }

    const rawText = (text ?? '').toString();
    if (!rawText) return null;

    // Excel multi-cell copy uses tab-separated values with newlines between rows.
    if (!rawText.includes('\t') && !rawText.includes('\n') && !rawText.includes('\r\n')) {
      return null;
    }

    const lines = rawText.replace(/\r\n/g, '\n').split('\n');
    const grid = lines.map((line) => line.split('\t').map((v) => v ?? ''));

    while (grid.length > 0 && grid[grid.length - 1].every((v) => (v ?? '').trim() === '')) {
      grid.pop();
    }
    if (grid.length === 0) return null;

    const maxCols = Math.max(1, ...grid.map((r) => r.length));
    for (const r of grid) {
      while (r.length < maxCols) r.push('');
    }
    return grid;
  }

  private handleClipboardPaste(event: ClipboardEvent): void {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;
    if (this.isLoadingSig()) return;

    const container = this.tableContainer?.nativeElement;
    const target = event.target as HTMLElement | null;
    if (!container || !target || !container.contains(target)) return;

    // Only handle paste inside a cell editor.
    if (!target.closest?.('.table-widget__cell-editor')) return;

    const dt = event.clipboardData;
    if (!dt) return;

    const html = dt.getData('text/html') || '';
    const text = dt.getData('text/plain') || '';
    const grid = this.parseClipboardTabularGrid(html, text);
    if (!grid) return;

    const rowsN = grid.length;
    const colsN = Math.max(1, ...grid.map((r) => r.length));

    // If it's effectively a single value and the user isn't multi-selecting, keep normal paste behavior.
    if (rowsN <= 1 && colsN <= 1 && this.selectedCells().size <= 1) {
      return;
    }

    const baseLeafId = this.activeCellId ?? (this.selectedCells().size > 0 ? Array.from(this.selectedCells())[0] : null);
    if (!baseLeafId) return;

    const parsed = this.parseLeafId(baseLeafId);
    if (!parsed) return;

    // For now: spreadsheet-like paste only on the TOP-LEVEL grid (no nested split grids).
    if (parsed.path.length !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    this.applyTabularPasteToTopLevel(parsed.row, parsed.col, grid);
  }

  private applyTabularPasteToTopLevel(startRow: number, startCol: number, grid: string[][]): void {
    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const colCount = this.getTopLevelColCount(rowsModel);
    if (rowCount <= 0 || colCount <= 0) return;

    const r0 = Math.max(0, Math.min(rowCount - 1, Math.trunc(startRow)));
    const c0 = Math.max(0, Math.min(colCount - 1, Math.trunc(startCol)));

    // Sync current DOM edits before applying.
    this.syncCellContent();

    const touchedLeafIds: string[] = [];

    untracked(() => {
      this.localRows.update((rows) => {
        const next = this.cloneRows(rows);

        for (let dr = 0; dr < grid.length; dr++) {
          for (let dc = 0; dc < (grid[dr]?.length ?? 0); dc++) {
            const rr = r0 + dr;
            const cc = c0 + dc;
            if (rr < 0 || rr >= rowCount || cc < 0 || cc >= colCount) continue;

            let cell = next?.[rr]?.cells?.[cc];
            if (!cell) continue;

            if (cell.coveredBy) {
              const a = cell.coveredBy;
              cell = next?.[a.row]?.cells?.[a.col];
              if (!cell) continue;
              touchedLeafIds.push(`${a.row}-${a.col}`);
            } else {
              touchedLeafIds.push(`${rr}-${cc}`);
            }

            const html = this.cellTextToHtml(grid[dr][dc] ?? '');
            cell.contentHtml = this.normalizeEditorHtmlForModel(html);
          }
        }

        return next;
      });
    });

    // Update live DOM for visible editors (twSafeInnerHtml defers while focused).
    const unique = Array.from(new Set(touchedLeafIds));
    for (const id of unique) {
      const el = this.resolveLeafEditorElement(id, null);
      if (!el) continue;
      const model = this.getCellModelByLeafId(id);
      if (model) {
        el.innerHTML = model.contentHtml ?? '';
        if ((model.contentHtml ?? '') === '') {
          this.ensureCaretPlaceholderForEmptyEditor(el);
        }
      }
    }

    // Discrete paste action -> create undo step.
    this.commitChanges('autosave');

    // Best-effort: grow to avoid immediate clipping after large paste.
    if (this.activeCellId) {
      const activeEl = this.resolveLeafEditorElement(this.activeCellId, this.activeCellElement);
      const parsed = this.parseLeafId(this.activeCellId);
      if (activeEl && parsed && parsed.path.length === 0) {
        this.maybeAutoGrowToFit(activeEl, parsed.row, parsed.col, '');
      }
    }

    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();
  }

  private handleClipboardCopy(event: ClipboardEvent): void {
    const container = this.tableContainer?.nativeElement;
    const target = event.target as HTMLElement | null;
    if (!container || !target || !container.contains(target)) return;

    // If user is selecting text inside an editor, do not override normal copy.
    if (this.hasTextSelectionInActiveCell()) return;

    const selection = this.selectedCells();
    const baseLeafId = this.activeCellId ?? (selection.size > 0 ? Array.from(selection)[0] : null);
    if (!baseLeafId) return;

    const parsed = this.parseLeafId(baseLeafId);
    if (!parsed) return;
    if (parsed.path.length !== 0) return; // top-level only for now

    const bounds = this.computeTableBoundsForSelection(selection, baseLeafId);
    if (!bounds) return;

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const colCount = this.getTopLevelColCount(rowsModel);
    if (rowCount <= 0 || colCount <= 0) return;

    const r1 = Math.max(0, Math.min(rowCount - 1, Math.trunc(bounds.minRow)));
    const r2 = Math.max(0, Math.min(rowCount - 1, Math.trunc(bounds.maxRow)));
    const c1 = Math.max(0, Math.min(colCount - 1, Math.trunc(bounds.minCol)));
    const c2 = Math.max(0, Math.min(colCount - 1, Math.trunc(bounds.maxCol)));

    const grid: string[][] = [];
    for (let r = r1; r <= r2; r++) {
      const row: string[] = [];
      for (let c = c1; c <= c2; c++) {
        const cell = rowsModel?.[r]?.cells?.[c];
        if (!cell || cell.coveredBy) {
          row.push('');
          continue;
        }
        const text = this.htmlToPlainTextForSizing(cell.contentHtml ?? '').replace(/\r\n/g, '\n');
        row.push((text ?? '').replace(/\n/g, ' ').trim());
      }
      grid.push(row);
    }

    const tsv = grid.map((r) => r.map((v) => (v ?? '').replace(/\t/g, ' ')).join('\t')).join('\r\n');
    const htmlTable =
      '<table><tbody>' +
      grid.map((r) => '<tr>' + r.map((v) => '<td>' + this.escapeHtml(v ?? '') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table>';

    if (!event.clipboardData) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.clipboardData.setData('text/plain', tsv);
      event.clipboardData.setData('text/html', htmlTable);
    } catch {
      // ignore
    }
  }

  private computeTextSizingScore(text: string): number {
    const s = (text ?? '').toString();
    if (!s) return 0;
    const lines = s.split('\n');
    let maxLine = 0;
    for (const line of lines) {
      maxLine = Math.max(maxLine, (line ?? '').length);
    }

    const words = s.split(/\s+/).filter(Boolean);
    let maxWord = 0;
    for (const w of words) {
      maxWord = Math.max(maxWord, (w ?? '').length);
    }

    return Math.max(maxLine, maxWord, s.length > 0 ? 1 : 0);
  }

  /** Activate/select the table widget without focusing any cell (PPT-like). */
  private activateTableWidget(): void {
    this.toolbarService.setActiveTableWidget(this.widget.id);
    this.toolbarService.syncTableOptionsFromProps(this.tableProps);
    this.cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    // Recompute after view is laid out (also handles cases where ngOnInit RAF ran before table existed).
    this.scheduleRecomputeResizeSegments();

    // Excel-style clipboard support (multi-cell paste/copy). We only override default behavior for
    // tabular payloads; normal single-cell rich-text paste (and image paste handled by EditastraEditor)
    // remains unchanged.
    const container = this.tableContainer?.nativeElement;
    if (container) {
      this.clipboardPasteListener = (ev: ClipboardEvent) => this.handleClipboardPaste(ev);
      this.clipboardCopyListener = (ev: ClipboardEvent) => this.handleClipboardCopy(ev);
      try {
        container.addEventListener('paste', this.clipboardPasteListener, true);
        container.addEventListener('copy', this.clipboardCopyListener, true);
      } catch {
        // ignore
      }
    }

    // Recompute on actual table size changes.
    const table = this.getTableElement();
    if (table && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleRecomputeResizeSegments();
        this.scheduleOuterResizeFit();
      });
      this.resizeObserver.observe(table);
    }
  }

  private scheduleOuterResizeFit(): void {
    const myId = this.widget?.id;
    if (!myId) return;
    if (!this.uiState.isResizing(myId)) return; // only during OUTER widget resizing
    if (this.isResizingGrid || this.isResizingSplitGrid) return; // don't fight internal table resizers
    if (this.outerResizeFitRaf !== null) return;

    this.outerResizeFitRaf = window.requestAnimationFrame(() => {
      this.outerResizeFitRaf = null;
      this.runOuterResizeFit(false);
    });
  }

  private scheduleOuterResizeCommitFit(): void {
    if (this.outerResizeCommitRaf !== null) {
      cancelAnimationFrame(this.outerResizeCommitRaf);
      this.outerResizeCommitRaf = null;
    }

    if (this.computeMinHeightRaf !== null) {
      cancelAnimationFrame(this.computeMinHeightRaf);
      this.computeMinHeightRaf = null;
    }

    // Two RAFs: wait for the widget container to commit its final height.
    this.outerResizeCommitRaf = window.requestAnimationFrame(() => {
      this.outerResizeCommitRaf = null;
      window.requestAnimationFrame(() => {
        this.runOuterResizeFit(true);
      });
    });
  }

  private runOuterResizeFit(persist: boolean): void {
    // IMPORTANT: Widget resizing should work even for 'preserved' (URL-imported) tables.
    // The 'preserved' state only prevents automatic auto-fit during column resize, not manual widget resize.
    // When the user manually resizes the widget, we allow it and transition to 'fitted' state.

    const rect = this.getTableRect();
    if (!rect) return;

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 0) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const tableHeightPx = Math.max(1, rect.height / zoomScale);

    const baseFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const heightsPx = baseFractions.map((f) => f * tableHeightPx);

    const fit = this.fitTopLevelRowsToContentWithinHeight(heightsPx, tableHeightPx, zoomScale, {
      // Outer widget resize is a manual gesture; do NOT let in-memory manual row mins block it.
      respectManualMins: false,
    });
    if (!fit) return;

    this.rowFractions.set(this.normalizeFractions(fit.nextFractions, rowCount));
    this.setContentMinHeights(fit.minRequiredTableHeightPx);

    if (persist) {
      // If width shrink (or corner resize) increased wrapping, ensure we end the outer resize with NO clipped content.
      // IMPORTANT: match internal column-resize behavior:
      // - Grow the widget height if needed
      // - Grow ONLY the rows that need more height (deficit rows), keep other rows' pixel heights stable
      if (fit.minRequiredTableHeightPx > tableHeightPx + 1) {
        const minHeightsPx = Array.from({ length: rowCount }, (_, r) =>
          this.computeMinTopLevelRowHeightPx(r, heightsPx, zoomScale, 'autoFit')
        );

        const deficitRows: Array<{ r: number; deficitPx: number }> = [];
        let deficitSumPx = 0;
        for (let r = 0; r < rowCount; r++) {
          const cur = heightsPx[r] ?? 0;
          const min = minHeightsPx[r] ?? this.minRowPx;
          const d = Math.max(0, min - cur);
          if (d > 0.5) {
            deficitRows.push({ r, deficitPx: d });
            deficitSumPx += d;
          }
        }

        if (deficitSumPx > 0.5) {
          const bufferPx = 4;
          const stepPx = 8;
          const growPx = this.roundUpPx(deficitSumPx + bufferPx, stepPx);

          if (Number.isFinite(growPx) && growPx > 0.5) {
            // Update widget height (commit) and adjust fractions so only deficit rows gain height.
            this.suppressWidgetSyncDuringAutoFit = true;

            const growRes = this.growWidgetSizeBy(0, growPx, { commit: true });
            const appliedGrowPx = growRes?.appliedHeightPx ?? 0;

            if (Number.isFinite(appliedGrowPx) && appliedGrowPx > 0.5) {
              const newTotalH = tableHeightPx + appliedGrowPx;
              const nextHeights = [...heightsPx];

              // Give each deficit row exactly what it needs to reach its min, plus distribute any extra buffer
              // proportionally by deficit.
              const extraPx = Math.max(0, appliedGrowPx - deficitSumPx);
              for (const { r, deficitPx } of deficitRows) {
                const extraShare = deficitSumPx > 0 ? extraPx * (deficitPx / deficitSumPx) : 0;
                nextHeights[r] = (nextHeights[r] ?? 0) + deficitPx + extraShare;
              }

              const nextFractions = nextHeights.map((px) => px / newTotalH);
              this.rowFractions.set(this.normalizeFractions(nextFractions, rowCount));
              this.setContentMinHeights(fit.minRequiredTableHeightPx);
            }

            this.suppressWidgetSyncDuringAutoFit = false;
          }
        }
      }

      // If the user widened the widget (less wrapping), reclaim vertical slack after the resize gesture ends.
      // IMPORTANT: do NOT auto-shrink after a height-increasing resize; that feels like the resize "didn't stick".
      // Only tighten when the user increased width without increasing height (typical right/left handle resize).
      const start = this.outerResizeStartSize;
      const startW = start?.width ?? null;
      const startH = start?.height ?? null;
      const tableWidthPx = Math.max(1, rect.width / zoomScale);
      const tolPx = 1;
      const widthIncreased = Number.isFinite(startW as number) && (tableWidthPx > (startW as number) + tolPx);
      const heightIncreased =
        Number.isFinite(startH as number) && (tableHeightPx > (startH as number) + tolPx);
      if (widthIncreased && !heightIncreased) {
        this.tryAutoShrinkWidgetToContentMin({ commit: true });
      }

      // The user just performed a MANUAL outer resize. That gesture should be allowed to override any
      // prior manual row-resize minimums. Otherwise a row-resize that previously grew the table can
      // make the widget feel "stuck" when trying to shrink later.
      const finalRect = this.getTableRect();
      if (finalRect) {
        const finalTableHeightPx = Math.max(1, finalRect.height / zoomScale);
        const mins = this.ensureManualTopLevelRowMinHeightsPx(rowCount);
        const finalFractions = this.normalizeFractions(this.rowFractions(), rowCount);
        for (let r = 0; r < rowCount; r++) {
          const actualPx = (finalFractions[r] ?? 0) * finalTableHeightPx;
          if (!Number.isFinite(actualPx) || actualPx <= 0) continue;
          const curMin = mins[r] ?? 0;
          if (Number.isFinite(curMin) && curMin > 0) {
            mins[r] = Math.min(curMin, Math.round(actualPx));
          }
        }
        this.manualTopLevelRowMinHeightsPx = mins;
      }

      this.emitPropsChange(this.localRows());

      // Mark that rows are now tightly fitted after widget resize.
      // Transition from 'preserved' to 'fitted' when user manually resizes the widget.
      // This allows future widget resizing and column resizing to work normally.
      if (this.sizingState === 'preserved' || this.sizingState === 'auto') {
        this.sizingState = 'fitted';
      }

      // Clear captured start size once the resize is fully committed.
      this.outerResizeStartSize = null;
    }

    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();
  }

  private scheduleComputeContentMinTableHeight(): void {
    // If the outer resize flow is active, it already computes content min height.
    const myId = this.widget?.id;
    if (myId && this.uiState.isResizing(myId)) return;
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    if (this.computeMinHeightRaf !== null) return;
    this.computeMinHeightRaf = window.requestAnimationFrame(() => {
      this.computeMinHeightRaf = null;
      this.recomputeContentMinTableHeight();
    });
  }

  private recomputeContentMinTableHeight(): void {
    const rect = this.getTableRect();
    if (!rect) return;

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 0) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const tableHeightPx = Math.max(1, rect.height / zoomScale);

    const baseFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const heightsPx = baseFractions.map((f) => f * tableHeightPx);

    let minSum = 0;
    for (let r = 0; r < rowCount; r++) {
      minSum += this.computeMinTopLevelRowHeightPx(r, heightsPx, zoomScale, 'autoFit');
    }

    if (!Number.isFinite(minSum) || minSum <= 0) return;
    this.setContentMinHeights(minSum);

    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    if (this.isActivelyEditing()) {
      if (this.autosaveTimeoutId !== null) {
        clearTimeout(this.autosaveTimeoutId);
        this.autosaveTimeoutId = null;
      }
      this.commitChanges('destroy');
      this.pendingChangesRegistry.unregister(this.widget.id);
    }

    if (this.splitSubscription) {
      this.splitSubscription.unsubscribe();
    }
    if (this.mergeSubscription) {
      this.mergeSubscription.unsubscribe();
    }
    if (this.insertSubscription) {
      this.insertSubscription.unsubscribe();
    }
    if (this.deleteSubscription) {
      this.deleteSubscription.unsubscribe();
    }
    if (this.fitRowSubscription) {
      this.fitRowSubscription.unsubscribe();
    }
    if (this.textAlignSubscription) {
      this.textAlignSubscription.unsubscribe();
    }
    if (this.verticalAlignSubscription) {
      this.verticalAlignSubscription.unsubscribe();
    }
    if (this.cellBackgroundSubscription) {
      this.cellBackgroundSubscription.unsubscribe();
    }
    if (this.cellBorderSubscription) {
      this.cellBorderSubscription.unsubscribe();
    }
    if (this.fontFamilySubscription) {
      this.fontFamilySubscription.unsubscribe();
    }
    if (this.fontSizeSubscription) {
      this.fontSizeSubscription.unsubscribe();
    }
    if (this.fontWeightSubscription) {
      this.fontWeightSubscription.unsubscribe();
    }
    if (this.fontStyleSubscription) {
      this.fontStyleSubscription.unsubscribe();
    }
    if (this.textDecorationSubscription) {
      this.textDecorationSubscription.unsubscribe();
    }
    if (this.textColorSubscription) {
      this.textColorSubscription.unsubscribe();
    }
    if (this.textHighlightSubscription) {
      this.textHighlightSubscription.unsubscribe();
    }
    if (this.lineHeightSubscription) {
      this.lineHeightSubscription.unsubscribe();
    }
    // format painter subscription removed

    if (this.tableOptionsSubscription) {
      this.tableOptionsSubscription.unsubscribe();
    }
    if (this.preserveHeaderOnUrlLoadSubscription) {
      this.preserveHeaderOnUrlLoadSubscription.unsubscribe();
    }
    if (this.columnRulesSubscription) {
      this.columnRulesSubscription.unsubscribe();
    }

    if (this.importSubscription) {
      this.importSubscription.unsubscribe();
    }

    // Clipboard handlers
    const container = this.tableContainer?.nativeElement;
    if (container) {
      if (this.clipboardPasteListener) {
        try {
          container.removeEventListener('paste', this.clipboardPasteListener, true);
        } catch {
          // ignore
        }
      }
      if (this.clipboardCopyListener) {
        try {
          container.removeEventListener('copy', this.clipboardCopyListener, true);
        } catch {
          // ignore
        }
      }
    }
    this.clipboardPasteListener = null;
    this.clipboardCopyListener = null;
    
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    this.teardownGridResizeListeners();
    this.teardownSplitResizeListeners();

    if (this.autoFitRowHeightRaf !== null) {
      cancelAnimationFrame(this.autoFitRowHeightRaf);
      this.autoFitRowHeightRaf = null;
    }

    if (this.postImportFitHeaderRaf !== null) {
      cancelAnimationFrame(this.postImportFitHeaderRaf);
      this.postImportFitHeaderRaf = null;
    }

    if (this.outerResizeFitRaf !== null) {
      cancelAnimationFrame(this.outerResizeFitRaf);
      this.outerResizeFitRaf = null;
    }

    if (this.outerResizeCommitRaf !== null) {
      cancelAnimationFrame(this.outerResizeCommitRaf);
      this.outerResizeCommitRaf = null;
    }

    if (this.postCommitTopColResizeRaf !== null) {
      cancelAnimationFrame(this.postCommitTopColResizeRaf);
      this.postCommitTopColResizeRaf = null;
    }
    this.cancelAutoFitAfterColResize();

    if (this.resizeSegmentsRaf !== null) {
      cancelAnimationFrame(this.resizeSegmentsRaf);
      this.resizeSegmentsRaf = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.zoomEffectRef) {
      this.zoomEffectRef.destroy();
      this.zoomEffectRef = undefined;
    }

    if (this.resizeEndEffectRef) {
      this.resizeEndEffectRef.destroy();
      this.resizeEndEffectRef = undefined;
    }

    if (this.minHeightEffectRef) {
      this.minHeightEffectRef.destroy();
      this.minHeightEffectRef = undefined;
    }
    
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }
    
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.toolbarService.clearActiveCell();
      this.toolbarService.setSelectedCellsGetter(null);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !this.isActivelyEditing() && !this.suppressWidgetSyncDuringAutoFit) {
      const nextRows = this.cloneRows(this.tableProps.rows);
      const migrated = this.migrateLegacyMergedRegions(nextRows, this.tableProps.mergedRegions ?? []);
      this.localRows.set(migrated);
      this.initializeFractionsFromProps();
      if (!this.preservedImportFitInProgress) {
        this.isLoadingSig.set(!!this.tableProps.loading);
      }
      this.scheduleRecomputeResizeSegments();

      // Keep toolbar checkboxes aligned with persisted props.
      this.toolbarService.syncTableOptionsFromProps(this.tableProps);

      // If a document-level undo/redo happened while a cell was focused, we temporarily disabled
      // local "actively editing" gating to allow the store update to apply. Now restore edit mode + focus.
      if (this.resumeEditingAfterDocHistorySync) {
        this.resumeEditingAfterDocHistorySync = false;
        this.isActivelyEditing.set(true);
        // Reset baseline to the new store-driven state so autosave/blur don't re-emit it.
        this.rowsAtEditStart = this.cloneRows(this.localRows());

        const leafId = this.resumeLeafId;
        this.resumeLeafId = null;
        const savedOffset = this.resumeCursorOffset;
        const isRedo = this.resumeIsRedo;
        this.resumeCursorOffset = null;
        this.resumeIsRedo = false;

        if (leafId && this.tableContainer?.nativeElement) {
          const el = this.tableContainer.nativeElement.querySelector(
            `.table-widget__cell-editor[data-leaf="${leafId}"]`
          ) as HTMLElement | null;

          if (el) {
            // Ensure the focused cell reflects the new model immediately (twSafeInnerHtml defers while focused).
            const model = this.getCellModelByLeafId(leafId);
            if (model) {
              el.innerHTML = model.contentHtml ?? '';
            }
            this.activeCellElement = el;
            this.activeCellId = leafId;
            this.toolbarService.setActiveCell(el, this.widget.id);
            // Focus and restore cursor position in the same frame to avoid race conditions.
            requestAnimationFrame(() => {
              el.focus();
              if (isRedo) {
                // For redo: always place cursor at the end of restored content.
                this.setCursorAtEnd(el);
              } else if (savedOffset !== null) {
                // For undo: restore cursor to saved offset (clamped to new content length).
                this.setCursorOffsetInElement(el, savedOffset);
              } else {
                // Fallback: place cursor at the end of content.
                this.setCursorAtEnd(el);
              }
            });
          }
        }
      }
    }
  }

  private resumeEditingAfterDocHistorySync = false;
  private resumeLeafId: string | null = null;
  /** Saved cursor offset (character count from start) for restoration after undo. */
  private resumeCursorOffset: number | null = null;
  /** Whether the pending history sync is a redo (cursor goes to end) vs undo (cursor restored). */
  private resumeIsRedo = false;

  @HostListener('document:tw-table-pre-doc-undo', ['$event'])
  onPreDocUndo(event: Event): void {
    const ev = event as CustomEvent<{ widgetId?: string }>;
    const widgetId = ev?.detail?.widgetId ?? null;
    if (!widgetId || widgetId !== this.widget?.id) return;

    // Keep focus in the cell but allow the next store-driven widget update to apply by temporarily
    // disabling the "actively editing" gate. We'll restore edit mode after ngOnChanges applies it.
    this.resumeEditingAfterDocHistorySync = true;
    this.resumeLeafId = this.activeCellId;
    // Save cursor position before undo so we can restore it after content updates.
    this.resumeCursorOffset = this.getCursorOffsetInElement(this.activeCellElement);
    this.resumeIsRedo = false;
    this.isActivelyEditing.set(false);
  }

  @HostListener('document:tw-table-pre-doc-redo', ['$event'])
  onPreDocRedo(event: Event): void {
    const ev = event as CustomEvent<{ widgetId?: string }>;
    const widgetId = ev?.detail?.widgetId ?? null;
    if (!widgetId || widgetId !== this.widget?.id) return;

    this.resumeEditingAfterDocHistorySync = true;
    this.resumeLeafId = this.activeCellId;
    // For redo, cursor always goes to end of restored content.
    this.resumeIsRedo = true;
    this.isActivelyEditing.set(false);
  }

  hasPendingChanges(): boolean {
    if (!this.isActivelyEditing()) {
      return false;
    }
    const current = {
      rows: this.localRows(),
    };
    const baseline = {
      rows: this.rowsAtEditStart,
    };
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }

  flush(): void {
    if (this.isActivelyEditing()) {
      if (this.blurTimeoutId !== null) {
        clearTimeout(this.blurTimeoutId);
        this.blurTimeoutId = null;
      }
      if (this.autosaveTimeoutId !== null) {
        clearTimeout(this.autosaveTimeoutId);
        this.autosaveTimeoutId = null;
      }
      
      this.syncCellContent();
      this.commitChanges('flush');
      
      this.isActivelyEditing.set(false);
      this.editingChange.emit(false);
      this.pendingChangesRegistry.unregister(this.widget.id);
    }
  }

  composeLeafId(rowIndex: number, cellIndex: number, path: string): string {
    return path ? `${rowIndex}-${cellIndex}-${path}` : `${rowIndex}-${cellIndex}`;
  }

  appendPath(path: string, index: number): string {
    return path ? `${path}-${index}` : `${index}`;
  }

  isLeafSelected(rowIndex: number, cellIndex: number, path: string): boolean {
    return this.selectedCells().has(this.composeLeafId(rowIndex, cellIndex, path));
  }

  onCellFocus(cell: HTMLElement | null, rowIndex: number, cellIndex: number, leafPath?: string): void {
    if (!cell) return;
    this.activeCellElement = cell;
    this.activeCellId = leafPath ? this.composeLeafId(rowIndex, cellIndex, leafPath) : `${rowIndex}-${cellIndex}`;

    // Cell focus should also mark the table as active.
    this.activateTableWidget();
    this.toolbarService.setActiveCell(cell, this.widget.id);
    
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }
    
    if (!this.isActivelyEditing()) {
      this.isActivelyEditing.set(true);
      this.rowsAtEditStart = this.cloneRows(this.localRows());
      this.editingChange.emit(true);
      this.pendingChangesRegistry.register(this);
    }

    // If the editor is visually empty, ensure there's a caret-friendly placeholder.
    this.ensureCaretPlaceholderForEmptyEditor(cell);

    // Seed the last-known content size so we can detect delete/backspace on the first edit.
    const leafId = this.composeLeafId(rowIndex, cellIndex, leafPath ?? '');
    const textLen = this.htmlToPlainTextForSizing(cell.innerHTML).trim().length;
    this.lastLeafTextLen.set(leafId, Math.max(0, Math.trunc(textLen)));
  }

  onCellBlur(blurredEl: HTMLElement | null, rowIndex: number, cellIndex: number, leafPath?: string): void {
    if (!this.isActivelyEditing()) {
      return;
    }

    
    // IMPORTANT:
    // When switching cells quickly, autosave/active cell tracking can move to the next cell before
    // we persist the previous cell's DOM. Always sync using the blur event's element + its leaf id.
    const blurredLeafId = this.composeLeafId(rowIndex, cellIndex, leafPath ?? '');
    if (blurredEl) {
      this.syncCellContentFromElement(blurredEl, blurredLeafId);
    } else {
      this.syncCellContent();
    }
    
    this.blurTimeoutId = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const toolbarElement = document.querySelector('app-table-toolbar');
      
      const isStillInsideTable = activeElement && 
        this.tableContainer?.nativeElement?.contains(activeElement);
      const isStillInsideToolbar = activeElement && 
        toolbarElement?.contains(activeElement);
      
      if (!isStillInsideTable && !isStillInsideToolbar) {
        if (this.autosaveTimeoutId !== null) {
          clearTimeout(this.autosaveTimeoutId);
          this.autosaveTimeoutId = null;
        }
        this.commitChanges('blur');
        
        this.isActivelyEditing.set(false);
        this.editingChange.emit(false);
        this.activeCellElement = null;
        this.activeCellId = null;

        // Clear only cell focus; keep table selected until user clicks away.
        // IMPORTANT: In multi-table scenarios, another table may already be active.
        // Only clear the shared active cell if this table is still the active one.
        if (this.toolbarService.activeTableWidgetId === this.widget.id) {
          this.toolbarService.clearActiveCell();
        }
        this.pendingChangesRegistry.unregister(this.widget.id);
      }
      
      this.blurTimeoutId = null;
    }, 150);
  }

  onCellInput(el: HTMLElement | null, rowIndex: number, cellIndex: number, leafPath?: string): void {
    // Content is synced on blur to avoid frequent updates.
    // But we *do* auto-grow the table/widget when content needs more vertical space,
    // so the <td>/<tr> height expands with typing instead of the inner DIV overflowing.
    const leafId = this.composeLeafId(rowIndex, cellIndex, leafPath ?? '');
    if (el) {
      const nextTextLen = this.htmlToPlainTextForSizing(el.innerHTML).trim().length;
      const prevTextLen = this.lastLeafTextLen.get(leafId);
      // Only auto-shrink when content got smaller (delete/backspace / content removal).
      const shouldAutoShrink =
        typeof prevTextLen === 'number' && Number.isFinite(prevTextLen) && nextTextLen < prevTextLen;
      this.lastLeafTextLen.set(leafId, Math.max(0, Math.trunc(nextTextLen)));

      this.maybeAutoGrowToFit(el, rowIndex, cellIndex, leafPath);
      if (shouldAutoShrink) {
        this.scheduleAutoShrinkToFit(el, rowIndex, cellIndex, leafPath);
      }
    }

    this.scheduleAutosaveCommit(leafId, el);
    this.cdr.markForCheck();
  }

  private scheduleAutosaveCommit(leafId: string, el: HTMLElement | null): void {
    if (!this.isActivelyEditing()) return;

    if (this.autosaveTimeoutId !== null) {
      clearTimeout(this.autosaveTimeoutId);
      this.autosaveTimeoutId = null;
    }

    this.pendingAutosaveLeafId = leafId;
    this.pendingAutosaveElement = el;

    this.autosaveTimeoutId = window.setTimeout(() => {
      this.autosaveTimeoutId = null;
      // Ensure model has the latest content for the cell that scheduled this autosave (not "current active cell").
      const id = this.pendingAutosaveLeafId;
      const preferred = this.pendingAutosaveElement;
      this.pendingAutosaveLeafId = null;
      this.pendingAutosaveElement = null;

      if (id) {
        const resolved = this.resolveLeafEditorElement(id, preferred);
        if (resolved) {
          this.syncCellContentFromElement(resolved, id);
        } else {
          this.syncCellContent();
        }
      } else {
        this.syncCellContent();
      }
      this.commitChanges('autosave');
    }, this.autosaveDelayMs);
  }

  private maybeAutoGrowToFit(contentEl: HTMLElement, rowIndex: number, cellIndex: number, leafPath?: string): void {
    // If the content isn't overflowing vertically, nothing to do.
    //
    // IMPORTANT for split-cells:
    // The *clipping* element is often the split grid item (`.table-widget__sub-cell`, overflow: hidden),
    // while the contenteditable itself can size to content (so scrollHeight == clientHeight and we would miss overflow).
    // So we measure "visible height" from the clip container, and "needed height" from the content node.
    const isLeaf = !!(leafPath && leafPath.trim() !== '');
    const clipEl =
      (isLeaf
        ? (contentEl.closest('.table-widget__sub-cell') as HTMLElement | null)
        : (contentEl.closest('.table-widget__cell') as HTMLElement | null)) ?? contentEl;

    let visibleH = clipEl.clientHeight;
    if (!Number.isFinite(visibleH) || visibleH <= 0) {
      // Fallback: clientHeight can be 0 in some table/grid edge-cases; use bounding box.
      const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
      visibleH = Math.max(1, clipEl.getBoundingClientRect().height / zoomScale);
    }

    const neededH = Math.max(
      contentEl.scrollHeight || 0,
      contentEl.clientHeight || 0,
      contentEl.offsetHeight || 0
    );

    if (!Number.isFinite(visibleH) || !Number.isFinite(neededH) || visibleH <= 0 || neededH <= 0) return;

    const overflow = neededH - visibleH;
    // Allow 1px tolerance to avoid jitter due to sub-pixel rounding.
    if (overflow <= 1) return;

    // Add a small buffer so we don't grow on every single keystroke near a boundary.
    const bufferPx = 4;
    const stepPx = 8;
    const deltaPx = Math.min(600, this.roundUpPx(overflow + bufferPx, stepPx));
    if (deltaPx <= 0) return;

    const oldWidgetHeightPx = this.widget?.size?.height ?? 0;
    if (!Number.isFinite(oldWidgetHeightPx) || oldWidgetHeightPx <= 0) return;

    // Grow the widget FIRST (in draft-only mode) so other rows don't visually shrink.
    // (If we update fractions assuming a larger container, but the container hasn't grown yet,
    // non-target rows will temporarily shrink.)
    const growResult = this.growWidgetSizeBy(0, deltaPx, { commit: false });
    const appliedDeltaPx = growResult?.appliedHeightPx ?? 0;
    if (!Number.isFinite(appliedDeltaPx) || appliedDeltaPx <= 0) return;

    // If editing inside a split grid leaf, we must grow *each* ancestor split row chain so the extra height
    // actually reaches the specific split leaf (otherwise the new height gets distributed across unrelated split rows).
    if (leafPath && leafPath.trim() !== '') {
      const parts = leafPath
        .split('-')
        .map(p => Number.parseInt(p, 10))
        .filter(n => Number.isFinite(n) && n >= 0);

      if (parts.length > 0) {
        const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);

        // Collect split grids from nearest to farthest (deepest split -> outermost split).
        const splitGrids: HTMLElement[] = [];
        let cur: HTMLElement | null = contentEl.closest('.table-widget__split-grid') as HTMLElement | null;
        while (cur) {
          splitGrids.push(cur);
          const next = cur.parentElement?.closest('.table-widget__split-grid') as HTMLElement | null;
          cur = next && next !== cur ? next : null;
        }

        const levelCount = Math.min(parts.length, splitGrids.length);
        if (levelCount > 0) {
          const targets = Array.from({ length: levelCount }, (_, i) => {
            // Map nearest grid -> last index, outermost grid -> first index.
            const levelIndex = parts.length - 1 - i;
            const childIndex = parts[levelIndex];
            const ownerPath = parts.slice(0, levelIndex).join('-');
            const ownerLeafId = ownerPath ? `${rowIndex}-${cellIndex}-${ownerPath}` : `${rowIndex}-${cellIndex}`;

            const rect = splitGrids[i].getBoundingClientRect();
            const oldOwnerHeightPx = Math.max(1, rect.height / zoomScale);
            return { ownerLeafId, childIndex, oldOwnerHeightPx };
          }).reverse(); // apply outermost -> innermost for more intuitive propagation

          this.localRows.update((rows) => {
            const next = this.cloneRows(rows);

            for (const t of targets) {
              const parsed = this.parseLeafId(t.ownerLeafId);
              if (!parsed) continue;

              let baseCell = next?.[parsed.row]?.cells?.[parsed.col];
              if (!baseCell) continue;

              // Safety: if leaf id points to a covered top-level cell, redirect to its anchor.
              if (baseCell.coveredBy) {
                const a = baseCell.coveredBy;
                baseCell = next?.[a.row]?.cells?.[a.col];
                if (!baseCell) continue;
              }

              const owner = parsed.path.length === 0 ? baseCell : this.getCellAtPath(baseCell, parsed.path);
              if (!owner?.split) continue;

              const split: TableCellSplit = owner.split;
              const rowsCount = Math.max(1, split.rows);
              const colsCount = Math.max(1, split.cols);
              const childIdx = Math.max(0, Math.min(split.cells.length - 1, Math.trunc(t.childIndex)));

              const startRow = Math.max(0, Math.min(rowsCount - 1, Math.floor(childIdx / colsCount)));
              const childCell: TableCell = split.cells[childIdx];
              const rowSpan = Math.max(1, childCell?.merge?.rowSpan ?? 1);
              const endRow = Math.min(rowsCount - 1, startRow + rowSpan - 1);

              const oldH = t.oldOwnerHeightPx;
              const add = appliedDeltaPx;
              if (add <= 0 || oldH <= 0) continue;

              const base = this.normalizeFractions(split.rowFractions ?? [], rowsCount);
              const oldPx = base.map((f) => f * oldH);
              const newH = oldH + add;

              const indices = Array.from({ length: endRow - startRow + 1 }, (_, k) => startRow + k);
              const spanTotal = indices.reduce((sum, r) => sum + (oldPx[r] ?? 0), 0);
              const per = spanTotal > 0 ? null : add / indices.length;

              const newPx = [...oldPx];
              for (const r of indices) {
                const share = spanTotal > 0 ? ((oldPx[r] ?? 0) / spanTotal) : (per! / add);
                newPx[r] = (oldPx[r] ?? 0) + add * share;
              }

              const nextFractions = newPx.map((px) => px / newH);
              split.rowFractions = this.normalizeFractions(nextFractions, rowsCount);
            }

            return next;
          });
        }
      }
    }

    const topCell = this.localRows()?.[rowIndex]?.cells?.[cellIndex];
    const rowSpan = Math.max(1, topCell?.merge?.rowSpan ?? 1);

    // Keep existing row pixel sizes stable, and grow only the active row-span area.
    // Order matters: fractions are computed using the *current* widget height.
    this.growTopLevelRowSpanFractions(rowIndex, rowSpan, appliedDeltaPx, oldWidgetHeightPx);
    this.scheduleRecomputeResizeSegments();
  }

  private ensureManualTopLevelRowMinHeightsPx(rowCount: number): number[] {
    const n = Math.max(1, Math.trunc(rowCount));
    const cur = Array.isArray(this.manualTopLevelRowMinHeightsPx) ? this.manualTopLevelRowMinHeightsPx : [];
    if (cur.length === n) return cur;
    const next = cur.slice(0, n);
    while (next.length < n) next.push(0);
    this.manualTopLevelRowMinHeightsPx = next;
    return next;
  }

  private setManualTopLevelRowMinHeightPx(rowIndex: number, heightPx: number): void {
    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const mins = this.ensureManualTopLevelRowMinHeightsPx(rowCount);

    const i = Math.max(0, Math.min(rowCount - 1, Math.trunc(rowIndex)));
    const h = Number.isFinite(heightPx) ? Math.max(this.minRowPx, Math.round(heightPx)) : this.minRowPx;
    mins[i] = h;
    // Assign back for clarity (array is already mutated).
    this.manualTopLevelRowMinHeightsPx = mins;
  }

  private scheduleAutoShrinkToFit(contentEl: HTMLElement, rowIndex: number, cellIndex: number, leafPath?: string): void {
    if (this.autoFitRowHeightRaf !== null) {
      cancelAnimationFrame(this.autoFitRowHeightRaf);
      this.autoFitRowHeightRaf = null;
    }

    this.autoFitRowHeightRaf = window.requestAnimationFrame(() => {
      this.autoFitRowHeightRaf = null;
      this.maybeAutoShrinkToFit(contentEl, rowIndex, cellIndex, leafPath);
    });
  }

  private maybeAutoShrinkToFit(contentEl: HTMLElement, rowIndex: number, cellIndex: number, leafPath?: string): void {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    const oldWidgetHeightPx = this.widget?.size?.height ?? 0;
    if (!Number.isFinite(oldWidgetHeightPx) || oldWidgetHeightPx <= 0) return;

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 0) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);

    // Fast-path: if the active editor isn't showing extra vertical space, skip the expensive scan.
    const isLeaf = !!(leafPath && leafPath.trim() !== '');
    const clipEl =
      (isLeaf
        ? (contentEl.closest('.table-widget__sub-cell') as HTMLElement | null)
        : (contentEl.closest('.table-widget__cell') as HTMLElement | null)) ?? contentEl;

    let visibleH = clipEl.clientHeight;
    if (!Number.isFinite(visibleH) || visibleH <= 0) {
      visibleH = Math.max(1, clipEl.getBoundingClientRect().height / zoomScale);
    }

    const neededH = Math.max(contentEl.scrollHeight || 0, contentEl.clientHeight || 0, contentEl.offsetHeight || 0);
    if (!Number.isFinite(visibleH) || !Number.isFinite(neededH) || visibleH <= 0 || neededH <= 0) return;

    const slack = visibleH - neededH;
    // Small tolerance to avoid 1px oscillation due to rounding and font metrics.
    if (slack <= 6) return;

    const topRowIndex = Math.max(0, Math.min(rowCount - 1, Math.trunc(rowIndex)));

    // Content-based clamp (expensive but correct): compute the minimum allowed row height so shrinking doesn't hide content.
    const baseFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const oldRowHeightsPx = baseFractions.map((f) => f * oldWidgetHeightPx);
    const minContentPx = this.computeMinTopLevelRowHeightPx(topRowIndex, oldRowHeightsPx, zoomScale, 'autoFit');

    // Manual clamp: if the user resized this row, do not auto-shrink below their chosen height.
    const mins = this.ensureManualTopLevelRowMinHeightsPx(rowCount);
    const manualMinPx = mins[topRowIndex] ?? 0;

    const minAllowedPx = Math.max(this.minRowPx, minContentPx, manualMinPx);
    const curRowPx = oldRowHeightsPx[topRowIndex] ?? 0;
    const availableShrinkPx = curRowPx - minAllowedPx;
    if (!Number.isFinite(availableShrinkPx) || availableShrinkPx <= 0.5) return;

    const stepPx = 8;
    const maxPerTickPx = 600;
    const desiredShrinkPx = Math.min(maxPerTickPx, Math.floor(availableShrinkPx / stepPx) * stepPx);
    if (!Number.isFinite(desiredShrinkPx) || desiredShrinkPx <= 0) return;

    // Don't shrink the widget below its hard minimum.
    const maxShrinkByWidget = Math.max(0, oldWidgetHeightPx - 20);
    const shrinkPx = Math.min(desiredShrinkPx, maxShrinkByWidget);
    if (shrinkPx <= 0) return;

    // Shrink the widget FIRST (draft-only) so non-target rows don't visually grow.
    const shrinkResult = this.growWidgetSizeBy(0, -shrinkPx, { commit: false });
    const appliedDeltaPx = shrinkResult?.appliedHeightPx ?? 0; // negative
    const appliedShrinkPx = -appliedDeltaPx;
    if (!Number.isFinite(appliedShrinkPx) || appliedShrinkPx <= 0.1) return;

    const newWidgetHeightPx = Math.max(20, oldWidgetHeightPx - appliedShrinkPx);

    // Keep other row pixel sizes stable, and shrink only the active top-level row.
    const newRowHeightsPx = [...oldRowHeightsPx];
    newRowHeightsPx[topRowIndex] = Math.max(0, curRowPx - appliedShrinkPx);
    const nextFractions = newRowHeightsPx.map((px) => px / newWidgetHeightPx);
    this.rowFractions.set(this.normalizeFractions(nextFractions, nextFractions.length));
    this.previewRowFractions.set(null);

    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();
  }

  private roundUpPx(v: number, step: number): number {
    const s = Math.max(1, Math.floor(step));
    const n = Number.isFinite(v) ? v : 0;
    return Math.ceil(n / s) * s;
  }

  onCellKeydown(event: KeyboardEvent, rowIndex: number, cellIndex: number, leafPath?: string): void {
    // Handle Tab navigation between cells
    if (event.key === 'Tab') {
      event.preventDefault();
      this.syncCellContent();
      
      const rows = this.localRows();
      let nextRowIndex = rowIndex;
      let nextCellIndex = cellIndex;
      
      if (event.shiftKey) {
        // Move backwards
        nextCellIndex--;
        if (nextCellIndex < 0) {
          nextRowIndex--;
          if (nextRowIndex >= 0) {
            nextCellIndex = rows[nextRowIndex].cells.length - 1;
          }
        }
      } else {
        // Move forwards
        nextCellIndex++;
        if (nextCellIndex >= rows[rowIndex].cells.length) {
          nextRowIndex++;
          nextCellIndex = 0;
        }
      }
      
      if (nextRowIndex >= 0 && nextRowIndex < rows.length) {
        const nextCellContent = this.tableContainer?.nativeElement
          .querySelector(`[data-cell="${nextRowIndex}-${nextCellIndex}"] .table-widget__cell-editor`) as HTMLElement;
        if (nextCellContent) {
          nextCellContent.focus();
        }
      }
    }
  }

  trackByRowId(index: number, row: TableRow): string {
    return row.id;
  }

  trackByCellId(index: number, cell: TableCell): string {
    return cell.id;
  }

  trackByRenderableCell(index: number, item: { colIndex: number; cell: TableCell }): string {
    // Use the actual cell id for stable DOM reuse (even when some cells are skipped due to merges)
    return item.cell.id;
  }

  getRenderableSplitCells(cell: TableCell): Array<{ index: number; row: number; col: number; cell: TableCell }> {
    const split = cell.split;
    if (!split) return [];

    const cols = Math.max(1, split.cols);
    return split.cells
      .map((c, index) => ({
        index,
        row: Math.floor(index / cols),
        col: index % cols,
        cell: c,
      }))
      .filter(x => !x.cell.coveredBy);
  }

  trackByRenderableSplitCell(index: number, item: { index: number; row: number; col: number; cell: TableCell }): string {
    return item.cell.id;
  }

  private composeOwnerLeafId(rowIndex: number, cellIndex: number, path: string): string {
    return path ? `${rowIndex}-${cellIndex}-${path}` : `${rowIndex}-${cellIndex}`;
  }

  getSplitGridTemplateColumns(rowIndex: number, cellIndex: number, path: string, cell: TableCell): string {
    if (!cell.split) return '';
    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const f = this.getSplitColFractions(ownerLeafId, cell);
    return f.map(x => `${x * 100}%`).join(' ');
  }

  getSplitGridTemplateRows(rowIndex: number, cellIndex: number, path: string, cell: TableCell): string {
    if (!cell.split) return '';
    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const f = this.getSplitRowFractions(ownerLeafId, cell);
    return f.map(x => `${x * 100}%`).join(' ');
  }

  private getSplitColFractions(_ownerLeafId: string, cell: TableCell): number[] {
    if (!cell.split) return [];
    const cols = Math.max(1, cell.split.cols);
    // Ghost-only resize: do not apply any live preview fractions to layout.
    const current = cell.split.columnFractions ?? [];
    return this.normalizeFractions(current, cols);
  }

  private getSplitRowFractions(_ownerLeafId: string, cell: TableCell): number[] {
    if (!cell.split) return [];
    const rows = Math.max(1, cell.split.rows);
    // Ghost-only resize: do not apply any live preview fractions to layout.
    const current = cell.split.rowFractions ?? [];
    return this.normalizeFractions(current, rows);
  }

  getSplitColResizeSegments(rowIndex: number, cellIndex: number, path: string, cell: TableCell): ColResizeSegment[] {
    if (!cell.split) return [];
    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const colCount = Math.max(1, cell.split.cols);
    const rowCount = Math.max(1, cell.split.rows);
    if (colCount <= 1 || rowCount <= 0) return [];

    const colFractions = this.getSplitColFractions(ownerLeafId, cell);
    const rowFractions = this.getSplitRowFractions(ownerLeafId, cell);

    const acc = (arr: number[], endExclusive: number): number =>
      arr.slice(0, Math.max(0, endExclusive)).reduce((a, b) => a + b, 0);
    const sumRange = (arr: number[], start: number, endInclusive: number): number =>
      arr.slice(Math.max(0, start), Math.max(0, endInclusive) + 1).reduce((a, b) => a + b, 0);

    const split = cell.split;
    const anchorKey = (r: number, c: number): string => {
      const idx = r * colCount + c;
      const cc = split.cells[idx];
      if (!cc) return `${r}-${c}`;
      if (cc.coveredBy) return `${cc.coveredBy.row}-${cc.coveredBy.col}`;
      return `${r}-${c}`;
    };

    const segments: ColResizeSegment[] = [];
    for (let boundaryIndex = 1; boundaryIndex < colCount; boundaryIndex++) {
      let segStartRow: number | null = null;
      for (let r = 0; r < rowCount; r++) {
        const hasBorder = anchorKey(r, boundaryIndex - 1) !== anchorKey(r, boundaryIndex);
        if (hasBorder) {
          if (segStartRow === null) segStartRow = r;
        } else if (segStartRow !== null) {
          const segEndRow = r - 1;
          segments.push({
            boundaryIndex,
            leftPercent: acc(colFractions, boundaryIndex) * 100,
            topPercent: acc(rowFractions, segStartRow) * 100,
            heightPercent: sumRange(rowFractions, segStartRow, segEndRow) * 100,
          });
          segStartRow = null;
        }
      }
      if (segStartRow !== null) {
        const segEndRow = rowCount - 1;
        segments.push({
          boundaryIndex,
          leftPercent: acc(colFractions, boundaryIndex) * 100,
          topPercent: acc(rowFractions, segStartRow) * 100,
          heightPercent: sumRange(rowFractions, segStartRow, segEndRow) * 100,
        });
      }
    }
    return segments;
  }

  getSplitRowResizeSegments(rowIndex: number, cellIndex: number, path: string, cell: TableCell): RowResizeSegment[] {
    if (!cell.split) return [];
    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const colCount = Math.max(1, cell.split.cols);
    const rowCount = Math.max(1, cell.split.rows);
    if (rowCount <= 1 || colCount <= 0) return [];

    const colFractions = this.getSplitColFractions(ownerLeafId, cell);
    const rowFractions = this.getSplitRowFractions(ownerLeafId, cell);

    const acc = (arr: number[], endExclusive: number): number =>
      arr.slice(0, Math.max(0, endExclusive)).reduce((a, b) => a + b, 0);
    const sumRange = (arr: number[], start: number, endInclusive: number): number =>
      arr.slice(Math.max(0, start), Math.max(0, endInclusive) + 1).reduce((a, b) => a + b, 0);

    const split = cell.split;
    const anchorKey = (r: number, c: number): string => {
      const idx = r * colCount + c;
      const cc = split.cells[idx];
      if (!cc) return `${r}-${c}`;
      if (cc.coveredBy) return `${cc.coveredBy.row}-${cc.coveredBy.col}`;
      return `${r}-${c}`;
    };

    const segments: RowResizeSegment[] = [];
    for (let boundaryIndex = 1; boundaryIndex < rowCount; boundaryIndex++) {
      let segStartCol: number | null = null;
      for (let c = 0; c < colCount; c++) {
        const hasBorder = anchorKey(boundaryIndex - 1, c) !== anchorKey(boundaryIndex, c);
        if (hasBorder) {
          if (segStartCol === null) segStartCol = c;
        } else if (segStartCol !== null) {
          const segEndCol = c - 1;
          segments.push({
            boundaryIndex,
            topPercent: acc(rowFractions, boundaryIndex) * 100,
            leftPercent: acc(colFractions, segStartCol) * 100,
            widthPercent: sumRange(colFractions, segStartCol, segEndCol) * 100,
          });
          segStartCol = null;
        }
      }
      if (segStartCol !== null) {
        const segEndCol = colCount - 1;
        segments.push({
          boundaryIndex,
          topPercent: acc(rowFractions, boundaryIndex) * 100,
          leftPercent: acc(colFractions, segStartCol) * 100,
          widthPercent: sumRange(colFractions, segStartCol, segEndCol) * 100,
        });
      }
    }
    return segments;
  }

  private handleDocumentMouseDown = (event: MouseEvent): void => {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;
    // Check if click is outside the table AND outside the table toolbar.
    // If we clear selection when the user clicks the toolbar, multi-cell actions (like Split) won't work.
    const target = event.target as Node | null;
    const isInsideTable = !!(target && this.tableContainer?.nativeElement?.contains(target));
    const toolbarElement = document.querySelector('app-table-toolbar');
    const isInsideToolbar = !!(target && toolbarElement?.contains(target));
    
    // Also check if click is inside a color picker dropdown (which may be positioned outside toolbar)
    const isInsideColorPicker = !!(target && (
      (target as Element).closest('.color-picker') ||
      (target as Element).closest('.color-picker__dropdown') ||
      (target as Element).closest('.color-picker__trigger')
    ));

    // PPT-like: clicking anywhere on the table selects the table widget,
    // even if user doesn't focus a specific cell.
    if (isInsideTable) {
      this.activateTableWidget();
      return;
    }

    if (this.tableContainer?.nativeElement && !isInsideTable && !isInsideToolbar && !isInsideColorPicker) {
      this.clearSelection();
      // Clear table selection if user clicked away.
      if (this.toolbarService.activeTableWidgetId === this.widget.id) {
        this.toolbarService.clearActiveTableWidget();
      }
    }
  };

  private handleDocumentMouseUp = (): void => {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;
    if (this.isSelecting) {
      this.isSelecting = false;
    }
    this.selectionMode = null;
    this.leafRectStart = null;
    this.tableRectStart = null;

    // format painter handling removed

    // Debug: log final selection on mouseup for active table widget
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.logSelectedCells('mouseUp');
    }

    // Reset drag marker after the click event has had a chance to run.
    if (this.didDragSelectSinceMouseDown) {
      window.setTimeout(() => {
        this.didDragSelectSinceMouseDown = false;
      }, 0);
    }
  };

  private setEquals(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const v of a) {
      if (!b.has(v)) return false;
    }
    return true;
  }

  private getCellModelByLeafId(leafId: string): TableCell | null {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return null;

    let r = parsed.row;
    let c = parsed.col;
    const path = parsed.path;

    let baseCell = this.localRows()?.[r]?.cells?.[c];
    if (!baseCell) return null;

    if (baseCell.coveredBy) {
      const a = baseCell.coveredBy;
      r = a.row;
      c = a.col;
      baseCell = this.localRows()?.[r]?.cells?.[c];
      if (!baseCell) return null;
    }

    const target = path.length === 0 ? baseCell : this.getCellAtPath(baseCell, path);
    return target ?? null;
  }

  private handleDocumentMouseMove = (event: MouseEvent): void => {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;
    if (!this.isSelecting) {
      return;
    }

    // Mark as drag-select only after a small threshold (avoid blocking click-to-edit due to tiny mouse jitter).
    if (!this.didDragSelectSinceMouseDown) {
      const start = this.selectionMode === 'leafRect' ? this.leafRectStart : this.tableRectStart;
      if (start) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (dx * dx + dy * dy >= this.dragSelectThresholdPx * this.dragSelectThresholdPx) {
          this.didDragSelectSinceMouseDown = true;
        }
      }
    }

    if (this.selectionMode === 'leafRect' && this.leafRectStart) {
      const selection = this.computeLeafRectSelection(this.leafRectStart, { x: event.clientX, y: event.clientY });
      this.setSelection(selection);
      return;
    }

    if (this.selectionMode === 'table' && this.selectionStart) {
      const cell = this.getCellFromPoint(event.clientX, event.clientY);
      if (cell) {
        this.selectionEnd = cell;
        this.updateTableSelection({ x: event.clientX, y: event.clientY });
      }
    }
  };

  onCellMouseDown(event: MouseEvent, rowIndex: number, cellIndex: number): void {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;
    // Only start selection on left click without focus intent
    if (event.button !== 0) return;
    this.didDragSelectSinceMouseDown = false;

    // NOTE:
    // We intentionally DO NOT early-return when a contenteditable inside this cell is focused.
    // Previously, we returned to "allow text selection by dragging", but that caused two UX bugs:
    // - Clicking different sub-cells inside the same split parent kept the previous leaf id selected/logged.
    // - If a cell was in edit mode, you couldn't start cell-selection dragging from that cell.
    // This table widget behaves more like a spreadsheet: dragging selects cells (not text).

    // Mark this table widget as active for toolbar actions (even if no contenteditable is focused)
    this.activateTableWidget();
    // Only set an active cell if we actually have one for this table (avoid clearing the shared active cell).
    if (this.activeCellElement && this.tableContainer?.nativeElement?.contains(this.activeCellElement)) {
      this.toolbarService.setActiveCell(this.activeCellElement, this.widget.id);
    }

    const cellModel = this.localRows()?.[rowIndex]?.cells?.[cellIndex];
    const isSplitParent = !!cellModel?.split;

    // If selection starts inside a split cell, do leaf-rectangle selection
    if (isSplitParent) {
      // IMPORTANT: don't preventDefault here, otherwise the browser won't focus
      // the contenteditable sub-cell and typing won't work.
      this.isSelecting = true;
      this.selectionMode = 'leafRect';
      this.selectionStart = null;
      this.selectionEnd = null;
      this.leafRectStart = { x: event.clientX, y: event.clientY };

      const initialLeafId = this.getLeafIdFromPoint(event.clientX, event.clientY);
      this.setSelection(initialLeafId ? new Set([initialLeafId]) : new Set());
      return;
    }

    // If shift is held, extend selection
    if (event.shiftKey && this.selectionMode === 'table' && this.selectionStart) {
      event.preventDefault();
      this.selectionEnd = { row: rowIndex, col: cellIndex };
      this.updateSelection();
      return;
    }

    // Start new selection
    this.isSelecting = true;
    this.selectionMode = 'table';
    this.leafRectStart = null;
    this.tableRectStart = { x: event.clientX, y: event.clientY };
    this.selectionStart = { row: rowIndex, col: cellIndex };
    this.selectionEnd = { row: rowIndex, col: cellIndex };
    this.updateTableSelection({ x: event.clientX, y: event.clientY });
  }

  onCellClick(event: MouseEvent, rowIndex: number, cellIndex: number): void {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;
    if (event.button !== 0) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey) return;

    // If this interaction was a drag-select, don't steal focus at the end.
    if (this.didDragSelectSinceMouseDown) return;

    const target = event.target as HTMLElement | null;
    // If the click was already inside the editor, let the browser handle caret placement.
    if (target?.closest('.table-widget__cell-editor')) return;

    const cellEl = event.currentTarget as HTMLElement | null;
    if (!cellEl) return;

    // If click is inside a split sub-cell, focus that leaf; otherwise focus the first editor in this cell.
    const subCellEl = target?.closest('.table-widget__sub-cell') as HTMLElement | null;
    const searchRoot = subCellEl ?? cellEl;
    const editor = searchRoot.querySelector('.table-widget__cell-editor[data-leaf]') as HTMLElement | null;
    editor?.focus();
  }

  onCellMouseEnter(event: MouseEvent, rowIndex: number, cellIndex: number): void {
    if (this.isResizingGrid || this.isResizingSplitGrid) return;
    if (!this.isSelecting || this.selectionMode !== 'table') return;

    this.selectionEnd = { row: rowIndex, col: cellIndex };
    this.updateTableSelection({ x: event.clientX, y: event.clientY });
  }

  isCellSelected(rowIndex: number, cellIndex: number): boolean {
    const cellModel = this.localRows()?.[rowIndex]?.cells?.[cellIndex];
    if (cellModel?.split) {
      return false;
    }
    return this.selectedCells().has(`${rowIndex}-${cellIndex}`);
  }

  private updateSelection(): void {
    // Backwards-compatible entrypoint: table-only selection (no subcells).
    // Kept for any call sites we didn't refactor.
    const normal = this.computeNormalTableRectSelection();
    this.setSelection(normal);
  }

  private updateTableSelection(currentPoint: { x: number; y: number }): void {
    const normal = this.computeNormalTableRectSelection();
    const subCells = this.tableRectStart
      ? this.computeSubCellRectSelection(this.tableRectStart, currentPoint)
      : new Set<string>();

    const union = new Set<string>([...normal, ...subCells]);
    this.setSelection(union);
  }

  private computeNormalTableRectSelection(): Set<string> {
    if (!this.selectionStart || !this.selectionEnd) {
      return new Set<string>();
    }

    const minRow = Math.min(this.selectionStart.row, this.selectionEnd.row);
    const maxRow = Math.max(this.selectionStart.row, this.selectionEnd.row);
    const minCol = Math.min(this.selectionStart.col, this.selectionEnd.col);
    const maxCol = Math.max(this.selectionStart.col, this.selectionEnd.col);

    const selection = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        // Preserve existing behavior for normal cells:
        // - normal cells become selected as r-c
        // - split parents are NOT selected as r-c
        const cell = this.localRows()?.[r]?.cells?.[c];
        if (cell?.split) {
          continue;
        }
        selection.add(`${r}-${c}`);
      }
    }
    return selection;
  }

  clearSelection(): void {
    this.setSelection(new Set());
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
    this.selectionMode = null;
    this.leafRectStart = null;
    this.tableRectStart = null;
    this.cdr.markForCheck();

    // Debug: log when selection is cleared
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.logSelectedCells('clearSelection');
    }
  }

  private getCellFromPoint(x: number, y: number): { row: number; col: number } | null {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    const cellElement = element.closest('[data-cell]');
    if (!cellElement || !this.tableContainer?.nativeElement.contains(cellElement)) {
      return null;
    }

    const cellId = cellElement.getAttribute('data-cell');
    if (!cellId) return null;

    const [row, col] = cellId.split('-').map(Number);
    return { row, col };
  };

  private getSelectedCellElements(): HTMLElement[] {
    if (!this.tableContainer?.nativeElement) return [];
    
    const elements: HTMLElement[] = [];
    this.selectedCells().forEach(leafId => {
      const node = this.tableContainer?.nativeElement.querySelector(
        `.table-widget__cell-editor[data-leaf="${leafId}"]`
      ) as HTMLElement | null;
      if (node) {
        elements.push(node);
      }
    });
    return elements;
  }

  private setSelection(selection: Set<string>): void {
    const normalized = this.normalizeSelection(selection);
    this.selectedCells.set(normalized);
    this.toolbarService.setSelectedCells(normalized);
    // Keep toolbar merge button state in sync with actual merge rules.
    this.toolbarService.setCanMergeSelection(this.computeCanMergeSelection(normalized));
    this.cdr.markForCheck();
  }

  /**
   * Whether the current selection is actually mergeable.
   * This mirrors the same validation used by the merge implementation:
   * - top-level merge requires a filled rectangle and no merges extending outside
   * - split-grid merge requires a filled rectangle within the same split owner
   */
  private computeCanMergeSelection(selection: Set<string>): boolean {
    if (!selection || selection.size < 2) return false;

    const parsedAll = Array.from(selection)
      .map((id) => this.parseLeafId(id))
      .filter((p): p is { row: number; col: number; path: number[] } => !!p);

    if (parsedAll.length < 2) return false;

    const topLevelKeys = new Set(parsedAll.map((p) => `${p.row}-${p.col}`));
    const snapshot = this.localRows();

    // If selection spans multiple top-level cells, eligibility is based on top-level merge rectangle validity.
    if (topLevelKeys.size >= 2) {
      const coords = Array.from(topLevelKeys).map((k) => {
        const [row, col] = k.split('-').map(Number);
        return { row, col };
      });
      const expanded = this.expandTopLevelSelection(coords, snapshot);
      if (expanded.size < 2) return false;
      const rect = this.getTopLevelBoundingRect(expanded);
      if (!rect) return false;
      return this.isValidTopLevelMergeRect(rect, expanded, snapshot);
    }

    // Otherwise, allow merge only within a single split grid (sub-cells).
    const baseRow = parsedAll[0].row;
    const baseCol = parsedAll[0].col;
    if (!parsedAll.every((p) => p.row === baseRow && p.col === baseCol && p.path.length > 0)) {
      return false;
    }

    const depth = parsedAll[0].path.length;
    if (!parsedAll.every((p) => p.path.length === depth)) return false;

    const prefix = parsedAll[0].path.slice(0, -1);
    if (!parsedAll.every((p) => this.arraysEqual(p.path.slice(0, -1), prefix))) return false;

    const indices = parsedAll.map((p) => p.path[p.path.length - 1]);
    const baseCell = snapshot?.[baseRow]?.cells?.[baseCol];
    if (!baseCell || baseCell.coveredBy) return false;
    const owner = prefix.length === 0 ? baseCell : this.getCellAtPath(baseCell, prefix);
    if (!owner || !owner.split) return false;

    const expanded = this.expandSplitSelection(owner, indices);
    if (expanded.size < 2) return false;
    const rect = this.getSplitBoundingRect(owner.split.cols, expanded);
    if (!rect) return false;
    return this.isValidSplitMergeRect(owner, rect, expanded);
  }

  private normalizeSelection(selection: Set<string>): Set<string> {
    if (selection.size === 0) return selection;

    const normalized = new Set<string>();
    selection.forEach((id) => {
      const mapped = this.mapLeafIdThroughMerge(id);
      if (mapped) {
        normalized.add(mapped);
      }
    });
    return normalized;
  }

  /**
   * If an id points to a covered cell, map it to its merged anchor leaf id.
   * Otherwise, keep the id as-is.
   */
  private mapLeafIdThroughMerge(id: string): string | null {
    const parsed = this.parseLeafId(id);
    if (!parsed) return null;

    const { row, col, path } = parsed;
    const base = this.localRows()?.[row]?.cells?.[col];
    if (!base) return null;

    if (base.coveredBy) {
      // Covered cells are not rendered; normalize selection to the anchor cell.
      return `${base.coveredBy.row}-${base.coveredBy.col}`;
    }

    // Keep id (including sub-cell path) for normal / merged anchor cells.
    return path.length > 0 ? this.composeLeafId(row, col, path.join('-')) : `${row}-${col}`;
  }

  private getLeafIdFromPoint(x: number, y: number): string | null {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    const el = element as HTMLElement;

    // 1) Direct hit inside an editor
    const leafEl = el.closest('.table-widget__cell-editor[data-leaf]') as HTMLElement | null;
    if (leafEl) return leafEl.getAttribute('data-leaf') ?? null;

    // 2) Click on empty space inside a split sub-cell (e.g. above/below vertically-aligned content)
    const subCell = el.closest('.table-widget__sub-cell') as HTMLElement | null;
    if (subCell) {
      const leaf = subCell.querySelector('.table-widget__cell-editor[data-leaf]') as HTMLElement | null;
      return leaf?.getAttribute('data-leaf') ?? null;
    }

    // 3) Click on empty space inside a normal cell
    const cell = el.closest('.table-widget__cell') as HTMLElement | null;
    if (cell) {
      const leaf = cell.querySelector('.table-widget__cell-editor[data-leaf]') as HTMLElement | null;
      return leaf?.getAttribute('data-leaf') ?? null;
    }

    return null;
  }

  private computeLeafRectSelection(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): Set<string> {
    const container = this.tableContainer?.nativeElement;
    if (!container) return new Set();

    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);

    const selection = new Set<string>();
    const leaves = container.querySelectorAll('.table-widget__cell-editor[data-leaf]') as NodeListOf<HTMLElement>;
    leaves.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const intersects = rect.right >= x1 && rect.left <= x2 && rect.bottom >= y1 && rect.top <= y2;
      if (!intersects) return;
      const id = el.getAttribute('data-leaf');
      if (!id) return;
      selection.add(id);
    });

    return selection;
  }

  private computeSubCellRectSelection(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): Set<string> {
    const container = this.tableContainer?.nativeElement;
    if (!container) return new Set<string>();

    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);

    const selection = new Set<string>();
    const subLeaves = container.querySelectorAll(
      '.table-widget__cell-editor--subcell[data-leaf]'
    ) as NodeListOf<HTMLElement>;

    subLeaves.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const intersects = rect.right >= x1 && rect.left <= x2 && rect.bottom >= y1 && rect.top <= y2;
      if (!intersects) return;
      const id = el.getAttribute('data-leaf');
      if (!id) return;
      selection.add(id);
    });

    return selection;
  }

  private syncCellContent(): void {
    if (!this.activeCellElement || !this.activeCellId) {
      return;
    }
    this.syncCellContentFromElement(this.activeCellElement, this.activeCellId);
  }

  private syncCellContentFromElement(el: HTMLElement, leafId: string): void {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return;

    const { row: rowIndex, col: cellIndex, path } = parsed;
    const content = this.normalizeEditorHtmlForModel(el.innerHTML);

    untracked(() => {
      this.localRows.update(rows => {
        const newRows = this.cloneRows(rows);
        let baseCell = newRows[rowIndex]?.cells?.[cellIndex];
        if (!baseCell) {
          return newRows;
        }

        // Safety: if a covered cell somehow gets focused, redirect updates to its anchor.
        if (baseCell.coveredBy) {
          const a = baseCell.coveredBy;
          baseCell = newRows[a.row]?.cells?.[a.col];
          if (!baseCell) return newRows;
        }

        if (path.length === 0) {
          baseCell.contentHtml = content;
          return newRows;
        }

        const leaf = this.getCellAtPath(baseCell, path);
        if (leaf) {
          leaf.contentHtml = content;
        }
        return newRows;
      });
    });
  }

  private resolveLeafEditorElement(leafId: string, preferred: HTMLElement | null): HTMLElement | null {
    if (preferred && (preferred as any).isConnected) {
      const attr = preferred.getAttribute('data-leaf');
      if (attr === leafId) return preferred;
    }
    const container = this.tableContainer?.nativeElement;
    if (!container) return null;
    const esc = (v: string): string => {
      const css = (window as any).CSS;
      if (css && typeof css.escape === 'function') return css.escape(v);
      return v.replace(/"/g, '\\"');
    };
    return container.querySelector(`.table-widget__cell-editor[data-leaf="${esc(leafId)}"]`) as HTMLElement | null;
  }

  /**
   * Normalize editor HTML for persistence.\n   * - Removes legacy `.table-widget__valign` wrappers/classes.\n   * - Collapses purely-empty content to '' so empty cells don't keep phantom height.\n   */
  private normalizeEditorHtmlForModel(html: string): string {
    const raw = html ?? '';
    if (!raw) return '';
    try {
      const container = document.createElement('div');
      container.innerHTML = raw;

      // Back-compat: strip legacy valign wrappers by removing the class.
      const valignNodes = Array.from(container.querySelectorAll('.table-widget__valign')) as HTMLElement[];
      const hadLegacyValign = valignNodes.length > 0;
      for (const n of valignNodes) {
        n.classList.remove('table-widget__valign');
        if ((n.getAttribute('class') ?? '').trim() === '') {
          n.removeAttribute('class');
        }
      }

      // Detect & strip our caret placeholder marker so it never persists.
      const caretPlaceholderSelector = '[data-tw-caret-placeholder="1"]';
      const hadCaretPlaceholder = !!container.querySelector(caretPlaceholderSelector);
      const caretNodes = Array.from(container.querySelectorAll(caretPlaceholderSelector)) as HTMLElement[];
      for (const n of caretNodes) {
        n.removeAttribute('data-tw-caret-placeholder');
      }

      // If there is meaningful content (text or media), persist as-is.
      const text = (container.textContent ?? '')
        .replace(/\u200B/g, '')
        .replace(/\u00a0/g, ' ')
        .trim();
      const hasMedia = !!container.querySelector('img,svg,video,canvas,table');
      if (hasMedia || text !== '') {
        return container.innerHTML;
      }

      // No text/media. Treat placeholder-only markup as empty, but preserve user-entered line breaks.
      const brCount = container.querySelectorAll('br').length;
      if (brCount === 0) return '';

      const isSingleEmptyBlockWithSingleBr = (): boolean => {
        if (brCount !== 1) return false;

        // Case: "<br>"
        if (container.childNodes.length === 1 && container.firstChild?.nodeType === Node.ELEMENT_NODE) {
          const el = container.firstChild as HTMLElement;
          if (el.tagName === 'BR') return true;
        }

        // Case: "<div><br></div>" / "<p><br></p>" (optionally with empty inline wrappers)
        const children = Array.from(container.children) as HTMLElement[];
        if (children.length !== 1) return false;
        const root = children[0];
        const tag = root.tagName;
        if (tag !== 'DIV' && tag !== 'P') return false;
        if (root.querySelectorAll('br').length !== 1) return false;

        // Ensure no other meaningful content besides the single <br>.
        const clone = root.cloneNode(true) as HTMLElement;
        Array.from(clone.querySelectorAll('br')).forEach((b) => b.remove());
        const t = (clone.textContent ?? '')
          .replace(/\u200B/g, '')
          .replace(/\u00a0/g, ' ')
          .trim();
        const m = !!clone.querySelector('img,svg,video,canvas,table');
        return !m && t === '';
      };

      // Placeholder-only should collapse to empty (caret placeholder or legacy wrapper-only blocks).
      if (isSingleEmptyBlockWithSingleBr() && (hadCaretPlaceholder || hadLegacyValign)) {
        return '';
      }

      // Otherwise, preserve the HTML (including <br>) so manual blank lines remain.
      return container.innerHTML;
    } catch {
      // Fallback: keep raw content.
      const cleaned = (raw ?? '')
        .replace(/\u200B/g, '')
        .replace(/&ZeroWidthSpace;|&#8203;|&#x200B;/gi, '')
        .trim();
      return cleaned === '' ? '' : raw;
    }
  }

  private ensureCaretPlaceholderForEmptyEditor(el: HTMLElement): void {
    // Back-compat: if legacy valign wrappers exist in the live DOM, strip their class
    // so Enter behaves like normal new lines (div blocks) instead of duplicating wrapper semantics.
    const legacy = Array.from(el.querySelectorAll('.table-widget__valign')) as HTMLElement[];
    for (const n of legacy) {
      n.classList.remove('table-widget__valign');
      if ((n.getAttribute('class') ?? '').trim() === '') {
        n.removeAttribute('class');
      }
    }

    const normalized = this.normalizeEditorHtmlForModel(el.innerHTML);
    if (normalized !== '') return;

    // Use a single block with <br> so Enter creates normal sibling blocks.
    el.innerHTML = '<div data-tw-caret-placeholder="1"><br></div>';
  }

  private applyStyleToSelection(stylePatch: Partial<TableCellStyle>): void {
    // Keep content model in sync before applying style changes.
    this.syncCellContent();

    const selection = this.selectedCells();
    const targetLeafIds = new Set<string>();

    if (selection.size > 0) {
      selection.forEach(id => targetLeafIds.add(id));
    } else if (this.activeCellId) {
      targetLeafIds.add(this.activeCellId);
    }

    if (targetLeafIds.size === 0) {
      return;
    }

    const beforeRows = this.cloneRows(this.localRows());

    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);

      for (const leafId of targetLeafIds) {
        const parsed = this.parseLeafId(leafId);
        if (!parsed) continue;

        let r = parsed.row;
        let c = parsed.col;
        const path = parsed.path;

        let baseCell = newRows?.[r]?.cells?.[c];
        if (!baseCell) continue;

        // Safety: if a covered cell id somehow sneaks in, redirect to its anchor.
        if (baseCell.coveredBy) {
          const a = baseCell.coveredBy;
          r = a.row;
          c = a.col;
          baseCell = newRows?.[r]?.cells?.[c];
          if (!baseCell) continue;
        }

        const target = path.length === 0 ? baseCell : this.getCellAtPath(baseCell, path);
        if (!target) continue;

        // If we are applying cell-level styles, strip conflicting inline formatting
        // so that previously formatted segments don't remain styled.
        if (stylePatch.fontWeight === 'normal') {
          target.contentHtml = this.stripInlineTag(target.contentHtml, ['b', 'strong']);
        }
        if (stylePatch.fontStyle === 'normal') {
          target.contentHtml = this.stripInlineTag(target.contentHtml, ['i', 'em']);
        }
        if (stylePatch.textDecoration === 'none') {
          target.contentHtml = this.stripInlineTag(target.contentHtml, ['u', 's', 'strike', 'del']);
          target.contentHtml = this.stripInlineStyleProps(target.contentHtml, ['text-decoration', 'text-decoration-line']);
        }
        if (Object.prototype.hasOwnProperty.call(stylePatch, 'color')) {
          // When applying cell-level color, remove inline color overrides inside the cell.
          target.contentHtml = this.stripInlineStyleProps(target.contentHtml, ['color']);
        }
        if (Object.prototype.hasOwnProperty.call(stylePatch, 'textHighlightColor')) {
          // When applying cell-level highlight, remove inline background-color used as text mark.
          target.contentHtml = this.stripInlineStyleProps(target.contentHtml, ['background-color']);
        }
        if (Object.prototype.hasOwnProperty.call(stylePatch, 'lineHeight')) {
          target.contentHtml = this.stripInlineStyleProps(target.contentHtml, ['line-height']);
        }

        target.style = {
          ...(target.style ?? {}),
          ...stylePatch,
        };
      }

      return newRows;
    });

    // Persist immediately (discrete formatting action).
    const afterRows = this.localRows();
    if (JSON.stringify(afterRows) !== JSON.stringify(beforeRows)) {
      this.emitPropsChange(afterRows);
      // Reset baseline to avoid duplicate emits on blur
      this.rowsAtEditStart = this.cloneRows(afterRows);
    }

    this.cdr.markForCheck();
  }

  private stripInlineTag(html: string, tagNames: string[]): string {
    const input = (html ?? '').toString();
    if (!input.trim()) return input;

    // Fast path: if none of the tags are present, skip parsing.
    const hasAny = tagNames.some((t) => new RegExp(`<\\s*${t}\\b`, 'i').test(input));
    if (!hasAny) return input;

    try {
      const doc = document.implementation.createHTMLDocument('');
      const container = doc.createElement('div');
      container.innerHTML = input;

      for (const tag of tagNames) {
        const nodes = Array.from(container.querySelectorAll(tag));
        for (const n of nodes) {
          // unwrap while preserving children
          const parent = n.parentNode;
          if (!parent) continue;
          while (n.firstChild) {
            parent.insertBefore(n.firstChild, n);
          }
          parent.removeChild(n);
        }
      }

      return container.innerHTML;
    } catch {
      // On DOM parse failure, return original HTML.
      return input;
    }
  }

  private stripInlineStyleProps(html: string, cssProps: string[]): string {
    const input = (html ?? '').toString();
    if (!input.trim()) return input;
    if (!cssProps || cssProps.length === 0) return input;

    // Fast path: if no style attribute present, skip parsing.
    if (!/\bstyle\s*=\s*['"]/i.test(input)) return input;

    const propsLower = cssProps.map((p) => p.toLowerCase());

    try {
      const doc = document.implementation.createHTMLDocument('');
      const container = doc.createElement('div');
      container.innerHTML = input;

      const styled = Array.from(container.querySelectorAll('[style]')) as HTMLElement[];
      for (const el of styled) {
        const styleAttr = el.getAttribute('style');
        if (!styleAttr) continue;

        const parts = styleAttr
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);

        const kept: string[] = [];
        for (const decl of parts) {
          const idx = decl.indexOf(':');
          if (idx <= 0) {
            kept.push(decl);
            continue;
          }
          const prop = decl.slice(0, idx).trim().toLowerCase();
          if (propsLower.includes(prop)) {
            continue;
          }
          kept.push(decl);
        }

        if (kept.length === 0) {
          el.removeAttribute('style');
        } else {
          el.setAttribute('style', kept.join('; '));
        }
      }

      return container.innerHTML;
    } catch {
      return input;
    }
  }

  private getCellAtPath(root: TableCell, path: number[]): TableCell | null {
    let current: TableCell = root;
    for (const idx of path) {
      const next = current.split?.cells?.[idx];
      if (!next) {
        return null;
      }
      current = next;
    }
    return current;
  }

  private parseLeafId(leafId: string): { row: number; col: number; path: number[] } | null {
    const parts = leafId.split('-');
    if (parts.length < 2) return null;
    const row = Number(parts[0]);
    const col = Number(parts[1]);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;

    const path: number[] = [];
    for (const p of parts.slice(2)) {
      const n = Number(p);
      if (!Number.isFinite(n)) {
        return null;
      }
      path.push(n);
    }

    return { row, col, path };
  }

  private commitChanges(reason: 'blur' | 'flush' | 'destroy' | 'autosave'): void {
    const currentRows = this.localRows();
    const originalRows = this.rowsAtEditStart;

    const currentJson = JSON.stringify(currentRows);
    const originalJson = JSON.stringify(originalRows);
    if (currentJson !== originalJson) {
      // Always clear legacy mergedRegions when we emit, since merges are now inline on cells.
      this.emitPropsChange(currentRows);
      // Advance baseline so subsequent autosaves/blur don't emit the same change again.
      this.rowsAtEditStart = this.cloneRows(currentRows);
    }
  }

  private cloneRows(rows: TableRow[]): TableRow[] {
    const cloneCell = (cell: TableCell): TableCell => ({
      ...cell,
      style: cell.style ? { ...cell.style } : undefined,
      merge: cell.merge ? { ...cell.merge } : undefined,
      coveredBy: cell.coveredBy ? { ...cell.coveredBy } : undefined,
      split: cell.split
        ? {
            rows: cell.split.rows,
            cols: cell.split.cols,
            cells: cell.split.cells.map(cloneCell),
            columnFractions: cell.split.columnFractions ? [...cell.split.columnFractions] : undefined,
            rowFractions: cell.split.rowFractions ? [...cell.split.rowFractions] : undefined,
          }
        : undefined,
    });

    return rows.map(row => ({
      ...row,
      cells: row.cells.map(cloneCell),
    }));
  }

  private logSelectedCells(reason: string): void {
    const selected = Array.from(this.selectedCells());
    (window as any).__tableWidgetSelectedCells = selected;
    this.logger.debug(`[TableWidget ${this.widget.id}] selectedCells (${reason}):`, selected);
  }

  // ============================================
  // Insert row/column (table + split-aware)
  // ============================================

  private applyInsert(request: TableInsertRequest): void {
    this.syncCellContent();

    const baseLeafId =
      this.activeCellId ??
      (this.selectedCells().size > 0 ? Array.from(this.selectedCells())[0] : null);
    if (!baseLeafId) return;

    const axis = request.axis;
    const placement = request.placement;

    const target = this.resolveInsertTarget(baseLeafId, axis);

    if (target.kind === 'split') {
      const bounds = this.computeSplitBoundsForSelection(target, axis, this.selectedCells(), baseLeafId);
      if (!bounds) return;

      const insertIndex =
        axis === 'row'
          ? (placement === 'before' ? bounds.minRow : bounds.maxRow + 1)
          : (placement === 'before' ? bounds.minCol : bounds.maxCol + 1);

      this.insertIntoSplit(target, axis, placement, insertIndex);
      return;
    }

    const bounds = this.computeTableBoundsForSelection(this.selectedCells(), baseLeafId);
    if (!bounds) return;

    const insertIndex =
      axis === 'row'
        ? (placement === 'before' ? bounds.minRow : bounds.maxRow + 1)
        : (placement === 'before' ? bounds.minCol : bounds.maxCol + 1);

    this.insertIntoTable(axis, placement, insertIndex);
  }

  private applyDelete(request: TableDeleteRequest): void {
    this.syncCellContent();

    const baseLeafId =
      this.activeCellId ??
      (this.selectedCells().size > 0 ? Array.from(this.selectedCells())[0] : null);
    if (!baseLeafId) return;

    const axis = request.axis;
    const target = this.resolveInsertTarget(baseLeafId, axis);

    if (target.kind === 'split') {
      const bounds = this.computeSplitBoundsForSelection(target, axis, this.selectedCells(), baseLeafId);
      if (!bounds) return;
      // bounds are inclusive; delete the range selected by bounds for the axis.
      const start = axis === 'row' ? bounds.minRow : bounds.minCol;
      const end = axis === 'row' ? bounds.maxRow : bounds.maxCol;
      this.deleteFromSplit(target, axis, start, end);
      return;
    }

    const bounds = this.computeTableBoundsForSelection(this.selectedCells(), baseLeafId);
    if (!bounds) return;
    const start = axis === 'row' ? bounds.minRow : bounds.minCol;
    const end = axis === 'row' ? bounds.maxRow : bounds.maxCol;

    // PPT-like protection: when Header Row / Total Row / First/Last Column are enabled,
    // prevent deleting those protected bands on the top-level table.
    if (axis === 'row') {
      const rowCount = this.getTopLevelRowCount(this.localRows());
      const protectedStart = new Set<number>();
      if (this.headerRowEnabled) protectedStart.add(0);
      if (this.totalRowEnabled && rowCount > 1) protectedStart.add(rowCount - 1);
      for (let r = start; r <= end; r++) {
        if (protectedStart.has(r)) {
          return;
        }
      }
    }

    if (axis === 'col') {
      const colCount = this.getTopLevelColCount(this.localRows());
      const protectedCols = new Set<number>();
      if (this.firstColumnEnabled) protectedCols.add(0);
      if (this.lastColumnEnabled && colCount > 1) protectedCols.add(colCount - 1);
      for (let c = start; c <= end; c++) {
        if (protectedCols.has(c)) {
          return;
        }
      }
    }

    this.deleteFromTable(axis, start, end);
  }

  private resolveInsertTarget(leafId: string, axis: 'row' | 'col'): { kind: 'table' } | { kind: 'split'; ownerRow: number; ownerCol: number; ownerPath: number[] } {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return { kind: 'table' };

    let { row, col, path } = parsed;
    const rowsModel = this.localRows();
    let baseCell = rowsModel?.[row]?.cells?.[col];
    if (!baseCell) return { kind: 'table' };

    // If caller somehow points at a covered top-level cell, redirect to its anchor.
    if (baseCell.coveredBy) {
      const a = baseCell.coveredBy;
      row = a.row;
      col = a.col;
      path = [];
      baseCell = rowsModel?.[row]?.cells?.[col];
      if (!baseCell) return { kind: 'table' };
    }

    // Climb upward (nearest split to farthest) until we find a split with the right dimension.
    for (let i = path.length - 1; i >= 0; i--) {
      const ownerPath = path.slice(0, i);
      const ownerCell = ownerPath.length === 0 ? baseCell : this.getCellAtPath(baseCell, ownerPath);
      if (!ownerCell?.split) continue;
      const dim = axis === 'row' ? ownerCell.split.rows : ownerCell.split.cols;
      if (dim > 1) {
        return { kind: 'split', ownerRow: row, ownerCol: col, ownerPath };
      }
    }

    return { kind: 'table' };
  }

  private computeTableBoundsForSelection(selection: Set<string>, fallbackLeafId: string): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
    const ids = selection.size > 0 ? Array.from(selection) : [fallbackLeafId];
    const rowsModel = this.localRows();

    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    let minCol = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;

    for (const id of ids) {
      const parsed = this.parseLeafId(id);
      if (!parsed) continue;
      let r = parsed.row;
      let c = parsed.col;
      const cell = rowsModel?.[r]?.cells?.[c];
      if (!cell) continue;
      if (cell.coveredBy) {
        r = cell.coveredBy.row;
        c = cell.coveredBy.col;
      }
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    }

    if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) return null;
    return { minRow, maxRow, minCol, maxCol };
  }

  private computeSplitBoundsForSelection(
    target: { kind: 'split'; ownerRow: number; ownerCol: number; ownerPath: number[] },
    axis: 'row' | 'col',
    selection: Set<string>,
    fallbackLeafId: string
  ): { minRow: number; maxRow: number; minCol: number; maxCol: number; ownerRows: number; ownerCols: number; ownerDepth: number } | null {
    const rowsModel = this.localRows();
    const base = rowsModel?.[target.ownerRow]?.cells?.[target.ownerCol];
    if (!base) return null;
    const ownerCell = target.ownerPath.length === 0 ? base : this.getCellAtPath(base, target.ownerPath);
    if (!ownerCell?.split) return null;

    const cols = Math.max(1, ownerCell.split.cols);
    const rows = Math.max(1, ownerCell.split.rows);
    const ownerDepth = target.ownerPath.length;

    const ids = selection.size > 0 ? Array.from(selection) : [fallbackLeafId];

    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    let minCol = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;

    const matchesOwner = (p: { row: number; col: number; path: number[] }): boolean => {
      if (p.row !== target.ownerRow || p.col !== target.ownerCol) return false;
      if (p.path.length <= ownerDepth) return false;
      // Ensure prefix matches the chosen split owner path.
      for (let i = 0; i < ownerDepth; i++) {
        if (p.path[i] !== target.ownerPath[i]) return false;
      }
      return true;
    };

    for (const id of ids) {
      const parsed = this.parseLeafId(id);
      if (!parsed) continue;
      if (!matchesOwner(parsed)) continue;

      let childIdx = parsed.path[ownerDepth];
      const childCell = ownerCell.split.cells[childIdx];
      if (childCell?.coveredBy) {
        childIdx = childCell.coveredBy.row * cols + childCell.coveredBy.col;
      }

      const r = Math.floor(childIdx / cols);
      const c = childIdx % cols;

      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    }

    // If selection doesn't include any leaves in this owner (e.g. mixed selection), fall back to the active leaf.
    if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
      const parsed = this.parseLeafId(fallbackLeafId);
      if (!parsed || !matchesOwner(parsed)) return null;
      let childIdx = parsed.path[ownerDepth];
      const childCell = ownerCell.split.cells[childIdx];
      if (childCell?.coveredBy) {
        childIdx = childCell.coveredBy.row * cols + childCell.coveredBy.col;
      }
      const r = Math.floor(childIdx / cols);
      const c = childIdx % cols;
      minRow = maxRow = r;
      minCol = maxCol = c;
    }

    // Clamp bounds within the split grid.
    minRow = Math.max(0, Math.min(rows - 1, minRow));
    maxRow = Math.max(0, Math.min(rows - 1, maxRow));
    minCol = Math.max(0, Math.min(cols - 1, minCol));
    maxCol = Math.max(0, Math.min(cols - 1, maxCol));

    // For completeness; callers compute insertIndex by axis.
    if (axis === 'row') {
      return { minRow, maxRow, minCol: 0, maxCol: cols - 1, ownerRows: rows, ownerCols: cols, ownerDepth };
    }
    return { minRow: 0, maxRow: rows - 1, minCol, maxCol, ownerRows: rows, ownerCols: cols, ownerDepth };
  }

  private formatLeafId(row: number, col: number, path: number[]): string {
    return path.length > 0 ? `${row}-${col}-${path.join('-')}` : `${row}-${col}`;
  }

  private remapLeafIdForTableInsert(leafId: string, axis: 'row' | 'col', insertIndex: number): string | null {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return null;
    const row = axis === 'row' && parsed.row >= insertIndex ? parsed.row + 1 : parsed.row;
    const col = axis === 'col' && parsed.col >= insertIndex ? parsed.col + 1 : parsed.col;
    return this.formatLeafId(row, col, parsed.path);
  }

  private remapLeafIdForTableDelete(
    leafId: string,
    axis: 'row' | 'col',
    deleteStart: number,
    deleteEnd: number
  ): string | null {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return null;

    const start = Math.min(deleteStart, deleteEnd);
    const end = Math.max(deleteStart, deleteEnd);
    const removedCount = end - start + 1;

    const isDeleted = axis === 'row'
      ? parsed.row >= start && parsed.row <= end
      : parsed.col >= start && parsed.col <= end;
    if (isDeleted) return null;

    const row = axis === 'row' && parsed.row > end ? parsed.row - removedCount : parsed.row;
    const col = axis === 'col' && parsed.col > end ? parsed.col - removedCount : parsed.col;
    return this.formatLeafId(row, col, parsed.path);
  }

  private remapLeafIdForSplitInsert(
    leafId: string,
    target: { ownerRow: number; ownerCol: number; ownerPath: number[] },
    axis: 'row' | 'col',
    insertIndex: number,
    oldCols: number
  ): string | null {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return null;
    if (parsed.row !== target.ownerRow || parsed.col !== target.ownerCol) return leafId;

    const depth = target.ownerPath.length;
    if (parsed.path.length <= depth) return leafId;
    for (let i = 0; i < depth; i++) {
      if (parsed.path[i] !== target.ownerPath[i]) return leafId;
    }

    const childIdx = parsed.path[depth];
    const oldRow = Math.floor(childIdx / oldCols);
    const oldCol = childIdx % oldCols;

    const newRow = axis === 'row' && oldRow >= insertIndex ? oldRow + 1 : oldRow;
    const newCol = axis === 'col' && oldCol >= insertIndex ? oldCol + 1 : oldCol;
    const newCols = axis === 'col' ? oldCols + 1 : oldCols;
    const newIdx = newRow * newCols + newCol;

    const nextPath = [...parsed.path];
    nextPath[depth] = newIdx;
    return this.formatLeafId(parsed.row, parsed.col, nextPath);
  }

  private remapLeafIdForSplitDelete(
    leafId: string,
    target: { ownerRow: number; ownerCol: number; ownerPath: number[] },
    axis: 'row' | 'col',
    deleteStart: number,
    deleteEnd: number,
    oldCols: number,
    newCols: number
  ): string | null {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return null;
    if (parsed.row !== target.ownerRow || parsed.col !== target.ownerCol) return leafId;

    const depth = target.ownerPath.length;
    if (parsed.path.length <= depth) return leafId;
    for (let i = 0; i < depth; i++) {
      if (parsed.path[i] !== target.ownerPath[i]) return leafId;
    }

    const start = Math.min(deleteStart, deleteEnd);
    const end = Math.max(deleteStart, deleteEnd);
    const removedCount = end - start + 1;

    const childIdx = parsed.path[depth];
    const oldRow = Math.floor(childIdx / oldCols);
    const oldCol = childIdx % oldCols;

    const isDeleted = axis === 'row'
      ? oldRow >= start && oldRow <= end
      : oldCol >= start && oldCol <= end;
    if (isDeleted) return null;

    const nextRow = axis === 'row' && oldRow > end ? oldRow - removedCount : oldRow;
    const nextCol = axis === 'col' && oldCol > end ? oldCol - removedCount : oldCol;
    const nextIdx = nextRow * newCols + nextCol;

    const nextPath = [...parsed.path];
    nextPath[depth] = nextIdx;
    return this.formatLeafId(parsed.row, parsed.col, nextPath);
  }

  private insertFractions(
    current: number[],
    oldCount: number,
    insertIndex: number,
    placement: 'before' | 'after'
  ): number[] {
    const n = Math.max(1, Math.trunc(oldCount));
    const base = this.normalizeFractions(current ?? [], n);

    const clampedInsert = Math.max(0, Math.min(n, Math.trunc(insertIndex)));
    const donorIndex = placement === 'before'
      ? Math.min(clampedInsert, n - 1)
      : Math.max(0, Math.min(n - 1, clampedInsert - 1));

    const donor = base[donorIndex] ?? (1 / n);
    const half = donor / 2;

    const next = [...base];
    next[donorIndex] = donor - half;
    next.splice(clampedInsert, 0, half);
    return this.normalizeFractions(next, next.length);
  }

  private deleteFractionsKeepPxWithShrink(
    current: number[],
    oldCount: number,
    deleteStart: number,
    deleteEnd: number
  ): { nextFractions: number[]; removedFraction: number; removedCount: number } | null {
    const n = Math.max(1, Math.trunc(oldCount));
    const base = this.normalizeFractions(current ?? [], n);
    const start = Math.max(0, Math.min(n - 1, Math.min(deleteStart, deleteEnd)));
    const end = Math.max(0, Math.min(n - 1, Math.max(deleteStart, deleteEnd)));
    const removedCount = end - start + 1;
    if (removedCount >= n) return null;

    const removedFraction = base.slice(start, end + 1).reduce((a, b) => a + b, 0);
    const keep = base.filter((_, idx) => idx < start || idx > end);
    const denom = Math.max(1e-9, 1 - removedFraction);
    const next = keep.map((f) => f / denom);
    return { nextFractions: this.normalizeFractions(next, next.length), removedFraction, removedCount };
  }

  /**
   * Insert a new fraction while preserving existing row/col pixel sizes,
   * assuming the widget grows by (donorFraction * oldWidgetSizePx).
   *
   * Existing fractions are scaled by 1/(1+donorFraction); the inserted fraction is donorFraction/(1+donorFraction).
   */
  private insertFractionsKeepPxWithGrow(
    current: number[],
    oldCount: number,
    insertIndex: number,
    placement: 'before' | 'after'
  ): { nextFractions: number[]; donorFraction: number } {
    const n = Math.max(1, Math.trunc(oldCount));
    const base = this.normalizeFractions(current ?? [], n);

    const clampedInsert = Math.max(0, Math.min(n, Math.trunc(insertIndex)));
    const donorIndex =
      placement === 'before'
        ? Math.min(clampedInsert, n - 1)
        : Math.max(0, Math.min(n - 1, clampedInsert - 1));

    const donorFraction = base[donorIndex] ?? (1 / n);
    const scale = 1 + donorFraction;
    const scaled = base.map((x) => x / scale);
    const inserted = donorFraction / scale;
    scaled.splice(clampedInsert, 0, inserted);
    return { nextFractions: this.normalizeFractions(scaled, scaled.length), donorFraction };
  }

  private growWidgetSizeBy(
    deltaWidthPx: number,
    deltaHeightPx: number,
    options?: { commit?: boolean }
  ): { nextWidth: number; nextHeight: number; appliedWidthPx: number; appliedHeightPx: number } | null {
    const cur = this.widget?.size;
    if (!cur) return null;

    const dw = Number.isFinite(deltaWidthPx) ? deltaWidthPx : 0;
    const dh = Number.isFinite(deltaHeightPx) ? deltaHeightPx : 0;

    const nextWidth = Math.max(20, Math.round(cur.width + dw));
    const nextHeight = Math.max(20, Math.round(cur.height + dh));

    if (nextWidth === cur.width && nextHeight === cur.height) {
      return { nextWidth, nextHeight, appliedWidthPx: 0, appliedHeightPx: 0 };
    }

    // Draft first: this is reactive and keeps UI stable during interactions.
    this.draftState.updateDraftSize(this.widget.id, { width: nextWidth, height: nextHeight });
    if (options?.commit ?? true) {
      // Discrete sizing action (e.g., resize handle release, insert row/col).
      this.draftState.commitDraft(this.widget.id);
    }

    return {
      nextWidth,
      nextHeight,
      appliedWidthPx: nextWidth - cur.width,
      appliedHeightPx: nextHeight - cur.height,
    };
  }

  private growTopLevelRowSpanFractions(
    anchorRow: number,
    rowSpan: number,
    deltaPx: number,
    oldWidgetHeightPx?: number
  ): void {
    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const oldH = Number.isFinite(oldWidgetHeightPx as number) ? (oldWidgetHeightPx as number) : this.widget.size.height;
    const add = Number.isFinite(deltaPx) ? deltaPx : 0;
    if (add <= 0 || oldH <= 0) return;

    const base = this.normalizeFractions(this.rowFractions(), rowCount);
    const oldPx = base.map((f) => f * oldH);
    const newH = oldH + add;

    const start = Math.max(0, Math.min(rowCount - 1, Math.trunc(anchorRow)));
    const span = Math.max(1, Math.trunc(rowSpan));
    const end = Math.min(rowCount - 1, start + span - 1);
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const spanTotal = indices.reduce((sum, i) => sum + oldPx[i], 0);
    const per = spanTotal > 0 ? null : add / indices.length;

    const newPx = [...oldPx];
    for (const i of indices) {
      const share = spanTotal > 0 ? (oldPx[i] / spanTotal) : (per! / add);
      newPx[i] = oldPx[i] + add * share;
    }

    const next = newPx.map((px) => px / newH);
    this.rowFractions.set(this.normalizeFractions(next, next.length));
  }

  private growTopLevelColSpanFractions(anchorCol: number, colSpan: number, deltaPx: number): void {
    const rowsModel = this.localRows();
    const colCount = this.getTopLevelColCount(rowsModel);
    const oldW = this.widget.size.width;
    const add = Number.isFinite(deltaPx) ? deltaPx : 0;
    if (add <= 0 || oldW <= 0) return;

    const base = this.normalizeFractions(this.columnFractions(), colCount);
    const oldPx = base.map((f) => f * oldW);
    const newW = oldW + add;

    const start = Math.max(0, Math.min(colCount - 1, Math.trunc(anchorCol)));
    const span = Math.max(1, Math.trunc(colSpan));
    const end = Math.min(colCount - 1, start + span - 1);
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const spanTotal = indices.reduce((sum, i) => sum + oldPx[i], 0);
    const per = spanTotal > 0 ? null : add / indices.length;

    const newPx = [...oldPx];
    for (const i of indices) {
      const share = spanTotal > 0 ? (oldPx[i] / spanTotal) : (per! / add);
      newPx[i] = oldPx[i] + add * share;
    }

    const next = newPx.map((px) => px / newW);
    this.columnFractions.set(this.normalizeFractions(next, next.length));
  }

  private shrinkTopLevelRowSpanFractions(anchorRow: number, rowSpan: number, deltaPx: number): void {
    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const oldH = this.widget.size.height;
    const sub = Number.isFinite(deltaPx) ? deltaPx : 0;
    if (sub <= 0 || oldH <= 0) return;

    const base = this.normalizeFractions(this.rowFractions(), rowCount);
    const oldPx = base.map((f) => f * oldH);
    const newH = Math.max(20, oldH - sub);

    const start = Math.max(0, Math.min(rowCount - 1, Math.trunc(anchorRow)));
    const span = Math.max(1, Math.trunc(rowSpan));
    const end = Math.min(rowCount - 1, start + span - 1);
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const spanTotal = indices.reduce((sum, i) => sum + oldPx[i], 0);
    const dec = Math.min(sub, spanTotal);

    const newPx = [...oldPx];
    for (const i of indices) {
      const share = spanTotal > 0 ? (oldPx[i] / spanTotal) : (1 / indices.length);
      newPx[i] = Math.max(1, oldPx[i] - dec * share);
    }

    const next = newPx.map((px) => px / newH);
    this.rowFractions.set(this.normalizeFractions(next, next.length));
  }

  private shrinkTopLevelColSpanFractions(anchorCol: number, colSpan: number, deltaPx: number): void {
    const rowsModel = this.localRows();
    const colCount = this.getTopLevelColCount(rowsModel);
    const oldW = this.widget.size.width;
    const sub = Number.isFinite(deltaPx) ? deltaPx : 0;
    if (sub <= 0 || oldW <= 0) return;

    const base = this.normalizeFractions(this.columnFractions(), colCount);
    const oldPx = base.map((f) => f * oldW);
    const newW = Math.max(20, oldW - sub);

    const start = Math.max(0, Math.min(colCount - 1, Math.trunc(anchorCol)));
    const span = Math.max(1, Math.trunc(colSpan));
    const end = Math.min(colCount - 1, start + span - 1);
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const spanTotal = indices.reduce((sum, i) => sum + oldPx[i], 0);
    const dec = Math.min(sub, spanTotal);

    const newPx = [...oldPx];
    for (const i of indices) {
      const share = spanTotal > 0 ? (oldPx[i] / spanTotal) : (1 / indices.length);
      newPx[i] = Math.max(1, oldPx[i] - dec * share);
    }

    const next = newPx.map((px) => px / newW);
    this.columnFractions.set(this.normalizeFractions(next, next.length));
  }

  private rebuildTopLevelCoveredBy(rows: TableRow[]): void {
    const rowCount = rows.length;
    const colCount = this.getTopLevelColCount(rows);

    // Clear coveredBy everywhere first.
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = rows?.[r]?.cells?.[c];
        if (!cell) continue;
        cell.coveredBy = undefined;
      }
    }

    // Re-cover from merge anchors.
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = rows?.[r]?.cells?.[c];
        if (!cell) continue;
        if (cell.coveredBy) continue;
        if (!cell.merge) continue;

        const rowSpan = Math.max(1, cell.merge.rowSpan);
        const colSpan = Math.max(1, cell.merge.colSpan);

        for (let rr = r; rr < Math.min(rowCount, r + rowSpan); rr++) {
          for (let cc = c; cc < Math.min(colCount, c + colSpan); cc++) {
            if (rr === r && cc === c) continue;
            const covered = rows?.[rr]?.cells?.[cc];
            if (!covered) continue;
            covered.coveredBy = { row: r, col: c };
            covered.contentHtml = '';
            covered.split = undefined;
            covered.merge = undefined;
          }
        }
      }
    }
  }

  private rebuildSplitCoveredBy(splitOwner: TableCell): void {
    const split = splitOwner.split;
    if (!split) return;

    const rows = Math.max(1, split.rows);
    const cols = Math.max(1, split.cols);

    // Clear coveredBy everywhere first.
    for (const cell of split.cells) {
      if (!cell) continue;
      cell.coveredBy = undefined;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cell = split.cells[idx];
        if (!cell) continue;
        if (cell.coveredBy) continue;
        if (!cell.merge) continue;

        const rowSpan = Math.max(1, cell.merge.rowSpan);
        const colSpan = Math.max(1, cell.merge.colSpan);

        for (let rr = r; rr < Math.min(rows, r + rowSpan); rr++) {
          for (let cc = c; cc < Math.min(cols, c + colSpan); cc++) {
            if (rr === r && cc === c) continue;
            const cIdx = rr * cols + cc;
            const covered = split.cells[cIdx];
            if (!covered) continue;
            covered.coveredBy = { row: r, col: c };
            covered.contentHtml = '';
            covered.split = undefined;
            covered.merge = undefined;
          }
        }
      }
    }
  }

  private insertIntoTable(axis: 'row' | 'col', placement: 'before' | 'after', insertIndex: number): void {
    const snapshot = this.localRows();
    const oldRowCount = this.getTopLevelRowCount(snapshot);
    const oldColCount = this.getTopLevelColCount(snapshot);

    const clampedInsert =
      axis === 'row'
        ? Math.max(0, Math.min(oldRowCount, Math.trunc(insertIndex)))
        : Math.max(0, Math.min(oldColCount, Math.trunc(insertIndex)));

    // Precompute which merge anchors should expand (based on snapshot coordinates).
    const expandAnchors: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < oldRowCount; r++) {
      for (let c = 0; c < oldColCount; c++) {
        const cell = snapshot?.[r]?.cells?.[c];
        if (!cell || cell.coveredBy || !cell.merge) continue;

        if (axis === 'row') {
          const span = Math.max(1, cell.merge.rowSpan);
          if (r < clampedInsert && clampedInsert < r + span) {
            expandAnchors.push({ r, c });
          }
        } else {
          const span = Math.max(1, cell.merge.colSpan);
          if (c < clampedInsert && clampedInsert < c + span) {
            expandAnchors.push({ r, c });
          }
        }
      }
    }

    // Remap selection + active id before we mutate.
    const selectionBefore = this.selectedCells();
    const remappedSelection = new Set<string>();
    for (const id of selectionBefore) {
      const mapped = this.remapLeafIdForTableInsert(id, axis, clampedInsert);
      if (mapped) remappedSelection.add(mapped);
    }
    const remappedActive = this.activeCellId ? this.remapLeafIdForTableInsert(this.activeCellId, axis, clampedInsert) : null;

    // Update persisted fractions (top-level) and grow widget so the table doesn't squeeze.
    // This keeps existing row/col pixel sizes and gives the inserted row/col the same size as its neighbor.
    if (axis === 'row') {
      const { nextFractions, donorFraction } = this.insertFractionsKeepPxWithGrow(
        this.rowFractions(),
        oldRowCount,
        clampedInsert,
        placement
      );
      this.rowFractions.set(nextFractions);
      this.growWidgetSizeBy(0, donorFraction * this.widget.size.height);
    } else {
      const { nextFractions, donorFraction } = this.insertFractionsKeepPxWithGrow(
        this.columnFractions(),
        oldColCount,
        clampedInsert,
        placement
      );
      this.columnFractions.set(nextFractions);
      this.growWidgetSizeBy(donorFraction * this.widget.size.width, 0);
    }

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);
      const rowCount = this.getTopLevelRowCount(next);
      const colCount = this.getTopLevelColCount(next);

      if (axis === 'row') {
        const newRow: TableRow = {
          id: uuid(),
          cells: Array.from({ length: colCount }, () => ({
            id: uuid(),
            contentHtml: '',
          })),
        };
        next.splice(clampedInsert, 0, newRow);

        for (const a of expandAnchors) {
          const anchor = next?.[a.r]?.cells?.[a.c];
          if (anchor?.merge) {
            anchor.merge.rowSpan = Math.max(1, anchor.merge.rowSpan) + 1;
          }
        }
      } else {
        for (let r = 0; r < rowCount; r++) {
          const row = next?.[r];
          if (!row) continue;
          row.cells.splice(clampedInsert, 0, { id: uuid(), contentHtml: '' });
        }

        for (const a of expandAnchors) {
          const anchor = next?.[a.r]?.cells?.[a.c];
          if (anchor?.merge) {
            anchor.merge.colSpan = Math.max(1, anchor.merge.colSpan) + 1;
          }
        }
      }

      this.rebuildTopLevelCoveredBy(next);
      return next;
    });

    const afterRows = this.localRows();
    this.emitPropsChange(afterRows);
    this.rowsAtEditStart = this.cloneRows(afterRows);

    // Update selection + active id.
    this.setSelection(remappedSelection);
    this.activeCellId = remappedActive;
    this.activeCellElement = null;

    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();

    if (remappedActive) {
      window.setTimeout(() => {
        const node = this.tableContainer?.nativeElement?.querySelector(
          `.table-widget__cell-editor[data-leaf="${remappedActive}"]`
        ) as HTMLElement | null;
        node?.focus();
      }, 0);
    }
  }

  private insertIntoSplit(
    target: { kind: 'split'; ownerRow: number; ownerCol: number; ownerPath: number[] },
    axis: 'row' | 'col',
    placement: 'before' | 'after',
    insertIndex: number
  ): void {
    const snapshot = this.localRows();
    const base = snapshot?.[target.ownerRow]?.cells?.[target.ownerCol];
    if (!base) return;
    const ownerSnap = target.ownerPath.length === 0 ? base : this.getCellAtPath(base, target.ownerPath);
    if (!ownerSnap?.split) return;

    const oldRows = Math.max(1, ownerSnap.split.rows);
    const oldCols = Math.max(1, ownerSnap.split.cols);
    const axisCount = axis === 'row' ? oldRows : oldCols;
    const clampedInsert = Math.max(0, Math.min(axisCount, Math.trunc(insertIndex)));

    // Compute how much the overall table should grow to avoid squeezing when the split grid gains a row/col.
    const topLevelCell = snapshot?.[target.ownerRow]?.cells?.[target.ownerCol];
    const rowSpan = Math.max(1, topLevelCell?.merge?.rowSpan ?? 1);
    const colSpan = Math.max(1, topLevelCell?.merge?.colSpan ?? 1);

    const rowCount = this.getTopLevelRowCount(snapshot);
    const colCount = this.getTopLevelColCount(snapshot);
    const topRowFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const topColFractions = this.normalizeFractions(this.columnFractions(), colCount);
    const spanRowFraction = topRowFractions
      .slice(target.ownerRow, Math.min(rowCount, target.ownerRow + rowSpan))
      .reduce((a, b) => a + b, 0);
    const spanColFraction = topColFractions
      .slice(target.ownerCol, Math.min(colCount, target.ownerCol + colSpan))
      .reduce((a, b) => a + b, 0);
    const ownerHeightPx = spanRowFraction * this.widget.size.height;
    const ownerWidthPx = spanColFraction * this.widget.size.width;

    const splitFractions = axis === 'row' ? (ownerSnap.split.rowFractions ?? []) : (ownerSnap.split.columnFractions ?? []);
    const { nextFractions: nextSplitFractions, donorFraction } = this.insertFractionsKeepPxWithGrow(
      splitFractions,
      axisCount,
      clampedInsert,
      placement
    );
    const growPx = donorFraction * (axis === 'row' ? ownerHeightPx : ownerWidthPx);

    if (axis === 'row') {
      this.growTopLevelRowSpanFractions(target.ownerRow, rowSpan, growPx);
      this.growWidgetSizeBy(0, growPx);
    } else {
      this.growTopLevelColSpanFractions(target.ownerCol, colSpan, growPx);
      this.growWidgetSizeBy(growPx, 0);
    }

    // Precompute merge anchors to expand (based on snapshot coords within this split).
    const expandAnchors: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < oldRows; r++) {
      for (let c = 0; c < oldCols; c++) {
        const idx = r * oldCols + c;
        const cell = ownerSnap.split.cells[idx];
        if (!cell || cell.coveredBy || !cell.merge) continue;
        if (axis === 'row') {
          const span = Math.max(1, cell.merge.rowSpan);
          if (r < clampedInsert && clampedInsert < r + span) expandAnchors.push({ r, c });
        } else {
          const span = Math.max(1, cell.merge.colSpan);
          if (c < clampedInsert && clampedInsert < c + span) expandAnchors.push({ r, c });
        }
      }
    }

    // Remap selection + active id before we mutate (only affects leaves inside this split owner).
    const selectionBefore = this.selectedCells();
    const remappedSelection = new Set<string>();
    for (const id of selectionBefore) {
      const mapped = this.remapLeafIdForSplitInsert(id, target, axis, clampedInsert, oldCols);
      if (mapped) remappedSelection.add(mapped);
    }
    const remappedActive = this.activeCellId
      ? this.remapLeafIdForSplitInsert(this.activeCellId, target, axis, clampedInsert, oldCols)
      : null;

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);
      const baseCell = next?.[target.ownerRow]?.cells?.[target.ownerCol];
      if (!baseCell) return next;
      const owner = target.ownerPath.length === 0 ? baseCell : this.getCellAtPath(baseCell, target.ownerPath);
      if (!owner?.split) return next;

      const split: TableCellSplit = owner.split;
      const curRows = Math.max(1, split.rows);
      const curCols = Math.max(1, split.cols);

      // Rebuild as row arrays for easy insertion.
      const grid: TableCell[][] = [];
      for (let r = 0; r < curRows; r++) {
        grid.push(split.cells.slice(r * curCols, (r + 1) * curCols));
      }

      if (axis === 'row') {
        const newRowCells: TableCell[] = Array.from({ length: curCols }, () => ({ id: uuid(), contentHtml: '' }));
        grid.splice(clampedInsert, 0, newRowCells);
        split.rows = curRows + 1;
        split.rowFractions = nextSplitFractions;
      } else {
        for (let r = 0; r < grid.length; r++) {
          grid[r].splice(clampedInsert, 0, { id: uuid(), contentHtml: '' });
        }
        split.cols = curCols + 1;
        split.columnFractions = nextSplitFractions;
      }

      // Flatten back.
      split.cells = grid.flat();

      // Expand merge anchors (coordinates refer to original grid before insertion).
      for (const a of expandAnchors) {
        const colsNow = Math.max(1, split.cols);
        const idx = a.r * colsNow + a.c;
        const anchor = split.cells[idx];
        if (!anchor?.merge) continue;
        if (axis === 'row') {
          anchor.merge.rowSpan = Math.max(1, anchor.merge.rowSpan) + 1;
        } else {
          anchor.merge.colSpan = Math.max(1, anchor.merge.colSpan) + 1;
        }
      }

      this.rebuildSplitCoveredBy(owner);
      return next;
    });

    const afterRows = this.localRows();
    this.emitPropsChange(afterRows);
    this.rowsAtEditStart = this.cloneRows(afterRows);

    this.setSelection(remappedSelection);
    this.activeCellId = remappedActive;
    this.activeCellElement = null;

    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();

    if (remappedActive) {
      window.setTimeout(() => {
        const node = this.tableContainer?.nativeElement?.querySelector(
          `.table-widget__cell-editor[data-leaf="${remappedActive}"]`
        ) as HTMLElement | null;
        node?.focus();
      }, 0);
    }
  }

  private deleteFromTable(axis: 'row' | 'col', deleteStart: number, deleteEnd: number): void {
    const snapshot = this.localRows();
    const oldRowCount = this.getTopLevelRowCount(snapshot);
    const oldColCount = this.getTopLevelColCount(snapshot);

    const n = axis === 'row' ? oldRowCount : oldColCount;
    if (n <= 1) return;

    const start = Math.max(0, Math.min(n - 1, Math.min(deleteStart, deleteEnd)));
    const end = Math.max(0, Math.min(n - 1, Math.max(deleteStart, deleteEnd)));
    const removedCount = end - start + 1;
    if (removedCount >= n) return;

    // Fractions + widget shrink to keep remaining px sizes.
    if (axis === 'row') {
      const res = this.deleteFractionsKeepPxWithShrink(this.rowFractions(), oldRowCount, start, end);
      if (!res) return;
      const removedPx = res.removedFraction * this.widget.size.height;
      this.rowFractions.set(res.nextFractions);
      this.growWidgetSizeBy(0, -removedPx);
    } else {
      const res = this.deleteFractionsKeepPxWithShrink(this.columnFractions(), oldColCount, start, end);
      if (!res) return;
      const removedPx = res.removedFraction * this.widget.size.width;
      this.columnFractions.set(res.nextFractions);
      this.growWidgetSizeBy(-removedPx, 0);
    }

    // Remap selection + active id before we mutate.
    const selectionBefore = this.selectedCells();
    const remappedSelection = new Set<string>();
    for (const id of selectionBefore) {
      const mapped = this.remapLeafIdForTableDelete(id, axis, start, end);
      if (mapped) remappedSelection.add(mapped);
    }
    const remappedActive = this.activeCellId ? this.remapLeafIdForTableDelete(this.activeCellId, axis, start, end) : null;

    // Capture merge anchors from snapshot so we can shrink spans safely.
    type MergeMeta = { oldR: number; oldC: number; rowSpan: number; colSpan: number };
    const merges: MergeMeta[] = [];
    for (let r = 0; r < oldRowCount; r++) {
      for (let c = 0; c < oldColCount; c++) {
        const cell = snapshot?.[r]?.cells?.[c];
        if (!cell || cell.coveredBy || !cell.merge) continue;
        merges.push({
          oldR: r,
          oldC: c,
          rowSpan: Math.max(1, cell.merge.rowSpan),
          colSpan: Math.max(1, cell.merge.colSpan),
        });
      }
    }

    const deletedBefore = (idx: number): number => {
      if (idx <= start) return 0;
      if (idx > end) return removedCount;
      // idx is inside deleted range; caller should avoid.
      return idx - start;
    };

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);

      if (axis === 'row') {
        next.splice(start, removedCount);
      } else {
        for (const row of next) {
          row.cells.splice(start, removedCount);
        }
      }

      const newRowCount = this.getTopLevelRowCount(next);
      const newColCount = this.getTopLevelColCount(next);

      // Clear all top-level merges; we'll restore adjusted ones.
      for (let r = 0; r < newRowCount; r++) {
        for (let c = 0; c < newColCount; c++) {
          const cell = next?.[r]?.cells?.[c];
          if (!cell) continue;
          cell.merge = undefined;
        }
      }

      // Reapply merges with shrink/shift rules.
      for (const m of merges) {
        const oldAnchorDeleted = axis === 'row'
          ? m.oldR >= start && m.oldR <= end
          : m.oldC >= start && m.oldC <= end;
        if (oldAnchorDeleted) continue;

        const newR = axis === 'row' ? m.oldR - deletedBefore(m.oldR) : m.oldR;
        const newC = axis === 'col' ? m.oldC - deletedBefore(m.oldC) : m.oldC;
        if (newR < 0 || newC < 0) continue;
        if (newR >= newRowCount || newC >= newColCount) continue;

        const overlap = (spanStart: number, spanLen: number): number => {
          const spanEnd = spanStart + spanLen - 1;
          const oStart = Math.max(spanStart, start);
          const oEnd = Math.min(spanEnd, end);
          return oEnd >= oStart ? (oEnd - oStart + 1) : 0;
        };

        let rowSpan = m.rowSpan;
        let colSpan = m.colSpan;
        if (axis === 'row') {
          rowSpan = Math.max(1, rowSpan - overlap(m.oldR, m.rowSpan));
        } else {
          colSpan = Math.max(1, colSpan - overlap(m.oldC, m.colSpan));
        }

        if (rowSpan === 1 && colSpan === 1) {
          continue;
        }

        const anchor = next?.[newR]?.cells?.[newC];
        if (!anchor) continue;
        anchor.merge = { rowSpan, colSpan };
      }

      this.rebuildTopLevelCoveredBy(next);
      return next;
    });

    const afterRows = this.localRows();
    this.emitPropsChange(afterRows);
    this.rowsAtEditStart = this.cloneRows(afterRows);

    this.setSelection(remappedSelection);
    this.activeCellId = remappedActive;
    this.activeCellElement = null;

    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();
  }

  private deleteFromSplit(
    target: { kind: 'split'; ownerRow: number; ownerCol: number; ownerPath: number[] },
    axis: 'row' | 'col',
    deleteStart: number,
    deleteEnd: number
  ): void {
    const snapshot = this.localRows();
    const base = snapshot?.[target.ownerRow]?.cells?.[target.ownerCol];
    if (!base) return;
    const ownerSnap = target.ownerPath.length === 0 ? base : this.getCellAtPath(base, target.ownerPath);
    if (!ownerSnap?.split) return;

    const split = ownerSnap.split;
    const oldRows = Math.max(1, split.rows);
    const oldCols = Math.max(1, split.cols);
    const n = axis === 'row' ? oldRows : oldCols;
    if (n <= 1) return;

    const start = Math.max(0, Math.min(n - 1, Math.min(deleteStart, deleteEnd)));
    const end = Math.max(0, Math.min(n - 1, Math.max(deleteStart, deleteEnd)));
    const removedCount = end - start + 1;
    if (removedCount >= n) return;

    // Determine split owner cell size in px based on top-level span (handles merged owner cell).
    const topLevelCell = snapshot?.[target.ownerRow]?.cells?.[target.ownerCol];
    const rowSpan = Math.max(1, topLevelCell?.merge?.rowSpan ?? 1);
    const colSpan = Math.max(1, topLevelCell?.merge?.colSpan ?? 1);

    const rowCount = this.getTopLevelRowCount(snapshot);
    const colCount = this.getTopLevelColCount(snapshot);
    const topRowFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const topColFractions = this.normalizeFractions(this.columnFractions(), colCount);
    const spanRowFraction = topRowFractions
      .slice(target.ownerRow, Math.min(rowCount, target.ownerRow + rowSpan))
      .reduce((a, b) => a + b, 0);
    const spanColFraction = topColFractions
      .slice(target.ownerCol, Math.min(colCount, target.ownerCol + colSpan))
      .reduce((a, b) => a + b, 0);
    const ownerHeightPx = spanRowFraction * this.widget.size.height;
    const ownerWidthPx = spanColFraction * this.widget.size.width;

    // Update split fractions + compute shrink.
    const fractions = axis === 'row' ? (split.rowFractions ?? []) : (split.columnFractions ?? []);
    const res = this.deleteFractionsKeepPxWithShrink(fractions, n, start, end);
    if (!res) return;
    const shrinkPx = res.removedFraction * (axis === 'row' ? ownerHeightPx : ownerWidthPx);

    if (axis === 'row') {
      this.shrinkTopLevelRowSpanFractions(target.ownerRow, rowSpan, shrinkPx);
      this.growWidgetSizeBy(0, -shrinkPx);
    } else {
      this.shrinkTopLevelColSpanFractions(target.ownerCol, colSpan, shrinkPx);
      this.growWidgetSizeBy(-shrinkPx, 0);
    }

    const newCols = axis === 'col' ? (oldCols - removedCount) : oldCols;

    // Remap selection + active id before we mutate.
    const selectionBefore = this.selectedCells();
    const remappedSelection = new Set<string>();
    for (const id of selectionBefore) {
      const mapped = this.remapLeafIdForSplitDelete(id, target, axis, start, end, oldCols, newCols);
      if (mapped) remappedSelection.add(mapped);
    }
    const remappedActive = this.activeCellId
      ? this.remapLeafIdForSplitDelete(this.activeCellId, target, axis, start, end, oldCols, newCols)
      : null;

    // Capture split merges from snapshot so we can shrink spans safely.
    type SplitMergeMeta = { oldR: number; oldC: number; rowSpan: number; colSpan: number };
    const merges: SplitMergeMeta[] = [];
    for (let r = 0; r < oldRows; r++) {
      for (let c = 0; c < oldCols; c++) {
        const idx = r * oldCols + c;
        const cell = split.cells[idx];
        if (!cell || cell.coveredBy || !cell.merge) continue;
        merges.push({
          oldR: r,
          oldC: c,
          rowSpan: Math.max(1, cell.merge.rowSpan),
          colSpan: Math.max(1, cell.merge.colSpan),
        });
      }
    }

    const deletedBefore = (idx: number): number => (idx > end ? removedCount : 0);
    const overlap = (spanStart: number, spanLen: number): number => {
      const spanEnd = spanStart + spanLen - 1;
      const oStart = Math.max(spanStart, start);
      const oEnd = Math.min(spanEnd, end);
      return oEnd >= oStart ? (oEnd - oStart + 1) : 0;
    };

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);
      const baseCell = next?.[target.ownerRow]?.cells?.[target.ownerCol];
      if (!baseCell) return next;
      const owner = target.ownerPath.length === 0 ? baseCell : this.getCellAtPath(baseCell, target.ownerPath);
      if (!owner?.split) return next;

      const s = owner.split;
      const curRows = Math.max(1, s.rows);
      const curCols = Math.max(1, s.cols);

      // Rebuild as row arrays.
      const grid: TableCell[][] = [];
      for (let r = 0; r < curRows; r++) {
        grid.push(s.cells.slice(r * curCols, (r + 1) * curCols));
      }

      if (axis === 'row') {
        grid.splice(start, removedCount);
        s.rows = curRows - removedCount;
        s.rowFractions = res.nextFractions;
      } else {
        for (let r = 0; r < grid.length; r++) {
          grid[r].splice(start, removedCount);
        }
        s.cols = curCols - removedCount;
        s.columnFractions = res.nextFractions;
      }

      s.cells = grid.flat();

      const newRows = Math.max(1, s.rows);
      const newColsNow = Math.max(1, s.cols);

      // Clear split merges; restore adjusted ones.
      for (const cell of s.cells) {
        if (!cell) continue;
        cell.merge = undefined;
      }

      for (const m of merges) {
        const oldAnchorDeleted = axis === 'row'
          ? m.oldR >= start && m.oldR <= end
          : m.oldC >= start && m.oldC <= end;
        if (oldAnchorDeleted) continue;

        const newR = axis === 'row' ? m.oldR - deletedBefore(m.oldR) : m.oldR;
        const newC = axis === 'col' ? m.oldC - deletedBefore(m.oldC) : m.oldC;
        if (newR < 0 || newC < 0) continue;
        if (newR >= newRows || newC >= newColsNow) continue;

        let rowSpan2 = m.rowSpan;
        let colSpan2 = m.colSpan;
        if (axis === 'row') {
          rowSpan2 = Math.max(1, rowSpan2 - overlap(m.oldR, m.rowSpan));
        } else {
          colSpan2 = Math.max(1, colSpan2 - overlap(m.oldC, m.colSpan));
        }

        if (rowSpan2 === 1 && colSpan2 === 1) continue;

        const idx = newR * newColsNow + newC;
        const anchor = s.cells[idx];
        if (!anchor) continue;
        anchor.merge = { rowSpan: rowSpan2, colSpan: colSpan2 };
      }

      this.rebuildSplitCoveredBy(owner);
      return next;
    });

    const afterRows = this.localRows();
    this.emitPropsChange(afterRows);
    this.rowsAtEditStart = this.cloneRows(afterRows);

    this.setSelection(remappedSelection);
    this.activeCellId = remappedActive;
    this.activeCellElement = null;

    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();
  }

  private applySplitToSelection(request: SplitCellRequest): void {
    this.syncCellContent();

    const rowsCount = Math.max(1, Math.trunc(request.rows));
    const colsCount = Math.max(1, Math.trunc(request.cols));
    if (rowsCount <= 0 || colsCount <= 0) {
      return;
    }

    const selection = this.selectedCells();
    const targetLeafIds = new Set<string>();

    if (selection.size > 0) {
      selection.forEach(id => targetLeafIds.add(id));
    } else if (this.activeCellId) {
      targetLeafIds.add(this.activeCellId);
    }

    if (targetLeafIds.size === 0) {
      return;
    }

    const beforeRows = this.cloneRows(this.localRows());

    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);
      for (const leafId of targetLeafIds) {
        const parsed = this.parseLeafId(leafId);
        if (!parsed) continue;
        const r = parsed.row;
        const c = parsed.col;
        const path = parsed.path;

        // Limit recursion depth to keep UI and data manageable.
        // Depth is the number of indices in the path; splitting increases it by 1.
        if (path.length >= this.maxSplitDepth) {
          continue;
        }

        const baseCell = newRows[r]?.cells?.[c];
        if (!baseCell) continue;
        if (baseCell.coveredBy) continue;

        const targetCell = path.length === 0 ? baseCell : this.getCellAtPath(baseCell, path);
        if (!targetCell) continue;
        if (targetCell.split) continue;

        const idPrefix = path.length > 0
          ? `cell-${r}-${c}-${path.join('_')}`
          : `cell-${r}-${c}`;

        const childCells: TableCell[] = [];
        for (let i = 0; i < rowsCount * colsCount; i++) {
          childCells.push({
            id: `${idPrefix}-${i}-${uuid()}`,
            contentHtml: '',
            style: targetCell.style ? { ...targetCell.style } : undefined,
          });
        }

        // Move existing content into the top-left child
        childCells[0].contentHtml = targetCell.contentHtml || '';

        targetCell.split = {
          rows: rowsCount,
          cols: colsCount,
          cells: childCells,
          columnFractions: Array.from({ length: colsCount }, () => 1 / colsCount),
          rowFractions: Array.from({ length: rowsCount }, () => 1 / rowsCount),
        };
        targetCell.contentHtml = '';
      }
      return newRows;
    });

    // Persist immediately (split is a discrete action; no blur needed)
    const afterRows = this.localRows();

    if (JSON.stringify(afterRows) !== JSON.stringify(beforeRows)) {
      this.emitPropsChange(afterRows);
      // Reset baseline to avoid duplicate emits on blur
      this.rowsAtEditStart = this.cloneRows(afterRows);
    }

    // Clear active element reference if it was replaced by split rendering
    this.activeCellElement = null;
    this.activeCellId = null;
    this.toolbarService.setActiveCell(null, this.widget.id);

    this.cdr.markForCheck();
  }

  private applyMergeSelection(): void {
    this.syncCellContent();

    const selectionIds = Array.from(this.selectedCells());
    if (selectionIds.length < 2) return;

    const parsedAll = selectionIds
      .map(id => ({ id, parsed: this.parseLeafId(id) }))
      .filter((x): x is { id: string; parsed: { row: number; col: number; path: number[] } } => !!x.parsed);

    if (parsedAll.length < 2) return;

    // If selection spans multiple top-level cells, do a table-level merge (even if the user selected split sub-cells).
    const topLevelKeys = new Set(parsedAll.map(x => `${x.parsed.row}-${x.parsed.col}`));
    if (topLevelKeys.size >= 2) {
      // Targeted fix:
      // If the user is selecting split sub-cells across multiple split parents, we should NOT collapse the entire
      // cells into one big merged td. Instead, merge the parents while preserving (and composing) their split grids,
      // then merge only the selected sub-cells inside that combined grid.
      const hasAnySubCells = parsedAll.some(x => x.parsed.path.length > 0);
      if (hasAnySubCells) {
        const ok = this.tryMergeAcrossSplitParents(parsedAll.map(x => x.parsed));
        if (ok) {
          return;
        }
        // Fall back to the existing behavior if we can't safely compose split grids (keeps other flows unchanged).
      }

      this.mergeTopLevelCells(Array.from(topLevelKeys).map(k => {
        const [r, c] = k.split('-').map(Number);
        return { row: r, col: c };
      }));
      return;
    }

    // Otherwise, merge within a split grid (merge sub-cells inside the same parent).
    const only = parsedAll[0].parsed;
    if (only.path.length === 0) {
      // Single top-level cell selected (shouldn't happen with size>=2), nothing to merge.
      return;
    }

    this.mergeWithinSplitGrid(parsedAll.map(x => x.parsed));
  }

  /**
   * Merge selection consisting of immediate split sub-cells (depth=1) across multiple adjacent top-level cells
   * (including cases where one or more parents are already merged anchor cells that were split)
   * by composing a larger split grid inside a top-level merged region, and then merging only the selected sub-cells.
   *
   * Returns true if handled; false means caller should fall back to normal top-level merge behavior.
   */
  private tryMergeAcrossSplitParents(parsed: Array<{ row: number; col: number; path: number[] }>): boolean {
    // We only support immediate (depth=1) sub-cells here. Deeper nested splits can still use existing behavior.
    if (!parsed.every(p => p.path.length === 1)) return false;

    const topKeys = new Set(parsed.map(p => `${p.row}-${p.col}`));
    if (topKeys.size < 2) return false;

    const snapshot = this.localRows();

    // Expand top-level coverage (handles cases where a selected parent is already merged).
    const seedCoords = Array.from(topKeys).map(k => {
      const [row, col] = k.split('-').map(Number);
      return { row, col };
    });
    const expandedTop = this.expandTopLevelSelection(seedCoords, snapshot);
    if (expandedTop.size < 2) return false;

    const outerRect = this.getTopLevelBoundingRect(expandedTop);
    if (!outerRect) return false;

    const { minRow, maxRow, minCol, maxCol } = outerRect;
    const topRowSpan = maxRow - minRow + 1;
    const topColSpan = maxCol - minCol + 1;

    // Require the coverage to be a filled rectangle (no gaps).
    if (expandedTop.size !== topRowSpan * topColSpan) return false;

    // Ensure no merges extend outside this rectangle and no covered cells point to anchors outside.
    if (!this.isValidTopLevelMergeRect(outerRect, expandedTop, snapshot)) return false;

    // Identify all top-level anchors within the outer rectangle.
    const anchorKeys = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = snapshot?.[r]?.cells?.[c];
        if (!cell) return false;
        const a = cell.coveredBy ? cell.coveredBy : { row: r, col: c };
        anchorKeys.add(`${a.row}-${a.col}`);
      }
    }

    type AnchorMeta = {
      row: number;
      col: number;
      rowSpan: number;
      colSpan: number;
      splitRows: number;
      splitCols: number;
      unitRows: number;
      unitCols: number;
    };

    const anchors: AnchorMeta[] = [];
    for (const k of anchorKeys) {
      const [ar, ac] = k.split('-').map(Number);
      const cell = snapshot?.[ar]?.cells?.[ac];
      if (!cell) return false;
      if (!cell.split) return false;

      const rowSpan = Math.max(1, cell.merge?.rowSpan ?? 1);
      const colSpan = Math.max(1, cell.merge?.colSpan ?? 1);
      const splitRows = Math.max(1, cell.split.rows);
      const splitCols = Math.max(1, cell.split.cols);

      if (splitRows % rowSpan !== 0) return false;
      if (splitCols % colSpan !== 0) return false;

      const unitRows = splitRows / rowSpan;
      const unitCols = splitCols / colSpan;

      anchors.push({
        row: ar,
        col: ac,
        rowSpan,
        colSpan,
        splitRows,
        splitCols,
        unitRows,
        unitCols,
      });
    }

    // Choose global unit resolution:
    // - must be a multiple of each anchor's unit resolution
    // - keep it small (avoid LCM explosions)
    const globalUnitRows = Math.max(...anchors.map(a => a.unitRows));
    const globalUnitCols = Math.max(...anchors.map(a => a.unitCols));
    if (!anchors.every(a => globalUnitRows % a.unitRows === 0)) return false;
    if (!anchors.every(a => globalUnitCols % a.unitCols === 0)) return false;

    const combinedRows = globalUnitRows * topRowSpan;
    const combinedCols = globalUnitCols * topColSpan;

    // Compose a combined split grid (reconstructing merges/coverage so coarse grids can span multiple global units).
    const combinedCells: Array<TableCell | null> = new Array(combinedRows * combinedCols).fill(null);
    const placeCell = (row: number, col: number, cell: TableCell) => {
      const idx = row * combinedCols + col;
      if (combinedCells[idx]) {
        throw new Error('overlap');
      }
      combinedCells[idx] = cell;
    };

    const fillCovered = (anchorRow: number, anchorCol: number, rowSpan: number, colSpan: number) => {
      for (let r = anchorRow; r < anchorRow + rowSpan; r++) {
        for (let c = anchorCol; c < anchorCol + colSpan; c++) {
          if (r === anchorRow && c === anchorCol) continue;
          const idx = r * combinedCols + c;
          if (combinedCells[idx]) {
            throw new Error('overlap');
          }
          combinedCells[idx] = {
            id: `covered-${anchorRow}-${anchorCol}-${r}-${c}-${uuid()}`,
            contentHtml: '',
            coveredBy: { row: anchorRow, col: anchorCol },
          };
        }
      }
    };

    try {
      for (const a of anchors) {
        const cell = snapshot?.[a.row]?.cells?.[a.col];
        const split = cell?.split;
        if (!cell || !split) return false;

        const scaleRow = globalUnitRows / a.unitRows;
        const scaleCol = globalUnitCols / a.unitCols;

        const globalRowOffset = (a.row - minRow) * globalUnitRows;
        const globalColOffset = (a.col - minCol) * globalUnitCols;

        for (let lr = 0; lr < a.splitRows; lr++) {
          for (let lc = 0; lc < a.splitCols; lc++) {
            const localIdx = lr * a.splitCols + lc;
            const localCell = split.cells[localIdx];
            if (!localCell) return false;

            // Covered cells are represented by their anchor merge; skip to avoid double-placement.
            if (localCell.coveredBy) continue;

            const localRowSpan = Math.max(1, localCell.merge?.rowSpan ?? 1);
            const localColSpan = Math.max(1, localCell.merge?.colSpan ?? 1);

            const startRow = globalRowOffset + lr * scaleRow;
            const startCol = globalColOffset + lc * scaleCol;
            const spanRows = localRowSpan * scaleRow;
            const spanCols = localColSpan * scaleCol;

            const cloned = this.cloneCellDeep(localCell);
            cloned.coveredBy = undefined;
            if (spanRows > 1 || spanCols > 1) {
              cloned.merge = { rowSpan: spanRows, colSpan: spanCols };
            } else {
              cloned.merge = undefined;
            }

            placeCell(startRow, startCol, cloned);
            fillCovered(startRow, startCol, spanRows, spanCols);
          }
        }
      }
    } catch {
      return false;
    }

    // Ensure full grid populated.
    for (let i = 0; i < combinedCells.length; i++) {
      if (!combinedCells[i]) return false;
    }
    const combinedTemplate: TableCell[] = combinedCells as TableCell[];

    // Map selected leaf indices into the combined grid.
    const anchorMetaByKey = new Map<string, AnchorMeta>();
    for (const a of anchors) {
      anchorMetaByKey.set(`${a.row}-${a.col}`, a);
    }

    const selectedCombined = new Set<number>();
    for (const p of parsed) {
      const idx = p.path[0];
      if (!Number.isFinite(idx)) return false;

      const base = snapshot?.[p.row]?.cells?.[p.col];
      if (!base) return false;
      const topAnchor = base.coveredBy ? base.coveredBy : { row: p.row, col: p.col };
      const meta = anchorMetaByKey.get(`${topAnchor.row}-${topAnchor.col}`);
      if (!meta) return false;

      const anchorCell = snapshot?.[topAnchor.row]?.cells?.[topAnchor.col];
      const split = anchorCell?.split;
      if (!anchorCell || !split) return false;

      if (idx < 0 || idx >= meta.splitRows * meta.splitCols) return false;

      // If the selected index is inside an existing merged sub-cell, map to that sub-cell's anchor.
      const lr0 = Math.floor(idx / meta.splitCols);
      const lc0 = idx % meta.splitCols;
      const localCell = split.cells[idx];
      const localAnchor = localCell?.coveredBy ? localCell.coveredBy : { row: lr0, col: lc0 };

      const scaleRow = globalUnitRows / meta.unitRows;
      const scaleCol = globalUnitCols / meta.unitCols;
      const globalRowOffset = (topAnchor.row - minRow) * globalUnitRows;
      const globalColOffset = (topAnchor.col - minCol) * globalUnitCols;
      const globalRow = globalRowOffset + localAnchor.row * scaleRow;
      const globalCol = globalColOffset + localAnchor.col * scaleCol;
      selectedCombined.add(globalRow * combinedCols + globalCol);
    }

    if (selectedCombined.size < 2) return false;

    // Validate that the requested merge is a valid rectangle in the combined grid (like normal split merges).
    const tempOwner: TableCell = {
      id: 'tmp',
      contentHtml: '',
      split: { rows: combinedRows, cols: combinedCols, cells: combinedTemplate },
    };

    const expanded = this.expandSplitSelection(tempOwner, Array.from(selectedCombined));
    if (expanded.size < 2) return false;

    const innerRect = this.getSplitBoundingRect(combinedCols, expanded);
    if (!innerRect) return false;

    if (!this.isValidSplitMergeRect(tempOwner, innerRect, expanded)) return false;

    const mergedHtml = this.buildMergedHtmlForSplitRect(tempOwner, innerRect);
    const innerRowSpan = innerRect.maxRow - innerRect.minRow + 1;
    const innerColSpan = innerRect.maxCol - innerRect.minCol + 1;
    const innerAnchorIdx = innerRect.minRow * combinedCols + innerRect.minCol;

    // Apply: top-level merge + composed split grid + inner merge, in one state update.
    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);

      const anchor = next?.[minRow]?.cells?.[minCol];
      if (!anchor) return next;

      // Set up the top-level merged region.
      anchor.coveredBy = undefined;
      anchor.merge = { rowSpan: topRowSpan, colSpan: topColSpan };
      anchor.contentHtml = '';
      // Fresh copy of template so we can mutate it safely.
      const initialCells: TableCell[] = new Array(combinedTemplate.length);
      for (let i = 0; i < combinedTemplate.length; i++) {
        initialCells[i] = this.cloneCellDeep(combinedTemplate[i]);
      }
      anchor.split = {
        rows: combinedRows,
        cols: combinedCols,
        cells: initialCells,
      };

      // Cover all other top-level cells in the rect.
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (r === minRow && c === minCol) continue;
          const covered = next?.[r]?.cells?.[c];
          if (!covered) continue;
          covered.coveredBy = { row: minRow, col: minCol };
          covered.contentHtml = '';
          covered.split = undefined;
          covered.merge = undefined;
        }
      }

      // Now apply the inner split merge within the composed grid.
      const owner = anchor;
      if (!owner.split) return next;

      this.clearSplitMergesWithinRect(owner, innerRect);

      const anchorCell = owner.split.cells[innerAnchorIdx];
      if (!anchorCell) return next;

      anchorCell.coveredBy = undefined;
      anchorCell.merge = { rowSpan: innerRowSpan, colSpan: innerColSpan };
      anchorCell.split = undefined;
      anchorCell.contentHtml = mergedHtml;

      for (let r = innerRect.minRow; r <= innerRect.maxRow; r++) {
        for (let c = innerRect.minCol; c <= innerRect.maxCol; c++) {
          const idx = r * combinedCols + c;
          if (idx === innerAnchorIdx) continue;
          const cell = owner.split.cells[idx];
          if (!cell) continue;
          cell.coveredBy = { row: innerRect.minRow, col: innerRect.minCol };
          cell.contentHtml = '';
          cell.split = undefined;
          cell.merge = undefined;
        }
      }

      // If the inner merge covers the entire composed grid, collapse back to a normal (unsplit) merged cell.
      if (innerRowSpan === owner.split.rows && innerColSpan === owner.split.cols) {
        owner.split = undefined;
        owner.contentHtml = mergedHtml;
      }

      return next;
    });

    const rowsAfter = this.localRows();
    this.emitPropsChange(rowsAfter);
    this.rowsAtEditStart = this.cloneRows(rowsAfter);

    // Update selection to the merged sub-cell (or top-level cell if the composed grid collapsed).
    if (innerRowSpan === combinedRows && innerColSpan === combinedCols) {
      this.setSelection(new Set([`${minRow}-${minCol}`]));
    } else {
      this.setSelection(new Set([this.composeLeafId(minRow, minCol, String(innerAnchorIdx))]));
    }
    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();
    return true;
  }

  private buildMergedHtmlForSplitRect(
    owner: TableCell,
    rect: { minRow: number; maxRow: number; minCol: number; maxCol: number }
  ): string {
    if (!owner.split) return '';
    const cols = owner.split.cols;
    const { minRow, maxRow, minCol, maxCol } = rect;

    const visited = new Set<number>();
    const parts: string[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * cols + c;
        const cell = owner.split.cells[idx];
        if (!cell) continue;

        const anchorCoord = cell.coveredBy ? cell.coveredBy : { row: r, col: c };
        const anchorIndex = anchorCoord.row * cols + anchorCoord.col;
        if (visited.has(anchorIndex)) continue;
        visited.add(anchorIndex);

        const anchorCell = owner.split.cells[anchorIndex];
        if (!anchorCell) continue;
        const html = this.serializeCellContent(anchorCell).trim();
        if (html) parts.push(`<div>${html}</div>`);
      }
    }

    return parts.join('');
  }

  private cloneCellDeep(cell: TableCell): TableCell {
    return {
      ...cell,
      style: cell.style ? { ...cell.style } : undefined,
      merge: cell.merge ? { ...cell.merge } : undefined,
      coveredBy: cell.coveredBy ? { ...cell.coveredBy } : undefined,
      split: cell.split
        ? {
            rows: cell.split.rows,
            cols: cell.split.cols,
            cells: cell.split.cells.map(c => this.cloneCellDeep(c)),
            columnFractions: cell.split.columnFractions ? [...cell.split.columnFractions] : undefined,
            rowFractions: cell.split.rowFractions ? [...cell.split.rowFractions] : undefined,
          }
        : undefined,
    };
  }

  // Unmerge intentionally removed (merge + split only).

  /**
   * Legacy migration: convert overlay-style `mergedRegions` into inline cell merges.
   * Best-effort: supports top-level rectangular merges. Any legacy region split is moved onto the anchor cell as `split`.
   */
  private migrateLegacyMergedRegions(rows: TableRow[], regions: TableMergedRegion[]): TableRow[] {
    if (!regions || regions.length === 0) return rows;

    const next = this.cloneRows(rows);

    const parseTopLevel = (leafId: string): { row: number; col: number } | null => {
      const parsed = this.parseLeafId(leafId);
      if (!parsed) return null;
      return { row: parsed.row, col: parsed.col };
    };

    for (const region of regions) {
      const anchorCoord = parseTopLevel(region.anchorLeafId);
      if (!anchorCoord) continue;

      const coords = region.leafIds
        .map(parseTopLevel)
        .filter((x): x is { row: number; col: number } => !!x);

      if (coords.length < 2) continue;

      const minRow = Math.min(...coords.map(x => x.row));
      const maxRow = Math.max(...coords.map(x => x.row));
      const minCol = Math.min(...coords.map(x => x.col));
      const maxCol = Math.max(...coords.map(x => x.col));

      const rowSpan = maxRow - minRow + 1;
      const colSpan = maxCol - minCol + 1;

      const anchor = next?.[anchorCoord.row]?.cells?.[anchorCoord.col];
      if (!anchor) continue;

      anchor.merge = { rowSpan, colSpan };
      anchor.contentHtml = region.contentHtml ?? '';
      if (region.style) {
        anchor.style = { ...region.style };
      }
      if (region.split) {
        // Move legacy split grid onto the anchor cell (this is the key to fixing split-inside-merge)
        anchor.split = {
          rows: region.split.rows,
          cols: region.split.cols,
          cells: region.split.cells,
        };
        anchor.contentHtml = '';
      }

      for (const c of coords) {
        if (c.row === anchorCoord.row && c.col === anchorCoord.col) continue;
        const covered = next?.[c.row]?.cells?.[c.col];
        if (!covered) continue;
        covered.coveredBy = { row: anchorCoord.row, col: anchorCoord.col };
        covered.contentHtml = '';
        covered.split = undefined;
        covered.merge = undefined;
      }
    }

    return next;
  }

  private mergeTopLevelCells(coords: Array<{ row: number; col: number }>): void {
    if (coords.length < 2) return;

    const snapshot = this.localRows();
    const expanded = this.expandTopLevelSelection(coords, snapshot);
    if (expanded.size < 2) return;

    const rect = this.getTopLevelBoundingRect(expanded);
    if (!rect) return;

    const { minRow, maxRow, minCol, maxCol } = rect;
    if (!this.isValidTopLevelMergeRect(rect, expanded, snapshot)) return;

    const anchorRow = minRow;
    const anchorCol = minCol;
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;

    // Build merged content from the original snapshot.
    const visitedAnchors = new Set<string>();
    const parts: Array<{ html: string; style?: TableCellStyle }> = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = snapshot?.[r]?.cells?.[c];
        if (!cell) continue;
        const anchor = cell.coveredBy ? cell.coveredBy : { row: r, col: c };
        const key = `${anchor.row}-${anchor.col}`;
        if (visitedAnchors.has(key)) continue;
        visitedAnchors.add(key);

        const anchorCell = snapshot?.[anchor.row]?.cells?.[anchor.col];
        if (!anchorCell) continue;
        const html = this.serializeCellContent(anchorCell).trim();
        if (html) {
          parts.push({ html, style: anchorCell.style });
        }
      }
    }

    const mergedHtml = parts.length > 0 ? parts.map(p => `<div>${p.html}</div>`).join('') : '';
    const mergedStyle = parts.length > 0 ? (parts[0].style ? { ...parts[0].style } : undefined) : undefined;

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);

      // Clear any merges fully inside the rectangle (we're re-merging everything into one).
      this.clearMergesWithinRect(next, rect);

      const anchor = next?.[anchorRow]?.cells?.[anchorCol];
      if (!anchor) return next;

      anchor.coveredBy = undefined;
      anchor.merge = { rowSpan, colSpan };
      anchor.split = undefined; // simplify: merged result becomes a normal single cell
      anchor.contentHtml = mergedHtml;
      if (mergedStyle) {
        anchor.style = mergedStyle;
      }

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (r === anchorRow && c === anchorCol) continue;
          const covered = next?.[r]?.cells?.[c];
          if (!covered) continue;
          covered.coveredBy = { row: anchorRow, col: anchorCol };
          covered.contentHtml = '';
          covered.split = undefined;
          covered.merge = undefined;
        }
      }

      return next;
    });

    const rowsAfter = this.localRows();
    this.emitPropsChange(rowsAfter);
    this.rowsAtEditStart = this.cloneRows(rowsAfter);
    this.setSelection(new Set([`${anchorRow}-${anchorCol}`]));
    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();
  }

  private mergeWithinSplitGrid(parsed: Array<{ row: number; col: number; path: number[] }>): void {
    if (parsed.length < 2) return;

    // All must be in the same top-level cell.
    const baseRow = parsed[0].row;
    const baseCol = parsed[0].col;
    if (!parsed.every(p => p.row === baseRow && p.col === baseCol && p.path.length > 0)) {
      return;
    }

    // Require same depth and same prefix (siblings in the same split grid)
    const depth = parsed[0].path.length;
    if (!parsed.every(p => p.path.length === depth)) return;

    const prefix = parsed[0].path.slice(0, -1);
    if (!parsed.every(p => this.arraysEqual(p.path.slice(0, -1), prefix))) return;

    const indices = parsed.map(p => p.path[p.path.length - 1]);

    const snapshot = this.localRows();
    const baseCell = snapshot?.[baseRow]?.cells?.[baseCol];
    if (!baseCell || baseCell.coveredBy) return;

    const owner = prefix.length === 0 ? baseCell : this.getCellAtPath(baseCell, prefix);
    if (!owner || !owner.split) return;

    const expanded = this.expandSplitSelection(owner, indices);
    if (expanded.size < 2) return;

    const rect = this.getSplitBoundingRect(owner.split.cols, expanded);
    if (!rect) return;

    if (!this.isValidSplitMergeRect(owner, rect, expanded)) return;

    const { minRow, maxRow, minCol, maxCol } = rect;
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;
    const anchorIdx = minRow * owner.split.cols + minCol;

    // Build merged content from snapshot owner
    const visited = new Set<number>();
    const parts: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * owner.split.cols + c;
        const cell = owner.split.cells[idx];
        if (!cell) continue;
        const anchorCoord = cell.coveredBy ? cell.coveredBy : { row: r, col: c };
        const anchorIndex = anchorCoord.row * owner.split.cols + anchorCoord.col;
        if (visited.has(anchorIndex)) continue;
        visited.add(anchorIndex);
        const anchorCell = owner.split.cells[anchorIndex];
        const html = this.serializeCellContent(anchorCell).trim();
        if (html) parts.push(`<div>${html}</div>`);
      }
    }
    const mergedHtml = parts.join('');

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);
      const nextBase = next?.[baseRow]?.cells?.[baseCol];
      if (!nextBase || nextBase.coveredBy) return next;

      const nextOwner = prefix.length === 0 ? nextBase : this.getCellAtPath(nextBase, prefix);
      if (!nextOwner || !nextOwner.split) return next;

      // Clear merges inside rect (within this split grid)
      this.clearSplitMergesWithinRect(nextOwner, rect);

      const anchorCell = nextOwner.split.cells[anchorIdx];
      if (!anchorCell) return next;

      anchorCell.coveredBy = undefined;
      anchorCell.merge = { rowSpan, colSpan };
      anchorCell.split = undefined;
      anchorCell.contentHtml = mergedHtml;

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const idx = r * nextOwner.split.cols + c;
          if (idx === anchorIdx) continue;
          const cell = nextOwner.split.cells[idx];
          if (!cell) continue;
          cell.coveredBy = { row: minRow, col: minCol };
          cell.contentHtml = '';
          cell.split = undefined;
          cell.merge = undefined;
        }
      }

      // If the merge covers the entire split grid, collapse (unsplit) back to a normal cell.
      if (rowSpan === nextOwner.split.rows && colSpan === nextOwner.split.cols && prefix.length === 0) {
        const parent = nextBase;
        parent.split = undefined;
        parent.contentHtml = mergedHtml;
      }

      return next;
    });

    const rowsAfter = this.localRows();
    this.emitPropsChange(rowsAfter);
    this.rowsAtEditStart = this.cloneRows(rowsAfter);

    if (rowSpan === owner.split.rows && colSpan === owner.split.cols && prefix.length === 0) {
      this.setSelection(new Set([`${baseRow}-${baseCol}`]));
    } else {
      const mergedPath = [...prefix, anchorIdx].join('-');
      this.setSelection(new Set([this.composeLeafId(baseRow, baseCol, mergedPath)]));
    }
    this.cdr.markForCheck();
  }

  // Unmerge intentionally removed (merge + split only).

  private expandTopLevelSelection(coords: Array<{ row: number; col: number }>, rows: TableRow[]): Set<string> {
    const expanded = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [];

    const add = (r: number, c: number) => {
      const key = `${r}-${c}`;
      if (expanded.has(key)) return;
      expanded.add(key);
      queue.push({ row: r, col: c });
    };

    // Seed with the initially selected cells
    for (const c of coords) {
      add(c.row, c.col);
    }

    while (queue.length > 0) {
      const cur = queue.pop()!;
      const cell = rows?.[cur.row]?.cells?.[cur.col];
      if (!cell) continue;

      if (cell.coveredBy) {
        add(cell.coveredBy.row, cell.coveredBy.col);
        continue;
      }

      if (cell.merge) {
        for (let r = cur.row; r < cur.row + cell.merge.rowSpan; r++) {
          for (let c = cur.col; c < cur.col + cell.merge.colSpan; c++) {
            add(r, c);
          }
        }
      }
    }

    return expanded;
  }

  private getTopLevelBoundingRect(expanded: Set<string>): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
    if (expanded.size === 0) return null;
    const coords = Array.from(expanded).map(k => {
      const [r, c] = k.split('-').map(Number);
      return { r, c };
    });
    const minRow = Math.min(...coords.map(x => x.r));
    const maxRow = Math.max(...coords.map(x => x.r));
    const minCol = Math.min(...coords.map(x => x.c));
    const maxCol = Math.max(...coords.map(x => x.c));
    return { minRow, maxRow, minCol, maxCol };
  }

  private isValidTopLevelMergeRect(
    rect: { minRow: number; maxRow: number; minCol: number; maxCol: number },
    expanded: Set<string>,
    rows: TableRow[]
  ): boolean {
    const { minRow, maxRow, minCol, maxCol } = rect;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = `${r}-${c}`;
        if (!expanded.has(key)) {
          return false;
        }

        const cell = rows?.[r]?.cells?.[c];
        if (!cell) return false;

        // If this coord is covered by a merge whose anchor is outside the rect, invalid.
        if (cell.coveredBy) {
          const a = cell.coveredBy;
          if (a.row < minRow || a.row > maxRow || a.col < minCol || a.col > maxCol) {
            return false;
          }
        }

        // If this coord is a merge anchor that extends outside, invalid.
        if (!cell.coveredBy && cell.merge) {
          const endRow = r + cell.merge.rowSpan - 1;
          const endCol = c + cell.merge.colSpan - 1;
          if (endRow > maxRow || endCol > maxCol) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private clearMergesWithinRect(
    rows: TableRow[],
    rect: { minRow: number; maxRow: number; minCol: number; maxCol: number }
  ): void {
    const { minRow, maxRow, minCol, maxCol } = rect;

    // Clear anchor merges inside rect
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = rows?.[r]?.cells?.[c];
        if (!cell) continue;
        if (cell.coveredBy) continue;
        if (cell.merge) {
          cell.merge = undefined;
        }
      }
    }

    // Clear coveredBy pointers that point to anchors inside rect
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = rows?.[r]?.cells?.[c];
        if (!cell?.coveredBy) continue;
        const a = cell.coveredBy;
        if (a.row >= minRow && a.row <= maxRow && a.col >= minCol && a.col <= maxCol) {
          cell.coveredBy = undefined;
        }
      }
    }
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private expandSplitSelection(owner: TableCell, indices: number[]): Set<number> {
    if (!owner.split) return new Set<number>();
    const cols = owner.split.cols;
    const expanded = new Set<number>();
    const queue: number[] = [];

    const add = (idx: number) => {
      if (expanded.has(idx)) return;
      expanded.add(idx);
      queue.push(idx);
    };

    // Seed with the initially selected sub-cells
    for (const idx of indices) {
      add(idx);
    }

    while (queue.length > 0) {
      const idx = queue.pop()!;
      const cell = owner.split.cells[idx];
      if (!cell) continue;
      const row = Math.floor(idx / cols);
      const col = idx % cols;

      if (cell.coveredBy) {
        add(cell.coveredBy.row * cols + cell.coveredBy.col);
        continue;
      }

      if (cell.merge) {
        for (let r = row; r < row + cell.merge.rowSpan; r++) {
          for (let c = col; c < col + cell.merge.colSpan; c++) {
            add(r * cols + c);
          }
        }
      }
    }

    return expanded;
  }

  private getSplitBoundingRect(cols: number, expanded: Set<number>): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
    if (expanded.size === 0) return null;
    const coords = Array.from(expanded).map(idx => ({ r: Math.floor(idx / cols), c: idx % cols }));
    const minRow = Math.min(...coords.map(x => x.r));
    const maxRow = Math.max(...coords.map(x => x.r));
    const minCol = Math.min(...coords.map(x => x.c));
    const maxCol = Math.max(...coords.map(x => x.c));
    return { minRow, maxRow, minCol, maxCol };
  }

  private isValidSplitMergeRect(
    owner: TableCell,
    rect: { minRow: number; maxRow: number; minCol: number; maxCol: number },
    expanded: Set<number>
  ): boolean {
    if (!owner.split) return false;
    const cols = owner.split.cols;
    const { minRow, maxRow, minCol, maxCol } = rect;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * cols + c;
        if (!expanded.has(idx)) return false;
        const cell = owner.split.cells[idx];
        if (!cell) return false;

        if (cell.coveredBy) {
          const a = cell.coveredBy;
          if (a.row < minRow || a.row > maxRow || a.col < minCol || a.col > maxCol) {
            return false;
          }
        }

        if (!cell.coveredBy && cell.merge) {
          const endRow = r + cell.merge.rowSpan - 1;
          const endCol = c + cell.merge.colSpan - 1;
          if (endRow > maxRow || endCol > maxCol) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private clearSplitMergesWithinRect(
    owner: TableCell,
    rect: { minRow: number; maxRow: number; minCol: number; maxCol: number }
  ): void {
    if (!owner.split) return;
    const cols = owner.split.cols;
    const { minRow, maxRow, minCol, maxCol } = rect;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * cols + c;
        const cell = owner.split.cells[idx];
        if (!cell) continue;
        if (!cell.coveredBy && cell.merge) {
          cell.merge = undefined;
        }
      }
    }

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * cols + c;
        const cell = owner.split.cells[idx];
        if (!cell?.coveredBy) continue;
        const a = cell.coveredBy;
        if (a.row >= minRow && a.row <= maxRow && a.col >= minCol && a.col <= maxCol) {
          cell.coveredBy = undefined;
        }
      }
    }
  }

  private serializeCellContent(cell: { contentHtml: string; split?: { cells: TableCell[] } }): string {
    if (!cell.split) {
      return cell.contentHtml ?? '';
    }
    const parts = cell.split.cells
      .map(c => this.serializeCellContent(c))
      .map(s => (s ?? '').trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.map(h => `<div>${h}</div>`).join('') : '';
  }

  // ============================================
  // Column/Row resize (persisted + zoom-safe)
  // ============================================

  private savedCaretDuringResize:
    | {
        leafId: string;
        anchorPath: number[];
        anchorOffset: number;
        focusPath: number[];
        focusOffset: number;
        isCollapsed: boolean;
      }
    | null = null;

  private postCommitTopColResizeRaf: number | null = null;
  private autoFitAfterColResizeRaf: number | null = null;
  private autoFitAfterColResizeIteration = 0;
  private autoFitAfterColResizeDraftHeightPx: number | null = null;
  private autoFitAfterColResizeDidResizeWidget = false;

  private cancelAutoFitAfterColResize(): void {
    if (this.autoFitAfterColResizeRaf !== null) {
      cancelAnimationFrame(this.autoFitAfterColResizeRaf);
      this.autoFitAfterColResizeRaf = null;
    }
    this.autoFitAfterColResizeIteration = 0;
    this.autoFitAfterColResizeDraftHeightPx = null;
    this.autoFitAfterColResizeDidResizeWidget = false;
    this.suppressWidgetSyncDuringAutoFit = false;
  }

  private schedulePostCommitTopColResizeWork(): void {
    if (this.postCommitTopColResizeRaf !== null) {
      cancelAnimationFrame(this.postCommitTopColResizeRaf);
      this.postCommitTopColResizeRaf = null;
    }

    // 'preserved' mode (URL tables): skip auto-fit entirely, just persist column fractions.
    // The widget size is locked; content should reflow/clip within the fixed frame.
    if (this.sizingState === 'preserved') {
      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    this.postCommitTopColResizeRaf = window.requestAnimationFrame(() => {
      this.postCommitTopColResizeRaf = null;

      // 'fitted' mode (after widget resize): use single-pass auto-fit for smoother behavior,
      // then reset to 'auto' mode.
      // Use double-RAF to ensure DOM has fully updated with new column widths before measuring.
      if (this.sizingState === 'fitted') {
        window.requestAnimationFrame(() => {
          this.runSinglePassAutoFit();
          this.sizingState = 'auto';
        });
        return;
      }

      // 'auto' mode (normal): run iterative auto-fit so wrapped text becomes visible
      // immediately (no "type one key" needed).
      this.startAutoFitAfterTopColResize();
    });
  }

  private startAutoFitAfterTopColResize(): void {
    this.cancelAutoFitAfterColResize();
    this.autoFitAfterColResizeIteration = 0;
    this.autoFitAfterColResizeDraftHeightPx = this.widget?.size?.height ?? null;
    this.autoFitAfterColResizeDidResizeWidget = false;
    // Prevent draft-size driven `@Input widget` updates from overwriting local fractions mid auto-fit.
    this.suppressWidgetSyncDuringAutoFit = true;
    this.runAutoFitAfterTopColResizeStep();
  }

  /**
   * After a column resize (especially when widening text-heavy columns), wrapped text can unwrap
   * and the table may have excess vertical slack. This auto-shrinks the widget height (like backspace/delete),
   * while respecting content-min-height and manual row-resize minimums.
   *
   * Returns true if it changed the widget size (draft-only).
   */
  private tryAutoShrinkWidgetToContentMin(options?: { commit?: boolean }): boolean {
    if (!this.widget?.id) return false;
    if (this.sizingState === 'preserved') return false; // preserved mode intentionally locks the frame
    if (this.uiState.isResizing(this.widget.id)) return false; // don't fight the OUTER widget resizer
    if (this.isResizingGrid || this.isResizingSplitGrid) return false;

    const rect = this.getTableRect();
    if (!rect) return false;

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 0) return false;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const currentTableHeightPx = Math.max(1, rect.height / zoomScale);
    if (!Number.isFinite(currentTableHeightPx) || currentTableHeightPx <= 20) return false;

    const baseFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const currentRowHeightsPx = baseFractions.map((f) => f * currentTableHeightPx);

    const manualMins = this.ensureManualTopLevelRowMinHeightsPx(rowCount);
    const contentMinHeightsPx = Array.from({ length: rowCount }, (_, r) => {
      const contentMin = this.computeMinTopLevelRowHeightPx(r, currentRowHeightsPx, zoomScale, 'autoFit');
      return Math.max(this.minRowPx, contentMin);
    });

    // Effective mins for auto-shrink should respect manual row resizes, but the OUTER widget clamp should NOT.
    const minHeightsPx = contentMinHeightsPx.map((contentMin, r) => {
      const manualMin = manualMins[r] ?? 0;
      return Math.max(this.minRowPx, contentMin, manualMin);
    });

    const minSumPx = minHeightsPx.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
    if (!Number.isFinite(minSumPx) || minSumPx <= 0) return false;

    // Keep the min-height attribute (outer resizer clamp) in sync with CONTENT-only minimums.
    // Manual row mins are a local "PPT-like" preference and should not make outer widget resizing feel stuck.
    const contentMinSumPx = contentMinHeightsPx.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
    if (Number.isFinite(contentMinSumPx) && contentMinSumPx > 0) {
      this.setContentMinHeights(contentMinSumPx);
    }

    const bufferPx = 4;
    const stepPx = 8;
    const targetHeightPx = Math.max(20, this.roundUpPx(minSumPx + bufferPx, stepPx));
    const slackPx = currentTableHeightPx - targetHeightPx;

    // Only shrink when there is meaningful slack; avoid jitter on tiny changes.
    if (!Number.isFinite(slackPx) || slackPx <= stepPx) return false;

    const maxPerTickPx = 600;
    const desiredShrinkPx = Math.min(maxPerTickPx, Math.floor(slackPx / stepPx) * stepPx);
    const maxByWidgetMin = Math.max(0, currentTableHeightPx - 20);
    const shrinkPx = Math.min(desiredShrinkPx, maxByWidgetMin);
    if (!Number.isFinite(shrinkPx) || shrinkPx <= 0) return false;

    const commit = options?.commit ?? false;
    const shrinkRes = this.growWidgetSizeBy(0, -shrinkPx, { commit });
    const appliedDeltaPx = shrinkRes?.appliedHeightPx ?? 0; // negative
    const appliedShrinkPx = -appliedDeltaPx;
    if (!Number.isFinite(appliedShrinkPx) || appliedShrinkPx <= 0.5) return false;

    const newHeightPx = Math.max(20, currentTableHeightPx - appliedShrinkPx);
    if (!Number.isFinite(newHeightPx) || newHeightPx <= 0) return false;

    // Build row heights that are "as tight as possible":
    // - Start from the content+manual minimums
    // - Put any rounding remainder on the last row (keeps other rows tight)
    const extraPx = Math.max(0, newHeightPx - minSumPx);
    const targetHeightsPx = [...minHeightsPx];
    if (targetHeightsPx.length > 0) {
      targetHeightsPx[targetHeightsPx.length - 1] = (targetHeightsPx[targetHeightsPx.length - 1] ?? 0) + extraPx;
    }

    const nextFractions = targetHeightsPx.map((px) => px / newHeightPx);
    this.rowFractions.set(this.normalizeFractions(nextFractions, rowCount));
    this.previewRowFractions.set(null);
    return true;
  }

  /**
   * Single-pass auto-fit for use after widget resize ('fitted' state).
   * 
   * This approach:
   * 1. First tries to redistribute height within the current frame (take from slack rows, give to overflow rows)
   * 2. If redistribution isn't enough, grows the widget height by the remaining deficit
   * 3. Applies everything in one step for smooth column resize behavior
   * 
   * This is more effective than the iterative approach because it handles both slack and overflow together.
   */
  private runSinglePassAutoFit(): void {
    // Prevent draft-size driven `@Input widget` updates from overwriting local fractions mid auto-fit.
    this.suppressWidgetSyncDuringAutoFit = true;
    const rect = this.getTableRect();
    if (!rect) {
      this.suppressWidgetSyncDuringAutoFit = false;
      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    if (rowCount <= 0) {
      this.suppressWidgetSyncDuringAutoFit = false;
      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const currentTableHeightPx = Math.max(1, rect.height / zoomScale);
    // Use the DOM-measured table height as the authoritative current height (draft size may not be reflected in Input yet).
    const oldWidgetHeightPx = currentTableHeightPx;

    const baseFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const currentRowHeightsPx = baseFractions.map((f) => f * currentTableHeightPx);

    // Step 1: Try to redistribute within current height (handles slack → overflow transfer)
    const fitResult = this.fitTopLevelRowsToContentWithinHeight(currentRowHeightsPx, currentTableHeightPx, zoomScale);

    if (!fitResult) {
      this.suppressWidgetSyncDuringAutoFit = false;
      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    // Check if the minimum required height exceeds current height
    const minRequiredHeightPx = fitResult.minRequiredTableHeightPx;
    const needsGrowth = minRequiredHeightPx > currentTableHeightPx + 1;

    if (needsGrowth) {
      // Step 2: Need to grow widget - calculate full growth needed
      const deficitPx = minRequiredHeightPx - currentTableHeightPx;
      const bufferPx = 4;
      const stepPx = 8;
      const totalGrowPx = Math.min(800, this.roundUpPx(deficitPx + bufferPx, stepPx));
      const newWidgetHeightPx = Math.max(20, Math.round(oldWidgetHeightPx + totalGrowPx));

      // Update widget size via draft state
      this.draftState.updateDraftSize(this.widget.id, {
        width: this.widget.size.width,
        height: newWidgetHeightPx,
      });

      // Recalculate row heights for new widget size
      const newTableHeightPx = newWidgetHeightPx;
      const redistributedHeightsPx = fitResult.nextFractions.map((f) => f * currentTableHeightPx);
      
      // Scale up the redistributed heights to fill the new widget height
      const scaleFactor = newTableHeightPx / currentTableHeightPx;
      const scaledHeightsPx = redistributedHeightsPx.map((h) => h * scaleFactor);
      
      // Convert to fractions for new height
      const newFractions = scaledHeightsPx.map((h) => h / newTableHeightPx);
      this.rowFractions.set(this.normalizeFractions(newFractions, rowCount));
      // Keep outer clamp synced to content-only min height (manual mins are not a hard clamp).
      this.setContentMinHeights(fitResult.contentMinTableHeightPx);

      // Commit draft
      this.draftState.commitDraft(this.widget.id);
    } else {
      // No growth needed - just apply the redistributed fractions
      this.rowFractions.set(this.normalizeFractions(fitResult.nextFractions, rowCount));
      this.setContentMinHeights(fitResult.contentMinTableHeightPx);

      // If widening columns reduced wrapping, reclaim slack by auto-shrinking the widget.
      if (this.tryAutoShrinkWidgetToContentMin()) {
        this.draftState.commitDraft(this.widget.id);
      }
    }

    this.suppressWidgetSyncDuringAutoFit = false;
    this.emitPropsChange(this.localRows());
    this.scheduleRecomputeResizeSegments();
    this.cdr.markForCheck();
  }

  private runAutoFitAfterTopColResizeStep(): void {
    const maxIterations = 12;
    const worst = this.findWorstLeafOverflow();
    if (!worst || worst.overflowPx <= 1 || this.autoFitAfterColResizeIteration >= maxIterations) {
      // When there is no overflow left, we may still have slack (e.g. after widening a column).
      // Reclaim it so rows/widget "tighten" automatically like backspace/delete.
      if (this.tryAutoShrinkWidgetToContentMin()) {
        this.autoFitAfterColResizeDidResizeWidget = true;
      }
      if (this.autoFitAfterColResizeDidResizeWidget) {
        this.draftState.commitDraft(this.widget.id);
      }
      this.suppressWidgetSyncDuringAutoFit = false;
      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    this.autoFitAfterColResizeIteration++;

    const bufferPx = 4;
    const stepPx = 8;
    const growPx = Math.min(600, this.roundUpPx(worst.overflowPx + bufferPx, stepPx));
    if (!Number.isFinite(growPx) || growPx <= 0) {
      this.suppressWidgetSyncDuringAutoFit = false;
      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    const oldWidgetHeightPx = this.autoFitAfterColResizeDraftHeightPx ?? this.widget?.size?.height ?? 0;
    if (!Number.isFinite(oldWidgetHeightPx) || oldWidgetHeightPx <= 0) {
      this.suppressWidgetSyncDuringAutoFit = false;
      this.emitPropsChange(this.localRows());
      this.scheduleRecomputeResizeSegments();
      this.cdr.markForCheck();
      return;
    }

    this.applyAutoFitGrowForLeaf(worst.leafId, growPx, oldWidgetHeightPx);

    this.autoFitAfterColResizeRaf = window.requestAnimationFrame(() => {
      this.autoFitAfterColResizeRaf = null;
      this.runAutoFitAfterTopColResizeStep();
    });
  }

  private findWorstLeafOverflow(): { leafId: string; overflowPx: number } | null {
    const container = this.tableContainer?.nativeElement;
    if (!container) return null;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const leaves = Array.from(container.querySelectorAll('.table-widget__cell-editor[data-leaf]')) as HTMLElement[];
    if (leaves.length === 0) return null;

    let worst: { leafId: string; overflowPx: number } | null = null;
    for (const leafEl of leaves) {
      const leafId = leafEl.getAttribute('data-leaf');
      if (!leafId) continue;

      // Ignore empty placeholders so we don't grow/shrink based on caret scaffolding.
      if (this.normalizeEditorHtmlForModel(leafEl.innerHTML) === '') continue;

      const clipEl =
        (leafEl.closest('.table-widget__sub-cell') as HTMLElement | null) ??
        (leafEl.closest('.table-widget__cell') as HTMLElement | null) ??
        leafEl;

      let visibleH = clipEl.clientHeight;
      if (!Number.isFinite(visibleH) || visibleH <= 0) {
        visibleH = clipEl.getBoundingClientRect().height / zoomScale;
      }

      const neededH = Math.max(
        leafEl.scrollHeight || 0,
        leafEl.offsetHeight || 0,
        leafEl.getBoundingClientRect().height / zoomScale || 0
      );

      if (!Number.isFinite(visibleH) || !Number.isFinite(neededH) || visibleH <= 0 || neededH <= 0) continue;

      const overflow = neededH - visibleH;
      if (overflow <= 1) continue;

      if (!worst || overflow > worst.overflowPx) {
        worst = { leafId, overflowPx: overflow };
      }
    }

    return worst;
  }

  private applyAutoFitGrowForLeaf(leafId: string, growPx: number, oldWidgetHeightPx: number): void {
    const parsed = this.parseLeafId(leafId);
    if (!parsed) return;

    // Resolve top-level anchor (safety for any covered ids).
    const rowsModel = this.localRows();
    let r = parsed.row;
    let c = parsed.col;
    let baseCell = rowsModel?.[r]?.cells?.[c];
    if (!baseCell) return;
    if (baseCell.coveredBy) {
      const a = baseCell.coveredBy;
      r = a.row;
      c = a.col;
      baseCell = rowsModel?.[r]?.cells?.[c];
      if (!baseCell) return;
    }

    const rowSpan = Math.max(1, baseCell.merge?.rowSpan ?? 1);

    // Grow widget height in draft-only mode so the table doesn't redistribute/shrink other rows.
    const curH = this.autoFitAfterColResizeDraftHeightPx ?? this.widget.size.height;
    const nextH = Math.max(20, Math.round(curH + growPx));
    const appliedDeltaPx = nextH - curH;
    if (appliedDeltaPx <= 0) return;

    this.autoFitAfterColResizeDraftHeightPx = nextH;
    this.autoFitAfterColResizeDidResizeWidget = true;
    this.draftState.updateDraftSize(this.widget.id, { width: this.widget.size.width, height: nextH });

    // If leaf is inside split grids, grow split row chains so the extra height reaches the leaf.
    this.growSplitRowFractionsForLeafId(leafId, appliedDeltaPx, oldWidgetHeightPx);

    // Grow only the affected top-level row-span area; keep other rows' pixel sizes stable.
    this.growTopLevelRowSpanFractions(r, rowSpan, appliedDeltaPx, oldWidgetHeightPx);
  }

  private growSplitRowFractionsForLeafId(leafId: string, deltaPx: number, oldWidgetHeightPx: number): void {
    const add = Number.isFinite(deltaPx) ? deltaPx : 0;
    if (add <= 0) return;

    const parsed = this.parseLeafId(leafId);
    if (!parsed || parsed.path.length === 0) return;

    const rowCount = this.getTopLevelRowCount(this.localRows());
    const baseTopRowFractions = this.normalizeFractions(this.rowFractions(), rowCount);
    const topRowHeightsPx = baseTopRowFractions.map((f) => f * oldWidgetHeightPx);

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);

      // Resolve top-level cell anchor.
      let r = parsed.row;
      let c = parsed.col;
      let baseCell = next?.[r]?.cells?.[c];
      if (!baseCell) return next;
      if (baseCell.coveredBy) {
        const a = baseCell.coveredBy;
        r = a.row;
        c = a.col;
        baseCell = next?.[r]?.cells?.[c];
        if (!baseCell) return next;
      }

      const topRowSpan = Math.max(1, baseCell.merge?.rowSpan ?? 1);
      const topStart = Math.max(0, Math.min(rowCount - 1, r));
      const topEnd = Math.min(rowCount - 1, topStart + topRowSpan - 1);
      const topCellHeightPx = topRowHeightsPx
        .slice(topStart, topEnd + 1)
        .reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);

      if (!Number.isFinite(topCellHeightPx) || topCellHeightPx <= 0) return next;

      type LevelInfo = {
        owner: TableCell;
        oldOwnerHeightPx: number;
        rowsCount: number;
        colsCount: number;
        startRow: number;
        endRow: number;
        baseRowFractions: number[];
      };

      const levels: LevelInfo[] = [];

      let owner: TableCell | null = baseCell;
      let ownerHeightPx = topCellHeightPx;

      for (let depth = 0; depth < parsed.path.length; depth++) {
        if (!owner?.split) break;

        const split: TableCellSplit = owner.split;
        const rowsCount = Math.max(1, split.rows);
        const colsCount = Math.max(1, split.cols);
        if (colsCount <= 0 || rowsCount <= 0) break;

        const childIdxRaw = parsed.path[depth];
        const childIdx = Math.max(0, Math.min(split.cells.length - 1, Math.trunc(childIdxRaw)));
        const startRow = Math.max(0, Math.min(rowsCount - 1, Math.floor(childIdx / colsCount)));
        const childCell: TableCell = split.cells[childIdx];
        const rowSpan = Math.max(1, childCell?.merge?.rowSpan ?? 1);
        const endRow = Math.min(rowsCount - 1, startRow + rowSpan - 1);

        const baseRowFractions = this.normalizeFractions(split.rowFractions ?? [], rowsCount);

        levels.push({
          owner,
          oldOwnerHeightPx: ownerHeightPx,
          rowsCount,
          colsCount,
          startRow,
          endRow,
          baseRowFractions,
        });

        // Compute the child owner's height BEFORE growth, using the current (base) split row fractions.
        const spanFrac = baseRowFractions.slice(startRow, endRow + 1).reduce((a, b) => a + b, 0);
        ownerHeightPx = ownerHeightPx * spanFrac;
        owner = childCell ?? null;
      }

      // Apply outermost -> innermost so added height propagates down the chain.
      for (const lvl of levels) {
        const split: TableCellSplit | undefined = lvl.owner.split;
        if (!split) continue;

        const oldH = lvl.oldOwnerHeightPx;
        const newH = oldH + add;
        if (oldH <= 0 || newH <= 0) continue;

        const oldPx = lvl.baseRowFractions.map((f) => f * oldH);
        const indices = Array.from({ length: lvl.endRow - lvl.startRow + 1 }, (_, k) => lvl.startRow + k);
        const spanTotal = indices.reduce((sum, rr) => sum + (oldPx[rr] ?? 0), 0);
        const per = spanTotal > 0 ? null : add / indices.length;

        const newPx = [...oldPx];
        for (const rr of indices) {
          const share = spanTotal > 0 ? ((oldPx[rr] ?? 0) / spanTotal) : (per! / add);
          newPx[rr] = (oldPx[rr] ?? 0) + add * share;
        }

        const nextFractions = newPx.map((px) => px / newH);
        split.rowFractions = this.normalizeFractions(nextFractions, lvl.rowsCount);
      }

      return next;
    });
  }

  /**
   * Adjust split row fractions when the top-level row is resized.
   * 
   * When the main row border is dragged (e.g., B's bottom in a split cell with A on top and B on bottom),
   * we want ONLY the last split subcell (B) to change height. All other subcells (A) should maintain
   * their pixel size. This is achieved by recalculating the split.rowFractions.
   * 
   * @param topRowIndex The top-level row index being resized
   * @param oldRowHeightPx The old height of the row in pixels
   * @param newRowHeightPx The new height of the row in pixels
   */
  private adjustSplitRowFractionsForTopLevelRowResize(topRowIndex: number, oldRowHeightsPx: number[], deltaPx: number): void {
    const add = Number.isFinite(deltaPx) ? deltaPx : 0;
    if (Math.abs(add) < 0.1) return;

    const rowHeights = Array.isArray(oldRowHeightsPx) ? oldRowHeightsPx : [];
    if (!Number.isFinite(topRowIndex) || topRowIndex < 0 || topRowIndex >= rowHeights.length) return;

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const colCount = this.getTopLevelColCount(rowsModel);
    if (topRowIndex >= rowCount) return;

    const sumRange = (arr: number[], start: number, endInclusive: number): number => {
      let sum = 0;
      for (let i = start; i <= endInclusive; i++) sum += arr[i] ?? 0;
      return sum;
    };

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);

      // Process all cells that could be affected by this row resize.
      // This includes cells in the row itself, plus anchor cells from previous rows that span into this row.
      for (let r = 0; r <= topRowIndex; r++) {
        for (let c = 0; c < colCount; c++) {
          const cell = next?.[r]?.cells?.[c];
          if (!cell || cell.coveredBy || !cell.split) continue;

          // Only apply the "bottom subcell absorbs" behavior when this top-level row is the bottom edge
          // of the anchor cell (i.e. the dragged boundary is the cell's bottom border).
          const rowSpan = Math.max(1, cell.merge?.rowSpan ?? 1);
          const cellEndRow = r + rowSpan - 1;
          if (cellEndRow !== topRowIndex) continue;

          const oldSpanPx = Math.max(0, sumRange(rowHeights, r, Math.min(rowCount - 1, cellEndRow)));
          if (!Number.isFinite(oldSpanPx) || oldSpanPx <= 0) continue;

          const newSpanPx = oldSpanPx + add;
          if (!Number.isFinite(newSpanPx) || newSpanPx <= 0) continue;

          this.adjustSplitFractionsRecursive(cell, oldSpanPx, newSpanPx);
        }
      }

      return next;
    });
  }

  /**
   * Recursively adjust split row fractions for a cell and its nested splits.
   * Keeps all subcells except the last one at their pixel size; the last subcell absorbs the delta.
   */
  private adjustSplitFractionsRecursive(cell: TableCell, oldContainerHeightPx: number, newContainerHeightPx: number): void {
    if (!cell.split) return;

    const split = cell.split;
    const splitRows = Math.max(1, split.rows);
    const splitCols = Math.max(1, split.cols);

    if (splitRows <= 1) {
      // Only one row in split - check nested splits in all cells
      for (const childCell of split.cells) {
        if (childCell?.split) {
          this.adjustSplitFractionsRecursive(childCell, oldContainerHeightPx, newContainerHeightPx);
        }
      }
      return;
    }

    const oldH = Number.isFinite(oldContainerHeightPx) ? oldContainerHeightPx : 0;
    const newH = Number.isFinite(newContainerHeightPx) ? newContainerHeightPx : 0;
    if (oldH <= 0 || newH <= 0) return;

    // Deterministic: keep all split rows except the last at their current pixel heights.
    // The last split row absorbs the full delta (so A stays fixed and only B changes).
    const currentFractions = this.normalizeFractions(split.rowFractions ?? [], splitRows);
    const oldRowPx = currentFractions.map((f) => f * oldH);

    const lastRowIdx = splitRows - 1;
    const fixedPx = oldRowPx
      .slice(0, lastRowIdx)
      .reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);

    const minLastPx = this.minSplitRowPx;
    const newLastPx = newH - fixedPx;

    // Safety: if we'd force the bottom row below minimum, do nothing.
    // The top-level row clamp should prevent this, so hitting this means the caller allowed over-shrinking.
    if (!Number.isFinite(newLastPx) || newLastPx < minLastPx) return;

    const newRowPx = [...oldRowPx];
    newRowPx[lastRowIdx] = newLastPx;

    const nextFractions = newRowPx.map((px) => px / newH);
    split.rowFractions = this.normalizeFractions(nextFractions, splitRows);

    // Recursively process nested splits
    // For the last row's cells, pass the updated height; for others, height is unchanged
    for (let i = 0; i < split.cells.length; i++) {
      const childCell = split.cells[i];
      if (!childCell?.split) continue;

      const childRow = Math.floor(i / splitCols);
      const childRowSpan = Math.max(1, childCell.merge?.rowSpan ?? 1);
      const childEndRow = childRow + childRowSpan - 1;

      // Calculate this child's old and new heights based on its row span
      let childOldHeight = 0;
      let childNewHeight = 0;
      for (let rr = childRow; rr <= childEndRow && rr < splitRows; rr++) {
        childOldHeight += oldRowPx[rr];
        childNewHeight += newRowPx[rr];
      }

      // Only recurse if this child's bottom touches the split's bottom (last row)
      if (childEndRow === lastRowIdx && childOldHeight > 0 && childNewHeight > 0) {
        this.adjustSplitFractionsRecursive(childCell, childOldHeight, childNewHeight);
      }
    }
  }

  private captureCaretForResize(): void {
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl) {
      this.savedCaretDuringResize = null;
      return;
    }

    const contentEl = activeEl.closest?.('.table-widget__cell-editor') as HTMLElement | null;
    if (!contentEl) {
      this.savedCaretDuringResize = null;
      return;
    }

    const leafId = contentEl.getAttribute('data-leaf');
    if (!leafId) {
      this.savedCaretDuringResize = null;
      return;
    }

    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) {
      this.savedCaretDuringResize = null;
      return;
    }

    const anchorNode = sel.anchorNode;
    const focusNode = sel.focusNode;
    if (!anchorNode || !focusNode) {
      this.savedCaretDuringResize = null;
      return;
    }

    if (!contentEl.contains(anchorNode) || !contentEl.contains(focusNode)) {
      this.savedCaretDuringResize = null;
      return;
    }

    const anchorPath = this.getNodePath(contentEl, anchorNode);
    const focusPath = this.getNodePath(contentEl, focusNode);
    if (!anchorPath || !focusPath) {
      this.savedCaretDuringResize = null;
      return;
    }

    this.savedCaretDuringResize = {
      leafId,
      anchorPath,
      anchorOffset: sel.anchorOffset,
      focusPath,
      focusOffset: sel.focusOffset,
      isCollapsed: sel.isCollapsed,
    };
  }

  private restoreCaretAfterResize(): void {
    const saved = this.savedCaretDuringResize;
    this.savedCaretDuringResize = null;
    if (!saved) return;

    window.setTimeout(() => {
      const container = this.tableContainer?.nativeElement;
      const el = container?.querySelector(`.table-widget__cell-editor[data-leaf="${saved.leafId}"]`) as HTMLElement | null;
      if (!el) return;

      const anchorNode = this.resolveNodePath(el, saved.anchorPath);
      const focusNode = saved.isCollapsed ? anchorNode : this.resolveNodePath(el, saved.focusPath);
      if (!anchorNode || !focusNode) {
        el.focus();
        return;
      }

      const range = document.createRange();
      range.setStart(anchorNode, this.clampOffset(anchorNode, saved.anchorOffset));
      range.setEnd(focusNode, this.clampOffset(focusNode, saved.isCollapsed ? saved.anchorOffset : saved.focusOffset));

      const sel = window.getSelection?.();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
      el.focus();
    }, 0);
  }

  private getNodePath(root: Node, node: Node): number[] | null {
    const path: number[] = [];
    let cur: Node | null = node;
    while (cur && cur !== root) {
      const parentNode: Node | null = cur.parentNode;
      if (!parentNode) return null;
      const idx = Array.prototype.indexOf.call(parentNode.childNodes, cur);
      if (idx < 0) return null;
      path.push(idx);
      cur = parentNode;
    }
    if (cur !== root) return null;
    return path.reverse();
  }

  private resolveNodePath(root: Node, path: number[]): Node | null {
    let cur: Node | null = root;
    for (const idx of path) {
      if (!cur || !cur.childNodes || idx < 0 || idx >= cur.childNodes.length) return null;
      cur = cur.childNodes[idx];
    }
    return cur;
  }

  private clampOffset(node: Node, offset: number): number {
    const o = Math.max(0, Math.trunc(offset));
    if (node.nodeType === Node.TEXT_NODE) {
      return Math.min(o, (node.textContent ?? '').length);
    }
    return Math.min(o, node.childNodes?.length ?? 0);
  }

  onColResizePointerDown(event: PointerEvent, boundaryIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    this.cancelAutoFitAfterColResize();
    this.clearGhosts();
    this.captureCaretForResize();
    this.syncCellContent();

    const cols = this.getTopLevelColCount(this.localRows());
    if (cols <= 1) return;
    if (boundaryIndex <= 0 || boundaryIndex >= cols) return;

    const tableRect = this.getTableRect();
    if (!tableRect) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const tableWidthPx = Math.max(1, tableRect.width / zoomScale);
    const tableHeightPx = Math.max(1, tableRect.height / zoomScale);

    this.isResizingGrid = true;
    this.activeGridResize = {
      kind: 'col',
      boundaryIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...this.colFractions],
      tableWidthPx,
      tableHeightPx,
      zoomScale,
    };

    // Initialize ghost at the current boundary position.
    const startWithin = this.activeGridResize.startFractions
      .slice(0, Math.max(0, boundaryIndex))
      .reduce((a, b) => a + b, 0);
    this.ghostTopColPercent.set(Math.max(0, Math.min(100, startWithin * 100)));

    try {
      (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }

    this.installGridResizeListeners();
  }

  onRowResizePointerDown(event: PointerEvent, boundaryIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    this.cancelAutoFitAfterColResize();
    this.clearGhosts();
    this.captureCaretForResize();
    this.syncCellContent();

    const rows = this.getTopLevelRowCount(this.localRows());
    if (rows <= 1) return;
    if (boundaryIndex <= 0 || boundaryIndex >= rows) return;

    const tableRect = this.getTableRect();
    if (!tableRect) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const tableWidthPx = Math.max(1, tableRect.width / zoomScale);
    const tableHeightPx = Math.max(1, tableRect.height / zoomScale);

    this.isResizingGrid = true;
    this.activeGridResize = {
      kind: 'row',
      boundaryIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...this.rowFractionsView],
      tableWidthPx,
      tableHeightPx,
      zoomScale,
    };

    // Initialize ghost at the current boundary position.
    const startWithin = this.activeGridResize.startFractions
      .slice(0, Math.max(0, boundaryIndex))
      .reduce((a, b) => a + b, 0);
    this.ghostTopRowPercent.set(Math.max(0, Math.min(100, startWithin * 100)));

    // Pre-compute content-based clamp so the ghost stops at the min allowed size.
    const topRowIndex = boundaryIndex - 1;
    const oldRowHeightsPx = this.activeGridResize.startFractions.map((f) => f * this.activeGridResize!.tableHeightPx);
    this.activeGridResize.minTopRowHeightPx = this.computeMinTopLevelRowHeightPx(topRowIndex, oldRowHeightsPx, zoomScale);

    try {
      (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }

    this.installGridResizeListeners();
  }

  private installGridResizeListeners(): void {
    window.addEventListener('pointermove', this.handleGridResizePointerMove, { passive: false });
    window.addEventListener('pointerup', this.handleGridResizePointerUp, { passive: false });
    window.addEventListener('pointercancel', this.handleGridResizePointerUp, { passive: false });
  }

  private teardownGridResizeListeners(): void {
    window.removeEventListener('pointermove', this.handleGridResizePointerMove as any);
    window.removeEventListener('pointerup', this.handleGridResizePointerUp as any);
    window.removeEventListener('pointercancel', this.handleGridResizePointerUp as any);
  }

  /**
   * Compute the minimum allowed height (px) for a top-level row so that shrinking does not hide content.
   * This is used to clamp row-resize interactions to "no less than content".\n   */
  private computeMinTopLevelRowHeightPx(
    topRowIndex: number,
    oldRowHeightsPx: number[],
    zoomScale: number,
    mode: 'manualRowResize' | 'autoFit' = 'manualRowResize'
  ): number {
    const minBase = this.minRowPx;
    const rowHeights = Array.isArray(oldRowHeightsPx) ? oldRowHeightsPx : [];
    if (!Number.isFinite(topRowIndex) || topRowIndex < 0) return minBase;
    if (topRowIndex >= rowHeights.length) return minBase;

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const colCount = this.getTopLevelColCount(rowsModel);

    const container = this.tableContainer?.nativeElement;
    if (!container) return minBase;

    const safeScale = Math.max(0.1, Number.isFinite(zoomScale) ? zoomScale : 1);

    // Manual-row-resize-only helpers (PPT-like: split top rows stay fixed, bottom row absorbs).
    const parseGridRowStart0 =
      mode === 'manualRowResize'
        ? (el: HTMLElement): number | null => {
            const raw = el.style.gridRowStart || window.getComputedStyle(el).gridRowStart;
            const n = Number.parseInt((raw ?? '').toString(), 10);
            if (!Number.isFinite(n)) return null;
            return Math.max(0, n - 1);
          }
        : null;

    const parseGridRowSpan =
      mode === 'manualRowResize'
        ? (el: HTMLElement): number => {
            const raw = (el.style.gridRowEnd || window.getComputedStyle(el).gridRowEnd || '').toString().trim();
            const m = raw.match(/^span\s+(\d+)$/);
            const span = m ? Number.parseInt(m[1], 10) : 1;
            return Number.isFinite(span) && span > 0 ? span : 1;
          }
        : null;

    const isLeafInBottomResizeChain =
      mode === 'manualRowResize'
        ? (leafEl: HTMLElement): boolean => {
            let node: HTMLElement | null = leafEl;
            for (let guard = 0; guard < 12; guard++) {
              const subCellEl = node?.closest?.('.table-widget__sub-cell') as HTMLElement | null;
              if (!subCellEl) return true; // no more split levels

              const gridEl = subCellEl.closest?.('.table-widget__split-grid') as HTMLElement | null;
              if (!gridEl) return false;

              const ownerLeafId = gridEl.getAttribute('data-owner-leaf') ?? '';
              const ownerCell = ownerLeafId ? this.getCellModelByLeafId(ownerLeafId) : null;
              const rowsCount = Math.max(1, ownerCell?.split?.rows ?? 0);
              if (!Number.isFinite(rowsCount) || rowsCount <= 0) return false;

              const start0 = parseGridRowStart0!(subCellEl);
              if (start0 === null) return false;
              const span = parseGridRowSpan!(subCellEl);
              const end0 = start0 + span - 1;
              if (end0 !== rowsCount - 1) return false;

              // Move outward: if this split grid is nested, its container is a parent sub-cell in the next loop.
              node = gridEl;
            }
            return true;
          }
        : null;

    const sumRange = (arr: number[], start: number, endInclusive: number): number => {
      let sum = 0;
      for (let i = start; i <= endInclusive; i++) sum += arr[i] ?? 0;
      return sum;
    };

    const oldTopPx = Math.max(0, rowHeights[topRowIndex] ?? 0);
    let minTopPx = minBase;

    // Scan all anchor cells whose top-level row-span includes topRowIndex.
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = rowsModel?.[r]?.cells?.[c];
        if (!cell || cell.coveredBy) continue;

        const rowSpan = Math.max(1, cell.merge?.rowSpan ?? 1);
        const startRow = r;
        const endRow = Math.min(rowCount - 1, r + rowSpan - 1);
        if (topRowIndex < startRow || topRowIndex > endRow) continue;

        const oldSpanPx = Math.max(0, sumRange(rowHeights, startRow, endRow));
        if (oldSpanPx <= 0) continue;
        const oldOtherPx = Math.max(0, oldSpanPx - oldTopPx);

        // Find the rendered anchor cell element and measure all leaf content within it (including split leaves).
        const anchorEl = container.querySelector(`.table-widget__cell[data-cell="${r}-${c}"]`) as HTMLElement | null;
        if (!anchorEl) continue;

        const leafEls = Array.from(anchorEl.querySelectorAll('.table-widget__cell-editor[data-leaf]')) as HTMLElement[];
        if (leafEls.length === 0) continue;

        let requiredOwnerSpanPx = 0;

        // If this anchor cell's bottom aligns with the resized row boundary and it is split,
        // then our resize policy is: fixed split rows stay fixed, and only the bottom-most split row changes.
        // This must be reflected in the min-height clamp; otherwise shrinking will feel "sticky" or oscillate.
        const isBottomAlignedAnchor = endRow === topRowIndex;
        if (mode === 'manualRowResize' && isBottomAlignedAnchor && cell.split) {
          const splitRows = Math.max(1, cell.split.rows);
          if (splitRows > 1) {
            const rowF = this.normalizeFractions(cell.split.rowFractions ?? [], splitRows);
            const fixedFrac = rowF.slice(0, splitRows - 1).reduce((a, b) => a + b, 0);
            const fixedPx = fixedFrac * oldSpanPx;
            const baseline = fixedPx + this.minSplitRowPx;
            if (Number.isFinite(baseline)) {
              requiredOwnerSpanPx = Math.max(requiredOwnerSpanPx, baseline);
            }
          }
        }

        for (const leafEl of leafEls) {
          // Ignore empty placeholders so empty cells don't block manual shrinking.
          if (this.normalizeEditorHtmlForModel(leafEl.innerHTML) === '') continue;

          const neededH = Math.max(
            leafEl.scrollHeight || 0,
            leafEl.offsetHeight || 0,
            leafEl.getBoundingClientRect().height / safeScale || 0
          );
          if (!Number.isFinite(neededH) || neededH <= 0) continue;

          const clipEl =
            (leafEl.closest('.table-widget__sub-cell') as HTMLElement | null) ??
            (leafEl.closest('.table-widget__cell') as HTMLElement | null) ??
            anchorEl;

          let visibleH = clipEl.clientHeight;
          if (!Number.isFinite(visibleH) || visibleH <= 0) {
            visibleH = clipEl.getBoundingClientRect().height / safeScale;
          }
          if (!Number.isFinite(visibleH) || visibleH <= 0) continue;

          // Special handling for split-cells when resizing the anchor's bottom border:
          // non-bottom split rows remain fixed, so only leaves in the bottom chain actually shrink/grow.
          if (mode === 'manualRowResize' && isBottomAlignedAnchor && cell.split && !!leafEl.closest('.table-widget__sub-cell')) {
            if (!isLeafInBottomResizeChain!(leafEl)) {
              // This leaf sits in a fixed (non-bottom) split row; it won't shrink during main-row resize.
              // Do not let it restrict shrinking.
              continue;
            }

            // Bottom-chain leaves change height 1:1 with the anchor span height (fixed offset + delta).
            // Minimum anchor span that keeps this leaf visible: oldSpan + (needed - visible).
            const requiredSpanForLeaf = oldSpanPx + (neededH - visibleH);
            if (Number.isFinite(requiredSpanForLeaf)) {
              requiredOwnerSpanPx = Math.max(requiredOwnerSpanPx, requiredSpanForLeaf);
            }
            continue;
          }

          // Default proportional clamp (legacy behavior): leaf height shrinks in proportion to the owner span.
          const p = oldSpanPx > 0 ? visibleH / oldSpanPx : 1;
          const eps = 0.02;
          const requiredSpanForLeaf = neededH / Math.max(eps, p);
          requiredOwnerSpanPx = Math.max(requiredOwnerSpanPx, requiredSpanForLeaf);
        }

        if (!Number.isFinite(requiredOwnerSpanPx) || requiredOwnerSpanPx <= 0) continue;

        // We only change the topRowIndex height; other spanned rows remain as-is.
        const requiredTop = requiredOwnerSpanPx - oldOtherPx;
        if (Number.isFinite(requiredTop)) {
          minTopPx = Math.max(minTopPx, requiredTop);
        }
      }
    }

    // Round up slightly to avoid 1px oscillation due to sub-pixel layout.
    return Math.max(minBase, Math.ceil(minTopPx));
  }

  private computeMinSplitAdjacentRowHeightsPx(
    ownerLeafId: string,
    ownerCell: TableCell,
    boundaryIndex: number,
    ownerHeightPx: number,
    zoomScale: number
  ): { minTopPx: number; minBottomPx: number } {
    const minBase = this.minSplitRowPx;
    if (!ownerCell?.split) return { minTopPx: minBase, minBottomPx: minBase };

    const split = ownerCell.split;
    const rowsCount = Math.max(1, split.rows);
    const colsCount = Math.max(1, split.cols);

    const i = Math.max(1, Math.min(rowsCount - 1, Math.trunc(boundaryIndex)));
    const topIdx = i - 1;
    const bottomIdx = i;

    const safeH = Math.max(1, Number.isFinite(ownerHeightPx) ? ownerHeightPx : 1);
    const rowFractions = this.normalizeFractions(split.rowFractions ?? [], rowsCount);
    const rowHeightsPx = rowFractions.map((f) => f * safeH);

    const ownerParsed = this.parseLeafId(ownerLeafId);
    const ownerDepth = ownerParsed?.path?.length ?? 0;

    const table = this.getTableElement();
    const gridEl = table?.querySelector(`.table-widget__split-grid[data-owner-leaf="${ownerLeafId}"]`) as HTMLElement | null;
    if (!gridEl) return { minTopPx: minBase, minBottomPx: minBase };

    const safeScale = Math.max(0.1, Number.isFinite(zoomScale) ? zoomScale : 1);
    const sumRange = (arr: number[], start: number, endInclusive: number): number => {
      let sum = 0;
      for (let rr = start; rr <= endInclusive; rr++) sum += arr[rr] ?? 0;
      return sum;
    };

    let minTopPx = minBase;
    let minBottomPx = minBase;

    const leafEls = Array.from(gridEl.querySelectorAll('.table-widget__cell-editor[data-leaf]')) as HTMLElement[];
    for (const leafEl of leafEls) {
      const leafId = leafEl.getAttribute('data-leaf');
      if (!leafId) continue;
      const leafParsed = this.parseLeafId(leafId);
      if (!leafParsed) continue;

      // Ensure the leaf is under this split owner (path prefix match).
      if (ownerParsed) {
        if (leafParsed.row !== ownerParsed.row || leafParsed.col !== ownerParsed.col) continue;
        let prefixMatches = true;
        for (let k = 0; k < ownerDepth; k++) {
          if ((leafParsed.path[k] ?? -1) !== (ownerParsed.path[k] ?? -2)) {
            prefixMatches = false;
            break;
          }
        }
        if (!prefixMatches) continue;
      }

      const anchorIdxRaw = leafParsed.path[ownerDepth];
      if (!Number.isFinite(anchorIdxRaw)) continue;

      const anchorIdx0 = Math.max(0, Math.min(split.cells.length - 1, Math.trunc(anchorIdxRaw)));
      let anchorIdx = anchorIdx0;
      let startRow0 = Math.floor(anchorIdx0 / colsCount);
      let startCol0 = anchorIdx0 % colsCount;

      let anchorCell = split.cells[anchorIdx];
      if (anchorCell?.coveredBy) {
        const a = anchorCell.coveredBy;
        const idx2 = a.row * colsCount + a.col;
        anchorIdx = Math.max(0, Math.min(split.cells.length - 1, idx2));
        startRow0 = a.row;
        startCol0 = a.col;
        anchorCell = split.cells[anchorIdx];
      }
      if (!anchorCell) continue;

      const rowSpan = Math.max(1, anchorCell.merge?.rowSpan ?? 1);
      const startRow = Math.max(0, Math.min(rowsCount - 1, startRow0));
      const endRow = Math.min(rowsCount - 1, startRow + rowSpan - 1);

      const crossesBoundary = startRow <= topIdx && endRow >= bottomIdx;
      if (crossesBoundary) continue;

      const affectsTop = topIdx >= startRow && topIdx <= endRow && !(bottomIdx >= startRow && bottomIdx <= endRow);
      const affectsBottom = bottomIdx >= startRow && bottomIdx <= endRow && !(topIdx >= startRow && topIdx <= endRow);
      if (!affectsTop && !affectsBottom) continue;

      const anchorOldHeightPx = sumRange(rowHeightsPx, startRow, endRow);
      if (!Number.isFinite(anchorOldHeightPx) || anchorOldHeightPx <= 0) continue;

      const clipEl =
        (leafEl.closest('.table-widget__sub-cell') as HTMLElement | null) ??
        (leafEl.closest('.table-widget__cell') as HTMLElement | null) ??
        leafEl;
      const visibleLeafH = Math.max(1, clipEl.getBoundingClientRect().height / safeScale);

      // Ignore empty placeholders so empty split leaves don't block manual shrinking.
      if (this.normalizeEditorHtmlForModel(leafEl.innerHTML) === '') continue;

      const neededLeafH = Math.max(
        leafEl.scrollHeight || 0,
        leafEl.offsetHeight || 0,
        leafEl.getBoundingClientRect().height / safeScale || 0
      );

      if (!Number.isFinite(visibleLeafH) || !Number.isFinite(neededLeafH) || visibleLeafH <= 0 || neededLeafH <= 0) continue;

      const p = visibleLeafH / anchorOldHeightPx;
      const eps = 0.02;
      const requiredAnchorHeightPx = neededLeafH / Math.max(eps, p);

      if (affectsTop) {
        const constPart = anchorOldHeightPx - (rowHeightsPx[topIdx] ?? 0);
        const requiredTop = requiredAnchorHeightPx - constPart;
        if (Number.isFinite(requiredTop)) {
          minTopPx = Math.max(minTopPx, requiredTop);
        }
      } else if (affectsBottom) {
        const constPart = anchorOldHeightPx - (rowHeightsPx[bottomIdx] ?? 0);
        const requiredBottom = requiredAnchorHeightPx - constPart;
        if (Number.isFinite(requiredBottom)) {
          minBottomPx = Math.max(minBottomPx, requiredBottom);
        }
      }
    }

    return {
      minTopPx: Math.max(minBase, Math.ceil(minTopPx)),
      minBottomPx: Math.max(minBase, Math.ceil(minBottomPx)),
    };
  }

  // ============================================
  // Split-grid resize (persisted + zoom-safe)
  // ============================================

  onSplitColResizePointerDown(
    event: PointerEvent,
    rowIndex: number,
    cellIndex: number,
    path: string,
    boundaryIndex: number
  ): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    this.cancelAutoFitAfterColResize();
    this.clearGhosts();
    this.captureCaretForResize();
    this.syncCellContent();

    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const owner = this.getCellModelByLeafId(ownerLeafId);
    if (!owner?.split) return;

    const cols = Math.max(1, owner.split.cols);
    if (cols <= 1) return;
    if (boundaryIndex <= 0 || boundaryIndex >= cols) return;

    const splitGridEl = (event.target as HTMLElement | null)?.closest('.table-widget__split-grid') as HTMLElement | null;
    if (!splitGridEl) return;
    const rect = splitGridEl.getBoundingClientRect();
    if (!rect) return;

    const sharedAbs = this.computeSplitBoundaryAbs('col', splitGridEl, ownerLeafId, owner, boundaryIndex);
    const sharedOwners = sharedAbs !== null ? this.findSharedSplitOwners('col', sharedAbs) : [];

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const containerWidthPx = Math.max(1, rect.width / zoomScale);
    const containerHeightPx = Math.max(1, rect.height / zoomScale);
    const tableRect = this.getTableRect();
    const tableWidthPx = tableRect ? Math.max(1, tableRect.width / zoomScale) : undefined;
    const tableHeightPx = tableRect ? Math.max(1, tableRect.height / zoomScale) : undefined;

    this.isResizingSplitGrid = true;
    this.activeSplitResize = {
      kind: 'col',
      ownerLeafId,
      boundaryIndex,
      sharedBoundaryAbs: sharedAbs ?? undefined,
      startSharedBoundaryAbs: sharedAbs ?? undefined,
      tableWidthPx,
      tableHeightPx,
      sharedOwnerLeafIds: sharedOwners,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...this.getSplitColFractions(ownerLeafId, owner)],
      containerWidthPx,
      containerHeightPx,
      zoomScale,
    };

    // Initialize ghost lines for all owners that will be affected.
    const ownersToGhost = Array.from(new Set([ownerLeafId, ...sharedOwners]));
    const ownerW = new Map<string, number>();
    const ownerH = new Map<string, number>();
    const boundaryIndexMap = new Map<string, number>();
    const ghostMap = new Map(this.ghostSplitColWithinPercent());
    for (const id of ownersToGhost) {
      const m = this.getCellModelByLeafId(id);
      const count = Math.max(1, m?.split?.cols ?? 0);
      if (!m?.split) continue;

      const idx = sharedAbs !== null
        ? (this.computeOwnerBoundaryIndexForSharedAbs('col', id, m, sharedAbs) ?? boundaryIndex)
        : boundaryIndex;
      if (idx <= 0 || idx >= count) continue;
      boundaryIndexMap.set(id, idx);

      const f = this.getSplitColFractions(id, m);
      const within = f.slice(0, Math.max(0, idx)).reduce((a, b) => a + b, 0);
      ghostMap.set(id, Math.max(0, Math.min(100, within * 100)));

      // Cache each owner's container size for correct min constraints during propagation.
      const gridEl2 = this.getTableElement()?.querySelector(`.table-widget__split-grid[data-owner-leaf="${id}"]`) as HTMLElement | null;
      if (gridEl2) {
        const rr = gridEl2.getBoundingClientRect();
        ownerW.set(id, Math.max(1, rr.width / zoomScale));
        ownerH.set(id, Math.max(1, rr.height / zoomScale));
      }
    }
    this.ghostSplitColWithinPercent.set(ghostMap);
    if (this.activeSplitResize) {
      this.activeSplitResize.ownerContainerWidthPx = ownerW;
      this.activeSplitResize.ownerContainerHeightPx = ownerH;
      this.activeSplitResize.ownerBoundaryIndexMap = boundaryIndexMap;
    }

    if (sharedAbs !== null && sharedOwners.length > 1) {
      this.ghostSharedSplitColPercent.set(Math.max(0, Math.min(100, sharedAbs * 100)));
    }

    try {
      (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }

    this.installSplitResizeListeners();
  }

  onSplitRowResizePointerDown(
    event: PointerEvent,
    rowIndex: number,
    cellIndex: number,
    path: string,
    boundaryIndex: number
  ): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    this.cancelAutoFitAfterColResize();
    this.clearGhosts();
    this.captureCaretForResize();
    this.syncCellContent();

    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const owner = this.getCellModelByLeafId(ownerLeafId);
    if (!owner?.split) return;

    const rows = Math.max(1, owner.split.rows);
    if (rows <= 1) return;
    if (boundaryIndex <= 0 || boundaryIndex >= rows) return;

    const splitGridEl = (event.target as HTMLElement | null)?.closest('.table-widget__split-grid') as HTMLElement | null;
    if (!splitGridEl) return;
    const rect = splitGridEl.getBoundingClientRect();
    if (!rect) return;

    const sharedAbs = this.computeSplitBoundaryAbs('row', splitGridEl, ownerLeafId, owner, boundaryIndex);
    const sharedOwners = sharedAbs !== null ? this.findSharedSplitOwners('row', sharedAbs) : [];

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const containerWidthPx = Math.max(1, rect.width / zoomScale);
    const containerHeightPx = Math.max(1, rect.height / zoomScale);
    const tableRect = this.getTableRect();
    const tableWidthPx = tableRect ? Math.max(1, tableRect.width / zoomScale) : undefined;
    const tableHeightPx = tableRect ? Math.max(1, tableRect.height / zoomScale) : undefined;

    this.isResizingSplitGrid = true;
    this.activeSplitResize = {
      kind: 'row',
      ownerLeafId,
      boundaryIndex,
      sharedBoundaryAbs: sharedAbs ?? undefined,
      startSharedBoundaryAbs: sharedAbs ?? undefined,
      tableWidthPx,
      tableHeightPx,
      sharedOwnerLeafIds: sharedOwners,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...this.getSplitRowFractions(ownerLeafId, owner)],
      containerWidthPx,
      containerHeightPx,
      zoomScale,
    };

    const ownersToGhost = Array.from(new Set([ownerLeafId, ...sharedOwners]));
    const ownerW = new Map<string, number>();
    const ownerH = new Map<string, number>();
    const boundaryIndexMap = new Map<string, number>();
    const ghostMap = new Map(this.ghostSplitRowWithinPercent());
    for (const id of ownersToGhost) {
      const m = this.getCellModelByLeafId(id);
      const count = Math.max(1, m?.split?.rows ?? 0);
      if (!m?.split) continue;

      const idx = sharedAbs !== null
        ? (this.computeOwnerBoundaryIndexForSharedAbs('row', id, m, sharedAbs) ?? boundaryIndex)
        : boundaryIndex;
      if (idx <= 0 || idx >= count) continue;
      boundaryIndexMap.set(id, idx);

      const f = this.getSplitRowFractions(id, m);
      const within = f.slice(0, Math.max(0, idx)).reduce((a, b) => a + b, 0);
      ghostMap.set(id, Math.max(0, Math.min(100, within * 100)));

      const gridEl2 = this.getTableElement()?.querySelector(`.table-widget__split-grid[data-owner-leaf="${id}"]`) as HTMLElement | null;
      if (gridEl2) {
        const rr = gridEl2.getBoundingClientRect();
        ownerW.set(id, Math.max(1, rr.width / zoomScale));
        ownerH.set(id, Math.max(1, rr.height / zoomScale));
      }
    }
    this.ghostSplitRowWithinPercent.set(ghostMap);
    if (this.activeSplitResize) {
      this.activeSplitResize.ownerContainerWidthPx = ownerW;
      this.activeSplitResize.ownerContainerHeightPx = ownerH;
      this.activeSplitResize.ownerBoundaryIndexMap = boundaryIndexMap;
    }

    // Content-based min constraints for this split-row boundary (per owner).
    const minTopPxByOwner = new Map<string, number>();
    const minBottomPxByOwner = new Map<string, number>();
    for (const id of ownersToGhost) {
      const m = this.getCellModelByLeafId(id);
      if (!m?.split) continue;
      const idx = boundaryIndexMap.get(id) ?? boundaryIndex;
      const count = Math.max(1, m.split.rows);
      if (idx <= 0 || idx >= count) continue;
      const h = ownerH.get(id) ?? containerHeightPx;
      const res = this.computeMinSplitAdjacentRowHeightsPx(id, m, idx, h, zoomScale);
      minTopPxByOwner.set(id, res.minTopPx);
      minBottomPxByOwner.set(id, res.minBottomPx);
    }
    if (this.activeSplitResize) {
      this.activeSplitResize.ownerMinSplitRowTopPx = minTopPxByOwner;
      this.activeSplitResize.ownerMinSplitRowBottomPx = minBottomPxByOwner;
    }

    if (sharedAbs !== null && sharedOwners.length > 1) {
      this.ghostSharedSplitRowPercent.set(Math.max(0, Math.min(100, sharedAbs * 100)));
    }

    try {
      (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }

    this.installSplitResizeListeners();
  }

  private installSplitResizeListeners(): void {
    window.addEventListener('pointermove', this.handleSplitResizePointerMove, { passive: false });
    window.addEventListener('pointerup', this.handleSplitResizePointerUp, { passive: false });
    window.addEventListener('pointercancel', this.handleSplitResizePointerUp, { passive: false });
  }

  private teardownSplitResizeListeners(): void {
    window.removeEventListener('pointermove', this.handleSplitResizePointerMove as any);
    window.removeEventListener('pointerup', this.handleSplitResizePointerUp as any);
    window.removeEventListener('pointercancel', this.handleSplitResizePointerUp as any);
  }

  private finishSplitResize(): void {
    if (!this.isResizingSplitGrid || !this.activeSplitResize) return;

    const r = this.activeSplitResize;

    const ownersToPersist = Array.from(new Set([r.ownerLeafId, ...(r.sharedOwnerLeafIds ?? [])]));

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);
      for (const ownerLeafId of ownersToPersist) {
        const parsed = this.parseLeafId(ownerLeafId);
        if (!parsed) continue;

        let baseCell = next?.[parsed.row]?.cells?.[parsed.col];
        if (!baseCell) continue;

        // Safety: if leaf id points to a covered top-level cell, redirect to its anchor
        if (baseCell.coveredBy) {
          const a = baseCell.coveredBy;
          baseCell = next?.[a.row]?.cells?.[a.col];
          if (!baseCell) continue;
        }

        const target = parsed.path.length === 0 ? baseCell : this.getCellAtPath(baseCell, parsed.path);
        if (!target?.split) continue;

        if (r.kind === 'col') {
          const final = this.pendingSplitColFractions().get(ownerLeafId);
          if (final) {
            target.split.columnFractions = this.normalizeFractions(final, Math.max(1, target.split.cols));
          }
        } else {
          const final = this.pendingSplitRowFractions().get(ownerLeafId);
          if (final) {
            target.split.rowFractions = this.normalizeFractions(final, Math.max(1, target.split.rows));
          }
        }
      }
      return next;
    });

    // Persist immediately (discrete sizing action).
    this.emitPropsChange(this.localRows());

    // After split column resize, wrapping can change and require top-level rows/table to grow.
    // Run the same AutoFit flow as top-level column resize.
    if (r.kind === 'col') {
      this.schedulePostCommitTopColResizeWork();
    }

    // Clear pending fractions for all involved owners
    const colMap = new Map(this.pendingSplitColFractions());
    const rowMap = new Map(this.pendingSplitRowFractions());
    for (const ownerLeafId of ownersToPersist) {
      colMap.delete(ownerLeafId);
      rowMap.delete(ownerLeafId);
    }
    this.pendingSplitColFractions.set(colMap);
    this.pendingSplitRowFractions.set(rowMap);

    this.isResizingSplitGrid = false;
    this.activeSplitResize = null;
    this.teardownSplitResizeListeners();
    this.cdr.markForCheck();
    this.restoreCaretAfterResize();
    this.clearGhosts();
  }

  private handleSplitResizePointerMove = (event: PointerEvent): void => {
    if (!this.isResizingSplitGrid || !this.activeSplitResize) return;
    event.preventDefault();
    event.stopPropagation();

    const r = this.activeSplitResize;
    if (event.pointerId !== r.pointerId) return;

    // Fallback: if mouse button was released but pointerup was missed, stop resizing.
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      this.finishSplitResize();
      return;
    }

    const owner = this.getCellModelByLeafId(r.ownerLeafId);
    if (!owner?.split) return;

    const scale = r.zoomScale;

    if (r.kind === 'col') {
      const deltaScreen = event.clientX - r.startClientX;
      const desiredDeltaPx = deltaScreen / scale;

      const ownersToResize = Array.from(new Set([r.ownerLeafId, ...(r.sharedOwnerLeafIds ?? [])]));
      const boundaryIndexMap = r.ownerBoundaryIndexMap;

      type OwnerColInfo = {
        leafId: string;
        boundaryIndex: number;
        startFractions: number[];
        cols: number;
        widthPx: number;
        leftIdx: number;
        rightIdx: number;
        startLeft: number;
        total: number;
        minLeft: number;
        minRight: number;
      };

      const infos: OwnerColInfo[] = [];
      let deltaMinPx = Number.NEGATIVE_INFINITY;
      let deltaMaxPx = Number.POSITIVE_INFINITY;

      for (const id of ownersToResize) {
        const m = this.getCellModelByLeafId(id);
        if (!m?.split) continue;
        const cols = Math.max(1, m.split.cols);
        if (cols <= 1) continue;

        const idx = boundaryIndexMap?.get(id) ?? (id === r.ownerLeafId ? r.boundaryIndex : null);
        if (idx === null) continue;
        if (idx <= 0 || idx >= cols) continue;

        const startFractions = id === r.ownerLeafId ? r.startFractions : this.getSplitColFractions(id, m);
        if (startFractions.length !== cols) continue;

        const widthPx = r.ownerContainerWidthPx?.get(id) ?? r.containerWidthPx;
        const li = idx - 1;
        const ri = idx;
        const startLeft = startFractions[li] ?? 0;
        const startRight = startFractions[ri] ?? 0;
        const total = startLeft + startRight;

        const minLeft = this.minSplitColPx / widthPx;
        const minRight = this.minSplitColPx / widthPx;
        deltaMinPx = Math.max(deltaMinPx, (minLeft - startLeft) * widthPx);
        deltaMaxPx = Math.min(deltaMaxPx, (total - minRight - startLeft) * widthPx);

        infos.push({
          leafId: id,
          boundaryIndex: idx,
          startFractions,
          cols,
          widthPx,
          leftIdx: li,
          rightIdx: ri,
          startLeft,
          total,
          minLeft,
          minRight,
        });
      }

      if (infos.length === 0) return;

      const appliedDeltaPx = this.clamp(desiredDeltaPx, deltaMinPx, deltaMaxPx);

      const map = new Map(this.pendingSplitColFractions());
      const ghostMap = new Map(this.ghostSplitColWithinPercent());
      for (const info of infos) {
        const next = [...info.startFractions];
        const nextLeft = info.startLeft + appliedDeltaPx / info.widthPx;
        const clampedLeft = this.clamp(nextLeft, info.minLeft, info.total - info.minRight);
        next[info.leftIdx] = clampedLeft;
        next[info.rightIdx] = info.total - clampedLeft;

        const updated = this.normalizeFractions(next, info.cols);
        map.set(info.leafId, updated);

        const within = updated.slice(0, Math.max(0, info.boundaryIndex)).reduce((a, b) => a + b, 0);
        ghostMap.set(info.leafId, Math.max(0, Math.min(100, within * 100)));
      }

      this.pendingSplitColFractions.set(map);
      this.ghostSplitColWithinPercent.set(ghostMap);

      // Shared boundary ghost (absolute within the top-level table) when applicable.
      if (r.startSharedBoundaryAbs !== undefined && r.tableWidthPx) {
        const deltaAbs = appliedDeltaPx / r.tableWidthPx;
        const abs = this.clamp(r.startSharedBoundaryAbs + deltaAbs, 0, 1);
        this.ghostSharedSplitColPercent.set(abs * 100);
      }
    } else {
      const deltaScreen = event.clientY - r.startClientY;
      const desiredDeltaPx = deltaScreen / scale;

      const ownersToResize = Array.from(new Set([r.ownerLeafId, ...(r.sharedOwnerLeafIds ?? [])]));
      const boundaryIndexMap = r.ownerBoundaryIndexMap;

      type OwnerRowInfo = {
        leafId: string;
        boundaryIndex: number;
        startFractions: number[];
        rows: number;
        heightPx: number;
        topIdx: number;
        bottomIdx: number;
        startTop: number;
        total: number;
        minTopF: number;
        minBottomF: number;
      };

      const infos: OwnerRowInfo[] = [];
      let deltaMinPx = Number.NEGATIVE_INFINITY;
      let deltaMaxPx = Number.POSITIVE_INFINITY;

      for (const id of ownersToResize) {
        const m = this.getCellModelByLeafId(id);
        if (!m?.split) continue;
        const rows = Math.max(1, m.split.rows);
        if (rows <= 1) continue;

        const idx = boundaryIndexMap?.get(id) ?? (id === r.ownerLeafId ? r.boundaryIndex : null);
        if (idx === null) continue;
        if (idx <= 0 || idx >= rows) continue;

        const startFractions = id === r.ownerLeafId ? r.startFractions : this.getSplitRowFractions(id, m);
        if (startFractions.length !== rows) continue;

        const heightPx = r.ownerContainerHeightPx?.get(id) ?? r.containerHeightPx;
        const ti = idx - 1;
        const bi = idx;
        const startTop = startFractions[ti] ?? 0;
        const startBottom = startFractions[bi] ?? 0;
        const total = startTop + startBottom;

        const minTopPx = r.ownerMinSplitRowTopPx?.get(id) ?? this.minSplitRowPx;
        const minBottomPx = r.ownerMinSplitRowBottomPx?.get(id) ?? this.minSplitRowPx;
        const minTopF = Math.max(this.minSplitRowPx, minTopPx) / heightPx;
        const minBottomF = Math.max(this.minSplitRowPx, minBottomPx) / heightPx;

        deltaMinPx = Math.max(deltaMinPx, (minTopF - startTop) * heightPx);
        deltaMaxPx = Math.min(deltaMaxPx, (total - minBottomF - startTop) * heightPx);

        infos.push({
          leafId: id,
          boundaryIndex: idx,
          startFractions,
          rows,
          heightPx,
          topIdx: ti,
          bottomIdx: bi,
          startTop,
          total,
          minTopF,
          minBottomF,
        });
      }

      if (infos.length === 0) return;

      const appliedDeltaPx = this.clamp(desiredDeltaPx, deltaMinPx, deltaMaxPx);

      const map = new Map(this.pendingSplitRowFractions());
      const ghostMap = new Map(this.ghostSplitRowWithinPercent());
      for (const info of infos) {
        const next = [...info.startFractions];
        const nextTop = info.startTop + appliedDeltaPx / info.heightPx;
        const clampedTop = this.clamp(nextTop, info.minTopF, info.total - info.minBottomF);
        next[info.topIdx] = clampedTop;
        next[info.bottomIdx] = info.total - clampedTop;

        const updated = this.normalizeFractions(next, info.rows);
        map.set(info.leafId, updated);

        const within = updated.slice(0, Math.max(0, info.boundaryIndex)).reduce((a, b) => a + b, 0);
        ghostMap.set(info.leafId, Math.max(0, Math.min(100, within * 100)));
      }

      this.pendingSplitRowFractions.set(map);
      this.ghostSplitRowWithinPercent.set(ghostMap);

      if (r.startSharedBoundaryAbs !== undefined && r.tableHeightPx) {
        const deltaAbs = appliedDeltaPx / r.tableHeightPx;
        const abs = this.clamp(r.startSharedBoundaryAbs + deltaAbs, 0, 1);
        this.ghostSharedSplitRowPercent.set(abs * 100);
      }
    }

    this.cdr.markForCheck();
  };

  private handleSplitResizePointerUp = (event: PointerEvent): void => {
    if (!this.isResizingSplitGrid || !this.activeSplitResize) return;
    event.preventDefault();
    event.stopPropagation();

    const r = this.activeSplitResize;
    if (event.pointerId !== r.pointerId) return;
    this.finishSplitResize();
  };

  private computeSplitBoundaryAbs(
    kind: 'col' | 'row',
    splitGridEl: HTMLElement,
    ownerLeafId: string,
    ownerCell: TableCell,
    boundaryIndex: number
  ): number | null {
    const tableRect = this.getTableRect();
    const rect = splitGridEl.getBoundingClientRect();
    if (!tableRect) return null;
    if (!Number.isFinite(tableRect.width) || !Number.isFinite(tableRect.height) || tableRect.width <= 0 || tableRect.height <= 0) {
      return null;
    }
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    // Boundary position within the split grid (0..1). Compute from fractions.
    let within = 0.5;
    if (kind === 'col') {
      const f = this.getSplitColFractions(ownerLeafId, ownerCell);
      within = f.slice(0, Math.max(0, boundaryIndex)).reduce((a, b) => a + b, 0);
    } else {
      const f = this.getSplitRowFractions(ownerLeafId, ownerCell);
      within = f.slice(0, Math.max(0, boundaryIndex)).reduce((a, b) => a + b, 0);
    }

    // Convert to an absolute fraction within the top-level table.
    if (kind === 'col') {
      const xPx = rect.left + within * rect.width;
      const abs = (xPx - tableRect.left) / tableRect.width;
      return Math.max(0, Math.min(1, abs));
    }
    const yPx = rect.top + within * rect.height;
    const abs = (yPx - tableRect.top) / tableRect.height;
    return Math.max(0, Math.min(1, abs));
  }

  private computeOwnerBoundaryIndexForSharedAbs(
    kind: 'col' | 'row',
    ownerLeafId: string,
    ownerCell: TableCell,
    sharedAbs: number
  ): number | null {
    const table = this.getTableElement();
    const tableRect = this.getTableRect();
    if (!table || !tableRect) return null;
    if (!Number.isFinite(sharedAbs)) return null;

    const gridEl = table.querySelector(`.table-widget__split-grid[data-owner-leaf="${ownerLeafId}"]`) as HTMLElement | null;
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return null;

    const within = kind === 'col'
      ? (sharedAbs * tableRect.width + tableRect.left - rect.left) / rect.width
      : (sharedAbs * tableRect.height + tableRect.top - rect.top) / rect.height;
    const boundedWithin = Math.max(0, Math.min(1, within));

    const fractions = kind === 'col'
      ? this.getSplitColFractions(ownerLeafId, ownerCell)
      : this.getSplitRowFractions(ownerLeafId, ownerCell);
    if (!fractions || fractions.length <= 1) return null;

    let acc = 0;
    let bestIdx = 1;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 1; i < fractions.length; i++) {
      acc += fractions[i - 1];
      const d = Math.abs(acc - boundedWithin);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private findSharedSplitOwners(kind: 'col' | 'row', sharedAbs: number): string[] {
    const table = this.getTableElement();
    const tableRect = this.getTableRect();
    if (!table || !tableRect) return [];
    const eps = this.sharedSplitBoundaryEpsilon;
    if (!Number.isFinite(sharedAbs)) return [];

    const grids = Array.from(table.querySelectorAll('.table-widget__split-grid')) as HTMLElement[];
    const out: string[] = [];

    for (const grid of grids) {
      const ownerLeafId = grid.getAttribute('data-owner-leaf');
      if (!ownerLeafId) continue;
      const owner = this.getCellModelByLeafId(ownerLeafId);
      if (!owner?.split) continue;

      // Only consider grids that have enough rows/cols for the boundary index.
      // The boundaryIndex itself is checked per owner when applying.

      const rect = grid.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) continue;

      // Estimate the closest abs boundary for this grid at the same within-grid fraction of the sharedAbs.
      // We do this by projecting sharedAbs into the grid and snapping to its nearest boundary.
      const within = kind === 'col'
        ? (sharedAbs * tableRect.width + tableRect.left - rect.left) / rect.width
        : (sharedAbs * tableRect.height + tableRect.top - rect.top) / rect.height;
      const boundedWithin = Math.max(0, Math.min(1, within));

      const boundaries = kind === 'col'
        ? this.getSplitColFractions(ownerLeafId, owner)
        : this.getSplitRowFractions(ownerLeafId, owner);

      // Convert fractions to boundary positions (excluding 0 and 1)
      const positions: number[] = [];
      let acc = 0;
      for (let i = 0; i < boundaries.length - 1; i++) {
        acc += boundaries[i];
        positions.push(acc);
      }

      const nearest = positions.reduce(
        (best, p) => {
          const d = Math.abs(p - boundedWithin);
          return d < best.d ? { p, d } : best;
        },
        { p: 0.5, d: Number.POSITIVE_INFINITY }
      );

      const absPx = kind === 'col'
        ? rect.left + nearest.p * rect.width
        : rect.top + nearest.p * rect.height;
      const abs = kind === 'col'
        ? (absPx - tableRect.left) / tableRect.width
        : (absPx - tableRect.top) / tableRect.height;

      if (Math.abs(abs - sharedAbs) <= eps) {
        out.push(ownerLeafId);
      }
    }

    return out;
  }

  private computeSharedAbsFromRect(kind: 'col' | 'row', gridRect: DOMRect, tableRect: DOMRect, within: number): number {
    if (kind === 'col') {
      const xPx = gridRect.left + within * gridRect.width;
      return Math.max(0, Math.min(1, (xPx - tableRect.left) / tableRect.width));
    }
    const yPx = gridRect.top + within * gridRect.height;
    return Math.max(0, Math.min(1, (yPx - tableRect.top) / tableRect.height));
  }

  private handleGridResizePointerMove = (event: PointerEvent): void => {
    if (!this.isResizingGrid || !this.activeGridResize) return;
    event.preventDefault();
    event.stopPropagation();

    const r = this.activeGridResize;
    const scale = r.zoomScale;

    if (r.kind === 'col') {
      const start = r.startFractions;
      const i = r.boundaryIndex;
      const leftIdx = i - 1;
      const rightIdx = i;
      const total = start[leftIdx] + start[rightIdx];

      const deltaScreen = event.clientX - r.startClientX;
      const deltaLayout = deltaScreen / scale;
      const deltaF = deltaLayout / r.tableWidthPx;

      const minFLeft = this.minColPx / r.tableWidthPx;
      const minFRight = this.minColPx / r.tableWidthPx;

      const clampedLeft = this.clamp(start[leftIdx] + deltaF, minFLeft, total - minFRight);
      const prefix = start.slice(0, Math.max(0, leftIdx)).reduce((a, b) => a + b, 0);
      const within = prefix + clampedLeft;
      this.ghostTopColPercent.set(Math.max(0, Math.min(100, within * 100)));
    } else {
      const start = r.startFractions;
      const i = r.boundaryIndex;
      const topIdx = i - 1;

      const deltaScreen = event.clientY - r.startClientY;
      const deltaLayout = deltaScreen / scale;

      // PPT-like row resize: only the row ABOVE the boundary changes; table height is committed on release.
      const oldTopPx = (start[topIdx] ?? 0) * r.tableHeightPx;
      const desiredTopPx = oldTopPx + deltaLayout;
      const minAllowedPx = Math.max(this.minRowPx, r.minTopRowHeightPx ?? this.minRowPx);
      const clampedTopPx = Math.max(minAllowedPx, desiredTopPx);

      const startWithin = start.slice(0, Math.max(0, i)).reduce((a, b) => a + b, 0);
      const startBoundaryPx = startWithin * r.tableHeightPx;
      const newBoundaryPx = startBoundaryPx + (clampedTopPx - oldTopPx);

      const pct = (newBoundaryPx / r.tableHeightPx) * 100;
      this.ghostTopRowPercent.set(Math.max(0, Math.min(100, pct)));
    }

    this.cdr.markForCheck();
  };

  private handleGridResizePointerUp = (event: PointerEvent): void => {
    if (!this.isResizingGrid || !this.activeGridResize) return;
    event.preventDefault();
    event.stopPropagation();

    const r = this.activeGridResize;
    const scale = r.zoomScale;

    if (r.kind === 'col') {
      const start = r.startFractions;
      const i = r.boundaryIndex;
      const leftIdx = i - 1;
      const rightIdx = i;
      const total = start[leftIdx] + start[rightIdx];

      const deltaScreen = event.clientX - r.startClientX;
      const deltaLayout = deltaScreen / scale;
      const deltaF = deltaLayout / r.tableWidthPx;

      const minFLeft = this.minColPx / r.tableWidthPx;
      const minFRight = this.minColPx / r.tableWidthPx;

      const next = [...start];
      const clampedLeft = this.clamp(start[leftIdx] + deltaF, minFLeft, total - minFRight);
      next[leftIdx] = clampedLeft;
      next[rightIdx] = total - clampedLeft;

      this.columnFractions.set(this.normalizeFractions(next, next.length));
      this.previewColumnFractions.set(null);

      // Persist (and later AutoFit) in a post-commit pass so we can keep this as one discrete action.
      this.schedulePostCommitTopColResizeWork();
    } else {
      const start = r.startFractions;
      const i = r.boundaryIndex;
      const topIdx = i - 1;

      const deltaScreen = event.clientY - r.startClientY;
      const deltaLayout = deltaScreen / scale;

      // PPT-like row resize: change the height of the row above the boundary and grow/shrink the widget height.
      const oldTopPx = (start[topIdx] ?? 0) * r.tableHeightPx;
      const desiredTopPx = oldTopPx + deltaLayout;
      const minAllowedPx = Math.max(this.minRowPx, r.minTopRowHeightPx ?? this.minRowPx);
      const clampedTopPx = Math.max(minAllowedPx, desiredTopPx);

      const appliedDeltaPx = clampedTopPx - oldTopPx;
      this.previewRowFractions.set(null);

      if (Number.isFinite(appliedDeltaPx) && Math.abs(appliedDeltaPx) > 0.1) {
        const oldRowHeightsPx = start.map((f) => f * r.tableHeightPx);
        const newTableHeightPx = Math.max(20, r.tableHeightPx + appliedDeltaPx);
        const newRowHeightsPx = [...oldRowHeightsPx];
        newRowHeightsPx[topIdx] = Math.max(0, oldTopPx + appliedDeltaPx);

        // Manual row resize should prevent live auto-fit from shrinking below the user's chosen height.
        this.setManualTopLevelRowMinHeightPx(topIdx, newRowHeightsPx[topIdx]);

        const next = newRowHeightsPx.map((px) => px / newTableHeightPx);
        this.rowFractions.set(this.normalizeFractions(next, next.length));

        // Adjust split row fractions so only the last subcell (B) changes, not A.
        // This ensures that when resizing the main row border, inner split subcells
        // maintain their pixel heights except for the bottom-most one.
        this.adjustSplitRowFractionsForTopLevelRowResize(topIdx, oldRowHeightsPx, appliedDeltaPx);

        // Update the widget size (draft + commit).
        this.growWidgetSizeBy(0, appliedDeltaPx);

        // Persist immediately (discrete sizing action).
        this.emitPropsChange(this.localRows());
      }
    }

    this.isResizingGrid = false;
    this.activeGridResize = null;
    this.teardownGridResizeListeners();
    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();
    this.restoreCaretAfterResize();
    this.clearGhosts();
  };

  private getTableRect(): DOMRect | null {
    const container = this.tableContainer?.nativeElement;
    if (!container) return null;
    const grid = container.querySelector('.table-widget__grid') as HTMLElement | null;
    return grid?.getBoundingClientRect() ?? null;
  }

  private getTableElement(): HTMLElement | null {
    const container = this.tableContainer?.nativeElement;
    if (!container) return null;
    return container.querySelector('.table-widget__grid') as HTMLElement | null;
  }

  private scheduleRecomputeResizeSegments(): void {
    if (this.resizeSegmentsRaf !== null) return;
    this.resizeSegmentsRaf = window.requestAnimationFrame(() => {
      this.resizeSegmentsRaf = null;
      this.recomputeResizeSegments();
    });
  }

  private recomputeResizeSegments(): void {
    const table = this.getTableElement();
    if (!table) {
      this.colResizeSegmentsSig.set([]);
      this.rowResizeSegmentsSig.set([]);
      return;
    }

    const tableRect = table.getBoundingClientRect();
    if (!Number.isFinite(tableRect.width) || !Number.isFinite(tableRect.height) || tableRect.width <= 0 || tableRect.height <= 0) {
      this.colResizeSegmentsSig.set([]);
      this.rowResizeSegmentsSig.set([]);
      return;
    }

    const rowsModel = this.localRows();
    const rowCount = this.getTopLevelRowCount(rowsModel);
    const colCount = this.getTopLevelColCount(rowsModel);
    if (rowCount <= 0 || colCount <= 0) {
      this.colResizeSegmentsSig.set([]);
      this.rowResizeSegmentsSig.set([]);
      return;
    }

    // Gather rendered top-level cell geometry so we can measure real boundaries (accounts for layout rounding).
    const tdNodes = Array.from(
      table.querySelectorAll('.table-widget__cell[data-cell]')
    ) as HTMLElement[];

    type CellGeom = {
      startRow: number;
      endRow: number;
      startCol: number;
      endCol: number;
      rect: DOMRect;
    };

    const geoms: CellGeom[] = [];
    for (const td of tdNodes) {
      const id = td.getAttribute('data-cell');
      if (!id) continue;
      const parts = id.split('-');
      if (parts.length !== 2) continue;
      const r = Number(parts[0]);
      const c = Number(parts[1]);
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
      const cell = rowsModel?.[r]?.cells?.[c];
      if (!cell) continue;

      const colSpan = Math.max(1, cell.merge?.colSpan ?? 1);
      const rowSpan = Math.max(1, cell.merge?.rowSpan ?? 1);
      const rect = td.getBoundingClientRect();
      geoms.push({
        startRow: r,
        endRow: Math.min(rowCount, r + rowSpan),
        startCol: c,
        endCol: Math.min(colCount, c + colSpan),
        rect,
      });
    }

    const median = (nums: number[]): number | null => {
      const cleaned = nums.filter((n) => Number.isFinite(n));
      if (cleaned.length === 0) return null;
      cleaned.sort((a, b) => a - b);
      return cleaned[Math.floor(cleaned.length / 2)];
    };

    const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
    const toXPct = (xPx: number): number => clamp01((xPx - tableRect.left) / tableRect.width) * 100;
    const toYPct = (yPx: number): number => clamp01((yPx - tableRect.top) / tableRect.height) * 100;

    // Boundary positions in px from DOM (preferred) with a sane fallback.
    const xBoundaryPx: number[] = new Array(colCount + 1).fill(0);
    xBoundaryPx[0] = tableRect.left;
    xBoundaryPx[colCount] = tableRect.right;
    for (let i = 1; i < colCount; i++) {
      const candidates: number[] = [];
      for (const g of geoms) {
        if (g.endCol === i) candidates.push(g.rect.right);
        if (g.startCol === i) candidates.push(g.rect.left);
      }
      xBoundaryPx[i] = median(candidates) ?? (tableRect.left + (i / colCount) * tableRect.width);
    }

    const yBoundaryPx: number[] = new Array(rowCount + 1).fill(0);
    yBoundaryPx[0] = tableRect.top;
    yBoundaryPx[rowCount] = tableRect.bottom;
    for (let i = 1; i < rowCount; i++) {
      const candidates: number[] = [];
      for (const g of geoms) {
        if (g.endRow === i) candidates.push(g.rect.bottom);
        if (g.startRow === i) candidates.push(g.rect.top);
      }
      yBoundaryPx[i] = median(candidates) ?? (tableRect.top + (i / rowCount) * tableRect.height);
    }

    const anchorKey = (r: number, c: number): string => {
      const cell = rowsModel?.[r]?.cells?.[c];
      if (!cell) return `${r}-${c}`;
      if (cell.coveredBy) return `${cell.coveredBy.row}-${cell.coveredBy.col}`;
      return `${r}-${c}`;
    };

    // Column boundary segments (split by row stripes). Hidden everywhere => no handle (per requirement).
    const colSegments: ColResizeSegment[] = [];
    for (let boundaryIndex = 1; boundaryIndex < colCount; boundaryIndex++) {
      let segStartRow: number | null = null;
      for (let r = 0; r < rowCount; r++) {
        const hasBorder = anchorKey(r, boundaryIndex - 1) !== anchorKey(r, boundaryIndex);
        if (hasBorder) {
          if (segStartRow === null) segStartRow = r;
        } else if (segStartRow !== null) {
          const segEndRow = r - 1;
          const topPx = yBoundaryPx[segStartRow];
          const bottomPx = yBoundaryPx[segEndRow + 1];
          colSegments.push({
            boundaryIndex,
            leftPercent: toXPct(xBoundaryPx[boundaryIndex]),
            topPercent: toYPct(topPx),
            heightPercent: clamp01((bottomPx - topPx) / tableRect.height) * 100,
          });
          segStartRow = null;
        }
      }
      if (segStartRow !== null) {
        const segEndRow = rowCount - 1;
        const topPx = yBoundaryPx[segStartRow];
        const bottomPx = yBoundaryPx[segEndRow + 1];
        colSegments.push({
          boundaryIndex,
          leftPercent: toXPct(xBoundaryPx[boundaryIndex]),
          topPercent: toYPct(topPx),
          heightPercent: clamp01((bottomPx - topPx) / tableRect.height) * 100,
        });
      }
    }

    // Row boundary segments (split by column stripes). Hidden everywhere => no handle (per requirement).
    const rowSegments: RowResizeSegment[] = [];
    for (let boundaryIndex = 1; boundaryIndex < rowCount; boundaryIndex++) {
      let segStartCol: number | null = null;
      for (let c = 0; c < colCount; c++) {
        const hasBorder = anchorKey(boundaryIndex - 1, c) !== anchorKey(boundaryIndex, c);
        if (hasBorder) {
          if (segStartCol === null) segStartCol = c;
        } else if (segStartCol !== null) {
          const segEndCol = c - 1;
          const leftPx = xBoundaryPx[segStartCol];
          const rightPx = xBoundaryPx[segEndCol + 1];
          rowSegments.push({
            boundaryIndex,
            topPercent: toYPct(yBoundaryPx[boundaryIndex]),
            leftPercent: toXPct(leftPx),
            widthPercent: clamp01((rightPx - leftPx) / tableRect.width) * 100,
          });
          segStartCol = null;
        }
      }
      if (segStartCol !== null) {
        const segEndCol = colCount - 1;
        const leftPx = xBoundaryPx[segStartCol];
        const rightPx = xBoundaryPx[segEndCol + 1];
        rowSegments.push({
          boundaryIndex,
          topPercent: toYPct(yBoundaryPx[boundaryIndex]),
          leftPercent: toXPct(leftPx),
          widthPercent: clamp01((rightPx - leftPx) / tableRect.width) * 100,
        });
      }
    }

    this.colResizeSegmentsSig.set(colSegments);
    this.rowResizeSegmentsSig.set(rowSegments);

    // Also compute continuous overlays for split-grid boundaries that align across multiple parents.
    this.recomputeSharedSplitResizeSegments(table, tableRect);

    this.cdr.markForCheck();
  }

  private recomputeSharedSplitResizeSegments(table: HTMLElement, tableRect: DOMRect): void {
    const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
    const toXPct = (xPx: number): number => clamp01((xPx - tableRect.left) / tableRect.width) * 100;
    const toYPct = (yPx: number): number => clamp01((yPx - tableRect.top) / tableRect.height) * 100;

    const grids = Array.from(table.querySelectorAll('.table-widget__split-grid')) as HTMLElement[];
    if (grids.length === 0) {
      this.sharedSplitColSegmentsSig.set([]);
      this.sharedSplitRowSegmentsSig.set([]);
      return;
    }

    type BoundarySample = {
      kind: 'col' | 'row';
      boundaryAbs: number;
      rect: DOMRect;
      ownerLeafId: string;
    };

    const samples: BoundarySample[] = [];
    for (const grid of grids) {
      const ownerLeafId = grid.getAttribute('data-owner-leaf');
      if (!ownerLeafId) continue;
      const owner = this.getCellModelByLeafId(ownerLeafId);
      if (!owner?.split) continue;
      const rect = grid.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) continue;

      // collect vertical boundaries (columns)
      const colF = this.getSplitColFractions(ownerLeafId, owner);
      if (colF.length > 1) {
        let acc = 0;
        for (let i = 0; i < colF.length - 1; i++) {
          acc += colF[i];
          const abs = this.computeSharedAbsFromRect('col', rect, tableRect, acc);
          samples.push({ kind: 'col', boundaryAbs: abs, rect, ownerLeafId });
        }
      }

      const rowF = this.getSplitRowFractions(ownerLeafId, owner);
      if (rowF.length > 1) {
        let acc = 0;
        for (let i = 0; i < rowF.length - 1; i++) {
          acc += rowF[i];
          const abs = this.computeSharedAbsFromRect('row', rect, tableRect, acc);
          samples.push({ kind: 'row', boundaryAbs: abs, rect, ownerLeafId });
        }
      }
    }

    const eps = this.sharedSplitBoundaryEpsilon;
    const groupKey = (abs: number): number => Math.round(abs / eps);

    const colGroups = new Map<number, BoundarySample[]>();
    const rowGroups = new Map<number, BoundarySample[]>();
    for (const s of samples) {
      const key = groupKey(s.boundaryAbs);
      const m = s.kind === 'col' ? colGroups : rowGroups;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }

    const buildColSegments = (): SharedSplitColSegment[] => {
      const out: SharedSplitColSegment[] = [];
      for (const [, group] of colGroups) {
        if (group.length < 2) continue; // only if shared by multiple grids

        const boundaryAbs = group.reduce((a, b) => a + b.boundaryAbs, 0) / group.length;
        const xPx = tableRect.left + boundaryAbs * tableRect.width;

        // Merge overlapping vertical spans from all contributing grids
        const spans = group
          .map((g) => ({ top: g.rect.top, bottom: g.rect.bottom }))
          .sort((a, b) => a.top - b.top);

        let cur = spans[0];
        for (let i = 1; i < spans.length; i++) {
          const s = spans[i];
          if (s.top <= cur.bottom + 1) {
            cur.bottom = Math.max(cur.bottom, s.bottom);
          } else {
            out.push({
              boundaryAbs,
              leftPercent: toXPct(xPx),
              topPercent: toYPct(cur.top),
              heightPercent: clamp01((cur.bottom - cur.top) / tableRect.height) * 100,
            });
            cur = s;
          }
        }
        out.push({
          boundaryAbs,
          leftPercent: toXPct(xPx),
          topPercent: toYPct(cur.top),
          heightPercent: clamp01((cur.bottom - cur.top) / tableRect.height) * 100,
        });
      }
      return out;
    };

    const buildRowSegments = (): SharedSplitRowSegment[] => {
      const out: SharedSplitRowSegment[] = [];
      for (const [, group] of rowGroups) {
        if (group.length < 2) continue;

        const boundaryAbs = group.reduce((a, b) => a + b.boundaryAbs, 0) / group.length;
        const yPx = tableRect.top + boundaryAbs * tableRect.height;

        const spans = group
          .map((g) => ({ left: g.rect.left, right: g.rect.right }))
          .sort((a, b) => a.left - b.left);

        let cur = spans[0];
        for (let i = 1; i < spans.length; i++) {
          const s = spans[i];
          if (s.left <= cur.right + 1) {
            cur.right = Math.max(cur.right, s.right);
          } else {
            out.push({
              boundaryAbs,
              topPercent: toYPct(yPx),
              leftPercent: toXPct(cur.left),
              widthPercent: clamp01((cur.right - cur.left) / tableRect.width) * 100,
            });
            cur = s;
          }
        }
        out.push({
          boundaryAbs,
          topPercent: toYPct(yPx),
          leftPercent: toXPct(cur.left),
          widthPercent: clamp01((cur.right - cur.left) / tableRect.width) * 100,
        });
      }
      return out;
    };

    this.sharedSplitColSegmentsSig.set(buildColSegments());
    this.sharedSplitRowSegmentsSig.set(buildRowSegments());
  }

  onSharedSplitColResizePointerDown(event: PointerEvent, boundaryAbs: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    this.cancelAutoFitAfterColResize();
    this.clearGhosts();
    this.captureCaretForResize();
    this.syncCellContent();

    const owners = this.findSharedSplitOwners('col', boundaryAbs);
    if (owners.length === 0) return;

    // Pick the first owner as the active anchor for boundary index + container sizing.
    const ownerLeafId = owners[0];
    const owner = this.getCellModelByLeafId(ownerLeafId);
    if (!owner?.split) return;

    // Determine the closest boundary index for this owner.
    const f = this.getSplitColFractions(ownerLeafId, owner);
    if (f.length <= 1) return;
    let acc = 0;
    let bestIdx = 1;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 1; i < f.length; i++) {
      acc += f[i - 1];
      const d = Math.abs(acc - 0.5); // placeholder
      // We'll infer within by projecting boundaryAbs to within of this grid below.
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }

    const table = this.getTableElement();
    if (!table) return;
    const gridEl = table.querySelector(`.table-widget__split-grid[data-owner-leaf="${ownerLeafId}"]`) as HTMLElement | null;
    if (!gridEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const tableRect = this.getTableRect();
    if (!tableRect) return;

    // Compute within and nearest boundary index properly.
    const within = (boundaryAbs * tableRect.width + tableRect.left - gridRect.left) / gridRect.width;
    const boundedWithin = Math.max(0, Math.min(1, within));
    acc = 0;
    bestIdx = 1;
    bestD = Number.POSITIVE_INFINITY;
    for (let i = 1; i < f.length; i++) {
      acc += f[i - 1];
      const d = Math.abs(acc - boundedWithin);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const containerWidthPx = Math.max(1, gridRect.width / zoomScale);
    const containerHeightPx = Math.max(1, gridRect.height / zoomScale);
    const tableWidthPx = Math.max(1, tableRect.width / zoomScale);
    const tableHeightPx = Math.max(1, tableRect.height / zoomScale);

    const ownerW = new Map<string, number>();
    const ownerH = new Map<string, number>();
    for (const id of owners) {
      const gridEl2 = table.querySelector(`.table-widget__split-grid[data-owner-leaf="${id}"]`) as HTMLElement | null;
      if (!gridEl2) continue;
      const rr = gridEl2.getBoundingClientRect();
      ownerW.set(id, Math.max(1, rr.width / zoomScale));
      ownerH.set(id, Math.max(1, rr.height / zoomScale));
    }

    const boundaryIndexMap = new Map<string, number>();
    for (const id of owners) {
      const m = this.getCellModelByLeafId(id);
      if (!m?.split) continue;
      const idx = this.computeOwnerBoundaryIndexForSharedAbs('col', id, m, boundaryAbs);
      const count = Math.max(1, m.split.cols);
      if (idx === null || idx <= 0 || idx >= count) continue;
      boundaryIndexMap.set(id, idx);
    }

    this.isResizingSplitGrid = true;
    this.activeSplitResize = {
      kind: 'col',
      ownerLeafId,
      boundaryIndex: boundaryIndexMap.get(ownerLeafId) ?? bestIdx,
      sharedBoundaryAbs: boundaryAbs,
      startSharedBoundaryAbs: boundaryAbs,
      tableWidthPx,
      tableHeightPx,
      ownerContainerWidthPx: ownerW,
      ownerContainerHeightPx: ownerH,
      ownerBoundaryIndexMap: boundaryIndexMap,
      sharedOwnerLeafIds: owners,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...f],
      containerWidthPx,
      containerHeightPx,
      zoomScale,
    };

    // Initialize ghosts: shared continuous line + per-owner within-grid ghost.
    this.ghostSharedSplitColPercent.set(this.clamp(boundaryAbs, 0, 1) * 100);
    const ghostMap = new Map(this.ghostSplitColWithinPercent());
    for (const id of owners) {
      const m = this.getCellModelByLeafId(id);
      const count = Math.max(1, m?.split?.cols ?? 0);
      const idx = boundaryIndexMap.get(id) ?? bestIdx;
      if (!m?.split || idx <= 0 || idx >= count) continue;
      const ff = this.getSplitColFractions(id, m);
      const within2 = ff.slice(0, Math.max(0, idx)).reduce((a, b) => a + b, 0);
      ghostMap.set(id, Math.max(0, Math.min(100, within2 * 100)));
    }
    this.ghostSplitColWithinPercent.set(ghostMap);

    this.installSplitResizeListeners();
  }

  onSharedSplitRowResizePointerDown(event: PointerEvent, boundaryAbs: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

    this.cancelAutoFitAfterColResize();
    this.clearGhosts();
    this.captureCaretForResize();
    this.syncCellContent();

    const owners = this.findSharedSplitOwners('row', boundaryAbs);
    if (owners.length === 0) return;

    const ownerLeafId = owners[0];
    const owner = this.getCellModelByLeafId(ownerLeafId);
    if (!owner?.split) return;

    const f = this.getSplitRowFractions(ownerLeafId, owner);
    if (f.length <= 1) return;

    const table = this.getTableElement();
    if (!table) return;
    const gridEl = table.querySelector(`.table-widget__split-grid[data-owner-leaf="${ownerLeafId}"]`) as HTMLElement | null;
    if (!gridEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const tableRect = this.getTableRect();
    if (!tableRect) return;

    const within = (boundaryAbs * tableRect.height + tableRect.top - gridRect.top) / gridRect.height;
    const boundedWithin = Math.max(0, Math.min(1, within));

    let acc = 0;
    let bestIdx = 1;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 1; i < f.length; i++) {
      acc += f[i - 1];
      const d = Math.abs(acc - boundedWithin);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const containerWidthPx = Math.max(1, gridRect.width / zoomScale);
    const containerHeightPx = Math.max(1, gridRect.height / zoomScale);
    const tableWidthPx = Math.max(1, tableRect.width / zoomScale);
    const tableHeightPx = Math.max(1, tableRect.height / zoomScale);

    const ownerW = new Map<string, number>();
    const ownerH = new Map<string, number>();
    for (const id of owners) {
      const gridEl2 = table.querySelector(`.table-widget__split-grid[data-owner-leaf="${id}"]`) as HTMLElement | null;
      if (!gridEl2) continue;
      const rr = gridEl2.getBoundingClientRect();
      ownerW.set(id, Math.max(1, rr.width / zoomScale));
      ownerH.set(id, Math.max(1, rr.height / zoomScale));
    }

    const boundaryIndexMap = new Map<string, number>();
    for (const id of owners) {
      const m = this.getCellModelByLeafId(id);
      if (!m?.split) continue;
      const idx = this.computeOwnerBoundaryIndexForSharedAbs('row', id, m, boundaryAbs);
      const count = Math.max(1, m.split.rows);
      if (idx === null || idx <= 0 || idx >= count) continue;
      boundaryIndexMap.set(id, idx);
    }

    this.isResizingSplitGrid = true;
    this.activeSplitResize = {
      kind: 'row',
      ownerLeafId,
      boundaryIndex: boundaryIndexMap.get(ownerLeafId) ?? bestIdx,
      sharedBoundaryAbs: boundaryAbs,
      startSharedBoundaryAbs: boundaryAbs,
      tableWidthPx,
      tableHeightPx,
      ownerContainerWidthPx: ownerW,
      ownerContainerHeightPx: ownerH,
      ownerBoundaryIndexMap: boundaryIndexMap,
      sharedOwnerLeafIds: owners,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...f],
      containerWidthPx,
      containerHeightPx,
      zoomScale,
    };

    // Content-based min constraints for this split-row boundary (per owner).
    const minTopPxByOwner = new Map<string, number>();
    const minBottomPxByOwner = new Map<string, number>();
    for (const id of owners) {
      const m = this.getCellModelByLeafId(id);
      if (!m?.split) continue;
      const idx = boundaryIndexMap.get(id) ?? bestIdx;
      const count = Math.max(1, m.split.rows);
      if (idx <= 0 || idx >= count) continue;
      const h = ownerH.get(id) ?? containerHeightPx;
      const res = this.computeMinSplitAdjacentRowHeightsPx(id, m, idx, h, zoomScale);
      minTopPxByOwner.set(id, res.minTopPx);
      minBottomPxByOwner.set(id, res.minBottomPx);
    }
    if (this.activeSplitResize) {
      this.activeSplitResize.ownerMinSplitRowTopPx = minTopPxByOwner;
      this.activeSplitResize.ownerMinSplitRowBottomPx = minBottomPxByOwner;
    }

    this.ghostSharedSplitRowPercent.set(this.clamp(boundaryAbs, 0, 1) * 100);
    const ghostMap = new Map(this.ghostSplitRowWithinPercent());
    for (const id of owners) {
      const m = this.getCellModelByLeafId(id);
      const count = Math.max(1, m?.split?.rows ?? 0);
      const idx = boundaryIndexMap.get(id) ?? bestIdx;
      if (!m?.split || idx <= 0 || idx >= count) continue;
      const ff = this.getSplitRowFractions(id, m);
      const within2 = ff.slice(0, Math.max(0, idx)).reduce((a, b) => a + b, 0);
      ghostMap.set(id, Math.max(0, Math.min(100, within2 * 100)));
    }
    this.ghostSplitRowWithinPercent.set(ghostMap);

    this.installSplitResizeListeners();
  }

  private initializeFractionsFromProps(): void {
    const rows = this.localRows();
    const rowCount = this.getTopLevelRowCount(rows);
    const colCount = this.getTopLevelColCount(rows);

    const rawCols = this.tableProps.columnFractions ?? [];
    const rawRows = this.tableProps.rowFractions ?? [];

    // Preserve raw fractions for URL-based tables imported from JSON (placeholder rows mismatch),
    // so we can re-apply them once the real data loads.
    this.pendingPropsColumnFractions =
      Array.isArray(rawCols) && rawCols.length > 0 && rawCols.length !== colCount ? [...rawCols] : null;
    this.pendingPropsRowFractions =
      Array.isArray(rawRows) && rawRows.length > 0 && rawRows.length !== rowCount ? [...rawRows] : null;

    const nextCols = this.normalizeFractions(rawCols, colCount);
    const nextRows = this.normalizeFractions(rawRows, rowCount);

    this.columnFractions.set(nextCols);
    this.rowFractions.set(nextRows);
  }

  private getTopLevelRowCount(rows: TableRow[]): number {
    return Math.max(1, rows.length);
  }

  private getTopLevelColCount(rows: TableRow[]): number {
    const first = rows?.[0];
    return Math.max(1, first?.cells?.length ?? 1);
  }

  private normalizeFractions(input: number[], count: number): number[] {
    const n = Math.max(1, Math.trunc(count));
    if (!Array.isArray(input) || input.length !== n) {
      return Array.from({ length: n }, () => 1 / n);
    }

    const cleaned = input.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
    const sum = cleaned.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      return Array.from({ length: n }, () => 1 / n);
    }
    return cleaned.map((x) => x / sum);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  private emitPropsChange(rows: TableRow[]): void {
    this.propsChange.emit({
      rows,
      mergedRegions: [],
      columnFractions: this.normalizeFractions(this.columnFractions(), this.getTopLevelColCount(rows)),
      rowFractions: this.normalizeFractions(this.rowFractions(), this.getTopLevelRowCount(rows)),
    });
  }

  onRetryLoad(): void {
    if (!this.canRetry || !this.widget) return;
    const dataSource = this.tableProps.dataSource;
    if (!dataSource || dataSource.kind !== 'http') return;

    // Clear error state
    this.propsChange.emit({
      errorMessage: undefined,
    });

    // The widget container will trigger reload via remoteAutoLoad.maybeAutoLoad
    // when it detects the widget has a dataSource but no data/error
    // For now, we'll trigger it directly by clearing the session key and re-checking
    const widgetEntity = this.widget as any;
    const pageId = widgetEntity.pageId;
    if (pageId) {
      // Reset session so it can retry
      this.remoteAutoLoad.resetSession();
      // Manually trigger reload
      this.remoteAutoLoad.maybeAutoLoad(widgetEntity, pageId);
    }
  }

  /**
   * Get the cursor offset as a character count from the start of the element's text content.
   * Returns null if there's no valid selection within the element.
   */
  private getCursorOffsetInElement(el: HTMLElement | null): number | null {
    if (!el) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    // Ensure the selection is within this element.
    if (!el.contains(range.commonAncestorContainer)) return null;

    // Create a range from the start of the element to the cursor position.
    const preCaretRange = document.createRange();
    preCaretRange.selectNodeContents(el);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    // The length of the text content in this range gives us the cursor offset.
    return preCaretRange.toString().length;
  }

  /**
   * Set the cursor position in an element to a specific character offset.
   * If the offset exceeds the content length, the cursor is placed at the end.
   */
  private setCursorOffsetInElement(el: HTMLElement, offset: number): void {
    const textLength = (el.textContent ?? '').length;
    const targetOffset = Math.max(0, Math.min(offset, textLength));

    const sel = window.getSelection();
    if (!sel) return;

    // Walk the DOM tree to find the text node and offset for the target character position.
    const result = this.findNodeAndOffsetForCharOffset(el, targetOffset);
    if (!result) {
      // Fallback: place cursor at the end.
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); // Collapse to end.
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    const range = document.createRange();
    range.setStart(result.node, result.offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Walk the element's descendants to find the text node and offset corresponding to a character offset.
   */
  private findNodeAndOffsetForCharOffset(
    root: Node,
    targetOffset: number
  ): { node: Node; offset: number } | null {
    let currentOffset = 0;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node: Text | null = walker.nextNode() as Text | null;

    while (node) {
      const nodeLength = node.length;
      if (currentOffset + nodeLength >= targetOffset) {
        return { node, offset: targetOffset - currentOffset };
      }
      currentOffset += nodeLength;
      node = walker.nextNode() as Text | null;
    }

    // If we ran out of nodes, return the last position available.
    // This can happen if targetOffset >= total text length.
    return null;
  }

  /**
   * Place cursor at the end of the element's content.
   */
  private setCursorAtEnd(el: HTMLElement): void {
    const sel = window.getSelection();
    if (!sel) return;

    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false); // Collapse to end.
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

