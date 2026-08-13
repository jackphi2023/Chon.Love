import type { ReactNode } from 'react';
import { Modal } from 'react-native';

export function LuxyModalLayer({
  children,
  onRequestClose,
  visible,
}: {
  children: ReactNode;
  onRequestClose: () => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible={visible}>
      {children}
    </Modal>
  );
}
