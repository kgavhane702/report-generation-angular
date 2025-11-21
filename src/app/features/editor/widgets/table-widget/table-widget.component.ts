import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import {
  TableWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';

@Component({
  selector: 'app-table-widget',
  templateUrl: './table-widget.component.html',
  styleUrls: ['./table-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableWidgetComponent {
  @Input({ required: true }) widget!: WidgetModel;

  get columns(): TableWidgetProps['columns'] {
    return (this.widget.props as TableWidgetProps).columns;
  }

  get rows(): TableWidgetProps['rows'] {
    return (this.widget.props as TableWidgetProps).rows;
  }
}

