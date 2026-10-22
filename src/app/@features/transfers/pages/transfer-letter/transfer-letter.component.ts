import { TitleCasePipe } from '@angular/common';
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

import { IDepartment, IFaculty } from '../../../../@core/models/school.model';
import { SchoolsService } from '../../../../@core/services/schools.service';
import { ToastService } from '../../../../@core/utility/toast.service';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { IStudent } from '../../../students/models/student.model';
import { StudentService } from '../../../students/services/student.service';
import {
  IDepartmentTransfer,
  ITransferEligibility,
} from '../../models/transfer.model';
import { TransfersService } from '../../services/transfers.service';

/**
 * Quill reports an empty editor as `<p><br></p>`, which `Validators.required`
 * reads as present. Strip the markup and judge the text.
 */
const letterBodyRequired: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  // Typed explicitly: `AbstractControl.value` is `any`, and letting that
  // flow into the string methods below is an unsafe assignment the linter
  // rightly refuses.
  const raw: string = typeof control.value === 'string' ? control.value : '';
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text.length < 20 ? { tooShort: true } : null;
};

/**
 * The Course Advisor's letter to the receiving Head.
 *
 * ## The receiving department is picked faculty-first
 *
 * Two steps rather than one long list, because that is the hierarchy the
 * university actually has (school → faculty → department) and because the
 * API lists departments per faculty. "School of Engineering, then Mechanical
 * Engineering" is also how a person would say it.
 *
 * ## The student's record is not assembled here
 *
 * The letter carries their CGPA, courses and history, but the server builds
 * that snapshot — this page never sends it. A client that could state the
 * CGPA could write the letter the Head wants to read.
 */
@Component({
  selector: 'app-transfer-letter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe,
    ReactiveFormsModule,
    QuillEditorComponent,
    ButtonComponent,
    BackButtonComponent,
    SkeletonComponent,
  ],
  templateUrl: './transfer-letter.component.html',
  styleUrl: './transfer-letter.component.scss',
})
export class TransferLetterComponent implements OnInit {
  private readonly transfersService = inject(TransfersService);
  private readonly studentService = inject(StudentService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly authService = inject(AuthenticationService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly busyAction = signal<'draft' | 'submit' | null>(null);
  readonly saving = computed(() => this.busyAction() !== null);

  readonly students = signal<IStudent[]>([]);
  readonly faculties = signal<IFaculty[]>([]);
  readonly departments = signal<IDepartment[]>([]);
  readonly loadingDepartments = signal(false);

  readonly selectedStudent = signal<IStudent | null>(null);
  readonly eligibility = signal<ITransferEligibility | null>(null);
  readonly checkingEligibility = signal(false);

  /** Set when the page is opened on an existing DRAFT. */
  readonly draft = signal<IDepartmentTransfer | null>(null);

  readonly facultyCtrl = new FormControl<string>('', { nonNullable: true });
  readonly departmentCtrl = new FormControl<string>('', { nonNullable: true });
  readonly levelCtrl = new FormControl<string>('', { nonNullable: true });
  readonly semesterCtrl = new FormControl<string>('1ST SEMESTER', {
    nonNullable: true,
  });
  readonly letterBody = new FormControl<string>('', {
    nonNullable: true,
    validators: [letterBodyRequired, Validators.maxLength(20000)],
  });

  readonly levels = ['100', '200', '300', '400', '500', '600'];
  readonly semesters = ['1ST SEMESTER', '2ND SEMESTER', '3RD SEMESTER'];

  readonly editorModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  };

  /** The advisor's own department — what the student is leaving. */
  private readonly myDepartment = computed(
    () => this.authService.activeAccount()?.department?._id ?? ''
  );

  readonly myDepartmentName = computed(
    () =>
      this.authService.activeAccount()?.department?.name ?? 'your department'
  );

  /**
   * Mirrors of the three controls `canSend` depends on.
   *
   * A `computed()` only re-evaluates when a SIGNAL it read changes, and a
   * `FormControl` is not a signal — reading `letterBody.valid` inside the
   * computed meant the send button latched to whatever the form looked like
   * the last time an unrelated signal moved, and typing the letter never
   * re-enabled it. Caught by `scripts/transfers-ui-harness.mjs`, which filled
   * the form and found the button still disabled.
   */
  private readonly letterValid = signal(false);
  private readonly departmentPicked = signal('');
  private readonly levelPicked = signal('');

  readonly canSend = computed(
    () =>
      !this.saving() &&
      this.selectedStudent() !== null &&
      this.eligibility()?.eligible === true &&
      this.departmentPicked() !== '' &&
      this.levelPicked() !== '' &&
      this.letterValid()
  );

  ngOnInit(): void {
    // Keep the signal mirrors in step with the controls.
    this.letterBody.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.letterValid.set(this.letterBody.valid));
    this.departmentCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.departmentPicked.set(value ?? ''));
    this.levelCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.levelPicked.set(value ?? ''));

    const account = this.authService.activeAccount();
    const schoolId = account?.school?._id;

    // The advisor's own cohort, which is who they may transfer.
    this.studentService
      .getStudents({
        school: schoolId,
        department: this.myDepartment(),
        level: account?.assignedLevel ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.students.set(resp.data ?? []);
          this.loading.set(false);
          this.preselectFromQuery();
        },
        error: () => {
          this.loading.set(false);
          this.toastService.showNotification(
            'error',
            'Could not load your students',
            'Please reload the page.'
          );
        },
      });

    if (schoolId) {
      this.schoolsService
        .getFaculties(schoolId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (resp) => this.faculties.set(resp.data ?? []),
          error: () => undefined,
        });
    }
  }

  /** Opened from a student's page with `?student=`. */
  private preselectFromQuery(): void {
    const studentId = this.route.snapshot.queryParamMap.get('student');
    if (!studentId) return;
    const match = this.students().find((s) => s._id === studentId);
    if (match) this.pickStudent(match);
  }

  /** Resolve the `<select>` value back to the student it names. */
  pickStudentById(id: string): void {
    const match = this.students().find((student) => student._id === id);
    if (!match) {
      this.selectedStudent.set(null);
      this.eligibility.set(null);
      return;
    }
    this.pickStudent(match);
  }

  pickStudent(student: IStudent): void {
    this.selectedStudent.set(student);
    this.eligibility.set(null);
    this.checkingEligibility.set(true);

    this.transfersService
      .eligibility(student._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.checkingEligibility.set(false))
      )
      .subscribe({
        next: (resp) => this.eligibility.set(resp.data),
        error: (err) =>
          this.toastService.showNotification(
            'error',
            'Could not check this student',
            err?.error?.message ?? 'Please try again.'
          ),
      });
  }

  onFacultyChange(facultyId: string): void {
    this.facultyCtrl.setValue(facultyId);
    this.departmentCtrl.setValue('');
    this.departmentPicked.set('');
    this.departments.set([]);
    if (!facultyId) return;

    this.loadingDepartments.set(true);
    this.schoolsService
      .getDepartments(facultyId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingDepartments.set(false))
      )
      .subscribe({
        next: (resp) => {
          // The department they are already in is not a destination. Filtered
          // here as well as refused by the server, so it never appears as an
          // option that fails on tap.
          this.departments.set(
            (resp.data ?? []).filter((d) => d._id !== this.myDepartment())
          );
        },
        error: () =>
          this.toastService.showNotification(
            'error',
            'Could not load departments',
            'Please pick the faculty again.'
          ),
      });
  }

  private payload() {
    return {
      student: this.selectedStudent()!._id,
      toDepartment: this.departmentCtrl.value,
      toLevel: this.levelCtrl.value,
      toSemester: this.semesterCtrl.value,
      letterBody: this.letterBody.value,
    };
  }

  saveDraft(): void {
    if (!this.selectedStudent() || this.saving()) return;
    this.letterBody.markAsTouched();
    if (this.letterBody.invalid) return;

    this.busyAction.set('draft');
    const existing = this.draft();
    const request = existing
      ? this.transfersService.updateDraft(existing._id, {
          letterBody: this.letterBody.value,
          toLevel: this.levelCtrl.value,
          toSemester: this.semesterCtrl.value,
        })
      : this.transfersService.create(this.payload());

    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busyAction.set(null))
      )
      .subscribe({
        next: (resp) => {
          this.draft.set(resp.data);
          this.toastService.showNotification(
            'success',
            'Draft saved',
            'The receiving Head has not seen it yet.'
          );
        },
        error: (err) =>
          this.toastService.showNotification(
            'error',
            'Could not save the draft',
            err?.error?.message ?? 'Please try again.'
          ),
      });
  }

  send(): void {
    if (!this.canSend()) {
      this.letterBody.markAsTouched();
      return;
    }

    this.busyAction.set('submit');
    const existing = this.draft();
    const create$ = existing
      ? this.transfersService.updateDraft(existing._id, {
          letterBody: this.letterBody.value,
          toLevel: this.levelCtrl.value,
          toSemester: this.semesterCtrl.value,
        })
      : this.transfersService.create(this.payload());

    create$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.draft.set(resp.data);
        this.transfersService
          .submit(resp.data._id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.busyAction.set(null))
          )
          .subscribe({
            next: () => {
              this.toastService.showNotification(
                'success',
                'Sent to the receiving Head',
                'You will be notified when they decide.'
              );
              void this.router.navigate(['/transfers']);
            },
            error: (err) =>
              this.toastService.showNotification(
                'error',
                'Saved, but not sent',
                err?.error?.message ??
                  'The draft is safe — try sending it from the transfers list.'
              ),
          });
      },
      error: (err) => {
        this.busyAction.set(null);
        this.toastService.showNotification(
          'error',
          'Could not raise the request',
          err?.error?.message ?? 'Please try again.'
        );
      },
    });
  }

  cancel(): void {
    void this.router.navigate(['/transfers']);
  }
}
