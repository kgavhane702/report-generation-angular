import { Store } from '@ngrx/store';
import { SubsectionModel, SectionModel, PageSize } from '../../models/document.model';
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
    private pageId: string,
    private widget: WidgetModel
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.addWidget({
        pageId: this.pageId,
        widget: this.widget,
      })
    );
  }

  undo(): void {
    this.store.dispatch(
      DocumentActions.deleteWidget({
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
  private lastMergedAt = Date.now();
  private readonly mergeWindowMs = 800;

  constructor(
    private store: Store<AppState>,
    private pageId: string,
    private widgetId: string,
    private changes: Partial<WidgetModel>,
    private previousWidget: WidgetModel | WidgetEntity
  ) {}

  execute(): void {
    this.store.dispatch(
      WidgetActions.updateOne({
        id: this.widgetId,
        changes: this.changes as Partial<WidgetEntity>,
      })
    );
  }

  undo(): void {
    this.store.dispatch(
      WidgetActions.updateOne({
        id: this.widgetId,
        changes: this.previousWidget as unknown as Partial<WidgetEntity>,
      })
    );
  }

  description = 'Update widget';

  canMerge(next: Command): boolean {
    if (!(next instanceof UpdateWidgetCommand)) {
      return false;
    }

    if (next.widgetId !== this.widgetId) {
      return false;
    }

    // Merge only "props-only" updates (typing/autosave). Never merge moves/resizes/etc.
    if (!this.isPropsOnly(this.changes) || !this.isPropsOnly(next.changes)) {
      return false;
    }

    const now = Date.now();
    return now - this.lastMergedAt <= this.mergeWindowMs;
  }

  merge(next: Command): void {
    if (!(next instanceof UpdateWidgetCommand)) {
      return;
    }

    // Latest values win, but keep the original `previousWidget` snapshot so undo goes back
    // to the start of the merged burst.
    const cur = this.changes as Record<string, unknown>;
    const incoming = next.changes as Record<string, unknown>;

    const merged: Record<string, unknown> = { ...cur, ...incoming };

    if (cur['props'] && incoming['props'] && typeof cur['props'] === 'object' && typeof incoming['props'] === 'object') {
      merged['props'] = { ...(cur['props'] as object), ...(incoming['props'] as object) };
    }

    this.changes = merged as Partial<WidgetModel>;
    this.lastMergedAt = Date.now();
  }

  private isPropsOnly(changes: Partial<WidgetModel>): boolean {
    const keys = Object.keys(changes ?? {});
    if (keys.length === 0) return false;
    return keys.every((k) => k === 'props');
  }
}

/**
 * DeleteWidgetCommand
 * 
 * OPTIMIZED: Undo re-adds only the specific widget
 */
export class DeleteWidgetCommand implements Command {
  constructor(
    private store: Store<AppState>,
    private pageId: string,
    private widgetId: string,
    private deletedWidget: WidgetModel | WidgetEntity
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.deleteWidget({
        pageId: this.pageId,
        widgetId: this.widgetId,
      })
    );
  }

  undo(): void {
    // Convert WidgetEntity to WidgetModel if needed
    const widget = 'pageId' in this.deletedWidget 
      ? (({ pageId, ...rest }) => rest)(this.deletedWidget as WidgetEntity) as WidgetModel
      : this.deletedWidget;
    
    this.store.dispatch(
      DocumentActions.addWidget({
        pageId: this.pageId,
        widget,
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
    private previousPageSize: PageSize
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
    private deletedSection: SectionModel
  ) {}

  execute(): void {
    this.store.dispatch(DocumentActions.deleteSection({ sectionId: this.sectionId }));
  }

  undo(): void {
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
    private deletedSubsection: SubsectionModel
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
    private deletedPage: PageModel
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
    private previousTitle: string
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
    private pageId: string,
    private title: string,
    private previousTitle: string
  ) {}

  execute(): void {
    this.store.dispatch(
      DocumentActions.renamePage({
        pageId: this.pageId,
        title: this.title,
      })
    );
  }

  undo(): void {
    this.store.dispatch(
      DocumentActions.renamePage({
        pageId: this.pageId,
        title: this.previousTitle,
      })
    );
  }

  description = 'Rename page';
}
