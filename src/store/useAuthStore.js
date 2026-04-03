import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create(
    persist(
        (set) => ({
            userRole: null,
            setUserRole: (role) => set({ userRole: role }),
            clearUserRole: () => set({ userRole: null })
        }),
        {
            name: 'empire-auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
