import { DocumentMetaActions } from '../../store/document/document.actions';
import { GRAPH_SCHEMA_VERSION_CURRENT } from '../graph/models/graph-schema.model';
import { UpdateWidgetCommand, UpdateWidgetsCommand } from './document-commands';

describe('document-commands', () => {
  it('UpdateWidgetCommand updates metadata on execute and restores on undo', () => {
    const dispatch = jasmine.createSpy('dispatch');
    const store = { dispatch } as any;

    const beforeMetadata = {
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
        connectorEdges: [
          {
            id: 'connector-1',
            kind: 'connector',
            connectorWidgetId: 'connector-1',
            fromWidgetId: 'shape-a',
            toWidgetId: 'shape-b',
          },
        ],
      },
    };

    const afterMetadata = {
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
        connectorEdges: [
          {
            id: 'connector-1',
            kind: 'connector',
            connectorWidgetId: 'connector-1',
            fromWidgetId: 'shape-a',
            toWidgetId: 'shape-c',
          },
        ],
      },
    };

    const command = new UpdateWidgetCommand(
      store,
      'page-1',
      'connector-1',
      { props: { shapeType: 'line' } } as any,
      {
        id: 'connector-1',
        pageId: 'page-1',
        type: 'connector',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 10 },
        zIndex: 1,
        props: { shapeType: 'line' },
      } as any,
      undefined,
      beforeMetadata,
      afterMetadata
    );

    command.execute();
    expect(dispatch).toHaveBeenCalledWith(
      DocumentMetaActions.updateMetadata({ metadata: afterMetadata })
    );

    dispatch.calls.reset();
    command.undo();
    expect(dispatch).toHaveBeenCalledWith(
      DocumentMetaActions.updateMetadata({ metadata: beforeMetadata })
    );
  });

  it('UpdateWidgetsCommand updates metadata on execute and restores on undo', () => {
    const dispatch = jasmine.createSpy('dispatch');
    const store = { dispatch } as any;

    const beforeMetadata = {
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
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
            fromWidgetId: 'shape-c',
            toWidgetId: 'shape-d',
          },
        ],
      },
    };

    const afterMetadata = {
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
        connectorEdges: [
          {
            id: 'connector-1',
            kind: 'connector',
            connectorWidgetId: 'connector-1',
            fromWidgetId: 'shape-a',
            toWidgetId: 'shape-e',
          },
        ],
      },
    };

    const command = new UpdateWidgetsCommand(
      store,
      [
        {
          pageId: 'page-1',
          widgetId: 'connector-1',
          changes: { props: { shapeType: 'line' } } as any,
          previousWidget: {
            id: 'connector-1',
            pageId: 'page-1',
            type: 'connector',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 10 },
            zIndex: 1,
            props: { shapeType: 'line' },
          } as any,
        },
      ],
      undefined,
      beforeMetadata,
      afterMetadata
    );

    command.execute();
    expect(dispatch).toHaveBeenCalledWith(
      DocumentMetaActions.updateMetadata({ metadata: afterMetadata })
    );

    dispatch.calls.reset();
    command.undo();
    expect(dispatch).toHaveBeenCalledWith(
      DocumentMetaActions.updateMetadata({ metadata: beforeMetadata })
    );
  });
});
