import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CourseApi } from '../../../../app/api/course/course.api';
import { apiBaseUrl, courseDto, coursePage, setupHttp } from '../api-test-harness';

describe('CourseApi', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

    let api: CourseApi;

    beforeEach(() => {
      api = TestBed.inject(CourseApi);
    });

    it('loads a page with default pagination and maps the response', async () => {
      const result = firstValueFrom(api.getPage());

      const request = http.expectOne(`${apiBaseUrl}/course/api/courses?page=0&size=20`);
      expect(request.request.method).toBe('GET');
      request.flush(coursePage);

      const page = await result;
      expect(page.content[0].id).toBe(10);
      expect(page.content[0].description).toBe('Cours');
      expect(page.totalElements).toBe(1);
    });

    it('sends every optional course filter', async () => {
      const result = firstValueFrom(
        api.getPage({
          page: 2,
          size: 50,
          sort: 'title,desc',
          departmentId: 3,
          status: 'ARCHIVED',
        }),
      );

      const request = http.expectOne(
        `${apiBaseUrl}/course/api/courses?page=2&size=50&sort=title,desc&departmentId=3&status=ARCHIVED`,
      );
      request.flush(coursePage);
      const res = await result;
      expect(res.content.length).toBe(1);
    });

    it('supports getById, create, update, archive and activate', async () => {
      const byId = firstValueFrom(api.getById(10));
      http.expectOne(`${apiBaseUrl}/course/api/courses/10`).flush(courseDto);
      expect((await byId).code).toBe('INF101');

      const create = firstValueFrom(
        api.create({
          code: ' inf101 ',
          title: ' Algorithmique ',
          description: ' Cours ',
          credits: 6,
          departmentId: 1,
        }),
      );
      const createRequest = http.expectOne(`${apiBaseUrl}/course/api/courses`);
      expect(createRequest.request.method).toBe('POST');
      expect(createRequest.request.body).toEqual({
        code: 'INF101',
        title: 'Algorithmique',
        description: 'Cours',
        credits: 6,
        departmentId: 1,
      });
      createRequest.flush(courseDto);
      await create;

      const update = firstValueFrom(
        api.update(10, {
          code: 'INF101',
          title: 'Algorithmique avancee',
          description: null,
          credits: 6,
          departmentId: 1,
        }),
      );
      const updateRequest = http.expectOne(`${apiBaseUrl}/course/api/courses/10`);
      expect(updateRequest.request.method).toBe('PUT');
      updateRequest.flush(courseDto);
      await update;

      const archive = firstValueFrom(api.archive(10));
      const archiveRequest = http.expectOne(`${apiBaseUrl}/course/api/courses/10`);
      expect(archiveRequest.request.method).toBe('DELETE');
      archiveRequest.flush(null);
      await archive;

      const activate = firstValueFrom(api.activate(10));
      const activateRequest = http.expectOne(`${apiBaseUrl}/course/api/courses/10/activate`);
      expect(activateRequest.request.method).toBe('PATCH');
      activateRequest.flush(courseDto);
      expect((await activate).id).toBe(10);
    });

    it('loads the complete catalogue across pages', async () => {
      const result = firstValueFrom(api.getAllCatalog());

      const first = http.expectOne(`${apiBaseUrl}/course/api/courses?page=0&size=100&sort=code,asc`);
      first.flush({ ...coursePage, last: false, page: 0 });

      const second = http.expectOne(`${apiBaseUrl}/course/api/courses?page=1&size=100&sort=code,asc`);
      second.flush({ ...coursePage, content: [{ ...courseDto, id: 11 }], page: 1, last: true });

      const courses = await result;
      expect(courses.map(course => course.id)).toEqual([10, 11]);
    });

    it('stops catalogue pagination when a page is empty', async () => {
      const result = firstValueFrom(api.getAllCatalog());

      const first = http.expectOne(`${apiBaseUrl}/course/api/courses?page=0&size=100&sort=code,asc`);
      first.flush({ ...coursePage, content: [], last: false, page: 0 });

      expect(await result).toEqual([]);
    });
});
