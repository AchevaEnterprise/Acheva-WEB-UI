/** Mirrors `acheva-nestjs/src/registration` + `src/curriculum`. */

export enum RegistrationStatus {
  ACTIVE = 'ACTIVE',
  PENDING_CA_APPROVAL = 'PENDING_CA_APPROVAL',
  NEEDS_ATTENTION = 'NEEDS_ATTENTION',
}

export enum RegistrationEntryType {
  COMPULSORY = 'COMPULSORY',
  ELECTIVE = 'ELECTIVE',
  SIWES = 'SIWES',
  CARRYOVER = 'CARRYOVER',
}

export enum RegistrationEntryStatus {
  REGISTERED = 'REGISTERED',
  DROPPED = 'DROPPED',
}

export interface IRegistrationEntry {
  readonly _id: string;
  readonly course: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly units: number;
  readonly type: RegistrationEntryType;
  readonly status: RegistrationEntryStatus;
  readonly source: string;
  readonly electiveGroup: string | null;
  readonly carriedFromSession: string | null;
  readonly note: string | null;
  readonly droppedReason: string | null;
}

export interface IUnplacedCarryOver {
  readonly course: string;
  readonly courseCode: string;
  readonly units: number;
  readonly failedInSession: string | null;
  readonly reason: string;
  readonly suggestions: string[];
}

export interface IRegistrationStudent {
  readonly _id: string;
  readonly fullName: string;
  readonly registrationNumber: string;
}

export interface ICourseRegistration {
  readonly _id: string;
  readonly student: IRegistrationStudent | string;
  readonly session: string;
  readonly semester: string;
  readonly level: string;
  readonly entries: IRegistrationEntry[];
  readonly totalUnits: number;
  readonly nonSiwesUnits: number;
  readonly status: RegistrationStatus;
  readonly overloadApproval: { approvedBy: string; approvedAt: string } | null;
  readonly unplacedCarryOvers: IUnplacedCarryOver[];
  readonly decisionTrace: string[];
  readonly createdAt: string;
}

export interface IRunReport {
  readonly batchId: string;
  readonly cohortSize: number;
  readonly registered: number;
  readonly pendingApproval: number;
  readonly needsAttention: number;
  readonly skippedExisting: number;
  readonly errors: string[];
}

export interface IOutstandingCarryOver {
  readonly courseId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly units: number;
  readonly courseSemester: string;
  readonly failedInSession: string;
  readonly failedInLevel: string;
  readonly attempts: number;
}

export interface IStudentCgpa {
  readonly cgpa: number | null;
  readonly totalUnits: number;
  readonly sessions: ReadonlyArray<{
    session: string;
    gpa: number;
    units: number;
  }>;
}

export interface ICurriculumEntry {
  readonly _id: string;
  readonly course: {
    _id: string;
    courseCode: string;
    courseTitle: string;
  };
  readonly units: number;
  readonly courseType: 'COMPULSORY' | 'ELECTIVE' | 'SIWES';
  readonly electiveGroup: string | null;
  readonly groupMinRequired: number | null;
  readonly level: string;
  readonly semester: string;
}

export interface ICurriculumImportReport {
  readonly rowsReceived: number;
  readonly entriesCreated: number;
  readonly entriesUpdated: number;
  readonly coursesCreated: number;
  readonly blockIssues: ReadonlyArray<{
    department: string;
    level: string;
    semester: string;
    issue: string;
  }>;
  readonly rowErrors: string[];
}

export interface IElectiveReview {
  readonly _id: string;
  readonly student: IRegistrationStudent | string;
  readonly courseCode: string;
  readonly units: number;
  readonly session: string;
  readonly level: string;
  readonly kind: 'FAILED' | 'LOW_GRADE';
  readonly grade: string;
  readonly total: number;
  readonly status: 'PENDING' | 'KEPT' | 'UNREGISTERED';
  readonly createdAt?: string;
  /** CGPA with the grade counted vs. projected if unregistered. */
  readonly currentCgpa?: number | null;
  readonly projectedCgpa?: number | null;
}
