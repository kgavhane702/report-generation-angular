import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewEncapsulation } from '@angular/core';

import { TwSafeInnerHtmlDirective } from '../../../../../shared/directives/tw-safe-inner-html.directive';
import { SafeHtmlPipe } from '../../../../../shared/pipes/safe-html.pipe';
import { TableToolbarService } from '../../../../../core/services/table-toolbar.service';

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
  private readonly toolbarService = inject(TableToolbarService);

  @Input() html = '';
  @Input() placeholder = 'Type here...';
  @Input() disabled = false;
  /**
   * Optional extra class(es) applied to the underlying contenteditable surface.
   * Useful when embedding the editor inside other widgets (e.g. table cells) that rely on specific selectors.
   */
  @Input() editorClass: string | string[] | Set<string> | { [klass: string]: any } = '';

  /** Optional data-leaf attribute (used by table widget to track leaf editors). */
  @Input() dataLeaf: string | null = null;

  /** Optional inline styles to apply to the underlying contenteditable surface. */
  @Input() editorStyles: Record<string, string | null> | null = null;

  /** Visual variant: default widget editor vs compact table-cell editor. */
  @Input() variant: 'widget' | 'table' = 'widget';

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

  onPaste(event: ClipboardEvent): void {
    if (!this.isEditable) return;

    const dt = event.clipboardData;
    const items = dt?.items ? Array.from(dt.items) : [];
    if (items.length === 0) return;

    const fileItem = items.find((it) => it.kind === 'file' && (it.type ?? '').toLowerCase().startsWith('image/')) ?? null;
    const file = fileItem?.getAsFile?.() ?? null;
    if (!file) return;

    // We will insert a data:image so it persists in JSON/PDF; prevent the browser from inserting blob URLs.
    event.preventDefault();
    event.stopPropagation();

    const altFromName = (file.name ?? '').replace(/\.[^.]+$/, '').trim();

    // Preserve caret before async FileReader.
    this.toolbarService.snapshotSelection();

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      this.toolbarService.insertImageAtCursor(dataUrl, { alt: altFromName });
    };
    reader.readAsDataURL(file);
  }

  onDragOver(event: DragEvent): void {
    if (!this.isEditable) return;
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const f0 = files[0];
    if ((f0?.type ?? '').toLowerCase().startsWith('image/')) {
      event.preventDefault();
    }
  }

  onDrop(event: DragEvent): void {
    if (!this.isEditable) return;
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!((file?.type ?? '').toLowerCase().startsWith('image/'))) return;

    event.preventDefault();
    event.stopPropagation();

    // Try to place caret at drop point (best-effort).
    try {
      const docAny = document as any;
      let range: Range | null = null;
      if (typeof docAny.caretRangeFromPoint === 'function') {
        range = docAny.caretRangeFromPoint(event.clientX, event.clientY) as Range | null;
      } else if (typeof docAny.caretPositionFromPoint === 'function') {
        const pos = docAny.caretPositionFromPoint(event.clientX, event.clientY) as { offsetNode: Node; offset: number } | null;
        if (pos?.offsetNode) {
          range = document.createRange();
          range.setStart(pos.offsetNode, Math.max(0, pos.offset ?? 0));
          range.collapse(true);
        }
      }
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    } catch {
      // ignore
    }

    const altFromName = (file.name ?? '').replace(/\.[^.]+$/, '').trim();

    this.toolbarService.snapshotSelection();

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      this.toolbarService.insertImageAtCursor(dataUrl, { alt: altFromName });
    };
    reader.readAsDataURL(file);
  }
}


