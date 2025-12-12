import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import {
  DocumentModel,
  PageSize,
  SubsectionModel,
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

  addWidget(subsectionId: string, pageId: string, widget: WidgetModel): void {
    const previousDocument = this.deepCloneDocument(this.document);
    const command = new AddWidgetCommand(
      this.store,
      subsectionId,
      pageId,
      widget,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  updateWidget(
    subsectionId: string,
    pageId: string,
    widgetId: string,
    mutation: Partial<WidgetModel>
  ): void {
    const previousDocument = this.deepCloneDocument(this.document);
    const command = new UpdateWidgetCommand(
      this.store,
      subsectionId,
      pageId,
      widgetId,
      mutation,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  replaceDocument(document: DocumentModel): void {
    this.store.dispatch(DocumentActions.setDocument({ document }));
  }

  updateDocumentTitle(title: string): void {
    this.store.dispatch(DocumentActions.updateDocumentTitle({ title }));
  }

  updatePageSize(pageSize: Partial<PageSize>): void {
    const previousDocument = this.deepCloneDocument(this.document);
    const command = new UpdatePageSizeCommand(
      this.store,
      pageSize,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  addSection(): HierarchySelection {
    const sectionCount = this.document.sections.length + 1;
    const sectionTitle = `Section ${sectionCount}`;
    const subsectionTitle = 'Subsection 1';
    const page = createPageModel(1);
    const subsection = createSubsectionModel(subsectionTitle, [page]);
    const section = createSectionModel(sectionTitle, [subsection]);

    const previousDocument = this.deepCloneDocument(this.document);
    const command = new AddSectionCommand(this.store, section, previousDocument);
    this.undoRedoService.executeDocumentCommand(command);

    return {
      sectionId: section.id,
      subsectionId: subsection.id,
      pageId: page.id,
    };
  }

  addSubsection(sectionId: string): SubsectionSelection | null {
    const section = this.document.sections.find((s) => s.id === sectionId);
    if (!section) {
      return null;
    }

    const subsectionCount = section.subsections.length + 1;
    const subsectionTitle = `Subsection ${subsectionCount}`;
    const page = createPageModel(1);
    const subsection = createSubsectionModel(subsectionTitle, [page]);

    const previousDocument = this.deepCloneDocument(this.document);
    const command = new AddSubsectionCommand(
      this.store,
      sectionId,
      subsection,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      subsectionId: subsection.id,
      pageId: page.id,
    };
  }

  addPage(subsectionId: string): string | null {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return null;
    }
    const nextNumber = subsection.pages.length + 1;
    const page = createPageModel(nextNumber);

    const previousDocument = this.deepCloneDocument(this.document);
    const command = new AddPageCommand(this.store, subsectionId, page, previousDocument);
    this.undoRedoService.executeDocumentCommand(command);
    return page.id;
  }

  private findSubsectionById(
    subsectionId: string
  ): SubsectionModel | undefined {
    for (const section of this.document.sections) {
      const found = section.subsections.find((sub) => sub.id === subsectionId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  renameSection(sectionId: string, title: string): void {
    const previousDocument = this.deepCloneDocument(this.document);
    const command = new RenameSectionCommand(
      this.store,
      sectionId,
      title.trim(),
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  renameSubsection(subsectionId: string, title: string): void {
    const previousDocument = this.deepCloneDocument(this.document);
    const command = new RenameSubsectionCommand(
      this.store,
      subsectionId,
      title.trim(),
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  renamePage(subsectionId: string, pageId: string, title: string): void {
    const previousDocument = this.deepCloneDocument(this.document);
    const command = new RenamePageCommand(
      this.store,
      subsectionId,
      pageId,
      title.trim(),
      previousDocument
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

  deleteSection(sectionId: string): HierarchySelection | null {
    const sections = this.document.sections;
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      return null;
    }

    const fallback = sections[index + 1] ?? sections[index - 1];
    const fallbackSubsection = fallback?.subsections[0] ?? null;
    const fallbackPage = fallbackSubsection?.pages[0] ?? null;

    const previousDocument = this.deepCloneDocument(this.document);
    const command = new DeleteSectionCommand(
      this.store,
      sectionId,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      sectionId: fallback?.id ?? null,
      subsectionId: fallbackSubsection?.id ?? null,
      pageId: fallbackPage?.id ?? null,
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

    const fallback = subsections[index + 1] ?? subsections[index - 1];
    const fallbackPage = fallback?.pages[0] ?? null;

    const previousDocument = this.deepCloneDocument(this.document);
    const command = new DeleteSubsectionCommand(
      this.store,
      sectionId,
      subsectionId,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);

    return {
      subsectionId: fallback?.id ?? null,
      pageId: fallbackPage?.id ?? null,
    };
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

    const fallback = pages[index + 1] ?? pages[index - 1];

    const previousDocument = this.deepCloneDocument(this.document);
    const command = new DeletePageCommand(
      this.store,
      subsectionId,
      pageId,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);

    return fallback?.id ?? null;
  }

  deleteWidget(
    subsectionId: string,
    pageId: string,
    widgetId: string
  ): void {
    const previousDocument = this.deepCloneDocument(this.document);
    const command = new DeleteWidgetCommand(
      this.store,
      subsectionId,
      pageId,
      widgetId,
      previousDocument
    );
    this.undoRedoService.executeDocumentCommand(command);
  }

  /**
   * Copy widget(s) to clipboard
   */
  copyWidget(subsectionId: string, pageId: string, widgetId: string): void {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return;
    }

    const page = subsection.pages.find((p) => p.id === pageId);
    if (!page) {
      return;
    }

    const widget = page.widgets.find((w) => w.id === widgetId);
    if (!widget) {
      return;
    }

    this.clipboardService.copyWidgets([widget]);
  }

  /**
   * Copy multiple widgets to clipboard
   */
  copyWidgets(subsectionId: string, pageId: string, widgetIds: string[]): void {
    const subsection = this.findSubsectionById(subsectionId);
    if (!subsection) {
      return;
    }

    const page = subsection.pages.find((p) => p.id === pageId);
    if (!page) {
      return;
    }

    const widgets = page.widgets.filter((w) => widgetIds.includes(w.id));
    if (widgets.length > 0) {
      this.clipboardService.copyWidgets(widgets);
    }
  }

  /**
   * Paste widgets from clipboard to the specified page
   * Widgets are offset by a small amount to avoid overlapping with originals
   * @returns Array of pasted widget IDs
   */
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

    // Offset for pasted widgets (20px down and right)
    const offset = { x: 20, y: 20 };

    // Clone and paste each widget, collecting their IDs
    const pastedWidgetIds: string[] = [];
    copiedWidgets.forEach((widget) => {
      const clonedWidget = this.widgetFactory.cloneWidget(widget, offset);
      pastedWidgetIds.push(clonedWidget.id);
      this.addWidget(subsectionId, pageId, clonedWidget);
    });

    return pastedWidgetIds;
  }

  /**
   * Check if there are widgets in the clipboard
   */
  canPaste(): boolean {
    return this.clipboardService.hasCopiedWidgets();
  }

  /**
   * Deep clone document for undo/redo history
   */
  private deepCloneDocument(doc: DocumentModel): DocumentModel {
    return JSON.parse(JSON.stringify(doc));
  }
}

interface HierarchySelection {
  sectionId: string | null;
  subsectionId: string | null;
  pageId: string | null;
}

interface SubsectionSelection {
  subsectionId: string | null;
  pageId: string | null;
}

