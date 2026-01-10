import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';
import { ResultStatusEnum } from '../../../models/results.model';

interface ITimeline {
  label: string;
  activeIcon: string;
  inactiveIcon: string;
  activeStatus: ResultStatusEnum[];
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
  status = input<ResultStatusEnum | undefined>();

  timelineSteps = signal<ITimeline[]>([
    {
      label: 'Drafts',
      activeIcon: 'icons/general/active-draft-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-draft-timeline-icon.svg',
      activeStatus: [
        ResultStatusEnum.PENDING,
        ResultStatusEnum.UNVERIFIED,
        ResultStatusEnum.VERIFIED,
        ResultStatusEnum.PUBLISHED,
      ],
      completed: false,
    },
    {
      label: 'HOD Review',
      activeIcon: 'icons/general/active-hod-review-icon.svg',
      inactiveIcon: 'icons/general/inactive-hod-review-icon.svg',
      activeStatus: [
        ResultStatusEnum.UNVERIFIED,
        ResultStatusEnum.VERIFIED,
        ResultStatusEnum.PUBLISHED,
      ],
      completed: false,
    },
    {
      label: 'Dean Approval',
      activeIcon: 'icons/general/active-dean-approval-icon.svg',
      inactiveIcon: 'icons/general/inactive-dean-approval-icon.svg',
      activeStatus: [ResultStatusEnum.VERIFIED, ResultStatusEnum.PUBLISHED],
      completed: false,
    },
    {
      label: 'Published',
      activeIcon: 'icons/general/active-published-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-published-timeline-icon.svg',
      activeStatus: [ResultStatusEnum.PUBLISHED],
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
