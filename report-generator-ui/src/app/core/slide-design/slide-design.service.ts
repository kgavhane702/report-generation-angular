import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { AppState } from '../../store/app.state';
import { DocumentActions, DocumentMetaActions } from '../../store/document/document.actions';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { DocumentModel } from '../../models/document.model';
import { PageModel } from '../../models/page.model';
import { EditastraWidgetProps, WidgetModel } from '../../models/widget.model';
import {
  coerceSlideLayoutType,
  coerceSlideThemeId,
  DEFAULT_SLIDE_LAYOUT_TYPE,
  DEFAULT_SLIDE_THEME_ID,
  getSlideThemeById,
  resolveVariantForLayout,
  SLIDE_THEMES,
} from './slide-design.config';
import { SlideLayoutType, SlideThemeId, SlideThemeVariant } from './slide-design.model';
import { SlideTemplateService } from './slide-template.service';

type PageLike = Pick<PageModel, 'background' | 'slideLayoutType'>;

type PlaceholderRole = 'title' | 'subtitle' | 'section-title' | 'section-subtitle' | 'heading' | 'body';

function withAlpha(color: string | undefined, alphaHex: string, fallback: string): string {
  if (!color) return fallback;
  const normalized = color.trim();
  if (/^#([A-Fa-f0-9]{6})$/.test(normalized)) {
    return `${normalized}${alphaHex}`;
  }
  if (/^#([A-Fa-f0-9]{3})$/.test(normalized)) {
    const expanded = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    return `${expanded}${alphaHex}`;
  }
  return fallback;
}

function reverseReadableColor(foreground: string | undefined): string {
  const c = (foreground ?? '').trim();
  const m = /^#([A-Fa-f0-9]{6})$/.exec(c);
  if (!m) return '#0f172a';
  const hex = m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma < 140 ? '#ffffff' : '#0f172a';
}

function inferPlaceholderRole(placeholder: string | undefined): PlaceholderRole {
  const p = (placeholder ?? '').trim().toLowerCase();
  if (!p.startsWith('click to add')) return 'body';
  if (p.includes('subtitle')) return 'subtitle';
  if (p.includes('section title')) return 'section-title';
  if (p.includes('section subtitle')) return 'section-subtitle';
  if (p.includes('heading')) return 'heading';
  if (p.includes('title')) return 'title';
  return 'body';
}

function defaultsForPlaceholderRole(
  role: PlaceholderRole,
  variant: SlideThemeVariant
): { fontSize: string; fontWeight: number; textAlign: 'left' | 'center' | 'right' } {
  const titleFont = variant.titleFontSize || '28px';
  const titleWeight = variant.titleFontWeight || 700;

  switch (role) {
    case 'title':
      return { fontSize: titleFont, fontWeight: titleWeight, textAlign: 'center' };
    case 'subtitle':
      return { fontSize: '18px', fontWeight: 400, textAlign: 'center' };
    case 'section-title':
      return { fontSize: titleFont, fontWeight: titleWeight, textAlign: 'left' };
    case 'section-subtitle':
      return { fontSize: '16px', fontWeight: 400, textAlign: 'left' };
    case 'heading':
      return { fontSize: '20px', fontWeight: 600, textAlign: 'left' };
    case 'body':
    default:
      return { fontSize: variant.fontSize || '16px', fontWeight: 400, textAlign: 'left' };
  }
}

@Injectable({ providedIn: 'root' })
export class SlideDesignService {
  private readonly store = inject(Store<AppState>);
  private readonly slideTemplates = inject(SlideTemplateService);

  private readonly metadata = toSignal(
    this.store.select(DocumentSelectors.selectDocumentMetadata),
    { initialValue: {} as Record<string, unknown> }
  );

  private readonly document = toSignal(
    this.store.select(DocumentSelectors.selectDenormalizedDocument),
    { initialValue: null as DocumentModel | null }
  );

  readonly themes = SLIDE_THEMES;

  readonly activeThemeId = computed<SlideThemeId>(() =>
    coerceSlideThemeId(this.metadata()['slideThemeId'])
  );

  readonly activeTheme = computed(() => getSlideThemeById(this.activeThemeId()));

  readonly defaultLayoutType = computed<SlideLayoutType>(() =>
    coerceSlideLayoutType(this.metadata()['defaultSlideLayoutType'])
  );

  resolveVariantId(layout: SlideLayoutType, themeId?: SlideThemeId): string {
    const theme = getSlideThemeById(themeId ?? this.activeThemeId());
    return resolveVariantForLayout(theme, layout).id;
  }

  resolveVariant(layout: SlideLayoutType, themeId?: SlideThemeId): SlideThemeVariant {
    const theme = getSlideThemeById(themeId ?? this.activeThemeId());
    return resolveVariantForLayout(theme, layout);
  }

  buildPageDesign(layout?: SlideLayoutType): Pick<PageModel, 'slideLayoutType' | 'slideVariantId'> {
    const resolvedLayout = layout ?? this.defaultLayoutType();
    return {
      slideLayoutType: resolvedLayout,
      slideVariantId: this.resolveVariantId(resolvedLayout),
    };
  }

  ensureMetadataDefaults(metadata?: Record<string, unknown>): Record<string, unknown> {
    const current = metadata ?? {};
    return {
      ...current,
      slideThemeId: coerceSlideThemeId(current['slideThemeId']),
      defaultSlideLayoutType: coerceSlideLayoutType(current['defaultSlideLayoutType']),
    };
  }

  hydrateDocument(document: DocumentModel): DocumentModel {
    const metadata = this.ensureMetadataDefaults(document.metadata);
    const themeId = coerceSlideThemeId(metadata['slideThemeId']);
    const defaultLayout = coerceSlideLayoutType(metadata['defaultSlideLayoutType']);
    const theme = getSlideThemeById(themeId);

    let globalPageIndex = 0;
    const sections = (document.sections ?? []).map((section) => ({
      ...section,
      subsections: (section.subsections ?? []).map((subsection) => ({
        ...subsection,
        pages: (subsection.pages ?? []).map((page) => {
          globalPageIndex += 1;
          const layout = page.slideLayoutType
            ? coerceSlideLayoutType(page.slideLayoutType)
            : globalPageIndex === 1
              ? 'title_slide'
              : defaultLayout;

          const nextVariantId = page.slideVariantId?.trim() || this.resolveVariantId(layout, themeId);
          const variant = resolveVariantForLayout(theme, layout);

          const widgets: WidgetModel[] = (page.widgets ?? []).map((widget) => {
            if (widget.type !== 'editastra') return widget;

            const props = (widget.props ?? { contentHtml: '' }) as EditastraWidgetProps;
            const placeholder = (props.placeholder ?? '').toString();
            const role = inferPlaceholderRole(placeholder);
            if (role === 'body' && !placeholder.toLowerCase().startsWith('click to add')) {
              return widget;
            }

            const defaults = defaultsForPlaceholderRole(role, variant);
            return {
              ...widget,
              props: {
                ...props,
                contentHtml: props.contentHtml ?? '',
                fontSize: props.fontSize || defaults.fontSize,
                fontWeight: Number.isFinite(Number(props.fontWeight))
                  ? Number(props.fontWeight)
                  : defaults.fontWeight,
                textAlign: props.textAlign || defaults.textAlign,
              } as EditastraWidgetProps,
            };
          });

          return {
            ...page,
            slideLayoutType: layout,
            slideVariantId: nextVariantId,
            widgets,
          };
        }),
      })),
    }));

    return {
      ...document,
      metadata,
      sections,
    };
  }

  updateTheme(themeId: SlideThemeId): void {
    const nextThemeId = coerceSlideThemeId(themeId);
    const currentDocument = this.document();

    if (!currentDocument) {
      const metadata = this.ensureMetadataDefaults(this.metadata());
      this.store.dispatch(
        DocumentMetaActions.updateMetadata({
          metadata: {
            ...metadata,
            slideThemeId: nextThemeId,
          },
        })
      );
      return;
    }

    const themedDocument = this.applyThemeToDocument(currentDocument, nextThemeId);
    this.store.dispatch(DocumentActions.setDocument({ document: themedDocument }));
  }

  updateDefaultLayout(layout: SlideLayoutType): void {
    const metadata = this.ensureMetadataDefaults(this.metadata());
    this.store.dispatch(
      DocumentMetaActions.updateMetadata({
        metadata: {
          ...metadata,
          defaultSlideLayoutType: coerceSlideLayoutType(layout),
        },
      })
    );
  }

  getPageSurfaceStyle(page: PageLike | null | undefined): Record<string, string> {
    const layout = page?.slideLayoutType ? coerceSlideLayoutType(page.slideLayoutType) : this.defaultLayoutType();
    const theme = this.activeTheme();
    const variant = resolveVariantForLayout(theme, layout);

    const tableBorder = withAlpha(variant.accentColor || variant.surfaceForeground, '80', 'rgba(15, 23, 42, 0.28)');
    const tableSubBorder = withAlpha(variant.accentColor || variant.surfaceForeground, '66', 'rgba(15, 23, 42, 0.2)');
    const tableHover = withAlpha(variant.accentColor || variant.surfaceForeground, '1A', 'rgba(15, 23, 42, 0.06)');
    const placeholderColor = withAlpha(variant.surfaceForeground, 'B3', 'rgba(100, 116, 139, 0.85)');
    const placeholderFill = withAlpha(variant.accentColor || variant.surfaceForeground, '14', 'transparent');
    const reverseColor = reverseReadableColor(variant.surfaceForeground);

    const commonStyle = {
      color: variant.surfaceForeground,
      fontFamily: variant.fontFamily || "'Inter', sans-serif",
      fontSize: variant.fontSize || '16px',
      '--slide-foreground': variant.surfaceForeground,
      '--slide-accent': variant.accentColor || variant.surfaceForeground,
      '--slide-editor-color': variant.surfaceForeground,
      '--slide-title-font-family': variant.titleFontFamily || variant.fontFamily || "'Inter', sans-serif",
      '--slide-title-font-size': variant.titleFontSize || '28px',
      '--slide-title-font-weight': `${variant.titleFontWeight || 700}`,
      '--slide-placeholder-color': placeholderColor,
      '--slide-placeholder-fill': placeholderFill,
      '--slide-reverse-color': reverseColor,
      '--slide-table-border': tableBorder,
      '--slide-table-sub-border': tableSubBorder,
      '--slide-table-hover': tableHover,
    };

    if (page?.background?.type === 'color' || page?.background?.type === 'gradient') {
      return {
        background: page.background.value,
        ...commonStyle,
      };
    }

    if (page?.background?.type === 'image') {
      return {
        backgroundImage: `url(${page.background.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ...commonStyle,
      };
    }

    return {
      background: variant.surfaceBackground,
      ...commonStyle,
    };
  }

  defaultMetadata(): Record<string, unknown> {
    return {
      slideThemeId: DEFAULT_SLIDE_THEME_ID,
      defaultSlideLayoutType: DEFAULT_SLIDE_LAYOUT_TYPE,
    };
  }

  private applyThemeToDocument(document: DocumentModel, themeId: SlideThemeId): DocumentModel {
    const nextMetadata: Record<string, unknown> = {
      ...this.ensureMetadataDefaults(document.metadata),
      slideThemeId: themeId,
    };

    const defaultLayout = coerceSlideLayoutType(nextMetadata['defaultSlideLayoutType']);

    let globalPageIndex = 0;
    const sections = (document.sections ?? []).map((section) => ({
      ...section,
      subsections: (section.subsections ?? []).map((subsection) => ({
        ...subsection,
        pages: (subsection.pages ?? []).map((page) => {
          globalPageIndex += 1;
          const layout = page.slideLayoutType
            ? coerceSlideLayoutType(page.slideLayoutType)
            : globalPageIndex === 1
              ? 'title_slide'
              : defaultLayout;
          const variant = this.resolveVariant(layout, themeId);

          const templateWidgets = this.slideTemplates.createTemplateWidgets({
            layout,
            pageSize: document.pageSize,
            orientation: page.orientation ?? 'landscape',
            variant,
          });

          const templateByPlaceholder = new Map<string, WidgetModel>();
          const templateByKey = new Map<string, WidgetModel>();
          templateWidgets.forEach((widget) => {
            const templateKey = this.getTemplateKey(widget);
            if (templateKey) {
              templateByKey.set(templateKey, widget);
            }

            if (widget.type !== 'editastra') return;
            const props = widget.props as EditastraWidgetProps;
            const key = this.placeholderKey(props.placeholder);
            if (!key) return;
            templateByPlaceholder.set(key, widget);
          });

          const widgets = (page.widgets ?? []).map((widget) => {
            const keyMatchedTemplate = templateByKey.get(this.getTemplateKey(widget));
            if (keyMatchedTemplate && keyMatchedTemplate.type === widget.type && widget.type !== 'editastra') {
              return {
                ...widget,
                position: { ...keyMatchedTemplate.position },
                size: { ...keyMatchedTemplate.size },
              };
            }

            if (widget.type !== 'editastra') return widget;

            const props = (widget.props ?? { contentHtml: '' }) as EditastraWidgetProps;
            if (!this.isTemplatePlaceholder(props.placeholder)) return widget;

            const template = templateByPlaceholder.get(this.placeholderKey(props.placeholder));
            if (!template || template.type !== 'editastra') {
              return this.withVariantTypography(widget, props, variant);
            }

            const templateProps = template.props as EditastraWidgetProps;
            return {
              ...widget,
              position: { ...template.position },
              size: { ...template.size },
              props: {
                ...props,
                contentHtml: props.contentHtml ?? '',
                placeholder: templateProps.placeholder ?? props.placeholder,
                backgroundColor: templateProps.backgroundColor ?? 'transparent',
                fontSize: templateProps.fontSize,
                fontWeight: templateProps.fontWeight,
                textAlign: templateProps.textAlign,
                verticalAlign: templateProps.verticalAlign,
              } as EditastraWidgetProps,
            };
          });

          return {
            ...page,
            slideLayoutType: layout,
            slideVariantId: variant.id,
            widgets,
          };
        }),
      })),
    }));

    return {
      ...document,
      metadata: nextMetadata,
      sections,
    };
  }

  private isTemplatePlaceholder(placeholder: string | undefined): boolean {
    return this.placeholderKey(placeholder).startsWith('click to add');
  }

  private placeholderKey(placeholder: string | undefined): string {
    return (placeholder ?? '').trim().toLowerCase();
  }

  private withVariantTypography(
    widget: WidgetModel,
    props: EditastraWidgetProps,
    variant: SlideThemeVariant,
  ): WidgetModel {
    const role = inferPlaceholderRole(props.placeholder);
    const defaults = defaultsForPlaceholderRole(role, variant);
    return {
      ...widget,
      props: {
        ...props,
        contentHtml: props.contentHtml ?? '',
        fontSize: defaults.fontSize,
        fontWeight: defaults.fontWeight,
        textAlign: defaults.textAlign,
      } as EditastraWidgetProps,
    };
  }

  private getTemplateKey(widget: WidgetModel): string {
    const props = this.asRecord(widget.props);
    const raw = props?.['templateKey'];
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  }
}
