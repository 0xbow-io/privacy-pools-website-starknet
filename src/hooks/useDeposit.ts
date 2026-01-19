'use client';

import { useState } from 'react';
import { useAccount, useSendTransaction } from '@starknet-react/core';
import { parseUnits } from 'viem/utils';
import { useChainContext, useAccountContext, useNotifications, usePoolAccountsContext } from '~/hooks';
import { Hash, ModalType, Secret } from '~/types';
import { delay } from '~/utils/promises';
import { useModal } from './useModal';
import { useSdk } from './useWorkerSdk';

export const useDeposit = () => {
  const { address } = useAccount();
  const {
    selectedPoolInfo,
    balanceBN: { decimals },
    chain,
  } = useChainContext();
  const { deposit: sdkDeposit, createDepositSecrets, fetchEvents } = useSdk();
  const { addNotification, getDefaultErrorMessage } = useNotifications();
  const { setModalOpen, setIsClosable } = useModal();
  const { sendAsync } = useSendTransaction({});
  const { amount, setTransactionHash } = usePoolAccountsContext();
  const [isLoading, setIsLoading] = useState(false);
  const { addPoolAccount, seed } = useAccountContext();

  const deposit = async () => {
    try {
      setIsClosable(false);
      setIsLoading(true);

      if (!address) throw new Error('Address not found');
      if (!seed) throw new Error('Seed not set');

      const scope = selectedPoolInfo.scope;

      const {
        nullifier,
        secret,
        precommitment: precommitmentHash,
      } = await createDepositSecrets({ chain, seed, scope });
      const value = parseUnits(amount, decimals);

      if (!scope || !precommitmentHash || !value) throw new Error('Missing required data to deposit');

      // Only set transaction hash and modal if not already done in Safe batch path
      setModalOpen(ModalType.PROCESSING);
      const trData = await sdkDeposit({
        amount: value,
        pool: selectedPoolInfo,
        precommitment: precommitmentHash,
        rpcUrl: chain.rpcUrl,
      });

      const { transaction_hash } = await sendAsync(trData);

      setTransactionHash(transaction_hash as never);

      await delay(3000);

      const deposits = await fetchEvents({
        params: {
          event: 'Deposit',
          txHash: transaction_hash,
          poolInfo: selectedPoolInfo,
          maxRetries: 10,
        },
        rpcUrl: chain.rpcUrl,
      });

      if (deposits.length === 0) {
        throw new Error('no deposit found');
      }

      const [{ label, value: _value, blockNumber }] = deposits;

      addPoolAccount({
        scope,
        value: _value,
        nullifier: nullifier as Secret,
        secret: secret as Secret,
        label: label as Hash,
        blockNumber: BigInt(blockNumber!),
        txHash: transaction_hash as `0x${string}`,
      });

      // Show success modal first
      setModalOpen(ModalType.SUCCESS);

      // After a brief delay, check if the deposit might not be visible to users who refresh
      setTimeout(() => {
        addNotification(
          'info',
          `✅ Deposit confirmed! Transaction: ${transaction_hash}\n\nNote: If you refresh the page and your deposit doesn't appear immediately, don't worry! Our indexers may need a few minutes to sync. Your funds are safe on-chain.`,
        );
      }, 2000);
    } catch (err) {
      const error = err as Error;
      addNotification('error', getDefaultErrorMessage(error?.message));
      setModalOpen(ModalType.NONE);
      setIsLoading(false);
      console.error('Error depositing', error);
    }
    setIsClosable(true);
    setIsLoading(false);
  };

  return { deposit, isLoading };
};
