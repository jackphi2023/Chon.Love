import { StyleSheet } from 'react-native';

declare module 'react-native' {
  // TypeScript module augmentation requires this namespace to extend React Native's StyleSheet type.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace StyleSheet {
    const absoluteFillObject: typeof absoluteFill;
  }
}

const compatibleStyleSheet = StyleSheet as typeof StyleSheet & {
  absoluteFillObject?: typeof StyleSheet.absoluteFill;
};

if (!compatibleStyleSheet.absoluteFillObject) {
  Object.defineProperty(compatibleStyleSheet, 'absoluteFillObject', {
    configurable: true,
    enumerable: true,
    value: StyleSheet.absoluteFill,
  });
}
