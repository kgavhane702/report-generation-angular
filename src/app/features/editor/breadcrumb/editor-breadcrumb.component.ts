import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SectionModel, SubsectionModel } from '../../../models/document.model';

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

  editingSectionId: string | null = null;
  editingSectionValue = '';
  editingSubsectionId: string | null = null;
  editingSubsectionValue = '';

  get sections(): SectionModel[] {
    return this.documentService.document.sections;
  }

  get activeSection(): SectionModel | undefined {
    const activeId = this.editorState.activeSectionId();
    return this.sections.find((section) => section.id === activeId);
  }

  get subsections(): SubsectionModel[] {
    return this.activeSection?.subsections ?? [];
  }

  selectSection(sectionId: string): void {
    this.editorState.setActiveSection(sectionId);
  }

  selectSubsection(subsectionId: string): void {
    this.editorState.setActiveSubsection(subsectionId);
  }

  addSection(): void {
    const ids = this.documentService.addSection();
    this.editorState.setActiveSection(ids.sectionId!);
    this.editorState.setActiveSubsection(ids.subsectionId!);
    this.editorState.setActivePage(ids.pageId!);
  }

  addSubsection(): void {
    const sectionId = this.editorState.activeSectionId();
    if (!sectionId) {
      return;
    }
    const ids = this.documentService.addSubsection(sectionId);
    if (!ids?.subsectionId) {
      return;
    }
    this.editorState.setActiveSubsection(ids.subsectionId);
    if (ids.pageId) {
      this.editorState.setActivePage(ids.pageId);
    }
  }

  startSectionEdit(section: SectionModel, event: MouseEvent): void {
    event.stopPropagation();
    this.editingSectionId = section.id;
    this.editingSectionValue = section.title;
  }

  saveSectionTitle(sectionId: string): void {
    const value = this.editingSectionValue.trim();
    if (value) {
      this.documentService.renameSection(sectionId, value);
    }
    this.editingSectionId = null;
  }

  cancelSectionEdit(): void {
    this.editingSectionId = null;
  }

  deleteSection(sectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.sections.length <= 1) {
      return;
    }
    const fallback = this.documentService.deleteSection(sectionId);
    if (fallback?.sectionId) {
      this.editorState.setActiveSection(fallback.sectionId);
      if (fallback.subsectionId) {
        this.editorState.setActiveSubsection(fallback.subsectionId);
      }
      if (fallback.pageId) {
        this.editorState.setActivePage(fallback.pageId);
      }
    }
  }

  startSubsectionEdit(subsection: SubsectionModel, event: MouseEvent): void {
    event.stopPropagation();
    this.editingSubsectionId = subsection.id;
    this.editingSubsectionValue = subsection.title;
  }

  saveSubsectionTitle(subsectionId: string): void {
    const value = this.editingSubsectionValue.trim();
    if (value) {
      this.documentService.renameSubsection(subsectionId, value);
    }
    this.editingSubsectionId = null;
  }

  cancelSubsectionEdit(): void {
    this.editingSubsectionId = null;
  }

  deleteSubsection(subsectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    const sectionId = this.editorState.activeSectionId();
    if (!sectionId) {
      return;
    }
    const subsections = this.subsections;
    if (subsections.length <= 1) {
      return;
    }
    const fallback = this.documentService.deleteSubsection(sectionId, subsectionId);
    if (fallback?.subsectionId) {
      this.editorState.setActiveSubsection(fallback.subsectionId);
      if (fallback.pageId) {
        this.editorState.setActivePage(fallback.pageId);
      }
    }
  }
}

