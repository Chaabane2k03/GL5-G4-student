import { CourseResponseDto, PageResponseDto } from '../../../../app/api/course/course.dto';
import {
  toCourse,
  toCoursePageResponse,
  toCourseRequestDto,
} from '../../../../app/api/course/course.mapper';

describe('course.mapper', () => {
  it('maps id, null description and a page response', () => {
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

    expect(toCourse(dto).id).toBe(10);
    expect(toCourse(dto).description).toBeNull();

    const pageDto: PageResponseDto<CourseResponseDto> = {
      content: [dto],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    };
    const page = toCoursePageResponse(pageDto);
    expect(page.content.length).toBe(1);
    expect(page.content[0].id).toBe(10);
  });

  it('normalises the course code and trims the description', () => {
    const dto = toCourseRequestDto({
      code: ' inf204 ',
      title: ' Bases de données ',
      description: '   ',
      credits: 5,
      departmentId: 1,
    });

    expect(dto.code).toBe('INF204');
    expect(dto.description).toBeNull();
  });

  it('treats an undefined description as null', () => {
    const dto = {
      id: 1,
      code: 'A',
      title: 'B',
      description: undefined,
      credits: 3,
      departmentId: 1,
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    } as unknown as CourseResponseDto;

    expect(toCourse(dto).description).toBeNull();
  });

  it('preserves a defined description', () => {
    const dto = {
      id: 1,
      code: 'A',
      title: 'B',
      description: 'Some desc',
      credits: 3,
      departmentId: 1,
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    } as unknown as CourseResponseDto;

    expect(toCourse(dto).description).toBe('Some desc');
  });

  it('maps an empty description to null and trims a non-empty description', () => {
    expect(
      toCourseRequestDto({
        code: 'AB',
        title: 'Test',
        description: '',
        credits: 3,
        departmentId: 1,
      }).description,
    ).toBeNull();

    expect(
      toCourseRequestDto({
        code: 'AB',
        title: 'Test',
        description: '  desc  ',
        credits: 3,
        departmentId: 1,
      }).description,
    ).toBe('desc');
  });
});
