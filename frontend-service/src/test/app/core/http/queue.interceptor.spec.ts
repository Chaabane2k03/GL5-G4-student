import { HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { queueInterceptor, RequestQueueService } from '../../../../app/core/http/queue.interceptor';

describe('RequestQueueService', () => {
  let service: RequestQueueService;

  beforeEach(() => {
    service = new RequestQueueService();
  });

  it('starts requests immediately while capacity is available', async () => {
    const stream = new Subject<number>();
    const result = firstValueFrom(service.execute(() => stream));

    stream.next(1);
    stream.complete();

    expect(await result).toBe(1);
  });

  it('queues requests beyond four concurrent calls and releases them on completion', async () => {
    const starts: number[] = [];
    const streams = Array.from({ length: 5 }, () => new Subject<number>());
    const results = streams.map((stream, index) =>
      firstValueFrom(
        service.execute(() => {
          starts.push(index);
          return stream;
        }),
      ),
    );

    expect(starts).toEqual([0, 1, 2, 3]);

    streams[0].next(0);
    streams[0].complete();
    await Promise.resolve();

    expect(starts).toEqual([0, 1, 2, 3, 4]);

    for (let index = 1; index < streams.length; index++) {
      streams[index].next(index);
      streams[index].complete();
    }

    await Promise.all(results);
  });

  it('removes a cancelled request from the queue without consuming a slot', async () => {
    const starts: number[] = [];
    const streams = Array.from({ length: 4 }, () => new Subject<number>());
    const active = streams.map((stream, index) =>
      service.execute(() => {
        starts.push(index);
        return stream;
      }).subscribe(),
    );

    const queued = service
      .execute(() => {
        starts.push(4);
        return new Subject<number>();
      })
      .subscribe();

    expect(starts).toEqual([0, 1, 2, 3]);
    queued.unsubscribe();

    const replacement = service
      .execute(() => {
        starts.push(5);
        return new Subject<number>();
      })
      .subscribe();

    expect(starts).toEqual([0, 1, 2, 3]);

    active[0].unsubscribe();
    await Promise.resolve();

    expect(starts).toEqual([0, 1, 2, 3, 5]);

    replacement.unsubscribe();
    active.slice(1).forEach(subscription => subscription.unsubscribe());
  });

  it('releases a queued slot when a request fails', async () => {
    const starts: number[] = [];
    const failure = firstValueFrom(
      service.execute(() => {
        starts.push(0);
        return throwError(() => new Error('boom'));
      }),
    );

    await expectAsync(failure).toBeRejectedWithError('boom');

    const success = firstValueFrom(
      service.execute(() => {
        starts.push(1);
        return new Subject<number>();
      }),
    );

    expect(starts).toEqual([0, 1]);
    expect(success).toBeDefined();
  });
});

describe('queueInterceptor', () => {
  it('delegates execution to RequestQueueService', async () => {
    const fakeQueueService = {
      execute: jasmine.createSpy('execute').and.callFake((fn: () => unknown) => fn()),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RequestQueueService, useValue: fakeQueueService },
      ],
    });

    await TestBed.runInInjectionContext(async () => {
      const dummyReq = new HttpRequest('GET', '/api/test');
      const dummyResponse = new HttpResponse({ status: 200 });
      const nextFn = jasmine.createSpy('next').and.returnValue(of(dummyResponse));

      const res = await firstValueFrom(queueInterceptor(dummyReq, nextFn));
      expect(fakeQueueService.execute).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledWith(dummyReq);
      expect(res).toBe(dummyResponse);
    });
  });
});
