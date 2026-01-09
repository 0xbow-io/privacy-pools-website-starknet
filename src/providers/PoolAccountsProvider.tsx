'use client';

import { createContext, useState, useEffect } from 'react';
import { StarknetAddress } from '@fatsolutions/privacy-pools-core-starknet-sdk';
import { useQuery } from '@tanstack/react-query';
import { Uint256 } from 'starknet';
import { useChainContext } from '~/hooks';
import { useSdk } from '~/hooks/useWorkerSdk';
import {
  CommitmentProof,
  EventType,
  HistoryData,
  PoolAccount,
  RagequitProof,
  SignedFeeCommitment,
  WithdrawalProof,
  WithdrawalRelayerPayload,
} from '~/types';

type Withdraw = Omit<WithdrawalRelayerPayload, 'data'> & {
  data: string[];
};

type ContextType = {
  vettingFeeBPS: bigint;
  minimumDepositAmount: bigint;

  // Inputs
  amount: string;
  setAmount: (val: string) => void;
  target: StarknetAddress | '';
  setTarget: (val: StarknetAddress | '') => void;
  poolAccount: PoolAccount | undefined;
  setPoolAccount: (val?: PoolAccount) => void;
  resetInputs: () => void;

  // Details modal
  selectedHistoryData?: HistoryData[number];
  setSelectedHistoryData: (data?: HistoryData[number]) => void;

  // Transaction
  proof: WithdrawalProof | RagequitProof | CommitmentProof | null;
  setProof: (val: WithdrawalProof | RagequitProof | CommitmentProof) => void;
  withdrawal: Withdraw | null;
  setWithdrawal: (val: Withdraw) => void;
  newSecretKeys: { secret: bigint; nullifier: bigint } | null;
  setNewSecretKeys: (val: { secret: bigint; nullifier: bigint }) => void;
  transactionHash: StarknetAddress | undefined;
  setTransactionHash: (val: StarknetAddress) => void;
  actionType: EventType | undefined;
  setActionType: (val?: EventType) => void;
  feeCommitment: SignedFeeCommitment | null;
  setFeeCommitment: (val: SignedFeeCommitment | null) => void;
  resetTransactionState: () => void;
  isAssetConfigLoading: boolean;
  feeBPSForWithdraw: bigint;
  setFeeBPSForWithdraw: (val: bigint) => void;
};

interface Props {
  children: React.ReactNode;
}

export const PoolAccountsContext = createContext({} as ContextType);

export type TxHash = number | bigint | Uint256;

export const PoolAccountsProvider = ({ children }: Props) => {
  const {
    chainId,
    chain: { rpcUrl },
    selectedPoolInfo,
  } = useChainContext();

  const { getAssetConfig } = useSdk();

  const [actionType, setActionType] = useState<EventType>();
  const [transactionHash, setTransactionHash] = useState<StarknetAddress>();

  const [amount, setAmount] = useState<string>('');
  const [target, setTarget] = useState<StarknetAddress | ''>('');
  const [poolAccount, setPoolAccount] = useState<PoolAccount>();

  const [proof, setProof] = useState<ContextType['proof']>(null);
  const [withdrawal, setWithdrawal] = useState<Withdraw | null>(null);
  const [newSecretKeys, setNewSecretKeys] = useState<{ secret: bigint; nullifier: bigint } | null>(null);
  const [feeCommitment, setFeeCommitment] = useState<SignedFeeCommitment | null>(null);
  const [feeBPSForWithdraw, setFeeBPSForWithdraw] = useState<bigint>(BigInt(0));

  const [selectedHistoryData, setSelectedHistoryData] = useState<HistoryData[number]>();

  const resetInputs = () => {
    setAmount('');
    setTarget('');
    setPoolAccount(undefined);
  };

  const resetTransactionState = () => {
    setProof(null);
    setWithdrawal(null);
    setTransactionHash(undefined);
    setActionType(undefined);
    setPoolAccount(undefined);
    setFeeCommitment(null);
    setFeeBPSForWithdraw(BigInt(0));
  };

  // Reset form inputs when asset/chain changes
  // Reset form inputs when asset/chain changes
  useEffect(() => {
    setAmount('');
    setTarget('');
    setPoolAccount(undefined);
  }, [selectedPoolInfo?.assetAddress, selectedPoolInfo?.chainId]);

  const { data: assetConfigs, isLoading: isAssetConfigLoading } = useQuery({
    queryKey: ['assetConfigs', chainId, selectedPoolInfo?.scope?.toString()],
    enabled: !!selectedPoolInfo,
    queryFn: async () => {
      if (!selectedPoolInfo) return;

      const config = await getAssetConfig({
        chain: {
          rpcUrl,
        },
        entryPoint: selectedPoolInfo.entryPointAddress,
        assetAddress: selectedPoolInfo.assetAddress,
      });

      if (!config) return;

      return {
        privacyPool: config.pool,
        minimumDepositAmount: config.minimumDepositAmount,
        vettingFeeBPS: config.vettingFeeBPS,
      };
    },
  });

  return (
    <PoolAccountsContext.Provider
      value={{
        amount,
        setAmount,
        target,
        setTarget,
        poolAccount,
        setPoolAccount,
        resetInputs,
        selectedHistoryData,
        setSelectedHistoryData,
        proof,
        setProof,
        withdrawal,
        setWithdrawal,
        newSecretKeys,
        setNewSecretKeys,
        transactionHash,
        setTransactionHash,
        actionType,
        setActionType,
        feeCommitment,
        setFeeCommitment,
        resetTransactionState,
        vettingFeeBPS: assetConfigs?.vettingFeeBPS ?? BigInt(0),
        minimumDepositAmount: assetConfigs?.minimumDepositAmount ?? BigInt(0),
        isAssetConfigLoading,
        feeBPSForWithdraw,
        setFeeBPSForWithdraw,
      }}
    >
      {children}
    </PoolAccountsContext.Provider>
  );
};
