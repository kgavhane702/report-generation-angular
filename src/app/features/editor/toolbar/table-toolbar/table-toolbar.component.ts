import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { DocumentService } from '../../../../core/services/document.service';
import { TableSelectionService } from '../../../../core/services/table-selection.service';
import { TableOperationsService } from '../../../../core/services/table-operations.service';
import { WidgetModel, AdvancedTableCellStyle, AdvancedTableWidgetProps } from '../../../../models/widget.model';

@Component({
  selector: 'app-table-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-toolbar.component.html',
  styleUrls: ['./table-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableToolbarComponent implements OnInit {
  private readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);
  private readonly tableSelectionService = inject(TableSelectionService);
  private readonly tableOperationsService = inject(TableOperationsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef);

  activeWidget: WidgetModel<AdvancedTableWidgetProps> | null = null;
  isAdvancedTableActive = false;

  // Style states
  textAlign: 'left' | 'center' | 'right' | 'justify' = 'left';
  fontWeight: 'normal' | 'bold' = 'normal';
  fontStyle: 'normal' | 'italic' = 'normal';
  textDecoration: 'none' | 'underline' = 'none';
  fontSize: number = 14;
  color: string = '#000000';
  backgroundColor: string = '';
  verticalAlign: 'top' | 'middle' | 'bottom' = 'middle';
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none' = 'solid';
  borderWidth: number = 1;
  borderColor: string = '#000000';
  
  // UI state
  showFontSizeDropdown = false;
  showTextColorDropdown = false;
  showBackgroundColorDropdown = false;
  showBorderDropdown = false;

  constructor() {
    // Watch for active widget changes
    effect(() => {
      const widget = this.editorState.activeWidget();
      this.isAdvancedTableActive = widget?.type === 'advanced-table';
      
      if (this.isAdvancedTableActive) {
        this.activeWidget = widget as WidgetModel<AdvancedTableWidgetProps>;
        this.updateStyleStates();
      } else {
        this.activeWidget = null;
      }
      
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Initial check
    const widget = this.editorState.activeWidget();
    this.isAdvancedTableActive = widget?.type === 'advanced-table';
    if (this.isAdvancedTableActive) {
      this.activeWidget = widget as WidgetModel<AdvancedTableWidgetProps>;
      this.updateStyleStates();
    }
    this.cdr.markForCheck();
  }

  // Font sizes
  readonly fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
  
  // Color palette
  readonly colorPalette = [
    { value: '', label: 'Transparent' },
    { value: '#ffffff', label: 'White' },
    { value: '#000000', label: 'Black' },
    { value: '#ef4444', label: 'Red' },
    { value: '#10b981', label: 'Green' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#f97316', label: 'Orange Red' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#fbbf24', label: 'Amber' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
  ];

  private updateStyleStates(): void {
    // This will be called when we have selection info
    // For now, set defaults
    this.textAlign = 'left';
    this.fontWeight = 'normal';
    this.fontStyle = 'normal';
    this.textDecoration = 'none';
    this.fontSize = 14;
    this.color = '#000000';
    this.backgroundColor = '';
    this.verticalAlign = 'middle';
    this.borderStyle = 'solid';
    this.borderWidth = 1;
    this.borderColor = '#000000';
  }

  applyTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
    if (!this.activeWidget) return;
    
    this.textAlign = align;
    this.applyStyle({ textAlign: align });
  }

  toggleBold(): void {
    if (!this.activeWidget) return;
    
    this.fontWeight = this.fontWeight === 'bold' ? 'normal' : 'bold';
    this.applyStyle({ fontWeight: this.fontWeight });
  }

  toggleItalic(): void {
    if (!this.activeWidget) return;
    
    this.fontStyle = this.fontStyle === 'italic' ? 'normal' : 'italic';
    this.applyStyle({ fontStyle: this.fontStyle });
  }

  toggleUnderline(): void {
    if (!this.activeWidget) return;
    
    this.textDecoration = this.textDecoration === 'underline' ? 'none' : 'underline';
    this.applyStyle({ textDecoration: this.textDecoration });
  }

  private applyStyle(style: Partial<AdvancedTableCellStyle>): void {
    if (!this.activeWidget) return;

    const subsectionId = this.editorState.activeSubsectionId();
    const pageId = this.editorState.activePageId();

    if (!subsectionId || !pageId) return;

    const currentStyles = this.activeWidget.props.cellStyles || {};
    const updatedStyles = { ...currentStyles };

    // Get selected cells from selection service
    const selectedCells = this.tableSelectionService.getSelectedCells();
    
    if (selectedCells.length > 0) {
      // Apply style to selected cells only
      selectedCells.forEach(cell => {
        const key = `${cell.row}-${cell.col}`;
        updatedStyles[key] = {
          ...updatedStyles[key],
          ...style,
        };
      });
    } else {
      // If no selection, apply to all cells (fallback)
      // This could be improved to show a message or apply to active cell
    }
    
    this.documentService.updateWidget(subsectionId, pageId, this.activeWidget.id, {
      props: {
        ...this.activeWidget.props,
        cellStyles: updatedStyles,
      } as any,
    });
  }

  get hasActiveTable(): boolean {
    return this.isAdvancedTableActive;
  }

  // Font size methods
  applyFontSize(size: number): void {
    if (!this.activeWidget) return;
    this.fontSize = size;
    this.applyStyle({ fontSize: size });
    this.showFontSizeDropdown = false;
  }

  // Color methods
  applyTextColor(color: string): void {
    if (!this.activeWidget) return;
    this.color = color || '#000000';
    this.applyStyle({ color: this.color });
    this.showTextColorDropdown = false;
  }

  applyBackgroundColor(color: string): void {
    if (!this.activeWidget) return;
    this.backgroundColor = color;
    this.applyStyle({ backgroundColor: color || undefined });
    this.showBackgroundColorDropdown = false;
  }

  onTextColorInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.applyTextColor(input.value);
    }
  }

  onBackgroundColorInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.applyBackgroundColor(input.value);
  }

  // Vertical alignment methods
  applyVerticalAlign(align: 'top' | 'middle' | 'bottom'): void {
    if (!this.activeWidget) return;
    this.verticalAlign = align;
    this.applyStyle({ verticalAlign: align });
  }

  // Border methods
  applyBorderStyle(style: 'solid' | 'dashed' | 'dotted' | 'none'): void {
    if (!this.activeWidget) return;
    this.borderStyle = style;
    this.applyStyle({ borderStyle: style });
  }

  applyBorderWidth(width: number): void {
    if (!this.activeWidget) return;
    this.borderWidth = width;
    this.applyStyle({ borderWidth: width });
  }

  applyBorderColor(color: string): void {
    if (!this.activeWidget) return;
    this.borderColor = color;
    this.applyStyle({ borderColor: color });
  }

  onBorderColorInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.applyBorderColor(input.value);
    }
  }

  getDisplayTextColor(): string {
    return this.color || '#000000';
  }

  getDisplayBackgroundColor(): string {
    return this.backgroundColor || 'transparent';
  }

  getDisplayBorderColor(): string {
    return this.borderColor || '#000000';
  }

  // Structure operation methods
  insertRowAbove(): void {
    this.tableOperationsService.insertRow(true);
  }

  insertRowBelow(): void {
    this.tableOperationsService.insertRow(false);
  }

  deleteRow(): void {
    this.tableOperationsService.deleteRow();
  }

  insertColumnLeft(): void {
    this.tableOperationsService.insertColumn(true);
  }

  insertColumnRight(): void {
    this.tableOperationsService.insertColumn(false);
  }

  deleteColumn(): void {
    this.tableOperationsService.deleteColumn();
  }

  mergeCells(): void {
    this.tableOperationsService.mergeCells();
  }

  unmergeCells(): void {
    this.tableOperationsService.unmergeCells();
  }

  // Copy/Paste methods
  copyCells(): void {
    this.tableOperationsService.copyCells();
  }

  pasteCells(): void {
    this.tableOperationsService.pasteCells();
  }

  cutCells(): void {
    this.tableOperationsService.cutCells();
  }

  undo(): void {
    this.tableOperationsService.undo();
  }

  redo(): void {
    this.tableOperationsService.redo();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showFontSizeDropdown = false;
      this.showTextColorDropdown = false;
      this.showBackgroundColorDropdown = false;
      this.showBorderDropdown = false;
      this.cdr.markForCheck();
    }
  }
}

