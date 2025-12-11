import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RichTextToolbarService } from '../../../../core/services/rich-text-editor/rich-text-toolbar.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-rich-text-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rich-text-toolbar.component.html',
  styleUrls: ['./rich-text-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextToolbarComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('toolbarContainer', { static: false }) toolbarContainer?: ElementRef<HTMLElement>;

  private readonly toolbarService = inject(RichTextToolbarService);
  private readonly editorState = inject(EditorStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private toolbarSubscription?: Subscription;
  private pendingToolbarElement: HTMLElement | null = null;
  
  // Track if a text widget is active
  isTextWidgetActive = false;

  constructor() {
    // Watch for active widget changes to determine if a text widget is selected
    effect(() => {
      const activeWidget = this.editorState.activeWidget();
      this.isTextWidgetActive = activeWidget?.type === 'text';
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Subscribe to active toolbar element changes
    this.toolbarSubscription = this.toolbarService.activeToolbar$.subscribe((toolbarElement) => {
      if (this.toolbarContainer) {
        this.updateToolbar(toolbarElement);
      } else {
        // Store for later when view is ready
        this.pendingToolbarElement = toolbarElement;
      }
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    // Mount pending toolbar if available
    if (this.pendingToolbarElement && this.toolbarContainer) {
      this.updateToolbar(this.pendingToolbarElement);
      this.pendingToolbarElement = null;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    if (this.toolbarSubscription) {
      this.toolbarSubscription.unsubscribe();
    }
  }

  private updateToolbar(toolbarElement: HTMLElement | null): void {
    if (!this.toolbarContainer) {
      return;
    }

    const container = this.toolbarContainer.nativeElement;
    
    // Clear existing toolbar
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Append new toolbar if available
    if (toolbarElement && toolbarElement.parentNode !== container) {
      // Remove from previous parent if it exists
      if (toolbarElement.parentNode) {
        toolbarElement.parentNode.removeChild(toolbarElement);
      }
      container.appendChild(toolbarElement);
    }
  }

  get hasActiveToolbar(): boolean {
    // Show toolbar container if a text widget is active
    return this.isTextWidgetActive;
  }
}

