import { Store } from '@ngrx/store';
import { DocumentModel, SubsectionModel } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { PageModel } from '../../models/page.model';
import { PageSize } from '../../models/document.model';
import { DocumentActions } from '../../store/document/document.actions';
import { AppState } from '../../store/app.state';
import { Command } from './undo-redo.service';

/**
 * Command for adding a widget
 */
export class AddWidgetCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private widget: WidgetModel,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.addWidget({
        subsectionId: this.subsectionId,
        pageId: this.pageId,
        widget: this.widget,
      })
    );
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = `Add ${this.widget.type} widget`;
}

/**
 * Command for updating a widget
 */
export class UpdateWidgetCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private widgetId: string,
    private changes: Partial<WidgetModel>,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.updateWidget({
        subsectionId: this.subsectionId,
        pageId: this.pageId,
        widgetId: this.widgetId,
        changes: this.changes,
      })
    );
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Update widget';
}

/**
 * Command for deleting a widget
 */
export class DeleteWidgetCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private widgetId: string,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.deleteWidget({
        subsectionId: this.subsectionId,
        pageId: this.pageId,
        widgetId: this.widgetId,
      })
    );
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Delete widget';
}

/**
 * Command for updating page size
 */
export class UpdatePageSizeCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private pageSize: Partial<PageSize>,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.updatePageSize({ pageSize: this.pageSize }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Update page size';
}

/**
 * Command for adding a section
 */
export class AddSectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private section: any,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.addSection({ section: this.section }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Add section';
}

/**
 * Command for deleting a section
 */
export class DeleteSectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.deleteSection({ sectionId: this.sectionId }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Delete section';
}

/**
 * Command for adding a subsection
 */
export class AddSubsectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private subsection: SubsectionModel,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.addSubsection({ sectionId: this.sectionId, subsection: this.subsection })
    );
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Add subsection';
}

/**
 * Command for deleting a subsection
 */
export class DeleteSubsectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private subsectionId: string,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.deleteSubsection({ sectionId: this.sectionId, subsectionId: this.subsectionId })
    );
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Delete subsection';
}

/**
 * Command for adding a page
 */
export class AddPageCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private page: PageModel,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.addPage({ subsectionId: this.subsectionId, page: this.page }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Add page';
}

/**
 * Command for deleting a page
 */
export class DeletePageCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.deletePage({ subsectionId: this.subsectionId, pageId: this.pageId }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Delete page';
}

/**
 * Command for renaming operations
 */
export class RenameSectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private title: string,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.renameSection({ sectionId: this.sectionId, title: this.title }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Rename section';
}

export class RenameSubsectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private title: string,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.renameSubsection({ subsectionId: this.subsectionId, title: this.title })
    );
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Rename subsection';
}

export class RenamePageCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private title: string,
    private previousDocument: DocumentModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.renamePage({
        subsectionId: this.subsectionId,
        pageId: this.pageId,
        title: this.title,
      })
    );
  }

  undo(): void {
    this.store.dispatch(DocumentActions.setDocument({ document: this.previousDocument }));
  }

  description = 'Rename page';
}

