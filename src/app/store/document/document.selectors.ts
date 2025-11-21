import { createFeatureSelector, createSelector } from '@ngrx/store';

import { documentFeatureKey, DocumentState } from './document.reducer';

const selectDocumentState =
  createFeatureSelector<DocumentState>(documentFeatureKey);

const selectDocument = createSelector(
  selectDocumentState,
  (state) => state.document
);

const selectSections = createSelector(
  selectDocument,
  (document) => document.sections
);

const selectPageSize = createSelector(
  selectDocument,
  (document) => document.pageSize
);

export const DocumentSelectors = {
  selectDocumentState,
  selectDocument,
  selectSections,
  selectPageSize,
};

