import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class ChunkLoadErrorHandlerService implements ErrorHandler {
  private readonly reloadGuardKey = 'rg_chunk_reload_once';

  handleError(error: unknown): void {
    const message = this.extractMessage(error);
    const isChunkLoadError = /ChunkLoadError|Loading chunk [^\s]+ failed/i.test(message);

    if (isChunkLoadError) {
      const alreadyReloaded = sessionStorage.getItem(this.reloadGuardKey) === '1';
      if (!alreadyReloaded) {
        sessionStorage.setItem(this.reloadGuardKey, '1');
        location.reload();
        return;
      }
    }

    // eslint-disable-next-line no-console
    console.error(error);
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message || String(error);
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
