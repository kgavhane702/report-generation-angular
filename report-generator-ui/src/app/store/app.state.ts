import { DocumentState } from './document/document.reducer';
import { NormalizedDocumentState } from './document/document.state';

export interface AppState {
  document: DocumentState;
}

// Re-export normalized state types for convenience
export { NormalizedDocumentState };
