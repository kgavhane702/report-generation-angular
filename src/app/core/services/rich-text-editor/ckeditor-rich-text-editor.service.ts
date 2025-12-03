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

const LICENSE_KEY =
  'eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NjUwNjU1OTksImp0aSI6Ijg1YWQ4MjAxLTc0YzctNDAzNi04MjMwLWE4MjQyMmI1N2JkZCIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6ImY2MzhhZDBjIn0.AGy8x5nxrh4P7aw3QHRK_2OaIlYgL_ziwX5DjGkkUknBH97-8zgyRUZIq5JhegH2bOg0hAP1r7XQzgS2qMRJZg';

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


