import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { EnrollmentApi } from '../../../../app/api/enrollment/enrollment.api';
import { apiBaseUrl, enrollmentDto, setupHttp } from '../api-test-harness';

describe('EnrollmentApi', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

    let api: EnrollmentApi;

    beforeEach(() => {
      api = TestBed.inject(EnrollmentApi);
    });

    it('loads enrollments by every supported route', async () => {
      const all = firstValueFrom(api.getAll());
      http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/getAllEnrollment`).flush([enrollmentDto]);
      expect((await all)[0].id).toBe(1);

      const empty = firstValueFrom(api.getAll());
      http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/getAllEnrollment`).flush(null);
      expect(await empty).toEqual([]);

      const byId = firstValueFrom(api.getById(1));
      http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/getEnrollment/1`).flush(enrollmentDto);
      expect((await byId).grade).toBe(12);

      const byStudent = firstValueFrom(api.getByStudentId(1));
      http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/student/1`).flush([enrollmentDto]);
      expect((await byStudent).length).toBe(1);

      const byCourse = firstValueFrom(api.getByCourseId(10));
      http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/course/10`).flush([enrollmentDto]);
      expect((await byCourse).length).toBe(1);
    });

    it('supports create, update and delete', async () => {
      const create = firstValueFrom(
        api.create({
          enrollmentDate: ' 2025-01-01 ',
          grade: 12,
          status: 'ACTIVE',
          studentId: 1,
          courseId: 10,
        }),
      );
      const createRequest = http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/createEnrollment`);
      expect(createRequest.request.method).toBe('POST');
      expect(createRequest.request.body).toEqual({
        enrollmentDate: '2025-01-01',
        grade: 12,
        status: 'ACTIVE',
        studentId: 1,
        courseId: 10,
      });
      createRequest.flush(1);
      expect(await create).toBe(1);

      const update = firstValueFrom(
        api.update({
          idEnrollment: 1,
          enrollmentDate: '2025-01-01',
          grade: null,
          status: 'COMPLETED',
          studentId: 1,
          courseId: 10,
        }),
      );
      const updateRequest = http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/updateEnrollment`);
      expect(updateRequest.request.method).toBe('PUT');
      updateRequest.flush(null);
      await update;

      const remove = firstValueFrom(api.delete(1));
      const deleteRequest = http.expectOne(`${apiBaseUrl}/enrollment/Enrollment/deleteEnrollment/1`);
      expect(deleteRequest.request.method).toBe('DELETE');
      deleteRequest.flush(null);
      await remove;
    });
});
