import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  OnInit,
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
export class TextWidgetComponent implements OnInit, OnChanges {
  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<TextWidgetProps>>();

  private readonly editorService = inject(RichTextEditorService);
  private editorInstance = this.editorService.createEditor();

  readonly Editor = this.editorInstance.Editor;
  readonly editorConfig = this.editorInstance.config;

  editing = false;
  editorData = '';

  ngOnInit(): void {
    // Initialize with widget content
    this.editorData = this.textProps.contentHtml ?? '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !this.editing) {
      this.editorData = this.textProps.contentHtml ?? '';
    }
  }

  handleEditorReady(): void {
    // Editor is ready - it will be editable on first click
    // No need to do anything special, CKEditor handles click-to-focus automatically
  }

  handleEditorFocus(): void {
    if (!this.editing) {
      this.editing = true;
      this.editingChange.emit(true);
    }
  }

  handleEditorBlur(): void {
    if (!this.editing) {
      return;
    }

    this.editing = false;
    this.editingChange.emit(false);

    const nextHtml = this.editorData ?? '';
    if (nextHtml !== this.textProps.contentHtml) {
      this.propsChange.emit({ contentHtml: nextHtml });
    }
  }

  private get textProps(): TextWidgetProps {
    return this.widget.props as TextWidgetProps;
  }
}

