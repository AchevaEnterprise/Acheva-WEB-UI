import { Component, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { CardComponent } from '../../../../@shared/components/card/card.component';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SearchInputComponent } from '../../../../@shared/components/forms/search-input/search-input.component';
import {
  ISegmentSwitcher,
  SegmentSwitcherComponent,
} from '../../../../@shared/components/segment-switcher/segment-switcher.component';
import { RoleEnum } from '../../../auth/model/auth.model';
import { AnalyticsChartComponent } from '../../../courses/components/analytics-chart/analytics-chart.component';
import { ReferenceTableResultUploadComponent } from '../../../my-results/components/reference-table-result-upload/reference-table-result-upload.component';
import { RegularTableResultUploadComponent } from '../../../my-results/components/regular-table-result-upload/regular-table-result-upload.component';

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
export class ApproveRejectResultComponent {
  // private readonly utilityService = inject(UtilityService);
  // private readonly resultsService = inject(ResultsService);
  // private readonly router = inject(Router);

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
    category: new FormControl(''),
  });

  switchSegment(switchValue: ISegmentSwitcher['value']) {
    this.activeSegment.update(
      () =>
        this.segments().find(
          (segment: ISegmentSwitcher) => segment.value === switchValue
        )!
    );

    switch (switchValue) {
      case 'regular': {
        break;
      }
      case 'reference': {
        break;
      }
    }
  }

  reject() {}

  approve() {}
}
