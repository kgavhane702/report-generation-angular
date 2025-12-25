import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppTabComponent } from '../app-tab/app-tab.component';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-tabs.component.html',
  styleUrls: ['./app-tabs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppTabsComponent implements AfterContentInit {
  @ContentChildren(AppTabComponent) private readonly tabsQuery!: QueryList<AppTabComponent>;

  /** 0-based index of active tab */
  @Input() activeIndex = 0;
  @Output() activeIndexChange = new EventEmitter<number>();

  /** Optional header label for accessibility */
  @Input() ariaLabel = 'Tabs';

  /** Keep the header visible while scrolling (useful in long dialogs) */
  @Input() stickyHeader = false;

  @HostBinding('class.app-tabs') readonly hostClass = true;
  @HostBinding('class.app-tabs--sticky') get stickyClass(): boolean {
    return this.stickyHeader;
  }

  get tabs(): AppTabComponent[] {
    return this.tabsQuery?.toArray() ?? [];
  }

  get activeTab(): AppTabComponent | undefined {
    return this.tabs[this.activeIndex];
  }

  ngAfterContentInit(): void {
    // Clamp to first enabled tab if needed.
    this.ensureValidActiveIndex();

    this.tabsQuery.changes.subscribe(() => {
      this.ensureValidActiveIndex();
    });
  }

  select(index: number): void {
    const tab = this.tabs[index];
    if (!tab || tab.disabled) return;
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    this.activeIndexChange.emit(this.activeIndex);
  }

  onHeaderKeydown(event: KeyboardEvent): void {
    const { key } = event;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;

    event.preventDefault();

    const enabledIndexes = this.tabs
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => !t.disabled)
      .map(({ i }) => i);

    if (enabledIndexes.length === 0) return;

    const currentPos = enabledIndexes.indexOf(this.activeIndex);
    const safePos = currentPos >= 0 ? currentPos : 0;

    let nextIndex = this.activeIndex;
    if (key === 'Home') nextIndex = enabledIndexes[0];
    if (key === 'End') nextIndex = enabledIndexes[enabledIndexes.length - 1];
    if (key === 'ArrowLeft') nextIndex = enabledIndexes[(safePos - 1 + enabledIndexes.length) % enabledIndexes.length];
    if (key === 'ArrowRight') nextIndex = enabledIndexes[(safePos + 1) % enabledIndexes.length];

    this.select(nextIndex);
  }

  private ensureValidActiveIndex(): void {
    if (!this.tabs.length) {
      this.activeIndex = 0;
      return;
    }

    // Clamp to range.
    const clamped = Math.max(0, Math.min(this.activeIndex, this.tabs.length - 1));
    this.activeIndex = clamped;

    // If the active tab is disabled, find the first enabled tab.
    if (this.tabs[this.activeIndex]?.disabled) {
      const firstEnabled = this.tabs.findIndex((t) => !t.disabled);
      this.activeIndex = firstEnabled >= 0 ? firstEnabled : 0;
    }
  }
}


