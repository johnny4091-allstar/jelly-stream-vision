import { Platform } from 'react-native';

// Widgets exist only on Android; the library is loaded lazily so the web preview still builds.

/** Redraws every News Hammer widget on the home screen with the latest data. */
export async function updateWidgets(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  const { WIDGET_NAMES, buildWidget } = require('./handler') as typeof import('./handler');
  for (const widgetName of WIDGET_NAMES) await requestWidgetUpdate({ widgetName, renderWidget: () => buildWidget(widgetName) }).catch(() => {});
}

/** Lets Android draw the widgets while the app is closed. Called once at startup (index.ts). */
export function registerWidgets(): void {
  if (Platform.OS !== 'android') return;
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  registerWidgetTaskHandler((require('./handler') as typeof import('./handler')).widgetTaskHandler);
}

/**
 * Asks the launcher to add a widget to the home screen. Resolves false where the launcher can't,
 * so the caller can explain the long-press way instead.
 */
export async function addWidget(widgetName: 'TopStory' | 'Weather' | 'YourTeam'): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const { requestPinWidget } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  return requestPinWidget({ widgetName }).catch(() => false);
}
