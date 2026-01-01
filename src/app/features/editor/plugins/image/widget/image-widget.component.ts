import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
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

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toolbarService = inject(ImageToolbarService);
  private readonly uiState = inject(UIStateService);

  private subscriptions: Subscription[] = [];

  isUploading = false;
  imageError = false;

  uploadDialogOpen = false;
  uploadFile: File | null = null;
  uploadFileName: string | null = null;
  uploadError: string | null = null;

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
          this.openUploadDialog();
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

  openUploadDialog(): void {
    if (this.isUploading) return;
    this.uploadDialogOpen = true;
    this.uploadFile = null;
    this.uploadFileName = null;
    this.uploadError = null;
    this.cdr.markForCheck();
  }

  cancelUpload(): void {
    if (this.isUploading) return;
    this.uploadDialogOpen = false;
    this.uploadFile = null;
    this.uploadFileName = null;
    this.uploadError = null;
    this.cdr.markForCheck();
  }

  onDialogFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // reset immediately so selecting same file again triggers change
    input.value = '';

    if (this.isUploading) return;
    if (!file) return;

    this.uploadFile = file;
    this.uploadFileName = file.name;
    this.uploadError = null;
    this.cdr.markForCheck();
  }

  async confirmUpload(): Promise<void> {
    const file = this.uploadFile;
    if (!file || this.isUploading) return;

    const validationError = this.validateFile(file);
    if (validationError) {
      this.uploadError = validationError;
      this.cdr.markForCheck();
      return;
    }

    this.isUploading = true;
    this.imageError = false;
    this.uploadError = null;
    this.cdr.markForCheck();

    try {
      const base64String = await this.convertFileToBase64(file);
      if (base64String) {
        this.propsChange.emit({
          src: base64String,
          alt: file.name,
          fit: this.imageProps?.fit || 'contain',
        });
        this.uploadDialogOpen = false;
        this.uploadFile = null;
        this.uploadFileName = null;
        this.uploadError = null;
      } else {
        this.uploadError = 'Failed to read image. Please try another file.';
      }
    } catch {
      this.uploadError = 'Failed to read image. Please try another file.';
    } finally {
      this.isUploading = false;
      this.cdr.markForCheck();
    }
  }

  handleImageError(): void {
    this.imageError = true;
    this.cdr.markForCheck();
  }

  onImageClick(): void {
    // Clicking the image should always open the upload/replace dialog (as requested).
    this.openUploadDialog();
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

  private validateFile(file: File): string | null {
    if (!this.ACCEPTED_TYPES.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG).';
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return `Image size must be less than ${this.MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    }

    return null;
  }
}

