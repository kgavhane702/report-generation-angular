import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';

import {
  SectionEntity,
  SubsectionEntity,
  PageEntity,
  WidgetEntity,
} from './document.state';

/**
 * Entity Adapters for Normalized Document State
 * 
 * These adapters provide optimized CRUD operations for each entity type.
 * They handle:
 * - Automatic ID-based entity management
 * - Immutable state updates
 * - Memoized selectors
 */

/**
 * Section entity adapter
 */
export const sectionAdapter: EntityAdapter<SectionEntity> = createEntityAdapter<SectionEntity>({
  selectId: (section) => section.id,
  sortComparer: false, // Maintain insertion order
});

/**
 * Subsection entity adapter
 */
export const subsectionAdapter: EntityAdapter<SubsectionEntity> = createEntityAdapter<SubsectionEntity>({
  selectId: (subsection) => subsection.id,
  sortComparer: false,
});

/**
 * Page entity adapter
 * Sorted by page number within each subsection
 */
export const pageAdapter: EntityAdapter<PageEntity> = createEntityAdapter<PageEntity>({
  selectId: (page) => page.id,
  sortComparer: (a, b) => a.number - b.number,
});

/**
 * Widget entity adapter
 * Sorted by zIndex for proper layering
 */
export const widgetAdapter: EntityAdapter<WidgetEntity> = createEntityAdapter<WidgetEntity>({
  selectId: (widget) => widget.id,
  sortComparer: (a, b) => a.zIndex - b.zIndex,
});

/**
 * Helper type for adapter selectors
 */
export const sectionSelectors = sectionAdapter.getSelectors();
export const subsectionSelectors = subsectionAdapter.getSelectors();
export const pageSelectors = pageAdapter.getSelectors();
export const widgetSelectors = widgetAdapter.getSelectors();
