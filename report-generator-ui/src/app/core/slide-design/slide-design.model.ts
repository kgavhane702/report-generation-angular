export type SlideThemeId =
  | 'berlin_orange'
  | 'minimal_slate'
  | 'ocean_blue'
  | 'emerald_forest'
  | 'royal_purple'
  | 'sunset_rose'
  | 'curvy_magenta';

export type SlideLayoutType =
  | 'title_slide'
  | 'title_and_content'
  | 'section_header'
  | 'two_content'
  | 'comparison'
  | 'title_only'
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
}

export interface SlideThemeDefinition {
  id: SlideThemeId;
  label: string;
  description: string;
  variants: ReadonlyArray<SlideThemeVariant>;
  /** Optional explicit layout -> variant mapping. */
  layoutVariantMap?: Partial<Record<SlideLayoutType, string>>;
}

export interface SlideDesignMetadata {
  slideThemeId: SlideThemeId;
  defaultSlideLayoutType: SlideLayoutType;
}
