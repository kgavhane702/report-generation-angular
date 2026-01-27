import { Injectable, signal } from '@angular/core';
import { WidgetModel } from '../../models/widget.model';

@Injectable({
  providedIn: 'root',
})
export class ClipboardService {
  private readonly copiedWidgets = signal<WidgetModel[]>([]);

  getCopiedWidgets(): WidgetModel[] {
    return this.copiedWidgets();
  }

  hasCopiedWidgets(): boolean {
    return this.copiedWidgets().length > 0;
  }

  copyWidgets(widgets: WidgetModel[]): void {
    this.copiedWidgets.set(widgets);
  }

  clear(): void {
    this.copiedWidgets.set([]);
  }
}

