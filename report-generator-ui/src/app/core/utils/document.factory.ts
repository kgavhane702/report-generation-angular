import { v4 as uuid } from 'uuid';

import {
  DocumentModel,
  PageSize,
  SectionModel,
  SubsectionModel,
} from '../../models/document.model';
import { PageModel } from '../../models/page.model';
import {
  DEFAULT_SLIDE_LAYOUT_TYPE,
  DEFAULT_SLIDE_THEME_ID,
  getSlideThemeById,
  resolveVariantForLayout,
} from '../slide-design/slide-design.config';
import { SlideLayoutType } from '../slide-design/slide-design.model';
import { createInitialTitleSlidePlaceholders } from '../slide-design/slide-template.factory';

export function createInitialDocument(): DocumentModel {
  const page = createPageModel(1, 'landscape', { slideLayoutType: 'title_slide' });
  page.widgets = createInitialTitleSlidePlaceholders();
  const subsection = createSubsectionModel('Overview', [page]);
  const section = createSectionModel('Executive Summary', [subsection]);

  return {
    id: uuid(),
    title: 'Untitled Document',
    version: '1.0.0',
    pageSize: defaultPageSize(),
    sections: [section],
    metadata: {
      slideThemeId: DEFAULT_SLIDE_THEME_ID,
      defaultSlideLayoutType: DEFAULT_SLIDE_LAYOUT_TYPE,
    },
    footer: {
      showPageNumber: true,
    },
  };
}

export function defaultPageSize(): PageSize {
  return {
    widthMm: 254, // 10 inches
    heightMm: 190.5, // 7.5 inches
    dpi: 96,
  };
}

export function createSectionModel(
  title: string,
  subsections: SubsectionModel[] = []
): SectionModel {
  return {
    id: uuid(),
    title,
    subsections,
  };
}

export function createSubsectionModel(
  title: string,
  pages: PageModel[] = []
): SubsectionModel {
  return {
    id: uuid(),
    title,
    pages,
  };
}

export function createPageModel(
  pageNumber: number,
  orientation: 'portrait' | 'landscape' = 'landscape',
  options?: { slideLayoutType?: SlideLayoutType; slideVariantId?: string }
): PageModel {
  const slideLayoutType = options?.slideLayoutType ?? DEFAULT_SLIDE_LAYOUT_TYPE;
  const slideVariantId = options?.slideVariantId
    ?? resolveVariantForLayout(getSlideThemeById(DEFAULT_SLIDE_THEME_ID), slideLayoutType).id;

  return {
    id: uuid(),
    number: pageNumber,
    // Title is optional; UI should display `Page ${globalPageNumber}` when title is not set.
    title: undefined,
    widgets: [],
    orientation,
    slideLayoutType,
    slideVariantId,
  };
}

