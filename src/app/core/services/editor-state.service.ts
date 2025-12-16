import { Injectable, computed, signal, inject } from '@angular/core';

import { DocumentService } from './document.service';
import { UIStateService } from './ui-state.service';
import { DocumentModel, SubsectionModel } from '../../models/document.model';
import { PageModel } from '../../models/page.model';
import { WidgetModel } from '../../models/widget.model';

/**
 * EditorStateService
 * 
 * REFACTORED to separate concerns:
 * - Navigation state: section, subsection, page (lives here)
 * - UI state: widget selection, zoom, etc. (delegated to UIStateService)
 * 
 * This separation allows:
 * - Navigation changes don't affect widget editing
 * - Widget selection changes don't trigger navigation updates
 * - Cleaner code with single responsibility
 */
@Injectable({
  providedIn: 'root',
})
export class EditorStateService {
  private readonly documentService = inject(DocumentService);
  private readonly uiState = inject(UIStateService);
  
  // ============================================
  // NAVIGATION STATE (owned by this service)
  // ============================================
  
  private readonly sectionId = signal<string | null>(null);
  private readonly subsectionId = signal<string | null>(null);
  private readonly pageId = signal<string | null>(null);

  readonly activeSectionId = this.sectionId.asReadonly();
  readonly activeSubsectionId = this.subsectionId.asReadonly();
  readonly activePageId = this.pageId.asReadonly();
  
  // ============================================
  // DELEGATED UI STATE (from UIStateService)
  // These are exposed here for backward compatibility
  // ============================================
  
  /**
   * Active widget ID - delegated to UIStateService
   */
  readonly activeWidgetId = this.uiState.activeWidgetId;
  
  /**
   * Zoom level - delegated to UIStateService
   */
  readonly zoom = this.uiState.zoomLevel;

  // ============================================
  // COMPUTED PROPERTIES
  // ============================================

  readonly document = computed<DocumentModel>(() => this.documentService.document);

  readonly activeSubsection = computed<SubsectionModel | null>(() => {
    const subId = this.subsectionId();
    if (!subId) {
      return null;
    }
    for (const section of this.document().sections) {
      const subsection = section.subsections.find((s) => s.id === subId);
      if (subsection) {
        return subsection;
      }
    }
    return null;
  });

  readonly activePage = computed<PageModel | null>(() => {
    const pageId = this.pageId();
    const subsection = this.activeSubsection();
    if (!subsection || !pageId) {
      return null;
    }
    return subsection.pages.find((p) => p.id === pageId) ?? null;
  });

  readonly activeWidgetContext = computed<WidgetContext | null>(() => {
    const selectedId = this.activeWidgetId();
    const subsection = this.activeSubsection();
    if (!selectedId || !subsection) {
      return null;
    }

    for (const page of subsection.pages) {
      const widget = page.widgets.find((w) => w.id === selectedId);
      if (widget) {
        return { widget, pageId: page.id, subsectionId: subsection.id };
      }
    }

    return null;
  });

  readonly activeWidget = computed<WidgetModel | null>(
    () => this.activeWidgetContext()?.widget ?? null
  );

  // ============================================
  // INITIALIZATION
  // ============================================

  constructor() {
    // Initialize with first section/subsection/page
    this.initializeNavigation();
  }
  
  private initializeNavigation(): void {
    const doc = this.documentService.document;
    const firstSection = doc.sections[0];
    const firstSub = firstSection?.subsections[0];
    const firstPage = firstSub?.pages[0];

    this.sectionId.set(firstSection?.id ?? null);
    this.subsectionId.set(firstSub?.id ?? null);
    this.pageId.set(firstPage?.id ?? null);
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  setActiveSection(sectionId: string): void {
    this.sectionId.set(sectionId);
    this.uiState.selectWidget(null); // Clear widget selection on navigation
    
    const section = this.documentService.document.sections.find(
      (s) => s.id === sectionId
    );
    const subsection = section?.subsections[0];

    if (subsection) {
      this.setActiveSubsection(subsection.id);
    }
  }

  setActiveSubsection(subsectionId: string): void {
    this.subsectionId.set(subsectionId);
    this.uiState.selectWidget(null);
    
    const subsection = this.documentService.document.sections
      .flatMap((section) => section.subsections)
      .find((sub) => sub.id === subsectionId);
    this.pageId.set(subsection?.pages[0]?.id ?? null);
  }

  setActivePage(pageId: string): void {
    this.pageId.set(pageId);
    this.uiState.selectWidget(null);
  }

  // ============================================
  // WIDGET SELECTION (delegated to UIStateService)
  // ============================================

  /**
   * Set active widget - delegates to UIStateService
   */
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

  /**
   * Calculate zoom level to fit page within viewport
   */
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
}

interface WidgetContext {
  widget: WidgetModel;
  pageId: string;
  subsectionId: string;
}
