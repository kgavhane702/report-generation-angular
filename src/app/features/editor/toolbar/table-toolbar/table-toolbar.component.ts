import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
  templateUrl: './table-toolbar.component.html',
  styleUrls: ['./table-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableToolbarComponent {
  private readonly toolbarService = inject(TableToolbarService);

  get formattingState() {
    return this.toolbarService.formattingState();
  }

  get hasActiveCell(): boolean {
    return this.toolbarService.activeCell !== null;
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

