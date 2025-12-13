import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

interface WidgetContainer {
  widgetId: string;
  pageId: string;
  savePending: () => Promise<void>;
}

@Injectable({
  providedIn: 'root',
})
export class WidgetSaveService {
  private saveAllSubject = new Subject<void>();
  readonly saveAll$ = this.saveAllSubject.asObservable();
  
  // Track all registered widget containers by pageId for O(1) lookup
  // Map<pageId, Map<widgetId, WidgetContainer>>
  private widgetContainersByPage: Map<string, Map<string, WidgetContainer>> = new Map();
  
  // Also maintain a flat map for quick widget lookup by ID
  private widgetContainersById: Map<string, WidgetContainer> = new Map();

  // Lock to prevent concurrent save operations
  private isSaving = false;
  private saveQueue: Array<{
    pageId: string | null; // Store original intent (null = save all)
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * Register a widget container so it can be saved when needed
   */
  registerWidgetContainer(
    widgetId: string,
    pageId: string,
    saveFn: () => Promise<void>
  ): void {
    // Prevent duplicate registration - unregister first if exists
    this.unregisterWidgetContainer(widgetId);
    
    const container: WidgetContainer = {
      widgetId,
      pageId,
      savePending: saveFn
    };
    
    // Add to page-based map
    if (!this.widgetContainersByPage.has(pageId)) {
      this.widgetContainersByPage.set(pageId, new Map());
    }
    this.widgetContainersByPage.get(pageId)!.set(widgetId, container);
    
    // Add to ID-based map for quick lookup
    this.widgetContainersById.set(widgetId, container);
  }

  /**
   * Unregister a widget container
   */
  unregisterWidgetContainer(widgetId: string): void {
    const container = this.widgetContainersById.get(widgetId);
    if (container) {
      // Remove from page-based map
      const pageMap = this.widgetContainersByPage.get(container.pageId);
      if (pageMap) {
        pageMap.delete(widgetId);
        // Clean up empty page maps
        if (pageMap.size === 0) {
          this.widgetContainersByPage.delete(container.pageId);
        }
      }
      
      // Remove from ID-based map
      this.widgetContainersById.delete(widgetId);
    }
  }

  /**
   * Unregister all widgets for a specific page (useful when page is deleted)
   */
  unregisterPageWidgets(pageId: string): void {
    const pageMap = this.widgetContainersByPage.get(pageId);
    if (pageMap) {
      // Remove all widgets from ID-based map
      pageMap.forEach((container) => {
        this.widgetContainersById.delete(container.widgetId);
      });
      // Remove the page map
      this.widgetContainersByPage.delete(pageId);
    }
  }

  /**
   * Save widgets from a specific page and return a Promise that resolves when all saves complete
   * Only saves widgets registered for the given pageId
   * Prevents concurrent save operations using a lock mechanism
   * Uses parallel saving for better performance
   */
  saveActivePageWidgets(pageId: string | null): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // If no pageId provided, resolve immediately
      if (!pageId) {
        resolve();
        return;
      }

      // If a save is already in progress, queue this request
      if (this.isSaving) {
        this.saveQueue.push({ pageId, resolve, reject });
        return;
      }

      // Acquire lock
      this.isSaving = true;

      // Get widgets by pageId - O(1) lookup
      const pageMap = this.widgetContainersByPage.get(pageId);
      const widgetsToSave = pageMap ? Array.from(pageMap.values()) : [];
      
      if (widgetsToSave.length === 0) {
        // Release lock
        this.isSaving = false;
        // Process next queued save if any
        this.processSaveQueue();
        resolve();
        return;
      }

      // Save widgets in parallel for better performance
      const savePromises = widgetsToSave.map(widget => 
        widget.savePending().catch((error: Error) => {
          // Collect error but continue saving other widgets
          console.error(`Failed to save widget ${widget.widgetId}:`, error);
          return { widgetId: widget.widgetId, error: error instanceof Error ? error : new Error(String(error)) };
        })
      );

      Promise.all(savePromises)
        .then((results) => {
          // Release lock
          this.isSaving = false;
          
          // Process next queued save if any
          this.processSaveQueue();
          
          // Check for errors
          const saveErrors = results.filter((r): r is { widgetId: string; error: Error } => {
            return r !== undefined && typeof r === 'object' && r !== null && 'error' in r;
          });
          
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
   * Save all widgets and return a Promise that resolves when all saves complete
   * Always saves all registered widgets - no need to check for pending changes
   * Prevents concurrent save operations using a lock mechanism
   * Kept for backward compatibility
   */
  saveAllPendingChanges(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // If a save is already in progress, queue this request
      if (this.isSaving) {
        this.saveQueue.push({ pageId: null, resolve, reject }); // null = save all
        return;
      }

      // Acquire lock
      this.isSaving = true;

      // Trigger save signal for widgets that listen via observable (legacy support)
      this.saveAllSubject.next();
      
      // Get all widgets from all pages
      const allWidgets = Array.from(this.widgetContainersById.values());
      
      if (allWidgets.length === 0) {
        // Release lock
        this.isSaving = false;
        // Process next queued save if any
        this.processSaveQueue();
        resolve();
        return;
      }

      // Save all widgets in parallel for better performance
      const savePromises = allWidgets.map(widget => 
        widget.savePending().catch((error: Error) => {
          // Collect error but continue saving other widgets
          console.error(`Failed to save widget ${widget.widgetId}:`, error);
          return { widgetId: widget.widgetId, error: error instanceof Error ? error : new Error(String(error)) };
        })
      );

      Promise.all(savePromises)
        .then((results) => {
          // Release lock
          this.isSaving = false;
          
          // Process next queued save if any
          this.processSaveQueue();
          
          // Check for errors
          const saveErrors = results.filter((r): r is { widgetId: string; error: Error } => {
            return r !== undefined && typeof r === 'object' && r !== null && 'error' in r;
          });
          
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
   * Preserves original intent (save specific page vs save all)
   */
  private processSaveQueue(): void {
    if (this.saveQueue.length > 0 && !this.isSaving) {
      const nextSave = this.saveQueue.shift();
      if (nextSave) {
        if (nextSave.pageId !== null) {
          // Save specific page
          this.saveActivePageWidgets(nextSave.pageId)
            .then(() => nextSave.resolve())
            .catch((error) => nextSave.reject(error));
        } else {
          // Save all widgets
          this.saveAllPendingChanges()
            .then(() => nextSave.resolve())
            .catch((error) => nextSave.reject(error));
        }
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
    this.widgetContainersByPage.clear();
    this.widgetContainersById.clear();
    this.saveQueue = [];
    this.isSaving = false;
  }
}

