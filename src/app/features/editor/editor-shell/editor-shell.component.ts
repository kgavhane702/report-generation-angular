import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { ChartRegistryInitializer } from '../widgets/chart/chart-registry.initializer';

@Component({
  selector: 'app-editor-shell',
  templateUrl: './editor-shell.component.html',
  styleUrls: ['./editor-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorShellComponent {
  protected readonly editorState = inject(EditorStateService);
  
  // Inject ChartRegistryInitializer to ensure it's instantiated and registers chart adapters
  private readonly chartRegistryInitializer = inject(ChartRegistryInitializer);
}

