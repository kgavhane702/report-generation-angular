import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { RichTextToolbarService } from '../../../../../../core/services/rich-text-editor/rich-text-toolbar.service';
import { EditorStateService } from '../../../../../../core/services/editor-state.service';
import { TextWidgetColorPickerComponent } from '../text-widget-color-picker/text-widget-color-picker.component';

/**
 * TextWidgetToolbarComponent
 *
 * Text-widget-specific toolbar adapter:
 * - Hosts the CKEditor toolbar DOM element (provided by RichTextToolbarService)
 * - Adds the background color picker UI next to it
 */
@Component({
  selector: 'app-text-widget-toolbar',
  standalone: true,
  imports: [CommonModule, TextWidgetColorPickerComponent],
  templateUrl: './text-widget-toolbar.component.html',
  styleUrls: ['./text-widget-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextWidgetToolbarComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('toolbarContainer', { static: false }) toolbarContainer?: ElementRef<HTMLElement>;

  private readonly toolbarService = inject(RichTextToolbarService);
  private readonly editorState = inject(EditorStateService);
  private readonly cdr = inject(ChangeDetectorRef);

  private toolbarSubscription?: Subscription;
  private pendingToolbarElement: HTMLElement | null = null;

  readonly isTextWidgetActive = computed(() => this.editorState.activeWidget()?.type === 'text');

  ngOnInit(): void {
    this.toolbarSubscription = this.toolbarService.activeToolbar$.subscribe((toolbarElement) => {
      if (this.toolbarContainer) {
        this.updateToolbar(toolbarElement);
      } else {
        this.pendingToolbarElement = toolbarElement;
      }
      // RxJS subscription -> still needs manual CD hint under OnPush.
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
    this.toolbarSubscription?.unsubscribe();
  }

  get hasActiveToolbar(): boolean {
    return this.isTextWidgetActive();
  }

  private updateToolbar(toolbarElement: HTMLElement | null): void {
    const container = this.toolbarContainer?.nativeElement;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (toolbarElement && toolbarElement.parentNode !== container) {
      toolbarElement.parentNode?.removeChild(toolbarElement);
      container.appendChild(toolbarElement);
    }
  }
}


