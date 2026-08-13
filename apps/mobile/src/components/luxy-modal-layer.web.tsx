import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { View, type ViewStyle } from 'react-native';

const webRootStyle = {
  bottom: 0,
  flex: 1,
  left: 0,
  position: 'fixed',
  right: 0,
  top: 0,
  zIndex: 2147483647,
} as unknown as ViewStyle;

export function LuxyModalLayer({
  children,
  onRequestClose,
  visible,
}: {
  children: ReactNode;
  onRequestClose: () => void;
  visible: boolean;
}) {
  useEffect(() => {
    if (!visible || typeof window === 'undefined') return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRequestClose, visible]);

  if (!visible || typeof document === 'undefined') return null;
  return createPortal(<View style={webRootStyle}>{children}</View>, document.body);
}
