import { EnrollmentStatus } from '../../domain/enrollment.model';

export interface EnrollmentResponseDto {
  idEnrollment: number;
  enrollmentDate: string; // "yyyy-MM-dd"
  grade: number | null;
  status: EnrollmentStatus;
  studentId: number;
  courseId: number;
}

export interface EnrollmentCreateDto {
  enrollmentDate: string;
  grade: number | null;
  status: EnrollmentStatus;
  studentId: number;
  courseId: number;
}

export interface EnrollmentUpdateDto {
  idEnrollment: number;
  enrollmentDate: string;
  grade: number | null;
  status: EnrollmentStatus;
  studentId: number;
  courseId: number;
}
