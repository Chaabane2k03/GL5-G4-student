import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { StudentApi } from '../../../../app/api/student/student.api';
import { apiBaseUrl, studentDto, setupHttp } from '../api-test-harness';

describe('StudentApi', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

    let api: StudentApi;

    beforeEach(() => {
      api = TestBed.inject(StudentApi);
    });

    it('loads and maps students, including null payloads', async () => {
      const all = firstValueFrom(api.getAll());
      http.expectOne(`${apiBaseUrl}/student/students/getAllStudents`).flush([studentDto]);
      expect((await all)[0].id).toBe(1);

      const empty = firstValueFrom(api.getAll());
      http.expectOne(`${apiBaseUrl}/student/students/getAllStudents`).flush(null);
      expect(await empty).toEqual([]);
    });

    it('supports getById, create, update and delete', async () => {
      const byId = firstValueFrom(api.getById(1));
      http.expectOne(`${apiBaseUrl}/student/students/getStudent/1`).flush(studentDto);
      expect((await byId).firstName).toBe('Alice');

      const create = firstValueFrom(
        api.create({
          firstName: ' Alice ',
          lastName: ' Martin ',
          email: ' alice@example.com ',
          phone: ' 0612345678 ',
          dateOfBirth: ' 2004-01-01 ',
          address: ' 1 rue de Paris ',
          departmentId: 1,
        }),
      );
      const createRequest = http.expectOne(`${apiBaseUrl}/student/students/createStudent`);
      expect(createRequest.request.method).toBe('POST');
      expect(createRequest.request.body).toEqual({
        firstName: 'Alice',
        lastName: 'Martin',
        email: 'alice@example.com',
        phone: '0612345678',
        dateOfBirth: '2004-01-01',
        address: '1 rue de Paris',
        departmentId: 1,
      });
      createRequest.flush(studentDto);
      await create;

      const update = firstValueFrom(
        api.update({
          id: 1,
          firstName: 'Alice',
          lastName: 'Martin',
          email: 'alice@example.com',
          phone: '0612345678',
          dateOfBirth: '2004-01-01',
          address: '1 rue de Paris',
          departmentId: 1,
        }),
      );
      const updateRequest = http.expectOne(`${apiBaseUrl}/student/students/updateStudent`);
      expect(updateRequest.request.method).toBe('PUT');
      updateRequest.flush(studentDto);
      await update;

      const remove = firstValueFrom(api.delete(1));
      const deleteRequest = http.expectOne(`${apiBaseUrl}/student/students/deleteStudent/1`);
      expect(deleteRequest.request.method).toBe('DELETE');
      deleteRequest.flush(null);
      await remove;
    });
});
