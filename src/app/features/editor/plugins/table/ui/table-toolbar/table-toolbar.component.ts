import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableToolbarService } from '../../../../../../core/services/table-toolbar.service';
import { ColorPickerComponent, ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';
import { BorderPickerComponent, BorderValue } from '../../../../../../shared/components/border-picker/border-picker.component';
import { AnchoredDropdownComponent } from '../../../../../../shared/components/dropdown/anchored-dropdown/anchored-dropdown.component';

/**
 * TableToolbarComponent
 * 
 * Formatting toolbar for table widget cells.
 * Provides bold, italic, and alignment controls.
 */
@Component({
  selector: 'app-table-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ColorPickerComponent, BorderPickerComponent, AnchoredDropdownComponent],
  templateUrl: './table-toolbar.component.html',
  styleUrls: ['./table-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableToolbarComponent {
  private readonly toolbarService = inject(TableToolbarService);

  @ViewChild('fontSizeTrigger', { static: false }) fontSizeTrigger?: ElementRef<HTMLElement>;
  @ViewChild('lineHeightTrigger', { static: false }) lineHeightTrigger?: ElementRef<HTMLElement>;
  @ViewChild('bulletStyleTrigger', { static: false }) bulletStyleTrigger?: ElementRef<HTMLElement>;

  splitDialogOpen = false;
  splitRows = 2;
  splitCols = 2;
  splitMax = 20;

  // Bullet style options
  readonly bulletStyles: Array<{ value: string; label: string; icon: string }> = [
    { value: 'disc', label: 'Filled Circle', icon: '●' },
    { value: 'circle', label: 'Hollow Circle', icon: '○' },
    { value: 'square', label: 'Square', icon: '■' },
    { value: 'chevron', label: 'Chevron', icon: '›' },
    { value: 'arrow', label: 'Arrow', icon: '➤' },
    { value: 'dash', label: 'Dash', icon: '–' },
    { value: 'check', label: 'Checkmark', icon: '✓' },
  ];
  bulletStyleDropdownOpen = signal(false);

  // Text color palette
  readonly textColorPalette: ColorOption[] = [
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
  readonly highlightFillPalette: ColorOption[] = [
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
  borderColor = '';
  borderWidth = 1;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none' = 'solid';

  // Font controls
  readonly fontFamilies: Array<{ label: string; value: string }> = [
    { label: 'Default', value: '' },
    { label: 'Inter', value: 'Inter' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Calibri', value: 'Calibri' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Times New Roman', value: '"Times New Roman"' },
    { label: 'Courier New', value: '"Courier New"' },
    { label: 'Verdana', value: 'Verdana' },
  ];

  // Full list (shown in our custom dropdown; no internal scroll).
  readonly fontSizes: Array<number> = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];

  readonly fontSizeDropdownOpen = signal(false);
  readonly lineHeightDropdownOpen = signal(false);

  get fontFamilyModel(): string {
    const current = this.formattingState.fontFamily ?? '';
    const first = current.split(',')[0]?.trim() ?? '';
    if (!first) return '';
    const normalized = this.normalizeFontFamily(first);
    const known = this.fontFamilies.some((f) => f.value === normalized);
    return known ? normalized : '';
  }

  private normalizeFontFamily(family: string): string {
    const f = (family ?? '').trim();
    if (!f) return '';
    if (f.startsWith('"') || f.startsWith("'")) return f;
    if (/\s/.test(f)) return `"${f}"`;
    return f;
  }

  openFontSizeDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.hasActiveCell) return;
    this.fontSizeDropdownOpen.set(true);
  }

  closeFontSizeDropdown(): void {
    this.fontSizeDropdownOpen.set(false);
  }

  onFontSizePick(size: number): void {
    this.onFontSizeChange(size);
    this.fontSizeDropdownOpen.set(false);
  }

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

  onUnderlineClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.applyUnderline();
  }

  onStrikethroughClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.applyStrikethrough();
  }

  onSuperscriptClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.applySuperscript();
  }

  onSubscriptClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.applySubscript();
  }

  onIncreaseIndentClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.increaseIndent();
  }

  onDecreaseIndentClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.decreaseIndent();
  }

  onBulletListClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveCell) return;
    this.bulletStyleDropdownOpen.set(true);
  }

  onBulletStyleSelect(style: string): void {
    this.bulletStyleDropdownOpen.set(false);
    if (!this.hasActiveCell) return;
    this.toolbarService.toggleBulletList(style);
  }

  closeBulletStyleDropdown(): void {
    this.bulletStyleDropdownOpen.set(false);
  }

  onNumberedListClick(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.toggleNumberedList();
  }

  // Line height
  readonly lineHeights: Array<string> = ['1', '1.15', '1.3', '1.4', '1.5', '1.75', '2'];

  openLineHeightDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.hasActiveCell) return;
    this.lineHeightDropdownOpen.set(true);
  }

  closeLineHeightDropdown(): void {
    this.lineHeightDropdownOpen.set(false);
  }

  onLineHeightPick(v: string): void {
    if (!this.hasActiveCell) return;
    this.toolbarService.applyLineHeight(v);
    this.lineHeightDropdownOpen.set(false);
  }

  onAlignClick(event: MouseEvent, align: 'left' | 'center' | 'right'): void {
    event.preventDefault();
    this.toolbarService.applyTextAlign(align);
  }

  onVerticalAlignClick(event: MouseEvent, align: 'top' | 'middle' | 'bottom'): void {
    event.preventDefault();
    this.toolbarService.applyVerticalAlign(align);
  }

  onTextColorSelected(color: string): void {
    if (!this.hasActiveCell) return;
    this.textColor = color;
    this.toolbarService.applyTextColor(color);
  }

  onHighlightSelected(color: string): void {
    if (!this.hasActiveCell) return;
    this.highlightColor = color;
    this.toolbarService.applyTextHighlight(color);
  }

  onCellFillSelected(color: string): void {
    if (!this.hasActiveCell) return;
    this.cellFillColor = color;
    this.toolbarService.applyCellBackgroundColor(color);
  }

  onBorderValueChange(value: BorderValue): void {
    if (!this.hasActiveCell) return;
    this.borderColor = value.color;
    this.borderWidth = value.width;
    this.borderStyle = value.style;

    // Transparent => clear custom border and fall back to default cell border.
    if (!value.color || value.style === 'none') {
      this.toolbarService.applyCellBorder({ color: null, width: null, style: null });
      return;
    }

    this.toolbarService.applyCellBorder({
      color: value.color,
      width: Math.max(1, Math.min(20, Math.trunc(Number(value.width) || 1))),
      style: value.style,
    });
  }

  onFormatPainterClick(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestFormatPainterToggle();
  }

  onFontFamilyChange(value: string): void {
    if (!this.hasActiveCell) return;
    this.toolbarService.applyFontFamily(value);
  }

  onFontSizeChange(value: string | number | null): void {
    if (!this.hasActiveCell) return;
    const v = (value ?? '').toString().trim();
    if (!v) {
      this.toolbarService.applyFontSizePx(null);
      return;
    }
    const px = Math.max(6, Math.min(96, Math.trunc(Number(v))));
    if (!Number.isFinite(px)) return;
    this.toolbarService.applyFontSizePx(px);
  }

  onInsertRowAbove(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'row', placement: 'before' });
  }

  onInsertRowBelow(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'row', placement: 'after' });
  }

  onInsertColLeft(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'col', placement: 'before' });
  }

  onInsertColRight(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'col', placement: 'after' });
  }

  onDeleteRow(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestDelete({ axis: 'row' });
  }

  onDeleteCol(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestDelete({ axis: 'col' });
  }
}

