import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';

import {
  DocumentModel,
  PageSize,
  HeaderConfig,
  FooterConfig,
  LogoConfig,
  SubsectionModel,
  SectionModel,
  HierarchySelection,
  SubsectionSelection,
} from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { DocumentActions, DocumentMetaActions } from '../../store/document/document.actions';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { AppState } from '../../store/app.state';
import {
  createInitialDocument,
  createPageModel,
  createSectionModel,
  createSubsectionModel,
} from '../utils/document.factory';
import { UndoRedoService } from './undo-redo.service';
import { ClipboardService } from './clipboard.service';
import { SaveIndicatorService } from './save-indicator.service';
import {
  AddWidgetCommand,
  UpdateWidgetCommand,
  DeleteWidgetCommand,
  UpdatePageSizeCommand,
  AddSectionCommand,
  DeleteSectionCommand,
  AddSubsectionCommand,
  DeleteSubsectionCommand,
  AddPageCommand,
  DeletePageCommand,
  RenameSectionCommand,
  RenameSubsectionCommand,
  RenamePageCommand,
} from './document-commands';
import { WidgetFactoryService } from '../../features/editor/widget-host/widget-factory.service';
import { SectionEntity, SubsectionEntity, PageEntity, WidgetEntity } from '../../store/document/document.state';
import { deepClone } from '../utils/deep-clone.util';

/**
 * DocumentService
 * 
 * Works with normalized state only.
 * Uses selectors for reading and actions for writing.
 */
@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private readonly store = inject(Store<AppState>);
  private readonly undoRedoService = inject(UndoRedoService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly widgetFactory = inject(WidgetFactoryService);
  private readonly saveIndicator = inject(SaveIndicatorService);

  // ============================================
  // STORE SIGNALS
  // ============================================
  
  /** Denormalized document (for export) */
  readonly document$ = this.store.select(DocumentSelectors.selectDenormalizedDocument);
  private readonly documentSignal = toSignal(this.document$, {
    initialValue: createInitialDocument(),
  });
  
  /** Section IDs */
  private readonly sectionIds = toSignal(
    this.store.select(DocumentSelectors.selectSectionIds),
    { initialValue: [] as string[] }
  );
  
  /** Section entities */
  private readonly sectionEntities = toSignal(
    this.store.select(DocumentSelectors.selectSectionEntities),
    { initialValue: {} as Dictionary<SectionEntity> }
  );
  
  /** Subsection entities */
  private readonly subsectionEntities = toSignal(
    this.store.select(DocumentSelectors.selectSubsectionEntities),
    { initialValue: {} as Dictionary<SubsectionEntity> }
  );
  
  /** Page entities */
  private readonly pageEntities = toSignal(
    this.store.select(DocumentSelectors.selectPageEntities),
    { initialValue: {} as Dictionary<PageEntity> }
  );
  
  /** Widget entities */
  private readonly widgetEntities = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Dictionary<WidgetEntity> }
  );
  
  /** Subsection IDs by section ID */
  private readonly subsectionIdsBySectionId = toSignal(
    this.store.select(DocumentSelectors.selectSubsectionIdsBySectionId),
    { initialValue: {} as Record<string, string[]> }
  );
  
  /** Page IDs by subsection ID */
  private readonly pageIdsBySubsectionId = toSignal(
    this.store.select(DocumentSelectors.selectPageIdsBySubsectionId),
    { initialValue: {} as Record<string, string[]> }
  );
  
  /** Widget IDs by page ID */
  private readonly widgetIdsByPageId = toSignal(
    this.store.select(DocumentSelectors.selectWidgetIdsByPageId),
    { initialValue: {} as Record<string, string[]> }
  );
  
  /** Page size */
  private readonly pageSizeSignal = toSignal(
    this.store.select(DocumentSelectors.selectPageSize),
    { initialValue: { widthMm: 254, heightMm: 190.5, dpi: 96 } }
  );

  /** Document lock state (persisted in document.metadata.documentLocked) */
  readonly documentLocked = toSignal(
    this.store.select(DocumentSelectors.selectDocumentLocked),
    { initialValue: false }
  );

  // ============================================
  // PUBLIC GETTERS
  // ============================================

  private canEdit(): boolean {
    return this.documentLocked() !== true;
  }
  
  /** Get denormalized document (for export/compatibility) */
  get document(): DocumentModel {
    return this.documentSignal();
  }
  
  /** Get page size */
  get pageSize(): PageSize {
    return this.pageSizeSignal();
  }
  
  /** Get all sections */
  get sections(): SectionEntity[] {
    const ids = this.sectionIds();
    const entities = this.sectionEntities();
    return ids.map((id: string) => entities[id]).filter((s): s is SectionEntity => !!s);
  }

  // ============================================
  // WIDGET OPERATIONS
  // ============================================

  addWidget(pageId: string, widget: WidgetModel): void {
    if (!this.canEdit()) return;
    const command = new AddWidgetCommand(
      this.store,
      pageId,
      widget
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  updateWidget(
    pageId: string,
    widgetId: string,
    mutation: Partial<WidgetModel>
  ): void {
    if (!this.canEdit()) return;
    const previousWidget = this.widgetEntities()[widgetId];
    if (!previousWidget) {
      return;
    }

    const command = new UpdateWidgetCommand(
      this.store,
      pageId,
      widgetId,
      mutation,
      deepClone(previousWidget)
    );
    this.undoRedoService.executeDocumentCommand(command);
    this.saveIndicator.pulse();
  }

  deleteWidget(pageId: string, widgetId: string, options?: { recordUndo?: boolean }): void {
    if (!this.canEdit()) return;
    const recordUndo = options?.recordUndo !== false;

    const widget = this.widgetEntities()[widgetId];
    if (!widget) {
      return;
    }

    if (!recordUndo) {
      this.store.dispatch(
        DocumentActions.deleteWidget({
          pageId,
          widgetId,
        })
      );
      return;
    }

    const command = new DeleteWidgetCommand(
      this.store,
      pageId,
      widgetId,
      { ...widget }
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  // ============================================
  // DOCUMENT OPERATIONS
  // ============================================

  replaceDocument(document: DocumentModel): void {
    // Document replacement (import/open) is a system action and must NOT create undo history.
    // The caller (e.g., editor-toolbar) should clear undo history before calling this.
    this.store.dispatch(DocumentActions.setDocument({ document }));
  }

  updateDocumentTitle(title: string): void {
    if (!this.canEdit()) return;
    this.store.dispatch(DocumentActions.updateDocumentTitle({ title }));
  }

  updateDocumentMetadata(metadata: Record<string, unknown>): void {
    if (!this.canEdit()) return;
    this.store.dispatch(DocumentMetaActions.updateMetadata({ metadata }));
    this.saveIndicator.pulse();
  }

  updateHeader(header: HeaderConfig): void {
    if (!this.canEdit()) return;
    this.store.dispatch(DocumentMetaActions.updateHeader({ header }));
    this.saveIndicator.pulse();
  }

  updateFooter(footer: FooterConfig): void {
    if (!this.canEdit()) return;
    this.store.dispatch(DocumentMetaActions.updateFooter({ footer }));
    this.saveIndicator.pulse();
  }

  updateLogo(logo: LogoConfig): void {
    if (!this.canEdit()) return;
    this.store.dispatch(DocumentMetaActions.updateLogo({ logo }));
    this.saveIndicator.pulse();
  }

  setDocumentLocked(locked: boolean): void {
    const current = this.documentSignal();
    const existing = current.metadata ?? {};
    const next = { ...existing, documentLocked: locked === true };
    this.store.dispatch(DocumentMetaActions.updateMetadata({ metadata: next }));
  }

  updatePageSize(pageSize: Partial<PageSize>): void {
    if (!this.canEdit()) return;
    const previousPageSize = { ...this.pageSizeSignal() };
    const command = new UpdatePageSizeCommand(
      this.store,
      pageSize,
      previousPageSize
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  // ============================================
  // SECTION OPERATIONS
  // ============================================

  addSection(): HierarchySelection {
    if (!this.canEdit()) {
      return { sectionId: null, subsectionId: null, pageId: null };
    }
    const sectionCount = this.sectionIds().length + 1;
    const sectionTitle = `Section ${sectionCount}`;
    const subsectionTitle = 'Subsection 1';
    const page = createPageModel(1);
    const subsection = createSubsectionModel(subsectionTitle, [page]);
    const section = createSectionModel(sectionTitle, [subsection]);

    const command = new AddSectionCommand(this.store, section);
    this.undoRedoService.executeDocumentCommand(command);

    return {
      sectionId: section.id,
      subsectionId: subsection.id,
      pageId: page.id,
    };
  }

  deleteSection(sectionId: string): HierarchySelection | null {
    if (!this.canEdit()) return null;
    const sectionIds = this.sectionIds();
    const index = sectionIds.indexOf(sectionId);
    if (index === -1) {
      return null;
    }

    // Get section data for undo
    const sectionEntity = this.sectionEntities()[sectionId];
    if (!sectionEntity) return null;
    
    // Build nested section for undo
    const sectionToDelete = this.buildSectionModel(sectionId);
    
    const fallbackId = sectionIds[index + 1] ?? sectionIds[index - 1];
    const fallbackSubIds = fallbackId ? this.subsectionIdsBySectionId()[fallbackId] || [] : [];
    const fallbackSubId = fallbackSubIds[0];
    const fallbackPageIds = fallbackSubId ? this.pageIdsBySubsectionId()[fallbackSubId] || [] : [];
    const fallbackPageId = fallbackPageIds[0];

    const command = new DeleteSectionCommand(
      this.store,
      sectionId,
      sectionToDelete
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      sectionId: fallbackId ?? null,
      subsectionId: fallbackSubId ?? null,
      pageId: fallbackPageId ?? null,
    };
  }

  renameSection(sectionId: string, title: string): void {
    if (!this.canEdit()) return;
    const section = this.sectionEntities()[sectionId];
    if (!section) return;

    const command = new RenameSectionCommand(
      this.store,
      sectionId,
      title.trim(),
      section.title
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  // ============================================
  // SUBSECTION OPERATIONS
  // ============================================

  addSubsection(sectionId: string): SubsectionSelection | null {
    if (!this.canEdit()) return null;
    const subIds = this.subsectionIdsBySectionId()[sectionId] || [];
    const subsectionCount = subIds.length + 1;
    const subsectionTitle = `Subsection ${subsectionCount}`;
    const page = createPageModel(1);
    const subsection = createSubsectionModel(subsectionTitle, [page]);

    const command = new AddSubsectionCommand(
      this.store,
      sectionId,
      subsection
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      subsectionId: subsection.id,
      pageId: page.id,
    };
  }

  deleteSubsection(
    sectionId: string,
    subsectionId: string
  ): SubsectionSelection | null {
    if (!this.canEdit()) return null;
    const subIds = this.subsectionIdsBySectionId()[sectionId] || [];
    const index = subIds.indexOf(subsectionId);
    if (index === -1) {
      return null;
    }

    // Build nested subsection for undo
    const subsectionToDelete = this.buildSubsectionModel(subsectionId);
    
    const fallbackId = subIds[index + 1] ?? subIds[index - 1];
    const fallbackPageIds = fallbackId ? this.pageIdsBySubsectionId()[fallbackId] || [] : [];
    const fallbackPageId = fallbackPageIds[0];

    const command = new DeleteSubsectionCommand(
      this.store,
      sectionId,
      subsectionId,
      subsectionToDelete
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      subsectionId: fallbackId ?? null,
      pageId: fallbackPageId ?? null,
    };
  }

  renameSubsection(subsectionId: string, title: string): void {
    if (!this.canEdit()) return;
    const subsection = this.subsectionEntities()[subsectionId];
    if (!subsection) return;

    const command = new RenameSubsectionCommand(
      this.store,
      subsectionId,
      title.trim(),
      subsection.title
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  // ============================================
  // PAGE OPERATIONS
  // ============================================

  addPage(subsectionId: string): string | null {
    if (!this.canEdit()) return null;
    const pageIds = this.pageIdsBySubsectionId()[subsectionId] || [];
    const nextNumber = pageIds.length + 1;
    const page = createPageModel(nextNumber);

    const command = new AddPageCommand(this.store, subsectionId, page);
    this.undoRedoService.executeDocumentCommand(command);
    return page.id;
  }

  deletePage(subsectionId: string, pageId: string): string | null {
    if (!this.canEdit()) return null;
    const pageIds = this.pageIdsBySubsectionId()[subsectionId] || [];
    const index = pageIds.indexOf(pageId);
    if (index === -1) {
      return null;
    }

    // Build page model for undo
    const pageToDelete = this.buildPageModel(pageId);
    
    const fallbackId = pageIds[index + 1] ?? pageIds[index - 1];

    const command = new DeletePageCommand(
      this.store,
      subsectionId,
      pageId,
      pageToDelete
    );
    this.undoRedoService.executeDocumentCommand(command);

    return fallbackId ?? null;
  }

  renamePage(pageId: string, title: string): void {
    if (!this.canEdit()) return;
    const page = this.pageEntities()[pageId];
    if (!page) return;

    const command = new RenamePageCommand(
      this.store,
      pageId,
      title.trim(),
      page.title ?? ''
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  updatePageOrientation(
    pageId: string,
    orientation: 'portrait' | 'landscape'
  ): void {
    if (!this.canEdit()) return;
    this.store.dispatch(
      DocumentActions.updatePageOrientation({
        pageId,
        orientation,
      })
    );
  }

  // ============================================
  // CLIPBOARD OPERATIONS
  // ============================================

  copyWidget(pageId: string, widgetId: string): void {
    const widget = this.widgetEntities()[widgetId];
    if (widget) {
      // Convert to WidgetModel (remove pageId)
      const { pageId: _, ...widgetModel } = widget;
      this.clipboardService.copyWidgets([widgetModel as WidgetModel]);
    }
  }

  copyWidgets(pageId: string, widgetIds: string[]): void {
    const widgets = widgetIds
      .map(id => this.widgetEntities()[id])
      .filter((w): w is WidgetEntity => !!w)
      .map(w => {
        const { pageId: _, ...widgetModel } = w;
        return widgetModel as WidgetModel;
      });
    
    if (widgets.length > 0) {
      this.clipboardService.copyWidgets(widgets);
    }
  }

  cutWidget(pageId: string, widgetId: string): void {
    if (!this.canEdit()) return;
    this.copyWidget(pageId, widgetId);
    this.deleteWidget(pageId, widgetId);
  }

  cutWidgets(pageId: string, widgetIds: string[]): void {
    if (!this.canEdit()) return;
    this.copyWidgets(pageId, widgetIds);
    widgetIds.forEach((id) => this.deleteWidget(pageId, id));
  }

  pasteWidgets(pageId: string): string[] {
    if (!this.canEdit()) return [];
    const copiedWidgets = this.clipboardService.getCopiedWidgets();
    if (copiedWidgets.length === 0) {
      return [];
    }

    const offset = { x: 20, y: 20 };
    const pastedWidgetIds: string[] = [];
    copiedWidgets.forEach((widget) => {
      const clonedWidget = this.widgetFactory.cloneWidget(widget, offset);
      pastedWidgetIds.push(clonedWidget.id);
      this.addWidget(pageId, clonedWidget);
    });

    return pastedWidgetIds;
  }

  canPaste(): boolean {
    return this.clipboardService.hasCopiedWidgets();
  }

  // ============================================
  // HELPER METHODS - Build nested models for undo
  // ============================================

  private buildSectionModel(sectionId: string): SectionModel {
    const entities = this.sectionEntities();
    const section = entities[sectionId]!;
    const subIds = this.subsectionIdsBySectionId()[sectionId] || [];
    
    return {
      id: section.id,
      title: section.title,
      subsections: subIds.map((subId: string) => this.buildSubsectionModel(subId)),
    };
  }

  private buildSubsectionModel(subsectionId: string): SubsectionModel {
    const entities = this.subsectionEntities();
    const subsection = entities[subsectionId]!;
    const pageIds = this.pageIdsBySubsectionId()[subsectionId] || [];
    
    return {
      id: subsection.id,
      title: subsection.title,
      pages: pageIds.map((pageId: string) => this.buildPageModel(pageId)),
    };
  }

  private buildPageModel(pageId: string) {
    const pageEntities = this.pageEntities();
    const page = pageEntities[pageId]!;
    const widgetIds = this.widgetIdsByPageId()[pageId] || [];
    const widgetEntities = this.widgetEntities();
    
    return {
      id: page.id,
      number: page.number,
      title: page.title,
      background: page.background,
      orientation: page.orientation,
      widgets: widgetIds
        .map((wId: string) => widgetEntities[wId])
        .filter((w): w is WidgetEntity => !!w)
        .map((w: WidgetEntity) => {
          const { pageId: _, ...widgetModel } = w;
          return widgetModel as WidgetModel;
        }),
    };
  }
}
