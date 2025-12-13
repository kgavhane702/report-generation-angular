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

  /**
   * Register a widget container so it can be saved when needed
   */
  registerWidgetContainer(
    widgetId: string,
    hasPendingChangesFn: () => boolean,
    saveFn: () => Promise<void>
  ): void {
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
   */
  hasAnyPendingChanges(): boolean {
    // Check both the status map and the container's pending changes
    const hasStatusUnsaved = Object.values(this.widgetSaveStatus).some(s => s.hasUnsavedChanges);
    const hasContainerPending = this.widgetContainers.some(w => w.hasPendingChanges());
    return hasStatusUnsaved || hasContainerPending;
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
   */
  saveAllPendingChanges(): Promise<void> {
    // Trigger save signal for widgets that listen via observable (legacy support)
    this.saveAllSubject.next();
    
    // Find all widgets with pending changes (both from status and containers)
    const unsavedWidgetIds = this.getUnsavedWidgetIds();
    const widgetsToSave = this.widgetContainers.filter(w => 
      w.hasPendingChanges() || unsavedWidgetIds.includes(w.widgetId)
    );
    
    if (widgetsToSave.length === 0) {
      return Promise.resolve();
    }

    // Save all widgets with pending changes sequentially for smooth operation
    return widgetsToSave.reduce((promise, widget) => {
      return promise.then(() => {
        return widget.savePending().then(() => {
          // Mark as saved after successful save
          this.markWidgetAsSaved(widget.widgetId);
        });
      });
    }, Promise.resolve());
  }
}

