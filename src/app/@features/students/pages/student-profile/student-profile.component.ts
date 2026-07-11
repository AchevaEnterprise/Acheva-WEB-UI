import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  IDepartment,
  LevelsEnum,
  SemesterEnum,
} from '../../../../@core/models/school.model';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { SkeletonComponent } from '../../../../@shared/components/skeleton/skeleton.component';
import { SkeletonTableComponent } from '../../../../@shared/components/skeleton/skeleton-table.component';
import { StatusBadgeComponent } from '../../../../@shared/components/status-badge/status-badge.component';
import { ToastService } from '../../../../@core/utility/toast.service';
import { AuthenticationService } from '../../../auth/service/auth.service';
import { ResultsService } from '../../../result-management/services/results.service';
import { AiInsightCardComponent } from '../../components/ai-insight-card/ai-insight-card.component';
import { StudentStatCardComponent } from '../../components/student-stat-card/student-stat-card.component';
import {
  IStudent,
  IStudentResult,
  IStudentSessionsResult,
  StudentResultType,
} from '../../models/student.model';
import { StudentService } from '../../services/student.service';

interface LevelTab {
  value: LevelsEnum;
  label: string;
}

@Component({
  selector: 'app-student-profile',
  imports: [
    TitleCasePipe,
    DecimalPipe,
    MatIconModule,
    MatSelectModule,
    ButtonComponent,
    SkeletonComponent,
    SkeletonTableComponent,
    StatusBadgeComponent,
    StudentStatCardComponent,
    AiInsightCardComponent,
  ],
  templateUrl: './student-profile.component.html',
  styleUrl: './student-profile.component.scss',
})
export class StudentProfileComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly studentService = inject(StudentService);
  private readonly resultsService = inject(ResultsService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ── Template constants ─────────────────────────────────────────────────────
  readonly SemesterEnum = SemesterEnum;
  readonly levelTabs: LevelTab[] = [
    { value: LevelsEnum.YEAR_ONE, label: '100LVL' },
    { value: LevelsEnum.YEAR_TWO, label: '200LVL' },
    { value: LevelsEnum.YEAR_THREE, label: '300LVL' },
    { value: LevelsEnum.YEAR_FOUR, label: '400LVL' },
    { value: LevelsEnum.YEAR_FIVE, label: '500LVL' },
    { value: LevelsEnum.YEAR_SIX, label: '600LVL' },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  loadingStudent = signal(true);
  loadingResults = signal(false);

  student = signal<IStudent | null>(null);
  /** Per-level → session map populated by `getStudentResultsBySessions`. */
  sessionsByLevel = signal<Map<LevelsEnum, IStudentSessionsResult>>(new Map());

  activeLevel = signal<LevelsEnum>(LevelsEnum.YEAR_ONE);
  activeSemester = signal<SemesterEnum>(SemesterEnum.FIRST);

  semesterResults = signal<StudentResultType[]>([]);
  gpa = signal<number>(0);

  // ── Derived view-model bits ────────────────────────────────────────────────
  departmentName = computed<string>(() => {
    const dept = this.student()?.department;
    return typeof dept === 'object' && dept !== null
      ? (dept as IDepartment).name
      : '';
  });

  levelLabel = computed<string>(() => {
    const lvl = this.student()?.level;
    return lvl ? `${lvl}LVL` : '';
  });

  /** Session string used in the header chip. */
  studentSession = computed<string>(() => this.student()?.session ?? '');

  /** Count of failed courses across all loaded sessions. Drives the
   *  Carryover Warning insight. */
  carryoverCount = computed<number>(() => {
    let count = 0;
    for (const session of this.sessionsByLevel().values()) {
      for (const entry of session.entries) {
        if (entry.status?.toLowerCase() === 'fail') count++;
      }
    }
    return count;
  });

  carryoverDescription = computed<string>(() => {
    const count = this.carryoverCount();
    if (count === 0)
      return 'No outstanding courses. Student is up to date with their results.';
    return `${count} course${count > 1 ? 's' : ''} still pending. Failure to clear may delay graduation.`;
  });

  unitLoadCurrent = computed<number>(() => {
    return this.semesterResults().reduce(
      (sum, r) => sum + (Number(r.courseLoad) || 0),
      0
    );
  });

  coursesEnrolled = computed<number>(() => {
    let total = 0;
    for (const session of this.sessionsByLevel().values()) {
      total += session.entries.length;
    }
    return total;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fetchStudent();
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  private fetchStudent(): void {
    const schoolId = this.authService.activeAccount()?.school?._id;
    const regNo = this.route.snapshot.paramMap.get('regNo');

    if (!schoolId || !regNo) {
      this.loadingStudent.set(false);
      return;
    }

    this.studentService
      .getStudentByRegNo(regNo, schoolId)
      .pipe(finalize(() => this.loadingStudent.set(false)))
      .subscribe({
        next: (resp) => {
          this.student.set(resp.data);
          this.activeLevel.set(this.resolveDefaultLevel(resp.data.level));
          this.fetchSessionsAndResults();
        },
      });
  }

  /**
   * Loads the per-level sessions map (used to populate the level tabs and
   * derive carryover counts) and the active semester table in parallel.
   */
  private fetchSessionsAndResults(): void {
    const studentId = this.student()?._id;
    if (!studentId) return;

    this.resultsService.getStudentResultsBySessions(studentId).subscribe({
      next: (resp) => {
        const map = new Map<LevelsEnum, IStudentSessionsResult>();
        for (const session of resp.data) {
          map.set(session.level, session);
        }
        this.sessionsByLevel.set(map);
        this.fetchActiveSemesterResults();
      },
    });
  }

  private fetchActiveSemesterResults(): void {
    const studentId = this.student()?._id;
    const session = this.sessionsByLevel().get(this.activeLevel())?.session;
    if (!studentId || !session) {
      this.semesterResults.set([]);
      this.gpa.set(0);
      return;
    }

    this.loadingResults.set(true);
    this.resultsService
      .getStudentResult(
        studentId,
        this.activeLevel(),
        session,
        this.activeSemester()
      )
      .pipe(finalize(() => this.loadingResults.set(false)))
      .subscribe({
        next: (resp: { data: IStudentResult }) => {
          this.semesterResults.set(resp.data?.results ?? []);
          this.gpa.set(resp.data?.gpa ?? 0);
        },
      });
  }

  /** Falls back to 100 level if the student record has no level set. */
  private resolveDefaultLevel(level: string | undefined): LevelsEnum {
    const match = this.levelTabs.find((t) => t.value === level);
    return match ? match.value : LevelsEnum.YEAR_ONE;
  }

  // ── User actions ───────────────────────────────────────────────────────────
  setLevel(level: LevelsEnum): void {
    if (this.activeLevel() === level) return;
    this.activeLevel.set(level);
    this.fetchActiveSemesterResults();
  }

  setSemester(semester: SemesterEnum): void {
    if (this.activeSemester() === semester) return;
    this.activeSemester.set(semester);
    this.fetchActiveSemesterResults();
  }

  /**
   * Future: navigates to the carryover detail page where the CA can pick a
   * failed course to moderate. The destination is built in a later phase.
   */
  openCarryovers(): void {
    if (this.carryoverCount() === 0) return;
    const regNo = this.route.snapshot.paramMap.get('regNo');
    if (!regNo) return;
    void this.router.navigate(['/students', regNo, 'carryovers']);
  }

  // ── Stubs for future features (kept here so the next phases can plug in
  //    without touching the template) ─────────────────────────────────────────
  editProfile(): void {
    this.notifyComingSoon(
      'Editing student profiles will be available shortly.'
    );
  }

  toggleDeactivate(): void {
    this.notifyComingSoon('Activate / deactivate is not yet enabled.');
  }

  printResults(): void {
    window.print();
  }

  viewRegisteredCourses(): void {
    this.notifyComingSoon('Registered course management is in progress.');
  }

  runAiSmartFix(): void {
    this.notifyComingSoon('AI Smart Fix is being trained for this department.');
  }

  manualFix(): void {
    this.notifyComingSoon('Manual fix flow is being built.');
  }

  private notifyComingSoon(message: string): void {
    this.toastService.showNotification('warning', 'Coming soon', message);
  }

  trackEntry(_index: number, entry: StudentResultType): string {
    return entry._id ?? entry.courseCode;
  }
}
