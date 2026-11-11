// First, so a crash anywhere after this shows the recovery screen instead of closing the app.
import './src/crashGuard';
import { registerRootComponent } from 'expo';

import App from './App';
// Defines the background news check; it has to load before anything else so Android can run it.
import './src/services/notifications';
import { registerWidgets } from './src/widgets';

// Home screen widgets are drawn by this JS too, even while the app is closed.
registerWidgets();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
