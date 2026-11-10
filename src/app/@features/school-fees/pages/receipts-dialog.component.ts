import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ToastService } from '../../../@core/utility/toast.service';
import { formatNaira } from '../../user-settings/utils/naira';
import {
  ISchoolFeeReceiptSummary,
  ISchoolFeeStudentRow,
} from '../models/school-fees.model';
import { SchoolFeesService } from '../services/school-fees.service';

/**
 * A student's receipts for school fees paid outside Acheva — what the Head
 * or advisor sees before reminding them, and the files themselves, opened
 * through the API (the files are private; there is no link to share).
 */
@Component({
  selector: 'app-school-fee-receipts-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe],
  template: `
    <div class="receipts-dialog">
      <h3 class="acva-para-2 fw-500 m-0">
        Receipts · {{ data.fullName | titlecase }}
      </h3>
      <p class="acva-caption text-neutral-500 m-0">
        Payments made at the bank or on Remita. Each one counts toward the
        student's fees from the moment it is uploaded and is checked afterwards.
      </p>
      <ul class="receipts-dialog__list">
        @for (receipt of data.receipts; track receipt._id) {
          <li class="receipts-dialog__row">
            <div>
              <p class="acva-para-1 fw-500 m-0">
                {{ money(receipt.amountKobo) }}
                <span
                  class="receipts-dialog__chip acva-caption"
                  [class.receipts-dialog__chip--ok]="
                    receipt.status === 'VERIFIED'
                  "
                  >{{ status(receipt) }}</span
                >
              </p>
              <p class="acva-caption text-neutral-500 m-0">
                RRR {{ receipt.rrr }} · uploaded
                {{ receipt.uploadedAt | date: 'dd/MM/yyyy' }}
              </p>
            </div>
            <div class="receipts-dialog__links">
              <button
                type="button"
                class="receipts-dialog__link acva-caption"
                (click)="open(receipt, 'remitaReceipt')"
              >
                Remita receipt
              </button>
              <button
                type="button"
                class="receipts-dialog__link acva-caption"
                (click)="open(receipt, 'schoolFeeReceipt')"
              >
                School fees receipt
              </button>
            </div>
          </li>
        }
      </ul>
      <div class="receipts-dialog__actions">
        <button
          type="button"
          class="receipts-dialog__close acva-para-1"
          (click)="ref.close()"
        >
          Close
        </button>
      </div>
    </div>
  `,
  styles: `
    .receipts-dialog {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 24px;
      min-width: min(480px, 86vw);
    }
    .receipts-dialog__list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .receipts-dialog__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
      padding: 12px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .receipts-dialog__chip {
      margin-left: 8px;
      padding: 1px 10px;
      border-radius: 999px;
      box-shadow: inset 0 0 0 1px #77bbff;
      color: #2793ff;
      font-weight: 500;
    }
    .receipts-dialog__chip--ok {
      box-shadow: none;
      background: rgb(119 187 255 / 18%);
    }
    .receipts-dialog__links {
      display: flex;
      gap: 12px;
    }
    .receipts-dialog__link {
      padding: 0;
      border: 0;
      background: none;
      color: #2793ff;
      cursor: pointer;
    }
    .receipts-dialog__link:hover {
      text-decoration: underline;
    }
    .receipts-dialog__actions {
      display: flex;
      justify-content: flex-end;
    }
    .receipts-dialog__close {
      padding: 8px 20px;
      border: 1px solid #77bbff;
      border-radius: 8px;
      background: #fff;
      color: #2793ff;
      font-weight: 500;
      cursor: pointer;
    }
  `,
})
export class SchoolFeeReceiptsDialogComponent {
  readonly ref = inject(MatDialogRef<SchoolFeeReceiptsDialogComponent>);
  readonly data = inject<ISchoolFeeStudentRow>(MAT_DIALOG_DATA);
  private readonly api = inject(SchoolFeesService);
  private readonly toast = inject(ToastService);

  status(receipt: ISchoolFeeReceiptSummary): string {
    return receipt.status === 'VERIFIED' ? 'Verified' : 'Not yet checked';
  }

  money(kobo: number): string {
    return formatNaira(kobo);
  }

  /**
   * The tab is opened NOW, inside the click — a tab opened after the file
   * has downloaded is no longer the user's doing, and popup blockers stop
   * it — then pointed at the file once it arrives.
   */
  open(
    receipt: ISchoolFeeReceiptSummary,
    which: 'schoolFeeReceipt' | 'remitaReceipt'
  ): void {
    const tab = window.open('', '_blank');
    this.api.receiptFile(receipt._id, which).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.location.assign(url);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        tab?.close();
        this.toast.showNotification(
          'error',
          'Could not open the receipt',
          'Please try again.'
        );
      },
    });
  }
}
