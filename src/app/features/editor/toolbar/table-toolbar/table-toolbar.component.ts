import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  HostListener,
  ElementRef,
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
  private readonly elementRef = inject(ElementRef);

  splitDialogOpen = false;
  splitRows = 2;
  splitCols = 2;
  splitMax = 20;

  // Dropdown states
  readonly showTextColorDropdown = signal(false);
  readonly showHighlightDropdown = signal(false);
  readonly showCellFillDropdown = signal(false);

  // Text color palette
  readonly textColorPalette: Array<{ value: string; label: string }> = [
    { value: '#000000', label: 'Black' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#ffffff', label: 'White' },
    { value: '#ef4444', label: 'Red' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#10b981', label: 'Green' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#fbbf24', label: 'Amber' },
  ];

  // Highlight and fill palette (includes transparent)
  readonly highlightFillPalette: Array<{ value: string; label: string }> = [
    { value: '', label: 'Transparent' },
    { value: '#fff59d', label: 'Yellow' },
    { value: '#ffccbc', label: 'Orange' },
    { value: '#c5e1a5', label: 'Green' },
    { value: '#b3e5fc', label: 'Light Blue' },
    { value: '#ce93d8', label: 'Purple' },
    { value: '#f8bbd0', label: 'Pink' },
    { value: '#ffffff', label: 'White' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#000000', label: 'Black' },
  ];

  // Defaults for custom inputs
  textColor = '#000000';
  highlightColor = '#fff59d';
  cellFillColor = '';

  get formattingState() {
    return this.toolbarService.formattingState();
  }

  get isFormatPainterActive(): boolean {
    return this.toolbarService.formatPainterActive();
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

  onMergeClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.requestMergeCells();
  }

  onUnmergeClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.requestUnmerge();
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

  toggleTextColorDropdown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    this.showTextColorDropdown.update(v => !v);
    // Close other dropdowns
    this.showHighlightDropdown.set(false);
    this.showCellFillDropdown.set(false);
  }

  toggleHighlightDropdown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    this.showHighlightDropdown.update(v => !v);
    // Close other dropdowns
    this.showTextColorDropdown.set(false);
    this.showCellFillDropdown.set(false);
  }

  toggleCellFillDropdown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    this.showCellFillDropdown.update(v => !v);
    // Close other dropdowns
    this.showTextColorDropdown.set(false);
    this.showHighlightDropdown.set(false);
  }

  onTextColorPick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    const input = event.target as HTMLInputElement;
    const color = input.value || this.textColor;
    this.textColor = color;
    this.toolbarService.applyTextColor(color);
    this.showTextColorDropdown.set(false);
  }

  onHighlightPick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    const input = event.target as HTMLInputElement;
    const color = input.value || this.highlightColor;
    this.highlightColor = color;
    this.toolbarService.applyTextHighlight(color);
    this.showHighlightDropdown.set(false);
  }

  onCellFillPick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    const input = event.target as HTMLInputElement;
    const color = input.value || this.cellFillColor;
    this.cellFillColor = color;
    this.toolbarService.applyCellBackgroundColor(color);
    this.showCellFillDropdown.set(false);
  }

  onSwatchTextColor(event: MouseEvent, color: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    this.textColor = color;
    this.toolbarService.applyTextColor(color);
    this.showTextColorDropdown.set(false);
  }

  onSwatchHighlight(event: MouseEvent, color: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    this.highlightColor = color;
    this.toolbarService.applyTextHighlight(color);
    this.showHighlightDropdown.set(false);
  }

  onSwatchCellFill(event: MouseEvent, color: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    this.cellFillColor = color;
    this.toolbarService.applyCellBackgroundColor(color);
    this.showCellFillDropdown.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showTextColorDropdown.set(false);
      this.showHighlightDropdown.set(false);
      this.showCellFillDropdown.set(false);
    }
  }

  onFormatPainterClick(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestFormatPainterToggle();
  }
}

