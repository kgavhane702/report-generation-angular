import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
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
import { TextWidgetColorPickerComponent } from '../text-widget-color-picker/text-widget-color-picker.component';
import { TableToolbarComponent } from '../table-toolbar/table-toolbar.component';
import { Subscription } from 'rxjs';

/**
 * RichTextToolbarComponent
 * 
 * REFACTORED: Uses computed signal instead of effect for widget type check.
 * Subscription callback still needs markForCheck since it's RxJS, not signals.
 */
@Component({
  selector: 'app-rich-text-toolbar',
  standalone: true,
  imports: [CommonModule, TextWidgetColorPickerComponent, TableToolbarComponent],
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
  
  /**
   * Computed signal: automatically updates when activeWidget changes
   * No manual markForCheck needed since signals handle this
   */
  readonly isTextWidgetActive = computed(() => {
    const activeWidget = this.editorState.activeWidget();
    return activeWidget?.type === 'text';
  });

  readonly isTableWidgetActive = computed(() => {
    const activeWidget = this.editorState.activeWidget();
    return activeWidget?.type === 'table';
  });

  ngOnInit(): void {
    // Subscribe to active toolbar element changes
    // markForCheck is needed here because this is an RxJS subscription, not a signal
    this.toolbarSubscription = this.toolbarService.activeToolbar$.subscribe((toolbarElement) => {
      if (this.toolbarContainer) {
        this.updateToolbar(toolbarElement);
      } else {
        this.pendingToolbarElement = toolbarElement;
      }
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
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
    
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (toolbarElement && toolbarElement.parentNode !== container) {
      if (toolbarElement.parentNode) {
        toolbarElement.parentNode.removeChild(toolbarElement);
      }
      container.appendChild(toolbarElement);
    }
  }

  get hasActiveToolbar(): boolean {
    return this.isTextWidgetActive();
  }

  get hasTableToolbar(): boolean {
    return this.isTableWidgetActive();
  }
}
