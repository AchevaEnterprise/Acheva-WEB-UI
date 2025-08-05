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
      activeIcon: 'icons/general/active-draft-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-draft-timeline-icon.svg',
      active: true,
    },
    {
      status: 'HOD Review',
      time: 'Pending',
      activeIcon: 'icons/general/active-hod-review-icon.svg',
      inactiveIcon: 'icons/general/inactive-hod-review-icon.svg',
      active: false,
    },
    {
      status: 'Dean Approval',
      time: 'Pending',
      activeIcon: 'icons/general/active-dean-approval-icon.svg',
      inactiveIcon: 'icons/general/inactive-dean-approval-icon.svg',
      active: false,
    },
    {
      status: 'Published',
      time: 'Pending',
      activeIcon: 'icons/general/active-published-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-published-timeline-icon.svg',
      active: false,
    },
  ]);
}
