import { registerRootComponent } from 'expo';

import App from './App';
import { defineBackgroundTask } from './src/notifications/backgroundTask';

// Register the background-refresh task executor at JS init — at module scope, not
// inside a React effect — so it's defined before the OS invokes it, including on a
// headless WorkManager cold start where no UI mounts. It's internally guarded
// (no-op on web/Expo Go, lazy native require), so this is safe everywhere.
// Registration (turning the periodic job on) stays opt-in; see backgroundTask.ts.
defineBackgroundTask();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
