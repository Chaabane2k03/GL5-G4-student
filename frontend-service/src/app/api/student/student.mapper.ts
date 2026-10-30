import { Student, StudentCreateRequest, StudentUpdateRequest } from '../../domain/student.model';
import { StudentCreateDto, StudentDto, StudentUpdateDto } from './student.dto';

export function toStudent(dto: StudentDto): Student {
  return {
    id: dto.idStudent,
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    phone: dto.phone,
    dateOfBirth: dto.dateOfBirth,
    address: dto.address,
    departmentId: dto.departmentId,
  };
}

export function toStudentCreateDto(req: StudentCreateRequest): StudentCreateDto {
  return {
    firstName: req.firstName.trim(),
    lastName: req.lastName.trim(),
    email: req.email.trim(),
    phone: req.phone.trim(),
    dateOfBirth: req.dateOfBirth.trim(),
    address: req.address.trim(),
    departmentId: Number(req.departmentId),
  };
}

export function toStudentUpdateDto(req: StudentUpdateRequest): StudentUpdateDto {
  return {
    idStudent: req.id,
    firstName: req.firstName.trim(),
    lastName: req.lastName.trim(),
    email: req.email.trim(),
    phone: req.phone.trim(),
    dateOfBirth: req.dateOfBirth.trim(),
    address: req.address.trim(),
    departmentId: Number(req.departmentId),
  };
}
