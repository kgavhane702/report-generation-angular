import { Injectable } from '@angular/core';

import {
  Alignment,
  Bold,
  DecoupledEditor,
  EditorConfig,
  Essentials,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  Heading,
  Indent,
  IndentBlock,
  Italic,
  Link,
  List,
  ListProperties,
  Paragraph,
  Strikethrough,
  Table,
  TableColumnResize,
  TableProperties,
  TableCellProperties,
  TableToolbar,
  Underline,
  Superscript,
  Subscript,
} from 'ckeditor5';

import {
  RichTextEditor,
  RichTextEditorService,
} from './rich-text-editor.interface';

/**
 * CKEditor Rich Text Editor Implementation
 * 
 * A clean, smooth, and easy-to-use implementation of CKEditor5
 * that provides a comprehensive rich text editing experience using DecoupledEditor.
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
  private static editorClass: typeof DecoupledEditor | null = null;
  private static editorConfig: EditorConfig | null = null;

  /**
   * Gets the configured CKEditor class
   */
  get Editor(): typeof DecoupledEditor {
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
    class CustomEditor extends DecoupledEditor {}

    // Register all plugins
    CustomEditor.builtinPlugins = [
      Essentials,
      Paragraph,
      Heading,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      Superscript,
      Subscript,
      List,
      ListProperties,
      Link,
      Alignment,
      FontFamily,
      FontSize,
      FontColor,
      FontBackgroundColor,
      Indent,
      IndentBlock,
      Table,
      TableColumnResize,
      TableProperties,
      TableCellProperties,
      TableToolbar,
    ];

    // Configure editor settings with toolbar configuration
    // Toolbar will be rendered separately using decoupled editor
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
          'superscript',
          'subscript',
          '|',
          'link',
          'bulletedList',
          'numberedList',
          'listProperties',
          '|',
          'alignment',
          '|',
          'fontFamily',
          'fontSize',
          'fontColor',
          'fontBackgroundColor',
          '|',
          'indent',
          'outdent',
          '|',
          'insertTable',
        ],
        shouldNotGroupWhenFull: true,
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
      fontColor: {
        colors: [
          {
            color: 'hsl(0, 0%, 0%)',
            label: 'Black',
          },
          {
            color: 'hsl(0, 0%, 30%)',
            label: 'Dim grey',
          },
          {
            color: 'hsl(0, 0%, 60%)',
            label: 'Grey',
          },
          {
            color: 'hsl(0, 0%, 90%)',
            label: 'Light grey',
          },
          {
            color: 'hsl(0, 0%, 100%)',
            label: 'White',
          },
          {
            color: 'hsl(0, 75%, 60%)',
            label: 'Red',
          },
          {
            color: 'hsl(30, 75%, 60%)',
            label: 'Orange',
          },
          {
            color: 'hsl(60, 75%, 60%)',
            label: 'Yellow',
          },
          {
            color: 'hsl(90, 75%, 60%)',
            label: 'Light green',
          },
          {
            color: 'hsl(120, 75%, 60%)',
            label: 'Green',
          },
          {
            color: 'hsl(150, 75%, 60%)',
            label: 'Aquamarine',
          },
          {
            color: 'hsl(180, 75%, 60%)',
            label: 'Turquoise',
          },
          {
            color: 'hsl(210, 75%, 60%)',
            label: 'Light blue',
          },
          {
            color: 'hsl(240, 75%, 60%)',
            label: 'Blue',
          },
          {
            color: 'hsl(270, 75%, 60%)',
            label: 'Purple',
          },
        ],
      },
      fontBackgroundColor: {
        colors: [
          {
            color: 'hsl(0, 0%, 0%)',
            label: 'Black',
          },
          {
            color: 'hsl(0, 0%, 30%)',
            label: 'Dim grey',
          },
          {
            color: 'hsl(0, 0%, 60%)',
            label: 'Grey',
          },
          {
            color: 'hsl(0, 0%, 90%)',
            label: 'Light grey',
          },
          {
            color: 'hsl(0, 0%, 100%)',
            label: 'White',
          },
          {
            color: 'hsl(0, 75%, 60%)',
            label: 'Red',
          },
          {
            color: 'hsl(30, 75%, 60%)',
            label: 'Orange',
          },
          {
            color: 'hsl(60, 75%, 60%)',
            label: 'Yellow',
          },
          {
            color: 'hsl(90, 75%, 60%)',
            label: 'Light green',
          },
          {
            color: 'hsl(120, 75%, 60%)',
            label: 'Green',
          },
          {
            color: 'hsl(150, 75%, 60%)',
            label: 'Aquamarine',
          },
          {
            color: 'hsl(180, 75%, 60%)',
            label: 'Turquoise',
          },
          {
            color: 'hsl(210, 75%, 60%)',
            label: 'Light blue',
          },
          {
            color: 'hsl(240, 75%, 60%)',
            label: 'Blue',
          },
          {
            color: 'hsl(270, 75%, 60%)',
            label: 'Purple',
          },
        ],
      },
      table: {
        contentToolbar: [
          'tableColumn',
          'tableRow',
          'mergeTableCells',
          'splitCell',
          'toggleTableColumnHeader',
          'toggleTableRowHeader',
          'tableProperties',
          'tableCellProperties',
        ],
        tableProperties: {
          borderColors: [
            '#000000',
            '#e5e7eb',
            '#d1d5db',
            '#9ca3af',
            '#6b7280',
            '#4b5563',
            '#374151',
            '#1f2937',
            '#111827',
            '#dc2626',
            '#ea580c',
            '#f59e0b',
            '#10b981',
            '#3b82f6',
            '#8b5cf6',
            '#ec4899',
          ],
          backgroundColors: [
            '#ffffff',
            '#f9fafb',
            '#f3f4f6',
            '#e5e7eb',
            '#d1d5db',
            '#9ca3af',
            '#6b7280',
            '#fef2f2',
            '#fff7ed',
            '#fffbeb',
            '#f0fdf4',
            '#eff6ff',
            '#f5f3ff',
            '#fdf2f8',
          ],
        },
        tableCellProperties: {
          borderColors: [
            '#000000',
            '#e5e7eb',
            '#d1d5db',
            '#9ca3af',
            '#6b7280',
            '#4b5563',
            '#374151',
            '#1f2937',
            '#111827',
            '#dc2626',
            '#ea580c',
            '#f59e0b',
            '#10b981',
            '#3b82f6',
            '#8b5cf6',
            '#ec4899',
          ],
          backgroundColors: [
            '#ffffff',
            '#f9fafb',
            '#f3f4f6',
            '#e5e7eb',
            '#d1d5db',
            '#9ca3af',
            '#6b7280',
            '#fef2f2',
            '#fff7ed',
            '#fffbeb',
            '#f0fdf4',
            '#eff6ff',
            '#f5f3ff',
            '#fdf2f8',
          ],
        },
      },
      list: {
        properties: {
          styles: true,
          startIndex: true,
          reversed: true,
        },
      },
      indentBlock: {
        offset: 40,
        unit: 'px',
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
