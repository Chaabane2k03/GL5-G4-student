import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from '../../../app/core/config/runtime-config';
import { CourseResponseDto, PageResponseDto } from '../../../app/api/course/course.dto';
import { DepartmentDto } from '../../../app/api/department/department.dto';
import { EnrollmentResponseDto } from '../../../app/api/enrollment/enrollment.dto';
import { StudentDto } from '../../../app/api/student/student.dto';

export const apiBaseUrl = 'http://gateway.test';

export const courseDto: CourseResponseDto = {
  id: 10,
  code: 'INF101',
  title: 'Algorithmique',
  description: 'Cours',
  credits: 6,
  departmentId: 1,
  status: 'ACTIVE',
  createdAt: '2025-09-01T10:00:00',
  updatedAt: '2025-09-01T10:00:00',
};

export const coursePage: PageResponseDto<CourseResponseDto> = {
  content: [courseDto],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

export const departmentDto: DepartmentDto = {
  idDepartment: 1,
  name: 'Informatique',
  location: 'Batiment A',
  phone: '0102030405',
  head: 'Dr Martin',
};

export const studentDto: StudentDto = {
  idStudent: 1,
  firstName: 'Alice',
  lastName: 'Martin',
  email: 'alice@example.com',
  phone: '0612345678',
  dateOfBirth: '2004-01-01',
  address: '1 rue de Paris',
  departmentId: 1,
};

export const enrollmentDto: EnrollmentResponseDto = {
  idEnrollment: 1,
  enrollmentDate: '2025-01-01',
  grade: 12,
  status: 'ACTIVE',
  studentId: 1,
  courseId: 10,
};

export function setupHttp(): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigService, useValue: { apiBaseUrl } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}
