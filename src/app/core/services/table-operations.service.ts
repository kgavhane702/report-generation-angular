import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type TableOperation = 
  | { type: 'insertRow'; above: boolean }
  | { type: 'deleteRow' }
  | { type: 'insertColumn'; left: boolean }
  | { type: 'deleteColumn' }
  | { type: 'mergeCells' }
  | { type: 'unmergeCells' }
  | { type: 'copyCells' }
  | { type: 'pasteCells' }
  | { type: 'cutCells' };

@Injectable({
  providedIn: 'root',
})
export class TableOperationsService {
  private operationSubject = new Subject<TableOperation>();
  public operation$ = this.operationSubject.asObservable();

  insertRow(above: boolean = false): void {
    this.operationSubject.next({ type: 'insertRow', above });
  }

  deleteRow(): void {
    this.operationSubject.next({ type: 'deleteRow' });
  }

  insertColumn(left: boolean = false): void {
    this.operationSubject.next({ type: 'insertColumn', left });
  }

  deleteColumn(): void {
    this.operationSubject.next({ type: 'deleteColumn' });
  }

  mergeCells(): void {
    this.operationSubject.next({ type: 'mergeCells' });
  }

  unmergeCells(): void {
    this.operationSubject.next({ type: 'unmergeCells' });
  }

  copyCells(): void {
    this.operationSubject.next({ type: 'copyCells' });
  }

  pasteCells(): void {
    this.operationSubject.next({ type: 'pasteCells' });
  }

  cutCells(): void {
    this.operationSubject.next({ type: 'cutCells' });
  }
}

