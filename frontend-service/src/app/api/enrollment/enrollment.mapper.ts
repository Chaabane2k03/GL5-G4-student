import { Enrollment, EnrollmentCreateRequest, EnrollmentUpdateRequest } from '../../domain/enrollment.model';
import { EnrollmentCreateDto, EnrollmentResponseDto, EnrollmentUpdateDto } from './enrollment.dto';

export function toEnrollment(dto: EnrollmentResponseDto): Enrollment {
  return {
    id: dto.idEnrollment,
    enrollmentDate: dto.enrollmentDate,
    grade: typeof dto.grade === 'number' ? dto.grade : null,
    status: dto.status,
    studentId: dto.studentId,
    courseId: dto.courseId,
  };
}

export function toEnrollmentCreateDto(req: EnrollmentCreateRequest): EnrollmentCreateDto {
  return {
    enrollmentDate: req.enrollmentDate.trim(),
    grade: typeof req.grade === 'number' ? req.grade : null,
    status: req.status,
    studentId: Number(req.studentId),
    courseId: Number(req.courseId),
  };
}

export function toEnrollmentUpdateDto(req: EnrollmentUpdateRequest): EnrollmentUpdateDto {
  return {
    idEnrollment: req.idEnrollment,
    enrollmentDate: req.enrollmentDate.trim(),
    grade: typeof req.grade === 'number' ? req.grade : null,
    status: req.status,
    studentId: Number(req.studentId),
    courseId: Number(req.courseId),
  };
}
