import { createActionGroup, props } from '@ngrx/store';

import {
  DocumentModel,
  PageSize,
  SectionModel,
  SubsectionModel,
} from '../../models/document.model';
import { PageModel } from '../../models/page.model';
import { WidgetModel } from '../../models/widget.model';

export const DocumentActions = createActionGroup({
  source: 'Document',
  events: {
    'Set Document': props<{ document: DocumentModel }>(),
    'Update Page Size': props<{ pageSize: Partial<PageSize> }>(),
    'Add Widget': props<{
      subsectionId: string;
      pageId: string;
      widget: WidgetModel;
    }>(),
    'Update Widget': props<{
      subsectionId: string;
      pageId: string;
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
    'Rename Page': props<{ subsectionId: string; pageId: string; title: string }>(),
    'Delete Section': props<{ sectionId: string }>(),
    'Delete Subsection': props<{ sectionId: string; subsectionId: string }>(),
    'Delete Page': props<{ subsectionId: string; pageId: string }>(),
  },
});

