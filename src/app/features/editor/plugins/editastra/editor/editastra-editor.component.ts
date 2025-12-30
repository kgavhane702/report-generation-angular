import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewEncapsulation } from '@angular/core';

import { TwSafeInnerHtmlDirective } from '../../../../../shared/directives/tw-safe-inner-html.directive';
import { SafeHtmlPipe } from '../../../../../shared/pipes/safe-html.pipe';

/**
 * EditastraEditorComponent
 *
 * A reusable contenteditable HTML editor, extracted from the table cell editor pattern:
 * - Uses `twSafeInnerHtml` to avoid caret resets while focused
 * - Uses `safeHtml` pipe to preserve inline styles like color/highlight while removing dangerous tags
 */
@Component({
  selector: 'app-editastra-editor',
  standalone: true,
  imports: [CommonModule, TwSafeInnerHtmlDirective, SafeHtmlPipe],
  templateUrl: './editastra-editor.component.html',
  styleUrls: ['./editastra-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // IMPORTANT:
  // The editor's HTML is injected/edited dynamically inside contenteditable (ul/li/span/etc),
  // and those nodes do NOT carry Angular's emulated style scoping attributes.
  // Using `None` ensures our `.editastra-editor__surface ul/li/...` rules actually apply.
  encapsulation: ViewEncapsulation.None,
})
export class EditastraEditorComponent {
  @Input() html = '';
  @Input() placeholder = 'Type here...';
  @Input() disabled = false;

  @Output() editorFocus = new EventEmitter<void>();
  @Output() editorBlur = new EventEmitter<void>();
  @Output() htmlInput = new EventEmitter<string>();
  @Output() editorKeydown = new EventEmitter<KeyboardEvent>();

  @ViewChild('editorEl', { static: true }) editorEl?: ElementRef<HTMLElement>;

  get isEditable(): boolean {
    return !this.disabled;
  }

  focus(): void {
    this.editorEl?.nativeElement?.focus();
  }

  getEditableElement(): HTMLElement | null {
    return this.editorEl?.nativeElement ?? null;
  }

  onFocus(): void {
    this.editorFocus.emit();
  }

  onBlur(): void {
    this.editorBlur.emit();
  }

  onInput(event: Event): void {
    const el = event.target as HTMLElement | null;
    const html = el?.innerHTML ?? '';
    this.htmlInput.emit(html);
  }

  onKeydown(event: KeyboardEvent): void {
    this.editorKeydown.emit(event);
  }
}


