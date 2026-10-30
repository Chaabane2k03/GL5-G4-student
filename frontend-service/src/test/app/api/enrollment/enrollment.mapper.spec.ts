import {
  EnrollmentCreateDto,
  EnrollmentResponseDto,
  EnrollmentUpdateDto,
} from '../../../../app/api/enrollment/enrollment.dto';
import {
  toEnrollment,
  toEnrollmentCreateDto,
  toEnrollmentUpdateDto,
} from '../../../../app/api/enrollment/enrollment.mapper';

describe('enrollment.mapper', () => {
  it('maps idEnrollment to id and supports a null grade', () => {
    const dto: EnrollmentResponseDto = {
      idEnrollment: 55,
      enrollmentDate: '2024-09-22',
      grade: null,
      status: 'ACTIVE',
      studentId: 12,
      courseId: 34,
    };

    expect(toEnrollment(dto).id).toBe(55);
    expect(toEnrollment(dto).grade).toBeNull();
  });

  it('trims the create date and preserves numeric grades', () => {
    const dto = toEnrollmentCreateDto({
      enrollmentDate: ' 2024-09-22 ',
      grade: 15.5,
      status: 'COMPLETED',
      studentId: 12,
      courseId: 34,
    });

    expect(dto.enrollmentDate).toBe('2024-09-22');
    expect(dto.grade).toBe(15.5);
  });

  it('maps the update identifier and grade', () => {
    const dto = toEnrollmentUpdateDto({
      idEnrollment: 55,
      enrollmentDate: '2024-09-22',
      grade: 18,
      status: 'COMPLETED',
      studentId: 12,
      courseId: 34,
    });

    expect(dto.idEnrollment).toBe(55);
    expect(dto.grade).toBe(18);
  });

  it('keeps a numeric response grade', () => {
    const dto: EnrollmentResponseDto = {
      idEnrollment: 1,
      enrollmentDate: '2025-01-01',
      grade: 14,
      status: 'ACTIVE',
      studentId: 1,
      courseId: 1,
    };

    expect(toEnrollment(dto).grade).toBe(14);
  });

  it('keeps a numeric create grade', () => {
    const dto: EnrollmentCreateDto = {
      enrollmentDate: '2025-01-01',
      grade: 15,
      status: 'ACTIVE',
      studentId: 1,
      courseId: 1,
    };

    expect(toEnrollmentCreateDto(dto).grade).toBe(15);
  });

  it('maps a null update grade to null', () => {
    const dto: EnrollmentUpdateDto = {
      idEnrollment: 1,
      enrollmentDate: '2025-01-01',
      grade: null,
      status: 'ACTIVE',
      studentId: 1,
      courseId: 1,
    };

    expect(toEnrollmentUpdateDto(dto).grade).toBeNull();
  });
});
