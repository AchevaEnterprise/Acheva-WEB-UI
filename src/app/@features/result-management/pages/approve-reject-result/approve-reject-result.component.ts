import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';

import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AnalyticsChartComponent } from '../../../my-results/components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../../my-results/components/reference-table-result-upload/reference-table-result-upload.component';
import { RegularTableResultUploadComponent } from '../../../my-results/components/regular-table-result-upload/regular-table-result-upload.component';

import { finalize, forkJoin } from 'rxjs';
import { IStudentGrade } from '../../../courses/models/student-grade.model';
import { IResult, SegmentValue } from '../../models/results.model';
import { ResultsService } from '../../services/results.service';

@Component({
  selector: 'app-approve-reject-result',
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
  ],
  templateUrl: './approve-reject-result.component.html',
  styleUrl: './approve-reject-result.component.scss',
})
export class ApproveRejectResultComponent implements OnInit {
  // private readonly utilityService = inject(UtilityService);
  private readonly resultsService = inject(ResultsService);

  private readonly route = inject(ActivatedRoute);

  private readonly resultId = this.route.snapshot.queryParamMap.get('resultId');

  regularTableResultUploadRef = viewChild<RegularTableResultUploadComponent>(
    'regularTableResultUploadRef'
  );
  referenceTableResultUploadRef =
    viewChild<ReferenceTableResultUploadComponent>(
      'referenceTableResultUploadRef'
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

  analyticsChartData = signal<number[]>([]);
  totalStudent = signal<number | null>(null);
  totalStudentPass = signal<number | null>(null);
  totalStudentFail = signal<number | null>(null);

  courseForm = new FormGroup({
    course: new FormControl({ value: '', disabled: true }),
    session: new FormControl({ value: '', disabled: true }),
    level: new FormControl({ value: '', disabled: true }),
    category: new FormControl('REGULAR'),
  });

  students = signal<Record<SegmentValue, Partial<IStudentGrade>[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  loadingResult = signal<boolean>(false);

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

  reject() {}

  approve() {}
}
