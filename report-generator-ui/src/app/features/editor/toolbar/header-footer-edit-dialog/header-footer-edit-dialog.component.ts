import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';

import { AppModalComponent } from '../../../../shared/components/modal/app-modal/app-modal.component';
import { ColorPickerComponent, ColorOption } from '../../../../shared/components/color-picker/color-picker.component';
import { AppIconComponent } from '../../../../shared/components/icon/icon.component';
import { HeaderConfig, FooterConfig, LogoConfig } from '../../../../models/document.model';
import { DocumentService } from '../../../../core/services/document.service';
import { AppState } from '../../../../store/app.state';
import { DocumentSelectors } from '../../../../store/document/document.selectors';
import { PageLayoutSelectorComponent } from '../page-layout-selector/page-layout-selector.component';
import { SlideThemeSelectorComponent } from '../slide-theme-selector/slide-theme-selector.component';
import { SlideLayoutSelectorComponent } from '../slide-layout-selector/slide-layout-selector.component';

type PageNumberFormat = 'arabic' | 'roman' | 'alphabetic';
type TabType = 'header' | 'footer' | 'page';
type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    AppModalComponent,
    ColorPickerComponent,
    AppIconComponent,
    PageLayoutSelectorComponent,
  ],
  templateUrl: './header-footer-edit-dialog.component.html',
  styleUrls: ['./header-footer-edit-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
  private readonly store = inject(Store<AppState>);
  private readonly documentService = inject(DocumentService);
  readonly documentLocked = toSignal(
    this.store.select(DocumentSelectors.selectDocumentLocked),
    { initialValue: false }
  );

  readonly open = signal(false);
  readonly activeTab = signal<TabType>('page');
  readonly slideThemeSelectorComponent = SlideThemeSelectorComponent;
  readonly slideLayoutSelectorComponent = SlideLayoutSelectorComponent;

  // Header state
  readonly headerLeftText = signal('');
  readonly headerCenterText = signal('');
  readonly headerRightText = signal('');
  // Per-position text colors (blank means use default black)
  readonly headerLeftTextColor = signal('');
  readonly headerCenterTextColor = signal('');
  readonly headerRightTextColor = signal('');
  // Blank means "use default rendering color" (renderer falls back to black).
  readonly headerTextColor = signal('');
  readonly headerShowPageNumber = signal(false);
  readonly headerPageNumberFormat = signal<PageNumberFormat>('arabic');

  // Footer state
  readonly footerLeftText = signal('');
  readonly footerCenterText = signal('');
  readonly footerCenterSubText = signal('');
  // Per-position text colors (blank means use default black)
  readonly footerLeftTextColor = signal('');
  readonly footerCenterTextColor = signal('');
  readonly footerRightTextColor = signal('');
  // Blank means "use default rendering color" (renderer falls back to black).
  readonly footerTextColor = signal('');
  readonly footerShowPageNumber = signal(false);
  readonly footerPageNumberFormat = signal<PageNumberFormat>('arabic');

  // Logo state (top-right corner)
  readonly logoImage = signal<string | null>(null);
  readonly logoPosition = signal<LogoPosition>('top-right');
  readonly logoMaxWidthPx = signal<number | null>(null);
  readonly logoMaxHeightPx = signal<number | null>(null);

  // Color palette
  readonly colorPalette: ColorOption[] = [
    { value: '#000000', label: 'Black' },
    { value: '#ffffff', label: 'White' },
    { value: '#374151', label: 'Gray 700' },
    { value: '#6b7280', label: 'Gray 500' },
    { value: '#9ca3af', label: 'Gray 400' },
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#22c55e', label: 'Green' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#f43f5e', label: 'Rose' },
  ];

  readonly pageNumberFormats: Array<{ value: PageNumberFormat; label: string; example: string }> = [
    { value: 'arabic', label: 'Arabic', example: '1, 2, 3' },
    { value: 'roman', label: 'Roman', example: 'i, ii, iii' },
    { value: 'alphabetic', label: 'Alphabetic', example: 'a, b, c' },
  ];

  private readonly header$ = toSignal(
    this.store.select(DocumentSelectors.selectDocumentHeader),
    { initialValue: null }
  );
  private readonly footer$ = toSignal(
    this.store.select(DocumentSelectors.selectDocumentFooter),
    { initialValue: null }
  );
  private readonly logo$ = toSignal(
    this.store.select(DocumentSelectors.selectDocumentLogo),
    { initialValue: null }
  );

  constructor() {
    // Data will be loaded when dialog opens via openDialog()
  }

  openDialog(): void {
    // Reload current values from store when opening
    const header = this.header$();
    if (header) {
      this.headerLeftText.set(header.leftText || '');
      this.headerCenterText.set(header.centerText || '');
      this.headerRightText.set(header.rightText || '');
      this.headerLeftTextColor.set((header.leftTextColor || '').trim());
      this.headerCenterTextColor.set((header.centerTextColor || '').trim());
      this.headerRightTextColor.set((header.rightTextColor || '').trim());
      this.headerTextColor.set((header.textColor || '').trim());
      this.headerShowPageNumber.set(header.showPageNumber === true);
      this.headerPageNumberFormat.set(header.pageNumberFormat || 'arabic');
    } else {
      // Reset to defaults if no header exists
      this.headerLeftText.set('');
      this.headerCenterText.set('');
      this.headerRightText.set('');
      this.headerLeftTextColor.set('');
      this.headerCenterTextColor.set('');
      this.headerRightTextColor.set('');
      this.headerTextColor.set('');
      this.headerShowPageNumber.set(false);
      this.headerPageNumberFormat.set('arabic');
    }

    const footer = this.footer$();
    if (footer) {
      this.footerLeftText.set(footer.leftText || '');
      this.footerCenterText.set(footer.centerText || '');
      this.footerCenterSubText.set(footer.centerSubText || '');
      this.footerLeftTextColor.set((footer.leftTextColor || '').trim());
      this.footerCenterTextColor.set((footer.centerTextColor || '').trim());
      this.footerRightTextColor.set((footer.rightTextColor || '').trim());
      this.footerTextColor.set((footer.textColor || '').trim());
      this.footerShowPageNumber.set(footer.showPageNumber === true);
      this.footerPageNumberFormat.set(footer.pageNumberFormat || 'arabic');
    } else {
      // Reset to defaults if no footer exists
      this.footerLeftText.set('');
      this.footerCenterText.set('');
      this.footerCenterSubText.set('');
      this.footerLeftTextColor.set('');
      this.footerCenterTextColor.set('');
      this.footerRightTextColor.set('');
      this.footerTextColor.set('');
      this.footerShowPageNumber.set(false);
      this.footerPageNumberFormat.set('arabic');
    }

    // Load logo
    const logo = this.logo$();
    this.logoImage.set(logo?.url || null);
    this.logoPosition.set((logo?.position as LogoPosition) || 'top-right');
    this.logoMaxWidthPx.set(typeof logo?.maxWidthPx === 'number' ? logo!.maxWidthPx! : null);
    this.logoMaxHeightPx.set(typeof logo?.maxHeightPx === 'number' ? logo!.maxHeightPx! : null);

    this.open.set(true);
  }

  closeDialog(): void {
    this.open.set(false);
  }

  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  private convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  onHeaderTextChange(position: 'left' | 'center' | 'right', value: string): void {
    if (position === 'left') {
      this.headerLeftText.set(value);
    } else if (position === 'center') {
      this.headerCenterText.set(value);
    } else {
      this.headerRightText.set(value);
    }
  }

  onFooterTextChange(position: 'left' | 'center' | 'right', value: string): void {
    if (position === 'left') {
      this.footerLeftText.set(value);
    } else if (position === 'center') {
      this.footerCenterText.set(value);
    }
  }

  onFooterSubTextChange(value: string): void {
    this.footerCenterSubText.set(value);
  }

  async onLogoUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset immediately so selecting the same file again still triggers change.
    input.value = '';
    if (!file) return;

    try {
      const base64 = await this.convertFileToBase64(file);
      this.logoImage.set(base64);
    } catch (error) {
      console.error('Failed to convert logo to base64:', error);
    }
  }

  removeLogo(): void {
    this.logoImage.set(null);
  }

  save(): void {
    // Save header
    const header: HeaderConfig = {
      leftText: this.headerLeftText() || undefined,
      centerText: this.headerCenterText() || undefined,
      rightText: this.headerRightText() || undefined,
      leftTextColor: this.headerLeftTextColor().trim() || undefined,
      centerTextColor: this.headerCenterTextColor().trim() || undefined,
      rightTextColor: this.headerRightTextColor().trim() || undefined,
      textColor: this.headerTextColor().trim() || undefined,
      showPageNumber: this.headerShowPageNumber(),
      pageNumberFormat: this.headerPageNumberFormat(),
    };

    // Save footer
    const footer: FooterConfig = {
      leftText: this.footerLeftText() || undefined,
      centerText: this.footerCenterText() || undefined,
      centerSubText: this.footerCenterSubText() || undefined,
      leftTextColor: this.footerLeftTextColor().trim() || undefined,
      centerTextColor: this.footerCenterTextColor().trim() || undefined,
      rightTextColor: this.footerRightTextColor().trim() || undefined,
      textColor: this.footerTextColor().trim() || undefined,
      showPageNumber: this.footerShowPageNumber(),
      pageNumberFormat: this.footerPageNumberFormat(),
    };

    // Save logo
    const logo: LogoConfig = {
      url: this.logoImage() || undefined,
      position: this.logoPosition(),
      maxWidthPx: this.logoMaxWidthPx() ?? undefined,
      maxHeightPx: this.logoMaxHeightPx() ?? undefined,
    };

    // Centralized lock guard lives in DocumentService; UI also disables Save while locked.
    this.documentService.updateHeader(header);
    this.documentService.updateFooter(footer);
    this.documentService.updateLogo(logo);

    this.closeDialog();
  }

  cancel(): void {
    this.closeDialog();
  }
}

