import { create } from 'zustand';

type UiState = {
  isSafetyNoticeVisible: boolean;
  setSafetyNoticeVisible: (visible: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  isSafetyNoticeVisible: true,
  setSafetyNoticeVisible: (isSafetyNoticeVisible) => set({ isSafetyNoticeVisible }),
}));
