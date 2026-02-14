import { Injectable, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';

import { AppState } from '../../store/app.state';
import { WidgetActions } from '../../store/document/document.actions';
import { WidgetEntity } from '../../store/document/document.state';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { WidgetModel, WidgetPosition, WidgetSize, WidgetProps } from '../../models/widget.model';
import { DocumentService } from './document.service';

/**
 * Draft changes for a widget
 */
export interface WidgetDraft {
  position?: WidgetPosition;
  size?: WidgetSize;
  props?: Partial<WidgetProps>;
  zIndex?: number;
  rotation?: number;
  locked?: boolean;
}

export interface CommitDraftOptions {
  /**
   * When true, commits through the global Command-based pipeline so the change participates
   * in document undo/redo.
   *
   * Default is false to preserve existing behavior (draft commits were historically not undoable).
   */
  recordUndo?: boolean;
  /** Optional previous widget snapshot override for undo (used for precise history like rotation). */
  previousWidgetOverride?: WidgetModel | WidgetEntity;
  /** Optional per-widget previous snapshots for batch commits. */
  previousWidgetOverrides?: Record<string, WidgetModel | WidgetEntity>;
}

/**
 * DraftStateService
 * 
 * Manages local "in-progress" changes to widgets that haven't been
 * committed to the NgRx store yet.
 * 
 * This solves the core architectural problem:
 * - User interactions (resize, drag, typing) update draft state locally
 * - Store is NOT updated during the interaction
 * - Only when the user completes the interaction (mouseup, blur), the draft is committed
 * 
 * This prevents:
 * - Full document re-rendering during interactions
 * - Widget components being recreated mid-interaction
 * - Text editor losing focus during typing
 */
@Injectable({
  providedIn: 'root',
})
export class DraftStateService {
  private readonly store = inject(Store<AppState>);
  private readonly documentService = inject(DocumentService);

  /**
   * Synchronous access to widget entities for commit-time merging (especially props) and pageId lookup.
   */
  private readonly widgetEntities = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Dictionary<WidgetEntity> }
  );
  
  /**
   * Map of widget IDs to their draft changes
   * Using a signal for reactivity
   */
  private readonly draftsMap = signal<Map<string, WidgetDraft>>(new Map());
  
  /**
   * Set of widget IDs currently being edited
   */
  private readonly editingWidgetIds = signal<Set<string>>(new Set());
  
  /**
   * Get the current drafts map (readonly)
   */
  readonly drafts = this.draftsMap.asReadonly();
  
  /**
   * Get widget IDs that are currently being edited
   */
  readonly editingIds = this.editingWidgetIds.asReadonly();
  
  /**
   * Check if a specific widget has unsaved draft changes
   */
  hasDraft(widgetId: string): boolean {
    return this.draftsMap().has(widgetId);
  }
  
  /**
   * Check if a widget is currently being actively edited
   */
  isEditing(widgetId: string): boolean {
    return this.editingWidgetIds().has(widgetId);
  }
  
  /**
   * Get draft changes for a specific widget
   * Returns null if no draft exists
   */
  getDraft(widgetId: string): WidgetDraft | null {
    return this.draftsMap().get(widgetId) ?? null;
  }
  
  /**
   * Start editing a widget
   * This marks the widget as being actively edited
   */
  startEditing(widgetId: string): void {
    const newSet = new Set(this.editingWidgetIds());
    newSet.add(widgetId);
    this.editingWidgetIds.set(newSet);
  }
  
  /**
   * Stop editing a widget (but don't commit yet)
   */
  stopEditing(widgetId: string): void {
    const newSet = new Set(this.editingWidgetIds());
    newSet.delete(widgetId);
    this.editingWidgetIds.set(newSet);
  }
  
  /**
   * Update draft changes for a widget WITHOUT touching the store
   * 
   * This is the key method for smooth interactions:
   * - Called rapidly during drag/resize/typing
   * - Updates local state only
   * - No NgRx dispatch = no re-renders
   */
  updateDraft(widgetId: string, changes: WidgetDraft): void {
    const currentDrafts = new Map(this.draftsMap());
    const existingDraft = currentDrafts.get(widgetId) ?? {};
    
    // Merge changes into existing draft
    const mergedDraft: WidgetDraft = {
      ...existingDraft,
      ...changes,
    };
    
    // Deep merge props if both exist
    if (existingDraft.props && changes.props) {
      mergedDraft.props = {
        ...existingDraft.props,
        ...changes.props,
      };
    }
    
    currentDrafts.set(widgetId, mergedDraft);
    this.draftsMap.set(currentDrafts);
  }
  
  /**
   * Update only the position in the draft
   */
  updateDraftPosition(widgetId: string, position: WidgetPosition): void {
    this.updateDraft(widgetId, { position });
  }
  
  /**
   * Update only the size in the draft
   */
  updateDraftSize(widgetId: string, size: WidgetSize): void {
    this.updateDraft(widgetId, { size });
  }
  
  /**
   * Update both position and size in the draft (for resize operations)
   */
  updateDraftFrame(widgetId: string, position: WidgetPosition, size: WidgetSize): void {
    this.updateDraft(widgetId, { position, size });
  }
  
  /**
   * Update props in the draft (for content changes)
   */
  updateDraftProps(widgetId: string, props: Partial<WidgetProps>): void {
    this.updateDraft(widgetId, { props });
  }

  /**
   * Update only the rotation in the draft (for rotation operations)
   */
  updateDraftRotation(widgetId: string, rotation: number): void {
    this.updateDraft(widgetId, { rotation });
  }
  
  /**
   * Commit draft changes to the NgRx store
   * 
   * This should be called when the user finishes an interaction:
   * - mouseup after drag/resize
   * - blur after text editing
   * - explicit save action
   */
  commitDraft(widgetId: string, options?: CommitDraftOptions): void {
    const draft = this.draftsMap().get(widgetId);
    if (!draft) {
      return; // No draft to commit
    }

    const recordUndo = options?.recordUndo === true;
    
    // Build the changes object for NgRx
    const changes: Partial<WidgetEntity> = {};
    
    if (draft.position) {
      changes.position = draft.position;
    }
    
    if (draft.size) {
      changes.size = draft.size;
    }
    
    if (draft.props) {
      // For props, we need to get the current props and merge
      // This is handled by the reducer
      changes.props = draft.props as WidgetProps;
    }
    
    if (draft.zIndex !== undefined) {
      changes.zIndex = draft.zIndex;
    }
    
    if (draft.rotation !== undefined) {
      changes.rotation = draft.rotation;
    }
    
    if (draft.locked !== undefined) {
      changes.locked = draft.locked;
    }
    
    // Dispatch to store - this is the ONLY time we update the store
    if (Object.keys(changes).length > 0) {
      if (recordUndo) {
        const persisted = this.widgetEntities()[widgetId];
        const previousWidget = options?.previousWidgetOverride ?? persisted;
        if (previousWidget && persisted) {
          // IMPORTANT: ensure props is fully merged at commit time; NgRx updateOne does NOT deep-merge props.
          const mergedProps = changes.props
            ? ({ ...(persisted.props ?? {}), ...(changes.props as unknown as WidgetProps) } as WidgetProps)
            : undefined;

          this.documentService.updateWidget(persisted.pageId, widgetId, {
            ...changes,
            ...(mergedProps ? { props: mergedProps } : {}),
          } as unknown as Partial<WidgetModel>, previousWidget);
        } else {
          // Fallback: if we can't resolve persisted entity/pageId, at least commit to store.
          this.store.dispatch(WidgetActions.updateOne({ id: widgetId, changes }));
        }
      } else {
        this.store.dispatch(WidgetActions.updateOne({ id: widgetId, changes }));
      }
    }
    
    // Clear the draft
    this.discardDraft(widgetId);
    
    // Stop editing
    this.stopEditing(widgetId);
  }
  
  /**
   * Discard draft changes without committing
   */
  discardDraft(widgetId: string): void {
    const currentDrafts = new Map(this.draftsMap());
    currentDrafts.delete(widgetId);
    this.draftsMap.set(currentDrafts);
  }
  
  /**
   * Discard all drafts (e.g., when switching pages)
   */
  discardAllDrafts(): void {
    this.draftsMap.set(new Map());
    this.editingWidgetIds.set(new Set());
  }
  
  /**
   * Commit all drafts at once (e.g., before page navigation)
   */
  commitAllDrafts(): void {
    const currentDrafts = this.draftsMap();
    currentDrafts.forEach((draft, widgetId) => {
      this.commitDraft(widgetId);
    });
  }

  /**
   * Commit multiple drafts as a single undoable operation.
   * Used for multi-widget drag/resize operations.
   *
   * @param widgetIds - Array of widget IDs to commit
   * @param options - Commit options (recordUndo should be true for batched operations)
   */
  commitDraftsBatched(widgetIds: string[], options?: CommitDraftOptions): void {
    if (widgetIds.length === 0) return;

    const recordUndo = options?.recordUndo === true;
    const previousWidgetOverrides = options?.previousWidgetOverrides ?? {};
    const updates: Array<{
      pageId: string;
      widgetId: string;
      changes: Partial<WidgetModel>;
      previousWidget?: WidgetModel | WidgetEntity;
    }> = [];

    for (const widgetId of widgetIds) {
      const draft = this.draftsMap().get(widgetId);
      if (!draft) continue;

      // Build the changes object
      const changes: Partial<WidgetEntity> = {};

      if (draft.position) {
        changes.position = draft.position;
      }

      if (draft.size) {
        changes.size = draft.size;
      }

      if (draft.props) {
        changes.props = draft.props as WidgetProps;
      }

      if (draft.zIndex !== undefined) {
        changes.zIndex = draft.zIndex;
      }

      if (draft.rotation !== undefined) {
        changes.rotation = draft.rotation;
      }

      if (draft.locked !== undefined) {
        changes.locked = draft.locked;
      }

      if (Object.keys(changes).length === 0) continue;

      const persisted = this.widgetEntities()[widgetId];
      if (!persisted) continue;

      // Merge props at commit time
      const mergedProps = changes.props
        ? ({ ...(persisted.props ?? {}), ...(changes.props as unknown as WidgetProps) } as WidgetProps)
        : undefined;

      updates.push({
        pageId: persisted.pageId,
        widgetId,
        changes: {
          ...changes,
          ...(mergedProps ? { props: mergedProps } : {}),
        } as unknown as Partial<WidgetModel>,
        ...(recordUndo && previousWidgetOverrides[widgetId]
          ? { previousWidget: previousWidgetOverrides[widgetId] }
          : {}),
      });

      // Clear the draft and stop editing
      this.discardDraft(widgetId);
      this.stopEditing(widgetId);
    }

    if (updates.length === 0) return;

    if (recordUndo) {
      // Use batch update for a single undo operation
      this.documentService.updateWidgets(updates);
    } else {
      // Dispatch individual updates without undo
      for (const { widgetId, changes } of updates) {
        this.store.dispatch(WidgetActions.updateOne({ id: widgetId, changes: changes as Partial<WidgetEntity> }));
      }
    }
  }
  
  /**
   * Get a merged view of a widget's data
   * 
   * This returns the widget data with any draft changes applied.
   * Used for displaying the current state including uncommitted changes.
   */
  getMergedWidget(widgetId: string, persistedWidget: WidgetEntity | null): WidgetEntity | null {
    if (!persistedWidget) {
      return null;
    }
    
    const draft = this.getDraft(widgetId);
    if (!draft) {
      return persistedWidget;
    }
    
    // Merge draft changes over persisted widget
    return {
      ...persistedWidget,
      ...(draft.position && { position: draft.position }),
      ...(draft.size && { size: draft.size }),
      ...(draft.zIndex !== undefined && { zIndex: draft.zIndex }),
      ...(draft.rotation !== undefined && { rotation: draft.rotation }),
      ...(draft.locked !== undefined && { locked: draft.locked }),
      ...(draft.props && {
        props: {
          ...persistedWidget.props,
          ...draft.props,
        } as WidgetProps,
      }),
    };
  }
  
  /**
   * Create a computed signal that returns the merged widget
   * 
   * Usage in component:
   * ```
   * readonly displayWidget = this.draftState.createMergedWidgetSignal(
   *   this.widgetId,
   *   toSignal(this.store.select(selectWidgetById(this.widgetId)))
   * );
   * ```
   */
  createMergedWidgetComputed(
    widgetId: string,
    persistedWidgetSignal: () => WidgetEntity | null | undefined
  ) {
    return computed(() => {
      const persisted = persistedWidgetSignal();
      if (!persisted) return null;
      return this.getMergedWidget(widgetId, persisted);
    });
  }
}
