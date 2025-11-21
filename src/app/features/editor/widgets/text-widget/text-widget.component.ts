import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';

import {
  TextWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';

@Component({
  selector: 'app-text-widget',
  templateUrl: './text-widget.component.html',
  styleUrls: ['./text-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextWidgetComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<TextWidgetProps>>();

  @ViewChild('editable', { static: true }) editableRef!: ElementRef<HTMLDivElement>;

  editing = false;
  private viewInitialized = false;

  constructor(private readonly sanitizer: DomSanitizer) {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.syncContent();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.viewInitialized && !this.editing) {
      this.syncContent();
    }
  }

  enterEditMode(): void {
    this.editing = true;
    this.editingChange.emit(true);
    this.setEditableHtml(this.textProps.contentHtml);
    queueMicrotask(() => {
      this.editableRef.nativeElement.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.selectAllChildren(this.editableRef.nativeElement);
        selection.collapseToEnd();
      }
    });
  }

  exitEditMode(): void {
    if (!this.editing) {
      return;
    }

    this.editing = false;
    this.editingChange.emit(false);

    const html = this.editableRef.nativeElement.innerHTML;
    this.propsChange.emit({ contentHtml: html });
  }

  toggleBold(): void {
    document.execCommand('bold');
  }

  toggleItalic(): void {
    document.execCommand('italic');
  }

  private setEditableHtml(html: string): void {
    const sanitized =
      this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    this.editableRef.nativeElement.innerHTML = sanitized;
  }

  private syncContent(): void {
    this.setEditableHtml(this.textProps.contentHtml);
  }

  private get textProps(): TextWidgetProps {
    return this.widget.props as TextWidgetProps;
  }
}

