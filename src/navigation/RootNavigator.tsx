import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { useAuthStore } from '../stores';
import type { MainStackParamList } from './types';
import { LoginScreen } from '../features/auth/LoginScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { LogEntryScreen } from '../features/logEntry/LogEntryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { DeleteConfirmSheet } from '../features/deleteSheet/DeleteConfirmSheet';

const Stack = createNativeStackNavigator<MainStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: colors.accent,
    text: colors.textPrimary,
  },
};

export function RootNavigator() {
  const session = useAuthStore((s) => s.session);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen
              name="LogEntry"
              component={LogEntryScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="DeleteConfirm"
              component={DeleteConfirmSheet}
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
