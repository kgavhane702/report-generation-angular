import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableToolbarService } from '../../../../core/services/table-toolbar.service';

/**
 * TableToolbarComponent
 * 
 * Formatting toolbar for table widget cells.
 * Provides bold, italic, and alignment controls.
 */
@Component({
  selector: 'app-table-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table-toolbar.component.html',
  styleUrls: ['./table-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableToolbarComponent {
  private readonly toolbarService = inject(TableToolbarService);

  splitDialogOpen = false;
  splitRows = 2;
  splitCols = 2;
  splitMax = 20;

  get formattingState() {
    return this.toolbarService.formattingState();
  }

  get hasActiveCell(): boolean {
    return this.toolbarService.activeCell !== null;
  }

  openSplitDialog(event: MouseEvent): void {
    event.preventDefault();
    this.splitDialogOpen = true;
  }

  closeSplitDialog(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
    }
    this.splitDialogOpen = false;
  }

  confirmSplit(event: MouseEvent): void {
    event.preventDefault();
    const rows = Math.max(1, Math.min(this.splitMax, Math.trunc(Number(this.splitRows))));
    const cols = Math.max(1, Math.min(this.splitMax, Math.trunc(Number(this.splitCols))));
    this.splitRows = rows;
    this.splitCols = cols;
    this.toolbarService.requestSplitCell({ rows, cols });
    this.splitDialogOpen = false;
  }

  onBoldClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.applyBold();
  }

  onItalicClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.applyItalic();
  }

  onAlignClick(event: MouseEvent, align: 'left' | 'center' | 'right'): void {
    event.preventDefault();
    this.toolbarService.applyTextAlign(align);
  }

  onVerticalAlignClick(event: MouseEvent, align: 'top' | 'middle' | 'bottom'): void {
    event.preventDefault();
    this.toolbarService.applyVerticalAlign(align);
  }
}

