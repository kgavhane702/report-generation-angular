import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';

import { AppState } from '../../store/app.state';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { WidgetEntity } from '../../store/document/document.state';
import { getShapeAnchors, ShapeAnchorPoint, getDefaultAnchors } from '../../features/editor/plugins/object/config/shape-anchor.config';
import { ObjectWidgetProps, type ConnectorAnchorAttachment } from '../../models/widget.model';
import { DraftStateService } from './draft-state.service';
import { getAnchorDirectionWithRotation, type AnchorDirection } from '../geometry/connector-elbow-routing';

/**
 * Anchor point position on a widget.
 * Position can be standard positions (top, right, etc.) or custom positions for specific shapes.
 */
export interface AnchorPoint {
  position: string;
  xPercent: number;
  yPercent: number;
}

/**
 * Anchor attachment info stored in connector props
 */
export interface AnchorAttachment {
  widgetId: string;
  anchor: ConnectorAnchorAttachment['anchor'];
  dir?: AnchorDirection;
}

/**
 * Result of finding the nearest anchor
 */
export interface NearestAnchorResult {
  widgetId: string;
  anchor: ConnectorAnchorAttachment['anchor'];
  x: number;
  y: number;
  distance: number;
  dir?: AnchorDirection;
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
  private readonly draftState = inject(DraftStateService);
  
  /**
   * Snap threshold in pixels
   */
  readonly SNAP_THRESHOLD = 20;
  
  /**
   * Default 8 anchor positions on a widget (for rectangular shapes).
   * For shape-specific anchors, use getAnchorsForWidget() instead.
   */
  readonly anchorPositions: AnchorPoint[] = getDefaultAnchors();
  
  /**
   * Get shape-specific anchor points for a widget.
   * Returns anchors positioned on the actual shape geometry rather than the bounding box.
   */
  getAnchorsForWidget(widget: WidgetEntity): AnchorPoint[] {
    if (widget.type === 'object') {
      const props = widget.props as ObjectWidgetProps;
      const shapeType = props?.shapeType || 'rectangle';
      return getShapeAnchors(shapeType) as AnchorPoint[];
    }
    // For non-object widgets (tables, charts, etc.), use default rectangular anchors
    return this.anchorPositions;
  }

  /**
   * Get the effective anchor exit direction for a widget, accounting for rotation.
   * Used by elbow routing to choose a sensible stub direction.
   */
  getAnchorDirectionForWidget(widget: WidgetEntity, anchor: string): AnchorDirection | null {
    return getAnchorDirectionWithRotation(anchor as any, widget.rotation ?? 0);
  }
  
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
   * Get absolute position of an anchor on a widget.
   * Accounts for widget rotation by rotating the anchor point around the widget center.
   */
  getAnchorAbsolutePosition(widget: WidgetEntity, anchor: AnchorPoint): { x: number; y: number } {
    // Calculate the unrotated position
    const localX = (anchor.xPercent / 100) * widget.size.width;
    const localY = (anchor.yPercent / 100) * widget.size.height;
    
    // Get widget center
    const centerX = widget.size.width / 2;
    const centerY = widget.size.height / 2;
    
    // Get rotation in radians
    const rotation = widget.rotation ?? 0;
    
    if (rotation === 0) {
      // No rotation, return simple calculation
      return {
        x: widget.position.x + localX,
        y: widget.position.y + localY,
      };
    }
    
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Translate to center, rotate, translate back
    const dx = localX - centerX;
    const dy = localY - centerY;
    
    const rotatedX = dx * cos - dy * sin + centerX;
    const rotatedY = dx * sin + dy * cos + centerY;
    
    return {
      x: widget.position.x + rotatedX,
      y: widget.position.y + rotatedY,
    };
  }
  
  /**
   * Get absolute position of a specific anchor on a widget by ID.
   * Uses shape-specific anchors for object widgets.
   * Uses draft-aware widget data to account for widgets being dragged/rotated.
   */
  getAnchorPositionByWidgetId(widgetId: string, anchorPosition: string): { x: number; y: number } | null {
    const persisted = this.widgetEntities()[widgetId];
    if (!persisted) return null;
    
    // Use draft-aware widget data
    const widget = this.draftState.getMergedWidget(widgetId, persisted) ?? persisted;
    
    // Get shape-specific anchors for this widget
    const anchors = this.getAnchorsForWidget(widget);
    const anchor = anchors.find(a => a.position === anchorPosition);
    if (!anchor) return null;
    
    return this.getAnchorAbsolutePosition(widget, anchor);
  }
  
  /**
   * Find the nearest anchor point across all widgets on a page.
   * Uses shape-specific anchor points for each widget.
   * Uses draft-aware widget data to account for widgets being dragged/rotated.
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
      
      const persisted = entities[widgetId];
      if (!persisted) continue;
      
      // Skip other connectors
      if (persisted.type === 'connector') continue;
      
      // Use draft-aware widget data to account for widgets being dragged/rotated
      const widget = this.draftState.getMergedWidget(widgetId, persisted) ?? persisted;
      
      // Get shape-specific anchor points for this widget
      const anchors = this.getAnchorsForWidget(widget);
      
      // Check all anchor points on this widget
      for (const anchor of anchors) {
        const anchorPos = this.getAnchorAbsolutePosition(widget, anchor);
        const anchorDir = this.getAnchorDirectionForWidget(widget, anchor.position);
        const distance = Math.sqrt(
          Math.pow(position.x - anchorPos.x, 2) + Math.pow(position.y - anchorPos.y, 2)
        );
        
        if (distance <= this.SNAP_THRESHOLD) {
          if (!nearest || distance < nearest.distance) {
            nearest = {
              widgetId,
              anchor: anchor.position as ConnectorAnchorAttachment['anchor'],
              x: anchorPos.x,
              y: anchorPos.y,
              distance,
              dir: anchorDir ?? undefined,
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
      const persisted = entities[widgetId];
      if (!persisted || persisted.type !== 'connector') continue;

      // Use draft-aware connector data so attachments set during drag are respected
      const widget = this.draftState.getMergedWidget(widgetId, persisted) ?? persisted;
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
