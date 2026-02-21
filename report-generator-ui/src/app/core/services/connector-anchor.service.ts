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
import {
  querySpatialNodeIds,
} from '../graph/adapters/graph-index.adapter';
import type { GraphIndexedDocument } from '../graph/models/graph-index.model';
import { GRAPH_SCHEMA_VERSION_CURRENT, type GraphSchemaVersion } from '../graph/models/graph-schema.model';

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

type GraphConnectorEdge = {
  connectorWidgetId: string;
  fromWidgetId: string;
  toWidgetId: string;
  fromAnchor?: ConnectorAnchorAttachment['anchor'];
  toAnchor?: ConnectorAnchorAttachment['anchor'];
};

const CONNECTOR_ANCHOR_ORDER: ConnectorAnchorAttachment['anchor'][] = [
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
  'top-left',
];

const ANCHOR_UNIT_COORDS: Record<ConnectorAnchorAttachment['anchor'], { x: number; y: number }> = {
  top: { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  right: { x: 1, y: 0.5 },
  'bottom-right': { x: 1, y: 1 },
  bottom: { x: 0.5, y: 1 },
  'bottom-left': { x: 0, y: 1 },
  left: { x: 0, y: 0.5 },
  'top-left': { x: 0, y: 0 },
};

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

  /** Free-form document metadata (graph metadata may be present here). */
  private readonly documentMetadata = toSignal(
    this.store.select(DocumentSelectors.selectDocumentMetadata),
    { initialValue: {} as Record<string, unknown> }
  );

  /** Graph indexes (phase-5): adjacency + spatial buckets. */
  private readonly graphIndexes = toSignal(
    this.store.select(DocumentSelectors.selectGraphIndexes),
    { initialValue: null as GraphIndexedDocument | null }
  );

  private getSafeGraphIndexes(): GraphIndexedDocument | null {
    const index = this.graphIndexes() as GraphIndexedDocument | null | Record<string, unknown>;
    if (!index || typeof index !== 'object') {
      return null;
    }
    if (!('adjacency' in index) || !('spatial' in index) || !('graph' in index)) {
      return null;
    }
    return index as GraphIndexedDocument;
  }

  private readGraphEdgeForConnector(connectorWidgetId: string): GraphConnectorEdge | null {
    const metadata = this.documentMetadata();
    const graph = metadata?.['graph'] as any;
    const schemaVersion = String(graph?.schemaVersion ?? '') as GraphSchemaVersion;
    if (schemaVersion !== GRAPH_SCHEMA_VERSION_CURRENT) {
      return null;
    }
    const edges = graph?.connectorEdges;
    if (!Array.isArray(edges) || !connectorWidgetId) return null;

    const match = edges.find(
      (edge: any) => edge && typeof edge === 'object' && edge.connectorWidgetId === connectorWidgetId
    );
    if (!match) return null;

    return {
      connectorWidgetId: String(match.connectorWidgetId ?? ''),
      fromWidgetId: String(match.fromWidgetId ?? ''),
      toWidgetId: String(match.toWidgetId ?? ''),
      fromAnchor: match.fromAnchor,
      toAnchor: match.toAnchor,
    };
  }

  private attachmentFromGraph(edge: GraphConnectorEdge | null, endpoint: 'start' | 'end'): AnchorAttachment | null {
    if (!edge) return null;

    if (endpoint === 'start') {
      if (!edge.fromWidgetId || !edge.fromAnchor) return null;
      return { widgetId: edge.fromWidgetId, anchor: edge.fromAnchor };
    }

    if (!edge.toWidgetId || !edge.toAnchor) return null;
    return { widgetId: edge.toWidgetId, anchor: edge.toAnchor };
  }

  private toConnectorAnchor(position: string): ConnectorAnchorAttachment['anchor'] | null {
    return (CONNECTOR_ANCHOR_ORDER as string[]).includes(position)
      ? (position as ConnectorAnchorAttachment['anchor'])
      : null;
  }

  private pickClosestAnchor(
    target: ConnectorAnchorAttachment['anchor'],
    available: ConnectorAnchorAttachment['anchor'][]
  ): ConnectorAnchorAttachment['anchor'] {
    if (available.length === 0) {
      return target;
    }
    let best = available[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    const targetPoint = ANCHOR_UNIT_COORDS[target];
    for (const candidate of available) {
      const point = ANCHOR_UNIT_COORDS[candidate];
      const dx = point.x - targetPoint.x;
      const dy = point.y - targetPoint.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDistance) {
        bestDistance = dist;
        best = candidate;
      }
    }
    return best;
  }

  private repairAttachment(attachment: AnchorAttachment | null): AnchorAttachment | null {
    if (!attachment?.widgetId) return null;

    const persisted = this.widgetEntities()[attachment.widgetId];
    if (!persisted || persisted.type === 'connector') {
      return null;
    }

    const widget = this.draftState.getMergedWidget(attachment.widgetId, persisted) ?? persisted;
    const available = this.getAnchorsForWidget(widget)
      .map((anchor) => this.toConnectorAnchor(anchor.position))
      .filter((anchor): anchor is ConnectorAnchorAttachment['anchor'] => !!anchor);

    if (available.length === 0) {
      return null;
    }

    const anchor = available.includes(attachment.anchor)
      ? attachment.anchor
      : this.pickClosestAnchor(attachment.anchor, available);

    const dir = this.getAnchorDirectionForWidget(widget, anchor);
    return dir
      ? { widgetId: attachment.widgetId, anchor, dir }
      : { widgetId: attachment.widgetId, anchor };
  }

  getResolvedConnectorAttachments(
    connectorWidgetId: string,
    startAttachment: AnchorAttachment | null | undefined,
    endAttachment: AnchorAttachment | null | undefined
  ): { startAttachment: AnchorAttachment | null; endAttachment: AnchorAttachment | null } {
    const edge = this.readGraphEdgeForConnector(connectorWidgetId);
    const graphStart = this.attachmentFromGraph(edge, 'start');
    const graphEnd = this.attachmentFromGraph(edge, 'end');

    return {
      startAttachment: graphStart,
      endAttachment: graphEnd,
    };
  }

  getRepairedConnectorAttachments(
    connectorWidgetId: string,
    startAttachment: AnchorAttachment | null | undefined,
    endAttachment: AnchorAttachment | null | undefined
  ): { startAttachment: AnchorAttachment | null; endAttachment: AnchorAttachment | null } {
    const resolved = this.getResolvedConnectorAttachments(connectorWidgetId, startAttachment, endAttachment);
    return {
      startAttachment: this.repairAttachment(resolved.startAttachment),
      endAttachment: this.repairAttachment(resolved.endAttachment),
    };
  }
  
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
    const allWidgetIds = this.widgetIdsByPageId()[pageId] || [];
    const entities = this.widgetEntities();

    const graphIndexes = this.getSafeGraphIndexes();
    const spatialCandidateIds = graphIndexes
      ? querySpatialNodeIds(graphIndexes.spatial, {
          minX: position.x - this.SNAP_THRESHOLD,
          minY: position.y - this.SNAP_THRESHOLD,
          maxX: position.x + this.SNAP_THRESHOLD,
          maxY: position.y + this.SNAP_THRESHOLD,
        })
      : [];

    const widgetIds = spatialCandidateIds.length > 0
      ? spatialCandidateIds
      : allWidgetIds;
    
    let nearest: NearestAnchorResult | null = null;
    
    for (const widgetId of widgetIds) {
      // Skip the connector itself
      if (widgetId === excludeWidgetId) continue;
      
      const persisted = entities[widgetId];
      if (!persisted) continue;

      // In spatial-index mode, enforce page scope explicitly.
      if (persisted.pageId !== pageId) continue;
      
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

    const graphIndexes = this.getSafeGraphIndexes();
    const connectorIdsFromAdjacency = graphIndexes?.adjacency.connectorsByWidgetId[targetWidgetId];
    const connectorCandidateIds = Array.isArray(connectorIdsFromAdjacency)
      ? connectorIdsFromAdjacency
      : widgetIds;
    
    for (const widgetId of connectorCandidateIds) {
      const persisted = entities[widgetId];
      if (!persisted || persisted.type !== 'connector') continue;
      if (persisted.pageId !== pageId) continue;

      // Use draft-aware connector data so attachments set during drag are respected
      const widget = this.draftState.getMergedWidget(widgetId, persisted) ?? persisted;
      const props = widget.props as any;
      const resolved = this.getRepairedConnectorAttachments(
        widgetId,
        props?.startAttachment,
        props?.endAttachment
      );
      
      // Check start attachment
      if (resolved.startAttachment?.widgetId === targetWidgetId) {
        results.push({
          connectorId: widgetId,
          endpoint: 'start',
          attachment: resolved.startAttachment,
        });
      }
      
      // Check end attachment
      if (resolved.endAttachment?.widgetId === targetWidgetId) {
        results.push({
          connectorId: widgetId,
          endpoint: 'end',
          attachment: resolved.endAttachment,
        });
      }
    }
    
    return results;
  }
}
