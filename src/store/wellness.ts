import { create } from 'zustand';

interface WellnessState {
  visible: boolean;
  /** Minutes of continuous play shown in the advisor. */
  minutes: number;
  show: (minutes: number) => void;
  dismiss: () => void;
}

/** The Wellness Advisor's visibility. In memory only; the tracker decides when to show it. */
export const useWellness = create<WellnessState>((set) => ({
  visible: false,
  minutes: 0,
  show: (minutes) => set({ visible: true, minutes }),
  dismiss: () => set({ visible: false }),
}));
