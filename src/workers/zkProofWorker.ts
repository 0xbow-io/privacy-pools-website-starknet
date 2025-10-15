import {
  AccountService,
  StarknetDataService,
  SNContractInteractionsService,
  Hash,
  StarknetAddress,
} from '@fatsolutions/privacy-pools-core-starknet-sdk';
import { Call, RpcProvider } from 'starknet';
import { chainData, CompletePoolInfo, PoolInfo } from '~/config';
import {
  addPoolAccount,
  addRagequit,
  addWithdrawal,
  createDepositSecrets,
  createWithdrawalSecrets,
  generateWithdrawalProof,
  getPoolAccountsFromAccount,
  initializeSDK,
  rageQuit,
  waitForEvents,
} from '~/utils';
import { LoadChainAccountsCommand, WorkerCommands, WorkerMessages } from '../types/worker-commands.interface';

type PoolToRetrieveHistoryFrom = Omit<CompletePoolInfo, 'chainId' | 'scope'> & { chainId: number; scope: Hash };

const sendResponse = <T extends WorkerMessages>(message: T) => {
  self.postMessage(message);
};

const chainAccountsMap = new Map<string, AccountService>();
const poolContractsMap = new Map<string, SNContractInteractionsService>();
const chainProviderMap = new Map<string, RpcProvider>();
const chainDataServiceMap = new Map<string, StarknetDataService>();
const completePoolInfoMap = new Map<string, PoolToRetrieveHistoryFrom[]>();
const sdkInstance = initializeSDK();

const loadProvider = (rpcUrl: string) => {
  let provider = chainProviderMap.get(rpcUrl);
  if (!provider) {
    provider = new RpcProvider({ nodeUrl: rpcUrl });
    chainProviderMap.set(rpcUrl, provider);
  }
  return provider;
};

const loadDataService = (rpcUrl: string, provider?: RpcProvider) => {
  let dataService = chainDataServiceMap.get(rpcUrl);
  if (!dataService) {
    dataService = new StarknetDataService(provider || loadProvider(rpcUrl));
    chainDataServiceMap.set(rpcUrl, dataService);
  }
  return dataService;
};

const initAccountsService = (rpcUrl: string, seed: string) => {
  const dataService = loadDataService(rpcUrl);
  const accountService = new AccountService(dataService as never, { mnemonic: seed });
  chainAccountsMap.set(rpcUrl + seed, accountService);
  return accountService;
};

const loadAccountsService = (rpcUrl: string, seed: string, recreate = false) => {
  return (!recreate && chainAccountsMap.get(rpcUrl + seed)) || initAccountsService(rpcUrl, seed);
};

const initPoolContract = (entryPoint: StarknetAddress, rpcUrl: string) => {
  const provider = loadProvider(rpcUrl);
  return sdkInstance.createSNContractInstance(entryPoint, provider);
};

const loadPoolContract = (address: StarknetAddress, rpcUrl: string) => {
  return poolContractsMap.get(address) || initPoolContract(address, rpcUrl);
};

const fillPoolsInfo = async (poolInfo: PoolInfo[], rpcUrl: string): Promise<PoolToRetrieveHistoryFrom[]> => {
  const completePools: PoolToRetrieveHistoryFrom[] = [];
  for (const pool of poolInfo) {
    const poolContract = loadPoolContract(pool.entryPointAddress, rpcUrl);
    const [scope, deploymentBlock] = await Promise.all([
      poolContract.getScope(pool.address),
      poolContract.getPoolDeploymentBlock(pool.address),
    ]);
    completePools.push({
      ...pool,
      chainId: +pool.chainId,
      scope: scope as unknown as Hash,
      deploymentBlock,
    });
  }
  return completePools;
};

const getPoolsInfo = async (poolInfo: PoolInfo[], rpcUrl: string) => {
  let completePoolInfo = completePoolInfoMap.get(rpcUrl);
  if (!completePoolInfo) {
    completePoolInfo = await fillPoolsInfo(poolInfo, rpcUrl);
    completePoolInfoMap.set(rpcUrl, completePoolInfo);
  }
  return completePoolInfo;
};

const loadChainAccounts = async ({ chain: { rpcUrl, poolInfo }, seed }: LoadChainAccountsCommand['payload']) => {
  const accountService = loadAccountsService(rpcUrl, seed, true);
  const completePoolInfo = await getPoolsInfo(poolInfo, rpcUrl);
  await accountService.retrieveHistory(completePoolInfo);
  const chainId = poolInfo[0].chainId;
  const provider = loadProvider(rpcUrl);
  return getPoolAccountsFromAccount(accountService.account, chainId, provider);
};

self.onmessage = async (event: MessageEvent<WorkerCommands>) => {
  const command = event.data;
  const { id, type } = command;
  switch (type) {
    case 'generateWithdrawalProof': {
      const { input, commitment } = command.payload;
      const proof = await generateWithdrawalProof({ commitment, input, sdkInstance });
      sendResponse({
        type: 'withdrawalProved',
        payload: proof,
        id: id,
      });
      break;
    }
    case 'createWithdrawSecrets': {
      const { chain, seed, commitment } = command.payload;
      const account = loadAccountsService(chain.rpcUrl, seed);
      const secrets = createWithdrawalSecrets(account, commitment);
      sendResponse({
        type: 'withdrawalSecretsCreated',
        payload: secrets,
        id,
      });
      break;
    }

    case 'fetchEvents': {
      const { rpcUrl, params } = command.payload;
      const dataService = loadDataService(rpcUrl);
      const events = await waitForEvents({ ...params, dataService });
      sendResponse({
        type: 'fetchEvents',
        payload: events,
        id,
      });
      break;
    }

    case 'generateDepositProve': {
      const {
        rpcUrl,
        pool: { assetAddress, entryPointAddress },
        amount,
        precommitment,
      } = command.payload;
      const poolContract = loadPoolContract(entryPointAddress, rpcUrl);
      const payload = (await poolContract.approveAndDeposit(
        entryPointAddress,
        assetAddress,
        amount,
        precommitment,
      )) as Call[];
      sendResponse({
        type: 'depositProved',
        payload,
        id,
      });
      break;
    }

    case 'generateRagequiteProve': {
      const {
        poolAddress,
        chain: { rpcUrl },
        ...rageQuitPayload
      } = command.payload;
      const contract = loadPoolContract(poolAddress, rpcUrl);
      const payload = await rageQuit({
        ...rageQuitPayload,
        poolAddress,
        contract,
        sdkInstance,
      });
      sendResponse({
        type: 'rageQuitProved',
        payload,
        id,
      });
      break;
    }
    case 'loadAccounts': {
      const accounts = await loadChainAccounts(command.payload);
      sendResponse({
        type: 'accountsLoaded',
        payload: accounts,
        id,
      });
      break;
    }

    case 'getPoolsInfo': {
      const chainId = command.payload.chainId;
      const pools = chainData[chainId].poolInfo;
      const poolInfo = await getPoolsInfo(pools, chainData[chainId].rpcUrl);
      sendResponse({
        type: 'gottenPoolsInfo',
        payload: poolInfo as unknown as CompletePoolInfo[],
        id,
      });
      break;
    }

    case 'createDepositSecrets': {
      const { chain, seed, scope } = command.payload;
      const account = loadAccountsService(chain.rpcUrl, seed);
      const secrets = createDepositSecrets(account, BigInt(scope) as Hash);
      sendResponse({
        type: 'depositSecretsCreated',
        payload: secrets,
        id,
      });
      break;
    }
    case 'addPool': {
      const { chain, seed } = command.payload;
      const accountService = loadAccountsService(chain.rpcUrl, seed);
      const payload = addPoolAccount(accountService, command.payload);
      sendResponse({
        id,
        type: 'addPool',
        payload,
      });
      break;
    }
    case 'addRagequit': {
      const { chain, seed } = command.payload;
      const accountService = loadAccountsService(chain.rpcUrl, seed);
      const payload = await addRagequit(accountService, command.payload);
      sendResponse({
        id,
        type: 'addRagequit',
        payload,
      });
      break;
    }
    case 'addWithdrawal': {
      const { chain, seed } = command.payload;
      const accountService = loadAccountsService(chain.rpcUrl, seed);
      const payload = await addWithdrawal(accountService, command.payload);
      sendResponse({
        id,
        type: 'addWithdrawal',
        payload,
      });
      break;
    }
    case 'getAssetConfig': {
      const {
        chain: { rpcUrl },
        entryPoint,
        assetAddress,
      } = command.payload;
      const contract = loadPoolContract(entryPoint, rpcUrl);
      const payload = await contract.getAssetConfig(assetAddress);
      sendResponse({
        id,
        type: 'getAssetConfig',
        payload,
      });
      break;
    }
  }
};
