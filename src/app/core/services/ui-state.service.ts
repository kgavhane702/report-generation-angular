import { Injectable, signal, computed } from '@angular/core';

/**
 * UIStateService
 * 
 * Manages transient UI state that is NOT persisted to the document.
 * This separates UI concerns from document data.
 * 
 * Key difference from EditorStateService:
 * - EditorStateService: Navigation state (which section/page is active)
 * - UIStateService: Interaction state (what's being dragged, selected, etc.)
 * 
 * This state is:
 * - Not saved to the document
 * - Not part of NgRx store
 * - Reset on page refresh
 * - Used for UI interactions only
 */
@Injectable({
  providedIn: 'root',
})
export class UIStateService {
  // ============================================
  // SELECTION STATE
  // ============================================
  
  /**
   * Currently selected widget ID (single selection)
   */
  private readonly _activeWidgetId = signal<string | null>(null);
  readonly activeWidgetId = this._activeWidgetId.asReadonly();
  
  /**
   * Set of selected widget IDs (multi-selection)
   */
  private readonly _selectedWidgetIds = signal<Set<string>>(new Set());
  readonly selectedWidgetIds = this._selectedWidgetIds.asReadonly();
  
  /**
   * Check if a specific widget is selected
   */
  isWidgetSelected(widgetId: string): boolean {
    return this._selectedWidgetIds().has(widgetId) || this._activeWidgetId() === widgetId;
  }
  
  /**
   * Select a single widget (clears multi-selection)
   */
  selectWidget(widgetId: string | null): void {
    this._activeWidgetId.set(widgetId);
    this._selectedWidgetIds.set(new Set(widgetId ? [widgetId] : []));
  }
  
  /**
   * Add widget to multi-selection
   */
  addToSelection(widgetId: string): void {
    const current = new Set(this._selectedWidgetIds());
    current.add(widgetId);
    this._selectedWidgetIds.set(current);
    
    // Also set as active widget
    this._activeWidgetId.set(widgetId);
  }
  
  /**
   * Remove widget from selection
   */
  removeFromSelection(widgetId: string): void {
    const current = new Set(this._selectedWidgetIds());
    current.delete(widgetId);
    this._selectedWidgetIds.set(current);
    
    // Update active widget if it was removed
    if (this._activeWidgetId() === widgetId) {
      const remaining = Array.from(current);
      this._activeWidgetId.set(remaining[0] ?? null);
    }
  }
  
  /**
   * Toggle widget in selection
   */
  toggleSelection(widgetId: string): void {
    if (this._selectedWidgetIds().has(widgetId)) {
      this.removeFromSelection(widgetId);
    } else {
      this.addToSelection(widgetId);
    }
  }
  
  /**
   * Clear all selection
   */
  clearSelection(): void {
    this._activeWidgetId.set(null);
    this._selectedWidgetIds.set(new Set());
  }
  
  /**
   * Select multiple widgets at once
   */
  selectMultiple(widgetIds: string[]): void {
    this._selectedWidgetIds.set(new Set(widgetIds));
    this._activeWidgetId.set(widgetIds[0] ?? null);
  }
  
  // ============================================
  // INTERACTION STATE
  // ============================================
  
  /**
   * Widget currently being dragged
   */
  private readonly _draggingWidgetId = signal<string | null>(null);
  readonly draggingWidgetId = this._draggingWidgetId.asReadonly();
  
  /**
   * Widget currently being resized
   */
  private readonly _resizingWidgetId = signal<string | null>(null);
  readonly resizingWidgetId = this._resizingWidgetId.asReadonly();
  
  /**
   * Widget currently being edited (e.g., text widget with cursor)
   */
  private readonly _editingWidgetId = signal<string | null>(null);
  readonly editingWidgetId = this._editingWidgetId.asReadonly();
  
  /**
   * Check if any widget is being interacted with
   */
  readonly isInteracting = computed(() => 
    this._draggingWidgetId() !== null || 
    this._resizingWidgetId() !== null
  );

  // ============================================
  // GUIDES / SNAPPING (PPT/Canva-like)
  // ============================================

  private readonly _guidesEnabled = signal<boolean>(true);
  readonly guidesEnabled = this._guidesEnabled.asReadonly();

  // IMPORTANT: default snapping OFF to avoid any regressions in drag/drop & resize behavior.
  private readonly _guidesSnapEnabled = signal<boolean>(false);
  readonly guidesSnapEnabled = this._guidesSnapEnabled.asReadonly();

  private readonly _guidesSnapThresholdPx = signal<number>(6);
  readonly guidesSnapThresholdPx = this._guidesSnapThresholdPx.asReadonly();

  setGuidesEnabled(enabled: boolean): void {
    this._guidesEnabled.set(!!enabled);
  }

  setGuidesSnapEnabled(enabled: boolean): void {
    this._guidesSnapEnabled.set(!!enabled);
  }

  setGuidesSnapThresholdPx(px: number): void {
    const v = Number(px);
    this._guidesSnapThresholdPx.set(Number.isFinite(v) ? Math.max(1, Math.min(24, Math.round(v))) : 6);
  }
  
  /**
   * Start dragging a widget
   */
  startDragging(widgetId: string): void {
    this._draggingWidgetId.set(widgetId);
  }
  
  /**
   * Stop dragging
   */
  stopDragging(): void {
    this._draggingWidgetId.set(null);
  }
  
  /**
   * Start resizing a widget
   */
  startResizing(widgetId: string): void {
    this._resizingWidgetId.set(widgetId);
  }
  
  /**
   * Stop resizing
   */
  stopResizing(): void {
    this._resizingWidgetId.set(null);
  }
  
  /**
   * Start editing a widget
   */
  startEditing(widgetId: string): void {
    this._editingWidgetId.set(widgetId);
  }
  
  /**
   * Stop editing
   */
  stopEditing(widgetId?: string): void {
    // If a widget id is provided, only stop editing if that widget is the current one.
    if (widgetId && this._editingWidgetId() !== widgetId) {
      return;
    }
    this._editingWidgetId.set(null);
  }
  
  /**
   * Check if a specific widget is being dragged
   */
  isDragging(widgetId: string): boolean {
    return this._draggingWidgetId() === widgetId;
  }
  
  /**
   * Check if a specific widget is being resized
   */
  isResizing(widgetId: string): boolean {
    return this._resizingWidgetId() === widgetId;
  }
  
  /**
   * Check if a specific widget is being edited
   */
  isEditing(widgetId: string): boolean {
    return this._editingWidgetId() === widgetId;
  }
  
  // ============================================
  // ZOOM STATE
  // ============================================
  
  /**
   * Current zoom level (percentage, e.g., 100 = 100%)
   */
  private readonly _zoomLevel = signal<number>(100);
  readonly zoomLevel = this._zoomLevel.asReadonly();
  
  /**
   * Predefined zoom steps
   */
  private readonly zoomSteps = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400];
  
  /**
   * Set zoom level (clamped between 10% and 400%)
   */
  setZoom(zoom: number): void {
    const clamped = Math.max(10, Math.min(400, zoom));
    this._zoomLevel.set(clamped);
  }
  
  /**
   * Zoom in to next step
   */
  zoomIn(): void {
    const current = this._zoomLevel();
    const next = this.zoomSteps.find(step => step > current) ?? 400;
    this.setZoom(next);
  }
  
  /**
   * Zoom out to previous step
   */
  zoomOut(): void {
    const current = this._zoomLevel();
    const prev = [...this.zoomSteps].reverse().find(step => step < current) ?? 25;
    this.setZoom(prev);
  }
  
  /**
   * Reset zoom to 100%
   */
  resetZoom(): void {
    this.setZoom(100);
  }
  
  // ============================================
  // HOVER STATE
  // ============================================
  
  /**
   * Widget currently being hovered
   */
  private readonly _hoveredWidgetId = signal<string | null>(null);
  readonly hoveredWidgetId = this._hoveredWidgetId.asReadonly();
  
  /**
   * Set hovered widget
   */
  setHoveredWidget(widgetId: string | null): void {
    this._hoveredWidgetId.set(widgetId);
  }
  
  // ============================================
  // CLIPBOARD STATE
  // ============================================
  
  /**
   * IDs of widgets that have been copied
   */
  private readonly _copiedWidgetIds = signal<string[]>([]);
  readonly copiedWidgetIds = this._copiedWidgetIds.asReadonly();
  
  /**
   * Whether clipboard has content
   */
  readonly hasClipboardContent = computed(() => this._copiedWidgetIds().length > 0);
  
  /**
   * Set copied widgets
   */
  setCopiedWidgets(widgetIds: string[]): void {
    this._copiedWidgetIds.set(widgetIds);
  }
  
  /**
   * Clear clipboard
   */
  clearClipboard(): void {
    this._copiedWidgetIds.set([]);
  }
  
  // ============================================
  // CONTEXT MENU STATE
  // ============================================
  
  /**
   * Context menu position and visibility
   */
  private readonly _contextMenu = signal<{
    visible: boolean;
    x: number;
    y: number;
    targetWidgetId: string | null;
  }>({ visible: false, x: 0, y: 0, targetWidgetId: null });
  readonly contextMenu = this._contextMenu.asReadonly();
  
  /**
   * Show context menu at position
   */
  showContextMenu(x: number, y: number, targetWidgetId: string | null = null): void {
    this._contextMenu.set({ visible: true, x, y, targetWidgetId });
  }
  
  /**
   * Hide context menu
   */
  hideContextMenu(): void {
    this._contextMenu.set({ visible: false, x: 0, y: 0, targetWidgetId: null });
  }
  
  // ============================================
  // UTILITY METHODS
  // ============================================
  
  /**
   * Reset all UI state (e.g., when switching documents)
   */
  resetAll(): void {
    this.clearSelection();
    this.stopDragging();
    this.stopResizing();
    this.stopEditing();
    this.setHoveredWidget(null);
    this.hideContextMenu();
    // Don't reset zoom or clipboard
  }
}
