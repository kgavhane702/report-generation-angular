import { createActionGroup, props } from '@ngrx/store';

import { DocumentModel, PageSize } from '../../models/document.model';
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
  },
});

