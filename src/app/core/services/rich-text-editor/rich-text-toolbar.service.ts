import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ClassicEditor } from 'ckeditor5';

/**
 * Service to manage the active CKEditor instance for a shared toolbar.
 * This allows multiple editor instances to share a single toolbar.
 */
@Injectable({
  providedIn: 'root',
})
export class RichTextToolbarService {
  private activeEditorSubject = new BehaviorSubject<ClassicEditor | null>(null);
  public readonly activeEditor$: Observable<ClassicEditor | null> = this.activeEditorSubject.asObservable();

  /**
   * Gets the currently active editor instance
   */
  get activeEditor(): ClassicEditor | null {
    return this.activeEditorSubject.value;
  }

  /**
   * Registers an editor as the active one
   */
  setActiveEditor(editor: ClassicEditor | null): void {
    this.activeEditorSubject.next(editor);
  }

  /**
   * Executes a command on the active editor
   * Preserves focus and selection
   */
  executeCommand(commandName: string, ...args: unknown[]): boolean {
    const editor = this.activeEditor;
    if (!editor) {
      return false;
    }

    try {
      // Save the current selection before executing command
      const model = editor.model;
      const selection = model.document.selection;
      
      // Execute the command
      editor.execute(commandName, ...args);
      
      // Restore focus to the editor after a brief delay
      // This ensures the selection is maintained
      setTimeout(() => {
        if (editor.ui && editor.ui.focusTracker) {
          const editableElement = editor.ui.getEditableElement();
          if (editableElement) {
            editableElement.focus();
          }
        }
      }, 10);
      
      return true;
    } catch (error) {
      console.warn(`Failed to execute command "${commandName}":`, error);
      return false;
    }
  }

  /**
   * Checks if a command is enabled on the active editor
   */
  isCommandEnabled(commandName: string): boolean {
    const editor = this.activeEditor;
    if (!editor) {
      return false;
    }

    try {
      const command = editor.commands.get(commandName);
      return command?.isEnabled ?? false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the value of a command on the active editor
   */
  getCommandValue(commandName: string): unknown {
    const editor = this.activeEditor;
    if (!editor) {
      return null;
    }

    try {
      const command = editor.commands.get(commandName);
      return command?.value ?? null;
    } catch (error) {
      return null;
    }
  }
}

