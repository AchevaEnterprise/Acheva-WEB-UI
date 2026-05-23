import { Component, computed, input, output, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { ISubmitOutcomePayload } from '../../models/moderation.model';

/**
 * Moderator score entry form. Calculates the live total/grade so the lecturer
 * sees the outcome before submitting. Pages own the network call — this
 * component is purely presentational + a single submit event.
 */
@Component({
  selector: 'app-moderator-score-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    ButtonComponent,
  ],
  templateUrl: './moderator-score-form.component.html',
  styleUrl: './moderator-score-form.component.scss',
})
export class ModeratorScoreFormComponent {
  /** Bound to the parent's saving signal so the button shows a spinner. */
  saving = input<boolean>(false);
  /** Pre-fill values when re-opening or for "edit" cases (currently unused). */
  initial = input<Partial<ISubmitOutcomePayload>>({});

  submitEvent = output<ISubmitOutcomePayload>();

  // FormGroup with bounded numeric inputs. Values can never go negative or
  // above their conventional caps — backend will revalidate but UI catches
  // the obvious mistakes immediately.
  form = new FormGroup({
    test: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0), Validators.max(30)],
    }),
    lab: new FormControl<number | null>(null, {
      validators: [Validators.min(0), Validators.max(30)],
    }),
    exam: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0), Validators.max(70)],
    }),
    comment: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  // Track raw values reactively so the live preview updates on every keystroke.
  private readonly raw = signal(this.form.getRawValue());
  constructor() {
    this.form.valueChanges.subscribe(() =>
      this.raw.set(this.form.getRawValue())
    );
    const init = this.initial();
    if (Object.keys(init).length) this.form.patchValue(init);
  }

  total = computed(() => {
    const v = this.raw();
    return num(v.test) + num(v.lab) + num(v.exam);
  });

  grade = computed(() => gradeFor(this.total()));
  passed = computed(() => this.total() >= 40);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const test = Number(v.test);
    const exam = Number(v.exam);
    const lab = v.lab == null ? undefined : Number(v.lab);

    this.submitEvent.emit({
      test,
      lab,
      exam,
      comment: v.comment.trim() || undefined,
    });
  }
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

function gradeFor(total: number): string {
  if (total >= 70) return 'A';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  if (total >= 45) return 'D';
  if (total >= 40) return 'E';
  return 'F';
}
