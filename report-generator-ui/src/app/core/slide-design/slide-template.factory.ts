import { v4 as uuid } from 'uuid';

import { EditastraWidgetProps, WidgetModel } from '../../models/widget.model';
import { DEFAULT_SLIDE_THEME_ID, getSlideThemeById } from './slide-design.config';

export function createInitialTitleSlidePlaceholders(): WidgetModel[] {
  const titleVariant = getSlideThemeById(DEFAULT_SLIDE_THEME_ID).variants[0];
  const titleFontSize = titleVariant.titleFontSize || '34px';

  const titleWidget: WidgetModel<EditastraWidgetProps> = {
    id: uuid(),
    type: 'editastra',
    position: { x: 80, y: 160 },
    size: { width: 800, height: 90 },
    zIndex: 1,
    props: {
      contentHtml: '',
      placeholder: 'Click to add title',
      isTemplatePlaceholder: true,
      placeholderResolved: false,
      backgroundColor: 'transparent',
      fontSize: titleFontSize,
      fontWeight: titleVariant.titleFontWeight || 700,
      textAlign: 'center',
      verticalAlign: 'top',
    },
  };

  const subtitleWidget: WidgetModel<EditastraWidgetProps> = {
    id: uuid(),
    type: 'editastra',
    position: { x: 160, y: 305 },
    size: { width: 640, height: 70 },
    zIndex: 1,
    props: {
      contentHtml: '',
      placeholder: 'Click to add subtitle',
      isTemplatePlaceholder: true,
      placeholderResolved: false,
      backgroundColor: 'transparent',
      fontSize: '18px',
      fontWeight: 400,
      textAlign: 'center',
      verticalAlign: 'top',
    },
  };

  return [titleWidget, subtitleWidget];
}
