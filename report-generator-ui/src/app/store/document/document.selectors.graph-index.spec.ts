import { createInitialNormalizedState } from './document.state';
import { DocumentSelectors } from './document.selectors';

describe('DocumentSelectors graph indexes', () => {
  it('returns graph indexes when no widgets exist', () => {
    const normalized = createInitialNormalizedState();
    const state = { document: { normalized } } as any;

    const indexes = DocumentSelectors.selectGraphIndexes(state);
    expect(indexes).toBeTruthy();
    expect(indexes.adjacency.connectorsByWidgetId).toEqual({});
    expect(indexes.spatial.buckets).toEqual({});
  });

  it('projects adjacency and spatial indexes', () => {
    const normalized = createInitialNormalizedState();
    normalized.widgets.ids = ['shape-a', 'shape-b', 'connector-1'];
    normalized.widgets.entities = {
      'shape-a': {
        id: 'shape-a',
        pageId: 'page-1',
        type: 'object',
        position: { x: 0, y: 0 },
        size: { width: 120, height: 80 },
        zIndex: 1,
        props: { shapeType: 'rectangle' } as any,
      },
      'shape-b': {
        id: 'shape-b',
        pageId: 'page-1',
        type: 'object',
        position: { x: 220, y: 0 },
        size: { width: 120, height: 80 },
        zIndex: 2,
        props: { shapeType: 'rectangle' } as any,
      },
      'connector-1': {
        id: 'connector-1',
        pageId: 'page-1',
        type: 'connector',
        position: { x: 0, y: 0 },
        size: { width: 340, height: 120 },
        zIndex: 3,
        props: {
          shapeType: 'line',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 100, y: 0 },
          startAttachment: { widgetId: 'shape-a', anchor: 'right' },
          endAttachment: { widgetId: 'shape-b', anchor: 'left' },
        } as any,
      },
    } as any;
    normalized.meta.metadata = {
      graph: {
        schemaVersion: '0.2',
        connectorEdges: [
          {
            id: 'connector-1',
            kind: 'connector',
            connectorWidgetId: 'connector-1',
            fromWidgetId: 'shape-a',
            toWidgetId: 'shape-b',
            fromAnchor: 'right',
            toAnchor: 'left',
          },
        ],
      },
    };

    const state = { document: { normalized } } as any;

    const indexes = DocumentSelectors.selectGraphIndexes(state);

    expect(indexes).toBeTruthy();
    expect(indexes?.adjacency.outgoingByNodeId['shape-a']).toEqual(['shape-b']);
    expect(indexes?.adjacency.connectorsByWidgetId['shape-b']).toEqual(['connector-1']);
    expect(indexes?.spatial.bucketSizePx).toBe(256);
  });
});
