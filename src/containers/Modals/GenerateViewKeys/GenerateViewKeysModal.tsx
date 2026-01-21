'use client';

import { BaseModal } from '~/components';
import { ModalType } from '~/types';
import { GenerateViewKeysForm } from './GenerateViewKeysForm';

export const GenerateViewKeysModal = () => {
  return (
    <BaseModal size='large' type={ModalType.VIEW_KEYS} hasBackground>
      <GenerateViewKeysForm />
    </BaseModal>
  );
};
