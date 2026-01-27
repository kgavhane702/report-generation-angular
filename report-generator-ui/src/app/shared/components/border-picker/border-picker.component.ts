import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColorOption } from '../color-picker/color-picker.component';
import { AnchoredDropdownComponent } from '../dropdown/anchored-dropdown/anchored-dropdown.component';

export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';

export interface BorderValue {
  color: string; // '' = transparent / clear
  width: number; // px
  style: BorderStyle;
  borderRadius?: number; // px
}

@Component({
  selector: 'app-border-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, AnchoredDropdownComponent],
  templateUrl: './border-picker.component.html',
  styleUrls: ['./border-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BorderPickerComponent {
  @Input() disabled = false;
  @Input() title?: string;
  @Input() colorPalette: ColorOption[] = [];

  @Input() value: BorderValue = { color: '', width: 1, style: 'solid', borderRadius: 0 };

  @Output() valueChange = new EventEmitter<BorderValue>();

  readonly showDropdown = signal(false);
  constructor() {}

  toggleDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.disabled) return;
    this.showDropdown.update((v) => !v);
  }

  setColor(color: string, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.emit({ ...this.value, color });
  }

  setStyle(style: BorderStyle, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.emit({ ...this.value, style });
  }

  setWidth(width: number): void {
    const w = Math.max(1, Math.min(20, Math.trunc(Number(width) || 1)));
    this.emit({ ...this.value, width: w });
  }

  setBorderRadius(radius: number): void {
    const r = Math.max(0, Math.min(100, Math.trunc(Number(radius) || 0)));
    this.emit({ ...this.value, borderRadius: r });
  }

  onCustomColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.emit({ ...this.value, color: input.value });
    }
  }

  getDisplayColor(): string {
    return this.value.color || 'transparent';
  }

  getPreviewBorder(): string {
    const color = this.value.color || '#cbd5e1';
    const style = this.value.style || 'solid';
    const width = Math.max(1, this.value.width || 1);
    // For "none", show a faint placeholder so user still sees the control.
    if (style === 'none') {
      return `1px solid rgba(15, 23, 42, 0.25)`;
    }
    return `${width}px ${style} ${color}`;
  }

  private emit(next: BorderValue): void {
    this.valueChange.emit(next);
  }
}


