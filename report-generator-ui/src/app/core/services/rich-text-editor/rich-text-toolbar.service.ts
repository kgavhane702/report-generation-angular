import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DecoupledEditor } from 'ckeditor5';

/**
 * Service to manage the active CKEditor instance and toolbar for a shared toolbar.
 * This allows multiple editor instances to share a single toolbar location.
 */
@Injectable({
  providedIn: 'root',
})
export class RichTextToolbarService {
  private activeEditorSubject = new BehaviorSubject<DecoupledEditor | null>(null);
  private activeToolbarSubject = new BehaviorSubject<HTMLElement | null>(null);
  
  public readonly activeEditor$: Observable<DecoupledEditor | null> = this.activeEditorSubject.asObservable();
  public readonly activeToolbar$: Observable<HTMLElement | null> = this.activeToolbarSubject.asObservable();

  /**
   * Gets the currently active editor instance
   */
  get activeEditor(): DecoupledEditor | null {
    return this.activeEditorSubject.value;
  }

  /**
   * Gets the currently active toolbar element
   */
  get activeToolbar(): HTMLElement | null {
    return this.activeToolbarSubject.value;
  }

  /**
   * Registers an editor and its toolbar as the active ones
   */
  setActiveEditor(editor: DecoupledEditor | null, toolbarElement: HTMLElement | null): void {
    // Remove previous toolbar from DOM if it exists
    const previousToolbar = this.activeToolbarSubject.value;
    if (previousToolbar && previousToolbar.parentNode) {
      previousToolbar.parentNode.removeChild(previousToolbar);
    }

    this.activeEditorSubject.next(editor);
    this.activeToolbarSubject.next(toolbarElement);
  }
}

