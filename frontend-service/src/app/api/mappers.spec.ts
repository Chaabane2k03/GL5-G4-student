import { toDepartment, toDepartmentRequestDto } from './department/department.mapper';
import { toStudent, toStudentCreateDto, toStudentUpdateDto } from './student/student.mapper';
import { toCourse, toCoursePageResponse, toCourseRequestDto } from './course/course.mapper';
import { toEnrollment, toEnrollmentCreateDto, toEnrollmentUpdateDto } from './enrollment/enrollment.mapper';
import { DepartmentDto } from './department/department.dto';
import { StudentDto } from './student/student.dto';
import { CourseResponseDto, PageResponseDto } from './course/course.dto';
import { EnrollmentResponseDto } from './enrollment/enrollment.dto';

describe('Api Mappers (Mapping DTOs to Clean Domain Models with plain id)', () => {
  it('Department mapper should map idDepartment to id and clean strings', () => {
    const dto: DepartmentDto = {
      idDepartment: 42,
      name: '  Informatique  ',
      location: '  Bâtiment A  ',
      phone: '  +216 71 870 001  ',
      head: '  Prof. Mohamed Ali  ',
    };
    const domain = toDepartment(dto);
    expect(domain.id).toBe(42);
    expect(domain.name).toBe('  Informatique  ');

    const reqDto = toDepartmentRequestDto({
      name: '  Mathématiques  ',
      location: '  Bât B  ',
      phone: '  +216 71 870 002  ',
      head: '  Prof. Leila Bouazizi  ',
    });
    expect(reqDto.name).toBe('Mathématiques');
    expect(reqDto.location).toBe('Bât B');
  });

  it('Student mapper should map idStudent to id and preserve yyyy-MM-dd date', () => {
    const dto: StudentDto = {
      idStudent: 99,
      firstName: 'Ahmed',
      lastName: 'Ben Salah',
      email: 'ahmed@etudiant.tn',
      phone: '+216 98 123 456',
      dateOfBirth: '2003-05-12',
      address: 'Tunis',
      departmentId: 1,
    };
    const domain = toStudent(dto);
    expect(domain.id).toBe(99);
    expect(domain.dateOfBirth).toBe('2003-05-12');

    const createDto = toStudentCreateDto({
      firstName: '  Ahmed ',
      lastName: ' Ben Salah ',
      email: ' ahmed@etudiant.tn ',
      phone: ' 123 ',
      dateOfBirth: ' 2003-05-12 ',
      address: ' Tunis ',
      departmentId: 1,
    });
    expect(createDto.firstName).toBe('Ahmed');
    expect(createDto.departmentId).toBe(1);

    const updateDto = toStudentUpdateDto({
      id: 99,
      firstName: 'Ahmed',
      lastName: 'Ben Salah',
      email: 'ahmed@etudiant.tn',
      phone: '123',
      dateOfBirth: '2003-05-12',
      address: 'Tunis',
      departmentId: 1,
    });
    expect(updateDto.idStudent).toBe(99);
  });

  it('Course mapper should uppercase code and handle PageResponse', () => {
    const dto: CourseResponseDto = {
      id: 10,
      code: 'INF101',
      title: 'Algorithmique',
      description: null,
      credits: 6,
      departmentId: 1,
      status: 'ACTIVE',
      createdAt: '2024-09-01T10:00:00',
      updatedAt: '2024-09-01T10:00:00',
    };
    const domain = toCourse(dto);
    expect(domain.id).toBe(10);
    expect(domain.description).toBeNull();

    const reqDto = toCourseRequestDto({
      code: ' inf204 ',
      title: ' Bases de données ',
      description: '   ',
      credits: 5,
      departmentId: 1,
    });
    expect(reqDto.code).toBe('INF204');
    expect(reqDto.description).toBeNull();

    const pageDto: PageResponseDto<CourseResponseDto> = {
      content: [dto],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    };
    const pageDomain = toCoursePageResponse(pageDto);
    expect(pageDomain.content.length).toBe(1);
    expect(pageDomain.content[0].id).toBe(10);
  });

  it('Enrollment mapper should map idEnrollment to id and support null grade', () => {
    const dto: EnrollmentResponseDto = {
      idEnrollment: 55,
      enrollmentDate: '2024-09-22',
      grade: null,
      status: 'ACTIVE',
      studentId: 12,
      courseId: 34,
    };
    const domain = toEnrollment(dto);
    expect(domain.id).toBe(55);
    expect(domain.grade).toBeNull();

    const createDto = toEnrollmentCreateDto({
      enrollmentDate: ' 2024-09-22 ',
      grade: 15.5,
      status: 'COMPLETED',
      studentId: 12,
      courseId: 34,
    });
    expect(createDto.enrollmentDate).toBe('2024-09-22');
    expect(createDto.grade).toBe(15.5);

    const updateDto = toEnrollmentUpdateDto({
      idEnrollment: 55,
      enrollmentDate: '2024-09-22',
      grade: 18.0,
      status: 'COMPLETED',
      studentId: 12,
      courseId: 34,
    });
    expect(updateDto.idEnrollment).toBe(55);
    expect(updateDto.grade).toBe(18.0);
  });
});
