import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../../../../../../core/services/editor-state.service';
import { DocumentService } from '../../../../../../core/services/document.service';
import { TextWidgetProps } from '../../../../../../models/widget.model';
import { ColorPickerComponent, ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';

@Component({
  selector: 'app-text-widget-color-picker',
  standalone: true,
  imports: [CommonModule, ColorPickerComponent],
  templateUrl: './text-widget-color-picker.component.html',
  styleUrls: ['./text-widget-color-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextWidgetColorPickerComponent {
  private readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);

  readonly isTextWidgetSelected = computed(() => {
    const context = this.editorState.activeWidgetContext();
    return context?.widget.type === 'text';
  });

  readonly currentColor = computed(() => {
    const context = this.editorState.activeWidgetContext();
    if (context?.widget.type === 'text') {
      const textProps = context.widget.props as TextWidgetProps;
      return textProps.backgroundColor || '';
    }
    return '';
  });

  // Color palette matching the inspector panel
  readonly colorPalette: ColorOption[] = [
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
    const context = this.editorState.activeWidgetContext();
    if (!context || context.widget.type !== 'text') {
      return;
    }

    const { widget, pageId } = context;
    this.documentService.updateWidget(pageId, widget.id, {
      props: {
        ...widget.props,
        backgroundColor: color,
      } as TextWidgetProps,
    });
  }
}

