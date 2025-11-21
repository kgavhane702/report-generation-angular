import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ImageWidgetProps, WidgetModel } from '../../../../models/widget.model';

@Component({
  selector: 'app-image-widget',
  templateUrl: './image-widget.component.html',
  styleUrls: ['./image-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageWidgetComponent {
  @Input({ required: true }) widget!: WidgetModel;

  get imageProps(): ImageWidgetProps {
    return this.widget.props as ImageWidgetProps;
  }
}

