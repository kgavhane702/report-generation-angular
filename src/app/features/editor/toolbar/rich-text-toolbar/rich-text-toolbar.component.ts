import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RichTextToolbarService } from '../../../../core/services/rich-text-editor/rich-text-toolbar.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { ClassicEditor } from 'ckeditor5';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-rich-text-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rich-text-toolbar.component.html',
  styleUrls: ['./rich-text-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextToolbarComponent implements OnInit, OnDestroy {
  private readonly toolbarService = inject(RichTextToolbarService);
  private readonly editorState = inject(EditorStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private activeEditor: ClassicEditor | null = null;
  private editorSubscription?: Subscription;
  private commandStateUpdateInterval?: number;
  private isDropdownOpen = false;
  
  // Track if a text widget is active
  isTextWidgetActive = false;

  // Command states
  isUndoEnabled = false;
  isRedoEnabled = false;
  isBoldEnabled = false;
  isBoldActive = false;
  isItalicEnabled = false;
  isItalicActive = false;
  isUnderlineEnabled = false;
  isUnderlineActive = false;
  isStrikethroughEnabled = false;
  isStrikethroughActive = false;
  headingValue: string | null = null;
  alignmentValue: string | null = null;
  fontFamilyValue: string | null = null;
  fontSizeValue: string | null = null;
  fontColorValue: string | null = null;
  fontBackgroundColorValue: string | null = null;

  constructor() {
    // Watch for active widget changes to determine if a text widget is selected
    effect(() => {
      const activeWidget = this.editorState.activeWidget();
      this.isTextWidgetActive = activeWidget?.type === 'text';
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Subscribe to active editor changes
    this.editorSubscription = this.toolbarService.activeEditor$.subscribe((editor) => {
      this.activeEditor = editor;
      this.updateCommandStates();
      this.cdr.markForCheck();
    });

    // Periodically update command states to reflect editor changes
    this.commandStateUpdateInterval = window.setInterval(() => {
      if (this.activeEditor) {
        this.updateCommandStates();
        this.cdr.markForCheck();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.editorSubscription) {
      this.editorSubscription.unsubscribe();
    }
    if (this.commandStateUpdateInterval) {
      clearInterval(this.commandStateUpdateInterval);
    }
  }

  private updateCommandStates(): void {
    if (!this.activeEditor) {
      // Reset all states when no editor is active
      this.isUndoEnabled = false;
      this.isRedoEnabled = false;
      this.isBoldEnabled = false;
      this.isBoldActive = false;
      this.isItalicEnabled = false;
      this.isItalicActive = false;
      this.isUnderlineEnabled = false;
      this.isUnderlineActive = false;
      this.isStrikethroughEnabled = false;
      this.isStrikethroughActive = false;
      this.headingValue = null;
      this.alignmentValue = null;
      this.fontFamilyValue = null;
      this.fontSizeValue = null;
      this.fontColorValue = null;
      this.fontBackgroundColorValue = null;
      return;
    }

    try {
      this.isUndoEnabled = this.toolbarService.isCommandEnabled('undo');
      this.isRedoEnabled = this.toolbarService.isCommandEnabled('redo');
      this.isBoldEnabled = this.toolbarService.isCommandEnabled('bold');
      this.isBoldActive = this.toolbarService.getCommandValue('bold') === true;
      this.isItalicEnabled = this.toolbarService.isCommandEnabled('italic');
      this.isItalicActive = this.toolbarService.getCommandValue('italic') === true;
      this.isUnderlineEnabled = this.toolbarService.isCommandEnabled('underline');
      this.isUnderlineActive = this.toolbarService.getCommandValue('underline') === true;
      this.isStrikethroughEnabled = this.toolbarService.isCommandEnabled('strikethrough');
      this.isStrikethroughActive = this.toolbarService.getCommandValue('strikethrough') === true;
      this.headingValue = this.toolbarService.getCommandValue('heading') as string | null;
      this.alignmentValue = this.toolbarService.getCommandValue('alignment') as string | null;
      this.fontFamilyValue = this.toolbarService.getCommandValue('fontFamily') as string | null;
      this.fontSizeValue = this.toolbarService.getCommandValue('fontSize') as string | null;
      this.fontColorValue = this.toolbarService.getCommandValue('fontColor') as string | null;
      this.fontBackgroundColorValue = this.toolbarService.getCommandValue('fontBackgroundColor') as string | null;
    } catch (error) {
      console.warn('Error updating command states:', error);
    }
  }

  executeCommand(commandName: string, event: Event | null, ...args: unknown[]): void {
    if (!this.activeEditor) {
      return;
    }

    // Prevent default behavior to maintain editor focus (but not for selects)
    if (event && event.target && (event.target as HTMLElement).tagName !== 'SELECT') {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Execute the command
    this.toolbarService.executeCommand(commandName, ...args);
    
    // Refocus the editor to maintain selection and cursor (only if dropdown is not open)
    if (!this.isDropdownOpen) {
      setTimeout(() => {
        if (this.activeEditor && this.activeEditor.ui) {
          const editableElement = this.activeEditor.ui.getEditableElement();
          if (editableElement) {
            editableElement.focus();
          }
        }
        // Update states after a short delay to reflect changes
        this.updateCommandStates();
        this.cdr.markForCheck();
      }, 50);
    } else {
      // Just update states without refocusing
      setTimeout(() => {
        this.updateCommandStates();
        this.cdr.markForCheck();
      }, 50);
    }
  }

  handleButtonClick(commandName: string, event: MouseEvent, ...args: unknown[]): void {
    event.preventDefault();
    event.stopPropagation();
    this.executeCommand(commandName, event, ...args);
  }

  handleSelectChange(commandName: string, event: Event, ...args: unknown[]): void {
    // Don't prevent default - allow the select to work normally
    // Extract the value from the event target
    const selectElement = event.target as HTMLSelectElement;
    const value = selectElement.value;
    
    // CKEditor command formats:
    // - fontFamily: editor.execute('fontFamily', 'Arial, Helvetica, sans-serif')
    // - fontSize: editor.execute('fontSize', '17') or editor.execute('fontSize', 17)
    // - heading: editor.execute('heading', { value: 'heading2' })
    // - alignment: editor.execute('alignment', { value: 'center' })
    
    if (commandName === 'fontFamily') {
      // Pass font family value directly as string
      this.executeCommand(commandName, null, value);
    } else if (commandName === 'fontSize') {
      // Convert fontSize to number if it's not 'default', otherwise pass as string
      const fontSizeValue = value === 'default' ? 'default' : value;
      this.executeCommand(commandName, null, fontSizeValue);
    } else if (commandName === 'heading') {
      // Heading expects an object with value property
      this.executeCommand(commandName, null, { value });
    } else if (commandName === 'alignment') {
      // Alignment expects an object with value property
      this.executeCommand(commandName, null, { value });
    } else {
      // For other commands, use the args as provided
      this.executeCommand(commandName, null, ...args);
    }
  }

  handleColorChange(commandName: string, event: Event, ...args: unknown[]): void {
    // Don't prevent default - allow the color picker to work normally
    // Just execute the command and refocus
    this.executeCommand(commandName, null, ...args);
  }

  handleColorFocus(event: Event): void {
    // Mark color picker as open
    this.isDropdownOpen = true;
  }

  handleColorBlur(event: Event): void {
    // Mark color picker as closed and refocus editor
    this.isDropdownOpen = false;
    setTimeout(() => {
      this.refocusEditor();
    }, 50);
  }

  refocusEditor(): void {
    // Only refocus if dropdown is not open
    if (this.isDropdownOpen) {
      return;
    }
    
    // Refocus the editor when dropdown/color picker loses focus
    setTimeout(() => {
      // Double-check dropdown is still not open
      if (!this.isDropdownOpen && this.activeEditor && this.activeEditor.ui) {
        const editableElement = this.activeEditor.ui.getEditableElement();
        if (editableElement) {
          editableElement.focus();
        }
      }
    }, 10);
  }

  handleSelectFocus(event: Event): void {
    // Mark dropdown as open when select gets focus
    this.isDropdownOpen = true;
  }

  handleSelectBlur(event: Event): void {
    // Mark dropdown as closed and refocus editor
    this.isDropdownOpen = false;
    // Small delay to ensure dropdown closes first
    setTimeout(() => {
      this.refocusEditor();
    }, 50);
  }

  get hasActiveEditor(): boolean {
    // Show toolbar if a text widget is active, even if editor isn't focused yet
    // The editor will be registered when the widget becomes active
    return this.isTextWidgetActive;
  }
}

