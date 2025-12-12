import { PageModel } from './page.model';

export type UUID = string;

export interface DocumentModel {
  id: UUID;
  title: string;
  version: string;
  pageSize: PageSize;
  sections: SectionModel[];
  metadata?: Record<string, unknown>;
  footer?: FooterConfig;
  logo?: LogoConfig;
}

export interface FooterConfig {
  leftText?: string;
  centerText?: string;
  centerSubText?: string;
  showPageNumber?: boolean;
}

export interface LogoConfig {
  url?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
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

export interface HierarchySelection {
  sectionId: string | null;
  subsectionId: string | null;
  pageId: string | null;
}

export interface SubsectionSelection {
  subsectionId: string | null;
  pageId: string | null;
}

