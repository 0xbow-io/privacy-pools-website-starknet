'use client';
import React, { useRef } from 'react';
import { StarknetConfig, ready, braavos, useInjectedConnectors, voyager, jsonRpcProvider } from '@starknet-react/core';
import { whitelistedChains } from '~/config';
import { getEnv } from '~/config/env';

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [ready(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: 'always',
  });

  const { ALCHEMY_KEY } = getEnv();

  const chains = whitelistedChains;

  const alchemyProvider = useRef(
    jsonRpcProvider({
      rpc: () => ({
        nodeUrl: `${getEnv().RPC_URL}${getEnv().ALCHEMY_KEY}`,
        specVersion: getEnv().RPC_SPEC_VERSION,
      }),
    }),
  );

  return (
    <StarknetConfig
      chains={chains as never}
      provider={alchemyProvider.current}
      connectors={connectors}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}
