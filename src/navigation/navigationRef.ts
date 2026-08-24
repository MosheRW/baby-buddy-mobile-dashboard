/**
 * A navigation handle reachable from outside the component tree — specifically
 * `useNotificationActions`, which reacts to a notification-action tap (e.g.
 * "stop timer"/"add now" on a forgotten-timer/diaper/food reminder, see
 * `src/notifications/service.ts`). That listener can fire before `Dashboard`
 * ever mounts (a cold start from a killed app), so it can't go through a
 * component-local callback the way the in-app carousel's `openNotification`
 * does — it needs a ref that exists independent of any screen.
 *
 * `navigationRef.isReady()` is false until `NavigationContainer` mounts; a tap
 * that races the very first paint is simply dropped rather than queued — an
 * edge case not worth the complexity of a pending-action queue for a feature
 * whose entire value is "get me to the right screen right now".
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { MainStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<MainStackParamList>();
