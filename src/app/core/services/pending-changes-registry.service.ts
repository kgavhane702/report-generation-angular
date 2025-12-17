import { Injectable, signal, computed, NgZone, inject, ApplicationRef } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Interface for widgets that can have pending (uncommitted) changes
 * Any widget that delays committing changes (e.g., waits for blur) should implement this
 */
export interface FlushableWidget {
  /** Unique widget ID */
  widgetId: string;
  
  /** Whether this widget currently has uncommitted changes */
  hasPendingChanges(): boolean;
  
  /** 
   * Force commit all pending changes immediately
   * Should emit changes to parent/store synchronously
   */
  flush(): void;
}

/**
 * Pending change tracking info
 */
interface PendingChangeInfo {
  widgetId: string;
  widgetRef: FlushableWidget;
  registeredAt: number;
}

/**
 * PendingChangesRegistry
 * 
 * Tracks widgets that have uncommitted changes and provides a mechanism
 * to force all widgets to commit their changes before export/save operations.
 * 
 * Use Case:
 * - User is typing in a text editor
 * - User clicks "Export PDF" before the editor saves (on blur)
 * - This service ensures all pending changes are committed before export
 * 
 * Architecture:
 * - Widgets register when they start editing
 * - Widgets unregister when changes are committed
 * - Before export, call flushAll() to force all widgets to commit
 * - flushAll() waits for Angular to stabilize after commits
 */
@Injectable({
  providedIn: 'root',
})
export class PendingChangesRegistry {
  private readonly ngZone = inject(NgZone);
  private readonly appRef = inject(ApplicationRef);
  
  // Track all widgets with pending changes
  private readonly _pendingWidgets = signal<Map<string, PendingChangeInfo>>(new Map());
  
  // Event stream for state changes
  private readonly _stateChange$ = new Subject<{ widgetId: string; action: 'register' | 'unregister' | 'flush' }>();
  
  /**
   * Observable of state changes (for debugging/monitoring)
   */
  readonly stateChange$ = this._stateChange$.asObservable();
  
  /**
   * Computed: count of widgets with pending changes
   */
  readonly pendingCount = computed(() => this._pendingWidgets().size);
  
  /**
   * Computed: whether any widget has pending changes
   */
  readonly hasPendingChanges = computed(() => this._pendingWidgets().size > 0);
  
  /**
   * Computed: list of widget IDs with pending changes
   */
  readonly pendingWidgetIds = computed(() => Array.from(this._pendingWidgets().keys()));
  
  /**
   * Register a widget as having pending changes
   * Called when a widget starts editing (e.g., on focus)
   */
  register(widget: FlushableWidget): void {
    const widgets = new Map(this._pendingWidgets());
    widgets.set(widget.widgetId, {
      widgetId: widget.widgetId,
      widgetRef: widget,
      registeredAt: Date.now(),
    });
    this._pendingWidgets.set(widgets);
    this._stateChange$.next({ widgetId: widget.widgetId, action: 'register' });
    
    console.log('[PendingChanges] Registered:', widget.widgetId, 'Total pending:', widgets.size);
  }
  
  /**
   * Unregister a widget (changes have been committed)
   * Called when a widget finishes editing and commits changes
   */
  unregister(widgetId: string): void {
    const widgets = new Map(this._pendingWidgets());
    if (widgets.has(widgetId)) {
      widgets.delete(widgetId);
      this._pendingWidgets.set(widgets);
      this._stateChange$.next({ widgetId, action: 'unregister' });
      
      console.log('[PendingChanges] Unregistered:', widgetId, 'Total pending:', widgets.size);
    }
  }
  
  /**
   * Check if a specific widget is registered
   */
  isRegistered(widgetId: string): boolean {
    return this._pendingWidgets().has(widgetId);
  }
  
  /**
   * Flush a single widget's pending changes
   */
  flushWidget(widgetId: string): void {
    const info = this._pendingWidgets().get(widgetId);
    if (info && info.widgetRef.hasPendingChanges()) {
      console.log('[PendingChanges] Flushing widget:', widgetId);
      info.widgetRef.flush();
      this._stateChange$.next({ widgetId, action: 'flush' });
    }
  }
  
  /**
   * Flush ALL pending changes from all registered widgets
   * 
   * This is the main method to call before any export operation.
   * It:
   * 1. Calls flush() on each registered widget
   * 2. Triggers Angular change detection
   * 3. Waits for Angular zone to stabilize
   * 4. Returns when all changes are committed to the store
   * 
   * @returns Promise that resolves when all changes are committed
   */
  async flushAll(): Promise<void> {
    const widgets = this._pendingWidgets();
    
    if (widgets.size === 0) {
      console.log('[PendingChanges] No pending changes to flush');
      return;
    }
    
    console.log('[PendingChanges] Flushing all pending changes. Count:', widgets.size);
    
    // Flush each widget
    const flushedWidgets: string[] = [];
    widgets.forEach((info, widgetId) => {
      if (info.widgetRef.hasPendingChanges()) {
        console.log('[PendingChanges] Flushing:', widgetId);
        info.widgetRef.flush();
        flushedWidgets.push(widgetId);
      }
    });
    
    if (flushedWidgets.length === 0) {
      console.log('[PendingChanges] No widgets had actual pending changes');
      return;
    }
    
    // Force Angular change detection to propagate changes
    await this.waitForAngularStable();
    
    console.log('[PendingChanges] All changes flushed and propagated');
  }
  
  /**
   * Wait for Angular to fully stabilize
   * This ensures all change detection cycles are complete
   * and all store updates have propagated
   */
  private waitForAngularStable(): Promise<void> {
    return new Promise(resolve => {
      this.ngZone.run(() => {
        // Force change detection
        this.appRef.tick();
        
        // Wait for microtasks
        queueMicrotask(() => {
          // Force another change detection
          this.appRef.tick();
          
          // Wait for next frame to ensure DOM is updated
          requestAnimationFrame(() => {
            this.appRef.tick();
            resolve();
          });
        });
      });
    });
  }
  
  /**
   * Clear all registered widgets (for cleanup/testing)
   */
  clear(): void {
    this._pendingWidgets.set(new Map());
  }
}
