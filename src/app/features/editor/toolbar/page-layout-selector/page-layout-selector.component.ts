import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { PageLayoutService } from '../../../../core/page-layout/page-layout.service';
import { DocumentService } from '../../../../core/services/document.service';

@Component({
  selector: 'app-page-layout-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-layout-selector.component.html',
  styleUrls: ['./page-layout-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLayoutSelectorComponent {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly pageLayout = inject(PageLayoutService);
  private readonly documentService = inject(DocumentService);

  readonly menuOpen = signal(false);
  readonly presets = this.pageLayout.presets;
  readonly current = this.pageLayout.preset;
  readonly currentLabel = computed(() => this.current().label);
  readonly documentLocked = this.documentService.documentLocked;

  toggleMenu(): void {
    if (this.documentLocked()) return;
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  selectPreset(id: any): void {
    if (this.documentLocked()) return;
    // id is strongly typed in config; keep template simple.
    this.pageLayout.setPreset(id);
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.el.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }
}


