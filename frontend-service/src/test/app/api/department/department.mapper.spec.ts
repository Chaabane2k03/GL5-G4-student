import { DepartmentDto } from '../../../../app/api/department/department.dto';
import {
  toDepartment,
  toDepartmentRequestDto,
} from '../../../../app/api/department/department.mapper';

describe('department.mapper', () => {
  it('maps idDepartment to id and trims request strings', () => {
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

    const request = toDepartmentRequestDto({
      name: '  Mathématiques  ',
      location: '  Bât B  ',
      phone: '  +216 71 870 002  ',
      head: '  Prof. Leila Bouazizi  ',
    });
    expect(request.name).toBe('Mathématiques');
    expect(request.location).toBe('Bât B');
  });
});
