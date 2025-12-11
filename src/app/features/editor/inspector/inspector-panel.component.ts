import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { WidgetModel, TextWidgetProps } from '../../../models/widget.model';

@Component({
  selector: 'app-inspector-panel',
  templateUrl: './inspector-panel.component.html',
  styleUrls: ['./inspector-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectorPanelComponent {
  protected readonly editorState = inject(EditorStateService);

  private readonly documentService = inject(DocumentService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private suppressFormEmission = false;

  readonly hasWidgetSelected = computed(() => !!this.editorState.activeWidgetContext());

  readonly propertiesForm = this.fb.group({
    x: [0],
    y: [0],
    width: [120],
    height: [80],
    rotation: [0],
    zIndex: [0],
    fontSize: [16],
    fontColor: ['#0f172a'],
    backgroundColor: [''], // Default transparent/white background for text widgets
  });

  constructor() {
    this.propertiesForm.valueChanges
      .pipe(debounceTime(120), takeUntilDestroyed())
      .subscribe((value) => {
        if (this.suppressFormEmission) {
          return;
        }
        const context = this.editorState.activeWidgetContext();
        if (!context) {
          return;
        }
        const { widget, pageId, subsectionId } = context;
        
        // For text widgets, only update backgroundColor
        if (widget.type === 'text' && value.backgroundColor !== undefined) {
          const payload: Partial<WidgetModel> = {
            props: {
              ...widget.props,
              backgroundColor: value.backgroundColor,
            } as TextWidgetProps,
          };
          this.documentService.updateWidget(
            subsectionId,
            pageId,
            widget.id,
            payload
          );
        } else {
          // For other widgets, update all properties
          const payload: Partial<WidgetModel> = {
            position: {
              x: value.x ?? widget.position.x,
              y: value.y ?? widget.position.y,
            },
            size: {
              width: value.width ?? widget.size.width,
              height: value.height ?? widget.size.height,
            },
            rotation: value.rotation ?? widget.rotation,
            zIndex: value.zIndex ?? widget.zIndex,
            style: {
              ...widget.style,
              fontSize: value.fontSize,
              color: value.fontColor,
            },
          };
          this.documentService.updateWidget(
            subsectionId,
            pageId,
            widget.id,
            payload
          );
        }
      });

    effect(() => {
      const context = this.editorState.activeWidgetContext();

      if (!context) {
        this.propertiesForm.disable({ emitEvent: false });
        this.cdr.markForCheck();
        return;
      }

      this.propertiesForm.enable({ emitEvent: false });
      this.patchFormFromWidget(context.widget);
      this.cdr.markForCheck();
    });
  }

  clearSelection(): void {
    this.editorState.setActiveWidget(null);
  }

  private patchFormFromWidget(widget: WidgetModel): void {
    this.suppressFormEmission = true;
    const textProps = widget.type === 'text' ? (widget.props as TextWidgetProps) : null;
    
    if (widget.type === 'text') {
      // For text widgets, only patch backgroundColor
      this.propertiesForm.patchValue(
        {
          backgroundColor: textProps?.backgroundColor ?? '',
        },
        { emitEvent: false }
      );
    } else {
      // For other widgets, patch all properties
      this.propertiesForm.patchValue(
        {
          x: widget.position.x,
          y: widget.position.y,
          width: widget.size.width,
          height: widget.size.height,
          rotation: widget.rotation ?? 0,
          zIndex: widget.zIndex,
          fontSize: Number(widget.style?.fontSize ?? 16),
          fontColor: (widget.style?.color as string) ?? '#0f172a',
        },
        { emitEvent: false }
      );
    }
    this.suppressFormEmission = false;
  }

  get isTextWidget(): boolean {
    const context = this.editorState.activeWidgetContext();
    return context?.widget.type === 'text';
  }

  // Color palette for background color selection
  readonly colorPalette = [
    { value: '', label: 'Transparent' },
    { value: '#ffffff', label: 'White' },
    { value: '#ef4444', label: 'Red' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#f97316', label: 'Orange Red' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#fbbf24', label: 'Amber' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#000000', label: 'Black' },
  ];

  selectColor(color: string): void {
    this.propertiesForm.patchValue({ backgroundColor: color }, { emitEvent: true });
  }
}

