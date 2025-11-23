import { PageModel } from './page.model';

export type UUID = string;

export interface DocumentModel {
  id: UUID;
  title: string;
  version: string;
  pageSize: PageSize;
  sections: SectionModel[];
  metadata?: Record<string, unknown>;
}

export interface PageSize {
  widthMm: number;
  heightMm: number;
  dpi?: number;
}

export interface SectionModel {
  id: UUID;
  title: string;
  subsections: SubsectionModel[];
}

export interface SubsectionModel {
  id: UUID;
  title: string;
  pages: PageModel[];
}

