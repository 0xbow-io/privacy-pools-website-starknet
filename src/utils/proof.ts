import { AuditorData, serializeRelayData, StarknetWithdrawal } from '@fatsolutions/privacy-pools-core-starknet-sdk';
import { Address } from '@starknet-react/chains';
import { validateAndParseAddress } from 'starknet';
import { PoolInfo } from '~/config';
import { Secret, WithdrawalProofInput, Hash } from '~/types';
import { getMerkleProof } from '~/utils';

export const prepareWithdrawRequest = (
  recipient: Address,
  relayer: Address,
  feeBPS: string,
  poolInfo: Pick<PoolInfo, 'entryPointAddress'>,
  auditorData?: AuditorData,
) => {
  const validatedRecipient = validateAndParseAddress(recipient);

  return {
    processor: poolInfo.entryPointAddress,
    data: serializeRelayData({
      recipient: validatedRecipient,
      feeRecipient: relayer,
      relayFeeBPS: feeBPS,
    }),
    auditorData,
  } as const satisfies StarknetWithdrawal;
};

export const prepareWithdrawalProofInput = (
  amount: bigint,
  stateMerkleProof: Awaited<ReturnType<typeof getMerkleProof>>,
  aspMerkleProof: Awaited<ReturnType<typeof getMerkleProof>>,
  context: bigint,
  secret: Secret,
  nullifier: Secret,
): WithdrawalProofInput => {
  return {
    withdrawalAmount: amount,
    stateMerkleProof: {
      root: stateMerkleProof.root as Hash,
      leaf: stateMerkleProof.leaf,
      index: stateMerkleProof.index,
      siblings: stateMerkleProof.siblings, // Pad to 32 length
    },
    aspMerkleProof: {
      root: aspMerkleProof.root as Hash,
      leaf: aspMerkleProof.leaf,
      index: aspMerkleProof.index,
      siblings: aspMerkleProof.siblings, // Pad to 32 length
    },
    stateRoot: stateMerkleProof.root as Hash,
    aspRoot: aspMerkleProof.root as Hash,
    stateTreeDepth: 10n, // Double check
    aspTreeDepth: 10n, // Double check
    context,
    newSecret: secret,
    newNullifier: nullifier,
  };
};
