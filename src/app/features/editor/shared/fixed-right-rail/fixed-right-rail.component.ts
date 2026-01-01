import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

/**
 * FixedRightRailComponent
 *
 * Reusable fixed-position right rail pinned to the editor viewport area,
 * accounting for the toolbar + optional widget toolbar height via CSS vars:
 * - --editor-toolbar-height
 * - --editor-widget-toolbar-height
 * - --editor-rail-width
 */
@Component({
  selector: 'app-fixed-right-rail',
  templateUrl: './fixed-right-rail.component.html',
  styleUrls: ['./fixed-right-rail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixedRightRailComponent {
  /**
   * Optional z-index override (defaults to a safe value above canvas content).
   */
  @Input() zIndex = 150;

  @HostBinding('style.z-index')
  get hostZIndex(): number {
    return this.zIndex;
  }
}


