import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';

type Status =
  | 'DRAFT'
  | 'PENDING'
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'PUBLISHED'
  | 'IMPORTED';

interface ITimeline {
  label: string;
  activeIcon: string;
  inactiveIcon: string;
  activeStatus: Status[];
  completed: boolean;
}

@Component({
  selector: 'app-time-line',
  imports: [SvgComponent],
  templateUrl: './time-line.component.html',
  styleUrl: './time-line.component.scss',
  providers: [DatePipe],
})
export class TimeLineComponent {
  status = input<Status | undefined>();

  timelineSteps = signal<ITimeline[]>([
    {
      label: 'Drafts',
      activeIcon: 'icons/general/active-draft-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-draft-timeline-icon.svg',
      activeStatus: ['PENDING', 'UNVERIFIED', 'VERIFIED', 'PUBLISHED'],
      completed: false,
    },
    {
      label: 'HOD Review',
      activeIcon: 'icons/general/active-hod-review-icon.svg',
      inactiveIcon: 'icons/general/inactive-hod-review-icon.svg',
      activeStatus: ['UNVERIFIED', 'VERIFIED', 'PUBLISHED'],
      completed: false,
    },
    {
      label: 'Dean Approval',
      activeIcon: 'icons/general/active-dean-approval-icon.svg',
      inactiveIcon: 'icons/general/inactive-dean-approval-icon.svg',
      activeStatus: ['VERIFIED', 'PUBLISHED'],
      completed: false,
    },
    {
      label: 'Published',
      activeIcon: 'icons/general/active-published-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-published-timeline-icon.svg',
      activeStatus: ['PUBLISHED'],
      completed: false,
    },
  ]);

  timelines = computed<ITimeline[]>(() => {
    const currentStatus = this.status();

    const steps: ITimeline[] = this.timelineSteps()?.map((step) => {
      step.completed = step.activeStatus.includes(currentStatus!);
      return step;
    });

    return steps;
  });
}
