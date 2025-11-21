import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import {
  ChartWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';
import { ChartRegistryService } from '../chart/chart-registry.service';
import { ChartInstance } from '../chart/chart-adapter';

@Component({
  selector: 'app-chart-widget',
  templateUrl: './chart-widget.component.html',
  styleUrls: ['./chart-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartWidgetComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private instance?: ChartInstance;

  constructor(private readonly registry: ChartRegistryService) {}

  ngAfterViewInit(): void {
    const adapter = this.registry.getAdapter(this.chartProps.provider);
    if (adapter) {
      this.instance = adapter.render(
        this.containerRef.nativeElement,
        this.chartProps
      ) as ChartInstance;
    } else {
      this.containerRef.nativeElement.textContent =
        'No chart adapter registered';
    }
  }

  ngOnDestroy(): void {
    this.instance?.destroy?.();
  }

  private get chartProps(): ChartWidgetProps {
    return this.widget.props as ChartWidgetProps;
  }
}

