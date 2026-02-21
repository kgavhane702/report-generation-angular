import type { ConnectorAnchorAttachment, WidgetType } from '../../../models/widget.model';
import type { GraphSchemaVersion } from './graph-schema.model';

export type GraphNodeKind = 'widget';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  widgetType: WidgetType;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  locked?: boolean;
}

export interface GraphConnectorEdge {
  id: string;
  kind: 'connector';
  connectorWidgetId: string;
  fromWidgetId: string;
  toWidgetId: string;
  fromAnchor?: ConnectorAnchorAttachment['anchor'];
  toAnchor?: ConnectorAnchorAttachment['anchor'];
}

export interface GraphDocument {
  schemaVersion: GraphSchemaVersion;
  nodes: GraphNode[];
  connectorEdges: GraphConnectorEdge[];
}
