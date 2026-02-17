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
      isTemplatePlaceholder: true,
      placeholderResolved: false,
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

    switch (role) {
      case 'title':
        return { fontSize: titleFont, fontWeight: titleWeight, textAlign: 'center', verticalAlign: 'middle' };
      case 'subtitle':
        return { fontSize: '18px', fontWeight: 400, textAlign: 'center', verticalAlign: 'top' };
      case 'section-title':
        return { fontSize: titleFont, fontWeight: titleWeight, textAlign: 'left', verticalAlign: 'middle' };
      case 'section-subtitle':
        return { fontSize: '16px', fontWeight: 400, textAlign: 'left', verticalAlign: 'top' };
      case 'heading':
        return { fontSize: '20px', fontWeight: 600, textAlign: 'left', verticalAlign: 'middle' };
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
      case 'hero_title':
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

      case 'title_body':
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

      case 'section_intro':
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

      case 'two_column': {
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

      case 'compare_columns': {
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

      case 'title_focus':
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
