import { createFeatureSelector, createSelector } from '@ngrx/store';

import { documentFeatureKey, DocumentState } from './document.reducer';
import {
  SectionEntity,
  SubsectionEntity,
  PageEntity,
  WidgetEntity,
} from './document.state';
import {
  sectionSelectors,
  subsectionSelectors,
  pageSelectors,
  widgetSelectors,
} from './entity-adapters';
import { DocumentModel, SectionModel, SubsectionModel } from '../../models/document.model';
import { PageModel } from '../../models/page.model';
import { WidgetModel } from '../../models/widget.model';

// ============================================
// FEATURE SELECTOR
// ============================================

const selectDocumentState = createFeatureSelector<DocumentState>(documentFeatureKey);

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

/** Select free-form document metadata object (always defined) */
const selectDocumentMetadata = createSelector(
  selectDocumentMeta,
  (meta) => meta.metadata ?? {}
);

/** Document lock flag stored in free-form metadata (defaults to false) */
const selectDocumentLocked = createSelector(
  selectDocumentMetadata,
  (metadata) => metadata['documentLocked'] === true
);

/** Layout preset id stored in metadata (defaults to PPT preset) */
const selectPageLayoutPresetId = createSelector(
  selectDocumentMetadata,
  (metadata) => metadata['pageLayoutPresetId'] as string | undefined
);

/** Select document title */
const selectDocumentTitle = createSelector(
  selectDocumentMeta,
  (meta) => meta.title
);

/** Select document page size */
const selectPageSize = createSelector(
  selectDocumentMeta,
  (meta) => meta.pageSize
);

/** Select document header */
const selectDocumentHeader = createSelector(
  selectDocumentMeta,
  (meta) => meta.header
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

/** Select all sections as an array (ordered) */
const selectAllSections = createSelector(
  selectSectionEntities,
  selectSectionIds,
  (entities, ids) => ids.map((id: string) => entities[id]).filter((s): s is SectionEntity => !!s)
);

/**
 * Factory selector: Select a single section by ID
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
    return ids.map((id: string) => entities[id]).filter((s): s is SubsectionEntity => !!s);
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
 */
const selectPageById = (pageId: string) => createSelector(
  selectPageEntities,
  (entities) => entities[pageId] ?? null
);

/**
 * Factory selector: Select page IDs for a subsection
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
    return ids.map((id: string) => entities[id]).filter((p): p is PageEntity => !!p);
  }
);

// ============================================
// WIDGET SELECTORS
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
 */
const selectWidgetById = (widgetId: string) => createSelector(
  selectWidgetEntities,
  (entities) => entities[widgetId] ?? null
);

/**
 * Factory selector: Select widget IDs for a page
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
    return ids.map((id: string) => entities[id]).filter((w): w is WidgetEntity => !!w);
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
 * Flatten page IDs in document order:
 * sectionIds (order) -> subsectionIdsBySectionId (order) -> pageIdsBySubsectionId (order)
 *
 * This is the single source of truth for:
 * - continuous paging across subsections/sections
 * - global sequential page numbering (index + 1)
 */
const selectFlattenedPageIdsInDocumentOrder = createSelector(
  selectSectionIds,
  selectSubsectionIdsBySectionId,
  selectPageIdsBySubsectionId,
  (sectionIds, subsectionIdsBySectionId, pageIdsBySubsectionId): string[] => {
    const flattened: string[] = [];
    for (const sectionId of sectionIds) {
      const subIds = subsectionIdsBySectionId[sectionId] ?? [];
      for (const subId of subIds) {
        const pageIds = pageIdsBySubsectionId[subId] ?? [];
        flattened.push(...pageIds);
      }
    }
    return flattened;
  }
);

/**
 * Global sequential page number by pageId (1-based), derived from document order.
 */
const selectGlobalPageNumberByPageId = createSelector(
  selectFlattenedPageIdsInDocumentOrder,
  (pageIds): Record<string, number> => {
    const map: Record<string, number> = {};
    for (let i = 0; i < pageIds.length; i++) {
      map[pageIds[i]] = i + 1;
    }
    return map;
  }
);

/**
 * Factory selector: global sequential page number for a pageId (1-based).
 */
const selectGlobalPageNumberForPage = (pageId: string) => createSelector(
  selectGlobalPageNumberByPageId,
  (map) => map[pageId] ?? 1
);

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
// DENORMALIZATION SELECTOR (for export only)
// ============================================

/**
 * Convert normalized state back to nested DocumentModel
 * Used for export functionality
 */
const selectDenormalizedDocument = createSelector(
  selectNormalizedState,
  selectGlobalPageNumberByPageId,
  (normalized, globalPageNumbers): DocumentModel => {
    const { meta, sectionIds, subsectionIdsBySectionId, pageIdsBySubsectionId, widgetIdsByPageId } = normalized;
    const sectionEntities = normalized.sections.entities;
    const subsectionEntities = normalized.subsections.entities;
    const pageEntities = normalized.pages.entities;
    const widgetEntities = normalized.widgets.entities;

    const sections: SectionModel[] = sectionIds.map((sectionId: string) => {
      const section = sectionEntities[sectionId]!;
      const subIds = subsectionIdsBySectionId[sectionId] || [];
      
      const subsections: SubsectionModel[] = subIds.map((subId: string) => {
        const subsection = subsectionEntities[subId]!;
        const pageIds = pageIdsBySubsectionId[subId] || [];
        
        const pages: PageModel[] = pageIds.map((pageId: string) => {
          const page = pageEntities[pageId]!;
          const wIds = widgetIdsByPageId[pageId] || [];
          
          const widgets: WidgetModel[] = wIds.map((wId: string) => {
            const widget = widgetEntities[wId]!;
            // Remove pageId from widget when denormalizing
            const { pageId: _, ...widgetWithoutPageId } = widget;
            return widgetWithoutPageId as WidgetModel;
          });
          
          return {
            id: page.id,
            number: globalPageNumbers[pageId] ?? page.number,
            title: page.title,
            background: page.background,
            orientation: page.orientation,
            widgets,
          };
        });
        
        return {
          id: subsection.id,
          title: subsection.title,
          pages,
        };
      });
      
      return {
        id: section.id,
        title: section.title,
        subsections,
      };
    });

    return {
      id: meta.id,
      title: meta.title,
      version: meta.version,
      pageSize: meta.pageSize,
      metadata: meta.metadata,
      header: meta.header,
      footer: meta.footer,
      logo: meta.logo,
      sections,
    };
  }
);

// ============================================
// EXPORT ALL SELECTORS
// ============================================

export const DocumentSelectors = {
  // State
  selectDocumentState,
  selectNormalizedState,
  
  // Document meta
  selectDocumentMeta,
  selectDocumentMetadata,
  selectDocumentLocked,
  selectDocumentTitle,
  selectPageSize,
  selectDocumentHeader,
  selectDocumentFooter,
  selectDocumentLogo,
  selectPageLayoutPresetId,
  
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
  // Flattened order + global page numbering
  selectFlattenedPageIdsInDocumentOrder,
  selectGlobalPageNumberByPageId,
  selectGlobalPageNumberForPage,
  
  // Widgets
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
  
  // Denormalization (for export)
  selectDenormalizedDocument,
};
