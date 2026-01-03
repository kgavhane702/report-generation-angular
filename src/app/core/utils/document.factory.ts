import { v4 as uuid } from 'uuid';

import {
  DocumentModel,
  PageSize,
  SectionModel,
  SubsectionModel,
} from '../../models/document.model';
import { PageModel } from '../../models/page.model';

export function createInitialDocument(): DocumentModel {
  const page = createPageModel(1);
  const subsection = createSubsectionModel('Overview', [page]);
  const section = createSectionModel('Executive Summary', [subsection]);

  return {
    id: uuid(),
    title: 'Untitled Document',
    version: '1.0.0',
    pageSize: defaultPageSize(),
    sections: [section],
    footer: {
      leftText: 'dummy text',
      centerText: 'Fixed text',
      centerSubText: 'Subtext',
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

export function createPageModel(pageNumber: number, orientation: 'portrait' | 'landscape' = 'landscape'): PageModel {
  return {
    id: uuid(),
    number: pageNumber,
    title: `Page ${pageNumber}`,
    widgets: [],
    orientation,
  };
}

