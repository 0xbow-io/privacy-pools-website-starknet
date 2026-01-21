import React, { useCallback, useMemo, useState } from 'react';
import { CopyAll } from '@mui/icons-material';
import { Button, FormControl, IconButton, MenuItem, Select, Stack, styled, Typography } from '@mui/material';
import { useAccountContext, useChainContext } from '~/hooks';
import { useSdk } from '~/hooks/useWorkerSdk';
import { AmountInput, InputContainer, ModalContainer, ModalTitle } from '../Deposit';

export const GenerateViewKeysForm: React.FC<{}> = () => {
  const { chain } = useChainContext();
  const { poolAccounts, accountService, seed } = useAccountContext();
  const [selectedLabel, setSelectedLabel] = useState('');
  const [viewKeys, setViewKeys] = useState('');
  const { generateViewKeys } = useSdk();

  const poolAccountsToGenerateViewKeysFor = useMemo(
    () => poolAccounts.filter((acc) => acc.children.length),
    [poolAccounts],
  );

  const setNewSelectedLabel = useCallback(
    (newLabel: string) => {
      setSelectedLabel(newLabel);
      setViewKeys('');
    },
    [setSelectedLabel, setViewKeys],
  );

  const generateViewKeysNow = useCallback(async () => {
    const selectedAccount = poolAccounts.find((account) => account.label === BigInt(selectedLabel));
    if (!selectedAccount || !seed) {
      return;
    }
    const newViewKeys = await generateViewKeys({ accountToGenerateViewKeysFor: selectedAccount, chain, seed });
    setViewKeys(newViewKeys);
  }, [accountService, poolAccounts, chain, seed, selectedLabel]);

  const copyViewKeys = useCallback(() => {
    const clipboard = navigator.clipboard;
    clipboard.writeText(viewKeys);
  }, [viewKeys]);

  return (
    <ModalContainer>
      <ModalTitle data-testid='success-title' sx={{ zIndex: 1 }}>
        Generate View Keys
      </ModalTitle>

      <Stack gap='1.2rem' alignItems='stretch'>
        <Typography>Account to generate view keys for</Typography>
        <FormControl>
          <StyledSelect
            id='withdrawal-select'
            value={selectedLabel}
            displayEmpty
            onChange={(e) => setNewSelectedLabel(e.target.value as string)}
          >
            {poolAccountsToGenerateViewKeysFor.map((account) => (
              <MenuItem key={account.lastCommitment.nullifier} value={account.label.toString()}>
                {`PA-${account.name}`}
              </MenuItem>
            ))}
          </StyledSelect>
        </FormControl>
      </Stack>

      {viewKeys && (
        <>
          <Typography>View Keys</Typography>
          <InputContainer flexDirection='row' borderRadius='4px' textAlign='center' alignItems='center'>
            <AmountInput disabled value={viewKeys}></AmountInput>
            {viewKeys && (
              <IconButton style={{ border: 'none' }} onClick={() => copyViewKeys()}>
                <CopyAll />
              </IconButton>
            )}
          </InputContainer>
        </>
      )}

      <Button onClick={() => generateViewKeysNow()}>Generate</Button>
    </ModalContainer>
  );
};

const StyledSelect = styled(Select)({});
