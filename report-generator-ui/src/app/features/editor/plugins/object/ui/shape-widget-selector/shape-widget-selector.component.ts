import { ChangeDetectionStrategy, Component, EventEmitter, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../../../../../shared/components/icon/icon.component';
import {
  ShapeConfig,
  ShapeCategory,
  SHAPE_CONFIGS,
  SHAPE_CATEGORIES,
  getShapesByCategory,
  getCategoryConfig,
} from '../../config/shape.config';

@Component({
  selector: 'app-shape-widget-selector',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './shape-widget-selector.component.html',
  styleUrls: ['./shape-widget-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShapeWidgetSelectorComponent {
  @Output() shapeSelected = new EventEmitter<ShapeConfig>();

  readonly isOpen = signal<boolean>(false);

  /** All available shape categories (sorted) */
  readonly categories = SHAPE_CATEGORIES.sort((a, b) => a.order - b.order);

  /** Get shapes for a category */
  getShapesForCategory(categoryId: ShapeCategory): ShapeConfig[] {
    return getShapesByCategory(categoryId);
  }

  /** Check if a category has shapes */
  categoryHasShapes(categoryId: ShapeCategory): boolean {
    return getShapesByCategory(categoryId).length > 0;
  }

  toggleDropdown(): void {
    this.isOpen.update((v) => !v);
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  select(shape: ShapeConfig, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.shapeSelected.emit(shape);
    this.closeDropdown();
  }

  onBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeDropdown();
  }
}
