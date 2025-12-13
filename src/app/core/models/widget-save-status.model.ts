export interface WidgetSaveStatus {
  widgetId: string;
  hasUnsavedChanges: boolean;
  lastSavedAt?: number;
}

export interface WidgetSaveStatusMap {
  [widgetId: string]: WidgetSaveStatus;
}

