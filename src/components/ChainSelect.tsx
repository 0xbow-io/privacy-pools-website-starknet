'use client';

import { MouseEvent, useRef, useState } from 'react';
import Image from 'next/image';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, ListItemIcon, Menu as MuiMenu, MenuItem, styled, IconButton } from '@mui/material';
import { Chain } from '@starknet-react/chains';
import { useNetwork } from '@starknet-react/core';
import { chainData, whitelistedChains } from '~/config';
import { useChainContext } from '~/hooks';
import { zIndex } from '~/utils';
import ethereumIcon from '~/assets/icons/ethereum.svg';

export const ChainSelect = () => {
  const { chains } = useNetwork();
  const { chainId, setChainId } = useChainContext();

  // Only show chains that are whitelisted and have chainData
  const availableChains = chains.filter(
    (chain) => whitelistedChains.some((wc) => wc.id === chain.id) && chainData[chain.id.toString()],
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (event: MouseEvent<HTMLElement>) => {
    if (event) {
      setAnchorEl(event.currentTarget);
    }
    if (open) {
      handleClose();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setTimeout(() => {
      buttonRef.current?.blur();
    }, 0);
  };

  const handleChainChange = async (chainId: string) => {
    setChainId(chainId);
    handleClose();
  };

  return (
    <>
      <SIconButton ref={buttonRef} open={open} onClick={handleToggle} data-testid='chain-select-button'>
        <Image src={chainData[chainId].image} alt='menu' width={16} height={16} />
      </SIconButton>

      <SMenu
        anchorEl={anchorEl}
        id='account-menu'
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'left', vertical: 0 }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        elevation={0}
      >
        {availableChains.map((chain: Chain) => (
          <SMenuItem key={chain.id} onClick={() => handleChainChange(chain.id.toString())}>
            <ListItemIcon>
              <Image src={chainData[chain.id.toString()].image} alt={chain.name} width={16} height={16} />
            </ListItemIcon>
            {chain.name}
          </SMenuItem>
        ))}

        <MenuItem
          component='a'
          href='https://privacypools.com'
          target='_blank'
          rel='noopener noreferrer'
          onClick={handleClose}
          sx={{
            padding: '1.6rem 0',
            fontSize: '1.6rem',
            fontWeight: 400,
            lineHeight: 'normal',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <ListItemIcon sx={{ minWidth: 'unset' }}>
              <Image src={ethereumIcon} alt='Ethereum' width={16} height={16} />
            </ListItemIcon>
            Ethereum
            <OpenInNewIcon sx={{ fontSize: 14, ml: 'auto', opacity: 0.6 }} />
          </Box>
        </MenuItem>
      </SMenu>
    </>
  );
};

const SIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'open',
})<{ open: boolean }>(({ theme, open }) => {
  return {
    color: theme.palette.text.primary,
    ...(open && {
      border: theme.palette.border.main,
      color: theme.palette.primary.contrastText,
      backgroundColor: theme.palette.text.primary,
      '& > img': {
        filter: 'invert(1)',
      },
    }),
    '&:hover, &:focus': {
      '& > img': {
        filter: 'invert(1)',
      },
    },
  };
});

const SMenu = styled(MuiMenu)(({ theme }) => {
  return {
    zIndex: zIndex.HEADER + 1,
    marginTop: '1.5rem',
    '.MuiList-root.MuiList-padding.MuiMenu-list': {
      marginTop: '0rem',
    },
    '& .MuiListItemIcon-root': {
      color: theme.palette.text.primary,
    },
    '& .MuiList-root': {
      borderRadius: '0',
      padding: '0.8rem 2.4rem',
      minWidth: '30rem',
      border: '1px solid',
      borderColor: theme.palette.grey[900],
    },
    '& .MuiButtonBase-root:hover': {
      background: 'unset',
    },
    '& .Mui-disabled': {
      opacity: '1',
    },

    [theme.breakpoints.down('sm')]: {
      marginTop: '1.5rem',
    },
  };
});

const SMenuItem = styled(MenuItem)(() => ({
  padding: '1.6rem 0',
  fontSize: '1.6rem',
  fontWeight: 400,
  lineHeight: 'normal',

  '.copy-icon': {
    marginLeft: 'auto',
  },
}));
