import { TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { QuillEditorComponent } from 'ngx-quill';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import {
  IModerationEligibility,
  IResultModeration,
  ModerationStatus,
} from '../../../moderation/models/moderation.model';
import { ModerationInboxBadgeService } from '../../../moderation/services/moderation-inbox-badge.service';
import { ModerationService } from '../../../moderation/services/moderation.service';
import { normalizeSessionGroups } from '../../../moderation/utils/session-results';
import { ResultsService } from '../../../result-management/services/results.service';
import { IStudent } from '../../models/student.model';
import { StudentService } from '../../services/student.service';

/** The scores of the failing attempt, shown as context beside the letter. */
interface IFailingEntryContext {
  session: string;
  level: string;
  semester?: string;
  courseCode: string;
  courseTitle: string;
  test: number;
  lab: number;
  exam: number;
  total: number;
  grade: string;
}

/**
 * `Validators.required` allows whitespace-only; and Quill's "empty" value is
 * markup like `<p><br></p>` — strip tags before judging emptiness.
 */
const letterBodyRequired: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const v: unknown = control.value;
  if (v == null || typeof v !== 'string') return { required: true };
  const text = v
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text.length === 0 ? { required: true } : null;
};

@Component({
  selector: 'app-create-moderation',
  imports: [
    TitleCasePipe,
    ReactiveFormsModule,
    ButtonComponent,
    SkeletonComponent,
    BackButtonComponent,
    QuillEditorComponent,
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
  /** Which action is in flight — so only the clicked button shows a spinner. */
  busyAction = signal<'draft' | 'submit' | null>(null);
  readonly saving = computed(() => this.busyAction() !== null);
  student = signal<IStudent | null>(null);
  failingEntry = signal<IFailingEntryContext | null>(null);
  eligibility = signal<IModerationEligibility | null>(null);

  /** Set when opened with ?moderationId= — the page edits that DRAFT. */
  draft = signal<IResultModeration | null>(null);

  readonly isEditingDraft = computed(() => this.draft() !== null);
  readonly blocked = computed(
    () => !this.isEditingDraft() && this.eligibility()?.canInitiate === false
  );

  letterBody = new FormControl<string>('', {
    nonNullable: true,
    validators: [letterBodyRequired, Validators.maxLength(20000)],
  });

  /** Quill toolbar — formal-letter essentials, nothing gimmicky. */
  readonly editorModules = {
    toolbar: [
      [{ header: [false, 2, 3] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['clean'],
    ],
  };

  ngOnInit(): void {
    this.load();
  }

  private get courseId(): string | null {
    return this.route.snapshot.paramMap.get('courseId');
  }

  private get regNo(): string | null {
    return this.route.snapshot.paramMap.get('regNo');
  }

  private load(): void {
    const schoolId = this.authService.activeAccount()?.school?._id;
    const moderationId = this.route.snapshot.queryParamMap.get('moderationId');

    if (!schoolId || !this.regNo || !this.courseId) {
      this.toastService.showNotification(
        'error',
        'Missing information',
        'Could not open moderation — go back and pick a course again.'
      );
      this.loading.set(false);
      return;
    }

    this.studentService.getStudentByRegNo(this.regNo, schoolId).subscribe({
      next: (stu) => {
        this.student.set(stu.data);
        this.loadFailingEntry(stu.data._id);
        if (moderationId) this.loadDraft(moderationId);
        else this.loadEligibility(stu.data._id);
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

  /** The published failing attempt for this course — context for the letter. */
  private loadFailingEntry(studentId: string): void {
    this.resultsService.getStudentResultsBySessions(studentId).subscribe({
      next: (resp) => {
        for (const group of normalizeSessionGroups(resp.data)) {
          for (const e of group.entries) {
            if (
              String(e['courseId']) === this.courseId &&
              String(e['status']).toLowerCase() === 'fail'
            ) {
              this.failingEntry.set({
                session: group.session,
                level: group.level,
                courseCode: String(e['courseCode'] ?? ''),
                courseTitle: String(e['courseTitle'] ?? ''),
                test: Number(e['test'] ?? 0),
                lab: Number(e['lab'] ?? 0),
                exam: Number(e['exam'] ?? 0),
                total: Number(e['total'] ?? 0),
                grade: String(e['grade'] ?? ''),
              });
              return;
            }
          }
        }
      },
    });
  }

  private loadEligibility(studentId: string): void {
    if (!this.courseId) return;
    this.moderationService
      .eligibility(studentId, this.courseId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.eligibility.set(resp.data),
        error: () => this.eligibility.set(null),
      });
  }

  private loadDraft(moderationId: string): void {
    this.moderationService
      .findOne(moderationId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          // Only true DRAFTs are editable — a submitted/closed moderation
          // routes back to its read-only detail page.
          if (resp.data.status !== ModerationStatus.DRAFT) {
            this.toastService.showNotification(
              'warning',
              'No longer a draft',
              'This request has already been submitted and can no longer be edited.'
            );
            void this.router.navigate(['/moderation', moderationId]);
            return;
          }
          this.draft.set(resp.data);
          this.letterBody.setValue(resp.data.letterBody ?? '');
        },
        error: () => {
          this.toastService.showNotification(
            'error',
            'Not found',
            'Could not load the draft moderation.'
          );
        },
      });
  }

  saveDraft(): void {
    this.persist(false);
  }

  submitRequest(): void {
    this.persist(true);
  }

  private persist(submitImmediately: boolean): void {
    const s = this.student();
    if (!s || !this.courseId) return;

    this.letterBody.markAsTouched();
    this.letterBody.updateValueAndValidity();
    if (this.letterBody.invalid) {
      this.toastService.showNotification(
        'warning',
        'Letter required',
        'Please write the justification letter before continuing.'
      );
      return;
    }

    const letter = this.letterBody.value;
    this.busyAction.set(submitImmediately ? 'submit' : 'draft');

    const existingDraft = this.draft();
    if (existingDraft) {
      // Editing an existing draft: save the letter, then optionally submit.
      this.moderationService
        .updateDraft(existingDraft._id, { letterBody: letter })
        .subscribe({
          next: () => {
            if (!submitImmediately) {
              this.busyAction.set(null);
              this.afterPersist(false, existingDraft._id);
              return;
            }
            this.moderationService
              .submit(existingDraft._id)
              .pipe(finalize(() => this.busyAction.set(null)))
              .subscribe({
                next: () => this.afterPersist(true, existingDraft._id),
                error: (err) => this.persistError(err),
              });
          },
          error: (err) => {
            this.busyAction.set(null);
            this.persistError(err);
          },
        });
      return;
    }

    this.moderationService
      .create({
        student: s._id,
        course: this.courseId,
        letterBody: letter,
        submitImmediately,
      })
      .pipe(finalize(() => this.busyAction.set(null)))
      .subscribe({
        next: (resp) => {
          if (resp.status) this.afterPersist(submitImmediately, resp.data._id);
        },
        error: (err) => this.persistError(err),
      });
  }

  private afterPersist(submitted: boolean, moderationId: string): void {
    this.moderationInboxBadge.refresh();
    this.toastService.showNotification(
      'success',
      submitted ? 'Submitted' : 'Draft saved',
      submitted
        ? 'The moderation request has been sent to your HOD.'
        : 'Draft saved. You can continue editing it until you submit.'
    );
    void this.router.navigate(['/moderation', moderationId]);
  }

  private persistError(err: unknown): void {
    const message =
      (err as { error?: { message?: string } })?.error?.message ??
      'Unable to save the moderation. Check the details and try again.';
    this.toastService.showNotification('error', 'Request failed', message);
  }

  openExisting(): void {
    const existing = this.eligibility()?.existing;
    if (existing) void this.router.navigate(['/moderation', existing.id]);
  }

  cancel(): void {
    if (this.regNo) {
      void this.router.navigate(['/students', this.regNo, 'carryovers']);
    } else {
      void this.router.navigate(['/moderation']);
    }
  }
}
