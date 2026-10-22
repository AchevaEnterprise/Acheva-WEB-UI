import { StatusBadgeTone } from '../../../@shared/components/status-badge/status-badge.component';
import { IDepartmentTransfer, TransferStatus } from '../models/transfer.model';

/**
 * The single source of truth for how a transfer's state is written and
 * coloured.
 *
 * Raw workflow tokens must never reach a template — `PENDING_RECEIVING_HOD`
 * is a database value, not something to show a Head of Department. Same rule
 * as `history-status.ts`: if a new status appears, add a label here rather
 * than formatting it at the call site, or two screens will eventually
 * disagree about what the same document says.
 */
export function transferStatusLabel(status: TransferStatus | string): string {
  switch (status) {
    case TransferStatus.DRAFT:
      return 'Draft';
    case TransferStatus.PENDING_RECEIVING_HOD:
      return 'Awaiting approval';
    case TransferStatus.COMPLETED:
      return 'Transferred';
    case TransferStatus.REJECTED:
      return 'Returned';
    case TransferStatus.CANCELLED:
      return 'Withdrawn';
    default:
      return 'Unknown';
  }
}

/**
 * Brand blue for a completed transfer, never green — green is off-palette in
 * this product, the same decision History's badge tone follows.
 */
export function transferStatusTone(
  status: TransferStatus | string
): StatusBadgeTone {
  switch (status) {
    case TransferStatus.COMPLETED:
      return 'brand';
    case TransferStatus.REJECTED:
      return 'negative';
    case TransferStatus.PENDING_RECEIVING_HOD:
      return 'brand';
    default:
      return 'neutral';
  }
}

/** Pull an id out of a field the API may or may not have populated. */
export function idOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const nested = (value as { _id?: unknown })._id;
  return nested ? String(nested) : null;
}

/** A populated name, or the office's email, or nothing. */
export function nameOf(value: unknown): string {
  if (!value || typeof value === 'string') return '';
  const party = value as {
    firstname?: string;
    lastname?: string;
    email?: string;
  };
  const name = [party.firstname, party.lastname].filter(Boolean).join(' ');
  return name || party.email || '';
}

/**
 * What this viewer can actually do with this transfer.
 *
 * Derived from `currentHandler` exactly as the server derives it, so the
 * buttons offered are the buttons that will succeed. A UI that offers an
 * action the API refuses teaches people the app is broken — the same reason
 * the messaging directory was narrowed to match its permission layer.
 */
export interface ITransferActions {
  canEdit: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  canDecide: boolean;
}

export function getTransferActions(
  transfer: IDepartmentTransfer,
  viewerId: string
): ITransferActions {
  const mine = idOf(transfer.currentHandler) === viewerId;
  const editable =
    transfer.status === TransferStatus.DRAFT ||
    transfer.status === TransferStatus.REJECTED;

  return {
    canEdit: mine && editable,
    canSubmit: mine && editable,
    canCancel: mine && editable,
    canDecide: mine && transfer.status === TransferStatus.PENDING_RECEIVING_HOD,
  };
}
