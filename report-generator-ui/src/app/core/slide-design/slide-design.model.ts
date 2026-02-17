export type SlideThemeId =
  | 'berlin_orange'
  | 'minimal_slate'
  | 'ocean_blue'
  | 'emerald_forest'
  | 'royal_purple'
  | 'sunset_rose'
  | 'curvy_magenta';

export type SlideLayoutType =
  | 'hero_title'
  | 'title_body'
  | 'section_intro'
  | 'two_column'
  | 'compare_columns'
  | 'title_focus'
  | 'blank';

export interface SlideThemeVariant {
  id: string;
  label: string;
  /** CSS background value used on page surface */
  surfaceBackground: string;
  /** Default text color for page surface */
  surfaceForeground: string;
  /** Preferred base font family */
  fontFamily?: string;
  /** Optional base slide font size */
  fontSize?: string;
  /** Font family for slide titles / headings (falls back to fontFamily) */
  titleFontFamily?: string;
  /** Font size for slide titles (e.g. '28px') */
  titleFontSize?: string;
  /** Font weight for slide titles (e.g. 700) */
  titleFontWeight?: number;
  /** Accent color used by placeholders/decorations */
  accentColor?: string;
  /** Optional decorative overlay tone for themed ornaments */
  overlaySoftColor?: string;
  /** Optional decorative overlay tone for stronger highlights */
  overlayStrongColor?: string;
  /** Optional decorative tab marker color */
  tabColor?: string;
}

export type SlideThemeVariantOverride = Partial<
  Pick<
    SlideThemeVariant,
    | 'surfaceBackground'
    | 'surfaceForeground'
    | 'accentColor'
    | 'overlaySoftColor'
    | 'overlayStrongColor'
    | 'tabColor'
  >
>;

export interface SlideThemeSwatch {
  id: string;
  label: string;
  description?: string;
  variantOverrides: Readonly<Record<string, SlideThemeVariantOverride>>;
}

export interface SlideThemeDefinition {
  id: SlideThemeId;
  label: string;
  description: string;
  variants: ReadonlyArray<SlideThemeVariant>;
  swatches: ReadonlyArray<SlideThemeSwatch>;
  defaultSwatchId: string;
}

export type SlideThemeSwatchMap = Partial<Record<SlideThemeId, string>>;

export interface SlideDesignMetadata {
  slideThemeId: SlideThemeId;
  defaultSlideLayoutType: SlideLayoutType;
  slideThemeSwatchByTheme?: SlideThemeSwatchMap;
}
