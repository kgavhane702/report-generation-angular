import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
} from '@angular/core';

import {
  TextWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';
import { RichTextEditorService } from '../../../../core/services/rich-text-editor/rich-text-editor.interface';
import { CkEditorRichTextEditorService } from '../../../../core/services/rich-text-editor/ckeditor-rich-text-editor.service';
import { RichTextToolbarService } from '../../../../core/services/rich-text-editor/rich-text-toolbar.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { DecoupledEditor } from 'ckeditor5';

/**
 * TextWidgetComponent
 * 
 * REFACTORED to use local editing state:
 * 1. CKEditor content is kept in local signal during editing
 * 2. Changes are ONLY emitted when user finishes editing (blur)
 * 3. External updates are ignored while actively editing
 * 
 * This prevents:
 * - CKEditor losing focus during typing
 * - Cursor position resetting
 * - Content flickering
 */
@Component({
  selector: 'app-text-widget',
  templateUrl: './text-widget.component.html',
  styleUrls: ['./text-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: RichTextEditorService, useClass: CkEditorRichTextEditorService },
  ],
})
export class TextWidgetComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<TextWidgetProps>>();

  @ViewChild('editorContainer', { static: false }) editorContainer?: ElementRef<HTMLElement>;

  // ============================================
  // INJECTED SERVICES
  // ============================================
  
  private readonly editorService = inject(RichTextEditorService);
  private readonly toolbarService = inject(RichTextToolbarService);
  private readonly uiState = inject(UIStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  
  // ============================================
  // EDITOR CONFIGURATION
  // ============================================
  
  private editorInstance = this.editorService.createEditor();
  readonly Editor = this.editorInstance.Editor;
  readonly editorConfig = this.editorInstance.config;

  // ============================================
  // LOCAL EDITING STATE
  // This is the key architectural change!
  // ============================================
  
  /**
   * Local content during editing - NOT synced to store while editing
   * This prevents store updates during typing which would cause re-renders
   */
  private readonly localContent = signal<string>('');
  
  /**
   * Track if we're actively editing (user has focus)
   * While true, we ignore external widget updates
   */
  private readonly isActivelyEditing = signal<boolean>(false);
  
  /**
   * Content that was in the store when editing started
   * Used to detect if content changed externally
   */
  private contentAtEditStart = '';
  
  // ============================================
  // EDITOR STATE
  // ============================================
  
  private currentEditorInstance: DecoupledEditor | null = null;
  private isEditorInitialized = false;
  private blurTimeoutId: number | null = null;
  private isClickingInsideEditor = false;

  // ============================================
  // PUBLIC GETTERS
  // ============================================
  
  /**
   * Whether we're in editing mode
   */
  get editing(): boolean {
    return this.isActivelyEditing();
  }

  get textProps(): TextWidgetProps {
    return this.widget.props as TextWidgetProps;
  }

  get backgroundColor(): string {
    const bgColor = this.textProps.backgroundColor;
    return bgColor && bgColor.trim() !== '' ? bgColor : 'transparent';
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  ngOnInit(): void {
    // Initialize local content with widget content
    this.localContent.set(this.textProps.contentHtml ?? '');
    
    // Listen to mousedown events to detect clicks inside editor/toolbar
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
  }

  ngAfterViewInit(): void {
    // Initialize DecoupledEditor after view is ready
    if (this.editorContainer && !this.isEditorInitialized) {
      this.initializeEditor();
    }
  }

  ngOnDestroy(): void {
    // Commit any pending changes before destroying
    if (this.isActivelyEditing()) {
      this.commitContentChange();
    }
    
    // Clean up event listener
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }
    
    // Unregister editor from toolbar service
    if (this.currentEditorInstance && this.toolbarService.activeEditor === this.currentEditorInstance) {
      this.toolbarService.setActiveEditor(null, null);
    }
    
    // Destroy editor instance
    if (this.currentEditorInstance) {
      this.currentEditorInstance.destroy().catch(() => {
        // Error handled silently
      });
      this.currentEditorInstance = null;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.currentEditorInstance) {
      // KEY CHANGE: Only update if NOT actively editing
      if (!this.isActivelyEditing()) {
        const newContent = this.textProps.contentHtml ?? '';
        this.localContent.set(newContent);
        
        // Update editor content if it changed externally
        if (this.currentEditorInstance.getData() !== newContent) {
          this.currentEditorInstance.setData(newContent);
        }
      }
      // If actively editing, we ignore external updates to prevent:
      // - Cursor position reset
      // - Content flickering
      // - Focus loss
    }
  }

  // ============================================
  // EDITOR INITIALIZATION
  // ============================================

  private async initializeEditor(): Promise<void> {
    if (!this.editorContainer || this.isEditorInitialized) {
      return;
    }

    try {
      const EditorClass = this.Editor;
      const config = this.editorConfig;

      // Create DecoupledEditor instance with local content
      const editor = await EditorClass.create(this.localContent(), config) as DecoupledEditor;

      // Get the editable element and mount it to the container
      const editableElement = editor.ui.getEditableElement();
      if (editableElement && this.editorContainer) {
        this.editorContainer.nativeElement.appendChild(editableElement);
      }

      // Store editor instance
      this.currentEditorInstance = editor;
      this.isEditorInitialized = true;

      // Set up data change listener
      // KEY CHANGE: Only update local signal, NOT store
      editor.model.document.on('change:data', () => {
        // Update local content signal (no store update!)
        this.localContent.set(editor.getData());
        this.cdr.markForCheck();
      });

      // Set up focus/blur handlers
      editor.ui.focusTracker.on('change:isFocused', () => {
        if (editor.ui.focusTracker.isFocused) {
          this.handleEditorFocus();
        } else {
          this.handleEditorBlur();
        }
      });

      // Register editor if this widget is active
      if (this.uiState.activeWidgetId() === this.widget.id) {
        const toolbarElement = editor.ui.view.toolbar.element;
        this.toolbarService.setActiveEditor(editor, toolbarElement);
      }

      this.cdr.markForCheck();
    } catch {
      // Error handled silently
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private handleDocumentMouseDown = (event: MouseEvent): void => {
    // Check if click is inside the editor container or the rich text toolbar
    if (this.editorContainer?.nativeElement) {
      const target = event.target as Node;
      const isInsideEditor = this.editorContainer.nativeElement.contains(target);
      
      // Also check if click is on the rich text toolbar
      const toolbarElement = document.querySelector('app-rich-text-toolbar');
      const isInsideToolbar = toolbarElement?.contains(target) ?? false;
      
      this.isClickingInsideEditor = isInsideEditor || isInsideToolbar;
    }
  };

  private handleEditorFocus(): void {
    if (!this.currentEditorInstance) {
      return;
    }

    // Register this editor as the active one for the shared toolbar
    const toolbarElement = this.currentEditorInstance.ui.view.toolbar.element;
    this.toolbarService.setActiveEditor(this.currentEditorInstance, toolbarElement);

    // Clear any pending blur timeout
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }

    // Start editing mode
    if (!this.isActivelyEditing()) {
      this.isActivelyEditing.set(true);
      this.contentAtEditStart = this.textProps.contentHtml ?? '';
      this.editingChange.emit(true);
    }
  }

  private handleEditorBlur(): void {
    if (!this.isActivelyEditing()) {
      return;
    }

    // Use a small delay to check if the blur was caused by clicking inside the editor or toolbar
    // This prevents premature saving when clicking toolbar buttons or dragging
    this.blurTimeoutId = window.setTimeout(() => {
      // Check if the active element is still within the editor container or toolbar
      const activeElement = document.activeElement;
      const toolbarElement = document.querySelector('app-rich-text-toolbar');
      const isStillInsideEditor = activeElement && 
        this.editorContainer?.nativeElement?.contains(activeElement);
      const isStillInsideToolbar = activeElement && 
        toolbarElement?.contains(activeElement);
      
      // Only commit and exit editing if focus moved completely outside
      if (!isStillInsideEditor && !isStillInsideToolbar && !this.isClickingInsideEditor) {
        // Commit the content change - this is the ONLY time we update the store
        this.commitContentChange();
        
        // Exit editing mode
        this.isActivelyEditing.set(false);
        this.editingChange.emit(false);
      } else if (isStillInsideToolbar && this.currentEditorInstance) {
        // Focus moved to toolbar - refocus editor after toolbar interaction
        const activeElement = document.activeElement;
        const isSelectElement = activeElement && activeElement.tagName === 'SELECT';
        
        // Only refocus if it's not a select dropdown
        if (!isSelectElement) {
          setTimeout(() => {
            if (this.currentEditorInstance && this.currentEditorInstance.ui) {
              const editableElement = this.currentEditorInstance.ui.getEditableElement();
              if (editableElement) {
                editableElement.focus();
              }
            }
          }, 10);
        }
      }
      
      // Reset the flag after checking
      this.isClickingInsideEditor = false;
      this.blurTimeoutId = null;
    }, 150);
  }

  // ============================================
  // CONTENT MANAGEMENT
  // ============================================

  /**
   * Commit the local content to the store
   * This is called ONLY when editing is complete (blur)
   */
  private commitContentChange(): void {
    const currentContent = this.localContent();
    const originalContent = this.contentAtEditStart;
    
    // Only emit if content actually changed
    if (currentContent !== originalContent) {
      this.propsChange.emit({ contentHtml: currentContent });
    }
  }
}
