import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { PendingChangesRegistry } from '../../../../core/services/pending-changes-registry.service';
import { DocumentDownloadService } from '../../../../core/services/document-download.service';
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

  private readonly pendingChangesRegistry = inject(PendingChangesRegistry);
  private readonly documentDownload = inject(DocumentDownloadService);
  private readonly documentService = inject(DocumentService);
  private readonly notify = inject(NotificationService);

  readonly buttonTitle = computed(() => (this.disabled ? 'Download disabled while export is busy' : 'Download PDF'));
  readonly docxButtonTitle = computed(() => (this.disabled ? 'Download disabled while export is busy' : 'Download Word (DOCX)'));

  async downloadPdf(): Promise<void> {
    if (this.disabled) return;
    await this.doDownload('pdf');
  }

  async downloadDocx(): Promise<void> {
    if (this.disabled) return;
    await this.doDownload('docx');
  }

  private async doDownload(format: 'pdf' | 'docx') {
    // Ensure all widget edits are committed before exporting.
    await this.pendingChangesRegistry.flushAll();

    const document = this.documentService.document;
    if (!document) {
      this.notify.info('No document to export', `Download ${format.toUpperCase()}`);
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
}


