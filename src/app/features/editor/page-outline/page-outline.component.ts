import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { PageModel } from '../../../models/page.model';

@Component({
  selector: 'app-page-outline',
  templateUrl: './page-outline.component.html',
  styleUrls: ['./page-outline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageOutlineComponent {
  protected readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);

  editingPageId: string | null = null;
  editingPageValue = '';

  selectPage(pageId: string): void {
    this.editorState.setActivePage(pageId);
  }

  addPage(): void {
    const subsectionId = this.editorState.activeSubsectionId();
    if (!subsectionId) {
      return;
    }
    const pageId = this.documentService.addPage(subsectionId);
    if (pageId) {
      this.editorState.setActivePage(pageId);
    }
  }

  startPageEdit(page: PageModel, event: MouseEvent): void {
    event.stopPropagation();
    this.editingPageId = page.id;
    this.editingPageValue = page.title ?? `Page ${page.number}`;
  }

  savePageTitle(subsectionId: string, pageId: string): void {
    const value = this.editingPageValue.trim();
    if (value) {
      this.documentService.renamePage(subsectionId, pageId, value);
    }
    this.editingPageId = null;
  }

  cancelPageEdit(): void {
    this.editingPageId = null;
  }

  deletePage(subsectionId: string, pageId: string, event: MouseEvent, totalPages: number): void {
    event.stopPropagation();
    if (totalPages <= 1) {
      return;
    }
    const fallbackId = this.documentService.deletePage(subsectionId, pageId);
    if (fallbackId) {
      this.editorState.setActivePage(fallbackId);
    }
  }

  displayTitle(page: PageModel): string {
    return page.title ?? `Page ${page.number}`;
  }
}
