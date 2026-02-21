import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  computed,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ObjectToolbarService } from '../../../../../../core/services/object-toolbar.service';
import { EditorStateService } from '../../../../../../core/services/editor-state.service';
import { DocumentService } from '../../../../../../core/services/document.service';
import { ObjectWidgetProps } from '../../../../../../models/widget.model';
import { ColorPickerComponent, ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';
import { BorderPickerComponent, BorderValue } from '../../../../../../shared/components/border-picker/border-picker.component';
import { EditastraToolbarComponent } from '../../../editastra/ui/editastra-toolbar/editastra-toolbar.component';
import {
  EDITASTRA_TOOLBAR_PLUGINS,
  type EditastraToolbarPlugin,
} from '../../../editastra/ui/editastra-toolbar/editastra-toolbar.plugins';
import { shapeSupportsText } from '../../config';

@Component({
  selector: 'app-object-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ColorPickerComponent,
    BorderPickerComponent,
    EditastraToolbarComponent,
  ],
  templateUrl: './object-toolbar.component.html',
  styleUrls: ['./object-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectToolbarComponent implements OnInit, OnDestroy {
  private readonly toolbarService = inject(ObjectToolbarService);
  private readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('opacityInput') opacityInputRef?: ElementRef<HTMLInputElement>;

  private subscriptions: Subscription[] = [];

  /**
   * Reuse Editastra's text formatting toolbar (bold/italic/fonts/lists/etc.)
   * but hide image insertion + widget background fill (not relevant for object shapes).
   */
  readonly textFormattingPlugins: EditastraToolbarPlugin[] = EDITASTRA_TOOLBAR_PLUGINS.filter(
    (p) => p.kind !== 'insert-image' && p.kind !== 'reset-image-size' && p.kind !== 'widget-background' && p.kind !== 'widget-border'
  );

  // Computed signals for active object widget (like ChartToolbar pattern)
  readonly isObjectWidgetActive = computed(() => {
    const w = this.editorState.activeWidget();
    return w?.type === 'object';
  });

  readonly activeObjectWidgetId = computed(() => {
    const w = this.editorState.activeWidget();
    return w?.type === 'object' ? w.id : null;
  });

  readonly activeObjectProps = computed<ObjectWidgetProps | null>(() => {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'object') return null;
    return (ctx.widget.props as ObjectWidgetProps) ?? null;
  });

  // Fill color palette
  readonly fillColorPalette: ColorOption[] = [
    { value: '', label: 'Transparent' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#ef4444', label: 'Red' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#f97316', label: 'Orange Dark' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#ffffff', label: 'White' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#374151', label: 'Dark Gray' },
    { value: '#1f2937', label: 'Darker Gray' },
    { value: '#000000', label: 'Black' },
  ];


  ngOnInit(): void {
    // No subscriptions needed - using computed signals
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  // ============================================
  // STATE GETTERS
  // ============================================

  get props(): ObjectWidgetProps | null {
    return this.activeObjectProps();
  }

  get widgetId(): string | null {
    return this.activeObjectWidgetId();
  }

  get shapeType(): string {
    return this.props?.shapeType || 'rectangle';
  }

  get fillColor(): string {
    return this.props?.fillColor ?? '';
  }

  get opacity(): number {
    return this.props?.opacity ?? 100;
  }

  get borderValue(): BorderValue {
    const stroke = this.props?.stroke;
    const style = stroke?.style;
    return {
      color: stroke?.color || '#94a3b8',
      width: stroke?.width ?? 1,
      style: style === 'dashed' || style === 'dotted' ? style : 'solid',
      borderRadius: this.props?.borderRadius || 0,
    };
  }


  get padding(): number {
    return this.props?.padding ?? 8;
  }

  get supportsText(): boolean {
    return shapeSupportsText(this.shapeType);
  }

  get supportsBorderRadius(): boolean {
    return true;
  }

  // ============================================
  // ACTIONS
  // ============================================


  onFillColorChange(color: string): void {
    this.updateObjectProps({ fillColor: color });
  }

  onOpacityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.min(100, Math.max(0, parseInt(input.value, 10) || 100));
    this.updateObjectProps({ opacity: value });
  }

  onBorderValueChange(value: BorderValue): void {
    const style = value.style === 'dashed' || value.style === 'dotted'
      ? value.style
      : 'solid';

    const updates: Partial<ObjectWidgetProps> = {
      stroke: {
        color: value.color || '#94a3b8',
        width: value.width ?? 1,
        style,
      },
    };
    
    if (value.borderRadius !== undefined) {
      updates.borderRadius = value.borderRadius;
    }
    
    this.updateObjectProps(updates);
  }


  onPaddingChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.max(0, parseInt(input.value, 10) || 0);
    this.updateObjectProps({ padding: value });
  }

  private updateObjectProps(updates: Partial<ObjectWidgetProps>): void {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'object') return;

    const { widget, pageId } = ctx;
    const currentProps = widget.props as ObjectWidgetProps;

    this.documentService.updateWidget(pageId, widget.id, {
      props: {
        ...currentProps,
        ...updates,
      } as ObjectWidgetProps,
    });
  }
}
