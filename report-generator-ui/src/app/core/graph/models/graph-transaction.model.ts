import type { ConnectorAnchorAttachment } from '../../../models/widget.model';

export interface GraphConnectorEdgeSnapshot {
  connectorWidgetId: string;
  fromWidgetId: string | null;
  toWidgetId: string | null;
  fromAnchor?: ConnectorAnchorAttachment['anchor'];
  toAnchor?: ConnectorAnchorAttachment['anchor'];
}

export interface GraphCommandTransaction {
  kind: 'widget-update' | 'batch-widget-update';
  touchedWidgetIds: string[];
  beforeEdges: GraphConnectorEdgeSnapshot[];
  afterEdges: GraphConnectorEdgeSnapshot[];
}
