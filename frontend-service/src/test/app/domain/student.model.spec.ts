import { Student, getStudentFullName, getStudentInitials, getStudentMatricule } from '../../../app/domain/student.model';

describe('Student Model utilities', () => {
  const sampleStudent: Student = {
    id: 42,
    firstName: 'Marie',
    lastName: 'Curie',
    email: 'marie.curie@univ.tn',
    phone: '21612345678',
    dateOfBirth: '2001-11-07',
    address: 'Tunis',
    departmentId: 1,
  };

  it('generates matricule with year of birth and padded id', () => {
    expect(getStudentMatricule(sampleStudent)).toBe('MAT-2001-0042');
  });

  it('generates matricule with default 2024 year when dateOfBirth is missing', () => {
    const studentNoDob = { ...sampleStudent, id: 9, dateOfBirth: '' };
    expect(getStudentMatricule(studentNoDob)).toBe('MAT-2024-0009');
  });

  it('formats student full name', () => {
    expect(getStudentFullName(sampleStudent)).toBe('Marie Curie');
    expect(getStudentFullName({ ...sampleStudent, firstName: '  Alan  ', lastName: 'Turing  ' })).toBe('Alan   Turing');
  });

  it('extracts student initials', () => {
    expect(getStudentInitials(sampleStudent)).toBe('MC');
  });

  it('falls back to ET when initials cannot be formed', () => {
    expect(getStudentInitials({ ...sampleStudent, firstName: '', lastName: '' })).toBe('ET');
  });
});
