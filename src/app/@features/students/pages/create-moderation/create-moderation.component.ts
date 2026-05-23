import { TitleCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ModerationInboxBadgeService } from '../../../moderation/services/moderation-inbox-badge.service';
import { ModerationService } from '../../../moderation/services/moderation.service';
import { IResult } from '../../../result-management/models/results.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { IStudent } from '../../models/student.model';
import { StudentService } from '../../services/student.service';

/** `Validators.required` allows whitespace-only; moderation letters must have real text. */
const letterBodyRequired: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const v: unknown = control.value;
  if (v == null) return { required: true };
  if (typeof v !== 'string') return { required: true };
  if (v.trim().length === 0) return { required: true };
  return null;
};

@Component({
  selector: 'app-create-moderation',
  imports: [
    TitleCasePipe,
    ReactiveFormsModule,
    ButtonComponent,
    LoaderComponent,
  ],
  templateUrl: './create-moderation.component.html',
  styleUrl: './create-moderation.component.scss',
})
export class CreateModerationComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly studentService = inject(StudentService);
  private readonly resultsService = inject(ResultsService);
  private readonly moderationService = inject(ModerationService);
  private readonly moderationInboxBadge = inject(ModerationInboxBadgeService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loading = signal(true);
  saving = signal(false);
  student = signal<IStudent | null>(null);
  result = signal<IResult | null>(null);

  letterBody = new FormControl<string>('', {
    nonNullable: true,
    validators: [letterBodyRequired, Validators.maxLength(8000)],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const schoolId = this.authService.activeAccount()?.school?._id;
    const regNo = this.route.snapshot.paramMap.get('regNo');
    const courseId = this.route.snapshot.paramMap.get('courseId');
    const resultId = this.route.snapshot.queryParamMap.get('resultId');

    if (!schoolId || !regNo || !courseId || !resultId) {
      this.toastService.showNotification(
        'error',
        'Missing information',
        'Could not open moderation — go back and pick a course again.'
      );
      this.loading.set(false);
      return;
    }

    this.studentService.getStudentByRegNo(regNo, schoolId).subscribe({
      next: (stu) => {
        this.student.set(stu.data);
        this.resultsService.getResult(resultId).subscribe({
          next: (res) => {
            const r = res.data;
            const resultCourseId =
              typeof r.course === 'object' && r.course !== null
                ? r.course._id
                : String(r.course);
            if (resultCourseId !== courseId) {
              this.toastService.showNotification(
                'error',
                'Mismatch',
                'This result does not match the selected course.'
              );
              this.loading.set(false);
              return;
            }
            this.result.set(r);
            this.loading.set(false);
          },
          error: () => {
            this.toastService.showNotification(
              'error',
              'Not found',
              'Could not load the result for moderation.'
            );
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.toastService.showNotification(
          'error',
          'Not found',
          'Could not load the student.'
        );
        this.loading.set(false);
      },
    });
  }

  private levelForApi(level: string): string {
    const s = String(level).trim().replace(/L$/i, '');
    return s;
  }

  saveDraft(): void {
    this.submit(false);
  }

  submitRequest(): void {
    this.submit(true);
  }

  private submit(submitImmediately: boolean): void {
    const s = this.student();
    const r = this.result();
    const courseId = this.route.snapshot.paramMap.get('courseId');
    if (!s || !r || !courseId) return;

    this.letterBody.markAsTouched();
    this.letterBody.updateValueAndValidity();
    if (this.letterBody.invalid) {
      this.toastService.showNotification(
        'warning',
        'Letter required',
        'Please enter a justification letter before continuing.'
      );
      return;
    }

    const letter = this.letterBody.value.trim();

    this.saving.set(true);
    this.moderationService
      .create({
        student: s._id,
        course: courseId,
        session: r.session,
        level: this.levelForApi(r.level),
        semester: r.semester,
        letterBody: letter,
        submitImmediately,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.moderationInboxBadge.refresh();
            this.toastService.showNotification(
              'success',
              submitImmediately ? 'Submitted' : 'Saved',
              submitImmediately
                ? 'Moderation request has been sent to your HOD.'
                : 'Draft saved. You can submit it from the moderation list later.'
            );
            const regNo = this.route.snapshot.paramMap.get('regNo');
            if (regNo) void this.router.navigate(['/students', regNo]);
          }
        },
        error: () => {
          this.toastService.showNotification(
            'error',
            'Request failed',
            'Unable to create moderation. Check the details and try again.'
          );
        },
      });
  }

  cancel(): void {
    const regNo = this.route.snapshot.paramMap.get('regNo');
    if (regNo) void this.router.navigate(['/students', regNo, 'carryovers']);
  }

  courseCode(): string {
    const c = this.result()?.course;
    return c?.courseCode ?? '';
  }

  courseTitle(): string {
    const c = this.result()?.course;
    return c?.courseTitle ?? '';
  }
}
