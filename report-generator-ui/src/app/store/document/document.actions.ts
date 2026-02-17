import { createActionGroup, props, emptyProps } from '@ngrx/store';

import {
  DocumentModel,
  PageSize,
  SectionModel,
  SubsectionModel,
  HeaderConfig,
  FooterConfig,
  LogoConfig,
} from '../../models/document.model';
import { PageModel } from '../../models/page.model';
import { WidgetModel } from '../../models/widget.model';
import {
  SectionEntity,
  SubsectionEntity,
  PageEntity,
  WidgetEntity,
  DocumentMetaState,
} from './document.state';

/**
 * Document Actions - Normalized State Only
 * All actions work with the normalized entity structure.
 */
export const DocumentActions = createActionGroup({
  source: 'Document',
  events: {
    'Set Document': props<{ document: DocumentModel }>(),
    'Update Document Title': props<{ title: string }>(),
    'Update Page Size': props<{ pageSize: Partial<PageSize> }>(),
    'Add Widget': props<{
      pageId: string;
      widget: WidgetModel;
    }>(),
    'Update Widget': props<{
      widgetId: string;
      changes: Partial<WidgetModel>;
    }>(),
    'Add Section': props<{ section: SectionModel }>(),
    'Add Subsection': props<{
      sectionId: string;
      subsection: SubsectionModel;
    }>(),
    'Add Page': props<{
      subsectionId: string;
      page: PageModel;
    }>(),
    'Rename Section': props<{ sectionId: string; title: string }>(),
    'Rename Subsection': props<{ subsectionId: string; title: string }>(),
    'Rename Page': props<{ pageId: string; title: string }>(),
    'Update Page Design': props<{ pageId: string; changes: Partial<Pick<PageModel, 'slideLayoutType' | 'slideVariantId'>> }>(),
    'Update Page Orientation': props<{ pageId: string; orientation: 'portrait' | 'landscape' }>(),
    'Delete Section': props<{ sectionId: string }>(),
    'Delete Subsection': props<{ sectionId: string; subsectionId: string }>(),
    'Delete Page': props<{ subsectionId: string; pageId: string }>(),
    'Delete Widget': props<{
      pageId: string;
      widgetId: string;
    }>(),
  },
});

/**
 * Widget Entity Actions
 * These actions work with the normalized state structure.
 * Only the specific widget entity changes reference when dispatched.
 */
export const WidgetActions = createActionGroup({
  source: 'Widget',
  events: {
    /** Add a new widget to a page */
    'Add One': props<{ widget: WidgetEntity }>(),
    
    /** Update a single widget by ID - only this widget's reference changes */
    'Update One': props<{ id: string; changes: Partial<WidgetEntity> }>(),
    
    /** Remove a widget by ID */
    'Remove One': props<{ id: string }>(),
    
    /** Add or update multiple widgets (for batch operations) */
    'Upsert Many': props<{ widgets: WidgetEntity[] }>(),
    
    /** Set all widgets (for document load) */
    'Set All': props<{ widgets: WidgetEntity[]; widgetIdsByPageId: Record<string, string[]> }>(),
  },
});

/**
 * Page Entity Actions
 */
export const PageActions = createActionGroup({
  source: 'Page',
  events: {
    /** Add a new page */
    'Add One': props<{ page: PageEntity }>(),
    
    /** Update a single page */
    'Update One': props<{ id: string; changes: Partial<PageEntity> }>(),
    
    /** Remove a page and its widgets */
    'Remove One': props<{ id: string }>(),
    
    /** Set all pages (for document load) */
    'Set All': props<{ pages: PageEntity[]; pageIdsBySubsectionId: Record<string, string[]> }>(),
  },
});

/**
 * Subsection Entity Actions
 */
export const SubsectionActions = createActionGroup({
  source: 'Subsection',
  events: {
    /** Add a new subsection */
    'Add One': props<{ subsection: SubsectionEntity }>(),
    
    /** Update a single subsection */
    'Update One': props<{ id: string; changes: Partial<SubsectionEntity> }>(),
    
    /** Remove a subsection and its pages */
    'Remove One': props<{ id: string }>(),
    
    /** Set all subsections (for document load) */
    'Set All': props<{ subsections: SubsectionEntity[]; subsectionIdsBySectionId: Record<string, string[]> }>(),
  },
});

/**
 * Section Entity Actions
 */
export const SectionActions = createActionGroup({
  source: 'Section',
  events: {
    /** Add a new section */
    'Add One': props<{ section: SectionEntity }>(),
    
    /** Update a single section */
    'Update One': props<{ id: string; changes: Partial<SectionEntity> }>(),
    
    /** Remove a section and its subsections */
    'Remove One': props<{ id: string }>(),
    
    /** Set all sections (for document load) */
    'Set All': props<{ sections: SectionEntity[]; sectionIds: string[] }>(),
  },
});

/**
 * Document Meta Actions
 */
export const DocumentMetaActions = createActionGroup({
  source: 'DocumentMeta',
  events: {
    /** Set document metadata */
    'Set Meta': props<{ meta: DocumentMetaState }>(),
    
    /** Update document title */
    'Update Title': props<{ title: string }>(),
    
    /** Update page size */
    'Update Page Size': props<{ pageSize: Partial<PageSize> }>(),
    
    /** Update header configuration */
    'Update Header': props<{ header: HeaderConfig }>(),
    
    /** Update footer configuration */
    'Update Footer': props<{ footer: FooterConfig }>(),
    
    /** Update logo configuration */
    'Update Logo': props<{ logo: LogoConfig }>(),

    /** Update document metadata (free-form JSON persisted with the document) */
    'Update Metadata': props<{ metadata: Record<string, unknown> }>(),
  },
});

/**
 * Bulk Document Actions
 * For loading/replacing entire document structure
 */
export const BulkDocumentActions = createActionGroup({
  source: 'BulkDocument',
  events: {
    /** Load a full document into normalized state */
    'Load Document': props<{ document: DocumentModel }>(),
    
    /** Clear all document state */
    'Clear All': emptyProps(),
  },
});
