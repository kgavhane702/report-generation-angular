import type { GraphCommandTransaction } from '../models/graph-transaction.model';
import { GRAPH_SCHEMA_VERSION_CURRENT } from '../models/graph-schema.model';
import { withGraphTransactionMetadata } from './graph-transaction-metadata.adapter';

describe('graph-transaction-metadata.adapter', () => {
  const transaction: GraphCommandTransaction = {
    kind: 'widget-update',
    touchedWidgetIds: ['connector-1'],
    beforeEdges: [
      {
        connectorWidgetId: 'connector-1',
        fromWidgetId: 'shape-a',
        toWidgetId: 'shape-b',
        fromAnchor: 'right',
        toAnchor: 'left',
      },
    ],
    afterEdges: [
      {
        connectorWidgetId: 'connector-1',
        fromWidgetId: 'shape-a',
        toWidgetId: 'shape-c',
        fromAnchor: 'right',
        toAnchor: 'left',
      },
    ],
  };

  it('applies after snapshots to metadata graph edges', () => {
    const metadata = withGraphTransactionMetadata({}, transaction, 'after');
    const graph = metadata['graph'] as any;

    expect(graph.schemaVersion).toBe(GRAPH_SCHEMA_VERSION_CURRENT);
    expect(graph.connectorEdges.length).toBe(1);
    expect(graph.connectorEdges[0].toWidgetId).toBe('shape-c');
  });

  it('applies before snapshots for undo restoration', () => {
    const metadata = withGraphTransactionMetadata({}, transaction, 'before');
    const graph = metadata['graph'] as any;

    expect(graph.connectorEdges.length).toBe(1);
    expect(graph.connectorEdges[0].toWidgetId).toBe('shape-b');
  });

  it('removes connector edge when snapshot has detached endpoint', () => {
    const detached: GraphCommandTransaction = {
      ...transaction,
      afterEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: null,
          toWidgetId: 'shape-c',
        },
      ],
    };

    const seed = withGraphTransactionMetadata({}, transaction, 'after');
    const metadata = withGraphTransactionMetadata(seed, detached, 'after');
    const graph = metadata['graph'] as any;

    expect(graph.connectorEdges.length).toBe(0);
  });

  it('replays attach move detach transitions across after/before snapshots', () => {
    const attachTx: GraphCommandTransaction = {
      kind: 'widget-update',
      touchedWidgetIds: ['connector-1'],
      beforeEdges: [],
      afterEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: 'shape-a',
          toWidgetId: 'shape-b',
          fromAnchor: 'right',
          toAnchor: 'left',
        },
      ],
    };

    const moveTx: GraphCommandTransaction = {
      kind: 'widget-update',
      touchedWidgetIds: ['connector-1'],
      beforeEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: 'shape-a',
          toWidgetId: 'shape-b',
          fromAnchor: 'right',
          toAnchor: 'left',
        },
      ],
      afterEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: 'shape-a',
          toWidgetId: 'shape-c',
          fromAnchor: 'right',
          toAnchor: 'left',
        },
      ],
    };

    const detachTx: GraphCommandTransaction = {
      kind: 'widget-update',
      touchedWidgetIds: ['connector-1'],
      beforeEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: 'shape-a',
          toWidgetId: 'shape-c',
          fromAnchor: 'right',
          toAnchor: 'left',
        },
      ],
      afterEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: null,
          toWidgetId: null,
        },
      ],
    };

    let metadata: Record<string, unknown> = {};

    metadata = withGraphTransactionMetadata(metadata, attachTx, 'after');
    let graph = metadata['graph'] as any;
    expect(graph.connectorEdges.length).toBe(1);
    expect(graph.connectorEdges[0].toWidgetId).toBe('shape-b');

    metadata = withGraphTransactionMetadata(metadata, moveTx, 'after');
    graph = metadata['graph'] as any;
    expect(graph.connectorEdges.length).toBe(1);
    expect(graph.connectorEdges[0].toWidgetId).toBe('shape-c');

    metadata = withGraphTransactionMetadata(metadata, moveTx, 'before');
    graph = metadata['graph'] as any;
    expect(graph.connectorEdges.length).toBe(1);
    expect(graph.connectorEdges[0].toWidgetId).toBe('shape-b');

    metadata = withGraphTransactionMetadata(metadata, detachTx, 'after');
    graph = metadata['graph'] as any;
    expect(graph.connectorEdges.length).toBe(0);
  });

  it('applies batch connector transitions for multiple edges and restores with before snapshots', () => {
    const batchTx: GraphCommandTransaction = {
      kind: 'batch-widget-update',
      touchedWidgetIds: ['connector-1', 'connector-2'],
      beforeEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: 'shape-a',
          toWidgetId: 'shape-b',
          fromAnchor: 'right',
          toAnchor: 'left',
        },
        {
          connectorWidgetId: 'connector-2',
          fromWidgetId: 'shape-c',
          toWidgetId: 'shape-d',
          fromAnchor: 'bottom',
          toAnchor: 'top',
        },
      ],
      afterEdges: [
        {
          connectorWidgetId: 'connector-1',
          fromWidgetId: 'shape-a',
          toWidgetId: 'shape-e',
          fromAnchor: 'right',
          toAnchor: 'left',
        },
        {
          connectorWidgetId: 'connector-2',
          fromWidgetId: null,
          toWidgetId: null,
        },
      ],
    };

    const seeded = withGraphTransactionMetadata({}, batchTx, 'before');
    const after = withGraphTransactionMetadata(seeded, batchTx, 'after');
    const afterGraph = after['graph'] as any;

    expect(afterGraph.connectorEdges.length).toBe(1);
    expect(afterGraph.connectorEdges[0].connectorWidgetId).toBe('connector-1');
    expect(afterGraph.connectorEdges[0].toWidgetId).toBe('shape-e');

    const restored = withGraphTransactionMetadata(after, batchTx, 'before');
    const restoredGraph = restored['graph'] as any;

    expect(restoredGraph.connectorEdges.length).toBe(2);
    const byId = new Map<string, { toWidgetId: string }>(
      restoredGraph.connectorEdges.map((edge: any) => [
        String(edge.connectorWidgetId),
        { toWidgetId: String(edge.toWidgetId) },
      ])
    );
    expect(byId.get('connector-1')?.toWidgetId).toBe('shape-b');
    expect(byId.get('connector-2')?.toWidgetId).toBe('shape-d');
  });
});
