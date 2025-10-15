'use client';

import {
  Circuits,
  WithdrawalProofInput,
  Secret,
  Hash,
  AccountService,
  PrivacyPoolAccount,
  AccountCommitment,
  PrivacyPoolStarknetSDK,
  getCommitment,
  computeContext,
  toAddress,
  StarknetAddress,
  Address,
  SNContractInteractionsService,
  StarknetDataService,
  generateMerkleProof,
} from '@fatsolutions/privacy-pools-core-starknet-sdk';
import { AbiEventName } from '@fatsolutions/privacy-pools-core-starknet-sdk/data.service';
import { RpcProvider } from 'starknet';
import { PoolInfo } from '~/config';
import { PoolAccount, ReviewStatus } from '~/types';
import { getTimestampFromBlockNumber } from '~/utils';
import { delay } from './promises';

// Lazy load circuits only when needed
let circuits: Circuits | null = null;
let sdk: PrivacyPoolStarknetSDK | null = null;

export const initializeSDK = () => {
  if (!circuits) {
    // Ensure we have a valid baseUrl (client-side only)
    const currentBaseUrl = globalThis?.location.origin;
    if (!currentBaseUrl) {
      throw new Error('SDK can only be initialized on client-side');
    }
    circuits = new Circuits({ baseUrl: currentBaseUrl });
    sdk = new PrivacyPoolStarknetSDK(circuits);
  }
  return sdk!;
};

/**
 * Generates a withdrawal proof.
 *
 * @param commitment - Commitment to withdraw
 * @param input - Input parameters for the withdrawal
 * @param withdrawal - Withdrawal details
 * @returns Promise resolving to withdrawal payload
 * @throws {ProofError} If proof generation fails
 */
export const generateWithdrawalProof = async ({
  commitment,
  input,
  sdkInstance,
}: {
  commitment: AccountCommitment;
  input: WithdrawalProofInput;
  sdkInstance: PrivacyPoolStarknetSDK;
}) => {
  return await sdkInstance.proveWithdrawalSN(
    {
      preimage: {
        label: commitment.label,
        value: commitment.value,
        precommitment: {
          hash: BigInt('0x1234') as Hash,
          nullifier: commitment.nullifier,
          secret: commitment.secret,
        },
      },
      hash: commitment.hash,
      nullifierHash: BigInt('0x1234') as Hash,
    },
    input,
  );
};

export const getContext = async (
  withdrawal: {
    processor: string;
    data: string[];
  },
  scope: StarknetAddress,
) => {
  return computeContext(withdrawal, scope);
};

export const getMerkleProof = async (leaves: bigint[], leaf: bigint) => {
  return generateMerkleProof(leaves, leaf);
};

export const relay = async ({
  poolInfo,
  withdraw,
  proof,
  rpcProvider,
}: {
  poolInfo: PoolInfo;
  withdraw: Parameters<typeof getContext>[0];
  proof: bigint[];
  rpcProvider: RpcProvider;
}) => {
  const sdk = initializeSDK();
  const contract = sdk.createSNContractInstance(poolInfo.entryPointAddress, rpcProvider);
  const scope = (await contract.getScope(poolInfo.address)) as Hash;
  return contract.relay(withdraw, proof, scope);
};

export const getDeposits = async (poolInfo: PoolInfo, dataService: StarknetDataService) => {
  return dataService.getDeposits(poolInfo as never);
};

export const verifyWithdrawalProof = async (proof: Awaited<ReturnType<typeof generateWithdrawalProof>>) => {
  return true;
  const sdkInstance = initializeSDK();
  return await sdkInstance.verifyWithdrawal(proof as never);
};

export const createDepositSecrets = (accountService: AccountService, scope: Hash, index?: bigint) => {
  return accountService.createDepositSecrets(scope, index);
};

export const createWithdrawalSecrets = (accountService: AccountService, commitment: AccountCommitment) => {
  return accountService.createWithdrawalSecrets(commitment);
};

export const waitForEvents = async <T extends keyof typeof AbiEventName>({
  event,
  txHash,
  poolInfo,
  dataService,
  maxRetries = 3,
}: {
  event: T;
  txHash: string;
  poolInfo: PoolInfo;
  dataService: StarknetDataService;
  maxRetries?: number;
}) => {
  const getTx = async () => {
    const txEvents = await dataService.getTxEvents(
      AbiEventName[event],
      txHash,
      poolInfo as PoolInfo & { chainId: number; scope: Hash },
    );
    if (txEvents.length === 0) {
      throw new Error(`Transaction for hash "${txHash}" not found in pool address "${poolInfo.address}".`);
    }
    return txEvents;
  };
  let retry = 0;
  let retryTime = 1000;
  let tx: Awaited<ReturnType<typeof getTx>> & { blockNumber: bigint }[] = [];
  do {
    tx = (await getTx().catch(() => delay((retryTime *= 2)).then(() => []))) as never;
  } while (tx.length === 0 && retry++ < maxRetries);
  return tx;
};

export interface RageQuitData {
  value: bigint;
  label: bigint;
  secret: Secret;
  nullifier: Secret;
  poolAddress: StarknetAddress;
}

export const rageQuit = async ({
  poolAddress,
  value,
  label,
  secret,
  nullifier,
  contract,
  sdkInstance,
}: RageQuitData & {
  contract: SNContractInteractionsService;
  sdkInstance: PrivacyPoolStarknetSDK;
}) => {
  const commitment = getCommitment(value, label, nullifier, secret);
  const { calldata } = await sdkInstance.proveCommitmentSN(commitment);
  return contract.ragequit(calldata, poolAddress);
};

export const addPoolAccount = (
  accountService: AccountService,
  newPoolAccount: {
    scope: StarknetAddress;
    value: bigint;
    nullifier: Secret;
    secret: Secret;
    label: Hash;
    blockNumber: bigint;
    txHash: Address;
  },
) => {
  const accountInfo = accountService.addPoolAccount(
    newPoolAccount.scope as unknown as Hash,
    newPoolAccount.value,
    newPoolAccount.nullifier,
    newPoolAccount.secret,
    newPoolAccount.label,
    newPoolAccount.blockNumber,
    newPoolAccount.txHash,
  );

  return accountInfo;
};

export const addWithdrawal = async (
  accountService: AccountService,
  withdrawalParams: {
    parentCommitment: AccountCommitment;
    value: bigint;
    nullifier: Secret;
    secret: Secret;
    blockNumber: bigint;
    txHash: Address;
  },
) => {
  return accountService.addWithdrawalCommitment(
    withdrawalParams.parentCommitment,
    withdrawalParams.value,
    withdrawalParams.nullifier,
    withdrawalParams.secret,
    withdrawalParams.blockNumber,
    withdrawalParams.txHash,
  );
};

export const addRagequit = async (
  accountService: AccountService,
  ragequitParams: {
    label: Hash;
    ragequit: {
      ragequitter: string;
      commitment: Hash;
      label: Hash;
      value: bigint;
      blockNumber: bigint;
      transactionHash: Address;
    };
  },
) => {
  return accountService.addRagequitToAccount(ragequitParams.label, ragequitParams.ragequit);
};

export const getPoolAccountsFromAccount = async (
  account: PrivacyPoolAccount,
  chainId: string,
  provider: RpcProvider,
) => {
  const paMap = account.poolAccounts.entries();
  const poolAccounts = [];

  for (const [_scope, _poolAccounts] of paMap) {
    const scope = _scope;
    let idx = 1;

    for (const poolAccount of _poolAccounts) {
      const lastCommitment =
        poolAccount.children.length > 0 ? poolAccount.children[poolAccount.children.length - 1] : poolAccount.deposit;

      const updatedPoolAccount = {
        ...(poolAccount as PoolAccount),
        balance: lastCommitment!.value,
        lastCommitment: lastCommitment,
        reviewStatus: ReviewStatus.PENDING,
        isValid: false,
        name: idx,
        scope: toAddress(scope),
        chainId,
      };

      updatedPoolAccount.deposit.timestamp = await getTimestampFromBlockNumber(
        poolAccount.deposit.blockNumber,
        provider,
      );

      if (updatedPoolAccount.children.length > 0) {
        updatedPoolAccount.children.forEach(async (child) => {
          child.timestamp = await getTimestampFromBlockNumber(child.blockNumber, provider);
        });
      }

      if (updatedPoolAccount.ragequit) {
        updatedPoolAccount.balance = 0n;
        updatedPoolAccount.reviewStatus = ReviewStatus.EXITED;
      }

      if (updatedPoolAccount.ragequit) {
        updatedPoolAccount.ragequit.timestamp = await getTimestampFromBlockNumber(
          updatedPoolAccount.ragequit.blockNumber,
          provider,
        );
      }

      poolAccounts.push(updatedPoolAccount);
      idx++;
    }
  }

  const poolAccountsByChainScope = poolAccounts.reduce(
    (acc, curr) => {
      const currentScope = toAddress(curr.scope);
      acc[`${curr.chainId}-${currentScope}`] = [
        ...(acc[`${curr.chainId}-${currentScope}`] || []),
        {
          ...curr,
          scope: currentScope,
        },
      ];
      return acc;
    },
    {} as Record<string, PoolAccount[]>,
  );
  const poolAccountsByCurrentChain = poolAccounts.filter((pa) => pa.chainId === chainId);

  return { poolAccounts: poolAccountsByCurrentChain, poolAccountsByChainScope };
};
