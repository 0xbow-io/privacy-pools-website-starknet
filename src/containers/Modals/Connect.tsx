'use client';

import { useMemo } from 'react';
import { Stack, Button, styled, alpha } from '@mui/material';
import { Connector } from '@starknet-react/core';
import { BaseModal } from '~/components';
import { useCustomConnect, useGoTo, useModal } from '~/hooks';
import { ModalType } from '~/types';
import { getUniqueConnectors, ROUTER } from '~/utils';
import { ModalContainer, ModalTitle } from './Deposit';

export const ConnectModal = () => {
  const { availableConnectors, customConnect } = useCustomConnect();
  const { closeModal } = useModal();
  const goTo = useGoTo();

  const uniqueConnectors = useMemo(() => getUniqueConnectors(availableConnectors), [availableConnectors]);

  const handleConnect = async (connector: Connector) => {
    await customConnect(connector);
    goTo(ROUTER.account.base);
    closeModal();
  };

  return (
    <SModal type={ModalType.CONNECT} size='small'>
      <ModalContainer data-testid='wallet-modal'>
        <ModalTitle variant='h2'>Sign in with</ModalTitle>

        <Stack gap={2} width='100%'>
          {uniqueConnectors.map((connector) => (
            <SButton
              key={connector.id}
              onClick={() => handleConnect(connector)}
              data-testid={`wallet-option-${connector.id}`}
              variant='contained'
            >
              {(connector as { rkDetails?: { name?: string } })?.rkDetails?.name || connector.name}
            </SButton>
          ))}
        </Stack>
      </ModalContainer>
    </SModal>
  );
};

const SModal = styled(BaseModal)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'auto',
  padding: theme.spacing(2),
  '& .MuiBackdrop-root': {
    backgroundColor: alpha(theme.palette.background.default, 0.5),
    backdropFilter: 'blur(4px)',
  },
}));

const SButton = styled(Button)(() => ({
  textTransform: 'none',
}));
