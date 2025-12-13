// This model is kept for backward compatibility but is no longer used
// The save service now always saves all widgets without tracking state
export interface WidgetSaveStatus {
  widgetId: string;
  hasUnsavedChanges: boolean;
  lastSavedAt?: number;
}

export interface WidgetSaveStatusMap {
  [widgetId: string]: WidgetSaveStatus;
}

