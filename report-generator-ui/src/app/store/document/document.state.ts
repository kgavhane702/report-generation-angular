import { EntityState } from '@ngrx/entity';

import { UUID, PageSize, HeaderConfig, FooterConfig, LogoConfig } from '../../models/document.model';
import { BackgroundSpec } from '../../models/page.model';
import {
  WidgetType,
  WidgetPosition,
  WidgetSize,
  WidgetProps,
  CssStyleObject,
} from '../../models/widget.model';

/**
 * Normalized Document State
 * 
 * This structure flattens the nested document model into separate entity collections.
 * Each entity type has its own EntityState for O(1) lookups and targeted updates.
 * Relationship maps maintain parent-child relationships without nesting.
 */
export interface NormalizedDocumentState {
  /** Document metadata (title, page size, footer, logo) */
  meta: DocumentMetaState;

  /** Section entities */
  sections: EntityState<SectionEntity>;

  /** Subsection entities */
  subsections: EntityState<SubsectionEntity>;

  /** Page entities */
  pages: EntityState<PageEntity>;

  /** Widget entities */
  widgets: EntityState<WidgetEntity>;

  /**
   * Relationship maps for efficient lookups.
   * These are derived data maintained by reducers to avoid
   * expensive traversals when rendering.
   */
  sectionIds: string[];
  subsectionIdsBySectionId: Record<string, string[]>;
  pageIdsBySubsectionId: Record<string, string[]>;
  widgetIdsByPageId: Record<string, string[]>;
}

/**
 * Document metadata - top-level document properties
 */
export interface DocumentMetaState {
  id: UUID;
  title: string;
  version: string;
  pageSize: PageSize;
  metadata?: Record<string, unknown>;
  header?: HeaderConfig;
  footer?: FooterConfig;
  logo?: LogoConfig;
}

/**
 * Section entity - flattened from SectionModel
 */
export interface SectionEntity {
  id: UUID;
  title: string;
  // Note: subsections are tracked via subsectionIdsBySectionId map
}

/**
 * Subsection entity - flattened from SubsectionModel
 */
export interface SubsectionEntity {
  id: UUID;
  sectionId: UUID; // Foreign key to parent section
  title: string;
  // Note: pages are tracked via pageIdsBySubsectionId map
}

/**
 * Page entity - flattened from PageModel
 */
export interface PageEntity {
  id: UUID;
  subsectionId: UUID; // Foreign key to parent subsection
  number: number;
  title?: string;
  background?: BackgroundSpec;
  orientation?: 'portrait' | 'landscape';
  // Note: widgets are tracked via widgetIdsByPageId map
}

/**
 * Widget entity - flattened from WidgetModel
 * Extended with pageId for relationship tracking
 */
export interface WidgetEntity {
  id: UUID;
  pageId: UUID; // Foreign key to parent page
  type: WidgetType;
  position: WidgetPosition;
  size: WidgetSize;
  rotation?: number;
  zIndex: number;
  locked?: boolean;
  props: WidgetProps;
  style?: CssStyleObject;
}

/**
 * Initial state factory for normalized document state
 */
export function createInitialNormalizedState(): NormalizedDocumentState {
  return {
    meta: {
      id: '',
      title: '',
      version: '1.0',
      pageSize: { widthMm: 297, heightMm: 210, dpi: 96 },
    },
    sections: { ids: [], entities: {} },
    subsections: { ids: [], entities: {} },
    pages: { ids: [], entities: {} },
    widgets: { ids: [], entities: {} },
    sectionIds: [],
    subsectionIdsBySectionId: {},
    pageIdsBySubsectionId: {},
    widgetIdsByPageId: {},
  };
}
