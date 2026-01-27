import { ChangeDetectionStrategy, Component, Input, TemplateRef, ViewChild } from '@angular/core';

let nextTabId = 0;

@Component({
  selector: 'app-tab',
  standalone: true,
  templateUrl: './app-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppTabComponent {
  /** Visible label in the tab header */
  @Input({ required: true }) label!: string;

  /** Optional leading icon (Material Symbols name or simple text) */
  @Input() icon?: string;

  /** Disable selection */
  @Input() disabled = false;

  /** Stable id (useful for tests/aria); auto-generated if not provided */
  @Input() id = `app-tab-${++nextTabId}`;

  /** Content template captured for projection by app-tabs */
  @ViewChild('contentTpl', { static: true }) contentTpl!: TemplateRef<unknown>;

  get tabButtonId(): string {
    return this.id;
  }

  get tabPanelId(): string {
    return `${this.id}-panel`;
  }
}


