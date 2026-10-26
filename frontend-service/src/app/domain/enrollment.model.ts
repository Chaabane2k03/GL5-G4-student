export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED' | 'FAILED' | 'WITHDRAWN';

export const GRADE_SCALE = {
  MIN: 0,
  MAX: 20,
  PASSING: 10,
  STEP: 0.25,
} as const;

export interface Enrollment {
  id: number;
  enrollmentDate: string; // "yyyy-MM-dd"
  grade: number | null;
  status: EnrollmentStatus;
  studentId: number;
  courseId: number;
}

export interface EnrollmentCreateRequest {
  enrollmentDate: string;
  grade: number | null;
  status: EnrollmentStatus;
  studentId: number;
  courseId: number;
}

export interface EnrollmentUpdateRequest {
  idEnrollment: number;
  enrollmentDate: string;
  grade: number | null;
  status: EnrollmentStatus;
  studentId: number;
  courseId: number;
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: 'En cours',
  COMPLETED: 'Validée',
  FAILED: 'Échouée',
  DROPPED: 'Abandonnée',
  WITHDRAWN: 'Retrait administratif',
};
