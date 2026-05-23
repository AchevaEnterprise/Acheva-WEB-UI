import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../@core/utility/toast.service';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { LoaderComponent } from '../../../../@shared/components/loader/loader.component';
import { ILecturer } from '../../../user-settings/models/lecturer.model';
import { LecturersService } from '../../../user-settings/service/lecturer.service';
import { IAssignModeratorPayload } from '../../models/moderation.model';

interface AssignModeratorDialogData {
  /** Department to load lecturers from. Required by the picker. */
  departmentId: string;
  /** Heading shown at the top of the dialog. */
  title: string;
  /** Subtitle shown under the heading (e.g. course / student summary). */
  subtitle?: string;
}

/**
 * Reusable picker for the HOD's "approve & assign moderator" step.
 *
 * Used by:
 *   - `homeHodApproveInternal`  (department = home dept)
 *   - `offeringHodApprove`      (department = offering / course-owning dept)
 *
 * Closes with the {@link IAssignModeratorPayload} when confirmed, or `null`
 * on cancel.
 */
@Component({
  selector: 'app-assign-moderator-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    ButtonComponent,
    LoaderComponent,
  ],
  templateUrl: './assign-moderator-dialog.component.html',
  styleUrl: './assign-moderator-dialog.component.scss',
})
export class AssignModeratorDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<AssignModeratorDialogComponent, IAssignModeratorPayload | null>
  );
  readonly data = inject<AssignModeratorDialogData>(MAT_DIALOG_DATA);
  private readonly lecturersService = inject(LecturersService);
  private readonly toast = inject(ToastService);

  loading = signal<boolean>(true);
  lecturers = signal<ILecturer[]>([]);

  form = new FormGroup({
    assignedLecturerId: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    preferredModeratorNote: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    comment: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  hasLecturers = computed(() => this.lecturers().length > 0);

  ngOnInit(): void {
    this.loadLecturers();
  }

  private loadLecturers(): void {
    this.lecturersService
      .getLecturersInDepartment(this.data.departmentId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          if (!resp.status) return;
          // Backend already excludes the calling lecturer (HOD) and the API
          // wrapper strips Deans — anything left is a valid candidate.
          this.lecturers.set(resp.data);
        },
        error: () => {
          this.toast.showNotification(
            'error',
            'Could not load lecturers',
            'Unable to fetch lecturers in this department. Please try again.'
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { assignedLecturerId, preferredModeratorNote, comment } =
      this.form.getRawValue();

    this.dialogRef.close({
      assignedLecturerId,
      preferredModeratorNote: preferredModeratorNote.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  }

  lecturerLabel(l: ILecturer): string {
    const titles = (l.titles ?? []).join(' ').trim();
    const name = `${l.firstname ?? ''} ${l.lastname ?? ''}`.trim();
    const role = l.role ? ` · ${l.role.replace(/_/g, ' ')}` : '';
    return [titles, name].filter(Boolean).join(' ') + role;
  }
}
