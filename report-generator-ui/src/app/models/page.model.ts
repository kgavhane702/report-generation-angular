import { UUID } from './document.model';
import { WidgetModel } from './widget.model';
import { SlideLayoutType } from '../core/slide-design/slide-design.model';

export interface PageModel {
  id: UUID;
  number: number;
  title?: string;
  widgets: WidgetModel[];
  background?: BackgroundSpec;
  orientation?: 'portrait' | 'landscape';
  /** PPT-like logical layout for this page (Title, Comparison, Blank, etc.) */
  slideLayoutType?: SlideLayoutType;
  /** Resolved design variant id from active theme mapping (e.g. A1/A2/B1) */
  slideVariantId?: string;
}

export interface BackgroundSpec {
  type: 'color' | 'image' | 'gradient';
  value: string;
  opacity?: number;
}

