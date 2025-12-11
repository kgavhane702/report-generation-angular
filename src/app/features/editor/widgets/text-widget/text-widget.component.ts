import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
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
} from '@angular/core';

import {
  TextWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';
import { RichTextEditorService } from '../../../../core/services/rich-text-editor/rich-text-editor.interface';
import { CkEditorRichTextEditorService } from '../../../../core/services/rich-text-editor/ckeditor-rich-text-editor.service';
import { RichTextToolbarService } from '../../../../core/services/rich-text-editor/rich-text-toolbar.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { ClassicEditor } from 'ckeditor5';

@Component({
  selector: 'app-text-widget',
  templateUrl: './text-widget.component.html',
  styleUrls: ['./text-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: RichTextEditorService, useClass: CkEditorRichTextEditorService },
  ],
})
export class TextWidgetComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<TextWidgetProps>>();

  @ViewChild('editorContainer', { static: false }) editorContainer?: ElementRef<HTMLElement>;

  private readonly editorService = inject(RichTextEditorService);
  private readonly toolbarService = inject(RichTextToolbarService);
  private readonly editorState = inject(EditorStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private editorInstance = this.editorService.createEditor();

  readonly Editor = this.editorInstance.Editor;
  readonly editorConfig = this.editorInstance.config;

  editing = false;
  editorData = '';
  private blurTimeoutId: number | null = null;
  private isClickingInsideEditor = false;
  private currentEditorInstance: ClassicEditor | null = null;

  constructor() {
    // Watch for widget selection changes
    effect(() => {
      const activeWidgetId = this.editorState.activeWidgetId();
      const isThisWidgetActive = activeWidgetId === this.widget?.id;
      
      if (isThisWidgetActive && this.currentEditorInstance) {
        // Register editor when this widget becomes active
        this.toolbarService.setActiveEditor(this.currentEditorInstance);
      } else if (!isThisWidgetActive && this.toolbarService.activeEditor === this.currentEditorInstance) {
        // Unregister when this widget becomes inactive (only if it was the active editor)
        // But don't unregister if the editor is still being edited (focused)
        if (!this.editing) {
          this.toolbarService.setActiveEditor(null);
        }
      }
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Initialize with widget content
    this.editorData = this.textProps.contentHtml ?? '';
    
    // Listen to mousedown events to detect clicks inside editor/toolbar
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
    
    // If this widget is already active, register the editor (if available)
    if (this.editorState.activeWidgetId() === this.widget.id && this.currentEditorInstance) {
      this.toolbarService.setActiveEditor(this.currentEditorInstance);
    }
  }

  ngOnDestroy(): void {
    // Clean up event listener
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }
    // Unregister editor from toolbar service
    if (this.currentEditorInstance && this.toolbarService.activeEditor === this.currentEditorInstance) {
      this.toolbarService.setActiveEditor(null);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !this.editing) {
      this.editorData = this.textProps.contentHtml ?? '';
    }
  }

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

  handleEditorReady(editor: any): void {
    // Store reference to the editor instance
    // The CKEditor Angular component passes the editor instance directly in the ready event
    this.currentEditorInstance = editor as ClassicEditor;
    
    // If this widget is currently active, register the editor immediately
    if (this.editorState.activeWidgetId() === this.widget.id) {
      this.toolbarService.setActiveEditor(this.currentEditorInstance);
    }
    
    // Editor is ready - it will be editable on first click
    // No need to do anything special, CKEditor handles click-to-focus automatically
  }

  handleEditorFocus(event: any): void {
    // The focus event from CKEditor Angular component may be a FocusEvent
    // Extract the editor instance if available, otherwise use the stored instance
    const editor = (event?.editor || event || this.currentEditorInstance) as ClassicEditor;
    if (editor) {
      this.currentEditorInstance = editor;
      // Register this editor as the active one for the shared toolbar
      this.toolbarService.setActiveEditor(editor);
    } else if (this.currentEditorInstance) {
      // Fallback to stored instance
      this.toolbarService.setActiveEditor(this.currentEditorInstance);
    }

    // Clear any pending blur timeout
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }

    if (!this.editing) {
      this.editing = true;
      this.editingChange.emit(true);
    }
  }

  handleEditorBlur(): void {
    if (!this.editing) {
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
      
      // Only save if the focus moved outside both the editor and toolbar, and it wasn't a click inside
      if (!isStillInsideEditor && !isStillInsideToolbar && !this.isClickingInsideEditor) {
        // Don't unregister here - keep the editor registered if the widget is still active
        // The effect() will handle unregistering when the widget becomes inactive

        this.editing = false;
        this.editingChange.emit(false);

        const nextHtml = this.editorData ?? '';
        if (nextHtml !== this.textProps.contentHtml) {
          this.propsChange.emit({ contentHtml: nextHtml });
        }
      } else if (isStillInsideToolbar && this.currentEditorInstance) {
        // Check if focus is on a select element (dropdown is open)
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

  private get textProps(): TextWidgetProps {
    return this.widget.props as TextWidgetProps;
  }
}

