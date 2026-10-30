import { Department, DepartmentCreateRequest, DepartmentUpdateRequest } from '../../domain/department.model';
import { DepartmentDto, DepartmentRequestDto } from './department.dto';

export function toDepartment(dto: DepartmentDto): Department {
  return {
    id: dto.idDepartment,
    name: dto.name,
    location: dto.location,
    phone: dto.phone,
    head: dto.head,
  };
}

export function toDepartmentRequestDto(
  req: DepartmentCreateRequest | DepartmentUpdateRequest,
): DepartmentRequestDto {
  return {
    name: req.name.trim(),
    location: req.location.trim(),
    phone: req.phone.trim(),
    head: req.head.trim(),
  };
}
