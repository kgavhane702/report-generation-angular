import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import {
  DocumentModel,
  PageSize,
  SubsectionModel,
} from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { DocumentActions } from '../../store/document/document.actions';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { AppState } from '../../store/app.state';
import {
  createInitialDocument,
  createPageModel,
  createSectionModel,
  createSubsectionModel,
} from '../utils/document.factory';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  readonly document$ = this.store.select(DocumentSelectors.selectDocument);
  private readonly documentSignal = toSignal(this.document$, {
    initialValue: createInitialDocument(),
  });

  constructor(private readonly store: Store<AppState>) {}

  get document(): DocumentModel {
    return this.documentSignal();
  }

  addWidget(subsectionId: string, pageId: string, widget: WidgetModel): void {
    this.store.dispatch(
      DocumentActions.addWidget({ subsectionId, pageId, widget })
    );
  }

  updateWidget(
    subsectionId: string,
    pageId: string,
    widgetId: string,
    mutation: Partial<WidgetModel>
  ): void {
    this.store.dispatch(
      DocumentActions.updateWidget({
        subsectionId,
        pageId,
        widgetId,
        changes: mutation,
      })
    );
  }

  replaceDocument(document: DocumentModel): void {
    this.store.dispatch(DocumentActions.setDocument({ document }));
  }

  updatePageSize(pageSize: Partial<PageSize>): void {
    this.store.dispatch(DocumentActions.updatePageSize({ pageSize }));
  }

  addSection(): HierarchySelection {
    const sectionCount = this.document.sections.length + 1;
    const sectionTitle = `Section ${sectionCount}`;
    const subsectionTitle = 'Subsection 1';
    const page = createPageModel(1);
    const subsection = createSubsectionModel(subsectionTitle, [page]);
    const section = createSectionModel(sectionTitle, [subsection]);

    this.store.dispatch(DocumentActions.addSection({ section }));

    return {
      sectionId: section.id,
      subsectionId: subsection.id,
      pageId: page.id,
    };
  }

  addSubsection(sectionId: string): SubsectionSelection | null {
    const section = this.document.sections.find((s) => s.id === sectionId);
    if (!section) {
      return null;
    }

    const subsectionCount = section.subsections.length + 1;
    const subsectionTitle = `Subsection ${subsectionCount}`;
    const page = createPageModel(1);
    const subsection = createSubsectionModel(subsectionTitle, [page]);

    this.store.dispatch(
      DocumentActions.addSubsection({ sectionId, subsection })
    );

    return {
      subsectionId: subsection.id,
      pageId: page.id,
    };
  }

  addPage(subsectionId: string): string | null {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return null;
    }
    const nextNumber = subsection.pages.length + 1;
    const page = createPageModel(nextNumber);

    this.store.dispatch(DocumentActions.addPage({ subsectionId, page }));
    return page.id;
  }

  private findSubsectionById(
    subsectionId: string
  ): SubsectionModel | undefined {
    for (const section of this.document.sections) {
      const found = section.subsections.find((sub) => sub.id === subsectionId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  renameSection(sectionId: string, title: string): void {
    this.store.dispatch(
      DocumentActions.renameSection({ sectionId, title: title.trim() })
    );
  }

  renameSubsection(subsectionId: string, title: string): void {
    this.store.dispatch(
      DocumentActions.renameSubsection({ subsectionId, title: title.trim() })
    );
  }

  renamePage(subsectionId: string, pageId: string, title: string): void {
    this.store.dispatch(
      DocumentActions.renamePage({
        subsectionId,
        pageId,
        title: title.trim(),
      })
    );
  }

  updatePageOrientation(
    subsectionId: string,
    pageId: string,
    orientation: 'portrait' | 'landscape'
  ): void {
    this.store.dispatch(
      DocumentActions.updatePageOrientation({
        subsectionId,
        pageId,
        orientation,
      })
    );
  }

  deleteSection(sectionId: string): HierarchySelection | null {
    const sections = this.document.sections;
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      return null;
    }

    const fallback = sections[index + 1] ?? sections[index - 1];
    const fallbackSubsection = fallback?.subsections[0] ?? null;
    const fallbackPage = fallbackSubsection?.pages[0] ?? null;

    this.store.dispatch(DocumentActions.deleteSection({ sectionId }));

    return {
      sectionId: fallback?.id ?? null,
      subsectionId: fallbackSubsection?.id ?? null,
      pageId: fallbackPage?.id ?? null,
    };
  }

  deleteSubsection(
    sectionId: string,
    subsectionId: string
  ): SubsectionSelection | null {
    const section = this.document.sections.find((s) => s.id === sectionId);
    if (!section) {
      return null;
    }
    const subsections = section.subsections;
    const index = subsections.findIndex((sub) => sub.id === subsectionId);
    if (index === -1) {
      return null;
    }

    const fallback = subsections[index + 1] ?? subsections[index - 1];
    const fallbackPage = fallback?.pages[0] ?? null;

    this.store.dispatch(
      DocumentActions.deleteSubsection({ sectionId, subsectionId })
    );

    return {
      subsectionId: fallback?.id ?? null,
      pageId: fallbackPage?.id ?? null,
    };
  }

  deletePage(subsectionId: string, pageId: string): string | null {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return null;
    }

    const pages = subsection.pages;
    const index = pages.findIndex((page) => page.id === pageId);
    if (index === -1) {
      return null;
    }

    const fallback = pages[index + 1] ?? pages[index - 1];

    this.store.dispatch(DocumentActions.deletePage({ subsectionId, pageId }));

    return fallback?.id ?? null;
  }
}

interface HierarchySelection {
  sectionId: string | null;
  subsectionId: string | null;
  pageId: string | null;
}

interface SubsectionSelection {
  subsectionId: string | null;
  pageId: string | null;
}

