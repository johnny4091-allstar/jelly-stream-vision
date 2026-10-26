import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  /** Shown instead of the children after an error; nothing by default. */
  fallback?: ReactNode;
}

/**
 * Keeps a weather problem from closing the app: if the weather UI throws while drawing, show the
 * fallback instead and log the error (logcat's ReactNativeJS, which the emulator test reads).
 */
export class WeatherBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[weather] UI error: ${error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)}`);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export function WeatherUnavailable({ color }: { color: string }) {
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color }]}>Weather isn't available right now.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 24, alignItems: 'center' },
  text: { fontSize: 15 },
});
