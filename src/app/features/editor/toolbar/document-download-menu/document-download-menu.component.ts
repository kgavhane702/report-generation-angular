import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { PendingChangesRegistry } from '../../../../core/services/pending-changes-registry.service';
import { DocumentDownloadService, DocumentDownloadFormat } from '../../../../core/services/document-download.service';
import { DocumentService } from '../../../../core/services/document.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AppIconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-document-download-menu',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './document-download-menu.component.html',
  styleUrls: ['./document-download-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDownloadMenuComponent {
  @Input() disabled = false;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly pendingChangesRegistry = inject(PendingChangesRegistry);
  private readonly documentDownload = inject(DocumentDownloadService);
  private readonly documentService = inject(DocumentService);
  private readonly notify = inject(NotificationService);

  readonly menuOpen = signal(false);

  readonly options: Array<{ format: DocumentDownloadFormat; label: string }> = [
    { format: 'pdf', label: 'PDF' },
    { format: 'docx', label: 'DOCX' },
  ];

  readonly buttonTitle = computed(() => (this.disabled ? 'Download disabled while export is busy' : 'Download…'));

  toggleMenu(): void {
    if (this.disabled) return;
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async download(format: DocumentDownloadFormat): Promise<void> {
    if (this.disabled) return;
    this.closeMenu();

    // Ensure all widget edits are committed before exporting.
    await this.pendingChangesRegistry.flushAll();

    const document = this.documentService.document;
    if (!document) {
      this.notify.info('No document to export', 'Download');
      return;
    }

    try {
      const t0 = performance.now();
      await this.documentDownload.download(document, format);
      const ms = Math.round(performance.now() - t0);
      this.notify.success(`${format.toUpperCase()} generated successfully (${ms}ms)!`, 'Download ready');
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error';
      this.notify.error(
        `Failed to generate ${format.toUpperCase()}: ${details}. Make sure the backend is running (default via proxy: http://localhost:8080).`,
        'Download failed'
      );
    }
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


