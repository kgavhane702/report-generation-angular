import { Injectable } from '@angular/core';

import { TableAdapter } from './table-adapter';

/**
 * Service for managing and retrieving table adapters.
 * Similar to ChartRegistryService - allows pluggable table implementations.
 */
@Injectable({
  providedIn: 'root',
})
export class TableRegistryService {
  private readonly adapters = new Map<string, TableAdapter>();

  /**
   * Register a table adapter
   */
  register(adapter: TableAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Unregister a table adapter
   */
  unregister(adapterId: string): void {
    this.adapters.delete(adapterId);
  }

  /**
   * Get a table adapter by ID
   */
  getAdapter(id?: string): TableAdapter | undefined {
    if (!id) {
      // Return default adapter if no ID specified
      return this.adapters.get('html-table') || Array.from(this.adapters.values())[0];
    }
    return this.adapters.get(id);
  }

  /**
   * List all registered adapters
   */
  listAdapters(): TableAdapter[] {
    return Array.from(this.adapters.values());
  }
}

