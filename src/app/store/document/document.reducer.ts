import { createReducer, on } from '@ngrx/store';

import { DocumentModel, SubsectionModel, SectionModel } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { PageModel } from '../../models/page.model';
import {
  DocumentActions,
  WidgetActions,
  PageActions,
  SubsectionActions,
  SectionActions,
  DocumentMetaActions,
  BulkDocumentActions,
} from './document.actions';
import { createInitialDocument } from '../../core/utils/document.factory';
import {
  NormalizedDocumentState,
  DocumentMetaState,
  SectionEntity,
  SubsectionEntity,
  PageEntity,
  WidgetEntity,
  createInitialNormalizedState,
} from './document.state';
import {
  sectionAdapter,
  subsectionAdapter,
  pageAdapter,
  widgetAdapter,
} from './entity-adapters';

export const documentFeatureKey = 'document';

/**
 * Document State - NORMALIZED ONLY
 * 
 * The legacy nested structure has been removed.
 * All state is now stored in normalized entity collections.
 * Use selectors to derive nested structures when needed (e.g., for export).
 */
export interface DocumentState {
  normalized: NormalizedDocumentState;
}

const initialDocument = createInitialDocument();
const initialNormalized = normalizeDocument(initialDocument);

export const initialState: DocumentState = {
  normalized: initialNormalized,
};

/**
 * Main document reducer - NORMALIZED ONLY
 */
export const documentReducer = createReducer(
  initialState,
  
  // ============================================
  // DOCUMENT ACTIONS
  // ============================================
  
  on(DocumentActions.setDocument, (state, { document }) => {
    const normalized = normalizeDocument(document);
    return { normalized };
  }),
  
  on(DocumentActions.updateDocumentTitle, (state, { title }) => {
    return {
      normalized: {
        ...state.normalized,
        meta: { ...state.normalized.meta, title },
      },
    };
  }),
  
  on(DocumentActions.updatePageSize, (state, { pageSize }) => {
    const newPageSize = { ...state.normalized.meta.pageSize, ...pageSize };
    return {
      normalized: {
        ...state.normalized,
        meta: { ...state.normalized.meta, pageSize: newPageSize },
      },
    };
  }),
  
  on(DocumentActions.addWidget, (state, { pageId, widget }) => {
    const widgetEntity: WidgetEntity = { ...widget, pageId };
    const newWidgets = widgetAdapter.addOne(widgetEntity, state.normalized.widgets);
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [pageId]: [...(state.normalized.widgetIdsByPageId[pageId] || []), widget.id],
    };
    
    return {
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.updateWidget, (state, { widgetId, changes }) => {
    const newWidgets = widgetAdapter.updateOne(
      { id: widgetId, changes },
      state.normalized.widgets
    );
    
    return {
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
      },
    };
  }),
  
  on(DocumentActions.addSection, (state, { section }) => {
    const { normalizedSection, normalizedSubsections, normalizedPages, normalizedWidgets } = 
      normalizeSectionDeep(section);
    
    let newSections = sectionAdapter.addOne(normalizedSection, state.normalized.sections);
    let newSubsections = state.normalized.subsections;
    let newPages = state.normalized.pages;
    let newWidgets = state.normalized.widgets;
    let newSubsectionIdsBySectionId = { ...state.normalized.subsectionIdsBySectionId };
    let newPageIdsBySubsectionId = { ...state.normalized.pageIdsBySubsectionId };
    let newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    
    normalizedSubsections.forEach(sub => {
      newSubsections = subsectionAdapter.addOne(sub, newSubsections);
    });
    
    normalizedPages.forEach(page => {
      newPages = pageAdapter.addOne(page, newPages);
    });
    
    normalizedWidgets.forEach(widget => {
      newWidgets = widgetAdapter.addOne(widget, newWidgets);
    });
    
    newSubsectionIdsBySectionId[section.id] = section.subsections.map(s => s.id);
    section.subsections.forEach(sub => {
      newPageIdsBySubsectionId[sub.id] = sub.pages.map(p => p.id);
      sub.pages.forEach(page => {
        newWidgetIdsByPageId[page.id] = page.widgets.map(w => w.id);
      });
    });
    
    const newSectionIds = [...state.normalized.sectionIds, section.id];
    
    return {
      normalized: {
        ...state.normalized,
        sections: newSections,
        subsections: newSubsections,
        pages: newPages,
        widgets: newWidgets,
        sectionIds: newSectionIds,
        subsectionIdsBySectionId: newSubsectionIdsBySectionId,
        pageIdsBySubsectionId: newPageIdsBySubsectionId,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.addSubsection, (state, { sectionId, subsection }) => {
    const { normalizedSubsection, normalizedPages, normalizedWidgets } = 
      normalizeSubsectionDeep(subsection, sectionId);
    
    let newSubsections = subsectionAdapter.addOne(normalizedSubsection, state.normalized.subsections);
    let newPages = state.normalized.pages;
    let newWidgets = state.normalized.widgets;
    let newPageIdsBySubsectionId = { ...state.normalized.pageIdsBySubsectionId };
    let newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    
    normalizedPages.forEach(page => {
      newPages = pageAdapter.addOne(page, newPages);
    });
    
    normalizedWidgets.forEach(widget => {
      newWidgets = widgetAdapter.addOne(widget, newWidgets);
    });
    
    const newSubsectionIdsBySectionId = {
      ...state.normalized.subsectionIdsBySectionId,
      [sectionId]: [...(state.normalized.subsectionIdsBySectionId[sectionId] || []), subsection.id],
    };
    
    newPageIdsBySubsectionId[subsection.id] = subsection.pages.map(p => p.id);
    subsection.pages.forEach(page => {
      newWidgetIdsByPageId[page.id] = page.widgets.map(w => w.id);
    });
    
    return {
      normalized: {
        ...state.normalized,
        subsections: newSubsections,
        pages: newPages,
        widgets: newWidgets,
        subsectionIdsBySectionId: newSubsectionIdsBySectionId,
        pageIdsBySubsectionId: newPageIdsBySubsectionId,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.addPage, (state, { subsectionId, page }) => {
    const pageEntity: PageEntity = {
      id: page.id,
      subsectionId,
      number: page.number,
      title: page.title,
      background: page.background,
      orientation: page.orientation,
    };
    
    const widgetEntities: WidgetEntity[] = page.widgets.map(w => ({
      ...w,
      pageId: page.id,
    }));
    
    let newPages = pageAdapter.addOne(pageEntity, state.normalized.pages);
    let newWidgets = state.normalized.widgets;
    
    widgetEntities.forEach(widget => {
      newWidgets = widgetAdapter.addOne(widget, newWidgets);
    });
    
    const newPageIdsBySubsectionId = {
      ...state.normalized.pageIdsBySubsectionId,
      [subsectionId]: [...(state.normalized.pageIdsBySubsectionId[subsectionId] || []), page.id],
    };
    
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [page.id]: page.widgets.map(w => w.id),
    };
    
    return {
      normalized: {
        ...state.normalized,
        pages: newPages,
        widgets: newWidgets,
        pageIdsBySubsectionId: newPageIdsBySubsectionId,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.renameSection, (state, { sectionId, title }) => {
    const newSections = sectionAdapter.updateOne(
      { id: sectionId, changes: { title } },
      state.normalized.sections
    );
    
    return {
      normalized: {
        ...state.normalized,
        sections: newSections,
      },
    };
  }),
  
  on(DocumentActions.renameSubsection, (state, { subsectionId, title }) => {
    const newSubsections = subsectionAdapter.updateOne(
      { id: subsectionId, changes: { title } },
      state.normalized.subsections
    );
    
    return {
      normalized: {
        ...state.normalized,
        subsections: newSubsections,
      },
    };
  }),
  
  on(DocumentActions.renamePage, (state, { pageId, title }) => {
    const newPages = pageAdapter.updateOne(
      { id: pageId, changes: { title } },
      state.normalized.pages
    );
    
    return {
      normalized: {
        ...state.normalized,
        pages: newPages,
      },
    };
  }),
  
  on(DocumentActions.updatePageOrientation, (state, { pageId, orientation }) => {
    const newPages = pageAdapter.updateOne(
      { id: pageId, changes: { orientation } },
      state.normalized.pages
    );
    
    return {
      normalized: {
        ...state.normalized,
        pages: newPages,
      },
    };
  }),
  
  on(DocumentActions.deleteSection, (state, { sectionId }) => {
    const subsectionIds = state.normalized.subsectionIdsBySectionId[sectionId] || [];
    const pageIds: string[] = [];
    const widgetIds: string[] = [];
    
    subsectionIds.forEach(subId => {
      const pIds = state.normalized.pageIdsBySubsectionId[subId] || [];
      pageIds.push(...pIds);
      pIds.forEach(pageId => {
        const wIds = state.normalized.widgetIdsByPageId[pageId] || [];
        widgetIds.push(...wIds);
      });
    });
    
    let newSections = sectionAdapter.removeOne(sectionId, state.normalized.sections);
    let newSubsections = subsectionAdapter.removeMany(subsectionIds, state.normalized.subsections);
    let newPages = pageAdapter.removeMany(pageIds, state.normalized.pages);
    let newWidgets = widgetAdapter.removeMany(widgetIds, state.normalized.widgets);
    
    const newSectionIds = state.normalized.sectionIds.filter(id => id !== sectionId);
    const newSubsectionIdsBySectionId = { ...state.normalized.subsectionIdsBySectionId };
    delete newSubsectionIdsBySectionId[sectionId];
    
    const newPageIdsBySubsectionId = { ...state.normalized.pageIdsBySubsectionId };
    subsectionIds.forEach(subId => delete newPageIdsBySubsectionId[subId]);
    
    const newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    pageIds.forEach(pageId => delete newWidgetIdsByPageId[pageId]);
    
    return {
      normalized: {
        ...state.normalized,
        sections: newSections,
        subsections: newSubsections,
        pages: newPages,
        widgets: newWidgets,
        sectionIds: newSectionIds,
        subsectionIdsBySectionId: newSubsectionIdsBySectionId,
        pageIdsBySubsectionId: newPageIdsBySubsectionId,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.deleteSubsection, (state, { sectionId, subsectionId }) => {
    const pageIds = state.normalized.pageIdsBySubsectionId[subsectionId] || [];
    const widgetIds: string[] = [];
    
    pageIds.forEach(pageId => {
      const wIds = state.normalized.widgetIdsByPageId[pageId] || [];
      widgetIds.push(...wIds);
    });
    
    let newSubsections = subsectionAdapter.removeOne(subsectionId, state.normalized.subsections);
    let newPages = pageAdapter.removeMany(pageIds, state.normalized.pages);
    let newWidgets = widgetAdapter.removeMany(widgetIds, state.normalized.widgets);
    
    const newSubsectionIdsBySectionId = {
      ...state.normalized.subsectionIdsBySectionId,
      [sectionId]: (state.normalized.subsectionIdsBySectionId[sectionId] || [])
        .filter(id => id !== subsectionId),
    };
    
    const newPageIdsBySubsectionId = { ...state.normalized.pageIdsBySubsectionId };
    delete newPageIdsBySubsectionId[subsectionId];
    
    const newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    pageIds.forEach(pageId => delete newWidgetIdsByPageId[pageId]);
    
    return {
      normalized: {
        ...state.normalized,
        subsections: newSubsections,
        pages: newPages,
        widgets: newWidgets,
        subsectionIdsBySectionId: newSubsectionIdsBySectionId,
        pageIdsBySubsectionId: newPageIdsBySubsectionId,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.deletePage, (state, { subsectionId, pageId }) => {
    const widgetIds = state.normalized.widgetIdsByPageId[pageId] || [];
    
    let newPages = pageAdapter.removeOne(pageId, state.normalized.pages);
    let newWidgets = widgetAdapter.removeMany(widgetIds, state.normalized.widgets);
    
    const newPageIdsBySubsectionId = {
      ...state.normalized.pageIdsBySubsectionId,
      [subsectionId]: (state.normalized.pageIdsBySubsectionId[subsectionId] || [])
        .filter(id => id !== pageId),
    };
    
    const newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    delete newWidgetIdsByPageId[pageId];
    
    return {
      normalized: {
        ...state.normalized,
        pages: newPages,
        widgets: newWidgets,
        pageIdsBySubsectionId: newPageIdsBySubsectionId,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.deleteWidget, (state, { pageId, widgetId }) => {
    const newWidgets = widgetAdapter.removeOne(widgetId, state.normalized.widgets);
    
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [pageId]: (state.normalized.widgetIdsByPageId[pageId] || [])
        .filter(id => id !== widgetId),
    };
    
    return {
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  // ============================================
  // ENTITY ACTIONS (Normalized)
  // ============================================
  
  on(WidgetActions.updateOne, (state, { id, changes }) => {
    const newWidgets = widgetAdapter.updateOne({ id, changes }, state.normalized.widgets);
    return {
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
      },
    };
  }),
  
  on(WidgetActions.addOne, (state, { widget }) => {
    const newWidgets = widgetAdapter.addOne(widget, state.normalized.widgets);
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [widget.pageId]: [...(state.normalized.widgetIdsByPageId[widget.pageId] || []), widget.id],
    };
    
    return {
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(WidgetActions.removeOne, (state, { id }) => {
    const widget = state.normalized.widgets.entities[id];
    if (!widget) return state;
    
    const newWidgets = widgetAdapter.removeOne(id, state.normalized.widgets);
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [widget.pageId]: (state.normalized.widgetIdsByPageId[widget.pageId] || [])
        .filter(wId => wId !== id),
    };
    
    return {
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentMetaActions.updateFooter, (state, { footer }) => {
    return {
      normalized: {
        ...state.normalized,
        meta: { ...state.normalized.meta, footer },
      },
    };
  }),
  
  on(DocumentMetaActions.updateLogo, (state, { logo }) => {
    return {
      normalized: {
        ...state.normalized,
        meta: { ...state.normalized.meta, logo },
      },
    };
  }),
  
  on(BulkDocumentActions.loadDocument, (state, { document }) => {
    const normalized = normalizeDocument(document);
    return { normalized };
  }),
  
  on(BulkDocumentActions.clearAll, () => initialState),
);

// ============================================
// NORMALIZATION HELPERS
// ============================================

/**
 * Convert nested DocumentModel to NormalizedDocumentState
 */
function normalizeDocument(doc: DocumentModel): NormalizedDocumentState {
  const meta: DocumentMetaState = {
    id: doc.id,
    title: doc.title,
    version: doc.version,
    pageSize: doc.pageSize,
    metadata: doc.metadata,
    footer: doc.footer,
    logo: doc.logo,
  };
  
  const sections: SectionEntity[] = [];
  const subsections: SubsectionEntity[] = [];
  const pages: PageEntity[] = [];
  const widgets: WidgetEntity[] = [];
  
  const sectionIds: string[] = [];
  const subsectionIdsBySectionId: Record<string, string[]> = {};
  const pageIdsBySubsectionId: Record<string, string[]> = {};
  const widgetIdsByPageId: Record<string, string[]> = {};
  
  doc.sections.forEach(section => {
    sectionIds.push(section.id);
    sections.push({ id: section.id, title: section.title });
    subsectionIdsBySectionId[section.id] = [];
    
    section.subsections.forEach(subsection => {
      subsectionIdsBySectionId[section.id].push(subsection.id);
      subsections.push({ id: subsection.id, sectionId: section.id, title: subsection.title });
      pageIdsBySubsectionId[subsection.id] = [];
      
      subsection.pages.forEach(page => {
        pageIdsBySubsectionId[subsection.id].push(page.id);
        pages.push({
          id: page.id,
          subsectionId: subsection.id,
          number: page.number,
          title: page.title,
          background: page.background,
          orientation: page.orientation,
        });
        widgetIdsByPageId[page.id] = [];
        
        page.widgets.forEach(widget => {
          widgetIdsByPageId[page.id].push(widget.id);
          widgets.push({ ...widget, pageId: page.id });
        });
      });
    });
  });
  
  return {
    meta,
    sections: sectionAdapter.setAll(sections, sectionAdapter.getInitialState()),
    subsections: subsectionAdapter.setAll(subsections, subsectionAdapter.getInitialState()),
    pages: pageAdapter.setAll(pages, pageAdapter.getInitialState()),
    widgets: widgetAdapter.setAll(widgets, widgetAdapter.getInitialState()),
    sectionIds,
    subsectionIdsBySectionId,
    pageIdsBySubsectionId,
    widgetIdsByPageId,
  };
}

/**
 * Normalize a section with all its children
 */
function normalizeSectionDeep(section: SectionModel): {
  normalizedSection: SectionEntity;
  normalizedSubsections: SubsectionEntity[];
  normalizedPages: PageEntity[];
  normalizedWidgets: WidgetEntity[];
} {
  const normalizedSection: SectionEntity = {
    id: section.id,
    title: section.title,
  };
  
  const normalizedSubsections: SubsectionEntity[] = [];
  const normalizedPages: PageEntity[] = [];
  const normalizedWidgets: WidgetEntity[] = [];
  
  section.subsections.forEach(sub => {
    const { normalizedSubsection, normalizedPages: pages, normalizedWidgets: widgets } = 
      normalizeSubsectionDeep(sub, section.id);
    normalizedSubsections.push(normalizedSubsection);
    normalizedPages.push(...pages);
    normalizedWidgets.push(...widgets);
  });
  
  return { normalizedSection, normalizedSubsections, normalizedPages, normalizedWidgets };
}

/**
 * Normalize a subsection with all its children
 */
function normalizeSubsectionDeep(subsection: SubsectionModel, sectionId: string): {
  normalizedSubsection: SubsectionEntity;
  normalizedPages: PageEntity[];
  normalizedWidgets: WidgetEntity[];
} {
  const normalizedSubsection: SubsectionEntity = {
    id: subsection.id,
    sectionId,
    title: subsection.title,
  };
  
  const normalizedPages: PageEntity[] = [];
  const normalizedWidgets: WidgetEntity[] = [];
  
  subsection.pages.forEach(page => {
    normalizedPages.push({
      id: page.id,
      subsectionId: subsection.id,
      number: page.number,
      title: page.title,
      background: page.background,
      orientation: page.orientation,
    });
    
    page.widgets.forEach(widget => {
      normalizedWidgets.push({ ...widget, pageId: page.id });
    });
  });
  
  return { normalizedSubsection, normalizedPages, normalizedWidgets };
}
