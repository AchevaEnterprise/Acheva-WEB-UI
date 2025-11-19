import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
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
import { finalize, forkJoin } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';

import { ConfirmationComponent } from '../../../../@shared/components/confirmation/confirmation.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import {
  ICreateResultEntry,
  IResult,
  SegmentValue,
} from '../../../result-management/models/results.model';
import { ResultsService } from '../../../result-management/services/results.service';
import { AnalyticsChartComponent } from '../../components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../components/reference-table-result-upload/reference-table-result-upload.component';
import { RegularTableResultUploadComponent } from '../../components/regular-table-result-upload/regular-table-result-upload.component';

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
    LoaderComponent,
  ],
  templateUrl: './result-upload.component.html',
  styleUrl: './result-upload.component.scss',
})
export class ResultUploadComponent implements OnInit {
  private readonly resultsService = inject(ResultsService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly resultId = this.route.snapshot.queryParamMap.get('resultId');

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

  loadingResult = signal<boolean>(false);
  uploadingResult = signal<boolean>(false);
  resultEntryCompleted = signal<boolean>(false);

  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  courseForm = new FormGroup({
    course: new FormControl({ value: '', disabled: true }),
    session: new FormControl({ value: '', disabled: true }),
    level: new FormControl({ value: '', disabled: true }),
    category: new FormControl('REGULAR'),
  });

  ngOnInit(): void {
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
    const { course, session, level } = result;

    this.courseForm.patchValue({
      course: `${course?.courseCode} - ${course?.courseTitle}`,
      session: session,
      level: level,
    });
  }

  setResultEntriesDetails(resultEntries: unknown) {
    const { analytics, totalPass, totalFail, entries, studentsWithoutEntries } =
      resultEntries as {
        analytics: Record<string, number>;
        total: number;
        totalPass: number;
        totalFail: number;
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

  uploadResult(result: Partial<IStudentGrade>) {
    this.uploadingResult.set(true);

    const { registrationNumber, fullName, test, lab, exam, total } = result!;
    const resultEntry: ICreateResultEntry = {
      registrationNumber: registrationNumber!,
      fullName: fullName!,
      test: test!,
      lab: lab!,
      exam: exam!,
      total: total!,
      result: this.resultId!,
    };

    this.resultsService
      .createResultEntry(resultEntry)
      .pipe(finalize(() => this.uploadingResult.set(false)))
      .subscribe({
        next: (resp) => {
          if (!resp.status) {
            this.toast.showNotification('error', 'Upload Error', resp.message);
            return;
          }

          this.getResultAndEntries();
        },
      });
  }

  uploadResultDocument() {}

  onStudentSearch(value: string) {}
}
