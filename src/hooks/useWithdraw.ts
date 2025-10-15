import { useState, useCallback } from 'react';
import { generateMerkleProof, StarknetAddress, WithdrawalProof } from '@fatsolutions/privacy-pools-core-starknet-sdk';
import { addBreadcrumb } from '@sentry/nextjs';
import { parseUnits } from 'viem/utils';
import { useQuoteContext } from '~/contexts/QuoteContext';
import {
  useExternalServices,
  useAccountContext,
  useModal,
  useNotifications,
  usePoolAccountsContext,
  useChainContext,
} from '~/hooks';
import { ModalType, Secret } from '~/types';
import { prepareWithdrawRequest, getContext, verifyWithdrawalProof, prepareWithdrawalProofInput } from '~/utils';
import { useSdk } from './useWorkerSdk';

export const useWithdraw = () => {
  const { addNotification, getDefaultErrorMessage } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const { withdraw: sdkWithdraw, createWithdrawalSecrets, fetchEvents } = useSdk();
  const { chain } = useChainContext();
  const { setModalOpen, setIsClosable } = useModal();
  const { aspData, relayerData } = useExternalServices();
  const { resetQuote, quoteState } = useQuoteContext();
  const {
    selectedPoolInfo,
    balanceBN: { decimals },
    relayersData,
    selectedRelayer,
  } = useChainContext();

  const { addWithdrawal, seed } = useAccountContext();

  const {
    amount,
    target,
    poolAccount,
    proof,
    setProof,
    withdrawal,
    setWithdrawal,
    newSecretKeys,
    setNewSecretKeys,
    setTransactionHash,
    feeBPSForWithdraw,
  } = usePoolAccountsContext();

  const commitment = poolAccount?.lastCommitment;
  const aspLeaves = aspData.mtLeavesData?.aspLeaves;
  const stateLeaves = aspData.mtLeavesData?.stateTreeLeaves;
  // const { address } = useAccount();

  // const logErrorToSentry = useCallback(
  //   (error: Error | unknown, context: Record<string, unknown>) => {
  //     // Filter out expected user behavior errors
  //     if (error && typeof error === 'object') {
  //       const message = (error as { message?: string }).message || '';
  //       const errorName = (error as { name?: string }).name || '';
  //       const errorCode = (error as { code?: number }).code;

  //       // Don't log wallet rejections and user behavior errors
  //       if (
  //         errorCode === 4001 ||
  //         errorCode === 4100 ||
  //         errorCode === 4200 ||
  //         errorCode === -32002 ||
  //         errorCode === -32003 ||
  //         message.includes('User rejected the request') ||
  //         message.includes('User denied') ||
  //         message.includes('User cancelled') ||
  //         message.includes('Pop up window failed to open') ||
  //         message.includes('provider is not defined') ||
  //         message.includes('No Ethereum provider found') ||
  //         message.includes('Connection timeout') ||
  //         message.includes('Request timeout') ||
  //         message.includes('Transaction cancelled') ||
  //         message.includes('Chain switching failed') ||
  //         errorName === 'UserRejectedRequestError'
  //       ) {
  //         console.warn('Filtered wallet user behavior error (not logging to Sentry)');
  //         return;
  //       }
  //     }

  //     withScope((scope) => {
  //       scope.setUser({
  //         address: address,
  //       });

  //       // Set additional context
  //       scope.setContext('withdrawal_context', {
  //         chainId,
  //         poolAddress: selectedPoolInfo?.address,
  //         entryPointAddress: selectedPoolInfo?.entryPointAddress,
  //         amount: amount?.toString(),
  //         target,
  //         hasPoolAccount: !!poolAccount,
  //         hasCommitment: !!commitment,
  //         hasAspLeaves: !!aspLeaves,
  //         hasStateLeaves: !!stateLeaves,
  //         hasSelectedRelayer: !!selectedRelayer?.url,
  //         selectedRelayer,
  //         testMode: TEST_MODE,
  //         ...context,
  //       });

  //       // Set tags for filtering
  //       scope.setTag('operation', 'withdraw');
  //       scope.setTag('chain_id', chainId?.toString());
  //       scope.setTag('test_mode', TEST_MODE.toString());

  //       // Log the error
  //       captureException(error);
  //     });
  //   },
  //   [
  //     address,
  //     chainId,
  //     selectedPoolInfo?.address,
  //     selectedPoolInfo?.entryPointAddress,
  //     selectedRelayer,
  //     amount,
  //     target,
  //     poolAccount,
  //     commitment,
  //     aspLeaves,
  //     stateLeaves,
  //   ],
  // );

  const generateProof = useCallback(
    async (
      onProgress?: (progress: {
        phase: 'loading_circuits' | 'generating_proof' | 'verifying_proof';
        progress: number;
      }) => void,
      onComplete?: (
        proof: {
          withdrawalProof: WithdrawalProof;
          calldata: bigint[];
        },
        completeWithdrawal: typeof withdrawal,
        newSecretKeys: Record<'secret' | 'nullifier', Secret>,
      ) => void,
    ) => {
      // Check for valid quote data immediately
      if (!feeBPSForWithdraw || feeBPSForWithdraw === 0n || !quoteState.quoteCommitment) {
        throw new Error('No valid quote available. Please ensure you have a valid quote before withdrawing.');
      }

      const relayerDetails = relayersData.find((r) => r.url === selectedRelayer?.url);

      const missingFields = [];
      if (!poolAccount) missingFields.push('poolAccount');
      if (!target) missingFields.push('target');
      if (!commitment) missingFields.push('commitment');
      if (!aspLeaves) missingFields.push('aspLeaves');
      if (!stateLeaves) missingFields.push('stateLeaves');
      if (!relayerDetails) missingFields.push('relayerDetails');
      if (!relayerDetails?.relayerAddress) missingFields.push('relayerAddress');
      if (!feeBPSForWithdraw) missingFields.push('feeBPS');

      if (missingFields.length > 0) {
        console.error('❌ Missing required data for proof generation:', missingFields);
        throw new Error(`Missing required data: ${missingFields.join(', ')}`);
      }

      const aspLeavesToUse = aspLeaves?.map(BigInt) || [];
      const stateLeavesToUse = stateLeaves?.map(BigInt) || [];
      const relayerAddressToUse: `0x${string}` = relayerDetails?.relayerAddress as never;
      const feeBPSToUSe: string = feeBPSForWithdraw.toString();

      // TypeScript assertions - we've already validated these exist above
      if (!relayerDetails || !relayerDetails.relayerAddress) {
        // relayerAddressToUse = address!;
        throw new Error('Relayer details not available');
      }
      if (!seed) {
        throw new Error('Seed missing.');
      }
      if (!commitment) {
        throw new Error('Commitment not available');
      }
      if (!stateLeaves) {
        // stateLeavesToUse = deposits.map((a) => a.commitment);
        throw new Error('State leaves not available');
      }
      if (!aspLeaves) {
        // aspLeavesToUse = deposits.map((a) => a.label);
        throw new Error('ASP leaves not available');
      }

      const newWithdrawal = prepareWithdrawRequest(
        target as `0x${string}`,
        relayerAddressToUse,
        feeBPSToUSe,
        // feeBPSForWithdraw.toString(),
        selectedPoolInfo,
      );

      const poolScope = selectedPoolInfo.scope;
      const stateMerkleProof = await Promise.resolve()
        .then(() => generateMerkleProof(stateLeavesToUse, commitment.hash))
        .catch((error) => {
          throw new Error(
            'Failed to generate the ZK proof because of invalid ASP Data. Please reload the page and try again. If the issue persists please contact support.',
            { cause: error },
          );
        });
      const aspMerkleProof = await Promise.resolve()
        .then(() => generateMerkleProof(aspLeavesToUse, commitment.label))
        .catch((error) => {
          throw new Error(
            'Failed to generate the ZK proof because of invalid ASP Data. Please reload the page and try again. If the issue persists please contact support.',
            { cause: error },
          );
        });
      const context = await getContext(newWithdrawal, poolScope);
      const { secret, nullifier } = await createWithdrawalSecrets({ commitment, seed, chain });
      aspMerkleProof.index = Object.is(aspMerkleProof.index, NaN) ? 0 : aspMerkleProof.index; // workaround for NaN index, SDK issue

      const withdrawalProofInput = prepareWithdrawalProofInput(
        parseUnits(amount, decimals),
        stateMerkleProof,
        aspMerkleProof,
        BigInt(context),
        secret,
        nullifier,
      );

      const proof = await sdkWithdraw({ commitment, input: withdrawalProofInput });

      const verified = await verifyWithdrawalProof(proof);

      if (!verified) throw new Error('Proof verification failed');
      setProof(proof as never);
      setWithdrawal(newWithdrawal);
      setNewSecretKeys({ secret, nullifier });

      if (onProgress) {
        onProgress({ phase: 'verifying_proof', progress: 1.0 });
      }

      // Signal that proof generation is complete
      if (onComplete) {
        onComplete(proof, newWithdrawal, { secret, nullifier });
      }

      return proof;
    },
    [
      feeBPSForWithdraw,
      quoteState.quoteCommitment,
      relayersData,
      poolAccount,
      target,
      commitment,
      aspLeaves,
      stateLeaves,
      seed,
      selectedRelayer?.url,
      selectedPoolInfo,
      createWithdrawalSecrets,
      chain,
      amount,
      decimals,
      sdkWithdraw,
      setProof,
      setWithdrawal,
      setNewSecretKeys,
    ],
  );

  const withdraw = useCallback(
    async (
      ...[proofData, withdrawalData, secretKeysData]: Parameters<
        Exclude<Parameters<typeof generateProof>[1], undefined>
      >
    ) => {
      // Use passed data if available, otherwise use state
      const currentProof = proofData || proof;
      const currentWithdrawal = withdrawalData || withdrawal;
      const currentNewSecretKeys = secretKeysData || newSecretKeys;
      const relayerDetails = relayersData.find((r) => r.url === selectedRelayer?.url);

      if (
        !currentProof ||
        !currentWithdrawal ||
        !commitment ||
        !target ||
        !relayerDetails ||
        !relayerDetails.relayerAddress ||
        !currentNewSecretKeys
      )
        throw new Error('Missing required data to withdraw');

      const scope = selectedPoolInfo.scope;

      setIsClosable(false);
      setIsLoading(true);

      // Reset the quote timer when transaction starts
      resetQuote();

      const res = await relayerData.relay({
        feeCommitment: quoteState.quoteCommitment!,
        scope,
        withdrawal: currentWithdrawal,
        ...currentProof.withdrawalProof,
      });

      const txHash = res.txHash as `0x${string}`;

      const receipts = await fetchEvents({
        rpcUrl: chain.rpcUrl,
        params: {
          event: 'Withdraw',
          txHash,
          poolInfo: selectedPoolInfo,
        },
      });

      if (!receipts.length)
        throw new Error(
          'Relayer transaction not found in time. This usually means that it is taking a little longer to process. Reload the page in some minutes and your withdrawal should be there. If not please contact support.',
        );
      const [{ withdrawnValue, blockNumber }] = receipts;

      setTransactionHash(txHash as StarknetAddress);
      setModalOpen(ModalType.PROCESSING);

      addWithdrawal({
        parentCommitment: commitment,
        value: poolAccount?.balance - withdrawnValue,
        nullifier: (currentNewSecretKeys as { nullifier?: unknown })?.nullifier as Secret,
        secret: (currentNewSecretKeys as { secret?: unknown })?.secret as Secret,
        blockNumber: BigInt(blockNumber!),
        txHash: txHash,
      });

      // Log successful withdrawal to Sentry for analytics
      addBreadcrumb({
        message: 'Withdrawal successful',
        category: 'transaction',
        data: {
          transactionHash: txHash,
          blockNumber: blockNumber?.toString(),
          value: withdrawnValue.toString(),
        },
        level: 'info',
      });

      setModalOpen(ModalType.SUCCESS);
    },
    [
      proof,
      withdrawal,
      newSecretKeys,
      relayersData,
      commitment,
      target,
      selectedPoolInfo,
      setIsClosable,
      selectedRelayer?.url,
      resetQuote,
      relayerData,
      quoteState.quoteCommitment,
      fetchEvents,
      chain.rpcUrl,
      setTransactionHash,
      setModalOpen,
      addWithdrawal,
      poolAccount?.balance,
    ],
  );

  const generateProofAndWithdraw = useCallback(
    async (
      onProgress?: (progress: {
        phase: 'loading_circuits' | 'generating_proof' | 'verifying_proof';
        progress: number;
      }) => void,
    ) => {
      try {
        // Generate proof and call withdraw when complete
        await generateProof(onProgress, (proof, withdrawal, newSecretKeys) => {
          withdraw(proof, withdrawal, newSecretKeys);
        });
      } catch (err) {
        const error = err as Error;

        // Log proof generation error to Sentry
        // logErrorToSentry(error, {
        //   operation_step: 'proof_generation',
        //   error_type: error?.name || 'unknown',
        //   has_pool_scope: !!poolScope,
        //   merkle_proof_generated: merkleProofGenerated,
        //   proof_verified: false,
        // });

        addNotification('error', getDefaultErrorMessage(error.message));
        console.error('❌ generateProofAndWithdraw failed:', error);
        setModalOpen((currentModal) => {
          setIsLoading(false);
          setIsClosable(true);
          if (currentModal === ModalType.GENERATE_ZK_PROOF) {
            return ModalType.WITHDRAW;
          }
          return ModalType.NONE;
        });
        throw error;
      }
    },
    [addNotification, generateProof, getDefaultErrorMessage, setIsClosable, setModalOpen, withdraw],
  );

  return { withdraw, generateProof, generateProofAndWithdraw, isLoading };
};
