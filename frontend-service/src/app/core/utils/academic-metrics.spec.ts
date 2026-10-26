import { Course } from '../../domain/course.model';
import { Enrollment } from '../../domain/enrollment.model';
import { Student } from '../../domain/student.model';
import {
  calculateDashboardAlerts,
  calculateInProgressCredits,
  calculateValidatedCredits,
  calculateWeightedAverage,
  getDepartmentColorIndex,
  getMentionLabel,
} from './academic-metrics';

describe('AcademicMetrics (Validated Credits, Weighted Average, Decanat Alerts)', () => {
  const courses: Course[] = [
    {
      id: 101,
      code: 'INF101',
      title: 'Algorithmique & Programmation',
      description: null,
      credits: 6,
      departmentId: 1,
      status: 'ACTIVE',
      createdAt: '2024-09-01T08:00:00',
      updatedAt: '2024-09-01T08:00:00',
    },
    {
      id: 102,
      code: 'MAT102',
      title: 'Algèbre Linéaire',
      description: null,
      credits: 6,
      departmentId: 2,
      status: 'ACTIVE',
      createdAt: '2024-09-01T08:00:00',
      updatedAt: '2024-09-01T08:00:00',
    },
    {
      id: 103,
      code: 'PHY201',
      title: 'Mécanique',
      description: null,
      credits: 4,
      departmentId: 3,
      status: 'ARCHIVED',
      createdAt: '2023-09-01T08:00:00',
      updatedAt: '2024-09-01T08:00:00',
    },
  ];

  const coursesMap = new Map<number, Course>(courses.map(c => [c.id, c]));

  it('calculateValidatedCredits should sum credits of COMPLETED enrollments only', () => {
    const enrollments: Enrollment[] = [
      { id: 1, studentId: 1, courseId: 101, grade: 16.5, status: 'COMPLETED', enrollmentDate: '2024-09-15' },
      { id: 2, studentId: 1, courseId: 102, grade: null, status: 'ACTIVE', enrollmentDate: '2024-10-01' },
    ];

    expect(calculateValidatedCredits(enrollments, coursesMap)).toBe(6);
  });

  it('calculateInProgressCredits should sum credits of ACTIVE enrollments only', () => {
    const enrollments: Enrollment[] = [
      { id: 1, studentId: 1, courseId: 101, grade: 16.5, status: 'COMPLETED', enrollmentDate: '2024-09-15' },
      { id: 2, studentId: 1, courseId: 102, grade: null, status: 'ACTIVE', enrollmentDate: '2024-10-01' },
    ];

    expect(calculateInProgressCredits(enrollments, coursesMap)).toBe(6);
  });

  it('calculateWeightedAverage should compute grade*credits / totalCredits on non-null grades', () => {
    const enrollments: Enrollment[] = [
      // 16.0 * 6 = 96
      { id: 1, studentId: 1, courseId: 101, grade: 16.0, status: 'COMPLETED', enrollmentDate: '2024-09-15' },
      // 12.0 * 6 = 72 -> Total points = 168 / 12 credits = 14.0
      { id: 2, studentId: 1, courseId: 102, grade: 12.0, status: 'COMPLETED', enrollmentDate: '2024-09-15' },
      // Grade null -> Ignored
      { id: 3, studentId: 1, courseId: 103, grade: null, status: 'ACTIVE', enrollmentDate: '2024-10-01' },
    ];

    expect(calculateWeightedAverage(enrollments, coursesMap)).toBe(14.0);
    expect(getMentionLabel(14.0)).toBe('Bien');
  });

  it('calculateDashboardAlerts should detect active courses with no enrollments, students with no enrollments, and archived courses with active enrollments', () => {
    const students: Student[] = [
      { id: 1, firstName: 'Ahmed', lastName: 'Ben Salah', email: 'ahmed@etudiant.tn', phone: '123', dateOfBirth: '2003-05-12', address: 'Tunis', departmentId: 1 },
      { id: 2, firstName: 'Yasmine', lastName: 'Trabelsi', email: 'yasmine@etudiant.tn', phone: '456', dateOfBirth: '2002-11-04', address: 'Tunis', departmentId: 2 },
    ];

    // Only student 1 is enrolled in course 103 (which is ARCHIVED and enrollment is ACTIVE)
    const enrollments: Enrollment[] = [
      { id: 1, studentId: 1, courseId: 103, grade: null, status: 'ACTIVE', enrollmentDate: '2024-10-01' },
    ];

    const alerts = calculateDashboardAlerts(courses, students, enrollments);

    // 1. Courses 101 & 102 have no enrollments (2 courses)
    const coursesAlert = alerts.find(a => a.type === 'COURSES_NO_ENROLLMENT');
    expect(coursesAlert).toBeDefined();
    expect(coursesAlert?.count).toBe(2);

    // 2. Student 2 has no enrollment
    const studentsAlert = alerts.find(a => a.type === 'STUDENTS_NO_ENROLLMENT');
    expect(studentsAlert).toBeDefined();
    expect(studentsAlert?.count).toBe(1);

    // 3. Course 103 is ARCHIVED with ACTIVE enrollment
    const archivedAlert = alerts.find(a => a.type === 'ARCHIVED_WITH_ACTIVE');
    expect(archivedAlert).toBeDefined();
    expect(archivedAlert?.count).toBe(1);
  });

  it('getDepartmentColorIndex should distribute indices 0 to 6 deterministically', () => {
    expect(getDepartmentColorIndex(0)).toBe(0);
    expect(getDepartmentColorIndex(1)).toBe(1);
    expect(getDepartmentColorIndex(7)).toBe(0);
    expect(getDepartmentColorIndex(13)).toBe(6);
  });
});
