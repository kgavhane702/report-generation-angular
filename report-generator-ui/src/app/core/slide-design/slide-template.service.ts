import { Injectable, inject } from '@angular/core';

import { WidgetFactoryService } from '../../features/editor/widget-host/widget-factory.service';
import { PageSize } from '../../models/document.model';
import { EditastraWidgetProps, WidgetModel } from '../../models/widget.model';
import { getOrientedPageSizeMm, mmToPx } from '../utils/page-dimensions.util';
import { SlideLayoutType, SlideThemeVariant } from './slide-design.model';

/** Role of a placeholder — drives font/size/alignment defaults */
export type PlaceholderRole = 'title' | 'subtitle' | 'section-title' | 'section-subtitle' | 'heading' | 'body';

export interface PlaceholderSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  placeholder: string;
  role: PlaceholderRole;
}

@Injectable({ providedIn: 'root' })
export class SlideTemplateService {
  private readonly widgetFactory = inject(WidgetFactoryService);

  createTemplateWidgets(args: {
    layout: SlideLayoutType;
    pageSize: PageSize;
    orientation: 'portrait' | 'landscape';
    variant?: SlideThemeVariant;
  }): WidgetModel[] {
    const oriented = getOrientedPageSizeMm(args.pageSize, args.orientation);
    const pageWidth = mmToPx(oriented.widthMm, args.pageSize.dpi ?? 96);
    const pageHeight = mmToPx(oriented.heightMm, args.pageSize.dpi ?? 96);
    const specs = this.getSlidePlaceholderSpecs(args.layout, pageWidth, pageHeight, args.variant);
    return specs.map((spec) => this.createPlaceholderTextWidget(spec, args.variant));
  }

  private createPlaceholderTextWidget(
    spec: PlaceholderSpec,
    variant?: SlideThemeVariant,
  ): WidgetModel {
    const widget = this.widgetFactory.createWidget('editastra');
    const props = widget.props as EditastraWidgetProps;

    const { fontSize, fontWeight, textAlign, verticalAlign } = this.getStyleForRole(spec.role, variant);

    widget.position = { x: Math.round(spec.x), y: Math.round(spec.y) };
    widget.size = { width: Math.round(spec.width), height: Math.round(spec.height) };
    widget.props = {
      ...props,
      contentHtml: '',
      placeholder: spec.placeholder,
      backgroundColor: 'transparent',
      fontSize,
      fontWeight,
      textAlign,
      verticalAlign,
    } as EditastraWidgetProps;

    return widget;
  }

  /**
   * Return font size, weight, alignment based on placeholder role and optional theme variant.
   */
  private getStyleForRole(
    role: PlaceholderRole,
    variant?: SlideThemeVariant,
  ): { fontSize: string; fontWeight: number; textAlign: 'left' | 'center' | 'right'; verticalAlign: 'top' | 'middle' | 'bottom' } {
    const titleFont = variant?.titleFontSize || '28px';
    const titleWeight = variant?.titleFontWeight || 700;
    const isCurvy = (variant?.id ?? '').startsWith('G');

    switch (role) {
      case 'title':
        return { fontSize: titleFont, fontWeight: titleWeight, textAlign: 'center', verticalAlign: 'middle' };
      case 'subtitle':
        return { fontSize: '18px', fontWeight: 400, textAlign: 'center', verticalAlign: 'top' };
      case 'section-title':
        return { fontSize: titleFont, fontWeight: titleWeight, textAlign: isCurvy ? 'center' : 'left', verticalAlign: 'middle' };
      case 'section-subtitle':
        return { fontSize: '16px', fontWeight: 400, textAlign: isCurvy ? 'center' : 'left', verticalAlign: 'top' };
      case 'heading':
        return { fontSize: '20px', fontWeight: 600, textAlign: isCurvy ? 'center' : 'left', verticalAlign: 'middle' };
      case 'body':
      default:
        return { fontSize: variant?.fontSize || '16px', fontWeight: 400, textAlign: 'left', verticalAlign: 'top' };
    }
  }

  private getSlidePlaceholderSpecs(
    layout: SlideLayoutType,
    pageWidth: number,
    pageHeight: number,
    variant?: SlideThemeVariant,
  ): PlaceholderSpec[] {
    const mX = Math.max(36, Math.round(pageWidth * 0.08));
    const innerW = Math.round(pageWidth - mX * 2);
    const gap = Math.max(16, Math.round(pageWidth * 0.03));

    // Theme-specific template geometry for Curvy Magenta (G variants)
    // so title/content placements match the curved visual bands.
    if ((variant?.id ?? '').startsWith('G')) {
      const curveBottomY = Math.round(pageHeight * 0.56);
      const contentTopY = Math.round(pageHeight * 0.60);
      const contentBottomY = Math.round(pageHeight * 0.89);
      const contentH = Math.max(80, contentBottomY - contentTopY);

      switch (layout) {
        case 'title_slide':
          return [
            {
              x: Math.round(pageWidth * 0.06),
              y: Math.round(pageHeight * 0.54),
              width: Math.round(pageWidth * 0.88),
              height: Math.round(pageHeight * 0.18),
              placeholder: 'Click to add title',
              role: 'title',
            },
            {
              x: Math.round(pageWidth * 0.22),
              y: Math.round(pageHeight * 0.74),
              width: Math.round(pageWidth * 0.56),
              height: Math.round(pageHeight * 0.08),
              placeholder: 'Click to add subtitle',
              role: 'subtitle',
            },
          ];

        case 'section_header':
          return [
            {
              x: Math.round(pageWidth * 0.10),
              y: Math.round(pageHeight * 0.52),
              width: Math.round(pageWidth * 0.80),
              height: Math.round(pageHeight * 0.14),
              placeholder: 'Click to add section title',
              role: 'section-title',
            },
            {
              x: Math.round(pageWidth * 0.18),
              y: Math.round(pageHeight * 0.68),
              width: Math.round(pageWidth * 0.64),
              height: Math.round(pageHeight * 0.08),
              placeholder: 'Click to add section subtitle',
              role: 'section-subtitle',
            },
          ];

        case 'title_and_content':
          return [
            {
              x: Math.round(pageWidth * 0.14),
              y: Math.round(pageHeight * 0.50),
              width: Math.round(pageWidth * 0.72),
              height: Math.round(pageHeight * 0.09),
              placeholder: 'Click to add title',
              role: 'heading',
            },
            {
              x: mX,
              y: contentTopY,
              width: innerW,
              height: contentH,
              placeholder: 'Click to add text',
              role: 'body',
            },
          ];

        case 'two_content': {
          const colW = Math.round((innerW - gap) / 2);
          return [
            {
              x: Math.round(pageWidth * 0.14),
              y: Math.round(pageHeight * 0.49),
              width: Math.round(pageWidth * 0.72),
              height: Math.round(pageHeight * 0.09),
              placeholder: 'Click to add title',
              role: 'heading',
            },
            {
              x: mX,
              y: contentTopY,
              width: colW,
              height: contentH,
              placeholder: 'Click to add left content',
              role: 'body',
            },
            {
              x: mX + colW + gap,
              y: contentTopY,
              width: colW,
              height: contentH,
              placeholder: 'Click to add right content',
              role: 'body',
            },
          ];
        }

        case 'comparison': {
          const colW = Math.round((innerW - gap) / 2);
          const headY = contentTopY;
          const headH = Math.max(34, Math.round(pageHeight * 0.07));
          const textY = headY + headH + 8;
          const textH = Math.max(60, contentBottomY - textY);
          return [
            {
              x: Math.round(pageWidth * 0.14),
              y: Math.round(pageHeight * 0.49),
              width: Math.round(pageWidth * 0.72),
              height: Math.round(pageHeight * 0.09),
              placeholder: 'Click to add title',
              role: 'heading',
            },
            {
              x: mX,
              y: headY,
              width: colW,
              height: headH,
              placeholder: 'Click to add left heading',
              role: 'heading',
            },
            {
              x: mX + colW + gap,
              y: headY,
              width: colW,
              height: headH,
              placeholder: 'Click to add right heading',
              role: 'heading',
            },
            {
              x: mX,
              y: textY,
              width: colW,
              height: textH,
              placeholder: 'Click to add left text',
              role: 'body',
            },
            {
              x: mX + colW + gap,
              y: textY,
              width: colW,
              height: textH,
              placeholder: 'Click to add right text',
              role: 'body',
            },
          ];
        }

        case 'title_only':
          return [
            {
              x: Math.round(pageWidth * 0.12),
              y: Math.round(pageHeight * 0.50),
              width: Math.round(pageWidth * 0.76),
              height: Math.round(pageHeight * 0.12),
              placeholder: 'Click to add title',
              role: 'heading',
            },
          ];

        case 'blank':
        default:
          return [];
      }
    }

    // Keep template content clear of header/footer and page number regions.
    const safeTop = Math.max(48, Math.round(pageHeight * 0.1));
    const safeBottom = Math.max(52, Math.round(pageHeight * 0.1));
    const contentBottom = pageHeight - safeBottom;
    const contentHeight = Math.max(120, contentBottom - safeTop);

    const titleY = safeTop;
    const titleHeight = Math.max(48, Math.round(contentHeight * 0.13));
    const bodyY = titleY + titleHeight + Math.max(12, Math.round(contentHeight * 0.06));
    const bodyHeight = Math.max(80, contentBottom - bodyY);

    const titleSlideTitleY = Math.round(safeTop + contentHeight * 0.22);
    const titleSlideTitleHeight = Math.max(50, Math.round(contentHeight * 0.14));
    const titleSlideSubtitleY = titleSlideTitleY + titleSlideTitleHeight + Math.max(8, Math.round(contentHeight * 0.025));
    const titleSlideSubtitleHeight = Math.max(38, Math.round(contentHeight * 0.1));

    const sectionHeaderTitleY = Math.round(safeTop + contentHeight * 0.34);
    const sectionHeaderTitleHeight = Math.max(48, Math.round(contentHeight * 0.13));
    const sectionHeaderSubtitleY = sectionHeaderTitleY + sectionHeaderTitleHeight + Math.max(8, Math.round(contentHeight * 0.025));
    const sectionHeaderSubtitleHeight = Math.max(36, Math.round(contentHeight * 0.1));

    switch (layout) {
      case 'title_slide':
        return [
          {
            x: mX,
            y: titleSlideTitleY,
            width: innerW,
            height: titleSlideTitleHeight,
            placeholder: 'Click to add title',
            role: 'title',
          },
          {
            x: Math.round(pageWidth * 0.16),
            y: titleSlideSubtitleY,
            width: Math.round(pageWidth * 0.68),
            height: titleSlideSubtitleHeight,
            placeholder: 'Click to add subtitle',
            role: 'subtitle',
          },
        ];

      case 'title_and_content':
        return [
          {
            x: mX,
            y: titleY,
            width: innerW,
            height: titleHeight,
            placeholder: 'Click to add title',
            role: 'heading',
          },
          {
            x: mX,
            y: bodyY,
            width: innerW,
            height: bodyHeight,
            placeholder: 'Click to add text',
            role: 'body',
          },
        ];

      case 'section_header':
        return [
          {
            x: mX,
            y: sectionHeaderTitleY,
            width: innerW,
            height: sectionHeaderTitleHeight,
            placeholder: 'Click to add section title',
            role: 'section-title',
          },
          {
            x: mX,
            y: sectionHeaderSubtitleY,
            width: innerW,
            height: sectionHeaderSubtitleHeight,
            placeholder: 'Click to add section subtitle',
            role: 'section-subtitle',
          },
        ];

      case 'two_content': {
        const colW = Math.round((innerW - gap) / 2);
        return [
          {
            x: mX,
            y: titleY,
            width: innerW,
            height: titleHeight,
            placeholder: 'Click to add title',
            role: 'heading',
          },
          {
            x: mX,
            y: bodyY,
            width: colW,
            height: bodyHeight,
            placeholder: 'Click to add left content',
            role: 'body',
          },
          {
            x: mX + colW + gap,
            y: bodyY,
            width: colW,
            height: bodyHeight,
            placeholder: 'Click to add right content',
            role: 'body',
          },
        ];
      }

      case 'comparison': {
        const colW = Math.round((innerW - gap) / 2);
        const headY = bodyY;
        const headHeight = Math.max(36, Math.round(contentHeight * 0.1));
        const textY = headY + headHeight + Math.max(10, Math.round(contentHeight * 0.04));
        const textHeight = Math.max(60, contentBottom - textY);
        return [
          {
            x: mX,
            y: titleY,
            width: innerW,
            height: titleHeight,
            placeholder: 'Click to add title',
            role: 'heading',
          },
          {
            x: mX,
            y: headY,
            width: colW,
            height: headHeight,
            placeholder: 'Click to add left heading',
            role: 'heading',
          },
          {
            x: mX + colW + gap,
            y: headY,
            width: colW,
            height: headHeight,
            placeholder: 'Click to add right heading',
            role: 'heading',
          },
          {
            x: mX,
            y: textY,
            width: colW,
            height: textHeight,
            placeholder: 'Click to add left text',
            role: 'body',
          },
          {
            x: mX + colW + gap,
            y: textY,
            width: colW,
            height: textHeight,
            placeholder: 'Click to add right text',
            role: 'body',
          },
        ];
      }

      case 'title_only':
        return [
          {
            x: mX,
            y: titleY,
            width: innerW,
            height: Math.max(52, Math.round(contentHeight * 0.15)),
            placeholder: 'Click to add title',
            role: 'heading',
          },
        ];

      case 'blank':
      default:
        return [];
    }
  }
}
