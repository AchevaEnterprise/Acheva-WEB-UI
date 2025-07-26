import { Component, signal } from '@angular/core';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';

@Component({
  selector: 'app-time-line',
  imports: [SvgComponent],
  templateUrl: './time-line.component.html',
  styleUrl: './time-line.component.scss',
})
export class TimeLineComponent {
  timelines = signal([
    {
      status: 'Drafts',
      time: 'Today at 10:45 AM',
      activeIcon: '',
      inactiveIcon: '',
    },
    {
      status: 'Pending',
      time: 'Pending',
      activeIcon: '',
      inactiveIcon: '',
    },
    {
      status: 'Dean Approval',
      time: 'Pending',
      activeIcon: '',
      inactiveIcon: '',
    },
    {
      status: 'Published',
      time: 'Pending',
      activeIcon: '',
      inactiveIcon: '',
    },
  ]);
}
