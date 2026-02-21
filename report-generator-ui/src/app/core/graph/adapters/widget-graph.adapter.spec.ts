import { createInitialNormalizedState, WidgetEntity } from '../../../store/document/document.state';
import { GRAPH_SCHEMA_VERSION_CURRENT } from '../models/graph-schema.model';
import { buildGraphDocumentFromNormalized } from './widget-graph.adapter';

describe('widget-graph.adapter', () => {
  function widget(partial: Partial<WidgetEntity> & Pick<WidgetEntity, 'id' | 'pageId' | 'type' | 'props'>): WidgetEntity {
    return {
      id: partial.id,
      pageId: partial.pageId,
      type: partial.type,
      props: partial.props,
      position: partial.position ?? { x: 10, y: 20 },
      size: partial.size ?? { width: 120, height: 60 },
      zIndex: partial.zIndex ?? 1,
      rotation: partial.rotation,
      locked: partial.locked,
      style: partial.style,
    };
  }

  it('projects widget entities into graph nodes', () => {
    const normalized = createInitialNormalizedState();
    const shape = widget({
      id: 'shape-1',
      pageId: 'page-1',
      type: 'object',
      props: { shapeType: 'rectangle' },
    });

    normalized.widgets.ids = [shape.id];
    normalized.widgets.entities = { [shape.id]: shape };

    const graph = buildGraphDocumentFromNormalized(normalized);

    expect(graph.schemaVersion).toBe(GRAPH_SCHEMA_VERSION_CURRENT);
    expect(graph.nodes.length).toBe(1);
    expect(graph.nodes[0].id).toBe(shape.id);
    expect(graph.nodes[0].widgetType).toBe('object');
    expect(graph.connectorEdges.length).toBe(0);
  });

  it('does not create connector edge from widget props without graph metadata edge', () => {
    const normalized = createInitialNormalizedState();
    const source = widget({
      id: 'shape-a',
      pageId: 'page-1',
      type: 'object',
      props: { shapeType: 'rectangle' },
    });
    const target = widget({
      id: 'shape-b',
      pageId: 'page-1',
      type: 'object',
      props: { shapeType: 'ellipse' },
    });
    const connector = widget({
      id: 'connector-1',
      pageId: 'page-1',
      type: 'connector',
      props: {
        shapeType: 'line',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 0 },
        startAttachment: { widgetId: source.id, anchor: 'right' },
        endAttachment: { widgetId: target.id, anchor: 'left' },
      },
    });

    normalized.widgets.ids = [source.id, target.id, connector.id];
    normalized.widgets.entities = {
      [source.id]: source,
      [target.id]: target,
      [connector.id]: connector,
    };

    const graph = buildGraphDocumentFromNormalized(normalized);

    expect(graph.nodes.length).toBe(3);
    expect(graph.connectorEdges.length).toBe(0);
  });

  it('prefers persisted graph metadata edges over widget props attachments', () => {
    const normalized = createInitialNormalizedState();
    const source = widget({
      id: 'shape-a',
      pageId: 'page-1',
      type: 'object',
      props: { shapeType: 'rectangle' },
    });
    const targetA = widget({
      id: 'shape-b',
      pageId: 'page-1',
      type: 'object',
      props: { shapeType: 'ellipse' },
    });
    const targetB = widget({
      id: 'shape-c',
      pageId: 'page-1',
      type: 'object',
      props: { shapeType: 'ellipse' },
    });
    const connector = widget({
      id: 'connector-1',
      pageId: 'page-1',
      type: 'connector',
      props: {
        shapeType: 'line',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 0 },
        startAttachment: { widgetId: source.id, anchor: 'right' },
        endAttachment: { widgetId: targetA.id, anchor: 'left' },
      },
    });

    normalized.widgets.ids = [source.id, targetA.id, targetB.id, connector.id];
    normalized.widgets.entities = {
      [source.id]: source,
      [targetA.id]: targetA,
      [targetB.id]: targetB,
      [connector.id]: connector,
    };
    normalized.meta.metadata = {
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
        connectorEdges: [
          {
            id: connector.id,
            kind: 'connector',
            connectorWidgetId: connector.id,
            fromWidgetId: source.id,
            toWidgetId: targetB.id,
            fromAnchor: 'right',
            toAnchor: 'left',
          },
        ],
      },
    };

    const graph = buildGraphDocumentFromNormalized(normalized);

    expect(graph.connectorEdges.length).toBe(1);
    expect(graph.connectorEdges[0].toWidgetId).toBe(targetB.id);
  });
});
