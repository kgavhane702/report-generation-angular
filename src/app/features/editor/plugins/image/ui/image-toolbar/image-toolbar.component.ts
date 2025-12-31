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
import { ColorPickerComponent, ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';

type FitMode = 'contain' | 'cover' | 'stretch';

@Component({
  selector: 'app-image-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, ColorPickerComponent],
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

  // Color palette for border
  readonly colorPalette: ColorOption[] = [
    { value: '#000000', label: 'Black' },
    { value: '#ffffff', label: 'White' },
    { value: '#374151', label: 'Gray 700' },
    { value: '#6b7280', label: 'Gray 500' },
    { value: '#9ca3af', label: 'Gray 400' },
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#22c55e', label: 'Green' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#f43f5e', label: 'Rose' },
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

  get borderWidth(): number {
    return this.props?.borderWidth ?? 0;
  }

  get borderColor(): string {
    return this.props?.borderColor ?? '#000000';
  }

  get borderRadius(): number {
    return this.props?.borderRadius ?? 0;
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

  onBorderWidthChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.max(0, parseInt(input.value, 10) || 0);
    this.emitChange({ borderWidth: value });
  }

  onBorderColorChange(color: string): void {
    this.emitChange({ borderColor: color });
  }

  onBorderRadiusChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Math.max(0, parseInt(input.value, 10) || 0);
    this.emitChange({ borderRadius: value });
  }

  private emitChange(changes: Partial<ImageWidgetProps>): void {
    if (this.widgetId) {
      this.toolbarService.requestPropsChange(this.widgetId, changes);
    }
  }
}

