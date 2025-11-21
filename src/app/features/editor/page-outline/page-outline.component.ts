import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';

@Component({
  selector: 'app-page-outline',
  templateUrl: './page-outline.component.html',
  styleUrls: ['./page-outline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageOutlineComponent {
  protected readonly editorState = inject(EditorStateService);

  selectPage(pageId: string): void {
    this.editorState.setActivePage(pageId);
  }
}

