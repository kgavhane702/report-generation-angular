import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { WidgetSaveService } from '../../../core/services/widget-save.service';
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
  private readonly widgetSaveService = inject(WidgetSaveService);

  editingPageId: string | null = null;
  editingPageValue = '';

  async selectPage(pageId: string): Promise<void> {
    await this.editorState.setActivePage(pageId);
  }

  async addPage(): Promise<void> {
    const subsectionId = this.editorState.activeSubsectionId();
    if (!subsectionId) {
      return;
    }
    // Save current active page before adding new page
    const currentPageId = this.editorState.activePageId();
    if (currentPageId) {
      try {
        await this.widgetSaveService.saveActivePageWidgets(currentPageId);
      } catch (error) {
        console.error('Error saving before adding page:', error);
        // Continue with adding page even if save fails
      }
    }
    const pageId = this.documentService.addPage(subsectionId);
    if (pageId) {
      await this.editorState.setActivePage(pageId);
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

  async deletePage(subsectionId: string, pageId: string, event: MouseEvent, totalPages: number): Promise<void> {
    event.stopPropagation();
    if (totalPages <= 1) {
      return;
    }
    // Save current page if it's the one being deleted
    const currentPageId = this.editorState.activePageId();
    if (currentPageId === pageId && currentPageId) {
      try {
        await this.widgetSaveService.saveActivePageWidgets(currentPageId);
      } catch (error) {
        console.error('Error saving before deleting page:', error);
        // Continue with deletion even if save fails
      }
    }
    const fallbackId = this.documentService.deletePage(subsectionId, pageId);
    if (fallbackId) {
      await this.editorState.setActivePage(fallbackId);
    }
  }

  displayTitle(page: PageModel): string {
    return page.title ?? `Page ${page.number}`;
  }

  setPageOrientation(
    subsectionId: string,
    pageId: string,
    orientation: 'portrait' | 'landscape',
    event: MouseEvent
  ): void {
    event.stopPropagation();
    this.documentService.updatePageOrientation(subsectionId, pageId, orientation);
  }
}
