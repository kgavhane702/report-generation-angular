import { Injectable, computed, signal, inject, effect } from '@angular/core';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { Dictionary } from '@ngrx/entity';

import { UIStateService } from './ui-state.service';
import { AppState } from '../../store/app.state';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { SectionEntity, SubsectionEntity, PageEntity, WidgetEntity } from '../../store/document/document.state';
import { WidgetModel } from '../../models/widget.model';

/**
 * EditorStateService
 * 
 * Manages navigation state using normalized store selectors.
 * - Navigation state: section, subsection, page (lives here)
 * - UI state: widget selection, zoom, etc. (delegated to UIStateService)
 */
@Injectable({
  providedIn: 'root',
})
export class EditorStateService {
  private readonly store = inject(Store<AppState>);
  private readonly uiState = inject(UIStateService);
  
  // ============================================
  // NAVIGATION STATE (owned by this service)
  // ============================================
  
  private readonly _sectionId = signal<string | null>(null);
  private readonly _subsectionId = signal<string | null>(null);
  private readonly _pageId = signal<string | null>(null);

  readonly activeSectionId = this._sectionId.asReadonly();
  readonly activeSubsectionId = this._subsectionId.asReadonly();
  readonly activePageId = this._pageId.asReadonly();
  
  // ============================================
  // STORE SIGNALS (from normalized state)
  // ============================================
  
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
  
  /** Widget entities map */
  private readonly widgetEntities = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Dictionary<WidgetEntity> }
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

  /** All page IDs in document order (section -> subsection -> page) */
  readonly documentPageIds = toSignal(
    this.store.select(DocumentSelectors.selectFlattenedPageIdsInDocumentOrder),
    { initialValue: [] as string[] }
  );

  /** Global sequential page number by pageId (1-based) */
  private readonly globalPageNumberByPageId = toSignal(
    this.store.select(DocumentSelectors.selectGlobalPageNumberByPageId),
    { initialValue: {} as Record<string, number> }
  );
  
  /** Widget IDs by page ID */
  private readonly widgetIdsByPageId = toSignal(
    this.store.select(DocumentSelectors.selectWidgetIdsByPageId),
    { initialValue: {} as Record<string, string[]> }
  );
  
  /** Page size */
  readonly pageSize = toSignal(
    this.store.select(DocumentSelectors.selectPageSize),
    { initialValue: { widthMm: 254, heightMm: 190.5, dpi: 96 } }
  );
  
  /** Document header */
  readonly documentHeader = toSignal(
    this.store.select(DocumentSelectors.selectDocumentHeader),
    { initialValue: undefined }
  );

  /** Document footer */
  readonly documentFooter = toSignal(
    this.store.select(DocumentSelectors.selectDocumentFooter),
    { initialValue: undefined }
  );
  
  /** Document logo */
  readonly documentLogo = toSignal(
    this.store.select(DocumentSelectors.selectDocumentLogo),
    { initialValue: undefined }
  );
  
  // ============================================
  // DELEGATED UI STATE (from UIStateService)
  // ============================================
  
  readonly activeWidgetId = this.uiState.activeWidgetId;
  readonly zoom = this.uiState.zoomLevel;

  // ============================================
  // COMPUTED PROPERTIES (from normalized state)
  // ============================================

  /** Active section entity */
  readonly activeSection = computed<SectionEntity | null>(() => {
    const id = this._sectionId();
    if (!id) return null;
    const entities = this.sectionEntities();
    return entities[id] ?? null;
  });

  /** Active subsection entity */
  readonly activeSubsection = computed<SubsectionEntity | null>(() => {
    const id = this._subsectionId();
    if (!id) return null;
    const entities = this.subsectionEntities();
    return entities[id] ?? null;
  });

  /** Active page entity */
  readonly activePage = computed<PageEntity | null>(() => {
    const id = this._pageId();
    if (!id) return null;
    const entities = this.pageEntities();
    return entities[id] ?? null;
  });

  /** Active page number (sequential in document order, 1-based) */
  readonly activePageNumber = computed<number>(() => {
    const pageId = this._pageId();
    if (!pageId) return 1;
    return this.globalPageNumberByPageId()[pageId] ?? 1;
  });
  
  /** Page IDs for active subsection */
  readonly activeSubsectionPageIds = computed<string[]>(() => {
    const subId = this._subsectionId();
    return subId ? this.pageIdsBySubsectionId()[subId] ?? [] : [];
  });
  
  /** Pages for active subsection */
  readonly activeSubsectionPages = computed<PageEntity[]>(() => {
    const pageIds = this.activeSubsectionPageIds();
    const entities = this.pageEntities();
    return pageIds.map((id: string) => entities[id]).filter((p): p is PageEntity => !!p);
  });
  
  /** Subsection IDs for active section */
  readonly activeSectionSubsectionIds = computed<string[]>(() => {
    const secId = this._sectionId();
    return secId ? this.subsectionIdsBySectionId()[secId] ?? [] : [];
  });
  
  /** Subsections for active section */
  readonly activeSectionSubsections = computed<SubsectionEntity[]>(() => {
    const subIds = this.activeSectionSubsectionIds();
    const entities = this.subsectionEntities();
    return subIds.map((id: string) => entities[id]).filter((s): s is SubsectionEntity => !!s);
  });
  
  /** Widget IDs for active page */
  readonly activePageWidgetIds = computed<string[]>(() => {
    const pageId = this._pageId();
    return pageId ? this.widgetIdsByPageId()[pageId] ?? [] : [];
  });

  /** Active widget context */
  readonly activeWidgetContext = computed<WidgetContext | null>(() => {
    const selectedId = this.activeWidgetId();
    const subsectionId = this._subsectionId();
    const pageId = this._pageId();
    
    if (!selectedId || !subsectionId) {
      return null;
    }

    const entities = this.widgetEntities();
    const widget = entities[selectedId];
    if (!widget) {
      return null;
    }
    
    // Verify widget belongs to current page
    const widgetPageId = widget.pageId;
    if (widgetPageId !== pageId) {
      return null;
    }

    // Convert WidgetEntity to WidgetModel (remove pageId)
    const { pageId: _, ...widgetModel } = widget;
    return { 
      widget: widgetModel as WidgetModel, 
      pageId: widgetPageId, 
      subsectionId 
    };
  });

  readonly activeWidget = computed<WidgetModel | null>(
    () => this.activeWidgetContext()?.widget ?? null
  );

  // ============================================
  // INITIALIZATION
  // ============================================

  constructor() {
    // Use effect to initialize navigation when sections are available
    effect(() => {
      const ids = this.sectionIds();
      const currentSectionId = this._sectionId();
      
      // Only initialize if no section is selected and sections exist
      if (!currentSectionId && ids.length > 0) {
        this.initializeNavigation();
      }
    }, { allowSignalWrites: true });
  }
  
  private initializeNavigation(): void {
    const sectionIds = this.sectionIds();
    if (sectionIds.length === 0) return;
    
    const firstSectionId = sectionIds[0];
    const subIds = this.subsectionIdsBySectionId()[firstSectionId] || [];
    const firstSubId = subIds[0];
    const pageIds = firstSubId ? this.pageIdsBySubsectionId()[firstSubId] || [] : [];
    const firstPageId = pageIds[0];

    this._sectionId.set(firstSectionId ?? null);
    this._subsectionId.set(firstSubId ?? null);
    this._pageId.set(firstPageId ?? null);
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  setActiveSection(sectionId: string): void {
    this._sectionId.set(sectionId);
    this.uiState.selectWidget(null);
    
    // Auto-select first subsection
    const subIds = this.subsectionIdsBySectionId()[sectionId] || [];
    const firstSubId = subIds[0];
    
    if (firstSubId) {
      this.setActiveSubsection(firstSubId);
    } else {
      this._subsectionId.set(null);
      this._pageId.set(null);
    }
  }

  setActiveSubsection(subsectionId: string): void {
    this._subsectionId.set(subsectionId);
    this.uiState.selectWidget(null);
    
    // Auto-select first page
    const pageIds = this.pageIdsBySubsectionId()[subsectionId] || [];
    this._pageId.set(pageIds[0] ?? null);
  }

  setActivePage(pageId: string): void {
    // When paging continuously across sections/subsections, keep the full hierarchy
    // in sync (section -> subsection -> page) so sidebars highlight correctly.
    const page = this.pageEntities()[pageId];
    if (page) {
      const subsectionId = page.subsectionId ?? null;
      const subsection = subsectionId ? this.subsectionEntities()[subsectionId] : null;
      const sectionId = subsection?.sectionId ?? null;
      this._sectionId.set(sectionId);
      this._subsectionId.set(subsectionId);
    }

    this._pageId.set(pageId);
    this.uiState.selectWidget(null);
  }

  /**
   * Set section/subsection/page together without triggering auto-selection logic.
   * Used when user selects an explicit page from a tree (so we don't jump to first page).
   */
  setActiveHierarchy(sectionId: string | null, subsectionId: string | null, pageId: string | null): void {
    this._sectionId.set(sectionId);
    this._subsectionId.set(subsectionId);
    this._pageId.set(pageId);
    this.uiState.selectWidget(null);
  }

  // ============================================
  // WIDGET SELECTION (delegated to UIStateService)
  // ============================================

  setActiveWidget(widgetId: string | null): void {
    this.uiState.selectWidget(widgetId);
  }

  // ============================================
  // ZOOM METHODS (delegated to UIStateService)
  // ============================================

  setZoom(zoom: number): void {
    this.uiState.setZoom(zoom);
  }

  zoomIn(): void {
    this.uiState.zoomIn();
  }

  zoomOut(): void {
    this.uiState.zoomOut();
  }

  resetZoom(): void {
    this.uiState.resetZoom();
  }

  calculateFitToWindowZoom(
    pageWidth: number,
    pageHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    padding: { top: number; right: number; bottom: number; left: number }
  ): number {
    const availableWidth = viewportWidth - padding.left - padding.right;
    const availableHeight = viewportHeight - padding.top - padding.bottom;

    const widthRatio = (availableWidth / pageWidth) * 100;
    const heightRatio = (availableHeight / pageHeight) * 100;

    const fitZoom = Math.min(widthRatio, heightRatio);

    return Math.max(10, Math.min(400, Math.floor(fitZoom)));
  }
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  /** Get widget count for a specific page */
  getWidgetCountForPage(pageId: string): number {
    return this.widgetIdsByPageId()[pageId]?.length ?? 0;
  }
  
  /** Get a widget by ID */
  getWidgetById(widgetId: string): WidgetEntity | null {
    const entities = this.widgetEntities();
    return entities[widgetId] ?? null;
  }
  
  /** Get a page by ID */
  getPageById(pageId: string): PageEntity | null {
    const entities = this.pageEntities();
    return entities[pageId] ?? null;
  }

  /** Get global sequential page number by pageId (1-based) */
  getGlobalPageNumber(pageId: string): number {
    return this.globalPageNumberByPageId()[pageId] ?? 1;
  }
  
  /** Reset navigation to first section/subsection/page */
  resetNavigation(): void {
    this.initializeNavigation();
  }
}

interface WidgetContext {
  widget: WidgetModel;
  pageId: string;
  subsectionId: string;
}
