import { create } from 'zustand';
import { User } from '@/types';

interface AuthStore {
  user:      User | null;
  loading:   boolean;
  setUser:   (user: User | null) => void;
  setLoading:(v: boolean) => void;
  signOut:   () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:    null,
  loading: true,
  setUser:    (user)    => set({ user }),
  setLoading: (loading) => set({ loading }),
  signOut:    ()        => set({ user: null }),
}));
