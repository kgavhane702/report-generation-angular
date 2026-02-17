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
export const DEFAULT_SLIDE_LAYOUT_TYPE: SlideLayoutType = 'blank';

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

export function getSlideThemeById(themeId: SlideThemeId): SlideThemeDefinition {
  return SLIDE_THEMES.find((t) => t.id === themeId) ?? SLIDE_THEMES[0];
}

export function resolveVariantForLayout(
  theme: SlideThemeDefinition,
  _layout: SlideLayoutType
): SlideThemeVariant {
  return theme.variants[0];
}
