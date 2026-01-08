import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import type { EditastraWidgetProps, WidgetModel } from '../../../../../models/widget.model';
import { PendingChangesRegistry, type FlushableWidget } from '../../../../../core/services/pending-changes-registry.service';
import { EditastraEditorComponent } from '../editor/editastra-editor.component';
import { TableToolbarService } from '../../../../../core/services/table-toolbar.service';
import { Subscription } from 'rxjs';
import { DraftStateService } from '../../../../../core/services/draft-state.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';

/**
 * EditastraWidgetComponent
 *
 * Temporary widget that hosts the table-style contenteditable editor.
 * It follows the same "commit on blur" pattern as Text/Table widgets to avoid store churn.
 */
@Component({
  selector: 'app-editastra-widget',
  standalone: true,
  imports: [CommonModule, EditastraEditorComponent],
  templateUrl: './editastra-widget.component.html',
  styleUrls: ['./editastra-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditastraWidgetComponent implements OnInit, OnChanges, OnDestroy, FlushableWidget {
  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<EditastraWidgetProps>>();

  private readonly pending = inject(PendingChangesRegistry);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly tableToolbar = inject(TableToolbarService);
  private readonly draftState = inject(DraftStateService);
  private readonly uiState = inject(UIStateService);

  @ViewChild(EditastraEditorComponent, { static: false }) editorComp?: EditastraEditorComponent;
  private verticalAlignSub?: Subscription;

  // FlushableWidget
  get widgetId(): string {
    return this.widget?.id;
  }

  readonly localHtml = signal<string>('');
  private isActivelyEditing = false;
  /** Baseline of last committed HTML (normalized) to prevent duplicate emits during autosave. */
  private htmlAtEditStart = '';
  /** Delay blur handling so toolbar/dropdown interactions don't end editing. */
  private blurTimeoutId: number | null = null;
  /** Tracks pointerdown that happened in toolbar/dropdowns so blur can be ignored. */
  private isClickingInsideEditUi = false;
  private autoGrowRaf: number | null = null;
  private autosaveTimeoutId: number | null = null;
  private readonly autosaveDelayMs = 650;

  private resumeEditingAfterDocHistorySync = false;
  private resumeWasFocused = false;
  /** Saved cursor offset (character count from start) for restoration after undo. */
  private resumeCursorOffset: number | null = null;
  /** Whether the pending history sync is a redo (cursor goes to end) vs undo (cursor restored). */
  private resumeIsRedo = false;

  /** Content-aware minimum widget height (layout px) to avoid clipped text while resizing. */
  readonly minWidgetHeightPx = signal<number>(24);
  private computeMinHeightRaf: number | null = null;

  // NOTE:
  // `effect()` MUST be created inside an injection context.
  // Creating it in ngOnInit causes NG0203 at runtime.
  // Field initializers run in injection context for components, so this is safe.
  private readonly minHeightEffectRef = effect(() => {
    const activeId = this.uiState.activeWidgetId();
    this.uiState.zoomLevel();
    this.localHtml();

    const myId = this.widget?.id;
    if (!myId || activeId !== myId) return;
    this.scheduleComputeContentMinHeight();
  });

  // Auto-fit scale for URL-based widgets (preserve-frame): if the loaded content overflows the fixed widget height,
  // scale down padding/font-size at render-time (NOT persisted into contentHtml).
  private readonly autoFitEffectRef = effect(() => {
    this.uiState.zoomLevel();
    this.localHtml();
    this.widgetHeightPx();
    this.widgetWidthPx();
    this.scheduleComputeAutoFitScale();
  });

  readonly autoFitTextScale = signal<number>(1);
  readonly widgetHeightPx = signal<number>(0);
  readonly widgetWidthPx = signal<number>(0);

  get props(): EditastraWidgetProps {
    return this.widget.props as EditastraWidgetProps;
  }

  readonly placeholder = () => this.props.placeholder || 'Type here…';

  ngOnInit(): void {
    this.localHtml.set(this.props.contentHtml || '');
    this.widgetHeightPx.set(this.widget?.size?.height ?? 0);
    this.widgetWidthPx.set(this.widget?.size?.width ?? 0);

    // Listen for vertical-align requests coming from the Editastra toolbar (reuses TableToolbarService).
    // Apply ONLY when this widget is the active target in the toolbar service.
    this.verticalAlignSub = this.tableToolbar.verticalAlignRequested$.subscribe((align) => {
      if (!this.widget?.id) return;
      if (this.tableToolbar.activeTableWidgetId !== this.widget.id) return;
      this.propsChange.emit({ verticalAlign: align });
      // Keep editor focused while applying alignment.
      requestAnimationFrame(() => this.editorComp?.focus());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget']) {
      // Ignore external updates while actively editing (same principle as table/text widgets).
      if (!this.isActivelyEditing) {
        const newContent = this.props.contentHtml || '';
        this.localHtml.set(newContent);

        // If a document-level undo/redo happened while the editor was focused, we temporarily disabled
        // local "actively editing" gating to allow the store update to apply. Now restore edit mode + focus.
        if (this.resumeEditingAfterDocHistorySync) {
          this.resumeEditingAfterDocHistorySync = false;
          this.isActivelyEditing = true;

          // Reset baseline to the new store-driven state so autosave/blur don't re-emit it.
          this.htmlAtEditStart = normalizeEditorHtmlForModel(newContent);

          const editableEl = this.editorComp?.getEditableElement() ?? null;
          if (editableEl) {
            // Ensure the focused surface reflects the new model immediately (twSafeInnerHtml defers while focused).
            editableEl.innerHTML = newContent;
            const savedOffset = this.resumeCursorOffset;
            const isRedo = this.resumeIsRedo;
            this.resumeCursorOffset = null;
            this.resumeIsRedo = false;
            // Focus and restore cursor position in the same frame to avoid race conditions.
            requestAnimationFrame(() => {
              editableEl.focus();
              if (isRedo) {
                // For redo: always place cursor at the end of restored content.
                this.setCursorAtEnd(editableEl);
              } else if (savedOffset !== null) {
                // For undo: restore cursor to saved offset (clamped to new content length).
                this.setCursorOffsetInElement(editableEl, savedOffset);
              } else {
                // Fallback: place cursor at the end of content.
                this.setCursorAtEnd(editableEl);
              }
            });
          } else {
            this.resumeCursorOffset = null;
            this.resumeIsRedo = false;
          }
        }
      }
      this.widgetHeightPx.set(this.widget?.size?.height ?? 0);
      this.widgetWidthPx.set(this.widget?.size?.width ?? 0);
    }
  }

  ngOnDestroy(): void {
    this.verticalAlignSub?.unsubscribe();
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }
    if (this.autosaveTimeoutId !== null) {
      clearTimeout(this.autosaveTimeoutId);
      this.autosaveTimeoutId = null;
    }
    if (this.autoGrowRaf !== null) {
      cancelAnimationFrame(this.autoGrowRaf);
      this.autoGrowRaf = null;
    }
    if (this.autoFitScaleRaf !== null) {
      cancelAnimationFrame(this.autoFitScaleRaf);
      this.autoFitScaleRaf = null;
    }
    if (this.computeMinHeightRaf !== null) {
      cancelAnimationFrame(this.computeMinHeightRaf);
      this.computeMinHeightRaf = null;
    }
    // Ensure we don't leave a stale activeCell reference in the shared toolbar service.
    this.tableToolbar.setActiveCell(null, this.widget?.id ?? null);

    // Best-effort: if the widget is being destroyed while editing, flush to avoid losing typed content.
    if (this.isActivelyEditing) {
      this.commitContentChange('destroy');
    }
    if (this.widget?.id) {
      this.pending.unregister(this.widget.id);
    }
  }

  @HostListener('document:tw-table-pre-doc-undo', ['$event'])
  onPreDocUndo(event: Event): void {
    const ev = event as CustomEvent<{ widgetId?: string }>;
    const widgetId = ev?.detail?.widgetId ?? null;
    if (!widgetId || widgetId !== this.widget?.id) return;
    if (!this.editorComp) return;

    // Keep focus in the editor but allow the next store-driven widget update to apply by temporarily
    // disabling the "actively editing" gate. We'll restore edit mode after ngOnChanges applies it.
    const editableEl = this.editorComp.getEditableElement();
    this.resumeWasFocused = !!(editableEl && (editableEl === document.activeElement || editableEl.contains(document.activeElement as Node)));
    // Save cursor position before undo so we can restore it after content updates.
    this.resumeCursorOffset = this.getCursorOffsetInElement(editableEl);
    this.resumeIsRedo = false;
    this.resumeEditingAfterDocHistorySync = true;
    this.isActivelyEditing = false;
  }

  @HostListener('document:tw-table-pre-doc-redo', ['$event'])
  onPreDocRedo(event: Event): void {
    const ev = event as CustomEvent<{ widgetId?: string }>;
    const widgetId = ev?.detail?.widgetId ?? null;
    if (!widgetId || widgetId !== this.widget?.id) return;
    if (!this.editorComp) return;

    const editableEl = this.editorComp.getEditableElement();
    this.resumeWasFocused = !!(editableEl && (editableEl === document.activeElement || editableEl.contains(document.activeElement as Node)));
    // For redo, cursor always goes to end of restored content.
    this.resumeIsRedo = true;
    this.resumeEditingAfterDocHistorySync = true;
    this.isActivelyEditing = false;
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    const t = event.target as HTMLElement | null;
    if (!t) return;

    // If the user is interacting with the widget toolbar (top rail) or any Editastra dropdown,
    // treat the ensuing blur as "internal" so we don't exit edit mode.
    const isWidgetToolbar = !!t.closest('app-widget-toolbar');
    const isOurStandaloneToolbar = !!t.closest('[data-editastra-toolbar="1"]');
    // Dropdowns are portaled to body, so we identify them via data attributes or CSS classes.
    const isOurDropdown = !!t.closest('[data-editastra-dropdown="1"]');
    const isOurColorPicker = !!t.closest('[data-color-picker-dropdown="editastra"]');
    const isAnchoredDropdownPanel = !!t.closest('.anchored-dropdown') || !!t.closest('.anchored-dropdown-portal');
    const isColorPickerContent = !!t.closest('.color-picker__dropdown-content') || !!t.closest('.color-picker');
    const isBorderPickerContent = !!t.closest('.border-picker__content') || !!t.closest('.border-picker');

    if (isWidgetToolbar || isOurStandaloneToolbar || isOurDropdown || isOurColorPicker || isAnchoredDropdownPanel || isColorPickerContent || isBorderPickerContent) {
      this.isClickingInsideEditUi = true;
      // Clear in a microtask so we only suppress the immediate blur caused by this click.
      queueMicrotask(() => {
        this.isClickingInsideEditUi = false;
      });
    }
  }

  onEditorFocus(): void {
    if (this.isActivelyEditing) return;
    this.isActivelyEditing = true;
    this.htmlAtEditStart = normalizeEditorHtmlForModel(this.props.contentHtml || '');
    this.pending.register(this);
    this.editingChange.emit(true);

    // Ensure the widget is selected/active while editing so the widget toolbar enables its actions.
    // Otherwise `EditorStateService.activeWidget()` can be null or another widget, causing toolbar buttons to stay disabled.
    if (this.widget?.id) {
      this.uiState.selectWidget(this.widget.id);
    }

    // Register this editor surface as the active formatting target for the toolbar.
    const el = this.editorComp?.getEditableElement() ?? null;
    this.tableToolbar.setActiveCell(el, this.widget?.id ?? null);
  }

  onEditorInput(html: string): void {
    this.localHtml.set(html ?? '');
    this.scheduleAutoGrow();
    this.scheduleAutosaveCommit();
  }

  onEditorBlur(): void {
    if (!this.isActivelyEditing) return;

    // Delay blur handling so we can detect toolbar/dropdown interactions.
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }

    this.blurTimeoutId = window.setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      const editableEl = this.editorComp?.getEditableElement() ?? null;

      const isStillInsideEditor =
        !!(activeElement && editableEl && (activeElement === editableEl || editableEl.contains(activeElement)));

      // Widget toolbar is a shared shell (top rail) hosting the Editastra toolbar for this widget type.
      const widgetToolbarEl = document.querySelector('app-widget-toolbar');
      const isStillInsideWidgetToolbar = !!(activeElement && widgetToolbarEl?.contains(activeElement));

      // Portaled dropdown panels / color picker dropdowns live under body.
      const isStillInsideEditastraDropdown =
        !!(activeElement && (
          activeElement.closest('[data-editastra-dropdown="1"]') ||
          activeElement.closest('[data-color-picker-dropdown="editastra"]') ||
          activeElement.closest('.anchored-dropdown') ||
          activeElement.closest('.anchored-dropdown-portal') ||
          activeElement.closest('.color-picker__dropdown-content') ||
          activeElement.closest('.border-picker__content')
        ));

      // Only commit and exit editing if focus moved completely outside editor + toolbar/dropdowns.
      if (!isStillInsideEditor && !isStillInsideWidgetToolbar && !isStillInsideEditastraDropdown && !this.isClickingInsideEditUi) {
        if (this.autosaveTimeoutId !== null) {
          clearTimeout(this.autosaveTimeoutId);
          this.autosaveTimeoutId = null;
        }

        this.commitContentChange('blur');
        this.isActivelyEditing = false;
        this.editingChange.emit(false);
        this.tableToolbar.setActiveCell(null, this.widget?.id ?? null);
        this.cdr.markForCheck();
      } else {
        // If focus moved to toolbar buttons, re-focus the editor surface so typing can continue.
        // Avoid stealing focus from text inputs/selects (e.g., font size input).
        const tag = (activeElement?.tagName || '').toUpperCase();
        const isFormControl = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
        if (!isFormControl) {
          requestAnimationFrame(() => this.editorComp?.focus());
        }
      }

      this.blurTimeoutId = null;
      this.isClickingInsideEditUi = false;
    }, 150);
  }

  focusEditorFromContainer(event: MouseEvent): void {
    // Clicking empty area should focus editor without selecting the widget border.
    // Don't block widget drag/resize: container is inside the non-draggable content area.
    if ((event.target as HTMLElement | null)?.closest('.table-toolbar') || (event.target as HTMLElement | null)?.closest('.anchored-dropdown')) {
      return;
    }
    // Only focus if click wasn't on the actual editor surface (it already handles focus).
    requestAnimationFrame(() => this.editorComp?.focus());
  }

  hasPendingChanges(): boolean {
    if (!this.isActivelyEditing) {
      return false;
    }
    const next = normalizeEditorHtmlForModel(this.localHtml());
    return next !== this.htmlAtEditStart;
  }

  flush(): void {
    if (this.autosaveTimeoutId !== null) {
      clearTimeout(this.autosaveTimeoutId);
      this.autosaveTimeoutId = null;
    }

    this.commitContentChange('flush');

    // Persist any auto-grown size (kept in draft while typing for smoothness).
    if (this.widget?.id && this.draftState.hasDraft(this.widget.id)) {
      this.draftState.commitDraft(this.widget.id);
    }

    if (this.widget?.id && !this.isActivelyEditing) {
      this.pending.unregister(this.widget.id);
    }
  }

  private commitContentChange(reason: 'blur' | 'flush' | 'destroy' | 'autosave'): void {
    const next = normalizeEditorHtmlForModel(this.localHtml());
    const baseline = this.htmlAtEditStart;

    if (next !== baseline) {
      this.propsChange.emit({ contentHtml: next });
      // Advance baseline so subsequent autosaves/blur don't emit the same change again.
      this.htmlAtEditStart = next;
    }

    // Persist any auto-grown size on terminal commit moments.
    if ((reason === 'blur' || reason === 'flush' || reason === 'destroy') && this.widget?.id) {
      if (this.draftState.hasDraft(this.widget.id)) {
        this.draftState.commitDraft(this.widget.id);
      }
    }
  }

  private scheduleAutosaveCommit(): void {
    if (!this.isActivelyEditing) return;

    if (this.autosaveTimeoutId !== null) {
      clearTimeout(this.autosaveTimeoutId);
      this.autosaveTimeoutId = null;
    }

    this.autosaveTimeoutId = window.setTimeout(() => {
      this.autosaveTimeoutId = null;
      this.commitContentChange('autosave');
    }, this.autosaveDelayMs);
  }

  private scheduleAutoGrow(): void {
    if (!this.isActivelyEditing) return;
    if (this.autoGrowRaf !== null) return;
    this.autoGrowRaf = window.requestAnimationFrame(() => {
      this.autoGrowRaf = null;
      this.maybeAutoGrowToFit();
    });
  }

  private maybeAutoGrowToFit(): void {
    const editable = this.editorComp?.getEditableElement() ?? null;
    if (!editable) return;
    const curSize = this.widget?.size;
    if (!curSize) return;

    // Measure required content height (use scrollHeight when content overflows, else actual rendered height).
    const scrollH = editable.scrollHeight || 0;
    const renderH = editable.getBoundingClientRect().height || 0;
    const contentH = Math.max(scrollH, renderH);
    if (!Number.isFinite(contentH) || contentH <= 0) return;

    const minHeight = 24;
    const bufferPx = 8;
    const stepPx = 8;

    const overflow = contentH - curSize.height;
    if (overflow > 1) {
      // Grow: content exceeds widget
      const deltaPx = Math.min(1200, this.roundUpPx(overflow + bufferPx, stepPx));
      if (deltaPx <= 0) return;
      const nextHeight = Math.max(minHeight, Math.round(curSize.height + deltaPx));
      if (nextHeight !== curSize.height) {
        this.draftState.updateDraftSize(this.widget.id, { width: curSize.width, height: nextHeight });
      }
    } else if (overflow < -stepPx) {
      // Shrink: widget is larger than needed (by at least one step)
      // Only shrink if the widget was auto-grown (i.e. has a draft), otherwise user may have manually sized it.
      if (!this.draftState.hasDraft(this.widget.id)) return;
      const excessPx = Math.abs(overflow) - bufferPx;
      if (excessPx < stepPx) return;
      const shrinkPx = this.roundDownPx(excessPx, stepPx);
      const nextHeight = Math.max(minHeight, Math.round(curSize.height - shrinkPx));
      if (nextHeight < curSize.height) {
        this.draftState.updateDraftSize(this.widget.id, { width: curSize.width, height: nextHeight });
      }
    }
  }

  private roundDownPx(v: number, step: number): number {
    const s = Math.max(1, Math.floor(step));
    const n = Number.isFinite(v) ? v : 0;
    return Math.floor(n / s) * s;
  }

  private roundUpPx(v: number, step: number): number {
    const s = Math.max(1, Math.floor(step));
    const n = Number.isFinite(v) ? v : 0;
    return Math.ceil(n / s) * s;
  }

  private scheduleComputeContentMinHeight(): void {
    if (this.computeMinHeightRaf !== null) return;
    this.computeMinHeightRaf = window.requestAnimationFrame(() => {
      this.computeMinHeightRaf = null;
      this.computeContentMinHeightPx();
    });
  }

  private computeContentMinHeightPx(): void {
    const editable = this.editorComp?.getEditableElement() ?? null;
    if (!editable) return;

    // scrollHeight is in layout px (not affected by zoom transform), which matches widget frame units.
    const raw = Math.max(0, Math.ceil(editable.scrollHeight || 0));
    const bufferPx = 2;
    const next = Math.max(24, raw + bufferPx);
    if (next !== this.minWidgetHeightPx()) {
      this.minWidgetHeightPx.set(next);
      // Ensure the DOM attribute updates under OnPush.
      this.cdr.markForCheck();
    }
  }

  private scheduleComputeAutoFitScale(): void {
    // Reuse the same RAF slot as min-height compute; both are cheap and tied to layout.
    this.scheduleComputeContentMinHeight();
    this.scheduleAutoFitScaleRaf();
  }

  private autoFitScaleRaf: number | null = null;

  private scheduleAutoFitScaleRaf(): void {
    if (this.autoFitScaleRaf !== null) return;
    this.autoFitScaleRaf = window.requestAnimationFrame(() => {
      this.autoFitScaleRaf = null;
      this.computeAutoFitScale();
    });
  }

  private computeAutoFitScale(): void {
    // Only apply preserved-frame auto-fit when widget is URL-backed.
    if (!this.props.dataSource || this.props.loading) {
      this.setAutoFitScale(1);
      return;
    }
    if (this.isActivelyEditing) {
      this.setAutoFitScale(1);
      return;
    }

    const editable = this.editorComp?.getEditableElement() ?? null;
    if (!editable) return;

    const availableH = Math.max(1, Number.isFinite(this.widgetHeightPx()) ? this.widgetHeightPx() : 0);
    const required = Math.max(20, Math.ceil(editable.scrollHeight || 0));
    if (!Number.isFinite(required) || required <= 0) {
      this.setAutoFitScale(1);
      return;
    }

    if (required <= availableH + 1) {
      this.setAutoFitScale(1);
      return;
    }

    const bufferPx = 2;
    const ratio = Math.max(0.1, (availableH - bufferPx) / required);
    const next = this.clamp(ratio, 0.65, 1);
    this.setAutoFitScale(next);
  }

  private setAutoFitScale(v: number): void {
    const next = Number.isFinite(v) ? v : 1;
    if (next === this.autoFitTextScale()) return;
    this.autoFitTextScale.set(next);
    this.cdr.markForCheck();
  }

  private clamp(v: number, min: number, max: number): number {
    const n = Number.isFinite(v) ? v : 0;
    return Math.max(min, Math.min(max, n));
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

function normalizeEditorHtmlForModel(html: string): string {
  const raw = (html ?? '').toString();
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Common empty contenteditable shapes.
  const normalized = trimmed
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    normalized === '<br>' ||
    normalized === '<div><br></div>' ||
    normalized === '<div><br></div><div><br></div>' ||
    normalized === '<p><br></p>'
  ) {
    return '';
  }

  // Keep original HTML (not the whitespace-collapsed version) to preserve formatting.
  return trimmed;
}


