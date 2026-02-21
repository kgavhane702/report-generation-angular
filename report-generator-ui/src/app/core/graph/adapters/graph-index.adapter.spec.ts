import type { GraphDocument } from '../models/graph-document.model';
import { GRAPH_SCHEMA_VERSION_CURRENT } from '../models/graph-schema.model';
import {
  buildGraphAdjacencyIndex,
  buildGraphIndexes,
  buildGraphSpatialIndex,
  getConnectedNodeIds,
  querySpatialNodeIds,
} from './graph-index.adapter';

describe('graph-index.adapter', () => {
  function makeGraph(): GraphDocument {
    return {
      schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
      nodes: [
        {
          id: 'shape-a',
          kind: 'widget',
          widgetType: 'object',
          pageId: 'page-1',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
        {
          id: 'shape-b',
          kind: 'widget',
          widgetType: 'object',
          pageId: 'page-1',
          x: 220,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 2,
        },
        {
          id: 'shape-c',
          kind: 'widget',
          widgetType: 'object',
          pageId: 'page-1',
          x: 520,
          y: 260,
          width: 100,
          height: 100,
          zIndex: 3,
        },
      ],
      connectorEdges: [
        {
          id: 'connector-1',
          kind: 'connector',
          connectorWidgetId: 'connector-1',
          fromWidgetId: 'shape-a',
          toWidgetId: 'shape-b',
        },
        {
          id: 'connector-2',
          kind: 'connector',
          connectorWidgetId: 'connector-2',
          fromWidgetId: 'shape-b',
          toWidgetId: 'shape-c',
        },
      ],
    };
  }

  it('builds adjacency index for incoming/outgoing and connectors', () => {
    const adjacency = buildGraphAdjacencyIndex(makeGraph());

    expect(adjacency.outgoingByNodeId['shape-a']).toEqual(['shape-b']);
    expect(adjacency.incomingByNodeId['shape-c']).toEqual(['shape-b']);
    expect(adjacency.connectorsByWidgetId['shape-b']).toEqual(['connector-1', 'connector-2']);
    expect(getConnectedNodeIds(adjacency, 'shape-b')).toEqual(['shape-a', 'shape-c']);
  });

  it('builds spatial buckets and queries intersecting bounds', () => {
    const spatial = buildGraphSpatialIndex(makeGraph(), 200);
    const nearA = querySpatialNodeIds(spatial, {
      minX: -20,
      minY: -20,
      maxX: 180,
      maxY: 180,
    });
    const nearC = querySpatialNodeIds(spatial, {
      minX: 480,
      minY: 220,
      maxX: 700,
      maxY: 420,
    });

    expect(nearA).toContain('shape-a');
    expect(nearA).not.toContain('shape-c');
    expect(nearC).toEqual(['shape-c']);
  });

  it('builds combined indexes document', () => {
    const indexed = buildGraphIndexes(makeGraph());

    expect(indexed.graph.nodes.length).toBe(3);
    expect(indexed.adjacency.connectorsByWidgetId['shape-a']).toEqual(['connector-1']);
    expect(indexed.spatial.bucketSizePx).toBe(256);
  });
});
