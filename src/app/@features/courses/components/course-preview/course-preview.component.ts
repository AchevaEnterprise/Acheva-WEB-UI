import { TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { SemesterEnum } from '../../../../@core/models/school.model';
import { SvgComponent } from '../../../../@shared/components/svg/svg.component';

/**
 * Human-readable label for each semester enum value.
 * Keeps the preview's footer ("1st Semester") in sync with the backend
 * `SemesterEnum` without scattering string literals.
 */
const SEMESTER_LABELS: Record<string, string> = {
  [SemesterEnum.FIRST]: '1st Semester',
  [SemesterEnum.SECOND]: '2nd Semester',
  [SemesterEnum.THIRD]: '3rd Semester',
};

/**
 * Fields read by the preview template and computeds. Callers may pass a wider
 * form value (e.g. `getRawValue()`); only these keys need to be structurally compatible.
 */
export interface CoursePreviewTemplate {
  courseCode?: string | { courseCode?: string } | null;
  courseTitle?: string | null;
  courseCordinator?: string | null;
  level?: string | number | null;
  semester?: string | null;
  courseLoad?: string | number | null;
  session?: string | null;
  department?: { name?: string } | null;
  createdAt?: string | number | Date | null;
}

@Component({
  selector: 'app-course-preview',
  imports: [MatDividerModule, SvgComponent, TitleCasePipe, UpperCasePipe],
  templateUrl: './course-preview.component.html',
  styleUrl: './course-preview.component.scss',
})
export class CoursePreviewComponent {
  /**
   * The form's raw value (plus any auxiliary fields like the resolved school
   * object). Kept as a loose object so both pages — lecturer "Create Result"
   * and HOD "Create Course" — can feed in their own form shapes.
   */
  courseTemplate = input<CoursePreviewTemplate | undefined>();

  template = computed((): CoursePreviewTemplate => this.courseTemplate() ?? {});

  courseCode = computed(() => {
    const raw = this.template().courseCode;
    if (raw == null || raw === '') return '';
    return typeof raw === 'string' ? raw : (raw.courseCode ?? '');
  });

  /** Preserve trailing "Level" suffix from the raw enum (e.g. `100` → `100L`). */
  levelLabel = computed(() => {
    const level = this.template().level;
    if (level == null || level === '') return '';
    const s = String(level);
    return /l/i.test(s) ? s : `${s}L`;
  });

  semesterLabel = computed(
    () => SEMESTER_LABELS[this.template().semester ?? ''] ?? ''
  );

  courseLoadLabel = computed(() => {
    const load = this.template().courseLoad;
    if (load == null || load === '') return '—';
    const n = Number(load);
    return `${load} Unit${n === 1 ? '' : 's'}`;
  });

  /** Shows the latest timestamp we have for this course (createdAt or today). */
  dateLabel = computed(() => {
    const created = this.template().createdAt;
    const date = created != null ? new Date(created) : new Date();
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  });
}
