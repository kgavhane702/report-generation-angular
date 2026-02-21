import type { GraphDocument } from './graph-document.model';

export interface GraphAdjacencyIndex {
  outgoingByNodeId: Record<string, string[]>;
  incomingByNodeId: Record<string, string[]>;
  connectorsByWidgetId: Record<string, string[]>;
}

export interface GraphSpatialIndex {
  bucketSizePx: number;
  buckets: Record<string, string[]>;
}

export interface GraphSpatialBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GraphIndexedDocument {
  graph: GraphDocument;
  adjacency: GraphAdjacencyIndex;
  spatial: GraphSpatialIndex;
}
