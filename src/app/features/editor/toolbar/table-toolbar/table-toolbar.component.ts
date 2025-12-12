import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { DocumentService } from '../../../../core/services/document.service';
import { TableSelectionService } from '../../../../core/services/table-selection.service';
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
  private readonly cdr = inject(ChangeDetectorRef);

  activeWidget: WidgetModel<AdvancedTableWidgetProps> | null = null;
  isAdvancedTableActive = false;

  // Style states
  textAlign: 'left' | 'center' | 'right' | 'justify' = 'left';
  fontWeight: 'normal' | 'bold' = 'normal';
  fontStyle: 'normal' | 'italic' = 'normal';
  textDecoration: 'none' | 'underline' = 'none';

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

  private updateStyleStates(): void {
    // This will be called when we have selection info
    // For now, set defaults
    this.textAlign = 'left';
    this.fontWeight = 'normal';
    this.fontStyle = 'normal';
    this.textDecoration = 'none';
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
}

