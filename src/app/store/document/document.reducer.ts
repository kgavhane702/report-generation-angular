import { createReducer, on } from '@ngrx/store';

import { DocumentModel } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { DocumentActions } from './document.actions';
import { createInitialDocument } from '../../core/utils/document.factory';

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

