import { UUID } from './document.model';
import { WidgetModel } from './widget.model';

export interface PageModel {
  id: UUID;
  number: number;
  widgets: WidgetModel[];
  background?: BackgroundSpec;
}

export interface BackgroundSpec {
  type: 'color' | 'image' | 'gradient';
  value: string;
  opacity?: number;
}

