import { TitleCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LevelsEnum } from '../../../../@core/models/school.model';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ResultsService } from '../../../result-management/services/results.service';
import { IStudent, IStudentSessionsResult } from '../../models/student.model';
import { StudentService } from '../../services/student.service';

export interface ICarryoverRow {
  resultId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  /** Numeric level e.g. `"100"` (matches `LevelsEnum` values). */
  level: string;
  session: string;
  test: number;
  lab: number;
  exam: number;
  total: number;
  grade: string;
  status: string;
}

@Component({
  selector: 'app-student-carryovers',
  imports: [
    TitleCasePipe,
    ButtonComponent,
    LoaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './student-carryovers.component.html',
  styleUrl: './student-carryovers.component.scss',
})
export class StudentCarryoversComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly studentService = inject(StudentService);
  private readonly resultsService = inject(ResultsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loading = signal(true);
  student = signal<IStudent | null>(null);
  carryovers = signal<ICarryoverRow[]>([]);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const schoolId = this.authService.activeAccount()?.school?._id;
    const regNo = this.route.snapshot.paramMap.get('regNo');
    if (!schoolId || !regNo) {
      this.loading.set(false);
      return;
    }

    this.studentService.getStudentByRegNo(regNo, schoolId).subscribe({
      next: (resp) => {
        this.student.set(resp.data);
        this.resultsService
          .getStudentResultsBySessions(resp.data._id)
          .pipe(finalize(() => this.loading.set(false)))
          .subscribe({
            next: (sessions) => {
              const rows: ICarryoverRow[] = [];
              for (const block of sessions.data as IStudentSessionsResult[]) {
                const level = this.normalizeLevel(block.level);
                for (const entry of block.entries) {
                  if (entry.status?.toLowerCase() !== 'fail') continue;
                  rows.push({
                    resultId: entry.resultId,
                    courseId: entry.courseId,
                    courseCode: entry.courseCode,
                    courseTitle: entry.courseTitle ?? entry.courseCode,
                    level,
                    session: block.session,
                    test: entry.test,
                    lab: entry.lab,
                    exam: entry.exam,
                    total: entry.total,
                    grade: entry.grade,
                    status: entry.status,
                  });
                }
              }
              this.carryovers.set(rows);
            },
            error: () => {
              this.carryovers.set([]);
            },
          });
      },
      error: () => this.loading.set(false),
    });
  }

  private normalizeLevel(raw: LevelsEnum | string): string {
    return String(raw).trim().replace(/L$/i, '');
  }

  moderate(row: ICarryoverRow): void {
    const regNo = this.route.snapshot.paramMap.get('regNo');
    if (!regNo) return;
    void this.router.navigate(['/students', regNo, 'moderate', row.courseId], {
      queryParams: { resultId: row.resultId },
    });
  }

  backToProfile(): void {
    const regNo = this.route.snapshot.paramMap.get('regNo');
    if (!regNo) return;
    void this.router.navigate(['/students', regNo]);
  }

  trackRow(_i: number, row: ICarryoverRow): string {
    return `${row.resultId}-${row.courseId}`;
  }
}
