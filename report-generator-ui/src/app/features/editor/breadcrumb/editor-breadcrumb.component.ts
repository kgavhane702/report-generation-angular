import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';

import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';
import { PageEntity, SectionEntity, SubsectionEntity } from '../../../store/document/document.state';

@Component({
  selector: 'app-editor-breadcrumb',
  templateUrl: './editor-breadcrumb.component.html',
  styleUrls: ['./editor-breadcrumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorBreadcrumbComponent {
  protected readonly documentService = inject(DocumentService);
  protected readonly editorState = inject(EditorStateService);
  private readonly store = inject(Store<AppState>);

  get isDocumentLocked(): boolean {
    return this.documentService.documentLocked() === true;
  }

  // Expanded/collapsed state (independent from active selection)
  private readonly expandedSectionIds = signal<Set<string>>(new Set());
  private readonly expandedSubsectionIds = signal<Set<string>>(new Set());

  editingSectionId: string | null = null;
  editingSectionValue = '';
  editingSubsectionId: string | null = null;
  editingSubsectionValue = '';
  editingPageId: string | null = null;
  editingPageValue = '';

  /** All sections (ordered) */
  private readonly allSections = toSignal(
    this.store.select(DocumentSelectors.selectAllSections),
    { initialValue: [] as SectionEntity[] }
  );
  
  /** All section IDs */
  private readonly sectionIds = toSignal(
    this.store.select(DocumentSelectors.selectSectionIds),
    { initialValue: [] as string[] }
  );
  
  /** Section entities map */
  private readonly sectionEntities = toSignal(
    this.store.select(DocumentSelectors.selectSectionEntities),
    { initialValue: {} as Dictionary<SectionEntity> }
  );

  /** Subsection entities map */
  private readonly subsectionEntities = toSignal(
    this.store.select(DocumentSelectors.selectSubsectionEntities),
    { initialValue: {} as Dictionary<SubsectionEntity> }
  );

  /** Page entities map */
  private readonly pageEntities = toSignal(
    this.store.select(DocumentSelectors.selectPageEntities),
    { initialValue: {} as Dictionary<PageEntity> }
  );

  /** Global sequential page number by pageId (1-based) */
  private readonly globalPageNumberByPageId = toSignal(
    this.store.select(DocumentSelectors.selectGlobalPageNumberByPageId),
    { initialValue: {} as Record<string, number> }
  );

  /** Subsection IDs by section ID */
  private readonly subsectionIdsBySectionId = toSignal(
    this.store.select(DocumentSelectors.selectSubsectionIdsBySectionId),
    { initialValue: {} as Record<string, string[]> }
  );

  /** Page IDs by subsection ID */
  private readonly pageIdsBySubsectionId = toSignal(
    this.store.select(DocumentSelectors.selectPageIdsBySubsectionId),
    { initialValue: {} as Record<string, string[]> }
  );

  /** Widget IDs by page ID */
  private readonly widgetIdsByPageId = toSignal(
    this.store.select(DocumentSelectors.selectWidgetIdsByPageId),
    { initialValue: {} as Record<string, string[]> }
  );

  /** Get sections ordered by sectionIds */
  get sections(): SectionEntity[] {
    const ids = this.sectionIds();
    const entities = this.sectionEntities();
    return ids.map((id: string) => entities[id]).filter((s): s is SectionEntity => !!s);
  }

  /** Global controls: expand/collapse all sections (show subsections, but not pages) */
  expandAllSections(): void {
    const ids = this.sectionIds();
    this.expandedSectionIds.set(new Set(ids));
    // "Till the section" => do not auto-expand subsections to page level.
    this.expandedSubsectionIds.set(new Set());
  }

  collapseAllSections(): void {
    this.expandedSectionIds.set(new Set());
    this.expandedSubsectionIds.set(new Set());
  }

  areAllSubsectionsExpanded(sectionId: string): boolean {
    const subs = this.subsectionsForSection(sectionId);
    if (subs.length === 0) return false;
    const expanded = this.expandedSubsectionIds();
    return subs.every((s) => expanded.has(s.id));
  }

  toggleAllSubsectionsForSection(sectionId: string, event: MouseEvent): void {
    event.stopPropagation();

    // Ensure the section itself is expanded so the change is visible.
    this.expandedSectionIds.update((prev) => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });

    const subsectionIds = this.subsectionsForSection(sectionId).map((s) => s.id);
    if (subsectionIds.length === 0) return;

    const shouldExpand = !this.areAllSubsectionsExpanded(sectionId);
    this.expandedSubsectionIds.update((prev) => {
      const next = new Set(prev);
      if (shouldExpand) {
        subsectionIds.forEach((id) => next.add(id));
      } else {
        subsectionIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }

  /** Active section ID */
  readonly activeSectionId = this.editorState.activeSectionId;
  
  /** Active subsection ID */
  readonly activeSubsectionId = this.editorState.activeSubsectionId;

  /** Active page ID */
  readonly activePageId = this.editorState.activePageId;

  constructor() {
    // Ensure the currently active section/subsection are expanded by default
    effect(() => {
      const secId = this.activeSectionId();
      if (secId) {
        this.expandedSectionIds.update((prev) => {
          const next = new Set(prev);
          next.add(secId);
          return next;
        });
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const subId = this.activeSubsectionId();
      if (subId) {
        this.expandedSubsectionIds.update((prev) => {
          const next = new Set(prev);
          next.add(subId);
          return next;
        });
      }
    }, { allowSignalWrites: true });
  }

  onTreeRowKeydown(type: 'section' | 'subsection' | 'page', id: string, event: KeyboardEvent): void {
    const key = event.key;

    // Activate on Enter/Space like a button.
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (type === 'section') this.selectSection(id);
      else if (type === 'subsection') this.selectSubsection(id);
      else this.selectPage(id);
      return;
    }

    // Expand/collapse with arrows for better tree UX.
    if (type === 'section') {
      if (key === 'ArrowRight' && !this.isSectionExpanded(id)) {
        event.preventDefault();
        // Create a synthetic MouseEvent is unnecessary; toggle methods only use stopPropagation.
        this.expandedSectionIds.update((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      } else if (key === 'ArrowLeft' && this.isSectionExpanded(id)) {
        event.preventDefault();
        this.expandedSectionIds.update((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }

    if (type === 'subsection') {
      if (key === 'ArrowRight' && !this.isSubsectionExpanded(id)) {
        event.preventDefault();
        this.expandedSubsectionIds.update((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      } else if (key === 'ArrowLeft' && this.isSubsectionExpanded(id)) {
        event.preventDefault();
        this.expandedSubsectionIds.update((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }

  /** Get active section */
  get activeSection(): SectionEntity | null {
    const activeId = this.activeSectionId();
    if (!activeId) return null;
    const entities = this.sectionEntities();
    return entities[activeId] ?? null;
  }

  /** Subsections for a section */
  subsectionsForSection(sectionId: string): SubsectionEntity[] {
    const ids = this.subsectionIdsBySectionId()[sectionId] ?? [];
    const entities = this.subsectionEntities();
    return ids.map((id: string) => entities[id]).filter((s): s is SubsectionEntity => !!s);
  }

  /** Pages for a subsection */
  pagesForSubsection(subsectionId: string): PageEntity[] {
    const ids = this.pageIdsBySubsectionId()[subsectionId] ?? [];
    const entities = this.pageEntities();
    return ids.map((id: string) => entities[id]).filter((p): p is PageEntity => !!p);
  }

  selectSection(sectionId: string): void {
    this.editorState.setActiveSection(sectionId);
  }

  selectSubsection(subsectionId: string): void {
    // Selecting a subsection should also activate its parent section and a concrete page
    // so the full hierarchy highlights consistently (section → subsection → page).
    const subsection = this.subsectionEntities()[subsectionId];
    const sectionId = subsection?.sectionId ?? null;
    const firstPageId = this.pageIdsBySubsectionId()[subsectionId]?.[0] ?? null;

    this.editorState.setActiveHierarchy(sectionId, subsectionId, firstPageId);
  }

  isSectionExpanded(sectionId: string): boolean {
    return this.expandedSectionIds().has(sectionId);
  }

  toggleSection(sectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedSectionIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  isSubsectionExpanded(subsectionId: string): boolean {
    return this.expandedSubsectionIds().has(subsectionId);
  }

  toggleSubsection(subsectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedSubsectionIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(subsectionId)) next.delete(subsectionId);
      else next.add(subsectionId);
      return next;
    });
  }

  selectPage(pageId: string): void {
    // When selecting a page, also activate its subsection + section so the whole
    // hierarchy highlights (without triggering "auto-select first page" logic).
    const page = this.pageEntities()[pageId];
    const subsectionId = page?.subsectionId ?? null;
    const subsection = subsectionId ? this.subsectionEntities()[subsectionId] : null;
    const sectionId = subsection?.sectionId ?? null;

    this.editorState.setActiveHierarchy(sectionId, subsectionId, pageId);

    const surface = document.getElementById(`page-surface-${pageId}`);
    surface?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  addSection(): void {
    if (this.isDocumentLocked) return;
    const ids = this.documentService.addSection();

    // Do not change current active selection when adding a new section.
    // Only initialize navigation if nothing is active yet (edge case).
    if (!this.activeSectionId() && ids.sectionId) {
      this.editorState.setActiveSection(ids.sectionId);
    }
    if (!this.activeSubsectionId() && ids.subsectionId) {
      this.editorState.setActiveSubsection(ids.subsectionId);
    }
    if (!this.editorState.activePageId() && ids.pageId) {
      this.editorState.setActivePage(ids.pageId);
    }
  }

  addSubsectionFor(sectionId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isDocumentLocked) return;

    const ids = this.documentService.addSubsection(sectionId);
    if (!ids?.subsectionId) return;

    // Do not change current active selection when adding.
    // Only initialize if nothing is active (edge case).
    if (!this.activeSectionId()) {
      this.editorState.setActiveSection(sectionId);
    }
    if (!this.activeSubsectionId()) {
      this.editorState.setActiveSubsection(ids.subsectionId);
    }
    if (!this.activePageId() && ids.pageId) {
      this.editorState.setActivePage(ids.pageId);
    }
  }

  addPageFor(subsectionId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isDocumentLocked) return;

    // Keep the current page active when adding a new page.
    // Only fall back to the new page if nothing is currently active (edge case).
    const currentActivePageId = this.activePageId();
    const pageId = this.documentService.addPage(subsectionId);
    if (!currentActivePageId && pageId) {
      this.editorState.setActivePage(pageId);
    }
  }

  startSectionEdit(section: SectionEntity, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDocumentLocked) return;
    this.editingSectionId = section.id;
    this.editingSectionValue = section.title;
  }

  saveSectionTitle(sectionId: string): void {
    if (this.isDocumentLocked) {
      this.editingSectionId = null;
      return;
    }
    const value = this.editingSectionValue.trim();
    if (value) {
      this.documentService.renameSection(sectionId, value);
    }
    this.editingSectionId = null;
  }

  cancelSectionEdit(): void {
    this.editingSectionId = null;
  }

  deleteSection(sectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDocumentLocked) return;
    if (this.sections.length <= 1) {
      return;
    }
    const fallback = this.documentService.deleteSection(sectionId);
    if (fallback?.sectionId) {
      this.editorState.setActiveSection(fallback.sectionId);
      if (fallback.subsectionId) {
        this.editorState.setActiveSubsection(fallback.subsectionId);
      }
      if (fallback.pageId) {
        this.editorState.setActivePage(fallback.pageId);
      }
    }
  }

  startSubsectionEdit(subsection: SubsectionEntity, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDocumentLocked) return;
    this.editingSubsectionId = subsection.id;
    this.editingSubsectionValue = subsection.title;
  }

  saveSubsectionTitle(subsectionId: string): void {
    if (this.isDocumentLocked) {
      this.editingSubsectionId = null;
      return;
    }
    const value = this.editingSubsectionValue.trim();
    if (value) {
      this.documentService.renameSubsection(subsectionId, value);
    }
    this.editingSubsectionId = null;
  }

  cancelSubsectionEdit(): void {
    this.editingSubsectionId = null;
  }

  deleteSubsection(sectionId: string, subsectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDocumentLocked) return;
    const subsections = this.subsectionsForSection(sectionId);
    if (subsections.length <= 1) {
      return;
    }
    const fallback = this.documentService.deleteSubsection(sectionId, subsectionId);
    if (this.activeSubsectionId() === subsectionId && fallback?.subsectionId) {
      this.editorState.setActiveSubsection(fallback.subsectionId);
      if (fallback.pageId) {
        this.editorState.setActivePage(fallback.pageId);
      }
    }
  }

  startPageEdit(page: PageEntity, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDocumentLocked) return;
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

  deletePage(subsectionId: string, pageId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDocumentLocked) return;
    const pages = this.pagesForSubsection(subsectionId);
    if (pages.length <= 1) {
      return;
    }

    const fallbackId = this.documentService.deletePage(subsectionId, pageId);
    if (this.activePageId() === pageId && fallbackId) {
      this.editorState.setActivePage(fallbackId);
    }
  }

  displayPageTitle(page: PageEntity): string {
    return page.title ?? `Page ${this.getGlobalPageNumber(page.id)}`;
  }

  private getGlobalPageNumber(pageId: string): number {
    return this.globalPageNumberByPageId()[pageId] ?? this.pageEntities()[pageId]?.number ?? 1;
  }

  setPageOrientation(
    pageId: string,
    orientation: 'portrait' | 'landscape',
    event: MouseEvent
  ): void {
    event.stopPropagation();
    if (this.isDocumentLocked) return;
    this.documentService.updatePageOrientation(pageId, orientation);
  }

  getWidgetCount(pageId: string): number {
    return this.widgetIdsByPageId()[pageId]?.length ?? 0;
  }
  
  /** Track by section ID */
  trackBySectionId(index: number, section: SectionEntity): string {
    return section.id;
  }
  
  /** Track by subsection ID */
  trackBySubsectionId(index: number, subsection: SubsectionEntity): string {
    return subsection.id;
  }

  /** Track by page ID */
  trackByPageId(index: number, page: PageEntity): string {
    return page.id;
  }
}
