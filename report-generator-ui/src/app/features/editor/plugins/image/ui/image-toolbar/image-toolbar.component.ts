import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ImageToolbarService } from '../../../../../../core/services/image-toolbar.service';
import { ImageWidgetProps } from '../../../../../../models/widget.model';
import { AppIconComponent } from '../../../../../../shared/components/icon/icon.component';
import { BorderPickerComponent, BorderValue } from '../../../../../../shared/components/border-picker/border-picker.component';
import { ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';

type FitMode = 'contain' | 'cover' | 'stretch';

@Component({
  selector: 'app-image-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, BorderPickerComponent],
  templateUrl: './image-toolbar.component.html',
  styleUrls: ['./image-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageToolbarComponent implements OnInit, OnDestroy {
  private readonly toolbarService = inject(ImageToolbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;

  @ViewChild('opacityInput') opacityInputRef?: ElementRef<HTMLInputElement>;

  widgetId: string | null = null;
  props: ImageWidgetProps | null = null;

  // Color palette for border (matching table toolbar)
  readonly colorPalette: ColorOption[] = [
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

  ngOnInit(): void {
    this.subscription = this.toolbarService.state$.subscribe((state) => {
      this.widgetId = state.widgetId;
      this.props = state.props;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get isActive(): boolean {
    return !!this.widgetId && !!this.props;
  }

  get currentFit(): FitMode {
    return this.props?.fit || 'contain';
  }

  get opacity(): number {
    return this.props?.opacity ?? 100;
  }

  get borderValue(): BorderValue {
    return {
      color: this.props?.borderColor || '',
      width: this.props?.borderWidth || 0,
      style: (this.props as any)?.borderStyle || 'solid',
      borderRadius: this.props?.borderRadius || 0,
    };
  }

  get isFlippedHorizontal(): boolean {
    return this.props?.flipHorizontal ?? false;
  }

  get isFlippedVertical(): boolean {
    return this.props?.flipVertical ?? false;
  }

  get rotation(): number {
    return this.props?.rotation ?? 0;
  }

  // ========== Actions ==========

  onReplaceImage(event: MouseEvent): void {
    event.preventDefault();
    if (this.widgetId) {
      this.toolbarService.requestReplace(this.widgetId);
    }
  }

  onFitChange(fit: FitMode, event: MouseEvent): void {
    event.preventDefault();
    this.emitChange({ fit });
  }

  onFlipHorizontal(event: MouseEvent): void {
    event.preventDefault();
    this.emitChange({ flipHorizontal: !this.isFlippedHorizontal });
  }

  onFlipVertical(event: MouseEvent): void {
    event.preventDefault();
    this.emitChange({ flipVertical: !this.isFlippedVertical });
  }

  onRotateLeft(event: MouseEvent): void {
    event.preventDefault();
    const newRotation = (this.rotation - 90 + 360) % 360;
    this.emitChange({ rotation: newRotation });
  }

  onRotateRight(event: MouseEvent): void {
    event.preventDefault();
    const newRotation = (this.rotation + 90) % 360;
    this.emitChange({ rotation: newRotation });
  }

  onOpacityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.min(100, Math.max(0, parseInt(input.value, 10) || 100));
    this.emitChange({ opacity: value });
  }

  onBorderValueChange(value: BorderValue): void {
    this.emitChange({
      borderWidth: value.width,
      borderColor: value.color,
      borderStyle: value.style as any,
      borderRadius: value.borderRadius || 0,
    });
  }

  private emitChange(changes: Partial<ImageWidgetProps>): void {
    if (this.widgetId) {
      this.toolbarService.requestPropsChange(this.widgetId, changes);
    }
  }
}

