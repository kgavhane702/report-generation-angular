import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EditorStateService } from '../../../../../../core/services/editor-state.service';
import { DocumentService } from '../../../../../../core/services/document.service';
import type { ConnectorWidgetProps } from '../../../../../../models/widget.model';
import { BorderPickerComponent, type BorderValue } from '../../../../../../shared/components/border-picker/border-picker.component';
import type { ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';

@Component({
  selector: 'app-connector-toolbar',
  standalone: true,
  imports: [CommonModule, BorderPickerComponent],
  templateUrl: './connector-toolbar.component.html',
  styleUrls: ['./connector-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectorToolbarComponent {
  private readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);

  readonly activeConnectorProps = computed<ConnectorWidgetProps | null>(() => {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'connector') return null;
    return (ctx.widget.props as ConnectorWidgetProps) ?? null;
  });

  // Palette consistent with other toolbars.
  readonly lineColorPalette: ColorOption[] = [
    { value: '#94a3b8', label: 'Light Slate (Default)' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#ef4444', label: 'Red' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#ffffff', label: 'White' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#000000', label: 'Black' },
  ];

  get props(): ConnectorWidgetProps | null {
    return this.activeConnectorProps();
  }

  get borderValue(): BorderValue {
    const p = this.props;
    const stroke = p?.stroke;
    const color = stroke?.color || p?.fillColor || '#94a3b8';
    const style = stroke?.style;

    return {
      color,
      width: stroke?.width ?? 2,
      style: style === 'dashed' || style === 'dotted' || style === 'none' ? style : 'solid',
      borderRadius: 0,
    };
  }

  onLineStrokeChange(value: BorderValue): void {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'connector') return;

    const { widget, pageId } = ctx;
    const currentProps = (widget.props as ConnectorWidgetProps) ?? ({} as ConnectorWidgetProps);

    const nextColor = value.color || '#94a3b8';
    const nextStyle = value.style === 'dashed' || value.style === 'dotted' || value.style === 'none'
      ? value.style
      : 'solid';

    this.documentService.updateWidget(pageId, widget.id, {
      props: {
        ...currentProps,
        // Keep legacy fillColor in sync for backward compatibility with old data/export paths.
        fillColor: nextColor,
        stroke: {
          ...(currentProps.stroke ?? { color: '#94a3b8', width: 2, style: 'solid' }),
          color: nextColor,
          width: value.width ?? 2,
          style: nextStyle,
        },
      } as ConnectorWidgetProps,
    });
  }
}
