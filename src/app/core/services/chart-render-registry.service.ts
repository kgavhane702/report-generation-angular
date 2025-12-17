import { Injectable, signal, computed } from '@angular/core';
import { Subject, firstValueFrom, filter, take, race, of, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

/**
 * Chart render state tracking
 */
export interface ChartRenderState {
  widgetId: string;
  status: 'pending' | 'rendering' | 'rendered' | 'error';
  subsectionId?: string;
  pageId?: string;
  error?: string;
}

/**
 * ChartRenderRegistry - Tracks chart widget render states
 * 
 * This service provides a signaling mechanism for charts to report
 * their render completion status. Used by the export system to ensure
 * all charts are fully rendered before PDF generation.
 * 
 * Architecture:
 * - Charts register when created, unregister when destroyed
 * - Charts signal 'rendered' when ECharts/ChartJS completes rendering
 * - Export service can wait for all charts or specific charts to render
 * - No timeouts - uses reactive signals and promises
 */
@Injectable({
  providedIn: 'root',
})
export class ChartRenderRegistry {
  // Track all registered charts and their states
  private readonly _chartStates = signal<Map<string, ChartRenderState>>(new Map());
  
  // Event stream for state changes
  private readonly _stateChange$ = new Subject<{ widgetId: string; state: ChartRenderState }>();
  
  // Export mode flag - when true, charts should force render even if not visible
  private readonly _exportMode = signal<boolean>(false);
  
  // Export completion signal
  private readonly _exportComplete$ = new Subject<void>();
  
  /**
   * Read-only signal of chart states
   */
  readonly chartStates = this._chartStates.asReadonly();
  
  /**
   * Observable of state changes
   */
  readonly stateChange$ = this._stateChange$.asObservable();
  
  /**
   * Whether export mode is active
   */
  readonly exportMode = this._exportMode.asReadonly();
  
  /**
   * Computed signal: all registered widget IDs
   */
  readonly registeredWidgetIds = computed(() => {
    return Array.from(this._chartStates().keys());
  });
  
  /**
   * Computed signal: count of pending charts
   */
  readonly pendingCount = computed(() => {
    let count = 0;
    this._chartStates().forEach(state => {
      if (state.status === 'pending' || state.status === 'rendering') {
        count++;
      }
    });
    return count;
  });
  
  /**
   * Computed signal: all charts are rendered
   */
  readonly allRendered = computed(() => {
    const states = this._chartStates();
    if (states.size === 0) return true;
    
    for (const state of states.values()) {
      if (state.status !== 'rendered' && state.status !== 'error') {
        return false;
      }
    }
    return true;
  });
  
  /**
   * Register a chart widget for tracking
   */
  register(widgetId: string, subsectionId?: string, pageId?: string): void {
    const states = new Map(this._chartStates());
    const state: ChartRenderState = {
      widgetId,
      status: 'pending',
      subsectionId,
      pageId,
    };
    states.set(widgetId, state);
    this._chartStates.set(states);
    this._stateChange$.next({ widgetId, state });
  }
  
  /**
   * Unregister a chart widget (on destroy)
   */
  unregister(widgetId: string): void {
    const states = new Map(this._chartStates());
    states.delete(widgetId);
    this._chartStates.set(states);
  }
  
  /**
   * Mark a chart as currently rendering
   */
  markRendering(widgetId: string): void {
    this.updateState(widgetId, 'rendering');
  }
  
  /**
   * Mark a chart as successfully rendered
   */
  markRendered(widgetId: string): void {
    this.updateState(widgetId, 'rendered');
  }
  
  /**
   * Mark a chart render as failed
   */
  markError(widgetId: string, error?: string): void {
    this.updateState(widgetId, 'error', error);
  }
  
  /**
   * Reset a chart to pending state (for re-render)
   */
  resetToPending(widgetId: string): void {
    this.updateState(widgetId, 'pending');
  }
  
  /**
   * Reset all charts to pending state
   */
  resetAllToPending(): void {
    const states = new Map(this._chartStates());
    states.forEach((state, widgetId) => {
      states.set(widgetId, { ...state, status: 'pending' });
    });
    this._chartStates.set(states);
  }
  
  private updateState(widgetId: string, status: ChartRenderState['status'], error?: string): void {
    const states = new Map(this._chartStates());
    const existing = states.get(widgetId);
    if (existing) {
      const updated = { ...existing, status, error };
      states.set(widgetId, updated);
      this._chartStates.set(states);
      this._stateChange$.next({ widgetId, state: updated });
    }
  }
  
  /**
   * Get state for a specific chart
   */
  getState(widgetId: string): ChartRenderState | undefined {
    return this._chartStates().get(widgetId);
  }
  
  /**
   * Check if a specific chart is rendered
   */
  isRendered(widgetId: string): boolean {
    const state = this._chartStates().get(widgetId);
    return state?.status === 'rendered';
  }
  
  /**
   * Get charts for a specific subsection
   */
  getChartsForSubsection(subsectionId: string): ChartRenderState[] {
    const result: ChartRenderState[] = [];
    this._chartStates().forEach(state => {
      if (state.subsectionId === subsectionId) {
        result.push(state);
      }
    });
    return result;
  }
  
  /**
   * Enter export mode - signals charts to force render
   */
  enterExportMode(): void {
    this._exportMode.set(true);
  }
  
  /**
   * Exit export mode
   */
  exitExportMode(): void {
    this._exportMode.set(false);
    this._exportComplete$.next();
  }
  
  /**
   * Wait for a specific chart to render (Promise-based, no timeout)
   * Uses reactive stream - resolves when chart signals rendered
   */
  waitForChart(widgetId: string): Promise<ChartRenderState> {
    const currentState = this._chartStates().get(widgetId);
    
    // Already rendered
    if (currentState?.status === 'rendered' || currentState?.status === 'error') {
      return Promise.resolve(currentState);
    }
    
    // Wait for state change
    return firstValueFrom(
      this._stateChange$.pipe(
        filter(({ widgetId: id, state }) => 
          id === widgetId && (state.status === 'rendered' || state.status === 'error')
        ),
        take(1),
        map(({ state }) => state)
      )
    );
  }
  
  /**
   * Wait for all registered charts to render
   * Returns when all charts signal rendered or error
   */
  waitForAllCharts(): Promise<Map<string, ChartRenderState>> {
    // If already all rendered, return immediately
    if (this.allRendered()) {
      return Promise.resolve(new Map(this._chartStates()));
    }
    
    // Wait for all charts
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this.allRendered()) {
          resolve(new Map(this._chartStates()));
          return true;
        }
        return false;
      };
      
      // Already complete
      if (checkComplete()) return;
      
      // Subscribe to state changes
      const subscription = this._stateChange$.subscribe(() => {
        if (checkComplete()) {
          subscription.unsubscribe();
        }
      });
    });
  }
  
  /**
   * Wait for specific chart IDs to render
   */
  async waitForCharts(widgetIds: string[]): Promise<Map<string, ChartRenderState>> {
    const results = new Map<string, ChartRenderState>();
    
    await Promise.all(
      widgetIds.map(async (id) => {
        const state = await this.waitForChart(id);
        results.set(id, state);
      })
    );
    
    return results;
  }
  
  /**
   * Clear all registered charts (for cleanup)
   */
  clear(): void {
    this._chartStates.set(new Map());
    this._exportMode.set(false);
  }
  
  /**
   * Get count of registered charts
   */
  get count(): number {
    return this._chartStates().size;
  }
}
