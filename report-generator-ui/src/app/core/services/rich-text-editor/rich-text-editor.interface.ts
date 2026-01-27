/**
 * Abstraction interface for rich text editors.
 * This allows swapping CKEditor with Tiptap, Quill, or any other editor
 * by implementing this interface.
 */
export interface RichTextEditor {
  /**
   * The editor class/constructor (for Angular component binding)
   */
  readonly Editor: any;

  /**
   * Editor configuration object
   */
  readonly config: Record<string, unknown>;
}

/**
 * Abstract service class for creating rich text editor instances.
 * Implement this class to provide different editor implementations.
 */
export abstract class RichTextEditorService {
  /**
   * Creates and returns a rich text editor instance
   */
  abstract createEditor(): RichTextEditor;
}


