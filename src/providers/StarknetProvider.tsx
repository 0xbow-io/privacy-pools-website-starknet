'use client';
import React from 'react';
import { StarknetConfig, jsonRpcProvider, ready, braavos, useInjectedConnectors, voyager } from '@starknet-react/core';
import { whitelistedChains } from '~/config';
import { getEnv } from '~/config/env.ts';

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [ready(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: 'always',
  });

  const { ALCHEMY_KEY } = getEnv();

  const chains = whitelistedChains;

  const provider = jsonRpcProvider({
    rpc: () => {
      return {
        nodeUrl: `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_9/${ALCHEMY_KEY}`,
      };
    },
  });

  return (
    <StarknetConfig chains={chains as never} provider={provider} connectors={connectors} explorer={voyager}>
      {children}
    </StarknetConfig>
  );
}
