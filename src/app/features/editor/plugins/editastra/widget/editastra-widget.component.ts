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

  @ViewChild(EditastraEditorComponent, { static: false }) editorComp?: EditastraEditorComponent;
  private verticalAlignSub?: Subscription;

  // FlushableWidget
  get widgetId(): string {
    return this.widget?.id;
  }

  readonly localHtml = signal<string>('');
  private isActivelyEditing = false;
  private htmlAtEditStart = '';
  private suppressNextBlur = false;
  private autoGrowRaf: number | null = null;

  get props(): EditastraWidgetProps {
    return this.widget.props as EditastraWidgetProps;
  }

  readonly placeholder = () => this.props.placeholder || 'Type here…';

  ngOnInit(): void {
    this.localHtml.set(this.props.contentHtml || '');

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
        this.localHtml.set(this.props.contentHtml || '');
      }
    }
  }

  ngOnDestroy(): void {
    this.verticalAlignSub?.unsubscribe();
    if (this.autoGrowRaf !== null) {
      cancelAnimationFrame(this.autoGrowRaf);
      this.autoGrowRaf = null;
    }
    // Ensure we don't leave a stale activeCell reference in the shared toolbar service.
    this.tableToolbar.setActiveCell(null, this.widget?.id ?? null);
    if (this.widget?.id) {
      this.pending.unregister(this.widget.id);
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    const t = event.target as HTMLElement | null;
    if (!t) return;

    // If the user is interacting with the Editastra toolbar, suppress blur.
    const isOurToolbar = t.closest('[data-editastra-toolbar="1"]');
    // Dropdowns are portaled to body, so we identify them via data attributes
    const isOurDropdown = t.closest('[data-editastra-dropdown="1"]');
    // Color pickers also use portaled dropdowns, identified via data-color-picker-dropdown
    const isOurColorPicker = t.closest('[data-color-picker-dropdown="editastra"]');

    if (isOurToolbar || isOurDropdown || isOurColorPicker) {
      this.suppressNextBlur = true;
      // Clear in a microtask so we only suppress the immediate blur caused by this click.
      queueMicrotask(() => {
        this.suppressNextBlur = false;
      });
    }
  }

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    // Apply inline format painter on mouse/touch release inside the editor.
    if (!this.tableToolbar.formatPainterActive()) return;
    if (this.tableToolbar.activeTableWidgetId !== this.widget?.id) return;
    if (!this.tableToolbar.getInlineFormatPainterStyle()) return;

    const target = event.target as HTMLElement | null;
    const editable = this.editorComp?.getEditableElement() ?? null;
    if (!target || !editable) return;
    if (!editable.contains(target)) return;

    // Apply to current selection/caret.
    this.tableToolbar.applyInlineFormatPainterNow();

    // Keep editor focused (toolbar service may have moved selection).
    requestAnimationFrame(() => this.editorComp?.focus());
  }

  onEditorFocus(): void {
    if (this.isActivelyEditing) return;
    this.isActivelyEditing = true;
    this.htmlAtEditStart = this.props.contentHtml || '';
    this.pending.register(this);
    this.editingChange.emit(true);

    // Register this editor surface as the active formatting target for the toolbar.
    const el = this.editorComp?.getEditableElement() ?? null;
    this.tableToolbar.setActiveCell(el, this.widget?.id ?? null);
  }

  onEditorInput(html: string): void {
    this.localHtml.set(html ?? '');
    this.scheduleAutoGrow();
  }

  onEditorBlur(): void {
    if (!this.isActivelyEditing) return;

    // Toolbar clicks should not end editing or commit.
    if (this.suppressNextBlur) {
      // Re-focus editor on next frame (after toolbar handler runs).
      requestAnimationFrame(() => {
        this.editorComp?.focus();
      });
      return;
    }

    this.flush();
    this.isActivelyEditing = false;
    this.editingChange.emit(false);
    this.tableToolbar.setActiveCell(null, this.widget?.id ?? null);
    this.cdr.markForCheck();
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
    const next = normalizeEditorHtmlForModel(this.localHtml());
    return next !== (this.props.contentHtml || '');
  }

  flush(): void {
    const next = normalizeEditorHtmlForModel(this.localHtml());
    const prev = this.props.contentHtml || '';
    if (next !== prev) {
      this.propsChange.emit({ contentHtml: next });
    }

    // Persist any auto-grown size (kept in draft while typing for smoothness).
    if (this.widget?.id && this.draftState.hasDraft(this.widget.id)) {
      this.draftState.commitDraft(this.widget.id);
    }

    if (this.widget?.id) {
      this.pending.unregister(this.widget.id);
    }
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

    const minHeight = 50;
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


