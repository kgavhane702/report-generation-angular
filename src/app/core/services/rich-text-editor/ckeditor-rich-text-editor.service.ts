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

/**
 * CKEditor Rich Text Editor Implementation
 * 
 * A clean, smooth, and easy-to-use implementation of CKEditor5
 * that provides a comprehensive rich text editing experience.
 */
@Injectable({
  providedIn: 'root',
})
export class CkEditorRichTextEditorService extends RichTextEditorService {
  /**
   * Creates a new CKEditor instance with optimized configuration
   */
  createEditor(): RichTextEditor {
    return new CkEditorInstance();
  }
}

/**
 * CKEditor Instance Wrapper
 * 
 * Encapsulates the CKEditor configuration and provides
 * a clean interface for Angular components.
 */
class CkEditorInstance implements RichTextEditor {
  private static editorClass: typeof ClassicEditor | null = null;
  private static editorConfig: EditorConfig | null = null;

  /**
   * Gets the configured CKEditor class
   */
  get Editor(): typeof ClassicEditor {
    this.ensureInitialized();
    return CkEditorInstance.editorClass!;
  }

  /**
   * Gets the editor configuration
   */
  get config(): Record<string, unknown> {
    this.ensureInitialized();
    return CkEditorInstance.editorConfig! as Record<string, unknown>;
  }

  /**
   * Ensures the editor is initialized (lazy initialization)
   */
  private ensureInitialized(): void {
    if (CkEditorInstance.editorClass && CkEditorInstance.editorConfig) {
      return;
    }

    this.initializeEditor();
  }

  /**
   * Initializes the CKEditor with all plugins and configuration
   */
  private initializeEditor(): void {
    // Create custom editor class with all required plugins
    class CustomEditor extends ClassicEditor {}

    // Register all plugins
    CustomEditor.builtinPlugins = [
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

    // Configure editor settings
    const config: EditorConfig = {
      licenseKey: 'GPL',
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
          {
            model: 'paragraph',
            title: 'Paragraph',
            class: 'ck-heading_paragraph',
          },
          {
            model: 'heading2',
            view: 'h2',
            title: 'Heading 2',
            class: 'ck-heading_heading2',
          },
          {
            model: 'heading3',
            view: 'h3',
            title: 'Heading 3',
            class: 'ck-heading_heading3',
          },
        ],
      },
      fontFamily: {
        options: [
          'default',
          'Arial, Helvetica, sans-serif',
          'Courier New, Courier, monospace',
          'Georgia, serif',
          'Lucida Sans Unicode, Lucida Grande, sans-serif',
          'Tahoma, Geneva, sans-serif',
          'Times New Roman, Times, serif',
          'Trebuchet MS, Helvetica, sans-serif',
          'Verdana, Geneva, sans-serif',
        ],
      },
      fontSize: {
        options: [9, 11, 13, 'default', 17, 19, 21, 24, 28, 32, 36, 48, 60, 72],
      },
      table: {
        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
      },
      link: {
        decorators: {
          openInNewTab: {
            mode: 'manual',
            label: 'Open in a new tab',
            attributes: {
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          },
        },
      },
      // Performance optimizations
      removePlugins: [],
      // UI improvements
      placeholder: 'Start typing...',
    };

    // Set default configuration
    CustomEditor.defaultConfig = config;

    // Cache the editor class and config
    CkEditorInstance.editorClass = CustomEditor;
    CkEditorInstance.editorConfig = config;
  }
}
