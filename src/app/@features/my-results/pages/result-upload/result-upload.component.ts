import {
  DestroyRef,
  Component,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, firstValueFrom, forkJoin } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';

import { RoleAccessDirective } from '../../../../@core/directives/role-access.directive';
import { CanComponentDeactivate } from '../../../../@core/guards/pending-changes.guard';
import { IImportResolutions } from '../../../result-management/models/import-preview.model';
import {
  IImportPreviewDialogData,
  IImportPreviewResult,
  ImportPreviewDialogComponent,
} from '../../../result-management/components/import-preview-dialog/import-preview-dialog.component';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { UploadResultDialogComponent } from '../../../../@shared/components/upload-result-dialog/upload-result-dialog.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AuthenticationService } from '../../../auth/service/auth.service';
import {
  ICreateResultEntry,
  IResult,
  SegmentValue,
} from '../../../result-management/models/results.model';
import { RegistrationService } from '../../../registration/services/registration.service';
import { ResultsService } from '../../../result-management/services/results.service';
import { ExportResultDialogComponent } from '../../../result-management/components/export-result-dialog/export-result-dialog.component';
import { isResultReadonlyForLecturer } from '../../../result-management/utils/workflow';
import { IStudentGrade } from '../../../students/models/student.model';
import { ResultSyncService } from '../../sync/result-sync.service';
import { AnalyticsChartComponent } from '../../components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../components/reference-table-result-upload/reference-table-result-upload.component';
import { RegularTableResultUploadComponent } from '../../components/regular-table-result-upload/regular-table-result-upload.component';
import { UnregisteredTableResultUploadComponent } from '../../components/unregistered-table-result-upload/unregistered-table-result-upload.component';

@Component({
  selector: 'app-result-upload',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    CardComponent,
    SegmentSwitcherComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    AnalyticsChartComponent,
    MatDividerModule,
    ButtonComponent,
    MatRadioModule,
    SearchInputComponent,
    MatDialogModule,
    RegularTableResultUploadComponent,
    ReferenceTableResultUploadComponent,
    RoleAccessDirective,
    BackButtonComponent,
    UnregisteredTableResultUploadComponent,
  ],
  templateUrl: './result-upload.component.html',
  styleUrl: './result-upload.component.scss',
})
export class ResultUploadComponent implements OnInit, CanComponentDeactivate {
  private readonly authService = inject(AuthenticationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly resultsService = inject(ResultsService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly sync = inject(ResultSyncService);
  private readonly registrationService = inject(RegistrationService);

  readonly resultId = this.route.snapshot.queryParamMap.get('resultId');
  readonly userRole = this.authService.activeAccount()?.role as RoleEnum;

  referenceTableResultUploadRef =
    viewChild<ReferenceTableResultUploadComponent>(
      'referenceTableResultUploadRef'
    );
  unregisteredTableResultUploadRef =
    viewChild<ReferenceTableResultUploadComponent>(
      'unregisteredTableResultUploadRef'
    );

  segments = signal<ISegmentSwitcher[]>([
    {
      label: 'Regular',
      value: 'REGULAR',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Reference',
      value: 'REFERENCE',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
    {
      label: 'Unregistered',
      value: 'UNREGISTERED',
      accessRole: [
        RoleEnum.DEAN,
        RoleEnum.HOD,
        RoleEnum.COURSE_ADVISOR,
        RoleEnum.COURSE_COORDINATOR,
        RoleEnum.LECTURER,
      ],
    },
  ]);

  activeSegment = signal<ISegmentSwitcher>(this.segments()[0]);

  analyticsChartData = signal<number[]>([0, 0, 0, 0, 0, 0]);
  totalStudent = signal<number>(0);
  totalStudentPass = signal<number>(0);
  totalStudentFail = signal<number>(0);

  /** Pass/fail rate — calculated on the backend, set from the entries response. */
  percentagePass = signal<number>(0);
  percentageFail = signal<number>(0);

  loadingResult = signal<boolean>(false);
  resultEntryCompleted = signal<boolean>(false);

  searchStudentValue = signal<string | null>(null);

  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  /** Drives which score columns the grade tables allow. */
  assessmentShape = signal<'THEORY' | 'PRACTICAL_ONLY'>('THEORY');

  courseForm = new FormGroup({
    course: new FormControl({ value: '', disabled: true }),
    session: new FormControl({ value: '', disabled: true }),
    level: new FormControl({ value: '', disabled: true }),
    category: new FormControl('REGULAR'),
  });

  RoleEnum = RoleEnum;
  publishing = signal(false);
  uploading = signal(false);
  isUploaded = signal(false);
  tableExpanded = signal<boolean>(false);
  hasChanges = signal<boolean>(false);

  /**
   * A lecturer may open a result that has been forwarded to the Course
   * Coordinator (the "second draft" — forwarded while still in DRAFT status),
   * but only to view it. In that case every editing control is disabled.
   * See `isResultReadonlyForLecturer` for the exact rule.
   */
  readOnly = signal<boolean>(false);
  /** Registration gating for the REGULAR table — null until roster known. */
  registeredRegNos = signal<string[] | null>(null);

  averageTotal = signal<number>(0);

  ngOnInit(): void {
    this.loadCourseRoster();
    this.categoryListener();
    this.getResultAndEntries();
  }

  getResultAndEntries() {
    this.loadingResult.set(true);

    const result$ = this.resultsService.getResult(this.resultId!);
    const resultEntries$ = this.resultsService.getResultEntries(
      this.resultId!,
      { category: this.activeSegment().value }
    );

    forkJoin([result$, resultEntries$])
      .pipe(finalize(() => this.loadingResult.set(false)))
      .subscribe({
        next: ([result, resultEntries]) => {
          if (result.status) this.setResultDetails(result.data);
          if (resultEntries.status)
            this.setResultEntriesDetails(resultEntries.data);
        },
      });
  }

  setResultDetails(result: IResult) {
    const { course, session, level, analytics } = result;
    this.assessmentShape.set(
      (course as { assessmentShape?: 'THEORY' | 'PRACTICAL_ONLY' })
        ?.assessmentShape ?? 'THEORY'
    );

    this.courseForm.patchValue({
      course: `${course?.courseCode} - ${course?.courseTitle}`,
      session: session,
      level: level,
    });

    this.averageTotal.set(analytics.averageTotal);

    // A lecturer can only edit a result that is still a draft in their custody
    // and hasn't been forwarded for review. Once sent to the Course Coordinator
    // it is read-only, even while it still reads as a DRAFT ("second draft").
    this.readOnly.set(
      this.userRole === RoleEnum.LECTURER && isResultReadonlyForLecturer(result)
    );
  }

  setResultEntriesDetails(resultEntries: unknown) {
    const {
      analytics,
      totalPass,
      totalFail,
      percentagePass,
      percentageFail,
      entries,
      studentsWithoutEntries,
    } = resultEntries as {
      analytics: Record<string, number>;
      total: number;
      totalPass: number;
      totalFail: number;
      percentagePass: number;
      percentageFail: number;
      entries: Partial<IStudentGrade>[];
      studentsWithoutEntries?: Partial<IStudentGrade>[];
    };

    const analyticsData = [
      analytics['A'] || 0,
      analytics['B'] || 0,
      analytics['C'] || 0,
      analytics['D'] || 0,
      analytics['E'] || 0,
      analytics['F'] || 0,
    ];

    const studentResultEntries = [
      ...entries,
      ...(studentsWithoutEntries ?? []),
    ];

    if (studentsWithoutEntries && studentsWithoutEntries.length < 1)
      this.resultEntryCompleted.set(true);

    this.analyticsChartData.set(analyticsData);
    this.totalStudent.set(studentResultEntries.length);
    this.totalStudentPass.set(totalPass || 0);
    this.totalStudentFail.set(totalFail || 0);
    this.percentagePass.set(percentagePass || 0);
    this.percentageFail.set(percentageFail || 0);

    // Set student's result entries
    const activeCategory = this.activeSegment().value as SegmentValue;
    this.students.update((students) => {
      students[activeCategory] = studentResultEntries;
      return students;
    });
  }

  categoryListener() {
    this.courseForm.get('category')?.valueChanges.subscribe({
      next: (value) => {
        const selectedSegment: ISegmentSwitcher = this.segments()?.find(
          (segment: ISegmentSwitcher) => segment.value === value
        )!;
        this.activeSegment.set(selectedSegment);
      },
    });
  }

  switchSegment(value: ISegmentSwitcher['value']): void {
    // Switching tabs never loses data — every edit is already saved locally and
    // the sync engine keeps draining in the background regardless of tab.
    const selectedSegment: ISegmentSwitcher = this.segments()?.find(
      (segment: ISegmentSwitcher) => segment.value === value
    )!;
    this.activeSegment.set(selectedSegment);
    this.getResultAndEntries();
  }

  saveChanges() {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '600px',
      data: {
        message:
          'Are you sure you want to save these changes?  if you save these changes, You can now send to the course coordinator.',
        subTitle: 'Kindly confirm this action',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) this.router.navigate(['/result-management']);
    });
  }

  uploadBulkResult(results: IStudentGrade[]) {
    let resultEntries: ICreateResultEntry[] = [];

    for (const result of results)
      resultEntries.push({ ...result, result: this.resultId! });

    this.resultsService.createBulkResultEntries(resultEntries).subscribe({
      next: (resp) => {
        if (!resp.status) {
          this.toast.showNotification('error', 'Upload Error', resp.message);
          return;
        }

        this.getResultAndEntries();
        this.toast.showNotification(
          'success',
          'Result Saved ✅',
          'Result has been saved successfully'
        );
      },
    });
  }

  uploadResult(result: Partial<IStudentGrade>) {
    const { registrationNumber, fullName, test, lab, exam, total } = result;
    const resultEntry: ICreateResultEntry = {
      registrationNumber: registrationNumber!,
      fullName: fullName!,
      test: test!,
      lab: lab!,
      exam: exam!,
      total: total!,
      result: this.resultId!,
      category: this.activeSegment().value,
    };

    this.resultsService.createResultEntry(resultEntry).subscribe({
      next: (resp) => {
        if (!resp.status) {
          this.toast.showNotification('error', 'Upload Error', resp.message);
          return;
        }

        this.getResultAndEntries();
      },
    });
  }

  /**
   * Opens the official grade report for this result: a preview of the exact
   * file, with PDF and Excel downloads beneath it.
   *
   * Acheva cannot drive a printer, so printing means downloading — the sheet
   * is rendered to match FUTO's Official Grade Report so what comes out of the
   * printer is the form the department already knows.
   */
  exportResult(): void {
    if (!this.resultId) return;

    this.dialog.open(ExportResultDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      height: '90vh',
      data: { resultId: this.resultId },
      panelClass: 'export-result-panel',
    });
  }

  confirmPublish() {
    this.dialog
      .open(ConfirmationComponent, {
        width: '600px',
        data: {
          message: 'Are you sure you want to publish this result?',
          subTitle: 'Kindly confirm this action',
        },
      })
      .afterClosed()
      .subscribe({
        next: (confirm: boolean) => {
          if (confirm) this.publishResult();
        },
      });
  }

  publishResult() {
    this.resultsService
      .publishResult(this.resultId!)
      .pipe(finalize(() => this.publishing.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.toast.showNotification(
              'success',
              'Result Published',
              'Result has been published successfully'
            );
            this.isUploaded.set(false);
            this.getResultAndEntries();
          }
        },
      });
  }

  uploadResultDocument() {
    this.pickFileThenCheck();
  }

  importResultDocument() {
    this.pickFileThenCheck();
  }

  /**
   * Pick a file, show the lecturer what it will do, then import.
   *
   * The check is a server dry-run, not a guess made here: the browser cannot
   * see the class list or the student records, so only the backend can say
   * whether a number belongs to this cohort, another year, or nobody.
   *
   * This replaces a second, client-side parse of the same file. Two parsers
   * meant two readings of one spreadsheet, and the table could end up showing
   * something the server had not recorded.
   */
  private pickFileThenCheck(): void {
    this.dialog
      .open<UploadResultDialogComponent, unknown, File | undefined>(
        UploadResultDialogComponent,
        { width: '600px' }
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (file) => {
          if (file) this.checkThenImport(file);
        },
      });
  }

  private checkThenImport(file: File): void {
    this.uploading.set(true);

    this.resultsService
      .previewResultImport(this.resultId!, file)
      .pipe(
        finalize(() => this.uploading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resp) => {
          const preview = resp.data;

          // Nothing to look at — no clashes, no refusals, every name agreeing.
          // Stopping to confirm an unremarkable file would just train the
          // lecturer to dismiss the dialog without reading it.
          const needsAnEye =
            preview.needsConfirmation > 0 ||
            preview.problems > 0 ||
            preview.reference > 0 ||
            preview.unregistered > 0;

          if (!needsAnEye) {
            this.importResult(file);
            return;
          }

          this.dialog
            .open<
              ImportPreviewDialogComponent,
              IImportPreviewDialogData,
              IImportPreviewResult
            >(ImportPreviewDialogComponent, {
              width: 'min(960px, 92vw)',
              maxHeight: '88vh',
              autoFocus: false,
              data: { preview, fileName: file.name },
            })
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (outcome) => {
                if (outcome?.proceed)
                  this.importResult(file, outcome.resolutions);
              },
            });
        },
      });
  }

  /**
   * Send the file and then re-read what the server actually recorded.
   *
   * It used to paint the table from a SECOND, client-side parse of the same
   * spreadsheet. That could disagree with what the backend stored — the server
   * recomputes every total and grade, resolves each name against the class
   * list, and files rows as reference or unregistered — so the lecturer could
   * be looking at numbers that were never saved. Re-fetching is one round trip
   * and removes the whole class of disagreement.
   */
  importResult(file: File, resolutions?: IImportResolutions) {
    this.uploading.set(true);

    this.resultsService
      .uploadResultFile(this.resultId!, file, resolutions)
      .pipe(
        finalize(() => this.uploading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resp) => {
          if (resp.status) {
            this.isUploaded.set(true);
            this.getResultAndEntries();

            this.toast.showNotification(
              'success',
              'Upload Successful',
              'Result document has been uploaded successfully'
            );
          }
        },
      });
  }

  /**
   * Replacing an uploaded document goes through the same check.
   *
   * A replacement carries exactly the risks a first upload does — a mistyped
   * number, a student of another department, one number twice — so exempting
   * it would leave the hazard open on the path most likely to be taken in a
   * hurry, after something was already found to be wrong.
   */
  replaceResultDocument() {
    this.pickFileThenCheck();
  }

  toggleTableView() {
    this.tableExpanded.set(!this.tableExpanded());
  }

  onStudentSearch(value: string) {
    this.searchStudentValue.set(value);
  }

  /**
   * Registration gating (Slice 4): disable + bottom-sort students who are
   * not registered for this course. No-op for cohorts without registration
   * data (legacy results behave exactly as before).
   */
  private loadCourseRoster(): void {
    if (!this.resultId) return;
    this.registrationService.courseRoster(this.resultId).subscribe({
      next: (resp) => {
        if (resp.data?.hasRegistrationData) {
          this.registeredRegNos.set(resp.data.registeredRegNos ?? []);
        }
      },
      error: () => {
        // Gating is best-effort — entry keeps working without it.
      },
    });
  }

  /** Lecturer enabled an unregistered student's row — audit + notify the CA. */
  onRosterOverride(event: {
    registrationNumber: string;
    fullName: string;
  }): void {
    if (!this.resultId) return;
    this.registrationService
      .rosterOverride({
        resultId: this.resultId,
        studentName: `${event.fullName} (${event.registrationNumber})`,
      })
      .subscribe({
        next: () =>
          this.toast.showNotification(
            'success',
            'Row enabled',
            `${event.fullName} can now be scored — your Course Advisor has been notified.`
          ),
        error: () => {
          /* best-effort */
        },
      });
  }

  updateChanges(hasChanges: boolean) {
    this.hasChanges.set(hasChanges);
  }

  /** With local-first, "unsaved" means rows not yet confirmed on the server. */
  private hasUnsyncedWork(): boolean {
    return this.sync.pendingCount() > 0 || this.sync.failedCount() > 0;
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.hasUnsyncedWork()) {
      return true;
    }

    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '600px',
      data: {
        message:
          'Some scores haven’t finished syncing. They’re saved on this device and will sync automatically later. Leave this page anyway?',
        subTitle: 'Kindly confirm this action',
      },
    });

    return firstValueFrom(dialogRef.afterClosed()).then(
      (confirmed) => confirmed === true
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    if (this.hasUnsyncedWork()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
