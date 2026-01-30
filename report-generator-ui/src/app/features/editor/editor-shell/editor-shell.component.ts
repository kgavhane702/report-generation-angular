import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
  computed,
  effect,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  Injector,
  runInInjectionContext,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { UIStateService } from '../../../core/services/ui-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { ChartRegistryInitializer } from '../plugins/chart/engine/runtime';
import { ExportUiStateService } from '../../../core/services/export-ui-state.service';
import { ScrollToRequest } from '../slide-navigator/slide-navigator.component';
import { ScrollMetricsDirective } from '../shared/scroll-metrics.directive';
import type { ContextMenuItem } from '../../../shared/components/context-menu/context-menu.component';

@Component({
  selector: 'app-editor-shell',
  templateUrl: './editor-shell.component.html',
  styleUrls: ['./editor-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorShellComponent implements AfterViewInit, OnDestroy {
  protected readonly editorState = inject(EditorStateService);
  private readonly uiState = inject(UIStateService);
  private readonly documentService = inject(DocumentService);
  private readonly chartRegistryInitializer = inject(ChartRegistryInitializer);
  protected readonly exportUi = inject(ExportUiStateService);
  private readonly injector = inject(Injector);

  // Canvas context menu (right-click on empty editor surface)
  canvasMenuOpen = false;
  canvasMenuX: number | null = null;
  canvasMenuY: number | null = null;
  canvasMenuTargetPageId: string | null = null;
  canvasMenuTargetPageX: number | null = null;
  canvasMenuTargetPageY: number | null = null;

  get canvasContextMenuItems(): ContextMenuItem[] {
    const hasPage = !!(this.canvasMenuTargetPageId ?? this.editorState.activePageId());
    const locked = this.documentService.documentLocked() === true;
    const canPaste = this.documentService.canPaste();

    return [
      {
        id: 'paste',
        label: 'Paste',
        icon: 'paste',
        disabled: locked || !hasPage || !canPaste,
      },
    ];
  }

  @ViewChild('scrollMetrics', { static: true }) private scrollMetrics!: ScrollMetricsDirective;

  // Left sidebar "You are here" path
  readonly location = computed(() => {
    const section = this.editorState.activeSection();
    const subsection = this.editorState.activeSubsection();
    const page = this.editorState.activePage();
    const pageNumber = this.editorState.activePageNumber();

    const sectionTitle = section?.title || 'Section';
    const subsectionTitle = subsection?.title || 'Subsection';
    const pageTitle = page ? (page.title ?? `Page ${pageNumber}`) : '';

    return { sectionTitle, subsectionTitle, pageTitle };
  });

  readonly locationText = computed(() => {
    const loc = this.location();
    return [loc.sectionTitle, loc.subsectionTitle, loc.pageTitle].filter(Boolean).join(' › ');
  });

  onLocationSectionClick(): void {
    const sectionId = this.editorState.activeSectionId();
    if (!sectionId) return;
    this.editorState.setActiveSection(sectionId);
  }

  onLocationSubsectionClick(): void {
    const subsectionId = this.editorState.activeSubsectionId();
    if (!subsectionId) return;
    this.editorState.setActiveSubsection(subsectionId);
  }

  onLocationPageClick(): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;
    this.editorState.setActivePage(pageId);
    const surface = document.getElementById(`page-surface-${pageId}`);
    surface?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  // Slide navigator state (pinned to editor-shell__canvas)
  readonly pageIds = this.editorState.documentPageIds;
  readonly currentPageIndex = computed(() => {
    const activePageId = this.editorState.activePageId();
    const ids = this.pageIds();
    if (!activePageId) return 0;
    const idx = ids.indexOf(activePageId);
    return idx >= 0 ? idx : 0;
  });

  onCanvasPageChange(newIndex: number): void {
    const ids = this.pageIds();
    if (newIndex >= 0 && newIndex < ids.length) {
      const pageId = ids[newIndex];
      this.editorState.setActivePage(pageId);

      // Scroll to that page (continuous scroll mode)
      const surface = document.getElementById(`page-surface-${pageId}`);
      surface?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }

  onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.canvasMenuX = event.clientX;
    this.canvasMenuY = event.clientY;

    // Identify which page surface was clicked (supports multi-page continuous scroll).
    const target = this.findPageSurfaceAtPoint(event.clientX, event.clientY);
    this.canvasMenuTargetPageId = target?.pageId ?? this.editorState.activePageId() ?? null;
    this.canvasMenuTargetPageX = target?.x ?? null;
    this.canvasMenuTargetPageY = target?.y ?? null;

    this.canvasMenuOpen = true;
  }

  onCanvasMenuItemSelected(actionId: string): void {
    this.canvasMenuOpen = false;

    if (actionId !== 'paste') return;

    queueMicrotask(() => {
      const pageId = this.canvasMenuTargetPageId ?? this.editorState.activePageId();
      if (!pageId) return;
      if (this.documentService.documentLocked()) return;
      if (!this.documentService.canPaste()) return;

      const at =
        this.canvasMenuTargetPageX != null && this.canvasMenuTargetPageY != null
          ? { x: this.canvasMenuTargetPageX, y: this.canvasMenuTargetPageY }
          : undefined;

      const pastedWidgetIds = this.documentService.pasteWidgets(pageId, { at });
      if (pastedWidgetIds.length > 0) {
        // Select all pasted widgets (also sets first as active)
        this.uiState.selectMultiple(pastedWidgetIds);
      }
    });
  }

  private findPageSurfaceAtPoint(clientX: number, clientY: number): { pageId: string; x: number; y: number } | null {
    const surfaces = Array.from(document.querySelectorAll<HTMLElement>('.page__surface'));
    if (surfaces.length === 0) return null;

    const zoom = this.editorState.zoom();
    const scale = Math.max(0.01, (zoom ?? 100) / 100);

    for (const surface of surfaces) {
      const rect = surface.getBoundingClientRect();
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (!inside) continue;

      const id = surface.id || '';
      const prefix = 'page-surface-';
      const pageId = id.startsWith(prefix) ? id.slice(prefix.length) : this.editorState.activePageId() ?? '';
      if (!pageId) return null;

      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;
      return { pageId, x: Math.max(0, x), y: Math.max(0, y) };
    }

    return null;
  }

  // Computed signals to determine if toolbars should be shown
  readonly showWidgetToolbar = computed(() => {
    if (this.documentService.documentLocked()) {
      return false;
    }
    const widget = this.editorState.activeWidget();
    return (
      widget?.type === 'text' ||
      widget?.type === 'table' ||
      widget?.type === 'chart' ||
      widget?.type === 'editastra' ||
      widget?.type === 'image' ||
      widget?.type === 'object' ||
      widget?.type === 'connector'
    );
  });

  readonly showExportOverlay = computed(() => this.exportUi.active());

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isInputElement =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Arrow Up/Down: flip pages directly (but don't steal keys from text editing)
    if (!isInputElement && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      // Avoid interfering with widget editing/selection behaviors
      if (this.editorState.activeWidgetId()) {
        return;
      }

      const delta = event.key === 'ArrowDown' ? 1 : -1;
      event.preventDefault();
      this.onCanvasPageChange(this.currentPageIndex() + delta);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !event.shiftKey) {
      if (!isInputElement) {
        event.preventDefault();
        this.copySelectedWidget();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'x' && !event.shiftKey) {
      if (!isInputElement) {
        event.preventDefault();
        this.cutSelectedWidget();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'v' && !event.shiftKey) {
      if (!isInputElement) {
        event.preventDefault();
        this.pasteWidgets();
      }
    }

    if (!isInputElement && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.deleteSelectedWidget();
      }
    }
  }

  private copySelectedWidget(): void {
    const selectedIds = Array.from(this.uiState.selectedWidgetIds());
    const pageId = this.editorState.activePageId();

    if (selectedIds.length > 1) {
      if (!pageId) return;
      this.documentService.copyWidgets(pageId, selectedIds);
      return;
    }

    if (selectedIds.length === 1) {
      if (!pageId) return;
      this.documentService.copyWidget(pageId, selectedIds[0]);
      return;
    }

    const widgetContext = this.editorState.activeWidgetContext();
    if (!widgetContext) return;

    this.documentService.copyWidget(widgetContext.pageId, widgetContext.widget.id);
  }

  private cutSelectedWidget(): void {
    const selectedIds = Array.from(this.uiState.selectedWidgetIds());
    const pageId = this.editorState.activePageId();

    if (selectedIds.length > 1) {
      if (!pageId) return;
      this.documentService.cutWidgets(pageId, selectedIds);
      this.uiState.clearSelection();
      return;
    }

    if (selectedIds.length === 1) {
      if (!pageId) return;
      this.documentService.cutWidget(pageId, selectedIds[0]);
      this.uiState.clearSelection();
      return;
    }

    const widgetContext = this.editorState.activeWidgetContext();
    if (!widgetContext) return;

    this.documentService.cutWidget(widgetContext.pageId, widgetContext.widget.id);

    this.editorState.setActiveWidget(null);
  }

  private deleteSelectedWidget(): void {
    if (this.documentService.documentLocked()) {
      return;
    }

    const selectedIds = Array.from(this.uiState.selectedWidgetIds());
    const pageId = this.editorState.activePageId();

    if (selectedIds.length > 1) {
      if (!pageId) return;
      // Use batch delete for single undo operation
      this.documentService.deleteWidgets(pageId, selectedIds);
      this.uiState.clearSelection();
      return;
    }

    if (selectedIds.length === 1) {
      if (!pageId) return;
      this.documentService.deleteWidget(pageId, selectedIds[0]);
      this.uiState.clearSelection();
      return;
    }

    const widgetContext = this.editorState.activeWidgetContext();
    if (!widgetContext) return;

    this.documentService.deleteWidget(widgetContext.pageId, widgetContext.widget.id);

    this.editorState.setActiveWidget(null);
  }

  private pasteWidgets(): void {
    const pageId = this.editorState.activePageId();

    if (!pageId) {
      return;
    }

    if (!this.documentService.canPaste()) {
      return;
    }

    const pastedWidgetIds = this.documentService.pasteWidgets(pageId);

    if (pastedWidgetIds.length > 0) {
      // Select all pasted widgets (also sets first as active)
      this.uiState.selectMultiple(pastedWidgetIds);
    }
  }

  ngAfterViewInit(): void {
    // Initial zoom: fit to window (dynamic) on first render.
    queueMicrotask(() => this.editorState.fitToWindow());

    // Zoom affects layout via wrapperHeight; refresh scroll metrics when zoom changes
    runInInjectionContext(this.injector, () => {
      effect(() => {
        this.editorState.zoom();
        queueMicrotask(() => this.scrollMetrics.refresh());
      });
    });
  }

  ngOnDestroy(): void {
  }

  onNavigatorScrollTo(req: ScrollToRequest): void {
    this.scrollMetrics?.scrollTo(req);
  }

  onNavigatorScrollBy(deltaY: number): void {
    this.scrollMetrics?.scrollBy(deltaY, 'auto');
  }
}
