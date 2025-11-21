import { Injectable, computed, signal } from '@angular/core';

import { DocumentService } from './document.service';
import { DocumentModel, SubsectionModel } from '../../models/document.model';
import { PageModel } from '../../models/page.model';

@Injectable({
  providedIn: 'root',
})
export class EditorStateService {
  private readonly sectionId = signal<string | null>(null);
  private readonly subsectionId = signal<string | null>(null);
  private readonly pageId = signal<string | null>(null);

  readonly activeSectionId = this.sectionId.asReadonly();
  readonly activeSubsectionId = this.subsectionId.asReadonly();
  readonly activePageId = this.pageId.asReadonly();

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
    const subsection = this.documentService.document.sections
      .flatMap((section) => section.subsections)
      .find((sub) => sub.id === subsectionId);
    this.pageId.set(subsection?.pages[0]?.id ?? null);
  }

  setActivePage(pageId: string): void {
    this.pageId.set(pageId);
  }
}

