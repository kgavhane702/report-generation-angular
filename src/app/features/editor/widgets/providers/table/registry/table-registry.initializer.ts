import { Injectable } from '@angular/core';

import { TableRegistryService } from './table-registry.service';
import { HtmlTableAdapter } from '../implementations';

/**
 * Service to initialize table adapters on app startup.
 * Register your table adapters here (HTML table, AG-Grid, ngx-datatable, etc.)
 */
@Injectable({
  providedIn: 'root',
})
export class TableRegistryInitializer {
  constructor(private readonly registry: TableRegistryService) {
    // Register HTML table adapter (default/native implementation)
    this.registry.register(new HtmlTableAdapter());
    
    // Future: Register other table adapters here
    // this.registry.register(new AgGridTableAdapter());
    // this.registry.register(new NgxDatatableAdapter());
    
    // Debug: log registered adapters
    console.log('Table adapters registered:', this.registry.listAdapters().map(a => a.id));
  }
}

