import { v4 as uuid } from 'uuid';

import {
  DocumentModel,
  PageSize,
  SectionModel,
  SubsectionModel,
} from '../../models/document.model';
import { PageModel } from '../../models/page.model';

export function createInitialDocument(): DocumentModel {
  const section: SectionModel = {
    id: uuid(),
    title: 'Executive Summary',
    subsections: [],
  };

  const subsection: SubsectionModel = {
    id: uuid(),
    title: 'Overview',
    pages: [],
  };

  const page: PageModel = {
    id: uuid(),
    number: 1,
    widgets: [],
  };

  subsection.pages.push(page);
  section.subsections.push(subsection);

  return {
    id: uuid(),
    title: 'Untitled Document',
    version: '1.0.0',
    pageSize: defaultPageSize(),
    sections: [section],
  };
}

export function defaultPageSize(): PageSize {
  return {
    widthMm: 254, // 10 inches
    heightMm: 190.5, // 7.5 inches
    orientation: 'landscape',
    dpi: 96,
  };
}

