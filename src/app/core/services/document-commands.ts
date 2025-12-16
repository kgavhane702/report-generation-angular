import { Store } from '@ngrx/store';
import { DocumentModel, SubsectionModel, SectionModel, PageSize } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { PageModel } from '../../models/page.model';
import { DocumentActions, WidgetActions } from '../../store/document/document.actions';
import { AppState } from '../../store/app.state';
import { WidgetEntity } from '../../store/document/document.state';
import { Command } from './undo-redo.service';

/**
 * AddWidgetCommand
 * 
 * OPTIMIZED: Undo removes only the specific widget instead of replacing entire document
 */
export class AddWidgetCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private widget: WidgetModel
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
    // Remove the specific widget - much more efficient than replacing entire document
    this.store.dispatch(
      DocumentActions.deleteWidget({
        subsectionId: this.subsectionId,
        pageId: this.pageId,
        widgetId: this.widget.id,
      })
    );
  }

  description = `Add ${this.widget.type} widget`;
}

/**
 * UpdateWidgetCommand
 * 
 * OPTIMIZED: Stores only the widget's previous state, not entire document
 * Uses entity-level WidgetActions for targeted updates
 */
export class UpdateWidgetCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private widgetId: string,
    private changes: Partial<WidgetModel>,
    private previousWidget: WidgetModel // Only store this widget's previous state
  ) {}

  execute(): void {
    // Use entity-level action for targeted update
    this.store.dispatch(
      WidgetActions.updateOne({
        id: this.widgetId,
        changes: this.changes as Partial<WidgetEntity>,
      })
    );
  }

  undo(): void {
    // Restore only this widget to its previous state
    this.store.dispatch(
      WidgetActions.updateOne({
        id: this.widgetId,
        changes: this.previousWidget as unknown as Partial<WidgetEntity>,
      })
    );
  }

  description = 'Update widget';
}

/**
 * DeleteWidgetCommand
 * 
 * OPTIMIZED: Undo re-adds only the specific widget
 */
export class DeleteWidgetCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private widgetId: string,
    private deletedWidget: WidgetModel // Store the deleted widget for undo
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
    // Re-add the deleted widget
    this.store.dispatch(
      DocumentActions.addWidget({
        subsectionId: this.subsectionId,
        pageId: this.pageId,
        widget: this.deletedWidget,
      })
    );
  }

  description = 'Delete widget';
}

/**
 * UpdatePageSizeCommand
 */
export class UpdatePageSizeCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private pageSize: Partial<PageSize>,
    private previousPageSize: PageSize // Only store previous page size
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.updatePageSize({ pageSize: this.pageSize }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.updatePageSize({ pageSize: this.previousPageSize }));
  }

  description = 'Update page size';
}

/**
 * AddSectionCommand
 */
export class AddSectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private section: SectionModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.addSection({ section: this.section }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.deleteSection({ sectionId: this.section.id }));
  }

  description = 'Add section';
}

/**
 * DeleteSectionCommand
 */
export class DeleteSectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private deletedSection: SectionModel // Store the deleted section for undo
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.deleteSection({ sectionId: this.sectionId }));
  }

  undo(): void {
    // Re-add the deleted section
    this.store.dispatch(DocumentActions.addSection({ section: this.deletedSection }));
  }

  description = 'Delete section';
}

/**
 * AddSubsectionCommand
 */
export class AddSubsectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private subsection: SubsectionModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.addSubsection({ sectionId: this.sectionId, subsection: this.subsection })
    );
  }

  undo(): void {
    this.store.dispatch(
      DocumentActions.deleteSubsection({ sectionId: this.sectionId, subsectionId: this.subsection.id })
    );
  }

  description = 'Add subsection';
}

/**
 * DeleteSubsectionCommand
 */
export class DeleteSubsectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private subsectionId: string,
    private deletedSubsection: SubsectionModel // Store for undo
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.deleteSubsection({ sectionId: this.sectionId, subsectionId: this.subsectionId })
    );
  }

  undo(): void {
    this.store.dispatch(
      DocumentActions.addSubsection({ sectionId: this.sectionId, subsection: this.deletedSubsection })
    );
  }

  description = 'Delete subsection';
}

/**
 * AddPageCommand
 */
export class AddPageCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private page: PageModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.addPage({ subsectionId: this.subsectionId, page: this.page }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.deletePage({ subsectionId: this.subsectionId, pageId: this.page.id }));
  }

  description = 'Add page';
}

/**
 * DeletePageCommand
 */
export class DeletePageCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private deletedPage: PageModel // Store for undo
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.deletePage({ subsectionId: this.subsectionId, pageId: this.pageId }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.addPage({ subsectionId: this.subsectionId, page: this.deletedPage }));
  }

  description = 'Delete page';
}

/**
 * RenameSectionCommand
 */
export class RenameSectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private sectionId: string,
    private title: string,
    private previousTitle: string // Only store previous title
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.renameSection({ sectionId: this.sectionId, title: this.title }));
  }

  undo(): void {
    this.store.dispatch(DocumentActions.renameSection({ sectionId: this.sectionId, title: this.previousTitle }));
  }

  description = 'Rename section';
}

/**
 * RenameSubsectionCommand
 */
export class RenameSubsectionCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private title: string,
    private previousTitle: string
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.renameSubsection({ subsectionId: this.subsectionId, title: this.title })
    );
  }

  undo(): void {
    this.store.dispatch(
      DocumentActions.renameSubsection({ subsectionId: this.subsectionId, title: this.previousTitle })
    );
  }

  description = 'Rename subsection';
}

/**
 * RenamePageCommand
 */
export class RenamePageCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private subsectionId: string,
    private pageId: string,
    private title: string,
    private previousTitle: string
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
    this.store.dispatch(
      DocumentActions.renamePage({
        subsectionId: this.subsectionId,
        pageId: this.pageId,
        title: this.previousTitle,
      })
    );
  }

  description = 'Rename page';
}
