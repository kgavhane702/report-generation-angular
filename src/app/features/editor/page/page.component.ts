import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
} from '@angular/core';

import { PageModel } from '../../../models/page.model';
import { PageSize } from '../../../models/document.model';

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

  trackByWidgetId(index: number, widget: any): string {
    return widget.id;
  }

  private convertMmToPx(mm: number): number {
    const dpi = this.pageSize.dpi ?? 96;
    const inches = mm / 25.4;
    return Math.round(inches * dpi);
  }

  private getOrientedSize(): { widthMm: number; heightMm: number } {
    const { widthMm, heightMm, orientation = 'landscape' } = this.pageSize;
    const normalizedHeight = heightMm;

    if (orientation === 'portrait') {
      return {
        widthMm: Math.min(widthMm, heightMm),
        heightMm: normalizedHeight,
      };
    }

    return {
      widthMm: Math.max(widthMm, heightMm),
      heightMm: normalizedHeight,
    };
  }
}

