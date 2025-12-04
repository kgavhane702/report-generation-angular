import { createReducer, on } from '@ngrx/store';

import { DocumentModel, SubsectionModel } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { DocumentActions } from './document.actions';
import { createInitialDocument } from '../../core/utils/document.factory';
import { PageModel } from '../../models/page.model';

export const documentFeatureKey = 'document';

export interface DocumentState {
  document: DocumentModel;
}

const initialDocument = createInitialDocument();

export const initialState: DocumentState = {
  document: initialDocument,
};

export const documentReducer = createReducer(
  initialState,
  on(DocumentActions.setDocument, (state, { document }) => ({
    ...state,
    document,
  })),
  on(DocumentActions.updatePageSize, (state, { pageSize }) => ({
    ...state,
    document: {
      ...state.document,
      pageSize: {
        ...state.document.pageSize,
        ...pageSize,
      },
    },
  })),
  on(DocumentActions.addWidget, (state, payload) => ({
    ...state,
    document: addWidget(state.document, payload),
  })),
  on(DocumentActions.updateWidget, (state, payload) => ({
    ...state,
    document: updateWidget(state.document, payload),
  })),
  on(DocumentActions.addSection, (state, { section }) => ({
    ...state,
    document: {
      ...state.document,
      sections: [...state.document.sections, section],
    },
  })),
  on(DocumentActions.addSubsection, (state, { sectionId, subsection }) => ({
    ...state,
    document: addSubsection(state.document, sectionId, subsection),
  })),
  on(DocumentActions.addPage, (state, { subsectionId, page }) => ({
    ...state,
    document: addPage(state.document, subsectionId, page),
  })),
  on(DocumentActions.renameSection, (state, { sectionId, title }) => ({
    ...state,
    document: renameSection(state.document, sectionId, title),
  })),
  on(DocumentActions.renameSubsection, (state, { subsectionId, title }) => ({
    ...state,
    document: renameSubsection(state.document, subsectionId, title),
  })),
  on(DocumentActions.renamePage, (state, { subsectionId, pageId, title }) => ({
    ...state,
    document: renamePage(state.document, subsectionId, pageId, title),
  })),
  on(DocumentActions.updatePageOrientation, (state, { subsectionId, pageId, orientation }) => ({
    ...state,
    document: updatePageOrientation(state.document, subsectionId, pageId, orientation),
  })),
  on(DocumentActions.deleteSection, (state, { sectionId }) => ({
    ...state,
    document: deleteSection(state.document, sectionId),
  })),
  on(DocumentActions.deleteSubsection, (state, { sectionId, subsectionId }) => ({
    ...state,
    document: deleteSubsection(state.document, sectionId, subsectionId),
  })),
  on(DocumentActions.deletePage, (state, { subsectionId, pageId }) => ({
    ...state,
    document: deletePage(state.document, subsectionId, pageId),
  })),
  on(DocumentActions.deleteWidget, (state, payload) => ({
    ...state,
    document: deleteWidget(state.document, payload),
  }))
);

function addWidget(
  doc: DocumentModel,
  params: {
    subsectionId: string;
    pageId: string;
    widget: WidgetModel;
  }
): DocumentModel {
  const { subsectionId, pageId, widget } = params;
  const { sectionIndex, subsectionIndex, pageIndex } = findLocation(
    doc,
    subsectionId,
    pageId
  );

  if (
    sectionIndex === -1 ||
    subsectionIndex === -1 ||
    pageIndex === -1
  ) {
    return doc;
  }

  const sections = [...doc.sections];
  const section = { ...sections[sectionIndex] };
  const subsections = [...section.subsections];
  const subsection = { ...subsections[subsectionIndex] };
  const pages = [...subsection.pages];
  const page = { ...pages[pageIndex] };

  page.widgets = [...page.widgets, widget];
  pages[pageIndex] = page;
  subsection.pages = pages;
  subsections[subsectionIndex] = subsection;
  section.subsections = subsections;
  sections[sectionIndex] = section;

  return {
    ...doc,
    sections,
  };
}

function updateWidget(
  doc: DocumentModel,
  params: {
    subsectionId: string;
    pageId: string;
    widgetId: string;
    changes: Partial<WidgetModel>;
  }
): DocumentModel {
  const { subsectionId, pageId, widgetId, changes } = params;
  const location = findLocation(doc, subsectionId, pageId);

  if (
    location.sectionIndex === -1 ||
    location.subsectionIndex === -1 ||
    location.pageIndex === -1
  ) {
    return doc;
  }

  const sections = [...doc.sections];
  const section = { ...sections[location.sectionIndex] };
  const subsections = [...section.subsections];
  const subsection = { ...subsections[location.subsectionIndex] };
  const pages = [...subsection.pages];
  const page = { ...pages[location.pageIndex] };

  const widgetIndex = page.widgets.findIndex((w) => w.id === widgetId);
  if (widgetIndex === -1) {
    return doc;
  }

  const widgets = [...page.widgets];
  widgets[widgetIndex] = {
    ...widgets[widgetIndex],
    ...changes,
  };

  page.widgets = widgets;
  pages[location.pageIndex] = page;
  subsection.pages = pages;
  subsections[location.subsectionIndex] = subsection;
  section.subsections = subsections;
  sections[location.sectionIndex] = section;

  return {
    ...doc,
    sections,
  };
}

function findLocation(
  doc: DocumentModel,
  subsectionId: string,
  pageId: string
) {
  let sectionIndex = -1;
  let subsectionIndex = -1;
  let pageIndex = -1;

  doc.sections.some((section, sIdx) => {
    const subIdx = section.subsections.findIndex(
      (sub) => sub.id === subsectionId
    );
    if (subIdx !== -1) {
      sectionIndex = sIdx;
      subsectionIndex = subIdx;
      const page = section.subsections[subIdx].pages;
      pageIndex = page.findIndex((p) => p.id === pageId);
      return true;
    }
    return false;
  });

  return { sectionIndex, subsectionIndex, pageIndex };
}

function addSubsection(
  doc: DocumentModel,
  sectionId: string,
  subsection: SubsectionModel
): DocumentModel {
  const sections = doc.sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          subsections: [...section.subsections, subsection],
        }
      : section
  );

  return {
    ...doc,
    sections,
  };
}

function addPage(
  doc: DocumentModel,
  subsectionId: string,
  page: PageModel
): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId
        ? {
            ...subsection,
            pages: [...subsection.pages, page],
          }
        : subsection
    ),
  }));

  return {
    ...doc,
    sections,
  };
}

function renameSection(
  doc: DocumentModel,
  sectionId: string,
  title: string
): DocumentModel {
  const sections = doc.sections.map((section) =>
    section.id === sectionId ? { ...section, title } : section
  );
  return { ...doc, sections };
}

function renameSubsection(
  doc: DocumentModel,
  subsectionId: string,
  title: string
): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId ? { ...subsection, title } : subsection
    ),
  }));
  return { ...doc, sections };
}

function renamePage(
  doc: DocumentModel,
  subsectionId: string,
  pageId: string,
  title: string
): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId
        ? {
            ...subsection,
            pages: subsection.pages.map((page) =>
              page.id === pageId ? { ...page, title } : page
            ),
          }
        : subsection
    ),
  }));

  return { ...doc, sections };
}

function updatePageOrientation(
  doc: DocumentModel,
  subsectionId: string,
  pageId: string,
  orientation: 'portrait' | 'landscape'
): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId
        ? {
            ...subsection,
            pages: subsection.pages.map((page) =>
              page.id === pageId ? { ...page, orientation } : page
            ),
          }
        : subsection
    ),
  }));

  return { ...doc, sections };
}

function deleteSection(
  doc: DocumentModel,
  sectionId: string
): DocumentModel {
  return {
    ...doc,
    sections: doc.sections.filter((section) => section.id !== sectionId),
  };
}

function deleteSubsection(
  doc: DocumentModel,
  sectionId: string,
  subsectionId: string
): DocumentModel {
  const sections = doc.sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          subsections: section.subsections.filter(
            (subsection) => subsection.id !== subsectionId
          ),
        }
      : section
  );

  return {
    ...doc,
    sections,
  };
}

function deletePage(
  doc: DocumentModel,
  subsectionId: string,
  pageId: string
): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId
        ? {
            ...subsection,
            pages: subsection.pages.filter((page) => page.id !== pageId),
          }
        : subsection
    ),
  }));

  return {
    ...doc,
    sections,
  };
}

function deleteWidget(
  doc: DocumentModel,
  params: {
    subsectionId: string;
    pageId: string;
    widgetId: string;
  }
): DocumentModel {
  const { subsectionId, pageId, widgetId } = params;
  const location = findLocation(doc, subsectionId, pageId);

  if (
    location.sectionIndex === -1 ||
    location.subsectionIndex === -1 ||
    location.pageIndex === -1
  ) {
    return doc;
  }

  const sections = [...doc.sections];
  const section = { ...sections[location.sectionIndex] };
  const subsections = [...section.subsections];
  const subsection = { ...subsections[location.subsectionIndex] };
  const pages = [...subsection.pages];
  const page = { ...pages[location.pageIndex] };

  page.widgets = page.widgets.filter((w) => w.id !== widgetId);

  pages[location.pageIndex] = page;
  subsection.pages = pages;
  subsections[location.subsectionIndex] = subsection;
  section.subsections = subsections;
  sections[location.sectionIndex] = section;

  return {
    ...doc,
    sections,
  };
}

