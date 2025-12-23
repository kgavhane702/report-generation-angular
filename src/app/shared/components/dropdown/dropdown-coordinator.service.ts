import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DropdownCoordinatorService {
  private readonly openedSubject = new Subject<string>();

  readonly opened$ = this.openedSubject.asObservable();

  notifyOpened(id: string): void {
    this.openedSubject.next(id);
  }
}
