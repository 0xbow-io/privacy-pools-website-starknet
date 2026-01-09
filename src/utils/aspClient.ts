import { getConfig } from '~/config';
import { MtRootResponse, PoolResponse, MtLeavesResponse, DepositsByLabelResponse, AllEventsResponse } from '~/types';

const {
  constants: { ITEMS_PER_PAGE },
} = getConfig();

const SCOPE_HEADER = 'X-Pool-Scope';

const fetchJWT = async (): Promise<string> => {
  const response = await fetch('/api/token');
  if (!response.ok) throw new Error('Failed to get token');
  const { token } = await response.json();
  return token;
};

const fetchPublic = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);

  if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
  return response.json();
};

const fetchPrivate = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const token = await fetchJWT();

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
  return response.json();
};

const aspClient = {
  fetchPoolInfo: (aspUrl: string, chainId: string, scope: string) =>
    fetchPublic<PoolResponse>(`${aspUrl}/${chainId}/public/pool-info`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),

  fetchAllEvents: (aspUrl: string, chainId: string, scope: string, page = 1, perPage = ITEMS_PER_PAGE) =>
    fetchPrivate<AllEventsResponse>(`${aspUrl}/${chainId}/private/events?page=${page}&perPage=${perPage}`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),

  fetchDepositsByLabel: (aspUrl: string, chainId: string, scope: string, labels: string[]) =>
    fetchPrivate<DepositsByLabelResponse>(`${aspUrl}/${chainId}/private/deposits`, {
      headers: {
        [SCOPE_HEADER]: scope,
        'X-Labels': labels.join(','),
      },
    }),

  fetchDepositsByLabelAndScope: (aspUrl: string, chainId: string, depositsGroupedByScope: Record<string, string[]>) =>
    fetchPrivate<Record<string, DepositsByLabelResponse>>(`${aspUrl}/${chainId}/private/deposits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(depositsGroupedByScope),
    }),

  fetchMtRoots: (aspUrl: string, chainId: string, scope: string) =>
    fetchPublic<MtRootResponse>(`${aspUrl}/${chainId}/public/mt-roots`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),

  fetchMtLeaves: (aspUrl: string, chainId: string, scope: string) =>
    fetchPrivate<MtLeavesResponse>(`${aspUrl}/${chainId}/public/mt-leaves`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),
};

export { aspClient };
