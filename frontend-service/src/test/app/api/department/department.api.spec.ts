import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DepartmentApi } from '../../../../app/api/department/department.api';
import { apiBaseUrl, departmentDto, setupHttp } from '../api-test-harness';

describe('DepartmentApi', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

    let api: DepartmentApi;

    beforeEach(() => {
      api = TestBed.inject(DepartmentApi);
    });

    it('loads and maps departments, including null payloads', async () => {
      const all = firstValueFrom(api.getAll());
      http.expectOne(`${apiBaseUrl}/department/api/departments`).flush([departmentDto]);
      expect((await all)[0].id).toBe(1);

      const empty = firstValueFrom(api.getAll());
      http.expectOne(`${apiBaseUrl}/department/api/departments`).flush(null);
      expect(await empty).toEqual([]);
    });

    it('supports getById, create, update and delete', async () => {
      const byId = firstValueFrom(api.getById(1));
      http.expectOne(`${apiBaseUrl}/department/api/departments/1`).flush(departmentDto);
      expect((await byId).name).toBe('Informatique');

      const create = firstValueFrom(
        api.create({
          name: ' Informatique ',
          location: ' Batiment A ',
          phone: ' 0102030405 ',
          head: ' Dr Martin ',
        }),
      );
      const createRequest = http.expectOne(`${apiBaseUrl}/department/api/departments`);
      expect(createRequest.request.method).toBe('POST');
      expect(createRequest.request.body).toEqual({
        name: 'Informatique',
        location: 'Batiment A',
        phone: '0102030405',
        head: 'Dr Martin',
      });
      createRequest.flush(departmentDto);
      await create;

      const update = firstValueFrom(
        api.update(1, {
          name: 'Informatique',
          location: 'Batiment A',
          phone: '0102030405',
          head: 'Dr Martin',
        }),
      );
      const updateRequest = http.expectOne(`${apiBaseUrl}/department/api/departments/1`);
      expect(updateRequest.request.method).toBe('PUT');
      updateRequest.flush(departmentDto);
      await update;

      const remove = firstValueFrom(api.delete(1));
      const deleteRequest = http.expectOne(`${apiBaseUrl}/department/api/departments/1`);
      expect(deleteRequest.request.method).toBe('DELETE');
      deleteRequest.flush(null);
      await remove;
    });
});
