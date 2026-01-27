import { UUID } from './document.model';
import { WidgetModel } from './widget.model';

export interface PageModel {
  id: UUID;
  number: number;
  title?: string;
  widgets: WidgetModel[];
  background?: BackgroundSpec;
  orientation?: 'portrait' | 'landscape';
}

export interface BackgroundSpec {
  type: 'color' | 'image' | 'gradient';
  value: string;
  opacity?: number;
}

