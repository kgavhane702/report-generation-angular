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
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  effect,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { ImageWidgetProps, WidgetModel } from '../../../../../models/widget.model';
import { ImageToolbarService } from '../../../../../core/services/image-toolbar.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';

@Component({
  selector: 'app-image-widget',
  templateUrl: './image-widget.component.html',
  styleUrls: ['./image-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageWidgetComponent implements OnInit, OnDestroy, OnChanges {
  @Input({ required: true }) widget!: WidgetModel;
  @Output() propsChange = new EventEmitter<Partial<ImageWidgetProps>>();

  @ViewChild('fileInput', { static: false }) fileInputRef?: ElementRef<HTMLInputElement>;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toolbarService = inject(ImageToolbarService);
  private readonly uiState = inject(UIStateService);

  private subscriptions: Subscription[] = [];

  isUploading = false;
  imageError = false;

  // Effect to activate/deactivate toolbar when this widget is selected/deselected
  private readonly selectionEffect = effect(() => {
    const activeWidgetId = this.uiState.activeWidgetId();
    if (activeWidgetId === this.widget?.id && this.imageProps) {
      this.toolbarService.activate(this.widget.id, this.imageProps);
    } else if (this.toolbarService.currentState.widgetId === this.widget?.id) {
      this.toolbarService.deactivate();
    }
  });

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

  /** Compute transform style for flip/rotation */
  get imageTransformStyle(): string {
    const transforms: string[] = [];
    
    if (this.imageProps?.flipHorizontal) {
      transforms.push('scaleX(-1)');
    }
    if (this.imageProps?.flipVertical) {
      transforms.push('scaleY(-1)');
    }
    if (this.imageProps?.rotation) {
      transforms.push(`rotate(${this.imageProps.rotation}deg)`);
    }
    
    return transforms.length > 0 ? transforms.join(' ') : 'none';
  }

  /** Compute opacity style */
  get imageOpacityStyle(): number {
    return (this.imageProps?.opacity ?? 100) / 100;
  }

  /** Compute border style */
  get imageBorderStyle(): string {
    const width = this.imageProps?.borderWidth ?? 0;
    const color = this.imageProps?.borderColor ?? '#000000';
    return width > 0 ? `${width}px solid ${color}` : 'none';
  }

  /** Compute border radius */
  get imageBorderRadiusStyle(): string {
    const radius = this.imageProps?.borderRadius ?? 0;
    return radius > 0 ? `${radius}px` : '0';
  }

  ngOnInit(): void {
    // Listen for toolbar props changes
    this.subscriptions.push(
      this.toolbarService.propsChange$.subscribe(({ widgetId, changes }) => {
        if (widgetId === this.widget.id) {
          this.propsChange.emit(changes);
        }
      })
    );

    // Listen for replace image requests
    this.subscriptions.push(
      this.toolbarService.replaceRequest$.subscribe((widgetId) => {
        if (widgetId === this.widget.id) {
          this.onBrowseClick();
        }
      })
    );

    // Activate toolbar if this widget is active
    this.checkAndActivateToolbar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget']) {
      this.checkAndActivateToolbar();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    // Deactivate toolbar if this widget was active
    if (this.toolbarService.currentState.widgetId === this.widget.id) {
      this.toolbarService.deactivate();
    }
  }

  private checkAndActivateToolbar(): void {
    const activeWidgetId = this.uiState.activeWidgetId();
    if (activeWidgetId === this.widget.id && this.imageProps) {
      this.toolbarService.activate(this.widget.id, this.imageProps);
    }
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

