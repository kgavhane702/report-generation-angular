import { Injectable, computed, signal } from '@angular/core';

import { DocumentService } from './document.service';
import { DocumentModel, SubsectionModel } from '../../models/document.model';
import { PageModel } from '../../models/page.model';
import { WidgetModel } from '../../models/widget.model';

@Injectable({
  providedIn: 'root',
})
export class EditorStateService {
  private readonly sectionId = signal<string | null>(null);
  private readonly subsectionId = signal<string | null>(null);
  private readonly pageId = signal<string | null>(null);
  private readonly widgetId = signal<string | null>(null);

  readonly activeSectionId = this.sectionId.asReadonly();
  readonly activeSubsectionId = this.subsectionId.asReadonly();
  readonly activePageId = this.pageId.asReadonly();
  readonly activeWidgetId = this.widgetId.asReadonly();

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
    const selectedId = this.widgetId();
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

  constructor(private readonly documentService: DocumentService) {
    const doc = this.documentService.document;
    const firstSection = doc.sections[0];
    const firstSub = firstSection?.subsections[0];
    const firstPage = firstSub?.pages[0];

    this.sectionId.set(firstSection?.id ?? null);
    this.subsectionId.set(firstSub?.id ?? null);
    this.pageId.set(firstPage?.id ?? null);
  }

  setActiveSection(sectionId: string): void {
    this.sectionId.set(sectionId);
    this.widgetId.set(null);
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
    this.widgetId.set(null);
    const subsection = this.documentService.document.sections
      .flatMap((section) => section.subsections)
      .find((sub) => sub.id === subsectionId);
    this.pageId.set(subsection?.pages[0]?.id ?? null);
  }

  setActivePage(pageId: string): void {
    this.pageId.set(pageId);
    this.widgetId.set(null);
  }

  setActiveWidget(widgetId: string | null): void {
    this.widgetId.set(widgetId);
  }
}

interface WidgetContext {
  widget: WidgetModel;
  pageId: string;
  subsectionId: string;
}

