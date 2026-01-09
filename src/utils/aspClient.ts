import { getConfig } from '~/config';
import { MtRootResponse, PoolResponse, MtLeavesResponse, DepositsByLabelResponse, AllEventsResponse } from '~/types';

const {
  constants: { ITEMS_PER_PAGE },
} = getConfig();

const SCOPE_HEADER = 'X-Pool-Scope';

const fetchWithHeaders = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);

  if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
  return response.json();
};

const aspClient = {
  fetchPoolInfo: (aspUrl: string, chainId: string, scope: string) =>
    fetchWithHeaders<PoolResponse>(`${aspUrl}/${chainId}/public/pool-info`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),

  fetchAllEvents: (aspUrl: string, chainId: string, scope: string, page = 1, perPage = ITEMS_PER_PAGE) =>
    fetchWithHeaders<AllEventsResponse>(`${aspUrl}/${chainId}/public/events?page=${page}&perPage=${perPage}`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),

  fetchDepositsByLabel: (aspUrl: string, chainId: string, scope: string, labels: string[]) =>
    fetchWithHeaders<DepositsByLabelResponse>(`${aspUrl}/${chainId}/public/deposits-by-label`, {
      headers: {
        [SCOPE_HEADER]: scope,
        'X-Labels': labels.join(','),
      },
    }),

  fetchDepositsByLabelAndScope: (aspUrl: string, chainId: string, depositsGroupedByScope: Record<string, string[]>) =>
    fetchWithHeaders<Record<string, DepositsByLabelResponse>>(`${aspUrl}/${chainId}/public/deposits-by-label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(depositsGroupedByScope),
    }),

  fetchMtRoots: (aspUrl: string, chainId: string, scope: string) =>
    fetchWithHeaders<MtRootResponse>(`${aspUrl}/${chainId}/public/mt-roots`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),

  fetchMtLeaves: (aspUrl: string, chainId: string, scope: string) =>
    fetchWithHeaders<MtLeavesResponse>(`${aspUrl}/${chainId}/public/mt-leaves`, {
      headers: {
        [SCOPE_HEADER]: scope,
      },
    }),
};

export { aspClient };
