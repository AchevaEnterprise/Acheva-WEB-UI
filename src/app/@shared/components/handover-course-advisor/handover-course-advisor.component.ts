import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { ILecturer } from '../../../@features/user-settings/models/lecturer.model';
import { ToastService } from '../../../@core/utility/toast.service';
import { IHandoverPreview } from '../../../@features/user-settings/models/course-advisor-handover.model';
import { LecturersService } from '../../../@features/user-settings/service/lecturer.service';
import { ButtonComponent } from '../forms/button/button.component';

/**
 * Hand a cohort to another Course Advisor.
 *
 * ## It shows what will move before it moves anything
 *
 * A handover redirects results waiting to be published, moderations
 * awaiting their return leg, and the threads this cohort's students write
 * into. That is other people's work, and its size should not be something
 * the Head discovers in a success toast afterwards — so the confirm button
 * stays disabled until the server has said what it would do.
 *
 * ## It is explicit about what does NOT move
 *
 * The outgoing advisor's approvals stay theirs. People reasonably assume a
 * reassignment rewrites everything, and would otherwise be surprised later
 * to find the old name still on the record — so the dialog says so rather
 * than letting them find out.
 */
@Component({
  selector: 'app-handover-course-advisor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    ButtonComponent,
  ],
  templateUrl: './handover-course-advisor.component.html',
  styleUrl: './handover-course-advisor.component.scss',
})
export class HandoverCourseAdvisorComponent implements OnInit {
  private readonly lecturerService = inject(LecturersService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<HandoverCourseAdvisorComponent>
  );

  readonly data = inject<{
    lecturer: string;
    lecturerId: string;
    level: string;
    departmentId: string;
  }>(MAT_DIALOG_DATA);

  readonly toCtrl = new FormControl<string>('');

  readonly candidates = signal<ILecturer[]>([]);
  readonly preview = signal<IHandoverPreview | null>(null);
  readonly loadingCandidates = signal(true);
  readonly checking = signal(false);
  readonly handingOver = signal(false);

  /** Nothing is confirmable until the server has said what would move. */
  readonly canConfirm = computed(
    () => this.preview() !== null && !this.handingOver() && !this.checking()
  );

  readonly nothingToMove = computed(() => {
    const moved = this.preview()?.moved;
    if (!moved) return false;
    return (
      moved.resultsInFlight +
        moved.publishedResultLinks +
        moved.moderations +
        moved.conversations ===
      0
    );
  });

  ngOnInit(): void {
    this.lecturerService
      .getLecturersInDepartment(this.data.departmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          /**
           * Only people who could actually receive it.
           *
           * The outgoing advisor is excluded (the server refuses it), and
           * so is anyone already advising a different level — an advisor
           * holds one cohort, and handing them a second would leave their
           * first unadvised. Offering a name the server will reject
           * teaches people the app is unreliable.
           */
          const eligible = (resp.data ?? []).filter(
            (lecturer) =>
              String(lecturer._id) !== String(this.data.lecturerId) &&
              lecturer.isActive !== false &&
              (!lecturer.assignedLevel ||
                lecturer.assignedLevel === 'NONE' ||
                String(lecturer.assignedLevel) === String(this.data.level))
          );
          this.candidates.set(eligible);
          this.loadingCandidates.set(false);
        },
        error: () => {
          this.loadingCandidates.set(false);
          this.toast.showNotification(
            'error',
            'Could not load staff',
            'Please close this and try again.'
          );
        },
      });

    this.toCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((to) => {
        this.preview.set(null);
        if (to) this.check(to);
      });
  }

  private check(to: string): void {
    this.checking.set(true);
    this.lecturerService
      .previewCourseAdvisorHandover(this.data.lecturerId, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.preview.set(resp.data);
          this.checking.set(false);
        },
        error: (err) => {
          this.checking.set(false);
          this.toast.showNotification(
            'error',
            'Cannot hand over to that lecturer',
            err?.error?.message ?? 'Please choose someone else.'
          );
        },
      });
  }

  confirm(): void {
    const to = this.toCtrl.value;
    if (!to || !this.canConfirm()) return;

    this.handingOver.set(true);
    this.lecturerService
      .handOverCourseAdvisor(this.data.lecturerId, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.handingOver.set(false);
          this.toast.showNotification(
            'success',
            'Cohort handed over',
            `${resp.data.to.name} now advises level ${resp.data.level}.`
          );
          this.dialogRef.close(resp.data);
        },
        error: (err) => {
          this.handingOver.set(false);
          this.toast.showNotification(
            'error',
            'Handover failed',
            err?.error?.message ?? 'Nothing was changed. Please try again.'
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  nameOf(lecturer: ILecturer): string {
    const named = [lecturer.firstname, lecturer.lastname]
      .filter(Boolean)
      .join(' ')
      .trim();
    // Advisors are often created against an office and carry no personal
    // name; the email is then the only thing that identifies them.
    return named || lecturer.email;
  }
}
