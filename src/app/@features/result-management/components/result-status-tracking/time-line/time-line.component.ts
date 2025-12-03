import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';

const STATUS_FLOW = [
  'DRAFT',
  'PENDING',
  'UNVERIFIED',
  'VERIFIED',
  'PUBLISHED',
  'IMPORTED',
] as const;
type Status = (typeof STATUS_FLOW)[number];

@Component({
  selector: 'app-time-line',
  imports: [SvgComponent],
  templateUrl: './time-line.component.html',
  styleUrl: './time-line.component.scss',
  providers: [DatePipe],
})
export class TimeLineComponent {
  status = input<string | undefined>();
  timelines = computed(() => {
    const current = this.status() as Status | undefined;
    const currentIndex = current ? STATUS_FLOW.indexOf(current) : -1;

    const steps = [
      { label: 'Drafts', icon: 'draft-timeline-icon' },
      { label: 'HOD Review', icon: 'hod-review-icon' },
      { label: 'Dean Approval', icon: 'dean-approval-icon' },
      { label: 'Published', icon: 'published-timeline-icon' },
    ];

    return steps.map((step, index) => {
      const active = index <= currentIndex;

      return {
        status: step.label,
        time: active ? 'Completed' : 'Pending',
        activeIcon: `icons/general/active-${step.icon}.svg`,
        inactiveIcon: `icons/general/inactive-${step.icon}.svg`,
        active,
      };
    });
  });
}
