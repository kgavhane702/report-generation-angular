import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { ImageWidgetProps } from '../../models/widget.model';

export interface ImageToolbarState {
  widgetId: string | null;
  props: ImageWidgetProps | null;
}

@Injectable({ providedIn: 'root' })
export class ImageToolbarService {
  private readonly stateSubject = new BehaviorSubject<ImageToolbarState>({
    widgetId: null,
    props: null,
  });

  private readonly propsChangeSubject = new Subject<{
    widgetId: string;
    changes: Partial<ImageWidgetProps>;
  }>();

  private readonly replaceRequestSubject = new Subject<string>();

  /** Current toolbar state */
  readonly state$: Observable<ImageToolbarState> = this.stateSubject.asObservable();

  /** Emits when props should change for a widget */
  readonly propsChange$ = this.propsChangeSubject.asObservable();

  /** Emits widget ID when replace image is requested */
  readonly replaceRequest$ = this.replaceRequestSubject.asObservable();

  /** Activate toolbar for a specific image widget */
  activate(widgetId: string, props: ImageWidgetProps): void {
    this.stateSubject.next({ widgetId, props });
  }

  /** Deactivate toolbar */
  deactivate(): void {
    this.stateSubject.next({ widgetId: null, props: null });
  }

  /** Update props in the toolbar state (for UI sync) */
  updateProps(props: ImageWidgetProps): void {
    const current = this.stateSubject.value;
    if (current.widgetId) {
      this.stateSubject.next({ ...current, props });
    }
  }

  /** Request props change from toolbar */
  requestPropsChange(widgetId: string, changes: Partial<ImageWidgetProps>): void {
    this.propsChangeSubject.next({ widgetId, changes });
  }

  /** Request image replacement */
  requestReplace(widgetId: string): void {
    this.replaceRequestSubject.next(widgetId);
  }

  /** Get current state snapshot */
  get currentState(): ImageToolbarState {
    return this.stateSubject.value;
  }
}

