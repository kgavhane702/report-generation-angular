import { Injectable, signal } from '@angular/core';

export type SaveIndicatorState = 'idle' | 'saving' | 'saved';

/**
 * SaveIndicatorService
 *
 * UI-only "saving" indicator similar to Google Docs/Canva.
 * We pulse "saving" whenever document state is updated, then briefly show "saved".
 *
 * This does NOT imply server persistence; it reflects local document state updates.
 */
@Injectable({ providedIn: 'root' })
export class SaveIndicatorService {
  private readonly stateSig = signal<SaveIndicatorState>('idle');
  readonly state = this.stateSig.asReadonly();

  private saveTimeoutId: number | null = null;
  private savedTimeoutId: number | null = null;

  pulse(): void {
    // Reset timers
    if (this.saveTimeoutId !== null) {
      window.clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
    if (this.savedTimeoutId !== null) {
      window.clearTimeout(this.savedTimeoutId);
      this.savedTimeoutId = null;
    }

    // Show "saving" immediately
    this.stateSig.set('saving');

    // After a short quiet period, flip to "saved", then back to idle.
    this.saveTimeoutId = window.setTimeout(() => {
      this.saveTimeoutId = null;
      this.stateSig.set('saved');

      this.savedTimeoutId = window.setTimeout(() => {
        this.savedTimeoutId = null;
        this.stateSig.set('idle');
      }, 1500);
    }, 450);
  }
}


