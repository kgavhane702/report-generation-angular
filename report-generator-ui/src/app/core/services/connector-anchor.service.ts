import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';

import { AppState } from '../../store/app.state';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { WidgetEntity } from '../../store/document/document.state';

/**
 * Anchor point position on a widget
 */
export interface AnchorPoint {
  position: 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'top-left';
  xPercent: number;
  yPercent: number;
}

/**
 * Anchor attachment info stored in connector props
 */
export interface AnchorAttachment {
  widgetId: string;
  anchor: AnchorPoint['position'];
}

/**
 * Result of finding the nearest anchor
 */
export interface NearestAnchorResult {
  widgetId: string;
  anchor: AnchorPoint['position'];
  x: number;
  y: number;
  distance: number;
}

/**
 * ConnectorAnchorService
 * 
 * Centralized service for connector anchor point management.
 * Handles finding anchors across all widgets and snapping logic.
 */
@Injectable({
  providedIn: 'root',
})
export class ConnectorAnchorService {
  private readonly store = inject(Store<AppState>);
  
  /**
   * Snap threshold in pixels
   */
  readonly SNAP_THRESHOLD = 20;
  
  /**
   * All 8 anchor positions on a widget
   */
  readonly anchorPositions: AnchorPoint[] = [
    { position: 'top', xPercent: 50, yPercent: 0 },
    { position: 'top-right', xPercent: 100, yPercent: 0 },
    { position: 'right', xPercent: 100, yPercent: 50 },
    { position: 'bottom-right', xPercent: 100, yPercent: 100 },
    { position: 'bottom', xPercent: 50, yPercent: 100 },
    { position: 'bottom-left', xPercent: 0, yPercent: 100 },
    { position: 'left', xPercent: 0, yPercent: 50 },
    { position: 'top-left', xPercent: 0, yPercent: 0 },
  ];
  
  /** Widget entities */
  private readonly widgetEntities = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Dictionary<WidgetEntity> }
  );
  
  /** Widget IDs by page ID */
  private readonly widgetIdsByPageId = toSignal(
    this.store.select(DocumentSelectors.selectWidgetIdsByPageId),
    { initialValue: {} as Record<string, string[]> }
  );
  
  /**
   * Get absolute position of an anchor on a widget
   */
  getAnchorAbsolutePosition(widget: WidgetEntity, anchor: AnchorPoint): { x: number; y: number } {
    return {
      x: widget.position.x + (anchor.xPercent / 100) * widget.size.width,
      y: widget.position.y + (anchor.yPercent / 100) * widget.size.height,
    };
  }
  
  /**
   * Get absolute position of a specific anchor on a widget by ID
   */
  getAnchorPositionByWidgetId(widgetId: string, anchorPosition: AnchorPoint['position']): { x: number; y: number } | null {
    const widget = this.widgetEntities()[widgetId];
    if (!widget) return null;
    
    const anchor = this.anchorPositions.find(a => a.position === anchorPosition);
    if (!anchor) return null;
    
    return this.getAnchorAbsolutePosition(widget, anchor);
  }
  
  /**
   * Find the nearest anchor point across all widgets on a page
   * @param pageId The page to search on
   * @param position The current position of the connector endpoint
   * @param excludeWidgetId Widget to exclude (the connector itself)
   */
  findNearestAnchor(
    pageId: string, 
    position: { x: number; y: number },
    excludeWidgetId: string
  ): NearestAnchorResult | null {
    const widgetIds = this.widgetIdsByPageId()[pageId] || [];
    const entities = this.widgetEntities();
    
    let nearest: NearestAnchorResult | null = null;
    
    for (const widgetId of widgetIds) {
      // Skip the connector itself
      if (widgetId === excludeWidgetId) continue;
      
      const widget = entities[widgetId];
      if (!widget) continue;
      
      // Skip other connectors
      if (widget.type === 'connector') continue;
      
      // Check all anchor points on this widget
      for (const anchor of this.anchorPositions) {
        const anchorPos = this.getAnchorAbsolutePosition(widget, anchor);
        const distance = Math.sqrt(
          Math.pow(position.x - anchorPos.x, 2) + Math.pow(position.y - anchorPos.y, 2)
        );
        
        if (distance <= this.SNAP_THRESHOLD) {
          if (!nearest || distance < nearest.distance) {
            nearest = {
              widgetId,
              anchor: anchor.position,
              x: anchorPos.x,
              y: anchorPos.y,
              distance,
            };
          }
        }
      }
    }
    
    return nearest;
  }
  
  /**
   * Calculate the current position of a connector endpoint based on its attachment.
   * If attached to a widget, returns the anchor's current position.
   * If not attached, returns null.
   */
  getAttachedEndpointPosition(attachment: AnchorAttachment | null | undefined): { x: number; y: number } | null {
    if (!attachment) return null;
    return this.getAnchorPositionByWidgetId(attachment.widgetId, attachment.anchor);
  }
  
  /**
   * Find all connectors on a page that are attached to a specific widget.
   * Returns the connector IDs and which endpoint is attached.
   */
  findConnectorsAttachedToWidget(
    pageId: string,
    targetWidgetId: string
  ): Array<{ connectorId: string; endpoint: 'start' | 'end'; attachment: AnchorAttachment }> {
    const widgetIds = this.widgetIdsByPageId()[pageId] || [];
    const entities = this.widgetEntities();
    const results: Array<{ connectorId: string; endpoint: 'start' | 'end'; attachment: AnchorAttachment }> = [];
    
    for (const widgetId of widgetIds) {
      const widget = entities[widgetId];
      if (!widget || widget.type !== 'connector') continue;
      
      const props = widget.props as any;
      
      // Check start attachment
      if (props?.startAttachment?.widgetId === targetWidgetId) {
        results.push({
          connectorId: widgetId,
          endpoint: 'start',
          attachment: props.startAttachment,
        });
      }
      
      // Check end attachment
      if (props?.endAttachment?.widgetId === targetWidgetId) {
        results.push({
          connectorId: widgetId,
          endpoint: 'end',
          attachment: props.endAttachment,
        });
      }
    }
    
    return results;
  }
}
