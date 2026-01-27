import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks in-flight remote (URL-based) widget loads so the UI can disable export/PDF.
 *
 * This is session-only UI state (not persisted into the document).
 */
@Injectable({ providedIn: 'root' })
export class RemoteWidgetLoadRegistryService {
  private readonly _pendingWidgetIds = signal<Set<string>>(new Set());

  readonly pendingWidgetIds = this._pendingWidgetIds.asReadonly();
  readonly pendingCount = computed(() => this._pendingWidgetIds().size);

  start(widgetId: string): void {
    if (!widgetId) return;
    this._pendingWidgetIds.update((set) => {
      const next = new Set(set);
      next.add(widgetId);
      return next;
    });
  }

  stop(widgetId: string): void {
    if (!widgetId) return;
    this._pendingWidgetIds.update((set) => {
      if (!set.has(widgetId)) return set;
      const next = new Set(set);
      next.delete(widgetId);
      return next;
    });
  }

  isPending(widgetId: string): boolean {
    return this._pendingWidgetIds().has(widgetId);
  }

  clear(): void {
    this._pendingWidgetIds.set(new Set());
  }
}



