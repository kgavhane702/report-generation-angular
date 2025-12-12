import { Store } from '@ngrx/store';
import { DocumentModel, SubsectionModel, SectionModel, PageSize } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { PageModel } from '../../models/page.model';
import { DocumentActions } from '../../store/document/document.actions';
import { AppState } from '../../store/app.state';
import { Command } from './undo-redo.service';

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

export class AddSectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private section: SectionModel,
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

