import { IDepartment, IFaculty } from '../../../@core/models/school.model';

export enum TransferStatus {
  DRAFT = 'DRAFT',
  PENDING_RECEIVING_HOD = 'PENDING_RECEIVING_HOD',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum TransferAction {
  CREATED = 'CREATED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface ITransferParty {
  _id: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
}

export interface ITransferStudent {
  _id: string;
  fullName: string;
  registrationNumber: string;
  level?: string;
  admissionYear?: string;
  email?: string;
}

export interface ITransferHistoryEntry {
  action: TransferAction;
  lecturer: ITransferParty | string;
  lecturerRole: string;
  timestamp: string;
  comment?: string;
}

export interface ITransferSnapshotEntry {
  courseCode: string;
  courseTitle: string;
  units: number;
  session: string;
  level: string;
  semester: string;
  grade: string;
  total: number;
  status: string;
}

export interface ITransferSnapshotCarryOver {
  courseCode: string;
  courseTitle: string;
  units: number;
  courseSemester: string;
  failedInSession: string;
  failedInLevel: string;
  attempts: number;
  owedTo: string | null;
}

export interface ITransferSnapshot {
  fullName: string;
  registrationNumber: string;
  email: string;
  admissionYear: string;
  cgpa: string;
  coursesPassed: number;
  unitsPassed: number;
  entries: ITransferSnapshotEntry[];
  carryOvers: ITransferSnapshotCarryOver[];
  takenAt: string;
}

/**
 * Something the transfer deliberately did not decide. Shown to the receiving
 * advisor as work to do, never as an error — the platform's posture is to
 * flag it for a human rather than remap an obligation in a database write.
 */
export interface ITransferUnplacedItem {
  kind: 'CARRYOVER_FOREIGN_DEPARTMENT' | 'ACTIVE_REGISTRATION' | 'DUES_PAID';
  label: string;
  detail: string;
}

export interface IDepartmentTransfer {
  _id: string;
  student: ITransferStudent | string;
  fromDepartment: IDepartment | string;
  fromFaculty: IFaculty | string;
  fromLevel: string;
  toDepartment: IDepartment | string;
  toFaculty: IFaculty | string;
  toLevel: string;
  toSemester: string;
  status: TransferStatus;
  letterBody: string;
  snapshot: ITransferSnapshot;
  submittedBy: ITransferParty | string;
  currentHandler: ITransferParty | string;
  receivingHod: ITransferParty | string | null;
  rejectionReason: string | null;
  history: ITransferHistoryEntry[];
  unplaced: ITransferUnplacedItem[];
  approvedAt: string | null;
  completedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ITransferEligibility {
  eligible: boolean;
  reason: string | null;
  currentDepartment: string | null;
  currentLevel: string | null;
  inFlight: { id: string; status: TransferStatus } | null;
}

export interface ICreateTransfer {
  student: string;
  toDepartment: string;
  toLevel: string;
  toSemester: string;
  letterBody: string;
}
