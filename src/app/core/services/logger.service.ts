import { Injectable, isDevMode } from '@angular/core';

/**
 * LoggerService
 *
 * Centralized logging so we can:
 * - keep debug noise out of production builds
 * - standardize log formatting in one place
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  /** Debug logs are dev-only. */
  debug(...args: unknown[]): void {
    if (!isDevMode()) return;
    // eslint-disable-next-line no-console
    console.log(...args);
  }

  /** Info logs are dev-only (keep prod quiet unless it's a warn/error). */
  info(...args: unknown[]): void {
    if (!isDevMode()) return;
    // eslint-disable-next-line no-console
    console.info(...args);
  }

  warn(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }

  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}


