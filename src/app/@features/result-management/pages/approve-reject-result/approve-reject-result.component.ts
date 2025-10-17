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
    category: new FormControl('regular'),
  });

  students = signal<Record<string, any[]>>({
    REGULAR: [],
    REFERENCE: [],
    UNREGISTERED: [],
  });

  ngOnInit(): void {
    this.categoryListener();
    if (this.resultId) this.getResult();
  }

  getResultEntries() {
    console.log(
      'Getting result entries for segment:',
      this.activeSegment().value
    );

    // Check if data is already loaded from localStorage
    const currentStudents = this.students()[this.activeSegment().value];
    if (currentStudents && currentStudents.length > 0) {
      console.log('Data already loaded from localStorage, skipping API call');
      return;
    }

    this.resultsService
      .getResultEntries(this.resultId!, {
        category: this.activeSegment().value,
      })
      .subscribe({
        next: (resp) => {
          console.log('Result entries response:', resp);

          if (resp.status) {
            const { entries, studentsWithoutEntries, analytics } =
              resp.data as {
                entries: any[];
                studentsWithoutEntries: any[];
                analytics?: Record<string, number>;
              };

            console.log('Entries:', entries);
            console.log('Students without entries:', studentsWithoutEntries);

            // Process entries with actual data - preserve existing grades and scores
            const processedEntries = (entries || []).map((student) => {
              console.log('Processing student entry:', student);
              return {
                ...student,
                test:
                  student.test !== undefined && student.test !== null
                    ? student.test
                    : '-',
                lab:
                  student.lab !== undefined && student.lab !== null
                    ? student.lab
                    : '-',
                exam:
                  student.exam !== undefined && student.exam !== null
                    ? student.exam
                    : '-',
                total:
                  student.total !== undefined && student.total !== null
                    ? student.total
                    : '-',
                grade: student.grade || '-',
                status: student.status || '-',
              };
            });

            // Process students without entries
            const processedStudentsWithoutEntries = (
              studentsWithoutEntries || []
            ).map((student) => ({
              ...student,
              test: '-',
              lab: '-',
              exam: '-',
              total: '-',
              grade: '-',
              status: '-',
            }));

            const allStudents = [
              ...processedEntries,
              ...processedStudentsWithoutEntries,
            ];

            console.log('Final processed students:', allStudents);

            // Update only the current segment data
            this.students.update((current) => ({
              ...current,
              [this.activeSegment().value]: allStudents,
            }));

            // Update analytics if available
            if (analytics) {
              const analyticsData = [
                analytics['A'] || 0,
                analytics['B'] || 0,
                analytics['C'] || 0,
                analytics['D'] || 0,
                analytics['E'] || 0,
                analytics['F'] || 0,
              ];

              this.analyticsChartData.set(analyticsData);
              this.totalStudent.set(analytics['total'] || allStudents.length);
              this.totalStudentPass.set(analytics['totalPass'] || 0);
              this.totalStudentFail.set(analytics['totalFail'] || 0);
            }
          }
        },
        error: (error) => {
          console.error('Error fetching result entries:', error);
        },
      });
  }

  getResult() {
    // Try loading from localStorage first
    const localStorageKey = `result_management_${this.resultId}`;
    const localData = localStorage.getItem(localStorageKey);
    
    if (localData) {
      try {
        const resultData = JSON.parse(localData);
        console.log('Loading result from localStorage:', resultData);
        
        // Set course form data
        this.courseForm.patchValue({
          course: resultData.courseDetails.courseTitle,
          session: resultData.courseDetails.session,
          level: resultData.courseDetails.level,
        });
        
        // Set analytics data
        this.analyticsChartData.set(resultData.analytics.chartData || []);
        this.totalStudent.set(resultData.analytics.totalStudent || 0);
        this.totalStudentPass.set(resultData.analytics.totalStudentPass || 0);
        this.totalStudentFail.set(resultData.analytics.totalStudentFail || 0);
        
        // Load student data from localStorage
        this.students.set(resultData.segments || {
          REGULAR: [],
          REFERENCE: [],
          UNREGISTERED: [],
        });
        
        return;
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    }
    
    // Fallback to API if localStorage fails
    this.resultsService.getResult(this.resultId!).subscribe({
      next: (resp) => {
        if (resp.status) {
          const { analytics, course, session, level } = resp.data as {
            course: { courseTitle: string };
            session: string;
            level: string;
            analytics: Record<string, number>;
          };

          this.courseForm.patchValue({
            course: course.courseTitle,
            session: session,
            level: level,
          });

          const analyticsData = [
            analytics['A'] || 0,
            analytics['B'] || 0,
            analytics['C'] || 0,
            analytics['D'] || 0,
            analytics['E'] || 0,
            analytics['F'] || 0,
          ];

          this.analyticsChartData.set(analyticsData);
          this.totalStudent.set(analytics['total'] || 0);
          this.totalStudentPass.set(analytics['totalPass'] || 0);
          this.totalStudentFail.set(analytics['totalFail'] || 0);

          // Load entries for all segments
          this.getResultEntries();
        }
      },
    });
  }

  categoryListener() {
    this.courseForm.get('category')?.valueChanges.subscribe({
      next: (value) => {
        this.switchSegment(value as ISegmentSwitcher['value']);
      },
    });
  }

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
      case 'REGULAR': {
        this.getResultEntries();
        break;
      }
      case 'REFERENCE': {
        this.getResultEntries();
        break;
      }
      case 'UNREGISTERED': {
        this.getResultEntries();
        break;
      }
    }
  }

  reject() {}

  approve() {}
}
