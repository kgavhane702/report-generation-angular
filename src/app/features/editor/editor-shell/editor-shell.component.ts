import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { ChartRegistryInitializer } from '../chart/registry';
import { TableRegistryInitializer } from '../widgets/table/table-registry.initializer';

@Component({
  selector: 'app-editor-shell',
  templateUrl: './editor-shell.component.html',
  styleUrls: ['./editor-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorShellComponent {
  protected readonly editorState = inject(EditorStateService);
  
  // Inject registry initializers to ensure they're instantiated and register adapters
  private readonly chartRegistryInitializer = inject(ChartRegistryInitializer);
  private readonly tableRegistryInitializer = inject(TableRegistryInitializer);
}

