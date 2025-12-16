import { createFeatureSelector, createSelector } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';

import { documentFeatureKey, DocumentState } from './document.reducer';
import {
  SectionEntity,
  SubsectionEntity,
  PageEntity,
  WidgetEntity,
  DocumentMetaState,
} from './document.state';
import {
  sectionSelectors,
  subsectionSelectors,
  pageSelectors,
  widgetSelectors,
} from './entity-adapters';

// ============================================
// FEATURE SELECTOR
// ============================================

const selectDocumentState = createFeatureSelector<DocumentState>(documentFeatureKey);

// ============================================
// LEGACY SELECTORS (for backward compatibility)
// ============================================

/**
 * @deprecated Use normalized selectors for better performance
 */
const selectDocument = createSelector(
  selectDocumentState,
  (state) => state.document
);

const selectSections = createSelector(
  selectDocument,
  (document) => document.sections
);

const selectPageSize = createSelector(
  selectDocument,
  (document) => document.pageSize
);

// ============================================
// NORMALIZED STATE SELECTORS
// ============================================

/** Select the entire normalized state */
const selectNormalizedState = createSelector(
  selectDocumentState,
  (state) => state.normalized
);

// ============================================
// DOCUMENT META SELECTORS
// ============================================

/** Select document metadata */
const selectDocumentMeta = createSelector(
  selectNormalizedState,
  (normalized) => normalized.meta
);

/** Select document title */
const selectDocumentTitle = createSelector(
  selectDocumentMeta,
  (meta) => meta.title
);

/** Select document page size from normalized state */
const selectNormalizedPageSize = createSelector(
  selectDocumentMeta,
  (meta) => meta.pageSize
);

/** Select document footer */
const selectDocumentFooter = createSelector(
  selectDocumentMeta,
  (meta) => meta.footer
);

/** Select document logo */
const selectDocumentLogo = createSelector(
  selectDocumentMeta,
  (meta) => meta.logo
);

// ============================================
// SECTION SELECTORS
// ============================================

/** Select section EntityState */
const selectSectionState = createSelector(
  selectNormalizedState,
  (normalized) => normalized.sections
);

/** Select all section entities as a dictionary */
const selectSectionEntities = createSelector(
  selectSectionState,
  sectionSelectors.selectEntities
);

/** Select all section IDs in order */
const selectSectionIds = createSelector(
  selectNormalizedState,
  (normalized) => normalized.sectionIds
);

/** Select all sections as an array */
const selectAllSections = createSelector(
  selectSectionState,
  sectionSelectors.selectAll
);

/**
 * Factory selector: Select a single section by ID
 * Only emits when THIS section changes
 */
const selectSectionById = (sectionId: string) => createSelector(
  selectSectionEntities,
  (entities) => entities[sectionId] ?? null
);

// ============================================
// SUBSECTION SELECTORS
// ============================================

/** Select subsection EntityState */
const selectSubsectionState = createSelector(
  selectNormalizedState,
  (normalized) => normalized.subsections
);

/** Select all subsection entities as a dictionary */
const selectSubsectionEntities = createSelector(
  selectSubsectionState,
  subsectionSelectors.selectEntities
);

/** Select all subsections as an array */
const selectAllSubsections = createSelector(
  selectSubsectionState,
  subsectionSelectors.selectAll
);

/** Select subsection IDs by section ID map */
const selectSubsectionIdsBySectionId = createSelector(
  selectNormalizedState,
  (normalized) => normalized.subsectionIdsBySectionId
);

/**
 * Factory selector: Select a single subsection by ID
 * Only emits when THIS subsection changes
 */
const selectSubsectionById = (subsectionId: string) => createSelector(
  selectSubsectionEntities,
  (entities) => entities[subsectionId] ?? null
);

/**
 * Factory selector: Select subsection IDs for a section
 */
const selectSubsectionIdsForSection = (sectionId: string) => createSelector(
  selectSubsectionIdsBySectionId,
  (map) => map[sectionId] ?? []
);

/**
 * Factory selector: Select subsections for a section
 */
const selectSubsectionsForSection = (sectionId: string) => createSelector(
  selectSubsectionEntities,
  selectSubsectionIdsBySectionId,
  (entities, idMap) => {
    const ids = idMap[sectionId] ?? [];
    return ids.map(id => entities[id]).filter((s): s is SubsectionEntity => !!s);
  }
);

// ============================================
// PAGE SELECTORS
// ============================================

/** Select page EntityState */
const selectPageState = createSelector(
  selectNormalizedState,
  (normalized) => normalized.pages
);

/** Select all page entities as a dictionary */
const selectPageEntities = createSelector(
  selectPageState,
  pageSelectors.selectEntities
);

/** Select all pages as an array */
const selectAllPages = createSelector(
  selectPageState,
  pageSelectors.selectAll
);

/** Select page IDs by subsection ID map */
const selectPageIdsBySubsectionId = createSelector(
  selectNormalizedState,
  (normalized) => normalized.pageIdsBySubsectionId
);

/**
 * Factory selector: Select a single page by ID
 * Only emits when THIS page changes
 */
const selectPageById = (pageId: string) => createSelector(
  selectPageEntities,
  (entities) => entities[pageId] ?? null
);

/**
 * Factory selector: Select page IDs for a subsection
 * This is a stable array reference that only changes when pages are added/removed
 */
const selectPageIdsForSubsection = (subsectionId: string) => createSelector(
  selectPageIdsBySubsectionId,
  (map) => map[subsectionId] ?? []
);

/**
 * Factory selector: Select pages for a subsection
 */
const selectPagesForSubsection = (subsectionId: string) => createSelector(
  selectPageEntities,
  selectPageIdsBySubsectionId,
  (entities, idMap) => {
    const ids = idMap[subsectionId] ?? [];
    return ids.map(id => entities[id]).filter((p): p is PageEntity => !!p);
  }
);

// ============================================
// WIDGET SELECTORS (Most Important for Performance!)
// ============================================

/** Select widget EntityState */
const selectWidgetState = createSelector(
  selectNormalizedState,
  (normalized) => normalized.widgets
);

/** Select all widget entities as a dictionary */
const selectWidgetEntities = createSelector(
  selectWidgetState,
  widgetSelectors.selectEntities
);

/** Select all widgets as an array */
const selectAllWidgets = createSelector(
  selectWidgetState,
  widgetSelectors.selectAll
);

/** Select widget IDs by page ID map */
const selectWidgetIdsByPageId = createSelector(
  selectNormalizedState,
  (normalized) => normalized.widgetIdsByPageId
);

/**
 * Factory selector: Select a single widget by ID
 * 
 * THIS IS THE KEY SELECTOR FOR PERFORMANCE!
 * Only emits when THIS specific widget's data changes.
 * Other widgets changing will NOT trigger this selector.
 */
const selectWidgetById = (widgetId: string) => createSelector(
  selectWidgetEntities,
  (entities) => entities[widgetId] ?? null
);

/**
 * Factory selector: Select widget IDs for a page
 * 
 * This returns a stable array reference that only changes when
 * widgets are added/removed from the page (not when widget content changes).
 * This prevents unnecessary ngFor re-renders.
 */
const selectWidgetIdsForPage = (pageId: string) => createSelector(
  selectWidgetIdsByPageId,
  (map) => map[pageId] ?? []
);

/**
 * Factory selector: Select widgets for a page
 */
const selectWidgetsForPage = (pageId: string) => createSelector(
  selectWidgetEntities,
  selectWidgetIdsByPageId,
  (entities, idMap) => {
    const ids = idMap[pageId] ?? [];
    return ids.map(id => entities[id]).filter((w): w is WidgetEntity => !!w);
  }
);

/**
 * Factory selector: Select widget count for a page
 */
const selectWidgetCountForPage = (pageId: string) => createSelector(
  selectWidgetIdsByPageId,
  (map) => (map[pageId] ?? []).length
);

// ============================================
// COMPUTED SELECTORS
// ============================================

/**
 * Select total widget count across all pages
 */
const selectTotalWidgetCount = createSelector(
  selectWidgetState,
  widgetSelectors.selectTotal
);

/**
 * Select total page count
 */
const selectTotalPageCount = createSelector(
  selectPageState,
  pageSelectors.selectTotal
);

// ============================================
// EXPORT ALL SELECTORS
// ============================================

export const DocumentSelectors = {
  // Legacy selectors (for backward compatibility)
  selectDocumentState,
  selectDocument,
  selectSections,
  selectPageSize,
  
  // Normalized state
  selectNormalizedState,
  
  // Document meta
  selectDocumentMeta,
  selectDocumentTitle,
  selectNormalizedPageSize,
  selectDocumentFooter,
  selectDocumentLogo,
  
  // Sections
  selectSectionState,
  selectSectionEntities,
  selectSectionIds,
  selectAllSections,
  selectSectionById,
  
  // Subsections
  selectSubsectionState,
  selectSubsectionEntities,
  selectAllSubsections,
  selectSubsectionIdsBySectionId,
  selectSubsectionById,
  selectSubsectionIdsForSection,
  selectSubsectionsForSection,
  
  // Pages
  selectPageState,
  selectPageEntities,
  selectAllPages,
  selectPageIdsBySubsectionId,
  selectPageById,
  selectPageIdsForSubsection,
  selectPagesForSubsection,
  
  // Widgets (most important for performance!)
  selectWidgetState,
  selectWidgetEntities,
  selectAllWidgets,
  selectWidgetIdsByPageId,
  selectWidgetById,
  selectWidgetIdsForPage,
  selectWidgetsForPage,
  selectWidgetCountForPage,
  
  // Computed
  selectTotalWidgetCount,
  selectTotalPageCount,
};
