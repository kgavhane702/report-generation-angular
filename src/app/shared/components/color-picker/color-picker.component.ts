import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnchoredDropdownComponent } from '../dropdown/anchored-dropdown/anchored-dropdown.component';

export interface ColorOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule, AnchoredDropdownComponent],
  templateUrl: './color-picker.component.html',
  styleUrls: ['./color-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPickerComponent {
  @Input() currentColor: string = '';
  @Input() colorPalette: ColorOption[] = [];
  @Input() icon?: string; // Material icon name or text label
  @Input() label?: string; // Optional label text
  @Input() disabled: boolean = false;
  @Input() showLabel: boolean = true; // Show label in dropdown
  @Input() title?: string; // Tooltip text

  @Output() colorSelected = new EventEmitter<string>();

  readonly showDropdown = signal(false);

  constructor() {}

  isMaterialIcon(icon: string): boolean {
    // Material Symbols icons typically start with specific prefixes
    return icon.startsWith('format_') || 
           icon.startsWith('palette') || 
           icon.startsWith('color') ||
           icon.includes('_');
  }

  toggleDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.disabled) return;
    this.showDropdown.update((value) => !value);
  }

  selectColor(color: string, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.colorSelected.emit(color);
    this.showDropdown.set(false);
  }

  onCustomColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectColor(input.value);
    }
  }

  getDisplayColor(): string {
    return this.currentColor || 'transparent';
  }
}

