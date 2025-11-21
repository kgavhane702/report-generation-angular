import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';

@Component({
  selector: 'app-editor-breadcrumb',
  templateUrl: './editor-breadcrumb.component.html',
  styleUrls: ['./editor-breadcrumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorBreadcrumbComponent {
  protected readonly documentService = inject(DocumentService);
  protected readonly editorState = inject(EditorStateService);

  get sections() {
    return this.documentService.document.sections;
  }

  get activeSection() {
    const activeId = this.editorState.activeSectionId();
    return this.sections.find((section) => section.id === activeId);
  }

  get subsections() {
    return this.activeSection?.subsections ?? [];
  }

  selectSection(sectionId: string): void {
    this.editorState.setActiveSection(sectionId);
  }

  selectSubsection(subsectionId: string): void {
    this.editorState.setActiveSubsection(subsectionId);
  }
}

