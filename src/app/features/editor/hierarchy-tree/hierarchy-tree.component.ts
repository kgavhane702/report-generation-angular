import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FlatTreeControl } from '@angular/cdk/tree';
import {
  MatTreeFlatDataSource,
  MatTreeFlattener,
} from '@angular/material/tree';

import { DocumentModel } from '../../../models/document.model';
import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { PageModel } from '../../../models/page.model';

type NodeType = 'section' | 'subsection' | 'page';

interface HierarchyNode {
  id: string;
  title: string;
  type: NodeType;
  sectionId: string;
  subsectionId?: string;
  pageId?: string;
  children?: HierarchyNode[];
}

interface HierarchyFlatNode {
  id: string;
  title: string;
  type: NodeType;
  sectionId: string;
  subsectionId?: string;
  pageId?: string;
  level: number;
  expandable: boolean;
}

@Component({
  selector: 'app-hierarchy-tree',
  templateUrl: './hierarchy-tree.component.html',
  styleUrls: ['./hierarchy-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HierarchyTreeComponent {
  private readonly documentService = inject(DocumentService);
  protected readonly editorState = inject(EditorStateService);

  private readonly document = signal<DocumentModel>(this.documentService.document);

  private readonly transformer = (node: HierarchyNode, level: number): HierarchyFlatNode => ({
    id: node.id,
    title: node.title,
    type: node.type,
    sectionId: node.sectionId,
    subsectionId: node.subsectionId,
    pageId: node.pageId,
    level,
    expandable: !!node.children?.length,
  });

  treeControl = new FlatTreeControl<HierarchyFlatNode>(
    (node) => node.level,
    (node) => node.expandable
  );

  treeFlattener = new MatTreeFlattener<
    HierarchyNode,
    HierarchyFlatNode
  >(
    this.transformer,
    (node) => node.level,
    (node) => node.expandable,
    (node) => node.children ?? []
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  editingNodeId: string | null = null;
  editingValue = '';

  readonly hasChild = (_: number, node: HierarchyFlatNode) => node.expandable;

  constructor() {
    effect(() => {
      const doc = this.documentService.document;
      this.document.set(doc);
      const nodes = this.buildTree(doc);
      this.dataSource.data = nodes;
      queueMicrotask(() => {
        this.expandActivePath();
      });
    });
  }

  addSection(): void {
    const ids = this.documentService.addSection();
    if (ids.sectionId) {
      this.editorState.setActiveSection(ids.sectionId);
    }
    if (ids.subsectionId) {
      this.editorState.setActiveSubsection(ids.subsectionId);
    }
    if (ids.pageId) {
      this.editorState.setActivePage(ids.pageId);
    }
  }

  addChild(node: HierarchyFlatNode, event: MouseEvent): void {
    event.stopPropagation();
    if (node.type === 'section') {
      const result = this.documentService.addSubsection(node.sectionId);
      if (result?.subsectionId) {
        this.editorState.setActiveSection(node.sectionId);
        this.editorState.setActiveSubsection(result.subsectionId);
        if (result.pageId) {
          this.editorState.setActivePage(result.pageId);
        }
      }
    } else if (node.type === 'subsection' && node.subsectionId) {
      const pageId = this.documentService.addPage(node.subsectionId);
      if (pageId) {
        this.editorState.setActiveSection(node.sectionId);
        this.editorState.setActiveSubsection(node.subsectionId);
        this.editorState.setActivePage(pageId);
      }
    }
  }

  deleteNode(node: HierarchyFlatNode, event: MouseEvent): void {
    event.stopPropagation();
    if (node.type === 'section') {
      const fallback = this.documentService.deleteSection(node.sectionId);
      if (fallback?.sectionId) {
        this.editorState.setActiveSection(fallback.sectionId);
      }
      if (fallback?.subsectionId) {
        this.editorState.setActiveSubsection(fallback.subsectionId);
      }
      if (fallback?.pageId) {
        this.editorState.setActivePage(fallback.pageId);
      }
      return;
    }
    if (node.type === 'subsection' && node.subsectionId) {
      const fallback = this.documentService.deleteSubsection(
        node.sectionId,
        node.subsectionId
      );
      if (fallback?.subsectionId) {
        this.editorState.setActiveSubsection(fallback.subsectionId);
      }
      if (fallback?.pageId) {
        this.editorState.setActivePage(fallback.pageId);
      }
      return;
    }
    if (node.type === 'page' && node.subsectionId && node.pageId) {
      const fallbackId = this.documentService.deletePage(
        node.subsectionId,
        node.pageId
      );
      if (fallbackId) {
        this.editorState.setActivePage(fallbackId);
      }
      return;
    }
  }

  startEdit(node: HierarchyFlatNode, event: MouseEvent): void {
    event.stopPropagation();
    this.editingNodeId = node.id;
    this.editingValue = node.title;
  }

  saveTitle(node: HierarchyFlatNode): void {
    const value = this.editingValue.trim();
    if (!value) {
      this.editingNodeId = null;
      return;
    }

    if (node.type === 'section') {
      this.documentService.renameSection(node.sectionId, value);
    } else if (node.type === 'subsection' && node.subsectionId) {
      this.documentService.renameSubsection(node.subsectionId, value);
    } else if (node.type === 'page' && node.subsectionId && node.pageId) {
      this.documentService.renamePage(node.subsectionId, node.pageId, value);
    }

    this.editingNodeId = null;
  }

  cancelEdit(): void {
    this.editingNodeId = null;
  }

  selectNode(node: HierarchyFlatNode): void {
    if (node.type === 'section') {
      this.editorState.setActiveSection(node.sectionId);
    } else if (node.type === 'subsection' && node.subsectionId) {
      this.editorState.setActiveSection(node.sectionId);
      this.editorState.setActiveSubsection(node.subsectionId);
    } else if (node.type === 'page' && node.subsectionId && node.pageId) {
      this.editorState.setActiveSection(node.sectionId);
      this.editorState.setActiveSubsection(node.subsectionId);
      this.editorState.setActivePage(node.pageId);
    }
  }

  isActive(node: HierarchyFlatNode): boolean {
    if (node.type === 'section') {
      return this.editorState.activeSectionId() === node.sectionId;
    }
    if (node.type === 'subsection') {
      return this.editorState.activeSubsectionId() === node.subsectionId;
    }
    if (node.type === 'page') {
      return this.editorState.activePageId() === node.pageId;
    }
    return false;
  }

  canDeleteSection(sectionId: string): boolean {
    return this.document().sections.length > 1;
  }

  canDeleteSubsection(sectionId: string): boolean {
    const section = this.document().sections.find((s) => s.id === sectionId);
    return (section?.subsections.length ?? 0) > 1;
  }

  canDeletePage(subsectionId: string): boolean {
    const subsection = this.document()
      .sections.flatMap((section) => section.subsections)
      .find((sub) => sub.id === subsectionId);
    return (subsection?.pages.length ?? 0) > 1;
  }

  private buildTree(document: DocumentModel): HierarchyNode[] {
    return document.sections.map((section) => ({
      id: section.id,
      title: section.title,
      type: 'section',
      sectionId: section.id,
      children: section.subsections.map((subsection) => ({
        id: subsection.id,
        title: subsection.title,
        type: 'subsection',
        sectionId: section.id,
        subsectionId: subsection.id,
        children: subsection.pages.map((page) =>
          this.mapPage(page, section.id, subsection.id)
        ),
      })),
    }));
  }

  private mapPage(
    page: PageModel,
    sectionId: string,
    subsectionId: string
  ): HierarchyNode {
    return {
      id: page.id,
      title: page.title ?? `Page ${page.number}`,
      type: 'page',
      sectionId,
      subsectionId,
      pageId: page.id,
    };
  }

  private expandActivePath(): void {
    const sectionId = this.editorState.activeSectionId();
    const subsectionId = this.editorState.activeSubsectionId();

    if (sectionId) {
      const sectionNode = this.treeControl.dataNodes.find(
        (node) => node.type === 'section' && node.sectionId === sectionId
      );
      if (sectionNode) {
        this.treeControl.expand(sectionNode);
      }
    }
    if (subsectionId) {
      const subsectionNode = this.treeControl.dataNodes.find(
        (node) => node.type === 'subsection' && node.subsectionId === subsectionId
      );
      if (subsectionNode) {
        this.treeControl.expand(subsectionNode);
      }
    }
  }
}

