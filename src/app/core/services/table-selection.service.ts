import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CellPosition {
  row: number;
  col: number;
}

@Injectable({
  providedIn: 'root',
})
export class TableSelectionService {
  private selectedCellsSubject = new BehaviorSubject<CellPosition[]>([]);
  public selectedCells$: Observable<CellPosition[]> = this.selectedCellsSubject.asObservable();

  setSelectedCells(cells: CellPosition[]): void {
    this.selectedCellsSubject.next(cells);
  }

  getSelectedCells(): CellPosition[] {
    return this.selectedCellsSubject.value;
  }

  clearSelection(): void {
    this.selectedCellsSubject.next([]);
  }
}

