import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetModel } from '../../../../models/widget.model';
import { AdvancedTableWidgetProps } from '../../../../models/widget.model';

@Component({
  selector: 'app-advanced-table-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advanced-table-widget.component.html',
  styleUrls: ['./advanced-table-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedTableWidgetComponent implements OnInit, OnChanges {
  @Input() widget!: WidgetModel<AdvancedTableWidgetProps>;

  rows: number = 3;
  columns: number = 3;
  tableData: string[][] = [];

  ngOnInit(): void {
    if (this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.initializeTableData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.initializeTableData();
    }
  }

  private initializeTableData(): void {
    this.tableData = [];
    for (let i = 0; i < this.rows; i++) {
      const row: string[] = [];
      for (let j = 0; j < this.columns; j++) {
        row.push('');
      }
      this.tableData.push(row);
    }
  }

  getCellValue(rowIndex: number, colIndex: number): string {
    if (this.tableData[rowIndex] && this.tableData[rowIndex][colIndex] !== undefined) {
      return this.tableData[rowIndex][colIndex];
    }
    return '';
  }
}

