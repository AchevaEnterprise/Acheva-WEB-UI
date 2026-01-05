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
interface WorkflowStep {
  key: string;
  label: string;
  icon: string;
  completedWhen: readonly Status[];
}

const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    key: 'DRAFTS',
    label: 'Drafts',
    icon: 'draft-timeline-icon',
    completedWhen: [
      'DRAFT',
      'PENDING',
      'UNVERIFIED',
      'VERIFIED',
      'PUBLISHED',
      'IMPORTED',
    ],
  },
  {
    key: 'HOD_REVIEW',
    label: 'HOD Review',
    icon: 'hod-review-icon',
    completedWhen: ['UNVERIFIED', 'VERIFIED', 'PUBLISHED', 'IMPORTED'],
  },
  {
    key: 'DEAN_APPROVAL',
    label: 'Dean Approval',
    icon: 'dean-approval-icon',
    completedWhen: ['VERIFIED', 'PUBLISHED', 'IMPORTED'],
  },
  {
    key: 'PUBLISHED',
    label: 'Published',
    icon: 'published-timeline-icon',
    completedWhen: ['PUBLISHED', 'IMPORTED'],
  },
] as const;

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
    const currentStatus = this.status() as Status | undefined;

    return WORKFLOW_STEPS.map((step) => {
      const completed = currentStatus
        ? step.completedWhen.includes(currentStatus)
        : false;

      return {
        status: step.label,
        time: completed ? 'Completed' : 'Pending',
        activeIcon: `icons/general/active-${step.icon}.svg`,
        inactiveIcon: `icons/general/inactive-${step.icon}.svg`,
        active: completed,
      };
    });
  });
}
