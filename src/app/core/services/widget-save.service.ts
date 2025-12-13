import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { WidgetSaveStatus, WidgetSaveStatusMap } from '../models/widget-save-status.model';

@Injectable({
  providedIn: 'root',
})
export class WidgetSaveService {
  private saveAllSubject = new Subject<void>();
  readonly saveAll$ = this.saveAllSubject.asObservable();
  
  // Track widget save status
  private widgetSaveStatus: WidgetSaveStatusMap = {};
  
  // Track all registered widget containers with their save functions
  private widgetContainers: Array<{ 
    widgetId: string;
    hasPendingChanges: () => boolean;
    savePending: () => Promise<void>;
  }> = [];

  // Lock to prevent concurrent save operations
  private isSaving = false;
  private saveQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * Register a widget container so it can be saved when needed
   */
  registerWidgetContainer(
    widgetId: string,
    hasPendingChangesFn: () => boolean,
    saveFn: () => Promise<void>
  ): void {
    // Prevent duplicate registration - unregister first if exists
    this.unregisterWidgetContainer(widgetId);
    
    this.widgetContainers.push({ 
      widgetId,
      hasPendingChanges: hasPendingChangesFn,
      savePending: saveFn 
    });
    
    // Initialize save status
    if (!this.widgetSaveStatus[widgetId]) {
      this.widgetSaveStatus[widgetId] = {
        widgetId,
        hasUnsavedChanges: false,
      };
    }
  }

  /**
   * Unregister a widget container
   */
  unregisterWidgetContainer(widgetId: string): void {
    const index = this.widgetContainers.findIndex(w => w.widgetId === widgetId);
    if (index > -1) {
      this.widgetContainers.splice(index, 1);
    }
    // Remove save status
    delete this.widgetSaveStatus[widgetId];
  }

  /**
   * Mark a widget as having unsaved changes
   */
  markWidgetAsUnsaved(widgetId: string): void {
    if (this.widgetSaveStatus[widgetId]) {
      this.widgetSaveStatus[widgetId].hasUnsavedChanges = true;
    } else {
      this.widgetSaveStatus[widgetId] = {
        widgetId,
        hasUnsavedChanges: true,
      };
    }
  }

  /**
   * Mark a widget as saved
   */
  markWidgetAsSaved(widgetId: string): void {
    if (this.widgetSaveStatus[widgetId]) {
      this.widgetSaveStatus[widgetId].hasUnsavedChanges = false;
      this.widgetSaveStatus[widgetId].lastSavedAt = Date.now();
    }
  }

  /**
   * Check if a specific widget has unsaved changes
   */
  hasUnsavedChanges(widgetId: string): boolean {
    return this.widgetSaveStatus[widgetId]?.hasUnsavedChanges ?? false;
  }

  /**
   * Check if any widget has unsaved changes
   * Only checks widgets that are actually registered and can be saved
   * This prevents false positives from widgets that are marked as unsaved
   * but don't have a registered container yet (e.g., newly created widgets)
   */
  hasAnyPendingChanges(): boolean {
    // Only check widgets that are registered in containers AND have pending changes
    // This ensures we only block operations for widgets that can actually be saved
    return this.widgetContainers.some(w => {
      // Check if widget exists in status map (not deleted)
      const widgetExists = this.widgetSaveStatus[w.widgetId] !== undefined;
      if (!widgetExists) {
        return false;
      }
      
      // Check if widget has unsaved changes in status map OR container state
      const hasStatusUnsaved = this.widgetSaveStatus[w.widgetId]?.hasUnsavedChanges ?? false;
      const hasContainerPending = w.hasPendingChanges();
      
      return hasStatusUnsaved || hasContainerPending;
    });
  }

  /**
   * Get all widgets with unsaved changes
   */
  getUnsavedWidgetIds(): string[] {
    return Object.values(this.widgetSaveStatus)
      .filter(s => s.hasUnsavedChanges)
      .map(s => s.widgetId);
  }

  /**
   * Save all pending changes and return a Promise that resolves when all saves complete
   * Only saves widgets that actually have pending changes
   * Prevents concurrent save operations using a lock mechanism
   */
  saveAllPendingChanges(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // If a save is already in progress, queue this request
      if (this.isSaving) {
        this.saveQueue.push({ resolve, reject });
        return;
      }

      // Acquire lock
      this.isSaving = true;

      // Trigger save signal for widgets that listen via observable (legacy support)
      this.saveAllSubject.next();
      
      // Find all widgets with pending changes (both from status and containers)
      // Filter out widgets that no longer exist (may have been deleted)
      const unsavedWidgetIds = this.getUnsavedWidgetIds();
      const widgetsToSave = this.widgetContainers.filter(w => {
        const widgetExists = this.widgetSaveStatus[w.widgetId] !== undefined;
        const hasPending = w.hasPendingChanges() || unsavedWidgetIds.includes(w.widgetId);
        return widgetExists && hasPending;
      });
      
      if (widgetsToSave.length === 0) {
        // Release lock
        this.isSaving = false;
        // Process next queued save if any
        this.processSaveQueue();
        resolve();
        return;
      }

      // Save all widgets with pending changes sequentially with error handling
      const saveErrors: Array<{ widgetId: string; error: Error }> = [];
      
      widgetsToSave.reduce((promise, widget) => {
        return promise.then(() => {
          return widget.savePending()
            .then(() => {
              // Mark as saved only after successful save
              this.markWidgetAsSaved(widget.widgetId);
            })
            .catch((error: Error) => {
              // Collect error but continue saving other widgets
              saveErrors.push({
                widgetId: widget.widgetId,
                error: error instanceof Error ? error : new Error(String(error))
              });
              console.error(`Failed to save widget ${widget.widgetId}:`, error);
            });
        });
      }, Promise.resolve())
        .then(() => {
          // Release lock
          this.isSaving = false;
          
          // Process next queued save if any
          this.processSaveQueue();
          
          // If there were errors, reject with error details
          if (saveErrors.length > 0) {
            const errorMessage = `Failed to save ${saveErrors.length} widget(s): ${saveErrors.map(e => e.widgetId).join(', ')}`;
            reject(new Error(errorMessage));
          } else {
            resolve();
          }
        })
        .catch((error: Error) => {
          // Release lock
          this.isSaving = false;
          
          // Process next queued save if any
          this.processSaveQueue();
          
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  /**
   * Process the next queued save operation
   */
  private processSaveQueue(): void {
    if (this.saveQueue.length > 0 && !this.isSaving) {
      const nextSave = this.saveQueue.shift();
      if (nextSave) {
        this.saveAllPendingChanges()
          .then(() => nextSave.resolve())
          .catch((error) => nextSave.reject(error));
      }
    }
  }

  /**
   * Clear all widget save status (useful when document is replaced)
   * Rejects any queued save operations to prevent hanging promises
   */
  clearAllWidgetStatus(): void {
    // Reject all queued saves to prevent hanging promises
    this.saveQueue.forEach(({ reject }) => {
      reject(new Error('Save cancelled: Document was replaced'));
    });
    this.widgetSaveStatus = {};
    this.widgetContainers = [];
    this.saveQueue = [];
    this.isSaving = false;
  }
}

