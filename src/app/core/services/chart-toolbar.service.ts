import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type ChartConfigOpenMode = 'default' | 'import';

export interface ChartOpenConfigRequest {
  widgetId: string;
  mode: ChartConfigOpenMode;
}

/**
 * Small coordination service so toolbar actions can trigger chart widget UI actions
 * (similar to how table import uses TableToolbarService).
 */
@Injectable({ providedIn: 'root' })
export class ChartToolbarService {
  private readonly openConfigRequestedSubject = new Subject<ChartOpenConfigRequest>();

  readonly openConfigRequested$: Observable<ChartOpenConfigRequest> = this.openConfigRequestedSubject.asObservable();

  requestOpenConfig(widgetId: string): void {
    this.openConfigRequestedSubject.next({ widgetId, mode: 'default' });
  }

  requestOpenImport(widgetId: string): void {
    this.openConfigRequestedSubject.next({ widgetId, mode: 'import' });
  }
}


