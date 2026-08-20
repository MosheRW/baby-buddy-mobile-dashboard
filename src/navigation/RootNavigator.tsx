import React, { useMemo } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { useAuthStore } from '../stores';
import { useTimerSync } from '../hooks/useTimers';
import { useNotificationSync } from '../hooks/useNotifications';
import { useApplyDefaultVisibility } from '../hooks/useApplyDefaultVisibility';
import { useShakeReveal } from '../hooks/useShakeReveal';
import type { MainStackParamList } from './types';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ScanLoginScreen } from '../features/shareInstance/ScanLoginScreen';
import { ShareInstanceScreen } from '../features/shareInstance/ShareInstanceScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { LogEntryScreen } from '../features/logEntry/LogEntryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { NotificationSettingsScreen } from '../features/settings/NotificationSettingsScreen';
import { AdvancedSettingsScreen } from '../features/settings/AdvancedSettingsScreen';
import { KidEditorScreen } from '../features/settings/KidEditorScreen';
import { GroupEditorScreen } from '../features/settings/GroupEditorScreen';
import { DeleteConfirmSheet } from '../features/deleteSheet/DeleteConfirmSheet';
import { MedBreakdownSheet } from '../features/medBreakdown/MedBreakdownSheet';
import { ContributionSheet } from '../features/contribution/ContributionSheet';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const { scheme, colors } = useTheme();
  // Memoized so `NavigationContainer` doesn't see a new `theme` identity on
  // every unrelated re-render (this component re-renders on the minute tick via
  // its sync hooks), which would make React Navigation redo work needlessly.
  //
  // `dark: true` is what stops React Navigation painting a white flash behind
  // the scenes during a push/modal transition, so the base theme has to switch
  // too — overriding the colours alone isn't enough.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.background,
        primary: colors.accent,
        text: colors.textPrimary,
      },
    };
  }, [scheme, colors]);
  // Above every screen, so a timer started elsewhere is already reconciled by
  // the time the dashboard or the form reads the store.
  useTimerSync();
  // Keeps the OS's scheduled reminders in step with data + settings.
  useNotificationSync();
  // Starts newly-appearing children hidden when that's the chosen default.
  useApplyDefaultVisibility();
  // Shake to temporarily reveal hidden children.
  useShakeReveal();

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
            <Stack.Screen name="Notifications" component={NotificationSettingsScreen} />
            <Stack.Screen name="AdvancedSettings" component={AdvancedSettingsScreen} />
            <Stack.Screen name="ShareInstance" component={ShareInstanceScreen} />
            <Stack.Screen name="KidEditor" component={KidEditorScreen} />
            <Stack.Screen name="GroupEditor" component={GroupEditorScreen} />
            <Stack.Screen
              name="DeleteConfirm"
              component={DeleteConfirmSheet}
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="MedBreakdown"
              component={MedBreakdownSheet}
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="Contribution"
              component={ContributionSheet}
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ScanLogin" component={ScanLoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
