import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { DocumentModel, PageSize } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { DocumentActions } from '../../store/document/document.actions';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { AppState } from '../../store/app.state';
import { createInitialDocument } from '../utils/document.factory';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  readonly document$ = this.store.select(DocumentSelectors.selectDocument);
  private readonly documentSignal = toSignal(this.document$, {
    initialValue: createInitialDocument(),
  });

  constructor(private readonly store: Store<AppState>) {}

  get document(): DocumentModel {
    return this.documentSignal();
  }

  addWidget(subsectionId: string, pageId: string, widget: WidgetModel): void {
    this.store.dispatch(
      DocumentActions.addWidget({ subsectionId, pageId, widget })
    );
  }

  updateWidget(
    subsectionId: string,
    pageId: string,
    widgetId: string,
    mutation: Partial<WidgetModel>
  ): void {
    this.store.dispatch(
      DocumentActions.updateWidget({
        subsectionId,
        pageId,
        widgetId,
        changes: mutation,
      })
    );
  }

  replaceDocument(document: DocumentModel): void {
    this.store.dispatch(DocumentActions.setDocument({ document }));
  }

  updatePageSize(pageSize: Partial<PageSize>): void {
    this.store.dispatch(DocumentActions.updatePageSize({ pageSize }));
  }
}

