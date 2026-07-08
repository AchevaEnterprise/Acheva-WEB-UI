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
import {
  IModerationOutcome,
  ISubmitOutcomePayload,
} from '../../models/moderation.model';
import {
  MODERATED_TOTAL_MAX,
  MODERATED_TOTAL_MIN,
  generateModeratedScores,
} from '../../utils/moderation-workflow';

/**
 * HOD moderation panel: shows the student's ORIGINAL failing score, lets the
 * HOD auto-generate (or hand-adjust) replacement scores, and enforces the
 * moderation policy — the new total must be a grade E (40–44) — before the
 * submit button ever enables. Pages own the network call; this component is
 * presentational + a single submit event.
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
  /** The failing scores being replaced — displayed above the inputs. */
  originalScores = input<IModerationOutcome | null>(null);

  submitEvent = output<ISubmitOutcomePayload>();

  readonly bandMin = MODERATED_TOTAL_MIN;
  readonly bandMax = MODERATED_TOTAL_MAX;

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
  }

  total = computed(() => {
    const v = this.raw();
    return num(v.test) + num(v.lab) + num(v.exam);
  });

  grade = computed(() => gradeFor(this.total()));

  /** The single rule of moderation: total must land in the E band. */
  withinBand = computed(
    () => this.total() >= this.bandMin && this.total() <= this.bandMax
  );

  hasValues = computed(() => {
    const v = this.raw();
    return v.test != null || v.exam != null || v.lab != null;
  });

  /**
   * Fill the inputs with random scores summing to a grade E. Whether a lab
   * component is generated follows the original failing entry's shape.
   */
  generate(): void {
    const hadLab = (this.originalScores()?.lab ?? 0) > 0;
    const scores = generateModeratedScores(hadLab);
    this.form.patchValue({
      test: scores.test,
      lab: scores.lab ?? null,
      exam: scores.exam,
    });
    this.form.markAsDirty();
  }

  submit(): void {
    if (this.form.invalid || !this.withinBand()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitEvent.emit({
      test: Number(v.test),
      lab: v.lab == null ? undefined : Number(v.lab),
      exam: Number(v.exam),
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
