/**
 * Persistence adapters for Zustand's `persist` middleware.
 * - `asyncStorage`: non-secret preferences (settings, running timers).
 * - `secureStorage`: secrets (auth session/token) via expo-secure-store.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

export const asyncStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};

// expo-secure-store is unavailable on web; fall back to AsyncStorage there.
// On the Android target this uses the real Keystore-backed secure store.
export const secureStorage: StateStorage =
  Platform.OS === 'web'
    ? asyncStorage
    : {
        getItem: (name) => SecureStore.getItemAsync(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
      };
