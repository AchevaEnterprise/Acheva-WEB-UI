import { CommonModule, UpperCasePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import {
  IDepartment,
  IFaculty,
  ISchool,
  SemesterEnum,
} from '../../../../@core/models/school.model';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { IStudent, StudentResultType } from '../../models/student.model';

interface ResultViewData {
  fullName: string;
  school: string;
  department: string;
  faculty: string;
  registrationNumber: string;
}

@Component({
  selector: 'app-result-view',
  imports: [
    StatusBadgeComponent,
    EmptyStateComponent,
    UpperCasePipe,
    CommonModule,
    SkeletonTableComponent,
  ],
  templateUrl: './result-view.component.html',
  styleUrl: './result-view.component.scss',
})
export class ResultViewComponent {
  student = input<IStudent | null>();
  results = input<StudentResultType[]>([]);
  gpa = input<number>();
  semester = input<SemesterEnum>();
  loading = input<boolean>();

  resultData = computed<ResultViewData>(() => {
    this.results();

    const { fullName, school, faculty, department, registrationNumber } =
      this.student()!;

    return {
      fullName: fullName ?? '',
      department: (department as IDepartment).name ?? '',
      faculty: (faculty as IFaculty)?.name ?? '',
      registrationNumber: registrationNumber ?? '',
      school: (school as ISchool)?.name ?? '',
    };
  });
}
