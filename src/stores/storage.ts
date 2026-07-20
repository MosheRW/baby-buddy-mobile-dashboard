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
//
// Reads and writes are guarded: a keystore that is unavailable (locked device,
// a value written by a different signing key after a reinstall) must degrade to
// "no stored session" rather than throwing, because a rejected promise here
// stalls Zustand's rehydration and the app never finishes booting.
export const secureStorage: StateStorage =
  Platform.OS === 'web'
    ? asyncStorage
    : {
        getItem: async (name) => {
          try {
            return await SecureStore.getItemAsync(name);
          } catch (err) {
            console.warn(`[storage] secure read of "${name}" failed:`, err);
            return null;
          }
        },
        setItem: async (name, value) => {
          try {
            await SecureStore.setItemAsync(name, value);
          } catch (err) {
            console.warn(`[storage] secure write of "${name}" failed:`, err);
          }
        },
        removeItem: async (name) => {
          try {
            await SecureStore.deleteItemAsync(name);
          } catch {
            // Nothing to do — the value is already unreadable.
          }
        },
      };
