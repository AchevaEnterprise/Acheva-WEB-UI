import { Component, input, output } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { SemesterEnum } from '../../../../@core/models/school.model';
import { EmptyStateComponent } from '../../../../@shared/components/empty-state/empty-state.component';
import { IStudentResult } from '../../models/student.model';
import { IStudentResultSemesterRecords } from '../../pages/student-result/student-result.component';

@Component({
  selector: 'app-result-preview',
  imports: [MatDivider, EmptyStateComponent],
  templateUrl: './result-preview.component.html',
  styleUrl: './result-preview.component.scss',
})
export class ResultPreviewComponent {
  studentResults = input<IStudentResultSemesterRecords | null>(null);
  semsterEvent = output<IStudentResult & { semester: SemesterEnum }>();

  currentSemester = SemesterEnum.FIRST;
  SemesterEnum = SemesterEnum;

  viewResult(result: IStudentResult, semester: SemesterEnum) {
    this.currentSemester = semester;
    this.semsterEvent.emit({ ...result, semester });
  }
}
