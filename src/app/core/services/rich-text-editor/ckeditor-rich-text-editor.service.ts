import { Injectable } from '@angular/core';
import {
  Alignment,
  Bold,
  ClassicEditor,
  EditorConfig,
  Essentials,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  Strikethrough,
  Table,
  TableToolbar,
  Underline,
} from 'ckeditor5';

import {
  RichTextEditor,
  RichTextEditorService,
} from './rich-text-editor.interface';

const LICENSE_KEY = 'GPL';

/**
 * CKEditor implementation of RichTextEditor
 */
class CkEditorInstance implements RichTextEditor {
  private static editorClass: typeof ClassicEditor | null = null;
  private static editorConfig: EditorConfig | null = null;

  static initialize(): void {
    if (this.editorClass && this.editorConfig) {
      return;
    }

    class TextWidgetEditor extends ClassicEditor {}
    TextWidgetEditor.builtinPlugins = [
      Essentials,
      Paragraph,
      Heading,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      List,
      Link,
      Alignment,
      FontFamily,
      FontSize,
      FontColor,
      FontBackgroundColor,
      Table,
      TableToolbar,
    ];

    const config: EditorConfig = {
      licenseKey: LICENSE_KEY,
      toolbar: {
        items: [
          'undo',
          'redo',
          '|',
          'heading',
          '|',
          'bold',
          'italic',
          'underline',
          'strikethrough',
          '|',
          'link',
          'bulletedList',
          'numberedList',
          '|',
          'alignment',
          '|',
          'fontFamily',
          'fontSize',
          'fontColor',
          'fontBackgroundColor',
          '|',
          'insertTable',
        ],
      },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
          { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        ],
      },
      table: {
        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
      },
    };

    TextWidgetEditor.defaultConfig = config;
    this.editorClass = TextWidgetEditor;
    this.editorConfig = config;
  }

  get Editor(): typeof ClassicEditor {
    CkEditorInstance.initialize();
    return CkEditorInstance.editorClass!;
  }

  get config(): Record<string, unknown> {
    CkEditorInstance.initialize();
    return CkEditorInstance.editorConfig! as Record<string, unknown>;
  }
}

/**
 * CKEditor implementation of RichTextEditorService
 */
@Injectable({
  providedIn: 'root',
})
export class CkEditorRichTextEditorService extends RichTextEditorService {
  createEditor(): RichTextEditor {
    return new CkEditorInstance();
  }
}


