import { ChangeDetectionStrategy, Component, ElementRef, HostBinding, Input, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableToolbarService } from '../../../../../../core/services/table-toolbar.service';
import { EditorStateService } from '../../../../../../core/services/editor-state.service';
import { DocumentService } from '../../../../../../core/services/document.service';
import type { EditastraWidgetProps, WidgetType } from '../../../../../../models/widget.model';
import { ColorPickerComponent, type ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';
import { AnchoredDropdownComponent } from '../../../../../../shared/components/dropdown/anchored-dropdown/anchored-dropdown.component';
import { EDITASTRA_TOOLBAR_GROUP_ORDER, EDITASTRA_TOOLBAR_PLUGINS, type EditastraToolbarPlugin } from './editastra-toolbar.plugins';

@Component({
  selector: 'app-editastra-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ColorPickerComponent, AnchoredDropdownComponent],
  templateUrl: './editastra-toolbar.component.html',
  styleUrls: ['./editastra-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditastraToolbarComponent {
  private readonly toolbarService = inject(TableToolbarService);
  private readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);

  /**
   * Which widget types should enable this toolbar instance.
   * - Default: only Editastra widget
   * - Table toolbar can embed this with ['table'] or ['table','editastra']
   */
  readonly enabledWidgetTypes = signal<WidgetType[]>(['editastra']);
  @Input()
  set enabledForWidgetTypes(value: WidgetType[] | null | undefined) {
    const next = Array.isArray(value) && value.length > 0 ? value : (['editastra'] as WidgetType[]);
    this.enabledWidgetTypes.set(next);
  }

  /** Render mode: standalone includes the outer `.table-toolbar` wrapper; embedded renders only groups. */
  @Input() renderMode: 'standalone' | 'embedded' = 'standalone';

  /** Allows parent toolbars (like table) to treat this component as a "transparent" wrapper. */
  @HostBinding('class.editastra-toolbar--embedded')
  get isEmbeddedHost(): boolean {
    return this.renderMode === 'embedded';
  }

  /** Plugin list to render (defaults to full Editastra toolbar plugins). */
  readonly plugins = signal<EditastraToolbarPlugin[]>(EDITASTRA_TOOLBAR_PLUGINS);
  @Input()
  set pluginList(value: EditastraToolbarPlugin[] | null | undefined) {
    this.plugins.set(value && value.length ? value : EDITASTRA_TOOLBAR_PLUGINS);
  }

  /** Plugin-driven toolbar (each UI control is defined as a plugin entry). */
  readonly pluginGroups = computed((): Array<{ group: string; items: EditastraToolbarPlugin[] }> => {
    const all = this.plugins();
    return EDITASTRA_TOOLBAR_GROUP_ORDER
      .map((g) => ({ group: g, items: all.filter((p) => p.group === g) }))
      .filter((x) => x.items.length > 0);
  });

  /** Is the active widget one of the widget types this toolbar instance supports? */
  readonly isSupportedWidgetActive = computed(() => {
    const t = this.editorState.activeWidget()?.type;
    return !!t && this.enabledWidgetTypes().includes(t);
  });

  get formattingState() {
    return this.toolbarService.formattingState();
  }

  get hasActiveEditor(): boolean {
    return this.isSupportedWidgetActive() && this.toolbarService.activeCell !== null;
  }

  /**
   * Template-friendly accessor for tri-state formatting values.
   * Avoids TS7053 from dynamic indexing in Angular template type-checking.
   */
  formatTriState(key: any): 'on' | 'off' | 'mixed' {
    const v = (this.toolbarService.formattingState() as any)?.[key];
    return v === 'on' || v === 'off' || v === 'mixed' ? v : 'off';
  }

  // Palettes (same as table toolbar)
  readonly textColorPalette: ColorOption[] = [
    { value: '#000000', label: 'Black' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#ffffff', label: 'White' },
    { value: '#ef4444', label: 'Red' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#10b981', label: 'Green' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#fbbf24', label: 'Amber' },
  ];

  readonly highlightPalette: ColorOption[] = [
    { value: '', label: 'Transparent' },
    { value: '#fff59d', label: 'Yellow' },
    { value: '#ffccbc', label: 'Orange' },
    { value: '#c5e1a5', label: 'Green' },
    { value: '#b3e5fc', label: 'Light Blue' },
    { value: '#ce93d8', label: 'Purple' },
    { value: '#f8bbd0', label: 'Pink' },
    { value: '#ffffff', label: 'White' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#000000', label: 'Black' },
  ];

  /** Widget background palette (matches text widget background picker). */
  readonly backgroundPalette: ColorOption[] = [
    { value: '', label: 'Transparent' },
    { value: '#ffffff', label: 'White' },
    { value: '#ef4444', label: 'Red' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#f97316', label: 'Orange Red' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#fbbf24', label: 'Amber' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#000000', label: 'Black' },
  ];

  /** Current background color of the active Editastra widget. */
  readonly currentBackgroundColor = computed(() => {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'editastra') return '';
    const props = ctx.widget.props as EditastraWidgetProps;
    return props.backgroundColor || '';
  });

  // Font controls (same as table toolbar) - "Default" is rendered separately in the dropdown
  readonly fontFamilies: Array<{ label: string; value: string }> = [
    { label: 'Inter', value: 'Inter' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Calibri', value: 'Calibri' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Times New Roman', value: '"Times New Roman"' },
    { label: 'Courier New', value: '"Courier New"' },
    { label: 'Verdana', value: 'Verdana' },
  ];

  readonly fontSizes: Array<number> = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
  readonly lineHeights: Array<string> = ['1', '1.15', '1.3', '1.4', '1.5', '1.75', '2'];

  // Bullet styles (same as table toolbar)
  readonly bulletStyles: Array<{ value: string; label: string; icon: string }> = [
    { value: 'disc', label: 'Filled Circle', icon: '●' },
    { value: 'circle', label: 'Hollow Circle', icon: '○' },
    { value: 'square', label: 'Square', icon: '■' },
    { value: 'chevron', label: 'Chevron', icon: '›' },
    { value: 'arrow', label: 'Arrow', icon: '➤' },
    { value: 'dash', label: 'Dash', icon: '–' },
    { value: 'check', label: 'Checkmark', icon: '✓' },
  ];

  @ViewChild('fontFamilyTrigger', { static: false }) fontFamilyTrigger?: ElementRef<HTMLElement>;
  @ViewChild('fontSizeTrigger', { static: false }) fontSizeTrigger?: ElementRef<HTMLElement>;
  @ViewChild('lineHeightTrigger', { static: false }) lineHeightTrigger?: ElementRef<HTMLElement>;
  @ViewChild('bulletStyleTrigger', { static: false }) bulletStyleTrigger?: ElementRef<HTMLElement>;

  readonly fontFamilyDropdownOpen = signal(false);
  readonly fontSizeDropdownOpen = signal(false);
  readonly lineHeightDropdownOpen = signal(false);
  readonly bulletStyleDropdownOpen = signal(false);

  // Keep the same UX as table: color pickers show last-picked values.
  textColor = '#000000';
  highlightColor = '#fff59d';

  openFontFamilyDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.hasActiveEditor) return;
    this.fontFamilyDropdownOpen.set(true);
  }

  closeFontFamilyDropdown(): void {
    this.fontFamilyDropdownOpen.set(false);
  }

  onFontFamilyPick(value: string): void {
    this.onFontFamilyChange(value);
    this.fontFamilyDropdownOpen.set(false);
  }

  openFontSizeDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.hasActiveEditor) return;
    this.fontSizeDropdownOpen.set(true);
  }

  closeFontSizeDropdown(): void {
    this.fontSizeDropdownOpen.set(false);
  }

  onFontSizePick(size: number | null): void {
    this.onFontSizeChange(size);
    this.fontSizeDropdownOpen.set(false);
  }

  openLineHeightDropdown(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.hasActiveEditor) return;
    this.lineHeightDropdownOpen.set(true);
  }

  closeLineHeightDropdown(): void {
    this.lineHeightDropdownOpen.set(false);
  }

  onLineHeightPick(v: string): void {
    this.onLineHeightChange(v);
    this.lineHeightDropdownOpen.set(false);
  }

  get fontFamilyLabel(): string {
    const cur = (this.formattingState.fontFamily ?? '').trim();
    const first = cur.split(',')[0]?.trim() ?? '';
    if (!first) return 'Default';
    // Strip quotes for display.
    return first.replace(/^["']|["']$/g, '');
  }

  get fontSizeLabel(): string {
    const px = this.formattingState.fontSizePx;
    return px ? `${px}` : 'Auto';
  }

  get lineHeightLabel(): string {
    // TableToolbarService doesn't track lineHeight in formattingState; keep a stable label.
    return 'LH';
  }

  // Plugin actions (prevent blur just like table toolbar)
  onFormatToggleClick(
    event: MouseEvent,
    command: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'superscript' | 'subscript'
  ): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveEditor) return;

    switch (command) {
      case 'bold':
        this.toolbarService.applyBold();
        return;
      case 'italic':
        this.toolbarService.applyItalic();
        return;
      case 'underline':
        this.toolbarService.applyUnderline();
        return;
      case 'strikethrough':
        this.toolbarService.applyStrikethrough();
        return;
      case 'superscript':
        this.toolbarService.applySuperscript();
        return;
      case 'subscript':
        this.toolbarService.applySubscript();
        return;
    }
  }

  onIndentClick(event: MouseEvent, command: 'indentIncrease' | 'indentDecrease'): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveEditor) return;
    if (command === 'indentIncrease') {
      this.toolbarService.increaseIndent();
    } else {
      this.toolbarService.decreaseIndent();
    }
  }

  onBulletListClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveEditor) return;
    // Match table UX: clicking bullets opens style dropdown.
    this.bulletStyleDropdownOpen.set(true);
  }

  onBulletStyleSelect(style: string): void {
    this.bulletStyleDropdownOpen.set(false);
    if (!this.hasActiveEditor) return;
    this.toolbarService.toggleBulletList(style);
  }

  closeBulletStyleDropdown(): void {
    this.bulletStyleDropdownOpen.set(false);
  }

  onNumberedListClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveEditor) return;
    this.toolbarService.toggleNumberedList();
  }

  onAlignClick(event: MouseEvent, align: 'left' | 'center' | 'right' | 'justify'): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveEditor) return;
    this.toolbarService.applyTextAlign(align);
  }

  onVerticalAlignClick(event: MouseEvent, align: 'top' | 'middle' | 'bottom'): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.hasActiveEditor) return;
    this.toolbarService.applyVerticalAlign(align);
  }

  onTextColorSelected(color: string): void {
    if (!this.hasActiveEditor) return;
    this.textColor = color;
    this.toolbarService.applyTextColor(color);
  }

  onHighlightSelected(color: string): void {
    if (!this.hasActiveEditor) return;
    this.highlightColor = color;
    this.toolbarService.applyTextHighlight(color);
  }

  onBackgroundColorSelected(color: string): void {
    // Background is widget-level styling; allow when widget is selected (even if not actively editing).
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'editastra') return;

    const { pageId, widget } = ctx;
    this.documentService.updateWidget(pageId, widget.id, {
      props: {
        ...widget.props,
        backgroundColor: color,
      } as EditastraWidgetProps,
    });
  }


  onFontFamilyChange(value: string): void {
    if (!this.hasActiveEditor) return;
    this.toolbarService.applyFontFamily(value);
  }

  onFontSizeChange(value: string | number | null): void {
    if (!this.hasActiveEditor) return;
    const v = (value ?? '').toString().trim();
    if (!v) {
      this.toolbarService.applyFontSizePx(null);
      return;
    }
    const px = Math.max(6, Math.min(96, Math.trunc(Number(v))));
    if (!Number.isFinite(px)) return;
    this.toolbarService.applyFontSizePx(px);
  }

  onLineHeightChange(value: string): void {
    if (!this.hasActiveEditor) return;
    this.toolbarService.applyLineHeight(value);
  }
}


