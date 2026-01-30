import { Store } from '@ngrx/store';
import { SubsectionModel, SectionModel, PageSize } from '../../models/document.model';
import { WidgetModel } from '../../models/widget.model';
import { PageModel } from '../../models/page.model';
import { DocumentActions, WidgetActions } from '../../store/document/document.actions';
import { AppState } from '../../store/app.state';
import { WidgetEntity } from '../../store/document/document.state';
import { Command } from './undo-redo.service';
import { deepClone } from '../utils/deep-clone.util';

/**
 * BatchCommand
 * 
 * Groups multiple commands into a single undo/redo operation.
 * Used for multi-widget operations like paste, cut, and multi-drag.
 */
export class BatchCommand implements Command {
  readonly kind = 'batch' as const;

  constructor(
    private commands: Command[],
    public description: string = 'Batch operation'
  ) {}

  execute(): void {
    // Execute in order
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

/**
 * AddWidgetsCommand
 * 
 * Adds multiple widgets as a single undoable operation.
 */
export class AddWidgetsCommand implements Command {
  readonly kind = 'add-widgets' as const;

  constructor(
    private store: Store<AppState>,
    private _pageId: string,
    private widgets: WidgetModel[]
  ) {}

  /** Page ID for navigation after undo/redo */
  get pageId(): string {
    return this._pageId;
  }

  get widgetIds(): string[] {
    return this.widgets.map(w => w.id);
  }

  execute(): void {
    for (const widget of this.widgets) {
      this.store.dispatch(
        DocumentActions.addWidget({
          pageId: this._pageId,
          widget,
        })
      );
    }
  }

  undo(): void {
    // Delete in reverse order
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      this.store.dispatch(
        DocumentActions.deleteWidget({
          pageId: this._pageId,
          widgetId: this.widgets[i].id,
        })
      );
    }
  }

  description = `Add ${this.widgets.length} widgets`;
}

/**
 * DeleteWidgetsCommand
 * 
 * Deletes multiple widgets as a single undoable operation.
 */
export class DeleteWidgetsCommand implements Command {
  readonly kind = 'delete-widgets' as const;

  constructor(
    private store: Store<AppState>,
    private _pageId: string,
    private deletedWidgets: (WidgetModel | WidgetEntity)[]
  ) {}

  /** Page ID for navigation after undo/redo */
  get pageId(): string {
    return this._pageId;
  }

  execute(): void {
    for (const widget of this.deletedWidgets) {
      this.store.dispatch(
        DocumentActions.deleteWidget({
          pageId: this._pageId,
          widgetId: widget.id,
        })
      );
    }
  }

  undo(): void {
    // Re-add in reverse order to maintain original order
    for (let i = this.deletedWidgets.length - 1; i >= 0; i--) {
      const deletedWidget = this.deletedWidgets[i];
      const widget = 'pageId' in deletedWidget 
        ? (({ pageId, ...rest }) => rest)(deletedWidget as WidgetEntity) as WidgetModel
        : deletedWidget;
      
      this.store.dispatch(
        DocumentActions.addWidget({
          pageId: this._pageId,
          widget,
        })
      );
    }
  }

  description = `Delete ${this.deletedWidgets.length} widgets`;
}

/**
 * UpdateWidgetsCommand
 * 
 * Updates multiple widgets as a single undoable operation.
 * Used for multi-widget drag/resize operations.
 */
export class UpdateWidgetsCommand implements Command {
  readonly kind = 'update-widgets' as const;

  constructor(
    private store: Store<AppState>,
    private updates: Array<{
      pageId: string;
      widgetId: string;
      changes: Partial<WidgetModel>;
      previousWidget: WidgetModel | WidgetEntity;
    }>
  ) {}

  /** Page ID for navigation after undo/redo (uses first update's pageId) */
  get pageId(): string | undefined {
    return this.updates[0]?.pageId;
  }

  execute(): void {
    for (const { widgetId, changes } of this.updates) {
      this.store.dispatch(
        WidgetActions.updateOne({
          id: widgetId,
          changes: changes as Partial<WidgetEntity>,
        })
      );
    }
  }

  undo(): void {
    // Restore in reverse order
    for (let i = this.updates.length - 1; i >= 0; i--) {
      const { widgetId, previousWidget } = this.updates[i];
      this.store.dispatch(
        WidgetActions.updateOne({
          id: widgetId,
          changes: previousWidget as unknown as Partial<WidgetEntity>,
        })
      );
    }
  }

  description = `Update ${this.updates.length} widgets`;
}

/**
 * AddWidgetCommand
 * 
 * OPTIMIZED: Undo removes only the specific widget instead of replacing entire document
 */
export class AddWidgetCommand implements Command {
  readonly kind = 'add-widget' as const;

  constructor(
    private store: Store<AppState>,
    private _pageId: string,
    private widget: WidgetModel
  ) {}

  /** Page ID for navigation after undo/redo */
  get pageId(): string {
    return this._pageId;
  }

  get widgetId(): string {
    return this.widget.id;
  }

  /** Update the stored widget snapshot so redo re-adds the latest "final" widget state. */
  updateWidgetSnapshot(widgetSnapshot: WidgetModel): void {
    if (!widgetSnapshot || widgetSnapshot.id !== this.widget.id) {
      return;
    }
    this.widget = deepClone(widgetSnapshot);
  }

  execute(): void {
    this.store.dispatch(
      DocumentActions.addWidget({
        pageId: this._pageId,
        widget: this.widget,
      })
    );
  }

  undo(): void {
    this.store.dispatch(
      DocumentActions.deleteWidget({
        pageId: this._pageId,
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
    private _pageId: string,
    private _widgetId: string,
    private changes: Partial<WidgetModel>,
    private previousWidget: WidgetModel | WidgetEntity
  ) {}

  /** Page ID for navigation after undo/redo */
  get pageId(): string {
    return this._pageId;
  }

  get widgetId(): string {
    return this._widgetId;
  }

  execute(): void {
    this.store.dispatch(
      WidgetActions.updateOne({
        id: this._widgetId,
        changes: this.changes as Partial<WidgetEntity>,
      })
    );
  }

  undo(): void {
    this.store.dispatch(
      WidgetActions.updateOne({
        id: this._widgetId,
        changes: this.previousWidget as unknown as Partial<WidgetEntity>,
      })
    );
  }

  description = 'Update widget';

  canMerge(next: Command): boolean {
    if (!(next instanceof UpdateWidgetCommand)) {
      return false;
    }

    if (next._widgetId !== this._widgetId) {
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
    private _pageId: string,
    private _widgetId: string,
    private deletedWidget: WidgetModel | WidgetEntity
  ) {}

  /** Page ID for navigation after undo/redo */
  get pageId(): string {
    return this._pageId;
  }

  get widgetId(): string {
    return this._widgetId;
  }

  execute(): void {
    this.store.dispatch(
      DocumentActions.deleteWidget({
        pageId: this._pageId,
        widgetId: this._widgetId,
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
        pageId: this._pageId,
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
    private _pageId: string,
    private deletedPage: PageModel
  ) {}

  /** Page ID for navigation after undo/redo */
  get pageId(): string {
    return this._pageId;
  }

  execute(): void {
    this.store.dispatch(DocumentActions.deletePage({ subsectionId: this.subsectionId, pageId: this._pageId }));
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
    private _pageId: string,
    private title: string,
    private previousTitle: string
  ) {}

  /** Page ID for navigation after undo/redo */
  get pageId(): string {
    return this._pageId;
  }

  execute(): void {
    this.store.dispatch(
      DocumentActions.renamePage({
        pageId: this._pageId,
        title: this.title,
      })
    );
  }

  undo(): void {
    this.store.dispatch(
      DocumentActions.renamePage({
        pageId: this._pageId,
        title: this.previousTitle,
      })
    );
  }

  description = 'Rename page';
}
