import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  MatNativeDateModule,
} from '@angular/material/core';

import { DayFirstDateAdapter } from '../../../../../@core/date/day-first-date.adapter';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { CardComponent } from '../../../../../@shared/components/card/card.component';
import { SkeletonComponent } from '../../../../../@shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../../../@shared/components/status-badge/status-badge.component';
import { BackButtonComponent } from '../../../../../@shared/components/back-button/back-button.component';
import { ToastService } from '../../../../../@core/utility/toast.service';
import { IDuesConfig, IDuesEditability } from '../../../models/dues.model';
import { DuesService } from '../../../service/dues.service';
import { formatNaira, toKobo, toNaira } from '../../../utils/naira';

/** One to three. Four is not a payment plan. */
const MAX_INSTALMENTS = 3;

/** The form's shape, so `getRawValue()` is narrowed in exactly one place. */
interface IDuesFormValue {
  readonly title: string;
  readonly description: string;
  /** Naira as typed — converted to kobo at the boundary. */
  readonly totalAmount: number;
  readonly instalments: readonly {
    readonly amount: number;
    readonly dueDate: Date;
    readonly note: string;
  }[];
}

/**
 * Departmental dues — what this department charges for the session, and how it
 * may be paid.
 *
 * ## This page sets policy; it does not take money
 *
 * A Head decides the amount and the schedule here. Collection lives elsewhere
 * (backlog item 19) and reads this as its source of truth, so nothing on this
 * page touches a provider, a balance or a transaction.
 *
 * ## The rule the form exists to enforce
 *
 * **The instalments must add up to the total, exactly.** The running
 * difference is shown the whole time rather than raised on submit, because
 * being told "that does not add up" after filling three dates is the kind of
 * friction that ends with somebody publishing a wrong figure.
 *
 * ## Why the money fields lock
 *
 * The moment one student pays, the schedule freezes. Re-pricing a plan
 * somebody is halfway through either re-bills them for a difference they never
 * agreed to, or silently writes off money the department is owed. The server
 * enforces it; this page explains it.
 */
@Component({
  selector: 'app-departmental-dues',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ButtonComponent,
    CardComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    BackButtonComponent,
  ],
  templateUrl: './departmental-dues.component.html',
  styleUrl: './departmental-dues.component.scss',
  providers: [
    /**
     * Dates are DAY-FIRST, because this is a Nigerian product.
     *
     * Material's default locale parses `13/11/2026` as month 13 and marks the
     * field invalid — so a Head typing a due date the way they write every
     * other date gets an error they cannot explain. Worse, `05/06/2026` would
     * parse successfully as the WRONG day. Scoped to this component rather
     * than set globally, since changing every existing datepicker is a wider
     * decision than this page should make on its own.
     *
     * BOTH providers are needed. The locale fixes how a date is DISPLAYED;
     * the adapter fixes how a typed one is READ. With only the locale the
     * native adapter still parses via `Date.parse`, which rejects
     * `15/11/2026` outright — see `DayFirstDateAdapter`.
     */
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: DayFirstDateAdapter },
  ],
})
export class DepartmentalDuesComponent implements OnInit {
  private readonly dues = inject(DuesService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly session = signal('');
  readonly config = signal<IDuesConfig | null>(null);
  readonly editability = signal<IDuesEditability>({
    amounts: true,
    reason: null,
  });

  /**
   * The form's state, mirrored into signals.
   *
   * `form.valid` is NOT reactive, so a `computed()` reading it never
   * recomputes when a control changes — the save button stayed disabled with
   * a perfectly valid form until something signal-shaped happened to change.
   * Anything the template depends on has to live in a signal.
   */
  readonly totalNaira = signal(0);
  readonly instalmentTotals = signal<number[]>([]);
  private readonly formValid = signal(false);

  readonly form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    totalAmount: [
      null as number | null,
      [Validators.required, Validators.min(1)],
    ],
    instalments: this.fb.array([]),
  });

  get instalments(): FormArray {
    return this.form.get('instalments') as FormArray;
  }

  /** Kobo, so the comparison is exact — never compare naira floats. */
  readonly totalKobo = computed(() => toKobo(this.totalNaira()));
  readonly scheduledKobo = computed(() =>
    this.instalmentTotals().reduce((sum, amount) => sum + toKobo(amount), 0)
  );
  readonly differenceKobo = computed(
    () => this.totalKobo() - this.scheduledKobo()
  );
  readonly balances = computed(
    () => this.totalKobo() > 0 && this.differenceKobo() === 0
  );

  readonly canEditAmounts = computed(() => this.editability().amounts);
  readonly isPublished = computed(() => this.config()?.status === 'ACTIVE');
  readonly isClosed = computed(() => this.config()?.status === 'CLOSED');

  readonly canSave = computed(
    () => this.formValid() && this.balances() && !this.saving()
  );

  ngOnInit(): void {
    this.load();

    // Keep the signals in step with the form so the running difference and the
    // save button react as the Head types, without the template reading
    // controls directly.
    this.form
      .get('totalAmount')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.totalNaira.set(Number(value) || 0));

    this.instalments.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncInstalmentTotals());

    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formValid.set(this.form.valid));
  }

  /**
   * Re-read the form after a change made with `emitEvent: false`.
   *
   * Suppressing events is right when filling the form from the server — it
   * avoids a cascade of no-op recalculations — but it also means
   * `statusChanges` never fires, so the mirrored signals have to be nudged by
   * hand at exactly those points.
   */
  private refreshFormState(): void {
    this.syncInstalmentTotals();
    this.formValid.set(this.form.valid);
  }

  private syncInstalmentTotals(): void {
    this.instalmentTotals.set(
      this.instalments.controls.map(
        (control) => Number(control.get('amount')?.value) || 0
      )
    );
  }

  private load(): void {
    this.dues
      .myDepartment()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          const { session, config, editable } = resp.data;
          this.session.set(session);
          this.config.set(config);
          this.editability.set(editable);

          if (config) this.fill(config);
          else this.addInstalment();

          this.refreshFormState();

          if (!editable.amounts) {
            this.form.get('totalAmount')?.disable({ emitEvent: false });
            this.instalments.disable({ emitEvent: false });
          }

          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.showNotification(
            'error',
            'Could not load dues',
            err?.error?.message ?? 'Please try again.'
          );
        },
      });
  }

  private fill(config: IDuesConfig): void {
    this.form.patchValue(
      {
        title: config.title,
        description: config.description ?? '',
        totalAmount: toNaira(config.totalAmount),
      },
      { emitEvent: false }
    );
    this.totalNaira.set(toNaira(config.totalAmount));

    this.instalments.clear({ emitEvent: false });
    for (const instalment of config.instalments) {
      this.instalments.push(
        this.instalmentGroup(
          toNaira(instalment.amount),
          new Date(instalment.dueDate),
          instalment.note
        ),
        { emitEvent: false }
      );
    }
    this.syncInstalmentTotals();
  }

  private instalmentGroup(
    amount: number | null = null,
    dueDate: Date | null = null,
    note: string | null = null
  ): FormGroup {
    return this.fb.group({
      amount: [amount, [Validators.required, Validators.min(0.01)]],
      dueDate: [dueDate, [Validators.required]],
      note: [note ?? '', [Validators.maxLength(120)]],
    });
  }

  addInstalment(): void {
    if (this.instalments.length >= MAX_INSTALMENTS) return;
    this.instalments.push(this.instalmentGroup());
    this.refreshFormState();
  }

  removeInstalment(index: number): void {
    if (this.instalments.length <= 1) return;
    this.instalments.removeAt(index);
    this.refreshFormState();
  }

  readonly canAddInstalment = computed(
    () => this.instalments.length < MAX_INSTALMENTS && this.canEditAmounts()
  );

  /**
   * Fill the schedule with an even split of the total.
   *
   * The split comes from the server so the odd kobo lands on the same
   * instalment at both ends — a locally computed split that is one kobo out
   * would be rejected on save with an error the Head cannot act on.
   */
  suggestSplit(): void {
    const total = this.totalKobo();
    if (total <= 0) {
      this.toast.showNotification(
        'warning',
        'Enter a total first',
        'There is nothing to split until the total amount is set.'
      );
      return;
    }

    this.dues
      .split(total, this.instalments.length)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          resp.data.instalments.forEach((kobo, index) => {
            this.instalments
              .at(index)
              ?.get('amount')
              ?.setValue(toNaira(kobo), { emitEvent: false });
          });
          this.refreshFormState();
        },
        error: () =>
          this.toast.showNotification(
            'error',
            'Could not split the total',
            'Please try again.'
          ),
      });
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);

    // `getRawValue()` is `any` by declaration, so the shape is asserted once
    // here rather than letting untyped values spread through the payload.
    const raw = this.form.getRawValue() as IDuesFormValue;

    this.dues
      .save({
        name: raw.title,
        description: raw.description || undefined,
        amount: toKobo(raw.totalAmount),
        instalments: raw.instalments.map((instalment) => ({
          amount: toKobo(instalment.amount),
          dueDate: new Date(instalment.dueDate).toISOString(),
          note: instalment.note || undefined,
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.config.set(resp.data);
          this.saving.set(false);
          this.toast.showNotification(
            'success',
            'Dues saved',
            this.isPublished()
              ? 'Your students will see the updated plan.'
              : 'Saved as a draft. Publish it when you are ready.'
          );
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.showNotification(
            'error',
            'Could not save',
            err?.error?.message ?? 'Please try again.'
          );
        },
      });
  }

  publish(): void {
    this.changeStatus(
      'ACTIVE',
      'Dues published',
      'Students can now see and pay this.'
    );
  }

  close(): void {
    this.changeStatus(
      'CLOSED',
      'Dues closed',
      'This plan is no longer collecting. The record is kept.'
    );
  }

  reopen(): void {
    this.changeStatus(
      'ACTIVE',
      'Dues reopened',
      'Students can pay this again.'
    );
  }

  private changeStatus(
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED',
    title: string,
    message: string
  ): void {
    this.saving.set(true);
    this.dues
      .changeStatus(status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.config.set(resp.data);
          this.saving.set(false);
          this.toast.showNotification('success', title, message);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.showNotification(
            'error',
            'Could not update',
            err?.error?.message ?? 'Please try again.'
          );
        },
      });
  }

  /** Display helpers — the template never does arithmetic. */
  money(kobo: number): string {
    return formatNaira(kobo);
  }

  moneyFromNaira(naira: number): string {
    return formatNaira(toKobo(naira));
  }

  readonly differenceLabel = computed(() => {
    const difference = this.differenceKobo();
    if (difference === 0) return 'The schedule adds up.';
    return difference > 0
      ? `${formatNaira(difference)} still to schedule`
      : `${formatNaira(Math.abs(difference))} over the total`;
  });
}
