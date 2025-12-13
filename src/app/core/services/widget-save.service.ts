import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WidgetSaveService {
  private saveAllSubject = new Subject<void>();
  readonly saveAll$ = this.saveAllSubject.asObservable();
  
  // Track all registered widget containers with their save functions
  private widgetContainers: Array<{ 
    widgetId: string;
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
    saveFn: () => Promise<void>
  ): void {
    // Prevent duplicate registration - unregister first if exists
    this.unregisterWidgetContainer(widgetId);
    
    this.widgetContainers.push({ 
      widgetId,
      savePending: saveFn 
    });
  }

  /**
   * Unregister a widget container
   */
  unregisterWidgetContainer(widgetId: string): void {
    const index = this.widgetContainers.findIndex(w => w.widgetId === widgetId);
    if (index > -1) {
      this.widgetContainers.splice(index, 1);
    }
  }

  /**
   * Save all widgets and return a Promise that resolves when all saves complete
   * Always saves all registered widgets - no need to check for pending changes
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
      
      // Save all registered widgets - no need to check for pending changes
      if (this.widgetContainers.length === 0) {
        // Release lock
        this.isSaving = false;
        // Process next queued save if any
        this.processSaveQueue();
        resolve();
        return;
      }

      // Save all widgets sequentially with error handling
      const saveErrors: Array<{ widgetId: string; error: Error }> = [];
      
      this.widgetContainers.reduce((promise, widget) => {
        return promise.then(() => {
          return widget.savePending()
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
   * Clear all widget containers (useful when document is replaced)
   * Rejects any queued save operations to prevent hanging promises
   */
  clearAllWidgetStatus(): void {
    // Reject all queued saves to prevent hanging promises
    this.saveQueue.forEach(({ reject }) => {
      reject(new Error('Save cancelled: Document was replaced'));
    });
    this.widgetContainers = [];
    this.saveQueue = [];
    this.isSaving = false;
  }
}

