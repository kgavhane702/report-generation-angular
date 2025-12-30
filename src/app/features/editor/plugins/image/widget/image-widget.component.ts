import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';

import { ImageWidgetProps, WidgetModel } from '../../../../../models/widget.model';

@Component({
  selector: 'app-image-widget',
  templateUrl: './image-widget.component.html',
  styleUrls: ['./image-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageWidgetComponent {
  @Input({ required: true }) widget!: WidgetModel;
  @Output() propsChange = new EventEmitter<Partial<ImageWidgetProps>>();

  @ViewChild('fileInput', { static: false }) fileInputRef?: ElementRef<HTMLInputElement>;

  private readonly cdr = inject(ChangeDetectorRef);

  isUploading = false;
  imageError = false;

  // Maximum file size: 10MB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  // Accepted image types
  private readonly ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

  get imageProps(): ImageWidgetProps {
    return this.widget.props as ImageWidgetProps;
  }

  get hasImage(): boolean {
    const src = this.imageProps?.src;
    // Check if src exists, is not empty, and is not a placeholder URL
    return !!src && src.trim() !== '' && !src.includes('placehold.co') && !this.imageError;
  }

  get imageFitStyle(): string {
    const fit = this.imageProps?.fit || 'contain';
    // CSS object-fit uses 'fill' for stretching.
    if (fit === 'stretch') return 'fill';
    return fit;
  }

  onBrowseClick(): void {
    if (this.isUploading) {
      return;
    }
    this.fileInputRef?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    if (!this.ACCEPTED_TYPES.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG)');
      this.resetFileInput();
      return;
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      alert(`Image size must be less than ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
      this.resetFileInput();
      return;
    }

    this.isUploading = true;
    this.imageError = false;
    this.cdr.markForCheck();

    this.convertFileToBase64(file)
      .then((base64String) => {
        if (base64String) {
          this.propsChange.emit({
            src: base64String,
            alt: file.name,
            fit: this.imageProps?.fit || 'contain',
          });
        } else {
          this.imageError = true;
        }
        this.isUploading = false;
        this.resetFileInput();
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.imageError = true;
        this.isUploading = false;
        this.resetFileInput();
        this.cdr.markForCheck();
      });
  }

  handleImageError(): void {
    this.imageError = true;
    this.cdr.markForCheck();
  }

  onImageClick(): void {
    // Optional: Allow clicking on image to replace it
    // For now, we'll only allow browsing when there's no image
    if (!this.hasImage || this.imageError) {
      this.onBrowseClick();
    }
  }

  private convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  private resetFileInput(): void {
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }
}

