import { Injectable } from '@angular/core';

import { ChartAdapter } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class ChartRegistryService {
  private readonly adapters = new Map<string, ChartAdapter>();

  register(adapter: ChartAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  unregister(adapterId: string): void {
    this.adapters.delete(adapterId);
  }

  getAdapter(id?: string): ChartAdapter | undefined {
    if (!id) {
      return undefined;
    }
    return this.adapters.get(id);
  }

  listAdapters(): ChartAdapter[] {
    return Array.from(this.adapters.values());
  }
}

