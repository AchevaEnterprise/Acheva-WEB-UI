import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

export interface IActivity {
  type: 'submit' | 'add' | 'reminder' | 'edit';
  message: string;
  date: Date;
}

@Component({
  selector: 'app-activity',
  imports: [SvgComponent, MatDividerModule, DatePipe],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent {
  activity = input<IActivity>();
}
