import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { dashboardChallengeQueryPolicy, dashboardChallengeState } from './dashboard-challenge.ts';

test('a cached completed challenge stays hidden while the next challenge loads', () => {
  const data = { source: 'gemini' };
  assert.deepEqual(dashboardChallengeState({ data, isPending: false, isFetching: true, isError: false }), { loading: true, ready: false });
  assert.deepEqual(dashboardChallengeState({ data, isPending: false, isFetching: false, isError: false }), { loading: false, ready: true });
  assert.deepEqual(dashboardChallengeState({ data, isPending: false, isFetching: false, isError: true }), { loading: false, ready: false });
  assert.deepEqual(dashboardChallengeState({ isPending: true, isFetching: false, isError: false }), { loading: true, ready: false });
});

test('generation failures settle into retry state instead of inheriting automatic retries', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
  let requests = 0;
  const observer = new QueryObserver(client, {
    queryKey: ['failed-challenge'],
    ...dashboardChallengeQueryPolicy,
    queryFn: async () => { requests++; throw new Error('Generation unavailable'); },
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await client.getQueryCache().find({ queryKey: ['failed-challenge'] })?.promise?.catch(() => {});
    assert.equal(requests, 1);
    assert.equal(observer.getCurrentResult().isError, true);
    assert.deepEqual(dashboardChallengeState(observer.getCurrentResult()), { loading: false, ready: false });
  } finally {
    unsubscribe();
    client.clear();
  }
});

test('each dashboard mount fetches again despite a recently populated shared cache', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  const key = ['/api/generate-session'];
  client.setQueryData(key, { source: 'gemini', concept_id: 'completed' });
  let requests = 0;
  try {
    for (let visit = 1; visit <= 2; visit++) {
      let finish!: (value: { source: string; concept_id: string }) => void;
      const observer = new QueryObserver(client, {
        queryKey: key,
        ...dashboardChallengeQueryPolicy,
        queryFn: () => {
          requests++;
          return new Promise<{ source: string; concept_id: string }>(resolve => { finish = resolve; });
        },
      });
      const unsubscribe = observer.subscribe(() => {});
      try {
        assert.equal(requests, visit);
        assert.equal(dashboardChallengeState(observer.getCurrentResult()).ready, false);
        const fetched = client.getQueryCache().find({ queryKey: key })?.promise;
        assert.ok(fetched);
        finish({ source: 'gemini', concept_id: 'next' });
        await fetched;
        assert.equal(observer.getCurrentResult().data?.concept_id, 'next');
        assert.equal(dashboardChallengeState(observer.getCurrentResult()).ready, true);
      } finally {
        unsubscribe();
      }
    }
  } finally {
    client.clear();
  }
});