import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import {
  LevelsEnum,
  SemesterEnum,
} from '../../../../@core/models/school.model';
import { BackButtonComponent } from '../../../../@shared/components/back-button/back-button.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ResultsService } from '../../../result-management/services/results.service';
import {
  IResultSessions,
  ResultListComponent,
} from '../../components/result-list/result-list.component';
import { ResultPreviewComponent } from '../../components/result-preview/result-preview.component';
import { ResultViewComponent } from '../../components/result-view/result-view.component';
import {
  IStudent,
  IStudentResult,
  StudentResultType,
} from '../../models/student.model';
import { StudentService } from '../../services/student.service';

export interface IStudentResultSemesterRecords {
  firstSemsterResult: IStudentResult | null;
  secondSemesterResult: IStudentResult | null;
}

@Component({
  selector: 'app-student-result',
  imports: [
    ResultListComponent,
    ResultViewComponent,
    ResultPreviewComponent,
    BackButtonComponent,
    LoaderComponent,
  ],
  templateUrl: './student-result.component.html',
  styleUrl: './student-result.component.scss',
})
export class StudentResultComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly studentService = inject(StudentService);
  private readonly resultService = inject(ResultsService);
  private readonly route = inject(ActivatedRoute);

  GPA = signal<number>(0);
  preview = signal<StudentResultType[]>([]);
  semester = signal<SemesterEnum>(SemesterEnum.FIRST);
  student = signal<IStudent | null>(null);

  results = signal<IStudentResultSemesterRecords>({
    firstSemsterResult: null,
    secondSemesterResult: null,
  });

  loading = signal(false);

  filter = signal({
    session: '',
    level: LevelsEnum.YEAR_ONE,
  });

  ngOnInit(): void {
    this.getStudent();
  }

  getStudent() {
    const schoolId = this.authService.activeAccount()!.school?._id!;
    const regNo = this.route.snapshot.paramMap.get('regNo')!;

    this.studentService.getStudentByRegNo(regNo, schoolId).subscribe({
      next: (resp) => {
        this.student.set(resp.data);
      },
    });
  }

  getResult() {
    this.loading.set(true);
    const { session, level } = this.filter();
    const { _id } = this.student()!;

    const semesterResults = [
      this.resultService.getStudentResult(
        _id,
        level,
        session,
        SemesterEnum.FIRST
      ),
      this.resultService.getStudentResult(
        _id,
        level,
        session,
        SemesterEnum.SECOND
      ),
    ];

    forkJoin(semesterResults)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ([firstSemesterResult, secondSemesterResult]) => {
          const { gpa, results } = firstSemesterResult.data;
          this.GPA.set(gpa);
          this.preview.set(results);

          this.results.update((results) => {
            results.firstSemsterResult = firstSemesterResult.data;
            results.secondSemesterResult = secondSemesterResult.data;

            return results;
          });
        },
      });
  }

  viewResult(sessionData: IResultSessions) {
    const { session, level } = sessionData;
    this.filter.update((filter) => {
      filter.session = session;
      filter.level = level;

      return filter;
    });

    this.getResult();
  }

  getSemesterResult(
    studentResult: IStudentResult & { semester: SemesterEnum }
  ) {
    const { gpa, results, semester } = studentResult;
    this.GPA.set(gpa);
    this.semester.set(semester);
    this.preview.set(results);
  }
}
