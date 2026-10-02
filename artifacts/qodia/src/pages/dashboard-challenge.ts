// Dashboard visits must consult the server, even when another page populated
// the shared lesson cache less than a minute ago.
export const dashboardChallengeQueryPolicy = {
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
  retry: false,
};

export function dashboardChallengeState(query: {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  data?: { source?: string };
}) {
  const loading = query.isPending || query.isFetching;
  const ready = !loading && !query.isError && query.data?.source === 'gemini';
  return { loading, ready };
}