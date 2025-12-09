import { Injectable, signal } from '@angular/core';
import { WidgetModel } from '../../models/widget.model';

@Injectable({
  providedIn: 'root',
})
export class ClipboardService {
  private readonly copiedWidgets = signal<WidgetModel[]>([]);

  /**
   * Get the currently copied widgets
   */
  getCopiedWidgets(): WidgetModel[] {
    return this.copiedWidgets();
  }

  /**
   * Check if there are widgets in the clipboard
   */
  hasCopiedWidgets(): boolean {
    return this.copiedWidgets().length > 0;
  }

  /**
   * Copy widgets to clipboard
   */
  copyWidgets(widgets: WidgetModel[]): void {
    this.copiedWidgets.set(widgets);
  }

  /**
   * Clear the clipboard
   */
  clear(): void {
    this.copiedWidgets.set([]);
  }
}

