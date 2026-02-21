import { DocumentModel } from '../../../models/document.model';
import { createInitialNormalizedState, WidgetEntity } from '../../../store/document/document.state';
import { GRAPH_SCHEMA_VERSION_CURRENT } from '../models/graph-schema.model';
import {
  hydrateDocumentConnectorAttachmentsFromMetadata,
  withPersistedGraphMetadata,
} from './document-graph-metadata.adapter';

describe('document-graph-metadata.adapter', () => {
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

  it('persists connector edges into metadata graph block', () => {
    const normalized = createInitialNormalizedState();
    const source = widget({ id: 'shape-a', pageId: 'page-1', type: 'object', props: { shapeType: 'rectangle' } });
    const target = widget({ id: 'shape-b', pageId: 'page-1', type: 'object', props: { shapeType: 'ellipse' } });
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
    normalized.meta.metadata = {
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
        connectorEdges: [
          {
            id: connector.id,
            kind: 'connector',
            connectorWidgetId: connector.id,
            fromWidgetId: source.id,
            toWidgetId: target.id,
            fromAnchor: 'right',
            toAnchor: 'left',
          },
        ],
      },
    };

    const metadata = withPersistedGraphMetadata({ existing: true }, normalized);
    const graph = metadata['graph'] as any;

    expect(metadata['existing']).toBe(true);
    expect(graph.schemaVersion).toBe(GRAPH_SCHEMA_VERSION_CURRENT);
    expect(graph.connectorEdges.length).toBe(1);
    expect(graph.connectorEdges[0].connectorWidgetId).toBe('connector-1');
  });

  it('hydrates connector attachments from metadata graph block when missing', () => {
    const document: DocumentModel = {
      id: 'doc-1',
      title: 'Doc',
      version: '1.0',
      pageSize: { widthMm: 297, heightMm: 210, dpi: 96 },
      metadata: {
        graph: {
          schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
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
      },
      sections: [
        {
          id: 'section-1',
          title: 'Section',
          subsections: [
            {
              id: 'sub-1',
              title: 'Sub',
              pages: [
                {
                  id: 'page-1',
                  number: 1,
                  widgets: [
                    {
                      id: 'shape-a',
                      type: 'object',
                      position: { x: 10, y: 20 },
                      size: { width: 120, height: 60 },
                      zIndex: 1,
                      props: { shapeType: 'rectangle' },
                    },
                    {
                      id: 'shape-b',
                      type: 'object',
                      position: { x: 210, y: 20 },
                      size: { width: 120, height: 60 },
                      zIndex: 1,
                      props: { shapeType: 'ellipse' },
                    },
                    {
                      id: 'connector-1',
                      type: 'connector',
                      position: { x: 0, y: 0 },
                      size: { width: 300, height: 100 },
                      zIndex: 2,
                      props: {
                        shapeType: 'line',
                        startPoint: { x: 0, y: 0 },
                        endPoint: { x: 100, y: 0 },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const hydrated = hydrateDocumentConnectorAttachmentsFromMetadata(document);
    const connector = hydrated.sections[0].subsections[0].pages[0].widgets.find((w) => w.id === 'connector-1') as any;

    expect(connector.props.startAttachment).toEqual({ widgetId: 'shape-a', anchor: 'right' });
    expect(connector.props.endAttachment).toEqual({ widgetId: 'shape-b', anchor: 'left' });
  });
});
