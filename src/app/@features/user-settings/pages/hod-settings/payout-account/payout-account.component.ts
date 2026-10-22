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
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { BackButtonComponent } from '../../../../../@shared/components/back-button/back-button.component';
import { ButtonComponent } from '../../../../../@shared/components/forms/button/button.component';
import { CardComponent } from '../../../../../@shared/components/card/card.component';
import { SkeletonComponent } from '../../../../../@shared/components/skeleton/skeleton.component';
import { ToastService } from '../../../../../@core/utility/toast.service';
import { IBank, IPayoutAccount } from '../../../models/payout-account.model';
import { PayoutAccountService } from '../../../service/payout-account.service';

/** NUBAN — every Nigerian bank account number is exactly ten digits. */
const NUBAN_LENGTH = 10;

/**
 * The department's payout account: where its share of every payment lands.
 *
 * ## Why this page exists before any student can pay
 *
 * A collection is split between Acheva and the department at the moment it is
 * initialised, and the department's half needs somewhere to go. Until these
 * details are registered AND acknowledged by the payment provider, the server
 * refuses to collect dues at all — collecting into limbo and sorting it out
 * later is not a thing you can do with other people's money.
 *
 * ## "Saved" is not "working"
 *
 * Saving the details creates a subaccount with the provider. If that call
 * fails — bad credentials, provider down, a number the bank rejects — the
 * details are still kept, but the account is **unverified** and students
 * still cannot pay. The page says so plainly rather than showing a green
 * state that would leave a Head believing collection is live.
 */
@Component({
  selector: 'app-payout-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    BackButtonComponent,
    ButtonComponent,
    CardComponent,
    SkeletonComponent,
  ],
  templateUrl: './payout-account.component.html',
  styleUrl: './payout-account.component.scss',
})
export class PayoutAccountComponent implements OnInit {
  private readonly api = inject(PayoutAccountService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly account = signal<IPayoutAccount | null>(null);
  readonly banks = signal<IBank[]>([]);

  readonly form: FormGroup = this.fb.group({
    bankCode: ['', [Validators.required]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    accountName: ['', [Validators.required, Validators.maxLength(120)]],
  });

  readonly isVerified = computed(() => this.account()?.verified === true);
  readonly isUnverified = computed(
    () => this.account() !== null && !this.account()?.verified
  );

  readonly bankName = computed(() => {
    const code = this.account()?.bankCode;
    return (
      this.banks().find((bank) => bank.bankCode === code)?.bankName ?? code
    );
  });

  ngOnInit(): void {
    this.api
      .banks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => this.banks.set([...(resp.data ?? [])]),
        error: () =>
          this.toast.showNotification(
            'error',
            'Could not load banks',
            'Please refresh and try again.'
          ),
      });

    this.load();
  }

  private load(): void {
    this.api
      .myDepartment()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          const existing = resp.data ?? null;
          this.account.set(existing);
          if (existing) {
            this.form.patchValue({
              bankCode: existing.bankCode,
              accountNumber: existing.accountNumber,
              accountName: existing.accountName,
            });
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showNotification(
            'error',
            'Could not load the payout account',
            'Please try again.'
          );
        },
      });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue() as {
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
    const payload = {
      bankCode: raw.bankCode,
      accountNumber: raw.accountNumber.trim(),
      accountName: raw.accountName.trim(),
    };

    const existing = this.account();
    const request = existing
      ? this.api.update(existing.id, payload)
      : this.api.create(payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        // Reload rather than trust the write: `verified` depends on whether
        // the provider accepted the subaccount, which only the server knows.
        this.load();
        this.toast.showNotification(
          'success',
          'Payout account saved',
          'Checking it with the payment provider…'
        );
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.showNotification(
          'error',
          'Could not save',
          err?.error?.message ?? 'Please check the details and try again.'
        );
      },
    });
  }

  /** `1982878989` → `198 287 8989`, which is how people read one back. */
  grouped(accountNumber: string): string {
    return accountNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  }

  readonly numberLength = NUBAN_LENGTH;
  trackByCode = (_: number, bank: IBank) => bank.bankCode;
}
