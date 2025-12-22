import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EffectRef,
  EventEmitter,
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
} from '@angular/core';
import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';

import {
  TableWidgetProps,
  TableRow,
  TableCell,
  TableMergedRegion,
  TableCellStyle,
  WidgetModel,
} from '../../../../models/widget.model';
import {
  CellBorderRequest,
  SplitCellRequest,
  TableInsertRequest,
  TableToolbarService,
} from '../../../../core/services/table-toolbar.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { PendingChangesRegistry, FlushableWidget } from '../../../../core/services/pending-changes-registry.service';
import { DraftStateService } from '../../../../core/services/draft-state.service';

type ColResizeSegment = { boundaryIndex: number; leftPercent: number; topPercent: number; heightPercent: number };
type RowResizeSegment = { boundaryIndex: number; topPercent: number; leftPercent: number; widthPercent: number };

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
})
export class TableWidgetComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy, FlushableWidget {
  private readonly maxSplitDepth = 4;
  private readonly minColPx = 40;
  private readonly minRowPx = 24;
  // Split sub-cells can be smaller than top-level table cells.
  private readonly minSplitColPx = 24;
  private readonly minSplitRowPx = 18;

  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<TableWidgetProps>>();

  @ViewChild('tableContainer', { static: false }) tableContainer?: ElementRef<HTMLElement>;

  private readonly toolbarService = inject(TableToolbarService);
  private readonly uiState = inject(UIStateService);
  private readonly pendingChangesRegistry = inject(PendingChangesRegistry);
  private readonly draftState = inject(DraftStateService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Local copy of rows during editing */
  private readonly localRows = signal<TableRow[]>([]);

  /** Persisted sizing state (fractions that sum to 1) */
  private readonly columnFractions = signal<number[]>([]);
  private readonly rowFractions = signal<number[]>([]);

  /** Live preview during resize drag */
  private readonly previewColumnFractions = signal<number[] | null>(null);
  private readonly previewRowFractions = signal<number[] | null>(null);

  // ============================================
  // Segmented resize handles (gap-aware)
  // ============================================

  private readonly colResizeSegmentsSig = signal<ColResizeSegment[]>([]);
  private readonly rowResizeSegmentsSig = signal<RowResizeSegment[]>([]);

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
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startFractions: number[];
        containerWidthPx: number; // unscaled layout px
        containerHeightPx: number; // unscaled layout px
        zoomScale: number; // 1.0 = 100%
      }
    | null = null;

  private readonly previewSplitColFractions = signal<Map<string, number[]>>(new Map());
  private readonly previewSplitRowFractions = signal<Map<string, number[]>>(new Map());
  
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

  private splitSubscription?: Subscription;
  private mergeSubscription?: Subscription;
  private insertSubscription?: Subscription;
  private textAlignSubscription?: Subscription;
  private verticalAlignSubscription?: Subscription;
  private cellBackgroundSubscription?: Subscription;
  private cellBorderSubscription?: Subscription;
  private fontFamilySubscription?: Subscription;
  private fontSizeSubscription?: Subscription;
  private formatPainterSubscription?: Subscription;

  /** One-shot format painter state (cell-level only) */
  private formatPainterArmed = false;
  private formatPainterBaselineSelection: Set<string> = new Set();
  private formatPainterBaselineActiveCellId: string | null = null;

  /** Multi-cell selection state */
  private readonly selectedCells = signal<Set<string>>(new Set());
  private isSelecting = false;
  private selectionMode: 'table' | 'leafRect' | null = null;
  private selectionStart: { row: number; col: number } | null = null;
  private selectionEnd: { row: number; col: number } | null = null;
  private leafRectStart: { x: number; y: number } | null = null;
  private tableRectStart: { x: number; y: number } | null = null;

  get editing(): boolean {
    return this.isActivelyEditing();
  }

  get tableProps(): TableWidgetProps {
    return this.widget.props as TableWidgetProps;
  }

  get rows(): TableRow[] {
    return this.localRows();
  }

  get colFractions(): number[] {
    const cols = this.getTopLevelColCount(this.localRows());
    const current = this.previewColumnFractions() ?? this.columnFractions();
    return this.normalizeFractions(current, cols);
  }

  get rowFractionsView(): number[] {
    const rows = this.getTopLevelRowCount(this.localRows());
    const current = this.previewRowFractions() ?? this.rowFractions();
    return this.normalizeFractions(current, rows);
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
  }

  ngOnInit(): void {
    const initialRows = this.cloneRows(this.tableProps.rows);
    const migrated = this.migrateLegacyMergedRegions(initialRows, this.tableProps.mergedRegions ?? []);
    this.localRows.set(migrated);
    this.initializeFractionsFromProps();
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

    this.formatPainterSubscription = this.toolbarService.formatPainterRequested$.subscribe((enabled) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }

      if (!enabled) {
        this.formatPainterArmed = false;
        this.formatPainterBaselineSelection = new Set();
        this.formatPainterBaselineActiveCellId = null;
        return;
      }

      const sourceLeafId =
        this.activeCellId ??
        (this.selectedCells().size > 0 ? Array.from(this.selectedCells())[0] : null);

      const sourceCell = sourceLeafId ? this.getCellModelByLeafId(sourceLeafId) : null;
      const capturedStyle: Partial<TableCellStyle> = {
        textAlign: sourceCell?.style?.textAlign ?? 'left',
        verticalAlign: sourceCell?.style?.verticalAlign ?? 'top',
        fontFamily: sourceCell?.style?.fontFamily ?? '',
        fontSizePx: sourceCell?.style?.fontSizePx ?? undefined,
        backgroundColor: sourceCell?.style?.backgroundColor ?? '',
        borderColor: sourceCell?.style?.borderColor,
        borderWidth: sourceCell?.style?.borderWidth,
        borderStyle: sourceCell?.style?.borderStyle,
      };

      this.toolbarService.setFormatPainterStyle(capturedStyle);
      this.formatPainterArmed = true;
      this.formatPainterBaselineSelection = new Set(this.selectedCells());
      this.formatPainterBaselineActiveCellId = this.activeCellId;
    });

    // Compute initial resize segments once the table is painted (RAF).
    this.scheduleRecomputeResizeSegments();
  }

  ngAfterViewInit(): void {
    // Recompute after view is laid out (also handles cases where ngOnInit RAF ran before table existed).
    this.scheduleRecomputeResizeSegments();

    // Recompute on actual table size changes.
    const table = this.getTableElement();
    if (table && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleRecomputeResizeSegments();
      });
      this.resizeObserver.observe(table);
    }
  }

  ngOnDestroy(): void {
    if (this.isActivelyEditing()) {
      this.commitChanges();
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
    if (this.formatPainterSubscription) {
      this.formatPainterSubscription.unsubscribe();
    }
    
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    this.teardownGridResizeListeners();
    this.teardownSplitResizeListeners();

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
    
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }
    
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.toolbarService.clearActiveCell();
      this.toolbarService.setSelectedCellsGetter(null);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !this.isActivelyEditing()) {
      const nextRows = this.cloneRows(this.tableProps.rows);
      const migrated = this.migrateLegacyMergedRegions(nextRows, this.tableProps.mergedRegions ?? []);
      this.localRows.set(migrated);
      this.initializeFractionsFromProps();
      this.scheduleRecomputeResizeSegments();
    }
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
      
      this.syncCellContent();
      this.commitChanges();
      
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

  onCellFocus(event: FocusEvent, rowIndex: number, cellIndex: number, leafPath?: string): void {
    const cell = event.target as HTMLElement;
    this.activeCellElement = cell;
    this.activeCellId = leafPath ? this.composeLeafId(rowIndex, cellIndex, leafPath) : `${rowIndex}-${cellIndex}`;
    
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
  }

  onCellBlur(event: FocusEvent, rowIndex: number, cellIndex: number, leafPath?: string): void {
    if (!this.isActivelyEditing()) {
      return;
    }
    
    // Sync the content from the blurred cell
    this.syncCellContent();
    
    this.blurTimeoutId = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const toolbarElement = document.querySelector('app-table-toolbar');
      
      const isStillInsideTable = activeElement && 
        this.tableContainer?.nativeElement?.contains(activeElement);
      const isStillInsideToolbar = activeElement && 
        toolbarElement?.contains(activeElement);
      
      if (!isStillInsideTable && !isStillInsideToolbar) {
        this.commitChanges();
        
        this.isActivelyEditing.set(false);
        this.editingChange.emit(false);
        this.activeCellElement = null;
        this.activeCellId = null;
        
        this.toolbarService.clearActiveCell();
        this.pendingChangesRegistry.unregister(this.widget.id);
      }
      
      this.blurTimeoutId = null;
    }, 150);
  }

  onCellInput(event: Event, rowIndex: number, cellIndex: number, leafPath?: string): void {
    // Content is synced on blur to avoid frequent updates
    this.cdr.markForCheck();
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
          .querySelector(`[data-cell="${nextRowIndex}-${nextCellIndex}"] .table-widget__cell-content`) as HTMLElement;
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

  private getSplitColFractions(ownerLeafId: string, cell: TableCell): number[] {
    if (!cell.split) return [];
    const cols = Math.max(1, cell.split.cols);
    const preview = this.previewSplitColFractions().get(ownerLeafId);
    const current = preview ?? cell.split.columnFractions ?? [];
    return this.normalizeFractions(current, cols);
  }

  private getSplitRowFractions(ownerLeafId: string, cell: TableCell): number[] {
    if (!cell.split) return [];
    const rows = Math.max(1, cell.split.rows);
    const preview = this.previewSplitRowFractions().get(ownerLeafId);
    const current = preview ?? cell.split.rowFractions ?? [];
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

    if (this.tableContainer?.nativeElement && !isInsideTable && !isInsideToolbar && !isInsideColorPicker) {
      this.clearSelection();
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

    if (this.formatPainterArmed && this.toolbarService.formatPainterActive() && this.toolbarService.activeTableWidgetId === this.widget.id) {
      const captured = this.toolbarService.getFormatPainterStyle();
      if (captured) {
        const currentSelection = this.selectedCells();
        const targetSelectionIsUsed = currentSelection.size > 0 || this.formatPainterBaselineSelection.size > 0;
        const targetChanged = targetSelectionIsUsed
          ? !this.setEquals(currentSelection, this.formatPainterBaselineSelection)
          : (this.activeCellId !== this.formatPainterBaselineActiveCellId);

        const hasTarget = currentSelection.size > 0 || !!this.activeCellId;

        if (targetChanged && hasTarget) {
          // Apply to current selection/cell and then auto-disable (one-shot).
          this.applyStyleToSelection(captured);
          this.formatPainterArmed = false;
          this.formatPainterBaselineSelection = new Set();
          this.formatPainterBaselineActiveCellId = null;
          this.toolbarService.clearFormatPainter();
        }
      }
    }

    // Debug: log final selection on mouseup for active table widget
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.logSelectedCells('mouseUp');
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

    // NOTE:
    // We intentionally DO NOT early-return when a contenteditable inside this cell is focused.
    // Previously, we returned to "allow text selection by dragging", but that caused two UX bugs:
    // - Clicking different sub-cells inside the same split parent kept the previous leaf id selected/logged.
    // - If a cell was in edit mode, you couldn't start cell-selection dragging from that cell.
    // This table widget behaves more like a spreadsheet: dragging selects cells (not text).

    // Mark this table widget as active for toolbar actions (even if no contenteditable is focused)
    this.toolbarService.setActiveCell(this.activeCellElement, this.widget.id);

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
        `.table-widget__cell-content[data-leaf="${leafId}"]`
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
    this.cdr.markForCheck();
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
    const leafEl = (element as HTMLElement).closest('.table-widget__cell-content[data-leaf]') as HTMLElement | null;
    return leafEl?.getAttribute('data-leaf') ?? null;
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
    const leaves = container.querySelectorAll('.table-widget__cell-content[data-leaf]') as NodeListOf<HTMLElement>;
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
      '.table-widget__cell-content--subcell[data-leaf]'
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

    const parsed = this.parseLeafId(this.activeCellId);
    if (!parsed) return;

    const { row: rowIndex, col: cellIndex, path } = parsed;
    const content = this.activeCellElement.innerHTML;
    
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

  private commitChanges(): void {
    const currentRows = this.localRows();
    const originalRows = this.rowsAtEditStart;

    if (JSON.stringify(currentRows) !== JSON.stringify(originalRows)) {
      // Always clear legacy mergedRegions when we emit, since merges are now inline on cells.
      this.emitPropsChange(currentRows);
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
    // eslint-disable-next-line no-console
    console.log(`[TableWidget ${this.widget.id}] selectedCells (${reason}):`, selected);
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

  private growWidgetSizeBy(deltaWidthPx: number, deltaHeightPx: number): void {
    const cur = this.widget?.size;
    if (!cur) return;

    const dw = Number.isFinite(deltaWidthPx) ? deltaWidthPx : 0;
    const dh = Number.isFinite(deltaHeightPx) ? deltaHeightPx : 0;

    const nextWidth = Math.max(20, Math.round(cur.width + dw));
    const nextHeight = Math.max(20, Math.round(cur.height + dh));

    if (nextWidth === cur.width && nextHeight === cur.height) {
      return;
    }

    // Same persistence path as manual widget resizing (resize handles).
    this.draftState.updateDraftSize(this.widget.id, { width: nextWidth, height: nextHeight });
    this.draftState.commitDraft(this.widget.id);
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
          `.table-widget__cell-content[data-leaf="${remappedActive}"]`
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

      const split = owner.split;
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
        split.rowFractions = this.insertFractions(split.rowFractions ?? [], curRows, clampedInsert, placement);
      } else {
        for (let r = 0; r < grid.length; r++) {
          grid[r].splice(clampedInsert, 0, { id: uuid(), contentHtml: '' });
        }
        split.cols = curCols + 1;
        split.columnFractions = this.insertFractions(split.columnFractions ?? [], curCols, clampedInsert, placement);
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

    if (remappedActive) {
      window.setTimeout(() => {
        const node = this.tableContainer?.nativeElement?.querySelector(
          `.table-widget__cell-content[data-leaf="${remappedActive}"]`
        ) as HTMLElement | null;
        node?.focus();
      }, 0);
    }
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

  onColResizePointerDown(event: PointerEvent, boundaryIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isResizingGrid || this.isResizingSplitGrid) return;

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

    this.syncCellContent();

    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const owner = this.getCellModelByLeafId(ownerLeafId);
    if (!owner?.split) return;

    const cols = Math.max(1, owner.split.cols);
    if (cols <= 1) return;
    if (boundaryIndex <= 0 || boundaryIndex >= cols) return;

    const splitGridEl = (event.target as HTMLElement | null)?.closest('.table-widget__split-grid') as HTMLElement | null;
    const rect = splitGridEl?.getBoundingClientRect();
    if (!rect) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const containerWidthPx = Math.max(1, rect.width / zoomScale);
    const containerHeightPx = Math.max(1, rect.height / zoomScale);

    this.isResizingSplitGrid = true;
    this.activeSplitResize = {
      kind: 'col',
      ownerLeafId,
      boundaryIndex,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...this.getSplitColFractions(ownerLeafId, owner)],
      containerWidthPx,
      containerHeightPx,
      zoomScale,
    };

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

    this.syncCellContent();

    const ownerLeafId = this.composeOwnerLeafId(rowIndex, cellIndex, path);
    const owner = this.getCellModelByLeafId(ownerLeafId);
    if (!owner?.split) return;

    const rows = Math.max(1, owner.split.rows);
    if (rows <= 1) return;
    if (boundaryIndex <= 0 || boundaryIndex >= rows) return;

    const splitGridEl = (event.target as HTMLElement | null)?.closest('.table-widget__split-grid') as HTMLElement | null;
    const rect = splitGridEl?.getBoundingClientRect();
    if (!rect) return;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const containerWidthPx = Math.max(1, rect.width / zoomScale);
    const containerHeightPx = Math.max(1, rect.height / zoomScale);

    this.isResizingSplitGrid = true;
    this.activeSplitResize = {
      kind: 'row',
      ownerLeafId,
      boundaryIndex,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFractions: [...this.getSplitRowFractions(ownerLeafId, owner)],
      containerWidthPx,
      containerHeightPx,
      zoomScale,
    };

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

    const owner = this.getCellModelByLeafId(r.ownerLeafId);
    if (owner?.split) {
      const finalColFractions =
        this.previewSplitColFractions().get(r.ownerLeafId) ?? (r.kind === 'col' ? r.startFractions : null);
      const finalRowFractions =
        this.previewSplitRowFractions().get(r.ownerLeafId) ?? (r.kind === 'row' ? r.startFractions : null);

      this.localRows.update((rows) => {
        const next = this.cloneRows(rows);
        const parsed = this.parseLeafId(r.ownerLeafId);
        if (!parsed) return next;

        let baseCell = next?.[parsed.row]?.cells?.[parsed.col];
        if (!baseCell) return next;

        // Safety: if leaf id points to a covered top-level cell, redirect to its anchor
        if (baseCell.coveredBy) {
          const a = baseCell.coveredBy;
          baseCell = next?.[a.row]?.cells?.[a.col];
          if (!baseCell) return next;
        }

        const target = parsed.path.length === 0 ? baseCell : this.getCellAtPath(baseCell, parsed.path);
        if (!target?.split) return next;

        if (r.kind === 'col' && finalColFractions) {
          target.split.columnFractions = this.normalizeFractions(finalColFractions, Math.max(1, target.split.cols));
        }
        if (r.kind === 'row' && finalRowFractions) {
          target.split.rowFractions = this.normalizeFractions(finalRowFractions, Math.max(1, target.split.rows));
        }

        return next;
      });

      // Persist immediately (discrete sizing action).
      this.emitPropsChange(this.localRows());
    }

    // Clear previews for this owner (even if owner disappeared)
    const colMap = new Map(this.previewSplitColFractions());
    colMap.delete(r.ownerLeafId);
    this.previewSplitColFractions.set(colMap);

    const rowMap = new Map(this.previewSplitRowFractions());
    rowMap.delete(r.ownerLeafId);
    this.previewSplitRowFractions.set(rowMap);

    this.isResizingSplitGrid = false;
    this.activeSplitResize = null;
    this.teardownSplitResizeListeners();
    this.cdr.markForCheck();
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
      const cols = Math.max(1, owner.split.cols);
      const start = r.startFractions;
      const i = r.boundaryIndex;
      const leftIdx = i - 1;
      const rightIdx = i;
      if (start.length !== cols) return;
      const total = start[leftIdx] + start[rightIdx];

      const deltaScreen = event.clientX - r.startClientX;
      const deltaLayout = deltaScreen / scale;
      const deltaF = deltaLayout / r.containerWidthPx;

      const minFLeft = this.minSplitColPx / r.containerWidthPx;
      const minFRight = this.minSplitColPx / r.containerWidthPx;

      const next = [...start];
      const clampedLeft = this.clamp(start[leftIdx] + deltaF, minFLeft, total - minFRight);
      next[leftIdx] = clampedLeft;
      next[rightIdx] = total - clampedLeft;

      const map = new Map(this.previewSplitColFractions());
      map.set(r.ownerLeafId, this.normalizeFractions(next, cols));
      this.previewSplitColFractions.set(map);
    } else {
      const rows = Math.max(1, owner.split.rows);
      const start = r.startFractions;
      const i = r.boundaryIndex;
      const topIdx = i - 1;
      const bottomIdx = i;
      if (start.length !== rows) return;
      const total = start[topIdx] + start[bottomIdx];

      const deltaScreen = event.clientY - r.startClientY;
      const deltaLayout = deltaScreen / scale;
      const deltaF = deltaLayout / r.containerHeightPx;

      const minFTop = this.minSplitRowPx / r.containerHeightPx;
      const minFBottom = this.minSplitRowPx / r.containerHeightPx;

      const next = [...start];
      const clampedTop = this.clamp(start[topIdx] + deltaF, minFTop, total - minFBottom);
      next[topIdx] = clampedTop;
      next[bottomIdx] = total - clampedTop;

      const map = new Map(this.previewSplitRowFractions());
      map.set(r.ownerLeafId, this.normalizeFractions(next, rows));
      this.previewSplitRowFractions.set(map);
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

      const next = [...start];
      const clampedLeft = this.clamp(start[leftIdx] + deltaF, minFLeft, total - minFRight);
      next[leftIdx] = clampedLeft;
      next[rightIdx] = total - clampedLeft;
      this.previewColumnFractions.set(this.normalizeFractions(next, next.length));
    } else {
      const start = r.startFractions;
      const i = r.boundaryIndex;
      const topIdx = i - 1;
      const bottomIdx = i;
      const total = start[topIdx] + start[bottomIdx];

      const deltaScreen = event.clientY - r.startClientY;
      const deltaLayout = deltaScreen / scale;
      const deltaF = deltaLayout / r.tableHeightPx;

      const minFTop = this.minRowPx / r.tableHeightPx;
      const minFBottom = this.minRowPx / r.tableHeightPx;

      const next = [...start];
      const clampedTop = this.clamp(start[topIdx] + deltaF, minFTop, total - minFBottom);
      next[topIdx] = clampedTop;
      next[bottomIdx] = total - clampedTop;
      this.previewRowFractions.set(this.normalizeFractions(next, next.length));
    }

    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();
  };

  private handleGridResizePointerUp = (event: PointerEvent): void => {
    if (!this.isResizingGrid || !this.activeGridResize) return;
    event.preventDefault();
    event.stopPropagation();

    const rows = this.localRows();

    if (this.activeGridResize.kind === 'col') {
      const nextCols = this.previewColumnFractions() ?? this.colFractions;
      this.columnFractions.set(this.normalizeFractions(nextCols, nextCols.length));
      this.previewColumnFractions.set(null);
    } else {
      const nextRows = this.previewRowFractions() ?? this.rowFractionsView;
      this.rowFractions.set(this.normalizeFractions(nextRows, nextRows.length));
      this.previewRowFractions.set(null);
    }

    // Persist immediately (discrete sizing action).
    this.emitPropsChange(rows);

    this.isResizingGrid = false;
    this.activeGridResize = null;
    this.teardownGridResizeListeners();
    this.cdr.markForCheck();
    this.scheduleRecomputeResizeSegments();
  };

  private getTableRect(): DOMRect | null {
    const container = this.tableContainer?.nativeElement;
    if (!container) return null;
    const table = container.querySelector('table.table-widget__table') as HTMLTableElement | null;
    return table?.getBoundingClientRect() ?? null;
  }

  private getTableElement(): HTMLTableElement | null {
    const container = this.tableContainer?.nativeElement;
    if (!container) return null;
    return container.querySelector('table.table-widget__table') as HTMLTableElement | null;
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

    // Gather rendered top-level td geometry so we can measure real boundaries (accounts for browser min-width/layout rounding).
    const tdNodes = Array.from(
      table.querySelectorAll('td.table-widget__cell[data-cell]')
    ) as HTMLTableCellElement[];

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
    this.cdr.markForCheck();
  }

  private initializeFractionsFromProps(): void {
    const rows = this.localRows();
    const rowCount = this.getTopLevelRowCount(rows);
    const colCount = this.getTopLevelColCount(rows);

    const nextCols = this.normalizeFractions(this.tableProps.columnFractions ?? [], colCount);
    const nextRows = this.normalizeFractions(this.tableProps.rowFractions ?? [], rowCount);

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
}

