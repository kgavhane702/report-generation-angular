import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import {
  DocumentModel,
  PageSize,
  SubsectionModel,
  SectionModel,
  HierarchySelection,
  SubsectionSelection,
} from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { DocumentActions } from '../../store/document/document.actions';
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
import { WidgetFactoryService } from '../../features/editor/widgets/widget-factory.service';

/**
 * DocumentService
 * 
 * OPTIMIZED:
 * - No longer clones entire document for undo
 * - Stores only minimal data needed for each command
 * - Uses entity-level actions for widget updates
 */
@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  readonly document$ = this.store.select(DocumentSelectors.selectDocument);
  private readonly documentSignal = toSignal(this.document$, {
    initialValue: createInitialDocument(),
  });
  private readonly undoRedoService = inject(UndoRedoService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly widgetFactory = inject(WidgetFactoryService);

  constructor(private readonly store: Store<AppState>) {}

  get document(): DocumentModel {
    return this.documentSignal();
  }

  // ============================================
  // WIDGET OPERATIONS
  // ============================================

  addWidget(subsectionId: string, pageId: string, widget: WidgetModel): void {
    // No need to clone document - command stores only the widget
    const command = new AddWidgetCommand(
      this.store,
      subsectionId,
      pageId,
      widget
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  updateWidget(
    subsectionId: string,
    pageId: string,
    widgetId: string,
    mutation: Partial<WidgetModel>
  ): void {
    // Find the widget's current state for undo
    const previousWidget = this.findWidgetById(subsectionId, pageId, widgetId);
    if (!previousWidget) {
      return; // Widget not found
    }

    // Store only this widget's previous state, not entire document
    const command = new UpdateWidgetCommand(
      this.store,
      subsectionId,
      pageId,
      widgetId,
      mutation,
      { ...previousWidget } // Shallow clone of just this widget
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  deleteWidget(
    subsectionId: string,
    pageId: string,
    widgetId: string
  ): void {
    // Find the widget to store for undo
    const widget = this.findWidgetById(subsectionId, pageId, widgetId);
    if (!widget) {
      return;
    }

    const command = new DeleteWidgetCommand(
      this.store,
      subsectionId,
      pageId,
      widgetId,
      { ...widget } // Store only this widget for undo
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  // ============================================
  // DOCUMENT OPERATIONS
  // ============================================

  replaceDocument(document: DocumentModel): void {
    this.store.dispatch(DocumentActions.setDocument({ document }));
  }

  updateDocumentTitle(title: string): void {
    this.store.dispatch(DocumentActions.updateDocumentTitle({ title }));
  }

  updatePageSize(pageSize: Partial<PageSize>): void {
    // Store only previous page size for undo
    const previousPageSize = { ...this.document.pageSize };
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
    const sectionCount = this.document.sections.length + 1;
    const sectionTitle = `Section ${sectionCount}`;
    const subsectionTitle = 'Subsection 1';
    const page = createPageModel(1);
    const subsection = createSubsectionModel(subsectionTitle, [page]);
    const section = createSectionModel(sectionTitle, [subsection]);

    // No need to clone document - undo just removes the section
    const command = new AddSectionCommand(this.store, section);
    this.undoRedoService.executeDocumentCommand(command);

    return {
      sectionId: section.id,
      subsectionId: subsection.id,
      pageId: page.id,
    };
  }

  deleteSection(sectionId: string): HierarchySelection | null {
    const sections = this.document.sections;
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      return null;
    }

    const sectionToDelete = sections[index];
    const fallback = sections[index + 1] ?? sections[index - 1];
    const fallbackSubsection = fallback?.subsections[0] ?? null;
    const fallbackPage = fallbackSubsection?.pages[0] ?? null;

    // Store the section for undo (deep clone since section has nested data)
    const command = new DeleteSectionCommand(
      this.store,
      sectionId,
      JSON.parse(JSON.stringify(sectionToDelete))
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      sectionId: fallback?.id ?? null,
      subsectionId: fallbackSubsection?.id ?? null,
      pageId: fallbackPage?.id ?? null,
    };
  }

  renameSection(sectionId: string, title: string): void {
    const section = this.document.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const command = new RenameSectionCommand(
      this.store,
      sectionId,
      title.trim(),
      section.title // Store previous title only
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  // ============================================
  // SUBSECTION OPERATIONS
  // ============================================

  addSubsection(sectionId: string): SubsectionSelection | null {
    const section = this.document.sections.find((s) => s.id === sectionId);
    if (!section) {
      return null;
    }

    const subsectionCount = section.subsections.length + 1;
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
    const section = this.document.sections.find((s) => s.id === sectionId);
    if (!section) {
      return null;
    }
    const subsections = section.subsections;
    const index = subsections.findIndex((sub) => sub.id === subsectionId);
    if (index === -1) {
      return null;
    }

    const subsectionToDelete = subsections[index];
    const fallback = subsections[index + 1] ?? subsections[index - 1];
    const fallbackPage = fallback?.pages[0] ?? null;

    // Store the subsection for undo
    const command = new DeleteSubsectionCommand(
      this.store,
      sectionId,
      subsectionId,
      JSON.parse(JSON.stringify(subsectionToDelete))
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      subsectionId: fallback?.id ?? null,
      pageId: fallbackPage?.id ?? null,
    };
  }

  renameSubsection(subsectionId: string, title: string): void {
    const subsection = this.findSubsectionById(subsectionId);
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
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return null;
    }
    const nextNumber = subsection.pages.length + 1;
    const page = createPageModel(nextNumber);

    const command = new AddPageCommand(this.store, subsectionId, page);
    this.undoRedoService.executeDocumentCommand(command);
    return page.id;
  }

  deletePage(subsectionId: string, pageId: string): string | null {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return null;
    }

    const pages = subsection.pages;
    const index = pages.findIndex((page) => page.id === pageId);
    if (index === -1) {
      return null;
    }

    const pageToDelete = pages[index];
    const fallback = pages[index + 1] ?? pages[index - 1];

    // Store the page for undo
    const command = new DeletePageCommand(
      this.store,
      subsectionId,
      pageId,
      JSON.parse(JSON.stringify(pageToDelete))
    );
    this.undoRedoService.executeDocumentCommand(command);

    return fallback?.id ?? null;
  }

  renamePage(subsectionId: string, pageId: string, title: string): void {
    const subsection = this.findSubsectionById(subsectionId);
    const page = subsection?.pages.find((p) => p.id === pageId);
    if (!page) return;

    const command = new RenamePageCommand(
      this.store,
      subsectionId,
      pageId,
      title.trim(),
      page.title ?? ''
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  updatePageOrientation(
    subsectionId: string,
    pageId: string,
    orientation: 'portrait' | 'landscape'
  ): void {
    this.store.dispatch(
      DocumentActions.updatePageOrientation({
        subsectionId,
        pageId,
        orientation,
      })
    );
  }

  // ============================================
  // CLIPBOARD OPERATIONS
  // ============================================

  copyWidget(subsectionId: string, pageId: string, widgetId: string): void {
    const widget = this.findWidgetById(subsectionId, pageId, widgetId);
    if (widget) {
      this.clipboardService.copyWidgets([widget]);
    }
  }

  copyWidgets(subsectionId: string, pageId: string, widgetIds: string[]): void {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) return;

    const page = subsection.pages.find((p) => p.id === pageId);
    if (!page) return;

    const widgets = page.widgets.filter((w) => widgetIds.includes(w.id));
    if (widgets.length > 0) {
      this.clipboardService.copyWidgets(widgets);
    }
  }

  pasteWidgets(subsectionId: string, pageId: string): string[] {
    const copiedWidgets = this.clipboardService.getCopiedWidgets();
    if (copiedWidgets.length === 0) {
      return [];
    }

    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return [];
    }

    const page = subsection.pages.find((p) => p.id === pageId);
    if (!page) {
      return [];
    }

    const offset = { x: 20, y: 20 };
    const pastedWidgetIds: string[] = [];
    copiedWidgets.forEach((widget) => {
      const clonedWidget = this.widgetFactory.cloneWidget(widget, offset);
      pastedWidgetIds.push(clonedWidget.id);
      this.addWidget(subsectionId, pageId, clonedWidget);
    });

    return pastedWidgetIds;
  }

  canPaste(): boolean {
    return this.clipboardService.hasCopiedWidgets();
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private findSubsectionById(subsectionId: string): SubsectionModel | undefined {
    for (const section of this.document.sections) {
      const found = section.subsections.find((sub) => sub.id === subsectionId);
      if (found) return found;
    }
    return undefined;
  }

  private findWidgetById(
    subsectionId: string,
    pageId: string,
    widgetId: string
  ): WidgetModel | undefined {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) return undefined;

    const page = subsection.pages.find((p) => p.id === pageId);
    if (!page) return undefined;

    return page.widgets.find((w) => w.id === widgetId);
  }
}
