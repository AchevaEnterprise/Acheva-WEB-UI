/**
 * Where a department's share of every payment is settled.
 *
 * Mirrors `acheva-nestjs/src/accounts/`. The field that matters is
 * `verified`: bank details on file are not the same as a working payout
 * account. Without a Paystack subaccount behind them, a collection would send
 * the department's share to Acheva's main account instead — so the payment
 * path refuses, and this page has to be able to say why.
 */
export interface IPayoutAccount {
  readonly id: string;
  readonly bankCode: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly provider: string;
  /** Whether the department can actually be paid into. */
  readonly verified: boolean;
  readonly updatedAt: string | null;
}

export interface IBank {
  readonly bankCode: string;
  readonly bankName: string;
}

export interface ISavePayoutAccount {
  readonly bankCode: string;
  readonly accountNumber: string;
  readonly accountName: string;
}
