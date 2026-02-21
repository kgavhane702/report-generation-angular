import type { DocumentModel } from '../../../models/document.model';
import type {
  ConnectorAnchorAttachment,
  ConnectorWidgetProps,
  WidgetModel,
} from '../../../models/widget.model';
import type { NormalizedDocumentState } from '../../../store/document/document.state';
import type { GraphConnectorEdge } from '../models/graph-document.model';
import {
  GRAPH_SCHEMA_VERSION_CURRENT,
  type GraphSchemaVersion,
} from '../models/graph-schema.model';
import { buildGraphDocumentFromNormalized } from './widget-graph.adapter';

const GRAPH_METADATA_KEY = 'graph';

interface PersistedGraphMetadata {
  schemaVersion: GraphSchemaVersion;
  connectorEdges: GraphConnectorEdge[];
}

function isAnchor(value: unknown): value is ConnectorAnchorAttachment['anchor'] {
  return (
    value === 'top' ||
    value === 'top-right' ||
    value === 'right' ||
    value === 'bottom-right' ||
    value === 'bottom' ||
    value === 'bottom-left' ||
    value === 'left' ||
    value === 'top-left'
  );
}

function parsePersistedGraphMetadata(metadata: Record<string, unknown> | undefined): PersistedGraphMetadata | null {
  if (!metadata) return null;
  const graph = metadata[GRAPH_METADATA_KEY];
  if (!graph || typeof graph !== 'object') return null;

  const schemaVersion = (graph as any).schemaVersion;
  const connectorEdgesRaw = (graph as any).connectorEdges;
  const version = String(schemaVersion ?? '') as GraphSchemaVersion;
  if (version !== GRAPH_SCHEMA_VERSION_CURRENT || !Array.isArray(connectorEdgesRaw)) {
    return null;
  }

  const connectorEdges: GraphConnectorEdge[] = connectorEdgesRaw
    .filter((edge) => !!edge && typeof edge === 'object')
    .map((edge) => {
      const fromAnchor = isAnchor((edge as any).fromAnchor) ? (edge as any).fromAnchor : undefined;
      const toAnchor = isAnchor((edge as any).toAnchor) ? (edge as any).toAnchor : undefined;
      return {
        id: String((edge as any).id ?? ''),
        kind: 'connector',
        connectorWidgetId: String((edge as any).connectorWidgetId ?? ''),
        fromWidgetId: String((edge as any).fromWidgetId ?? ''),
        toWidgetId: String((edge as any).toWidgetId ?? ''),
        fromAnchor,
        toAnchor,
      } satisfies GraphConnectorEdge;
    })
    .filter((edge) => !!edge.connectorWidgetId && !!edge.fromWidgetId && !!edge.toWidgetId);

  return {
    schemaVersion: version,
    connectorEdges,
  };
}

function buildAttachment(
  widgetId: string,
  anchor: ConnectorAnchorAttachment['anchor'] | undefined
): ConnectorAnchorAttachment | undefined {
  if (!widgetId || !anchor) return undefined;
  return { widgetId, anchor };
}

export function withPersistedGraphMetadata(
  metadata: Record<string, unknown> | undefined,
  normalized: NormalizedDocumentState
): Record<string, unknown> {
  const graphDocument = buildGraphDocumentFromNormalized(normalized);
  return {
    ...(metadata ?? {}),
    [GRAPH_METADATA_KEY]: {
      schemaVersion: graphDocument.schemaVersion ?? GRAPH_SCHEMA_VERSION_CURRENT,
      connectorEdges: graphDocument.connectorEdges,
    } satisfies PersistedGraphMetadata,
  };
}

export function hydrateDocumentConnectorAttachmentsFromMetadata(document: DocumentModel): DocumentModel {
  const persisted = parsePersistedGraphMetadata(document.metadata);
  if (!persisted || persisted.connectorEdges.length === 0) {
    return document;
  }

  const edgeByConnectorId = new Map<string, GraphConnectorEdge>();
  for (const edge of persisted.connectorEdges) {
    edgeByConnectorId.set(edge.connectorWidgetId, edge);
  }

  let changed = false;
  const sections = document.sections.map((section) => ({
    ...section,
    subsections: section.subsections.map((subsection) => ({
      ...subsection,
      pages: subsection.pages.map((page) => ({
        ...page,
        widgets: page.widgets.map((widget) => {
          if (widget.type !== 'connector') {
            return widget;
          }

          const edge = edgeByConnectorId.get(widget.id);
          if (!edge) {
            return widget;
          }

          const props = widget.props as ConnectorWidgetProps;
          const startAttachment =
            props.startAttachment ?? buildAttachment(edge.fromWidgetId, edge.fromAnchor);
          const endAttachment = props.endAttachment ?? buildAttachment(edge.toWidgetId, edge.toAnchor);

          if (startAttachment === props.startAttachment && endAttachment === props.endAttachment) {
            return widget;
          }

          changed = true;
          return {
            ...(widget as WidgetModel<ConnectorWidgetProps>),
            props: {
              ...props,
              ...(startAttachment ? { startAttachment } : {}),
              ...(endAttachment ? { endAttachment } : {}),
            },
          } as WidgetModel;
        }),
      })),
    })),
  }));

  if (!changed) {
    return document;
  }

  return {
    ...document,
    sections,
  };
}
