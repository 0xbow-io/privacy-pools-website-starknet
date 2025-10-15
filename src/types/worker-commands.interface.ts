import {
  AccountCommitment,
  PrivacyPoolStarknetSDK,
  StarknetAddress,
  WithdrawalProofInput,
} from '@fatsolutions/privacy-pools-core-starknet-sdk';
import { AssetConfig } from 'node_modules/@fatsolutions/privacy-pools-core-starknet-sdk/dist/types/entrypoint';
import { Call } from 'starknet';
import { ChainData as ChainDictionary, CompletePoolInfo, PoolInfo } from '~/config';
import {
  addPoolAccount,
  addRagequit,
  addWithdrawal,
  createDepositSecrets,
  createWithdrawalSecrets,
  getPoolAccountsFromAccount,
  rageQuit,
  RageQuitData,
  waitForEvents,
} from '~/utils';

type ChainData = ChainDictionary[string];
type MinimalChainData = Pick<ChainData, 'rpcUrl'>;

export interface AccountRetrievalData {
  seed: string;
  chain: MinimalChainData;
}

export interface ContractRetrievalData {
  chain: MinimalChainData;
  entryPoint: StarknetAddress;
}

export interface ZKProofWorkerMessage {
  type: 'generateRagequitProof' | 'generateWithdrawalProof' | 'verifyWithdrawalProof';
  payload: unknown;
  id: string;
}

export interface ZKProofWorkerResponse {
  type: 'success' | 'error' | 'progress';
  payload: unknown;
  id: string;
}

export interface ProveWithdrawal {
  type: 'generateWithdrawalProof';
  payload: {
    commitment: AccountCommitment;
    input: WithdrawalProofInput;
  };
}

export interface WithdrawalProved {
  type: 'withdrawalProved';
  payload: Awaited<ReturnType<PrivacyPoolStarknetSDK['proveWithdrawalSN']>>;
}

export interface ProveDepositCommand {
  type: 'generateDepositProve';
  payload: {
    amount: bigint;
    precommitment: bigint;
    pool: Pick<PoolInfo, 'entryPointAddress' | 'assetAddress'>;
    rpcUrl: string;
  };
}

export interface DepositProved {
  type: 'depositProved';
  payload: Call[];
}

export interface WorkerStarted {
  type: 'ready';
}

export interface ProveRageQuitCommand {
  type: 'generateRagequiteProve';
  payload: RageQuitData & ContractRetrievalData;
}

export interface RageQuitProved {
  type: 'rageQuitProved';
  payload: Awaited<ReturnType<typeof rageQuit>>;
}

export interface LoadChainAccountsCommand {
  type: 'loadAccounts';
  payload: AccountRetrievalData & { chain: { poolInfo: PoolInfo[] } };
}

export interface ChainAccountsLoaded {
  type: 'accountsLoaded';
  payload: Awaited<ReturnType<typeof getPoolAccountsFromAccount>>;
}

export interface GetPoolsCompleteInfoCommand {
  type: 'getPoolsInfo';
  payload: {
    chainId: string;
  };
}

export interface PoolsCompleteInfoResponse {
  type: 'gottenPoolsInfo';
  payload: CompletePoolInfo[];
}

export interface CreateDepositSecretsCommand {
  type: 'createDepositSecrets';
  payload: AccountRetrievalData & {
    scope: StarknetAddress;
  };
}

export interface CreateWithdrawSecretsCommand {
  type: 'createWithdrawSecrets';
  payload: AccountRetrievalData & {
    commitment: AccountCommitment;
  };
}

export interface WithdrawalSecretsCreated {
  type: 'withdrawalSecretsCreated';
  payload: ReturnType<typeof createWithdrawalSecrets>;
}

export interface DepositSecretsCreated {
  type: 'depositSecretsCreated';
  payload: ReturnType<typeof createDepositSecrets>;
}

export interface AddPoolAccountCommand {
  type: 'addPool';
  payload: Parameters<typeof addPoolAccount>[1] & AccountRetrievalData;
}

export interface AddWithdrawalCommand {
  type: 'addWithdrawal';
  payload: Parameters<typeof addWithdrawal>[1] & AccountRetrievalData;
}

export interface AddRagequitCommand {
  type: 'addRagequit';
  payload: Parameters<typeof addRagequit>[1] & AccountRetrievalData;
}

type AccountModificationCommands = AddPoolAccountCommand | AddWithdrawalCommand | AddRagequitCommand;

export interface GetAssetConfigCommand {
  type: 'getAssetConfig';
  payload: ContractRetrievalData & { assetAddress: StarknetAddress };
}

export interface GetAssetConfigResponse {
  type: 'getAssetConfig';
  payload: AssetConfig;
}

export interface AddPoolAccountResponse {
  type: 'addPool';
  payload: ReturnType<typeof addPoolAccount>;
}

export interface AddWithdrawalResponse {
  type: 'addWithdrawal';
  payload: Awaited<ReturnType<typeof addWithdrawal>>;
}

export interface AddRagequitResponse {
  type: 'addRagequit';
  payload: Awaited<ReturnType<typeof addRagequit>>;
}

export interface FetchEventsCommand {
  type: 'fetchEvents';
  payload: MinimalChainData & { params: Omit<Parameters<typeof waitForEvents>[0], 'dataService'> };
}

export interface FetchEventsResponse {
  type: 'fetchEvents';
  payload: Awaited<ReturnType<typeof waitForEvents>>;
}

type AccountModificationRespones = AddPoolAccountResponse | AddWithdrawalResponse | AddRagequitResponse;

export type WorkerMessages = { id: string } & (
  | WithdrawalProved
  | DepositProved
  | RageQuitProved
  | ChainAccountsLoaded
  | PoolsCompleteInfoResponse
  | DepositSecretsCreated
  | AccountModificationRespones
  | WithdrawalSecretsCreated
  | FetchEventsResponse
  | GetAssetConfigResponse
);

export type WorkerCommands = {
  id: string;
} & (
  | ProveWithdrawal
  | ProveDepositCommand
  | ProveRageQuitCommand
  | LoadChainAccountsCommand
  | GetPoolsCompleteInfoCommand
  | CreateDepositSecretsCommand
  | AccountModificationCommands
  | CreateWithdrawSecretsCommand
  | FetchEventsCommand
  | GetAssetConfigCommand
);

export type WorkerCommandsTypes = WorkerCommands['type'];
export type WorkerMessagesTypes = WorkerMessages['type'];
