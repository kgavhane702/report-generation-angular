import { Injectable } from '@angular/core';

import { TableRegistryService } from './table-registry.service';
import { HtmlTableAdapter } from '../implementations';

@Injectable({
  providedIn: 'root',
})
export class TableRegistryInitializer {
  constructor(private readonly registry: TableRegistryService) {
    this.registry.register(new HtmlTableAdapter());
  }
}

