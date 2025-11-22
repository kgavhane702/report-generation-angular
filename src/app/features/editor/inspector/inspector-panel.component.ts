import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { WidgetModel } from '../../../models/widget.model';

@Component({
  selector: 'app-inspector-panel',
  templateUrl: './inspector-panel.component.html',
  styleUrls: ['./inspector-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectorPanelComponent {
  protected readonly editorState = inject(EditorStateService);

  private readonly documentService = inject(DocumentService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private suppressFormEmission = false;

  readonly hasWidgetSelected = signal(false);

  readonly propertiesForm = this.fb.group({
    x: [0],
    y: [0],
    width: [120],
    height: [80],
    rotation: [0],
    zIndex: [0],
    fontSize: [16],
    fontColor: ['#0f172a'],
  });

  constructor() {
    this.propertiesForm.valueChanges
      .pipe(debounceTime(120), takeUntilDestroyed())
      .subscribe((value) => {
        if (this.suppressFormEmission) {
          return;
        }
        const context = this.editorState.activeWidgetContext();
        if (!context) {
          return;
        }
        const { widget, pageId, subsectionId } = context;
        const payload: Partial<WidgetModel> = {
          position: {
            x: value.x ?? widget.position.x,
            y: value.y ?? widget.position.y,
          },
          size: {
            width: value.width ?? widget.size.width,
            height: value.height ?? widget.size.height,
          },
          rotation: value.rotation ?? widget.rotation,
          zIndex: value.zIndex ?? widget.zIndex,
          style: {
            ...widget.style,
            fontSize: value.fontSize,
            color: value.fontColor,
          },
        };

        this.documentService.updateWidget(
          subsectionId,
          pageId,
          widget.id,
          payload
        );
      });

    effect(() => {
      const context = this.editorState.activeWidgetContext();
      this.hasWidgetSelected.set(!!context);

      if (!context) {
        this.propertiesForm.disable({ emitEvent: false });
        this.cdr.markForCheck();
        return;
      }

      this.propertiesForm.enable({ emitEvent: false });
      this.patchFormFromWidget(context.widget);
      this.cdr.markForCheck();
    });
  }

  clearSelection(): void {
    this.editorState.setActiveWidget(null);
  }

  private patchFormFromWidget(widget: WidgetModel): void {
    this.suppressFormEmission = true;
    this.propertiesForm.patchValue(
      {
        x: widget.position.x,
        y: widget.position.y,
        width: widget.size.width,
        height: widget.size.height,
        rotation: widget.rotation ?? 0,
        zIndex: widget.zIndex,
        fontSize: Number(widget.style?.fontSize ?? 16),
        fontColor: (widget.style?.color as string) ?? '#0f172a',
      },
      { emitEvent: false }
    );
    this.suppressFormEmission = false;
  }
}

