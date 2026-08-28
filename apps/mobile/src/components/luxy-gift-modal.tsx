import type { ComponentProps } from 'react';
import { useRef } from 'react';
import { ChonGiftModal } from '@/components/chon-gift-modal';

type ChonGiftModalProps = ComponentProps<typeof ChonGiftModal>;

/**
 * Compatibility adapter for the existing Chat surface.
 *
 * ChonGiftModal owns the complete OPT-09 transaction state machine and emits `onSent`
 * as soon as the server confirms the transaction. Legacy Chat historically used that
 * callback to close the picker immediately. Keep Chat's refresh callback, but defer it
 * until the result screen is dismissed so all entry points preserve the same
 * catalog -> confirmation -> server result UX without duplicating transaction logic.
 */
export function LuxyGiftModal(props: ChonGiftModalProps) {
  const confirmedRef = useRef(false);

  return (
    <ChonGiftModal
      {...props}
      onClose={() => {
        const confirmed = confirmedRef.current;
        confirmedRef.current = false;
        if (confirmed) props.onSent?.();
        props.onClose();
      }}
      onSent={() => {
        confirmedRef.current = true;
      }}
    />
  );
}
