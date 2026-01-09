'use client';
import React from 'react';
import { mainnet, sepolia } from '@starknet-react/chains';
import { StarknetConfig, jsonRpcProvider, ready, braavos, useInjectedConnectors, voyager } from '@starknet-react/core';
import { whitelistedChains } from '~/config';
import { getEnv } from '~/config/env';

const { ALCHEMY_KEY } = getEnv();

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [ready(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: 'always',
  });

  const chains = whitelistedChains;

  const provider = jsonRpcProvider({
    rpc: (chain) => {
      if (chain.id === mainnet.id) {
        return { nodeUrl: `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_8/${ALCHEMY_KEY}` };
      }
      if (chain.id === sepolia.id) {
        return { nodeUrl: `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/${ALCHEMY_KEY}` };
      }
      return { nodeUrl: chain.rpcUrls.public.http[0] };
    },
  });

  return (
    <StarknetConfig chains={chains as never} provider={provider} connectors={connectors} explorer={voyager}>
      {children}
    </StarknetConfig>
  );
}
