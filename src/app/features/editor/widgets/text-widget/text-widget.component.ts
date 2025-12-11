import {
  ChangeDetectionStrategy,
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
} from '@angular/core';

import {
  TextWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';
import { RichTextEditorService } from '../../../../core/services/rich-text-editor/rich-text-editor.interface';
import { CkEditorRichTextEditorService } from '../../../../core/services/rich-text-editor/ckeditor-rich-text-editor.service';

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
  private editorInstance = this.editorService.createEditor();

  readonly Editor = this.editorInstance.Editor;
  readonly editorConfig = this.editorInstance.config;

  editing = false;
  editorData = '';
  private blurTimeoutId: number | null = null;
  private isClickingInsideEditor = false;

  ngOnInit(): void {
    // Initialize with widget content
    this.editorData = this.textProps.contentHtml ?? '';
    
    // Listen to mousedown events to detect clicks inside editor/toolbar
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
  }

  ngOnDestroy(): void {
    // Clean up event listener
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !this.editing) {
      this.editorData = this.textProps.contentHtml ?? '';
    }
  }

  private handleDocumentMouseDown = (event: MouseEvent): void => {
    // Check if click is inside the editor container (including toolbar)
    if (this.editorContainer?.nativeElement) {
      const target = event.target as Node;
      this.isClickingInsideEditor = this.editorContainer.nativeElement.contains(target);
    }
  };

  handleEditorReady(): void {
    // Editor is ready - it will be editable on first click
    // No need to do anything special, CKEditor handles click-to-focus automatically
  }

  handleEditorFocus(): void {
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

    // Use a small delay to check if the blur was caused by clicking inside the editor
    // This prevents premature saving when clicking toolbar buttons or dragging
    this.blurTimeoutId = window.setTimeout(() => {
      // Check if the active element is still within the editor container
      const activeElement = document.activeElement;
      const isStillInsideEditor = activeElement && 
        this.editorContainer?.nativeElement?.contains(activeElement);
      
      // Only save if the focus moved outside the editor and it wasn't a click inside
      if (!isStillInsideEditor && !this.isClickingInsideEditor) {
        this.editing = false;
        this.editingChange.emit(false);

        const nextHtml = this.editorData ?? '';
        if (nextHtml !== this.textProps.contentHtml) {
          this.propsChange.emit({ contentHtml: nextHtml });
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

