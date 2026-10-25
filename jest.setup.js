import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo SQLite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execAsync: jest.fn().mockResolvedValue(true),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  })),
}));

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

// Mock React Native Alert
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  rn.Alert.alert = jest.fn();
  return rn;
});



// Mock Network info
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(),
}));
