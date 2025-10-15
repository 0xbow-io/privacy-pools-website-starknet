'use client';

import { useState, useCallback } from 'react';
import { StarknetAddress } from '@fatsolutions/privacy-pools-core-starknet-sdk';
import { addBreadcrumb } from '@sentry/nextjs';
import { useSendTransaction, useAccount } from '@starknet-react/core';
import { useChainContext, useAccountContext, useModal, useNotifications, usePoolAccountsContext } from '~/hooks';
import { Hash, ModalType } from '~/types';
import { useSdk } from './useWorkerSdk';

export const useExit = () => {
  const { address } = useAccount();
  const { addNotification, getDefaultErrorMessage } = useNotifications();
  const { sendAsync } = useSendTransaction({});
  const { rageQuit, fetchEvents } = useSdk();
  const { setModalOpen, setIsClosable } = useModal();
  const { selectedPoolInfo, chain } = useChainContext();
  const { poolAccount, setTransactionHash } = usePoolAccountsContext();
  const { seed, addRagequit } = useAccountContext();
  const [isLoading, setIsLoading] = useState(false);

  const exit = useCallback(async () => {
    try {
      if (!poolAccount || !seed) throw new Error('Missing required data to exit');

      setIsClosable(false);
      setIsLoading(true);

      const { label, secret, nullifier, value, hash: commitmentHash } = poolAccount.lastCommitment;

      const rageQuitCall = await rageQuit({
        entryPoint: selectedPoolInfo.entryPointAddress,
        poolAddress: selectedPoolInfo.address,
        label,
        nullifier,
        secret,
        value,
        chain,
      });

      const hash = (await sendAsync([rageQuitCall])).transaction_hash as `0x${string}`;

      setTransactionHash(hash as StarknetAddress);
      setModalOpen(ModalType.PROCESSING);

      const receipts = await fetchEvents({
        rpcUrl: chain.rpcUrl,
        params: {
          event: 'Ragequit',
          txHash: hash,
          poolInfo: selectedPoolInfo,
        },
      });

      if (!receipts.length) throw new Error('Receipt not found');

      const [receipt] = receipts;

      addRagequit({
        label: receipt.label as Hash,
        ragequit: {
          ragequitter: address!,
          commitment: commitmentHash as Hash,
          label: receipt.label as Hash,
          value: receipt.value,
          blockNumber: BigInt(receipt.blockNumber!),
          transactionHash: hash as `0x${string}`,
        },
      });

      addBreadcrumb({
        message: 'Ragequit successful',
        category: 'transaction',
        data: {
          transactionHash: hash,
          blockNumber: receipt.blockNumber!.toString(),
          value: value.toString(),
        },
        level: 'info',
      });

      setModalOpen(ModalType.SUCCESS);
    } catch (err) {
      const error = err as Error;
      setModalOpen(ModalType.NONE);

      // Log error to Sentry with full context
      // logErrorToSentry(error, {
      //   operation_step: 'ragequit_execution',
      //   error_type: error?.name || 'unknown',
      //   short_message: error?.shortMessage,
      //   has_proof: !!proof,
      //   has_pool_account: !!poolAccount,
      //   has_account_service: !!accountService,
      //   has_seed: !!seed,
      // });

      const errorMessage = getDefaultErrorMessage(error?.message);
      addNotification('error', errorMessage);
      console.error('Error calling exit', error);
    }
    setIsClosable(true);
    setIsLoading(false);
  }, [
    setIsClosable,
    poolAccount,
    seed,
    rageQuit,
    selectedPoolInfo,
    chain,
    sendAsync,
    setTransactionHash,
    setModalOpen,
    fetchEvents,
    addRagequit,
    address,
    getDefaultErrorMessage,
    addNotification,
  ]);

  const generateProofAndExit = useCallback(async () => {
    try {
      await exit();
    } catch (error) {
      console.error('❌ generateProofAndExit failed:', error);
      throw error;
    }
  }, [exit]);

  return { exit, generateProofAndExit, isLoading };
};
