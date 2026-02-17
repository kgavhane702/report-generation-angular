import {
  SlideLayoutType,
  SlideThemeDefinition,
  SlideThemeId,
  SlideThemeSwatch,
  SlideThemeVariant,
  SlideThemeVariantOverride,
} from './slide-design.model';

export interface SlideLayoutOption {
  id: SlideLayoutType;
  label: string;
  description: string;
}

export const DEFAULT_SLIDE_THEME_ID: SlideThemeId = 'berlin_orange';
export const DEFAULT_SLIDE_LAYOUT_TYPE: SlideLayoutType = 'blank';

export const SLIDE_THEMES: ReadonlyArray<SlideThemeDefinition> = [
  {
    id: 'berlin_orange',
    label: 'Berlin',
    description: 'Warm Berlin palette with Apricot Rose and Ember Orange swatches.',
    defaultSwatchId: 'apricot-light',
    variants: [
      {
        id: 'A1',
        label: 'Berlin Accent',
        surfaceBackground: 'linear-gradient(90deg, #fed7aa 0%, #fdba74 50%, #fb7185 100%)',
        surfaceForeground: '#431407',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI Semibold', 'Segoe UI', sans-serif",
        fontSize: '16px',
        titleFontSize: '32px',
        titleFontWeight: 700,
        accentColor: '#ea580c',
        overlaySoftColor: 'rgba(255, 255, 255, 0.2)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.12)',
        tabColor: '#ea580c',
      },
    ],
    swatches: [
      {
        id: 'apricot-light',
        label: 'Apricot Rose',
        variantOverrides: {
          A1: {
            surfaceBackground: 'linear-gradient(90deg, #fed7aa 0%, #fdba74 50%, #fb7185 100%)',
            surfaceForeground: '#431407',
            accentColor: '#ea580c',
            overlaySoftColor: 'rgba(255, 255, 255, 0.2)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.12)',
            tabColor: '#ea580c',
          },
        },
      },
      {
        id: 'ember-dark',
        label: 'Ember Orange',
        variantOverrides: {
          A1: {
            surfaceBackground: 'linear-gradient(90deg, #f97316 0%, #dc2626 100%)',
            surfaceForeground: '#fff7ed',
            accentColor: '#fdba74',
            overlaySoftColor: 'rgba(255, 255, 255, 0.18)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.08)',
            tabColor: '#fdba74',
          },
        },
      },
    ],
  },
  {
    id: 'minimal_slate',
    label: 'Minimal Slate',
    description: 'Clean neutral deck with Slate Paper and Slate Blue swatches.',
    defaultSwatchId: 'paper-light',
    variants: [
      {
        id: 'B1',
        label: 'Slate Cover',
        surfaceBackground: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
        surfaceForeground: '#1e293b',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        titleFontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: '15px',
        titleFontSize: '34px',
        titleFontWeight: 700,
        accentColor: '#475569',
        overlaySoftColor: 'rgba(15, 23, 42, 0.06)',
        overlayStrongColor: 'rgba(15, 23, 42, 0.1)',
        tabColor: '#475569',
      },
      {
        id: 'B2',
        label: 'White Clean',
        surfaceBackground: '#ffffff',
        surfaceForeground: '#0f172a',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        titleFontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: '15px',
        titleFontSize: '28px',
        titleFontWeight: 600,
        accentColor: '#475569',
        overlaySoftColor: 'rgba(15, 23, 42, 0.06)',
        overlayStrongColor: 'rgba(15, 23, 42, 0.1)',
        tabColor: '#475569',
      },
    ],
    swatches: [
      {
        id: 'paper-light',
        label: 'Slate Paper',
        variantOverrides: {
          B1: {
            surfaceBackground: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
            surfaceForeground: '#1e293b',
            accentColor: '#475569',
          },
          B2: {
            surfaceBackground: '#ffffff',
            surfaceForeground: '#0f172a',
            accentColor: '#475569',
          },
        },
      },
      {
        id: 'mist-blue',
        label: 'Slate Blue',
        variantOverrides: {
          B1: {
            surfaceBackground: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            surfaceForeground: '#0b2545',
            accentColor: '#2563eb',
          },
          B2: {
            surfaceBackground: '#eff6ff',
            surfaceForeground: '#1e3a8a',
            accentColor: '#2563eb',
          },
        },
      },
    ],
  },
  {
    id: 'ocean_blue',
    label: 'Ocean Blue',
    description: 'Blue corporate deck with Ocean Sky and Ocean Teal swatches.',
    defaultSwatchId: 'sky-light',
    variants: [
      {
        id: 'C1',
        label: 'Ocean Light',
        surfaceBackground: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        surfaceForeground: '#0b2545',
        fontFamily: "'Calibri', 'Segoe UI', sans-serif",
        titleFontFamily: "'Calibri', 'Segoe UI', sans-serif",
        fontSize: '16px',
        titleFontSize: '30px',
        titleFontWeight: 700,
        accentColor: '#1d4ed8',
        overlaySoftColor: 'rgba(255, 255, 255, 0.15)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.08)',
        tabColor: '#1d4ed8',
      },
      {
        id: 'C2',
        label: 'Ocean Deep',
        surfaceBackground: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
        surfaceForeground: '#f8fafc',
        fontFamily: "'Calibri', 'Segoe UI', sans-serif",
        titleFontFamily: "'Calibri', 'Segoe UI', sans-serif",
        fontSize: '16px',
        titleFontSize: '34px',
        titleFontWeight: 700,
        accentColor: '#60a5fa',
        overlaySoftColor: 'rgba(255, 255, 255, 0.16)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.08)',
        tabColor: '#60a5fa',
      },
    ],
    swatches: [
      {
        id: 'sky-light',
        label: 'Ocean Sky',
        variantOverrides: {
          C1: {
            surfaceBackground: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            surfaceForeground: '#0b2545',
            accentColor: '#1d4ed8',
          },
          C2: {
            surfaceBackground: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
            surfaceForeground: '#f8fafc',
            accentColor: '#60a5fa',
          },
        },
      },
      {
        id: 'teal-wave',
        label: 'Ocean Teal',
        variantOverrides: {
          C1: {
            surfaceBackground: 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)',
            surfaceForeground: '#134e4a',
            accentColor: '#0f766e',
          },
          C2: {
            surfaceBackground: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
            surfaceForeground: '#ecfeff',
            accentColor: '#5eead4',
          },
        },
      },
    ],
  },
  {
    id: 'emerald_forest',
    label: 'Emerald Forest',
    description: 'Green professional palette with Emerald Mint and Lime Sage swatches.',
    defaultSwatchId: 'mint-light',
    variants: [
      {
        id: 'D1',
        label: 'Emerald Bright',
        surfaceBackground: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
        surfaceForeground: '#052e16',
        fontFamily: "'Aptos', 'Inter', sans-serif",
        titleFontFamily: "'Aptos', 'Inter', sans-serif",
        fontSize: '15px',
        titleFontSize: '28px',
        titleFontWeight: 600,
        accentColor: '#047857',
        overlaySoftColor: 'rgba(255, 255, 255, 0.16)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.08)',
        tabColor: '#047857',
      },
      {
        id: 'D2',
        label: 'Forest Dark',
        surfaceBackground: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
        surfaceForeground: '#ecfdf5',
        fontFamily: "'Aptos', 'Inter', sans-serif",
        titleFontFamily: "'Aptos', 'Inter', sans-serif",
        fontSize: '15px',
        titleFontSize: '34px',
        titleFontWeight: 700,
        accentColor: '#34d399',
        overlaySoftColor: 'rgba(255, 255, 255, 0.16)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.08)',
        tabColor: '#34d399',
      },
    ],
    swatches: [
      {
        id: 'mint-light',
        label: 'Emerald Mint',
        variantOverrides: {
          D1: {
            surfaceBackground: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            surfaceForeground: '#052e16',
            accentColor: '#047857',
          },
          D2: {
            surfaceBackground: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
            surfaceForeground: '#ecfdf5',
            accentColor: '#34d399',
          },
        },
      },
      {
        id: 'sage-soft',
        label: 'Lime Sage',
        variantOverrides: {
          D1: {
            surfaceBackground: 'linear-gradient(135deg, #ecfccb 0%, #d9f99d 100%)',
            surfaceForeground: '#365314',
            accentColor: '#65a30d',
          },
          D2: {
            surfaceBackground: 'linear-gradient(135deg, #3f6212 0%, #365314 100%)',
            surfaceForeground: '#f7fee7',
            accentColor: '#bef264',
          },
        },
      },
    ],
  },
  {
    id: 'royal_purple',
    label: 'Royal Purple',
    description: 'Premium violet style with Royal Lavender and Royal Plum swatches.',
    defaultSwatchId: 'lavender-light',
    variants: [
      {
        id: 'E1',
        label: 'Royal Light',
        surfaceBackground: 'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)',
        surfaceForeground: '#2e1065',
        fontFamily: "'Cambria', 'Georgia', serif",
        titleFontFamily: "'Georgia', 'Cambria', serif",
        fontSize: '16px',
        titleFontSize: '30px',
        titleFontWeight: 700,
        accentColor: '#7c3aed',
        overlaySoftColor: 'rgba(255, 255, 255, 0.1)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.06)',
        tabColor: '#7c3aed',
      },
      {
        id: 'E2',
        label: 'Royal Dark',
        surfaceBackground: 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)',
        surfaceForeground: '#faf5ff',
        fontFamily: "'Cambria', 'Georgia', serif",
        titleFontFamily: "'Georgia', 'Cambria', serif",
        fontSize: '16px',
        titleFontSize: '34px',
        titleFontWeight: 700,
        accentColor: '#c4b5fd',
        overlaySoftColor: 'rgba(255, 255, 255, 0.1)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.06)',
        tabColor: '#c4b5fd',
      },
      {
        id: 'E3',
        label: 'Royal Amethyst',
        surfaceBackground: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
        surfaceForeground: '#ffffff',
        fontFamily: "'Cambria', 'Georgia', serif",
        titleFontFamily: "'Georgia', 'Cambria', serif",
        fontSize: '16px',
        titleFontSize: '28px',
        titleFontWeight: 600,
        accentColor: '#e9d5ff',
        overlaySoftColor: 'rgba(255, 255, 255, 0.1)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.06)',
        tabColor: '#e9d5ff',
      },
    ],
    swatches: [
      {
        id: 'lavender-light',
        label: 'Royal Lavender',
        variantOverrides: {
          E1: {
            surfaceBackground: 'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)',
            surfaceForeground: '#2e1065',
            accentColor: '#7c3aed',
          },
          E2: {
            surfaceBackground: 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)',
            surfaceForeground: '#faf5ff',
            accentColor: '#c4b5fd',
          },
          E3: {
            surfaceBackground: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            surfaceForeground: '#ffffff',
            accentColor: '#e9d5ff',
          },
        },
      },
      {
        id: 'plum-rose',
        label: 'Royal Plum',
        variantOverrides: {
          E1: {
            surfaceBackground: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
            surfaceForeground: '#4a044e',
            accentColor: '#be185d',
          },
          E2: {
            surfaceBackground: 'linear-gradient(135deg, #831843 0%, #500724 100%)',
            surfaceForeground: '#fdf2f8',
            accentColor: '#f9a8d4',
          },
          E3: {
            surfaceBackground: 'linear-gradient(135deg, #be185d 0%, #9d174d 100%)',
            surfaceForeground: '#ffffff',
            accentColor: '#fbcfe8',
          },
        },
      },
    ],
  },
  {
    id: 'sunset_rose',
    label: 'Sunset Rose',
    description: 'Warm modern palette with Rose Sunset and Amber Sunset swatches.',
    defaultSwatchId: 'sunset-light',
    variants: [
      {
        id: 'F1',
        label: 'Sunset Soft',
        surfaceBackground: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
        surfaceForeground: '#4c0519',
        fontFamily: "'Trebuchet MS', 'Verdana', sans-serif",
        titleFontFamily: "'Trebuchet MS', 'Verdana', sans-serif",
        fontSize: '15px',
        titleFontSize: '28px',
        titleFontWeight: 700,
        accentColor: '#e11d48',
        overlaySoftColor: 'rgba(255, 255, 255, 0.2)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.12)',
        tabColor: '#e11d48',
      },
      {
        id: 'F2',
        label: 'Sunset Bold',
        surfaceBackground: 'linear-gradient(135deg, #be123c 0%, #7f1d1d 100%)',
        surfaceForeground: '#fff1f2',
        fontFamily: "'Trebuchet MS', 'Verdana', sans-serif",
        titleFontFamily: "'Trebuchet MS', 'Verdana', sans-serif",
        fontSize: '15px',
        titleFontSize: '34px',
        titleFontWeight: 700,
        accentColor: '#fb7185',
        overlaySoftColor: 'rgba(255, 255, 255, 0.2)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.12)',
        tabColor: '#fb7185',
      },
    ],
    swatches: [
      {
        id: 'sunset-light',
        label: 'Rose Sunset',
        variantOverrides: {
          F1: {
            surfaceBackground: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
            surfaceForeground: '#4c0519',
            accentColor: '#e11d48',
            overlaySoftColor: 'rgba(255, 255, 255, 0.22)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.12)',
            tabColor: '#e11d48',
          },
          F2: {
            surfaceBackground: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
            surfaceForeground: '#fff1f2',
            accentColor: '#fecdd3',
            tabColor: '#fecdd3',
          },
        },
      },
      {
        id: 'amber-glow',
        label: 'Amber Sunset',
        variantOverrides: {
          F1: {
            surfaceBackground: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            surfaceForeground: '#7c2d12',
            accentColor: '#ea580c',
            overlaySoftColor: 'rgba(255, 255, 255, 0.22)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.12)',
            tabColor: '#ea580c',
          },
          F2: {
            surfaceBackground: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)',
            surfaceForeground: '#fff7ed',
            accentColor: '#fdba74',
            tabColor: '#fdba74',
          },
        },
      },
    ],
  },
  {
    id: 'curvy_magenta',
    label: 'Curvy',
    description: 'Curved style with Orchid Magenta and Azure Blue swatches.',
    defaultSwatchId: 'orchid-light',
    variants: [
      {
        id: 'G1',
        label: 'Curvy Cover',
        surfaceBackground:
          'radial-gradient(120% 180% at 50% 25%, #a855f7 0%, #7c3aed 40%, #4c1d95 100%)',
        surfaceForeground: '#f5f3ff',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI', 'Inter', sans-serif",
        fontSize: '16px',
        titleFontSize: '48px',
        titleFontWeight: 600,
        accentColor: '#db2777',
        overlaySoftColor: 'rgba(255, 255, 255, 0.16)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.2)',
        tabColor: '#db2777',
      },
      {
        id: 'G2',
        label: 'Curvy Content',
        surfaceBackground:
          'radial-gradient(160% 110% at 50% -8%, #c084fc 0%, #8b5cf6 48%, #6d28d9 72%, transparent 73%) top/100% 52% no-repeat, #faf5ff',
        surfaceForeground: '#312e81',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI', 'Inter', sans-serif",
        fontSize: '15px',
        titleFontSize: '30px',
        titleFontWeight: 700,
        accentColor: '#db2777',
        overlaySoftColor: 'rgba(255, 255, 255, 0.18)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.24)',
        tabColor: '#db2777',
      },
      {
        id: 'G3',
        label: 'Curvy Blank',
        surfaceBackground: '#faf5ff',
        surfaceForeground: '#312e81',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI', 'Inter', sans-serif",
        fontSize: '15px',
        titleFontSize: '28px',
        titleFontWeight: 600,
        accentColor: '#db2777',
        overlaySoftColor: 'rgba(255, 255, 255, 0.18)',
        overlayStrongColor: 'rgba(255, 255, 255, 0.24)',
        tabColor: '#db2777',
      },
    ],
    swatches: [
      {
        id: 'orchid-light',
        label: 'Orchid Magenta',
        variantOverrides: {
          G1: {
            surfaceBackground:
              'radial-gradient(120% 180% at 50% 25%, #a855f7 0%, #7c3aed 40%, #4c1d95 100%)',
            surfaceForeground: '#f5f3ff',
            accentColor: '#db2777',
            overlaySoftColor: 'rgba(255, 255, 255, 0.16)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.2)',
            tabColor: '#db2777',
          },
          G2: {
            surfaceBackground:
              'radial-gradient(160% 110% at 50% -8%, #c084fc 0%, #8b5cf6 48%, #6d28d9 72%, transparent 73%) top/100% 52% no-repeat, #faf5ff',
            surfaceForeground: '#312e81',
            accentColor: '#db2777',
            overlaySoftColor: 'rgba(255, 255, 255, 0.18)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.24)',
            tabColor: '#db2777',
          },
          G3: {
            surfaceBackground: '#faf5ff',
            surfaceForeground: '#312e81',
            accentColor: '#db2777',
            tabColor: '#db2777',
          },
        },
      },
      {
        id: 'azure-light',
        label: 'Azure Blue',
        variantOverrides: {
          G1: {
            surfaceBackground:
              'radial-gradient(120% 180% at 50% 25%, #38bdf8 0%, #2563eb 40%, #1e3a8a 100%)',
            surfaceForeground: '#eff6ff',
            accentColor: '#0ea5e9',
            overlaySoftColor: 'rgba(255, 255, 255, 0.16)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.2)',
            tabColor: '#0ea5e9',
          },
          G2: {
            surfaceBackground:
              'radial-gradient(160% 110% at 50% -8%, #7dd3fc 0%, #38bdf8 48%, #2563eb 72%, transparent 73%) top/100% 52% no-repeat, #eff6ff',
            surfaceForeground: '#1e3a8a',
            accentColor: '#0284c7',
            overlaySoftColor: 'rgba(255, 255, 255, 0.18)',
            overlayStrongColor: 'rgba(255, 255, 255, 0.24)',
            tabColor: '#0284c7',
          },
          G3: {
            surfaceBackground: '#eff6ff',
            surfaceForeground: '#1e3a8a',
            accentColor: '#0284c7',
            tabColor: '#0284c7',
          },
        },
      },
    ],
  },
] as const;

export const SLIDE_LAYOUT_OPTIONS: ReadonlyArray<SlideLayoutOption> = [
  {
    id: 'hero_title',
    label: 'Title',
    description: 'Large title area with subtitle placeholder.',
  },
  {
    id: 'title_body',
    label: 'Title + Content',
    description: 'Top title with one main content placeholder.',
  },
  {
    id: 'section_intro',
    label: 'Section Header',
    description: 'Section title page with supporting subtitle.',
  },
  {
    id: 'two_column',
    label: 'Two Content',
    description: 'Title and two equal content columns.',
  },
  {
    id: 'compare_columns',
    label: 'Comparison',
    description: 'Two comparison columns under a shared title.',
  },
  {
    id: 'title_focus',
    label: 'Title Only',
    description: 'Single title band, no content placeholders.',
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'No placeholders, full free-form canvas.',
  },
] as const;

export function coerceSlideThemeId(input: unknown): SlideThemeId {
  if (typeof input !== 'string') return DEFAULT_SLIDE_THEME_ID;
  const matched = SLIDE_THEMES.find((t) => t.id === input);
  return matched?.id ?? DEFAULT_SLIDE_THEME_ID;
}

export function coerceSlideLayoutType(input: unknown): SlideLayoutType {
  if (typeof input !== 'string') return DEFAULT_SLIDE_LAYOUT_TYPE;

  const normalized = input.trim().toLowerCase();
  const migrated: Record<string, SlideLayoutType> = {
    title_slide: 'hero_title',
    title_and_content: 'title_body',
    section_header: 'section_intro',
    two_content: 'two_column',
    comparison: 'compare_columns',
    title_only: 'title_focus',
    hero_title: 'hero_title',
    title_body: 'title_body',
    section_intro: 'section_intro',
    two_column: 'two_column',
    compare_columns: 'compare_columns',
    title_focus: 'title_focus',
    blank: 'blank',
  };

  return migrated[normalized] ?? DEFAULT_SLIDE_LAYOUT_TYPE;
}

export function getSlideThemeById(themeId: SlideThemeId, swatchId?: string): SlideThemeDefinition {
  const baseTheme = SLIDE_THEMES.find((t) => t.id === themeId) ?? SLIDE_THEMES[0];
  return withThemeSwatch(baseTheme, swatchId);
}

export function getDefaultThemeSwatchId(themeId: SlideThemeId): string {
  const baseTheme = SLIDE_THEMES.find((t) => t.id === themeId) ?? SLIDE_THEMES[0];
  return baseTheme.defaultSwatchId;
}

export function coerceThemeSwatchId(themeId: SlideThemeId, input: unknown): string {
  const baseTheme = SLIDE_THEMES.find((t) => t.id === themeId) ?? SLIDE_THEMES[0];
  if (typeof input !== 'string') return baseTheme.defaultSwatchId;
  const normalized = input.trim().toLowerCase();
  const matched = baseTheme.swatches.find((swatch) => swatch.id.toLowerCase() === normalized);
  return matched?.id ?? baseTheme.defaultSwatchId;
}

export function resolveVariantForLayout(
  theme: SlideThemeDefinition,
  _layout: SlideLayoutType
): SlideThemeVariant {
  return theme.variants[0];
}

function withThemeSwatch(theme: SlideThemeDefinition, swatchId?: string): SlideThemeDefinition {
  const resolvedSwatchId = coerceThemeSwatchId(theme.id, swatchId ?? theme.defaultSwatchId);
  const swatch = theme.swatches.find((candidate) => candidate.id === resolvedSwatchId) ?? theme.swatches[0];
  const variants = theme.variants.map((variant) => ({
    ...variant,
    ...resolveVariantOverride(swatch, variant.id),
  }));

  return {
    ...theme,
    variants,
  };
}

function resolveVariantOverride(
  swatch: SlideThemeSwatch | undefined,
  variantId: string
): SlideThemeVariantOverride {
  if (!swatch) return {};
  const directMatch = swatch.variantOverrides[variantId];
  if (directMatch) return directMatch;

  const normalizedKey = Object.keys(swatch.variantOverrides).find(
    (key) => key.trim().toLowerCase() === variantId.trim().toLowerCase()
  );

  return normalizedKey ? swatch.variantOverrides[normalizedKey] : {};
}
