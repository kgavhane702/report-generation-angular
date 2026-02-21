import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject, of } from 'rxjs';

import { ConnectorAnchorService } from './connector-anchor.service';
import { DraftStateService } from './draft-state.service';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { GRAPH_SCHEMA_VERSION_CURRENT } from '../graph/models/graph-schema.model';

describe('ConnectorAnchorService', () => {
  it('resolves attachments from graph metadata before props', () => {
    TestBed.configureTestingModule({
      providers: [
        ConnectorAnchorService,
        {
          provide: Store,
          useValue: {
            select: () =>
              of({
                graph: {
                  schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
                  connectorEdges: [
                    {
                      connectorWidgetId: 'connector-1',
                      fromWidgetId: 'shape-a',
                      toWidgetId: 'shape-b',
                      fromAnchor: 'right',
                      toAnchor: 'left',
                    },
                  ],
                },
              }),
          },
        },
        {
          provide: DraftStateService,
          useValue: {
            getMergedWidget: () => null,
          },
        },
      ],
    });

    const service = TestBed.inject(ConnectorAnchorService);
    const resolved = service.getResolvedConnectorAttachments(
      'connector-1',
      { widgetId: 'legacy-source', anchor: 'top' },
      { widgetId: 'legacy-target', anchor: 'bottom' }
    );

    expect(resolved.startAttachment).toEqual({ widgetId: 'shape-a', anchor: 'right' });
    expect(resolved.endAttachment).toEqual({ widgetId: 'shape-b', anchor: 'left' });
  });

  it('returns null attachments when graph metadata is absent', () => {
    TestBed.configureTestingModule({
      providers: [
        ConnectorAnchorService,
        {
          provide: Store,
          useValue: {
            select: () => of({}),
          },
        },
        {
          provide: DraftStateService,
          useValue: {
            getMergedWidget: () => null,
          },
        },
      ],
    });

    const service = TestBed.inject(ConnectorAnchorService);
    const resolved = service.getResolvedConnectorAttachments(
      'connector-2',
      { widgetId: 'shape-x', anchor: 'top-right' },
      { widgetId: 'shape-y', anchor: 'bottom-left' }
    );

    expect(resolved.startAttachment).toBeNull();
    expect(resolved.endAttachment).toBeNull();
  });

  it('returns null attachments when graph metadata schema is unsupported', () => {
    TestBed.configureTestingModule({
      providers: [
        ConnectorAnchorService,
        {
          provide: Store,
          useValue: {
            select: () =>
              of({
                graph: {
                  schemaVersion: '9.9',
                  connectorEdges: [
                    {
                      connectorWidgetId: 'connector-1',
                      fromWidgetId: 'shape-a',
                      toWidgetId: 'shape-b',
                      fromAnchor: 'right',
                      toAnchor: 'left',
                    },
                  ],
                },
              }),
          },
        },
        {
          provide: DraftStateService,
          useValue: {
            getMergedWidget: () => null,
          },
        },
      ],
    });

    const service = TestBed.inject(ConnectorAnchorService);
    const resolved = service.getResolvedConnectorAttachments(
      'connector-1',
      { widgetId: 'legacy-source', anchor: 'top' },
      { widgetId: 'legacy-target', anchor: 'bottom' }
    );

    expect(resolved.startAttachment).toBeNull();
    expect(resolved.endAttachment).toBeNull();
  });
});

describe('ConnectorAnchorService repair', () => {
  function configureWithState(state: {
    metadata?: Record<string, unknown>;
    widgetEntities?: Record<string, any>;
    widgetIdsByPageId?: Record<string, string[]>;
  }): ConnectorAnchorService {
    TestBed.configureTestingModule({
      providers: [
        ConnectorAnchorService,
        {
          provide: Store,
          useValue: {
            select: (selector: unknown) => {
              if (selector === DocumentSelectors.selectDocumentMetadata) {
                return of(state.metadata ?? {});
              }
              if (selector === DocumentSelectors.selectWidgetEntities) {
                return of(state.widgetEntities ?? {});
              }
              if (selector === DocumentSelectors.selectWidgetIdsByPageId) {
                return of(state.widgetIdsByPageId ?? {});
              }
              return of({});
            },
          },
        },
        {
          provide: DraftStateService,
          useValue: {
            getMergedWidget: (_widgetId: string, persisted: any) => persisted,
          },
        },
      ],
    });
    return TestBed.inject(ConnectorAnchorService);
  }

  it('clears attachment when graph points to missing widget', () => {
    const service = configureWithState({
      metadata: {
        graph: {
          schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
          connectorEdges: [
            {
              connectorWidgetId: 'connector-1',
              fromWidgetId: 'missing-widget',
              toWidgetId: 'shape-b',
              fromAnchor: 'right',
              toAnchor: 'left',
            },
          ],
        },
      },
      widgetEntities: {
        'shape-b': {
          id: 'shape-b',
          type: 'object',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 80 },
          rotation: 0,
          props: { shapeType: 'rectangle' },
        },
      },
    });

    const repaired = service.getRepairedConnectorAttachments('connector-1', null, null);

    expect(repaired.startAttachment).toBeNull();
    expect(repaired.endAttachment).toEqual({ widgetId: 'shape-b', anchor: 'left', dir: 'left' });
  });

  it('repairs invalid anchor to nearest valid anchor for target widget', () => {
    const service = configureWithState({
      metadata: {
        graph: {
          schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
          connectorEdges: [
            {
              connectorWidgetId: 'connector-2',
              fromWidgetId: 'shape-c',
              toWidgetId: 'shape-d',
              fromAnchor: 'top-right',
              toAnchor: 'bottom-left',
            },
          ],
        },
      },
      widgetEntities: {
        'shape-c': {
          id: 'shape-c',
          type: 'object',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 80 },
          rotation: 0,
          props: { shapeType: 'line' },
        },
        'shape-d': {
          id: 'shape-d',
          type: 'object',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 80 },
          rotation: 0,
          props: { shapeType: 'line' },
        },
      },
    });

    const repaired = service.getRepairedConnectorAttachments('connector-2', null, null);

    expect(repaired.startAttachment).toBeTruthy();
    expect(repaired.endAttachment).toBeTruthy();
  });

  it('recovers stale target when metadata changes across replay states', () => {
    const metadata$ = new BehaviorSubject<Record<string, unknown>>({
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
        connectorEdges: [
          {
            connectorWidgetId: 'connector-3',
            fromWidgetId: 'shape-a',
            toWidgetId: 'shape-b',
            fromAnchor: 'right',
            toAnchor: 'left',
          },
        ],
      },
    });

    TestBed.configureTestingModule({
      providers: [
        ConnectorAnchorService,
        {
          provide: Store,
          useValue: {
            select: (selector: unknown) => {
              if (selector === DocumentSelectors.selectDocumentMetadata) {
                return metadata$.asObservable();
              }
              if (selector === DocumentSelectors.selectWidgetEntities) {
                return of({
                  'shape-a': {
                    id: 'shape-a',
                    type: 'object',
                    position: { x: 0, y: 0 },
                    size: { width: 100, height: 80 },
                    rotation: 0,
                    props: { shapeType: 'rectangle' },
                  },
                  'shape-b': {
                    id: 'shape-b',
                    type: 'object',
                    position: { x: 200, y: 0 },
                    size: { width: 100, height: 80 },
                    rotation: 0,
                    props: { shapeType: 'rectangle' },
                  },
                });
              }
              if (selector === DocumentSelectors.selectWidgetIdsByPageId) {
                return of({});
              }
              return of({});
            },
          },
        },
        {
          provide: DraftStateService,
          useValue: {
            getMergedWidget: (_widgetId: string, persisted: any) => persisted,
          },
        },
      ],
    });

    const service = TestBed.inject(ConnectorAnchorService);

    const initial = service.getRepairedConnectorAttachments('connector-3', null, null);
    expect(initial.startAttachment?.widgetId).toBe('shape-a');
    expect(initial.endAttachment?.widgetId).toBe('shape-b');

    metadata$.next({
      graph: {
        schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
        connectorEdges: [
          {
            connectorWidgetId: 'connector-3',
            fromWidgetId: 'shape-a',
            toWidgetId: 'shape-missing',
            fromAnchor: 'right',
            toAnchor: 'left',
          },
        ],
      },
    });

    const stale = service.getRepairedConnectorAttachments('connector-3', null, null);
    expect(stale.startAttachment?.widgetId).toBe('shape-a');
    expect(stale.endAttachment).toBeNull();
  });
});
