import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { PageEntity } from '../../../store/document/document.state';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';

@Component({
  selector: 'app-page-outline',
  templateUrl: './page-outline.component.html',
  styleUrls: ['./page-outline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageOutlineComponent {
  protected readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);
  private readonly store = inject(Store<AppState>);

  get isDocumentLocked(): boolean {
    return this.documentService.documentLocked() === true;
  }

  /** Global sequential page number by pageId (1-based) */
  private readonly globalPageNumberByPageId = toSignal(
    this.store.select(DocumentSelectors.selectGlobalPageNumberByPageId),
    { initialValue: {} as Record<string, number> }
  );

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
    surface?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  addPage(): void {
    if (this.isDocumentLocked) {
      return;
    }
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
    if (this.isDocumentLocked) {
      return;
    }
    this.editingPageId = page.id;
    this.editingPageValue = page.title ?? `Page ${this.getGlobalPageNumber(page.id)}`;
  }

  savePageTitle(pageId: string): void {
    if (this.isDocumentLocked) {
      this.editingPageId = null;
      return;
    }
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
    if (this.isDocumentLocked) {
      return;
    }
    if (totalPages <= 1) {
      return;
    }
    const fallbackId = this.documentService.deletePage(subsectionId, pageId);
    if (fallbackId) {
      this.editorState.setActivePage(fallbackId);
    }
  }

  displayTitle(page: PageEntity): string {
    return page.title ?? `Page ${this.getGlobalPageNumber(page.id)}`;
  }

  private getGlobalPageNumber(pageId: string): number {
    return this.globalPageNumberByPageId()[pageId] ?? this.editorState.getPageById(pageId)?.number ?? 1;
  }

  setPageOrientation(
    pageId: string,
    orientation: 'portrait' | 'landscape',
    event: MouseEvent
  ): void {
    event.stopPropagation();
    if (this.isDocumentLocked) {
      return;
    }
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
