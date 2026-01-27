import { Injectable, inject, computed } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

import { EditorStateService } from './editor-state.service';
import type { ObjectWidgetProps, WidgetModel } from '../../models/widget.model';

export interface ObjectToolbarState {
  widgetId: string | null;
  props: ObjectWidgetProps | null;
}

/**
 * ObjectToolbarService
 * 
 * Manages the state and actions for the object widget toolbar.
 * Tracks the currently selected object widget and provides methods
 * to update its properties (shape type, fill color, stroke, opacity, etc.).
 */
@Injectable({
  providedIn: 'root',
})
export class ObjectToolbarService {
  private readonly editorState = inject(EditorStateService);

  /** Current object widget being edited */
  private readonly _state = new BehaviorSubject<ObjectToolbarState>({
    widgetId: null,
    props: null,
  });

  readonly state$ = this._state.asObservable();

  /** Property change requests - emits when props should change */
  private readonly _propsChange = new Subject<{
    widgetId: string;
    changes: Partial<ObjectWidgetProps>;
  }>();
  readonly propsChange$ = this._propsChange.asObservable();

  /** Computed: active object widget from editor state */
  readonly activeObjectWidget = computed<WidgetModel | null>(() => {
    const widget = this.editorState.activeWidget();
    return widget?.type === 'object' ? widget : null;
  });

  /** Computed: props from active object widget */
  readonly activeProps = computed<ObjectWidgetProps | null>(() => {
    const widget = this.activeObjectWidget();
    return widget ? (widget.props as ObjectWidgetProps) : null;
  });

  /** Computed: is object widget active */
  readonly isActive = computed<boolean>(() => {
    return this.activeObjectWidget() !== null;
  });

  /**
   * Activate the toolbar for a specific object widget
   */
  activate(widgetId: string, props: ObjectWidgetProps): void {
    this._state.next({ widgetId, props });
  }

  /**
   * Deactivate the toolbar
   */
  deactivate(): void {
    this._state.next({ widgetId: null, props: null });
  }

  /**
   * Update props in the toolbar state (for UI sync)
   */
  updateProps(props: ObjectWidgetProps): void {
    const current = this._state.value;
    if (current.widgetId) {
      this._state.next({ ...current, props });
    }
  }

  /**
   * Request props change from toolbar
   */
  requestPropsChange(widgetId: string, changes: Partial<ObjectWidgetProps>): void {
    this._propsChange.next({ widgetId, changes });
  }

  /**
   * Get current state
   */
  getState(): ObjectToolbarState {
    return this._state.value;
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  updateShapeType(widgetId: string, shapeType: string): void {
    this.requestPropsChange(widgetId, { shapeType });
  }

  updateFillColor(widgetId: string, fillColor: string): void {
    this.requestPropsChange(widgetId, { fillColor });
  }

  updateOpacity(widgetId: string, opacity: number): void {
    this.requestPropsChange(widgetId, { opacity: Math.min(100, Math.max(0, opacity)) });
  }

  updateStroke(
    widgetId: string,
    stroke: { color: string; width: number; style?: 'solid' | 'dashed' | 'dotted' }
  ): void {
    this.requestPropsChange(widgetId, { stroke });
  }

  updateBorderRadius(widgetId: string, borderRadius: number): void {
    this.requestPropsChange(widgetId, { borderRadius: Math.max(0, borderRadius) });
  }

  updateTextAlign(widgetId: string, textAlign: 'left' | 'center' | 'right'): void {
    this.requestPropsChange(widgetId, { textAlign });
  }

  updateVerticalAlign(widgetId: string, verticalAlign: 'top' | 'middle' | 'bottom'): void {
    this.requestPropsChange(widgetId, { verticalAlign });
  }

  updatePadding(widgetId: string, padding: number): void {
    this.requestPropsChange(widgetId, { padding: Math.max(0, padding) });
  }
}
