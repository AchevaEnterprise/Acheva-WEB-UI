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
import { ActivatedRoute } from '@angular/router';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { UploadResultDialogComponent } from '../../../../@shared/components/upload-result-dialog/upload-result-dialog.component';
import { AnalyticsChartComponent } from '../../../courses/components/analytics-chart/analytics-chart.component';
import { ResultsService } from '../../../result-management/services/results.service';
import { ReferenceTableResultUploadComponent } from '../../components/reference-table-result-upload/reference-table-result-upload.component';
import { RegularTableResultUploadComponent } from '../../components/regular-table-result-upload/regular-table-result-upload.component';
import { RoleEnum } from '../../../auth/model/auth.model';

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
  ],
  templateUrl: './result-upload.component.html',
  styleUrl: './result-upload.component.scss',
})
export class ResultUploadComponent implements OnInit {
  // private readonly utilityService = inject(UtilityService);
  private readonly resultsService = inject(ResultsService);
  private readonly dialog = inject(MatDialog);
  // private readonly router = inject(Router);
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
      value: 'regular',
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
      value: 'reference',
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
      value: 'unregistered',
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

  courseForm = new FormGroup({
    course: new FormControl(''),
    session: new FormControl(''),
    level: new FormControl(''),
    category: new FormControl('regular'),
  });

  ngOnInit(): void {
    this.categoryListener();
    if (this.resultId) this.getResult();
  }

  getResult() {
    this.resultsService.getResult(this.resultId!).subscribe({
      next: (resp) => {
        if (resp.status) {
          const { course, session, level } = resp.data as {
            course: { courseTitle: string };
            session: string;
            level: string;
          };

          this.courseForm.patchValue({
            course: course.courseTitle as string,
            session: session as string,
            level: level as string,
          });
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

    console.warn('Updated: active', this.activeSegment());

    switch (switchValue) {
      case 'regular': {
        this.courseForm.get('category')?.setValue('regular');
        break;
      }
      case 'reference': {
        this.courseForm.get('category')?.setValue('reference');
        break;
      }
      case 'unregistered': {
        this.courseForm.get('category')?.setValue('unregistered');
        break;
      }
    }
  }

  uploadResult() {
    this.dialog
      .open(UploadResultDialogComponent, {
        width: '600px',
      })
      .afterClosed()
      .subscribe({
        next: (file: File | null) => {
          if (file) {
            console.warn('Uploaded File: ', file);
          }
        },
      });
  }

  saveChanges() {
    console.warn(
      'Table Data: ',
      this.regularTableResultUploadRef()?.dataSource()
    );

    // this.resultsService.createResult();
    // this.router.navigate(['my-results']);
  }

  reject() {}

  approve() {}
}
