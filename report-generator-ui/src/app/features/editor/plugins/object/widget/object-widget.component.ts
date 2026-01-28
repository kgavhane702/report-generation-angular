import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
  effect,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ObjectWidgetProps, WidgetModel } from '../../../../../models/widget.model';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { DraftStateService } from '../../../../../core/services/draft-state.service';
import { PendingChangesRegistry, type FlushableWidget } from '../../../../../core/services/pending-changes-registry.service';
import { ObjectToolbarService } from '../../../../../core/services/object-toolbar.service';
import { TableToolbarService } from '../../../../../core/services/table-toolbar.service';
import { EditastraEditorComponent } from '../../editastra/editor/editastra-editor.component';
import {
  getShapeSvgPath,
  getShapeSvgViewBox,
  isComplexShape,
  getShapeRenderType,
  isStrokeOnlyShape,
  shapeSupportsText,
} from '../config';

@Component({
  selector: 'app-object-widget',
  templateUrl: './object-widget.component.html',
  styleUrls: ['./object-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectWidgetComponent implements OnInit, OnDestroy, OnChanges, FlushableWidget {
  @Input({ required: true }) widget!: WidgetModel;
  @Output() propsChange = new EventEmitter<Partial<ObjectWidgetProps>>();
  @Output() editingChange = new EventEmitter<boolean>();

  @ViewChild(EditastraEditorComponent, { static: false }) editorComp?: EditastraEditorComponent;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly uiState = inject(UIStateService);
  private readonly draftState = inject(DraftStateService);
  private readonly pending = inject(PendingChangesRegistry);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toolbarService = inject(ObjectToolbarService);
  private readonly tableToolbar = inject(TableToolbarService);

  private subscriptions: Subscription[] = [];

  // Effect to activate/deactivate toolbar when this widget is selected/deselected
  private readonly selectionEffect = effect(() => {
    const activeWidgetId = this.uiState.activeWidgetId();
    if (activeWidgetId === this.widget?.id && this.objectProps) {
      this.toolbarService.activate(this.widget.id, this.objectProps);
    } else if (this.toolbarService.getState().widgetId === this.widget?.id) {
      this.toolbarService.deactivate();
    }
  });
  
  // ============================================
  // TEXT EDITING STATE
  // ============================================
  
  /** Local HTML content for editing */
  readonly localHtml = signal<string>('');
  
  /** Whether the editor is actively being edited */
  private isActivelyEditing = false;
  
  /** Baseline of last committed HTML to prevent duplicate emits */
  private htmlAtEditStart = '';
  
  /** Delay blur handling so toolbar interactions don't end editing */
  private blurTimeoutId: number | null = null;

  /** Used to suppress blur-exit when clicking toolbar/dropdowns (ported panels). */
  private isClickingInsideEditUi = false;
  
  // FlushableWidget interface
  get widgetId(): string {
    return this.widget?.id;
  }

  get objectProps(): ObjectWidgetProps {
    return this.widget.props as ObjectWidgetProps;
  }

  get shapeType(): string {
    return this.objectProps?.shapeType || 'rectangle';
  }

  get fillColor(): string {
    return this.objectProps?.fillColor || '#3b82f6';
  }

  get opacity(): number {
    return (this.objectProps?.opacity ?? 100) / 100;
  }

  get strokeColor(): string {
    return this.objectProps?.stroke?.color || '#000000';
  }

  get strokeWidth(): number {
    return this.objectProps?.stroke?.width || 0;
  }

  get strokeStyle(): string {
    return this.objectProps?.stroke?.style || 'solid';
  }

  get borderStyle(): string {
    const stroke = this.objectProps?.stroke;
    if (!stroke || !stroke.width || stroke.width === 0) {
      return 'none';
    }
    const style = stroke.style || 'solid';
    return `${stroke.width}px ${style} ${stroke.color || '#000000'}`;
  }

  get borderRadius(): string {
    if (this.shapeType === 'circle' || this.shapeType === 'ellipse') {
      return '50%';
    }
    const radius = this.objectProps?.borderRadius ?? 0;
    return radius > 0 ? `${radius}px` : '0';
  }

  /** Check if this is a CSS-renderable shape (rectangle, circle, ellipse, square, rounded-rectangle) */
  get isCssShape(): boolean {
    return getShapeRenderType(this.shapeType) === 'css';
  }

  /** Check if this is an SVG-renderable shape */
  get isSvgShape(): boolean {
    return getShapeRenderType(this.shapeType) === 'svg';
  }

  /** Get CSS class for the shape */
  get shapeClass(): string {
    const type = this.shapeType;
    if (type === 'circle' || type === 'ellipse') return 'object-widget__shape--circle';
    if (type === 'rounded-rectangle') return 'object-widget__shape--rounded';
    return 'object-widget__shape--rectangle';
  }

  /** Get SVG path for complex shapes */
  get svgPath(): string {
    return getShapeSvgPath(this.shapeType);
  }

  /** Get a tight SVG viewBox so the shape fills the widget */
  get svgViewBox(): string {
    return getShapeSvgViewBox(this.shapeType);
  }

  /** Check if this is a stroke-only shape (like line) */
  get isLineShape(): boolean {
    return isStrokeOnlyShape(this.shapeType);
  }

  /** Get the effective stroke width for SVG (lines always have stroke) */
  get effectiveStrokeWidth(): number {
    if (this.isLineShape) {
      // Lines need a minimum stroke width to be visible
      return Math.max(this.strokeWidth || 2, 2);
    }
    return this.strokeWidth;
  }

  /** Get the effective stroke color for SVG */
  get effectiveStrokeColor(): string {
    if (this.isLineShape) {
      // For lines, use fill color as the stroke color
      return this.fillColor;
    }
    return this.strokeColor;
  }

  /** Get the fill for SVG shapes (lines have no fill) */
  get svgFill(): string {
    if (this.isLineShape) {
      return 'none';
    }
    return this.fillColor;
  }

  /** Get stroke dasharray for SVG */
  get svgStrokeDasharray(): string {
    if (this.strokeStyle === 'dashed') return '8,4';
    if (this.strokeStyle === 'dotted') return '2,2';
    return 'none';
  }

  /** Check if this shape supports text editing */
  get supportsText(): boolean {
    return shapeSupportsText(this.shapeType);
  }

  /** Get the content HTML for the editor */
  get contentHtml(): string {
    return this.objectProps?.contentHtml || '';
  }

  /** Get vertical alignment for text */
  get verticalAlign(): 'top' | 'middle' | 'bottom' {
    return this.objectProps?.verticalAlign || 'middle';
  }

  /** Get text alignment */
  get textAlign(): 'left' | 'center' | 'right' {
    return this.objectProps?.textAlign || 'center';
  }

  /** Get padding for text content */
  get textPadding(): number {
    return this.objectProps?.padding ?? 8;
  }

  /** Get placeholder text */
  get placeholder(): string {
    return 'Click to add text';
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  ngOnInit(): void {
    // Initialize local HTML from props
    this.localHtml.set(this.contentHtml);
    
    // Register for pending changes
    this.pending.register(this);

    // Listen for toolbar props changes
    this.subscriptions.push(
      this.toolbarService.propsChange$.subscribe(({ widgetId, changes }) => {
        if (widgetId === this.widget.id) {
          this.propsChange.emit(changes);
        }
      })
    );

    // Bridge shared formatting toolbar alignment actions into object widget props
    // so alignment persists (the formatting service otherwise only updates element styles).
    this.subscriptions.push(
      this.tableToolbar.textAlignRequested$.subscribe((align) => {
        if (this.tableToolbar.activeTableWidgetId !== this.widget.id) return;
        if (!this.supportsText) return;
        // Object widgets don't support 'justify' (Editastra does). Fallback to 'left'.
        const nextAlign = align === 'justify' ? 'left' : align;
        this.propsChange.emit({ textAlign: nextAlign });
      })
    );

    this.subscriptions.push(
      this.tableToolbar.verticalAlignRequested$.subscribe((align) => {
        if (this.tableToolbar.activeTableWidgetId !== this.widget.id) return;
        if (!this.supportsText) return;
        this.propsChange.emit({ verticalAlign: align });
      })
    );

    // Activate toolbar if this widget is active
    this.checkAndActivateToolbar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget']) {
      this.checkAndActivateToolbar();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.pending.unregister(this.widgetId);
    
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }

    // Deactivate toolbar if this widget was active
    if (this.toolbarService.getState().widgetId === this.widget.id) {
      this.toolbarService.deactivate();
    }

    // Ensure we don't leave a stale activeCell reference in the shared formatting toolbar service.
    this.tableToolbar.setActiveCell(null, this.widget?.id ?? null);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    const t = event.target as HTMLElement | null;
    if (!t) return;

    // If the user is interacting with the widget toolbar (top rail) or any Editastra dropdown,
    // treat the ensuing blur as "internal" so we don't exit edit mode.
    const isWidgetToolbar = !!t.closest('app-widget-toolbar');
    const isEditastraToolbar = !!t.closest('[data-editastra-toolbar="1"]');
    const isEditastraDropdown = !!t.closest('[data-editastra-dropdown="1"]');
    const isEditastraColorPicker = !!t.closest('[data-color-picker-dropdown="editastra"]');
    const isAnchoredDropdownPanel = !!t.closest('.anchored-dropdown') || !!t.closest('.anchored-dropdown-portal');
    const isColorPickerContent = !!t.closest('.color-picker__dropdown-content') || !!t.closest('.color-picker');
    const isBorderPickerContent = !!t.closest('.border-picker__content') || !!t.closest('.border-picker');

    if (
      isWidgetToolbar ||
      isEditastraToolbar ||
      isEditastraDropdown ||
      isEditastraColorPicker ||
      isAnchoredDropdownPanel ||
      isColorPickerContent ||
      isBorderPickerContent
    ) {
      this.isClickingInsideEditUi = true;
      queueMicrotask(() => {
        this.isClickingInsideEditUi = false;
      });
    }
  }

  private checkAndActivateToolbar(): void {
    const activeWidgetId = this.uiState.activeWidgetId();
    if (activeWidgetId === this.widget.id && this.objectProps) {
      this.toolbarService.activate(this.widget.id, this.objectProps);
    }
  }

  // ============================================
  // FlushableWidget IMPLEMENTATION
  // ============================================

  hasPendingChanges(): boolean {
    if (!this.isActivelyEditing) return false;
    const current = this.localHtml();
    return current !== this.htmlAtEditStart;
  }

  flush(): void {
    if (!this.hasPendingChanges()) return;
    this.commitContent();
  }

  // ============================================
  // TEXT EDITING HANDLERS
  // ============================================

  onEditorFocus(): void {
    if (this.isActivelyEditing) return;
    
    this.isActivelyEditing = true;
    this.htmlAtEditStart = this.localHtml();
    this.editingChange.emit(true);

    // Ensure the widget stays selected while editing so the widget toolbar enables.
    if (this.widget?.id) {
      this.uiState.selectWidget(this.widget.id);
    }

    // Register this editor surface as the active formatting target for the shared toolbar.
    const el = this.editorComp?.getEditableElement() ?? null;
    this.tableToolbar.setActiveCell(el, this.widget?.id ?? null);
  }

  onEditorBlur(): void {
    // Delay blur to allow toolbar/dropdown interactions
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }
    
    this.blurTimeoutId = window.setTimeout(() => {
      this.blurTimeoutId = null;
      const activeElement = document.activeElement as HTMLElement | null;
      const editableEl = this.editorComp?.getEditableElement() ?? null;

      const isStillInsideEditor =
        !!(activeElement && editableEl && (activeElement === editableEl || editableEl.contains(activeElement)));

      const widgetToolbarEl = document.querySelector('app-widget-toolbar');
      const isStillInsideWidgetToolbar = !!(activeElement && widgetToolbarEl?.contains(activeElement));

      const isStillInsideEditastraDropdown =
        !!(
          activeElement &&
          (
            activeElement.closest('[data-editastra-dropdown="1"]') ||
            activeElement.closest('[data-color-picker-dropdown="editastra"]') ||
            activeElement.closest('.anchored-dropdown') ||
            activeElement.closest('.anchored-dropdown-portal') ||
            activeElement.closest('.color-picker__dropdown-content') ||
            activeElement.closest('.border-picker__content')
          )
        );

      // Only commit/exit editing if focus moved fully outside editor + toolbar/dropdowns.
      if (!isStillInsideEditor && !isStillInsideWidgetToolbar && !isStillInsideEditastraDropdown && !this.isClickingInsideEditUi) {
        this.finishEditing();
      } else {
        // If focus moved to toolbar buttons, re-focus the editor surface so typing can continue.
        // Avoid stealing focus from text inputs/selects (e.g., font size input).
        const tag = (activeElement?.tagName || '').toUpperCase();
        const isFormControl = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
        if (!isFormControl) {
          requestAnimationFrame(() => this.editorComp?.focus());
        }
      }

      this.isClickingInsideEditUi = false;
    }, 150);
  }

  onEditorInput(html: string): void {
    this.localHtml.set(html);
  }

  focusEditor(): void {
    this.editorComp?.focus();
  }

  private finishEditing(): void {
    if (!this.isActivelyEditing) return;
    
    this.commitContent();
    this.isActivelyEditing = false;
    this.editingChange.emit(false);

    // Clear active formatting target.
    this.tableToolbar.setActiveCell(null, this.widget?.id ?? null);
  }

  private commitContent(): void {
    const currentHtml = this.localHtml();
    if (currentHtml !== this.htmlAtEditStart) {
      this.propsChange.emit({ contentHtml: currentHtml });
      this.htmlAtEditStart = currentHtml;
    }
  }

  // ============================================
  // SHAPE INTERACTION
  // ============================================

  onShapeClick(): void {
    // Select this widget
    this.uiState.selectWidget(this.widget.id);
  }

  updateShapeType(shapeType: string): void {
    this.propsChange.emit({ shapeType });
  }

  updateFillColor(fillColor: string): void {
    this.propsChange.emit({ fillColor });
  }

  updateOpacity(opacity: number): void {
    this.propsChange.emit({ opacity });
  }

  updateStroke(stroke: { color: string; width: number; style?: 'solid' | 'dashed' | 'dotted' }): void {
    this.propsChange.emit({ stroke });
  }

  updateBorderRadius(borderRadius: number): void {
    this.propsChange.emit({ borderRadius });
  }
}
