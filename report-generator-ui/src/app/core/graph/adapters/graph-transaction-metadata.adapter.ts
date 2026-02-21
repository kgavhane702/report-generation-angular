import type { GraphCommandTransaction } from '../models/graph-transaction.model';
import type { GraphConnectorEdge } from '../models/graph-document.model';
import { GRAPH_SCHEMA_VERSION_CURRENT, type GraphSchemaVersion } from '../models/graph-schema.model';

const GRAPH_METADATA_KEY = 'graph';

interface PersistedGraphMetadata {
  schemaVersion: GraphSchemaVersion;
  connectorEdges: GraphConnectorEdge[];
}

function readPersistedEdges(metadata: Record<string, unknown>): Map<string, GraphConnectorEdge> {
  const graph = metadata[GRAPH_METADATA_KEY] as any;
  const edges = Array.isArray(graph?.connectorEdges) ? graph.connectorEdges : [];
  const map = new Map<string, GraphConnectorEdge>();

  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') continue;
    const connectorWidgetId = String((edge as any).connectorWidgetId ?? '');
    const fromWidgetId = String((edge as any).fromWidgetId ?? '');
    const toWidgetId = String((edge as any).toWidgetId ?? '');
    if (!connectorWidgetId || !fromWidgetId || !toWidgetId) continue;

    map.set(connectorWidgetId, {
      id: String((edge as any).id ?? connectorWidgetId),
      kind: 'connector',
      connectorWidgetId,
      fromWidgetId,
      toWidgetId,
      ...(typeof (edge as any).fromAnchor === 'string' ? { fromAnchor: (edge as any).fromAnchor } : {}),
      ...(typeof (edge as any).toAnchor === 'string' ? { toAnchor: (edge as any).toAnchor } : {}),
    });
  }

  return map;
}

export function withGraphTransactionMetadata(
  metadata: Record<string, unknown> | undefined,
  transaction: GraphCommandTransaction,
  mode: 'before' | 'after'
): Record<string, unknown> {
  const baseMetadata = { ...(metadata ?? {}) };
  const edgeMap = readPersistedEdges(baseMetadata);
  const snapshots = mode === 'before' ? transaction.beforeEdges : transaction.afterEdges;

  for (const snapshot of snapshots) {
    const connectorWidgetId = snapshot.connectorWidgetId?.trim?.() ?? '';
    if (!connectorWidgetId) continue;

    const fromWidgetId = snapshot.fromWidgetId?.trim?.() ?? '';
    const toWidgetId = snapshot.toWidgetId?.trim?.() ?? '';

    if (!fromWidgetId || !toWidgetId) {
      edgeMap.delete(connectorWidgetId);
      continue;
    }

    edgeMap.set(connectorWidgetId, {
      id: connectorWidgetId,
      kind: 'connector',
      connectorWidgetId,
      fromWidgetId,
      toWidgetId,
      ...(snapshot.fromAnchor ? { fromAnchor: snapshot.fromAnchor } : {}),
      ...(snapshot.toAnchor ? { toAnchor: snapshot.toAnchor } : {}),
    });
  }

  return {
    ...baseMetadata,
    [GRAPH_METADATA_KEY]: {
      schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
      connectorEdges: Array.from(edgeMap.values()),
    } satisfies PersistedGraphMetadata,
  };
}
