import { ChangeDetectionStrategy, Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../../../../../shared/components/icon/icon.component';

export type ChartWidgetInsertAction = 'sample' | 'placeholder' | 'import';

@Component({
  selector: 'app-chart-widget-selector',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './chart-widget-selector.component.html',
  styleUrls: ['./chart-widget-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartWidgetSelectorComponent {
  @Output() actionSelected = new EventEmitter<ChartWidgetInsertAction>();

  readonly isOpen = signal<boolean>(false);

  toggleDropdown(): void {
    this.isOpen.update((v) => !v);
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  select(action: ChartWidgetInsertAction, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.actionSelected.emit(action);
    this.closeDropdown();
  }

  onBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeDropdown();
  }
}


