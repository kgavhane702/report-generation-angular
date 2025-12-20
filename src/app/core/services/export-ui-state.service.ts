import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ExportUiStateService {
  private readonly messageStack = signal<string[]>([]);

  readonly active = computed(() => this.messageStack().length > 0);
  readonly message = computed(() => {
    const stack = this.messageStack();
    return stack.length > 0 ? stack[stack.length - 1] : '';
  });

  start(message: string): void {
    this.messageStack.update((s) => [...s, message]);
  }

  updateMessage(message: string): void {
    this.messageStack.update((s) => {
      if (s.length === 0) return s;
      const next = s.slice();
      next[next.length - 1] = message;
      return next;
    });
  }

  stop(): void {
    this.messageStack.update((s) => (s.length > 0 ? s.slice(0, -1) : s));
  }
}


