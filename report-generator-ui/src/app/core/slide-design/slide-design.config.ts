import {
  SlideLayoutType,
  SlideThemeDefinition,
  SlideThemeId,
  SlideThemeVariant,
} from './slide-design.model';

export interface SlideLayoutOption {
  id: SlideLayoutType;
  label: string;
  description: string;
}

export const DEFAULT_SLIDE_THEME_ID: SlideThemeId = 'berlin_orange';
export const DEFAULT_SLIDE_LAYOUT_TYPE: SlideLayoutType = 'title_slide';

export const SLIDE_THEMES: ReadonlyArray<SlideThemeDefinition> = [
  {
    id: 'berlin_orange',
    label: 'Berlin',
    description: 'Warm orange/red presentation style with strong contrast accents.',
    variants: [
      {
        id: 'A1',
        label: 'Berlin Accent',
        surfaceBackground: 'linear-gradient(90deg, #f97316 0%, #dc2626 100%)',
        surfaceForeground: '#ffffff',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI Semibold', 'Segoe UI', sans-serif",
        fontSize: '16px',
        titleFontSize: '32px',
        titleFontWeight: 700,
        accentColor: '#111827',
      },
    ],
    layoutVariantMap: {
      title_slide: 'A1',
      title_and_content: 'A1',
      section_header: 'A1',
      title_only: 'A1',
      comparison: 'A1',
      two_content: 'A1',
      blank: 'A1',
    },
  },
  {
    id: 'minimal_slate',
    label: 'Minimal Slate',
    description: 'Clean neutral deck — title slide uses a slate background, content pages are white.',
    variants: [
      {
        id: 'B1',
        label: 'Slate Cover',
        surfaceBackground: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
        surfaceForeground: '#f8fafc',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        titleFontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: '15px',
        titleFontSize: '34px',
        titleFontWeight: 700,
        accentColor: '#94a3b8',
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
      },
    ],
    layoutVariantMap: {
      title_slide: 'B1',
      section_header: 'B1',
      title_and_content: 'B2',
      two_content: 'B2',
      comparison: 'B2',
      title_only: 'B2',
      blank: 'B2',
    },
  },
  {
    id: 'ocean_blue',
    label: 'Ocean Blue',
    description: 'Clean blue corporate deck — deep dark variant for title & section pages.',
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
      },
    ],
    layoutVariantMap: {
      title_slide: 'C2',
      section_header: 'C2',
      title_and_content: 'C1',
      title_only: 'C1',
      comparison: 'C1',
      two_content: 'C1',
      blank: 'C1',
    },
  },
  {
    id: 'emerald_forest',
    label: 'Emerald Forest',
    description: 'Green professional palette — dark executive variant for title & section pages.',
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
      },
    ],
    layoutVariantMap: {
      title_slide: 'D2',
      section_header: 'D2',
      title_and_content: 'D1',
      title_only: 'D1',
      comparison: 'D1',
      two_content: 'D1',
      blank: 'D1',
    },
  },
  {
    id: 'royal_purple',
    label: 'Royal Purple',
    description: 'Premium violet style — dark variant for title & section pages.',
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
      },
    ],
    layoutVariantMap: {
      title_slide: 'E2',
      section_header: 'E2',
      title_and_content: 'E1',
      title_only: 'E1',
      comparison: 'E3',
      two_content: 'E1',
      blank: 'E1',
    },
  },
  {
    id: 'sunset_rose',
    label: 'Sunset Rose',
    description: 'Warm modern palette — bold variant for title & section pages.',
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
      },
    ],
    layoutVariantMap: {
      title_slide: 'F2',
      section_header: 'F2',
      title_and_content: 'F1',
      title_only: 'F1',
      comparison: 'F1',
      two_content: 'F1',
      blank: 'F1',
    },
  },
  {
    id: 'curvy_magenta',
    label: 'Curvy Magenta',
    description: 'Curved purple-magenta style with dedicated content and blank variants.',
    variants: [
      {
        id: 'G1',
        label: 'Curvy Cover',
        surfaceBackground:
          'radial-gradient(120% 180% at 50% 25%, #8a3f79 0%, #5c2e73 40%, #262457 100%)',
        surfaceForeground: '#e5e7eb',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI', 'Inter', sans-serif",
        fontSize: '16px',
        titleFontSize: '48px',
        titleFontWeight: 600,
        accentColor: '#c71585',
      },
      {
        id: 'G2',
        label: 'Curvy Content',
        surfaceBackground:
          'radial-gradient(160% 110% at 50% -8%, #8a3f79 0%, #5c2e73 48%, #262457 72%, transparent 73%) top/100% 52% no-repeat, #f8fafc',
        surfaceForeground: '#0f172a',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI', 'Inter', sans-serif",
        fontSize: '15px',
        titleFontSize: '30px',
        titleFontWeight: 700,
        accentColor: '#c71585',
      },
      {
        id: 'G3',
        label: 'Curvy Blank',
        surfaceBackground: '#f8fafc',
        surfaceForeground: '#0f172a',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        titleFontFamily: "'Segoe UI', 'Inter', sans-serif",
        fontSize: '15px',
        titleFontSize: '28px',
        titleFontWeight: 600,
        accentColor: '#c71585',
      },
    ],
    layoutVariantMap: {
      title_slide: 'G1',
      section_header: 'G1',
      title_and_content: 'G2',
      title_only: 'G2',
      two_content: 'G2',
      comparison: 'G2',
      blank: 'G3',
    },
  },
] as const;

export const SLIDE_LAYOUT_OPTIONS: ReadonlyArray<SlideLayoutOption> = [
  {
    id: 'title_slide',
    label: 'Title Slide',
    description: 'Large title area with subtitle section.',
  },
  {
    id: 'title_and_content',
    label: 'Title and Content',
    description: 'Top title with one main content placeholder.',
  },
  {
    id: 'section_header',
    label: 'Section Header',
    description: 'Section title page with supporting subtitle.',
  },
  {
    id: 'two_content',
    label: 'Two Content',
    description: 'Title and two equal content columns.',
  },
  {
    id: 'comparison',
    label: 'Comparison',
    description: 'Two comparison columns under a shared title.',
  },
  {
    id: 'title_only',
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

  const allowed = new Set<SlideLayoutType>([
    'title_slide',
    'title_and_content',
    'section_header',
    'two_content',
    'comparison',
    'title_only',
    'blank',
  ]);

  return allowed.has(input as SlideLayoutType)
    ? (input as SlideLayoutType)
    : DEFAULT_SLIDE_LAYOUT_TYPE;
}

export function getSlideThemeById(themeId: SlideThemeId): SlideThemeDefinition {
  return SLIDE_THEMES.find((t) => t.id === themeId) ?? SLIDE_THEMES[0];
}

export function resolveVariantForLayout(
  theme: SlideThemeDefinition,
  layout: SlideLayoutType
): SlideThemeVariant {
  const mappedVariantId = theme.layoutVariantMap?.[layout];
  if (mappedVariantId) {
    const mapped = theme.variants.find((v) => v.id === mappedVariantId);
    if (mapped) return mapped;
  }
  return theme.variants[0];
}
