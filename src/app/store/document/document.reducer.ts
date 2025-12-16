import { createReducer, on } from '@ngrx/store';
import { EntityState } from '@ngrx/entity';

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
 * Combined Document State
 * 
 * We maintain both the legacy nested structure AND the new normalized structure
 * during the migration period. The legacy structure is derived from normalized
 * state when needed for backward compatibility.
 */
export interface DocumentState {
  /** Legacy nested document structure (derived from normalized state) */
  document: DocumentModel;
  
  /** New normalized state structure */
  normalized: NormalizedDocumentState;
}

const initialDocument = createInitialDocument();
const initialNormalized = normalizeDocument(initialDocument);

export const initialState: DocumentState = {
  document: initialDocument,
  normalized: initialNormalized,
};

/**
 * Main document reducer
 */
export const documentReducer = createReducer(
  initialState,
  
  // ============================================
  // LEGACY ACTIONS (backward compatibility)
  // These update BOTH normalized and legacy state
  // ============================================
  
  on(DocumentActions.setDocument, (state, { document }) => {
    const normalized = normalizeDocument(document);
    return {
      ...state,
      document,
      normalized,
    };
  }),
  
  on(DocumentActions.updateDocumentTitle, (state, { title }) => {
    const newMeta = { ...state.normalized.meta, title };
    const newDocument = { ...state.document, title };
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        meta: newMeta,
      },
    };
  }),
  
  on(DocumentActions.updatePageSize, (state, { pageSize }) => {
    const newPageSize = { ...state.normalized.meta.pageSize, ...pageSize };
    const newMeta = { ...state.normalized.meta, pageSize: newPageSize };
    const newDocument = { ...state.document, pageSize: newPageSize };
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        meta: newMeta,
      },
    };
  }),
  
  on(DocumentActions.addWidget, (state, { subsectionId, pageId, widget }) => {
    // Create widget entity
    const widgetEntity: WidgetEntity = {
      ...widget,
      pageId,
    };
    
    // Update normalized state using adapter
    const newWidgets = widgetAdapter.addOne(widgetEntity, state.normalized.widgets);
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [pageId]: [...(state.normalized.widgetIdsByPageId[pageId] || []), widget.id],
    };
    
    // Update legacy state
    const newDocument = addWidgetLegacy(state.document, { subsectionId, pageId, widget });
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.updateWidget, (state, { subsectionId, pageId, widgetId, changes }) => {
    // Update normalized state - ONLY the widget entity changes reference
    const newWidgets = widgetAdapter.updateOne(
      { id: widgetId, changes },
      state.normalized.widgets
    );
    
    // Update legacy state for backward compatibility
    const newDocument = updateWidgetLegacy(state.document, { subsectionId, pageId, widgetId, changes });
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
      },
    };
  }),
  
  on(DocumentActions.addSection, (state, { section }) => {
    // Normalize the section
    const { normalizedSection, normalizedSubsections, normalizedPages, normalizedWidgets } = 
      normalizeSectionDeep(section);
    
    // Update all entity collections
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
    
    // Update relationship maps
    newSubsectionIdsBySectionId[section.id] = section.subsections.map(s => s.id);
    section.subsections.forEach(sub => {
      newPageIdsBySubsectionId[sub.id] = sub.pages.map(p => p.id);
      sub.pages.forEach(page => {
        newWidgetIdsByPageId[page.id] = page.widgets.map(w => w.id);
      });
    });
    
    const newSectionIds = [...state.normalized.sectionIds, section.id];
    
    // Update legacy state
    const newDocument = {
      ...state.document,
      sections: [...state.document.sections, section],
    };
    
    return {
      ...state,
      document: newDocument,
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
    // Normalize the subsection
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
    
    // Update relationship maps
    const newSubsectionIdsBySectionId = {
      ...state.normalized.subsectionIdsBySectionId,
      [sectionId]: [...(state.normalized.subsectionIdsBySectionId[sectionId] || []), subsection.id],
    };
    
    newPageIdsBySubsectionId[subsection.id] = subsection.pages.map(p => p.id);
    subsection.pages.forEach(page => {
      newWidgetIdsByPageId[page.id] = page.widgets.map(w => w.id);
    });
    
    // Update legacy state
    const newDocument = addSubsectionLegacy(state.document, sectionId, subsection);
    
    return {
      ...state,
      document: newDocument,
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
    // Create page entity
    const pageEntity: PageEntity = {
      id: page.id,
      subsectionId,
      number: page.number,
      title: page.title,
      background: page.background,
      orientation: page.orientation,
    };
    
    // Create widget entities
    const widgetEntities: WidgetEntity[] = page.widgets.map(w => ({
      ...w,
      pageId: page.id,
    }));
    
    let newPages = pageAdapter.addOne(pageEntity, state.normalized.pages);
    let newWidgets = state.normalized.widgets;
    
    widgetEntities.forEach(widget => {
      newWidgets = widgetAdapter.addOne(widget, newWidgets);
    });
    
    // Update relationship maps
    const newPageIdsBySubsectionId = {
      ...state.normalized.pageIdsBySubsectionId,
      [subsectionId]: [...(state.normalized.pageIdsBySubsectionId[subsectionId] || []), page.id],
    };
    
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [page.id]: page.widgets.map(w => w.id),
    };
    
    // Update legacy state
    const newDocument = addPageLegacy(state.document, subsectionId, page);
    
    return {
      ...state,
      document: newDocument,
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
    
    const newDocument = renameSectionLegacy(state.document, sectionId, title);
    
    return {
      ...state,
      document: newDocument,
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
    
    const newDocument = renameSubsectionLegacy(state.document, subsectionId, title);
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        subsections: newSubsections,
      },
    };
  }),
  
  on(DocumentActions.renamePage, (state, { subsectionId, pageId, title }) => {
    const newPages = pageAdapter.updateOne(
      { id: pageId, changes: { title } },
      state.normalized.pages
    );
    
    const newDocument = renamePageLegacy(state.document, subsectionId, pageId, title);
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        pages: newPages,
      },
    };
  }),
  
  on(DocumentActions.updatePageOrientation, (state, { subsectionId, pageId, orientation }) => {
    const newPages = pageAdapter.updateOne(
      { id: pageId, changes: { orientation } },
      state.normalized.pages
    );
    
    const newDocument = updatePageOrientationLegacy(state.document, subsectionId, pageId, orientation);
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        pages: newPages,
      },
    };
  }),
  
  on(DocumentActions.deleteSection, (state, { sectionId }) => {
    // Get all subsections, pages, and widgets to delete
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
    
    // Remove from all collections
    let newSections = sectionAdapter.removeOne(sectionId, state.normalized.sections);
    let newSubsections = subsectionAdapter.removeMany(subsectionIds, state.normalized.subsections);
    let newPages = pageAdapter.removeMany(pageIds, state.normalized.pages);
    let newWidgets = widgetAdapter.removeMany(widgetIds, state.normalized.widgets);
    
    // Update relationship maps
    const newSectionIds = state.normalized.sectionIds.filter(id => id !== sectionId);
    const newSubsectionIdsBySectionId = { ...state.normalized.subsectionIdsBySectionId };
    delete newSubsectionIdsBySectionId[sectionId];
    
    const newPageIdsBySubsectionId = { ...state.normalized.pageIdsBySubsectionId };
    subsectionIds.forEach(subId => delete newPageIdsBySubsectionId[subId]);
    
    const newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    pageIds.forEach(pageId => delete newWidgetIdsByPageId[pageId]);
    
    // Update legacy state
    const newDocument = deleteSectionLegacy(state.document, sectionId);
    
    return {
      ...state,
      document: newDocument,
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
    // Get all pages and widgets to delete
    const pageIds = state.normalized.pageIdsBySubsectionId[subsectionId] || [];
    const widgetIds: string[] = [];
    
    pageIds.forEach(pageId => {
      const wIds = state.normalized.widgetIdsByPageId[pageId] || [];
      widgetIds.push(...wIds);
    });
    
    // Remove from collections
    let newSubsections = subsectionAdapter.removeOne(subsectionId, state.normalized.subsections);
    let newPages = pageAdapter.removeMany(pageIds, state.normalized.pages);
    let newWidgets = widgetAdapter.removeMany(widgetIds, state.normalized.widgets);
    
    // Update relationship maps
    const newSubsectionIdsBySectionId = {
      ...state.normalized.subsectionIdsBySectionId,
      [sectionId]: (state.normalized.subsectionIdsBySectionId[sectionId] || [])
        .filter(id => id !== subsectionId),
    };
    
    const newPageIdsBySubsectionId = { ...state.normalized.pageIdsBySubsectionId };
    delete newPageIdsBySubsectionId[subsectionId];
    
    const newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    pageIds.forEach(pageId => delete newWidgetIdsByPageId[pageId]);
    
    // Update legacy state
    const newDocument = deleteSubsectionLegacy(state.document, sectionId, subsectionId);
    
    return {
      ...state,
      document: newDocument,
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
    // Get all widgets to delete
    const widgetIds = state.normalized.widgetIdsByPageId[pageId] || [];
    
    // Remove from collections
    let newPages = pageAdapter.removeOne(pageId, state.normalized.pages);
    let newWidgets = widgetAdapter.removeMany(widgetIds, state.normalized.widgets);
    
    // Update relationship maps
    const newPageIdsBySubsectionId = {
      ...state.normalized.pageIdsBySubsectionId,
      [subsectionId]: (state.normalized.pageIdsBySubsectionId[subsectionId] || [])
        .filter(id => id !== pageId),
    };
    
    const newWidgetIdsByPageId = { ...state.normalized.widgetIdsByPageId };
    delete newWidgetIdsByPageId[pageId];
    
    // Update legacy state
    const newDocument = deletePageLegacy(state.document, subsectionId, pageId);
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        pages: newPages,
        widgets: newWidgets,
        pageIdsBySubsectionId: newPageIdsBySubsectionId,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(DocumentActions.deleteWidget, (state, { subsectionId, pageId, widgetId }) => {
    // Remove widget from collection
    const newWidgets = widgetAdapter.removeOne(widgetId, state.normalized.widgets);
    
    // Update relationship map
    const newWidgetIdsByPageId = {
      ...state.normalized.widgetIdsByPageId,
      [pageId]: (state.normalized.widgetIdsByPageId[pageId] || [])
        .filter(id => id !== widgetId),
    };
    
    // Update legacy state
    const newDocument = deleteWidgetLegacy(state.document, { subsectionId, pageId, widgetId });
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  // ============================================
  // NEW ENTITY ACTIONS (normalized state only)
  // These are more efficient and don't need legacy sync
  // ============================================
  
  on(WidgetActions.updateOne, (state, { id, changes }) => {
    // ONLY update the widget entity - this is the key optimization!
    const newWidgets = widgetAdapter.updateOne({ id, changes }, state.normalized.widgets);
    
    // Derive legacy document from normalized state
    const newDocument = denormalizeDocument(
      state.normalized.meta,
      state.normalized.sections,
      state.normalized.subsections,
      state.normalized.pages,
      newWidgets,
      state.normalized.sectionIds,
      state.normalized.subsectionIdsBySectionId,
      state.normalized.pageIdsBySubsectionId,
      state.normalized.widgetIdsByPageId
    );
    
    return {
      ...state,
      document: newDocument,
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
    
    const newDocument = denormalizeDocument(
      state.normalized.meta,
      state.normalized.sections,
      state.normalized.subsections,
      state.normalized.pages,
      newWidgets,
      state.normalized.sectionIds,
      state.normalized.subsectionIdsBySectionId,
      state.normalized.pageIdsBySubsectionId,
      newWidgetIdsByPageId
    );
    
    return {
      ...state,
      document: newDocument,
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
    
    const newDocument = denormalizeDocument(
      state.normalized.meta,
      state.normalized.sections,
      state.normalized.subsections,
      state.normalized.pages,
      newWidgets,
      state.normalized.sectionIds,
      state.normalized.subsectionIdsBySectionId,
      state.normalized.pageIdsBySubsectionId,
      newWidgetIdsByPageId
    );
    
    return {
      ...state,
      document: newDocument,
      normalized: {
        ...state.normalized,
        widgets: newWidgets,
        widgetIdsByPageId: newWidgetIdsByPageId,
      },
    };
  }),
  
  on(BulkDocumentActions.loadDocument, (state, { document }) => {
    const normalized = normalizeDocument(document);
    return {
      ...state,
      document,
      normalized,
    };
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
 * Convert NormalizedDocumentState back to DocumentModel
 */
function denormalizeDocument(
  meta: DocumentMetaState,
  sections: EntityState<SectionEntity>,
  subsections: EntityState<SubsectionEntity>,
  pages: EntityState<PageEntity>,
  widgets: EntityState<WidgetEntity>,
  sectionIds: string[],
  subsectionIdsBySectionId: Record<string, string[]>,
  pageIdsBySubsectionId: Record<string, string[]>,
  widgetIdsByPageId: Record<string, string[]>
): DocumentModel {
  return {
    id: meta.id,
    title: meta.title,
    version: meta.version,
    pageSize: meta.pageSize,
    metadata: meta.metadata,
    footer: meta.footer,
    logo: meta.logo,
    sections: sectionIds.map(sectionId => {
      const section = sections.entities[sectionId]!;
      const subIds = subsectionIdsBySectionId[sectionId] || [];
      
      return {
        id: section.id,
        title: section.title,
        subsections: subIds.map(subId => {
          const subsection = subsections.entities[subId]!;
          const pageIds = pageIdsBySubsectionId[subId] || [];
          
          return {
            id: subsection.id,
            title: subsection.title,
            pages: pageIds.map(pageId => {
              const page = pages.entities[pageId]!;
              const widgetIds = widgetIdsByPageId[pageId] || [];
              
              return {
                id: page.id,
                number: page.number,
                title: page.title,
                background: page.background,
                orientation: page.orientation,
                widgets: widgetIds.map(widgetId => {
                  const widget = widgets.entities[widgetId]!;
                  // Remove pageId from widget when denormalizing
                  const { pageId: _, ...widgetWithoutPageId } = widget;
                  return widgetWithoutPageId as WidgetModel;
                }),
              };
            }),
          };
        }),
      };
    }),
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

// ============================================
// LEGACY HELPER FUNCTIONS (for backward compatibility)
// ============================================

function addWidgetLegacy(
  doc: DocumentModel,
  params: { subsectionId: string; pageId: string; widget: WidgetModel }
): DocumentModel {
  const { subsectionId, pageId, widget } = params;
  const { sectionIndex, subsectionIndex, pageIndex } = findLocation(doc, subsectionId, pageId);
  
  if (sectionIndex === -1 || subsectionIndex === -1 || pageIndex === -1) {
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
  
  return { ...doc, sections };
}

function updateWidgetLegacy(
  doc: DocumentModel,
  params: { subsectionId: string; pageId: string; widgetId: string; changes: Partial<WidgetModel> }
): DocumentModel {
  const { subsectionId, pageId, widgetId, changes } = params;
  const location = findLocation(doc, subsectionId, pageId);
  
  if (location.sectionIndex === -1 || location.subsectionIndex === -1 || location.pageIndex === -1) {
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
  widgets[widgetIndex] = { ...widgets[widgetIndex], ...changes };
  
  page.widgets = widgets;
  pages[location.pageIndex] = page;
  subsection.pages = pages;
  subsections[location.subsectionIndex] = subsection;
  section.subsections = subsections;
  sections[location.sectionIndex] = section;
  
  return { ...doc, sections };
}

function findLocation(
  doc: DocumentModel,
  subsectionId: string,
  pageId: string
): { sectionIndex: number; subsectionIndex: number; pageIndex: number } {
  let sectionIndex = -1;
  let subsectionIndex = -1;
  let pageIndex = -1;
  
  doc.sections.some((section, sIdx) => {
    const subIdx = section.subsections.findIndex((sub) => sub.id === subsectionId);
    if (subIdx !== -1) {
      sectionIndex = sIdx;
      subsectionIndex = subIdx;
      pageIndex = section.subsections[subIdx].pages.findIndex((p) => p.id === pageId);
      return true;
    }
    return false;
  });
  
  return { sectionIndex, subsectionIndex, pageIndex };
}

function addSubsectionLegacy(doc: DocumentModel, sectionId: string, subsection: SubsectionModel): DocumentModel {
  const sections = doc.sections.map((section) =>
    section.id === sectionId
      ? { ...section, subsections: [...section.subsections, subsection] }
      : section
  );
  return { ...doc, sections };
}

function addPageLegacy(doc: DocumentModel, subsectionId: string, page: PageModel): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId
        ? { ...subsection, pages: [...subsection.pages, page] }
        : subsection
    ),
  }));
  return { ...doc, sections };
}

function renameSectionLegacy(doc: DocumentModel, sectionId: string, title: string): DocumentModel {
  const sections = doc.sections.map((section) =>
    section.id === sectionId ? { ...section, title } : section
  );
  return { ...doc, sections };
}

function renameSubsectionLegacy(doc: DocumentModel, subsectionId: string, title: string): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId ? { ...subsection, title } : subsection
    ),
  }));
  return { ...doc, sections };
}

function renamePageLegacy(doc: DocumentModel, subsectionId: string, pageId: string, title: string): DocumentModel {
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

function updatePageOrientationLegacy(
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

function deleteSectionLegacy(doc: DocumentModel, sectionId: string): DocumentModel {
  return {
    ...doc,
    sections: doc.sections.filter((section) => section.id !== sectionId),
  };
}

function deleteSubsectionLegacy(doc: DocumentModel, sectionId: string, subsectionId: string): DocumentModel {
  const sections = doc.sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          subsections: section.subsections.filter((subsection) => subsection.id !== subsectionId),
        }
      : section
  );
  return { ...doc, sections };
}

function deletePageLegacy(doc: DocumentModel, subsectionId: string, pageId: string): DocumentModel {
  const sections = doc.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) =>
      subsection.id === subsectionId
        ? { ...subsection, pages: subsection.pages.filter((page) => page.id !== pageId) }
        : subsection
    ),
  }));
  return { ...doc, sections };
}

function deleteWidgetLegacy(
  doc: DocumentModel,
  params: { subsectionId: string; pageId: string; widgetId: string }
): DocumentModel {
  const { subsectionId, pageId, widgetId } = params;
  const location = findLocation(doc, subsectionId, pageId);
  
  if (location.sectionIndex === -1 || location.subsectionIndex === -1 || location.pageIndex === -1) {
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
  
  return { ...doc, sections };
}
