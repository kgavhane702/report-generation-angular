import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';

import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';
import { SectionEntity, SubsectionEntity } from '../../../store/document/document.state';

@Component({
  selector: 'app-editor-breadcrumb',
  templateUrl: './editor-breadcrumb.component.html',
  styleUrls: ['./editor-breadcrumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorBreadcrumbComponent {
  protected readonly documentService = inject(DocumentService);
  protected readonly editorState = inject(EditorStateService);
  private readonly store = inject(Store<AppState>);

  editingSectionId: string | null = null;
  editingSectionValue = '';
  editingSubsectionId: string | null = null;
  editingSubsectionValue = '';

  /** All sections (ordered) */
  private readonly allSections = toSignal(
    this.store.select(DocumentSelectors.selectAllSections),
    { initialValue: [] as SectionEntity[] }
  );
  
  /** All section IDs */
  private readonly sectionIds = toSignal(
    this.store.select(DocumentSelectors.selectSectionIds),
    { initialValue: [] as string[] }
  );
  
  /** Section entities map */
  private readonly sectionEntities = toSignal(
    this.store.select(DocumentSelectors.selectSectionEntities),
    { initialValue: {} as Dictionary<SectionEntity> }
  );

  /** Get sections ordered by sectionIds */
  get sections(): SectionEntity[] {
    const ids = this.sectionIds();
    const entities = this.sectionEntities();
    return ids.map((id: string) => entities[id]).filter((s): s is SectionEntity => !!s);
  }

  /** Active section ID */
  readonly activeSectionId = this.editorState.activeSectionId;
  
  /** Active subsection ID */
  readonly activeSubsectionId = this.editorState.activeSubsectionId;

  /** Get active section */
  get activeSection(): SectionEntity | null {
    const activeId = this.activeSectionId();
    if (!activeId) return null;
    const entities = this.sectionEntities();
    return entities[activeId] ?? null;
  }

  /** Subsections for active section */
  readonly subsections = this.editorState.activeSectionSubsections;

  selectSection(sectionId: string): void {
    this.editorState.setActiveSection(sectionId);
  }

  selectSubsection(subsectionId: string): void {
    this.editorState.setActiveSubsection(subsectionId);
  }

  addSection(): void {
    const ids = this.documentService.addSection();

    // Do not change current active selection when adding a new section.
    // Only initialize navigation if nothing is active yet (edge case).
    if (!this.activeSectionId() && ids.sectionId) {
      this.editorState.setActiveSection(ids.sectionId);
    }
    if (!this.activeSubsectionId() && ids.subsectionId) {
      this.editorState.setActiveSubsection(ids.subsectionId);
    }
    if (!this.editorState.activePageId() && ids.pageId) {
      this.editorState.setActivePage(ids.pageId);
    }
  }

  addSubsection(): void {
    const sectionId = this.activeSectionId();
    if (!sectionId) {
      return;
    }
    const ids = this.documentService.addSubsection(sectionId);
    if (!ids?.subsectionId) {
      return;
    }

    // Do not change current active selection when adding a new subsection.
    // Only set active if nothing is currently active (edge case).
    if (!this.activeSubsectionId()) {
      this.editorState.setActiveSubsection(ids.subsectionId);
      if (ids.pageId && !this.editorState.activePageId()) {
        this.editorState.setActivePage(ids.pageId);
      }
    }
  }

  startSectionEdit(section: SectionEntity, event: MouseEvent): void {
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

  startSubsectionEdit(subsection: SubsectionEntity, event: MouseEvent): void {
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
    const sectionId = this.activeSectionId();
    if (!sectionId) {
      return;
    }
    const subsections = this.subsections();
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
  
  /** Track by section ID */
  trackBySectionId(index: number, section: SectionEntity): string {
    return section.id;
  }
  
  /** Track by subsection ID */
  trackBySubsectionId(index: number, subsection: SubsectionEntity): string {
    return subsection.id;
  }
}
