import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { SvgComponent } from '../../../../../@shared/components/svg/svg.component';
import { IResult, ResultStatusEnum } from '../../../models/results.model';
import {
  isInternalCohort,
  isStatusAtLeast,
} from '../../../utils/workflow';

interface ITimelineStep {
  label: string;
  activeIcon: string;
  inactiveIcon: string;
  /** The step is considered completed once the result reaches this status. */
  reachedAt: ResultStatusEnum;
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
  /**
   * The full result is preferred so we can branch on internal/external cohort.
   * The bare status is still accepted for call sites that do not have the
   * result yet (progress is still computed correctly; the COMPLETE step is
   * always shown in that case).
   */
  result = input<IResult | null>(null);
  status = input<ResultStatusEnum | undefined>();

  private readonly baseSteps: readonly ITimelineStep[] = [
    {
      label: 'Draft',
      activeIcon: 'icons/general/active-draft-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-draft-timeline-icon.svg',
      reachedAt: ResultStatusEnum.PENDING,
      completed: false,
    },
    {
      label: 'HOD Review',
      activeIcon: 'icons/general/active-hod-review-icon.svg',
      inactiveIcon: 'icons/general/inactive-hod-review-icon.svg',
      reachedAt: ResultStatusEnum.UNVERIFIED,
      completed: false,
    },
    {
      label: 'Dean Approval',
      activeIcon: 'icons/general/active-dean-approval-icon.svg',
      inactiveIcon: 'icons/general/inactive-dean-approval-icon.svg',
      reachedAt: ResultStatusEnum.VERIFIED,
      completed: false,
    },
    {
      label: 'HOD Final',
      activeIcon: 'icons/general/active-hod-review-icon.svg',
      inactiveIcon: 'icons/general/inactive-hod-review-icon.svg',
      reachedAt: ResultStatusEnum.APPROVED,
      completed: false,
    },
    {
      label: 'Cross-department HOD',
      activeIcon: 'icons/general/active-dean-approval-icon.svg',
      inactiveIcon: 'icons/general/inactive-dean-approval-icon.svg',
      reachedAt: ResultStatusEnum.COMPLETE,
      completed: false,
    },
    {
      label: 'Published',
      activeIcon: 'icons/general/active-published-timeline-icon.svg',
      inactiveIcon: 'icons/general/inactive-published-timeline-icon.svg',
      reachedAt: ResultStatusEnum.PUBLISHED,
      completed: false,
    },
  ];

  timelines = computed<ITimelineStep[]>(() => {
    const currentStatus = this.result()?.status ?? this.status();
    if (!currentStatus) {
      return this.baseSteps.map((step) => ({ ...step }));
    }

    // Hide the cross-department HOD hop for internal cohorts — that leg of
    // the workflow is skipped entirely when the course and the students
    // belong to the same department.
    const result = this.result();
    const showCrossDeptHop = result ? !isInternalCohort(result) : true;

    return this.baseSteps
      .filter(
        (step) =>
          step.reachedAt !== ResultStatusEnum.COMPLETE || showCrossDeptHop,
      )
      .map((step) => ({
        ...step,
        completed: isStatusAtLeast(currentStatus, step.reachedAt),
      }));
  });
}
