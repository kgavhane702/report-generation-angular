import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  inject,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';

@Component({
  selector: 'app-page-canvas',
  templateUrl: './page-canvas.component.html',
  styleUrls: ['./page-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageCanvasComponent {
  protected readonly editorState = inject(EditorStateService);
  protected readonly documentService = inject(DocumentService);

  @HostBinding('class.page-canvas') hostClass = true;
}

