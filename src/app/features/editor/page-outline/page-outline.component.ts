import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { PageEntity } from '../../../store/document/document.state';

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

  /** Get pages for active subsection */
  readonly pages = this.editorState.activeSubsectionPages;
  
  /** Get active subsection ID */
  readonly activeSubsectionId = this.editorState.activeSubsectionId;
  
  /** Get active page ID */
  readonly activePageId = this.editorState.activePageId;

  selectPage(pageId: string): void {
    this.editorState.setActivePage(pageId);
    const surface = document.getElementById(`page-surface-${pageId}`);
    surface?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  addPage(): void {
    const subsectionId = this.activeSubsectionId();
    if (!subsectionId) {
      return;
    }

    // Keep the current page active when adding a new page.
    // Only fall back to the new page if nothing is currently active (edge case).
    const currentActivePageId = this.activePageId();
    const pageId = this.documentService.addPage(subsectionId);
    if (!currentActivePageId && pageId) {
      this.editorState.setActivePage(pageId);
    }
  }

  startPageEdit(page: PageEntity, event: MouseEvent): void {
    event.stopPropagation();
    this.editingPageId = page.id;
    this.editingPageValue = page.title ?? `Page ${page.number}`;
  }

  savePageTitle(pageId: string): void {
    const value = this.editingPageValue.trim();
    if (value) {
      this.documentService.renamePage(pageId, value);
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

  displayTitle(page: PageEntity): string {
    return page.title ?? `Page ${page.number}`;
  }

  setPageOrientation(
    pageId: string,
    orientation: 'portrait' | 'landscape',
    event: MouseEvent
  ): void {
    event.stopPropagation();
    this.documentService.updatePageOrientation(pageId, orientation);
  }
  
  /** Get widget count for a page */
  getWidgetCount(pageId: string): number {
    return this.editorState.getWidgetCountForPage(pageId);
  }
  
  /** Track by page ID */
  trackByPageId(index: number, page: PageEntity): string {
    return page.id;
  }
}
