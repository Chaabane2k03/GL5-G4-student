import { StudentDto } from '../../../../app/api/student/student.dto';
import {
  toStudent,
  toStudentCreateDto,
  toStudentUpdateDto,
} from '../../../../app/api/student/student.mapper';

describe('student.mapper', () => {
  it('maps idStudent to id, preserves dates and trims create fields', () => {
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
});
