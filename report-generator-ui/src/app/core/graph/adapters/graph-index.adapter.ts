import type { GraphDocument, GraphNode } from '../models/graph-document.model';
import type {
  GraphAdjacencyIndex,
  GraphIndexedDocument,
  GraphSpatialBounds,
  GraphSpatialIndex,
} from '../models/graph-index.model';

const DEFAULT_BUCKET_SIZE_PX = 256;

function pushUnique(map: Record<string, string[]>, key: string, value: string): void {
  const next = map[key] ?? [];
  if (next.includes(value)) {
    map[key] = next;
    return;
  }
  map[key] = [...next, value];
}

export function buildGraphAdjacencyIndex(graph: GraphDocument): GraphAdjacencyIndex {
  const outgoingByNodeId: Record<string, string[]> = {};
  const incomingByNodeId: Record<string, string[]> = {};
  const connectorsByWidgetId: Record<string, string[]> = {};

  for (const edge of graph.connectorEdges) {
    pushUnique(outgoingByNodeId, edge.fromWidgetId, edge.toWidgetId);
    pushUnique(incomingByNodeId, edge.toWidgetId, edge.fromWidgetId);
    pushUnique(connectorsByWidgetId, edge.fromWidgetId, edge.connectorWidgetId);
    pushUnique(connectorsByWidgetId, edge.toWidgetId, edge.connectorWidgetId);
  }

  return {
    outgoingByNodeId,
    incomingByNodeId,
    connectorsByWidgetId,
  };
}

function toBucketRange(min: number, max: number, bucketSizePx: number): { start: number; end: number } {
  return {
    start: Math.floor(min / bucketSizePx),
    end: Math.floor(max / bucketSizePx),
  };
}

function indexNodeIntoBuckets(
  buckets: Record<string, string[]>,
  node: GraphNode,
  bucketSizePx: number
): void {
  const minX = node.x;
  const maxX = node.x + node.width;
  const minY = node.y;
  const maxY = node.y + node.height;

  const xRange = toBucketRange(minX, maxX, bucketSizePx);
  const yRange = toBucketRange(minY, maxY, bucketSizePx);

  for (let bx = xRange.start; bx <= xRange.end; bx++) {
    for (let by = yRange.start; by <= yRange.end; by++) {
      const key = `${bx}:${by}`;
      pushUnique(buckets, key, node.id);
    }
  }
}

export function buildGraphSpatialIndex(
  graph: GraphDocument,
  bucketSizePx: number = DEFAULT_BUCKET_SIZE_PX
): GraphSpatialIndex {
  const buckets: Record<string, string[]> = {};

  for (const node of graph.nodes) {
    indexNodeIntoBuckets(buckets, node, bucketSizePx);
  }

  return {
    bucketSizePx,
    buckets,
  };
}

export function buildGraphIndexes(graph: GraphDocument): GraphIndexedDocument {
  return {
    graph,
    adjacency: buildGraphAdjacencyIndex(graph),
    spatial: buildGraphSpatialIndex(graph),
  };
}

export function getConnectedNodeIds(index: GraphAdjacencyIndex, nodeId: string): string[] {
  const incoming = index.incomingByNodeId[nodeId] ?? [];
  const outgoing = index.outgoingByNodeId[nodeId] ?? [];
  return Array.from(new Set([...incoming, ...outgoing]));
}

export function querySpatialNodeIds(index: GraphSpatialIndex, bounds: GraphSpatialBounds): string[] {
  const xRange = toBucketRange(bounds.minX, bounds.maxX, index.bucketSizePx);
  const yRange = toBucketRange(bounds.minY, bounds.maxY, index.bucketSizePx);
  const collected = new Set<string>();

  for (let bx = xRange.start; bx <= xRange.end; bx++) {
    for (let by = yRange.start; by <= yRange.end; by++) {
      const key = `${bx}:${by}`;
      for (const nodeId of index.buckets[key] ?? []) {
        collected.add(nodeId);
      }
    }
  }

  return Array.from(collected.values());
}
