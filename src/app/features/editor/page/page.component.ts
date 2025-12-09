import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  inject,
} from '@angular/core';

import { PageModel } from '../../../models/page.model';
import { PageSize } from '../../../models/document.model';
import { DocumentService } from '../../../core/services/document.service';

@Component({
  selector: 'app-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageComponent {
  @Input({ required: true }) page!: PageModel;
  @Input({ required: true }) pageSize!: PageSize;
  @Input({ required: true }) subsectionId!: string;
  @Input() isActive = false;

  private readonly documentService = inject(DocumentService);

  @HostBinding('class.page') hostClass = true;

  get widthPx(): number {
    return this.convertMmToPx(this.getOrientedSize().widthMm);
  }

  get heightPx(): number {
    return this.convertMmToPx(this.getOrientedSize().heightMm);
  }

  get surfaceId(): string {
    return `page-surface-${this.page.id}`;
  }

  get surfaceSelector(): string {
    return `#${this.surfaceId}`;
  }

  get displayLogoUrl(): string {
    const logo = this.documentService.document.logo;
    return logo?.url || '/assets/logo.png';
  }

  get footerLeftText(): string | undefined {
    return this.documentService.document.footer?.leftText;
  }

  get footerCenterText(): string | undefined {
    return this.documentService.document.footer?.centerText;
  }

  get footerSubText(): string | undefined {
    return this.documentService.document.footer?.centerSubText;
  }

  get showPageNumber(): boolean {
    return this.documentService.document.footer?.showPageNumber !== false;
  }

  trackByWidgetId(index: number, widget: any): string {
    return widget.id;
  }

  private convertMmToPx(mm: number): number {
    const dpi = this.pageSize.dpi ?? 96;
    const inches = mm / 25.4;
    return Math.round(inches * dpi);
  }

  private getOrientedSize(): { widthMm: number; heightMm: number } {
    const { widthMm, heightMm } = this.pageSize;
    const orientation = this.page.orientation || 'landscape';

    // Landscape: width > height (wider)
    // Portrait: height > width (taller)
    if (orientation === 'portrait') {
      // Portrait: height should be greater than width (taller)
      // If current width > height, swap them
      if (widthMm > heightMm) {
        return {
          widthMm: heightMm,
          heightMm: widthMm,
        };
      }
      // Already in portrait orientation
      return { widthMm, heightMm };
    }

    // Landscape: width should be greater than height (wider)
    // If current height > width, swap them
    if (heightMm > widthMm) {
      return {
        widthMm: heightMm,
        heightMm: widthMm,
      };
    }
    // Already in landscape orientation
    return { widthMm, heightMm };
  }
}

