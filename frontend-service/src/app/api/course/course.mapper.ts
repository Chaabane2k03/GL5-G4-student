import { Course, CourseRequest, PageResponse } from '../../domain/course.model';
import { CourseRequestDto, CourseResponseDto, PageResponseDto } from './course.dto';

export function toCourse(dto: CourseResponseDto): Course {
  return {
    id: dto.id,
    code: dto.code,
    title: dto.title,
    description: dto.description ?? null,
    credits: dto.credits,
    departmentId: dto.departmentId,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function toCourseRequestDto(req: CourseRequest): CourseRequestDto {
  return {
    code: req.code.trim().toUpperCase(),
    title: req.title.trim(),
    description: req.description?.trim() || null,
    credits: Number(req.credits),
    departmentId: Number(req.departmentId),
  };
}

export function toCoursePageResponse(dto: PageResponseDto<CourseResponseDto>): PageResponse<Course> {
  return {
    content: (dto.content || []).map(toCourse),
    page: dto.page,
    size: dto.size,
    totalElements: dto.totalElements,
    totalPages: dto.totalPages,
    first: dto.first,
    last: dto.last,
  };
}
