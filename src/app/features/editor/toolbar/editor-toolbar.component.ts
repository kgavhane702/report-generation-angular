import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { WidgetFactoryService } from '../widgets/widget-factory.service';
import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { WidgetType } from '../../../models/widget.model';
import { PageSize } from '../../../models/document.model';

interface PagePreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

@Component({
  selector: 'app-editor-toolbar',
  templateUrl: './editor-toolbar.component.html',
  styleUrls: ['./editor-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent {
  private readonly widgetFactory = inject(WidgetFactoryService);
  protected readonly documentService = inject(DocumentService);
  private readonly editorState = inject(EditorStateService);

  readonly document$ = this.documentService.document$;

  readonly pageSizePresets: PagePreset[] = [
    { id: 'ppt-wide', label: 'PPT Widescreen 16:9 (13.33" × 7.5")', widthMm: 338.67, heightMm: 190.5 },
    { id: 'ppt-standard', label: 'PPT Standard 4:3 (10" × 7.5")', widthMm: 254, heightMm: 190.5 },
    { id: 'a4', label: 'A4 (297 × 210 mm)', widthMm: 297, heightMm: 210 },
  ];

  addWidget(type: WidgetType): void {
    const subsectionId = this.editorState.activeSubsectionId();
    const pageId = this.editorState.activePageId();

    if (!subsectionId || !pageId) {
      return;
    }

    const widget = this.widgetFactory.createWidget(type);
    this.documentService.addWidget(subsectionId, pageId, widget);
  }

  applyPreset(presetId: string): void {
    const preset = this.pageSizePresets.find((p) => p.id === presetId);
    if (!preset) {
      return;
    }
    this.documentService.updatePageSize({
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
    });
  }

  setOrientation(orientation: 'portrait' | 'landscape'): void {
    this.documentService.updatePageSize({ orientation });
  }

  getPresetId(pageSize: PageSize): string {
    const current = [pageSize.widthMm, pageSize.heightMm].sort();
    const match = this.pageSizePresets.find((preset) => {
      const presetDims = [preset.widthMm, preset.heightMm].sort();
      return (
        Math.abs(presetDims[0] - current[0]) < 0.5 &&
        Math.abs(presetDims[1] - current[1]) < 0.5
      );
    });
    return match?.id ?? 'custom';
  }
}

