import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';

import { DatabaseInitService } from './src/services/DatabaseInitService';
import { GlobalDataService } from './src/services/GlobalDataService';
import { useFinanceStore } from './src/store/useFinanceStore';
import { useProductStore } from './src/store/useProductStore';
import { useClientStore } from './src/store/useClientStore';

export default function App() {
  React.useEffect(() => {
    DatabaseInitService.init();
    GlobalDataService.preloadAll(); // Download and cache all DB
    
    // Initialize Stores from local cache
    useFinanceStore.getState().initStore();
    useProductStore.getState().initStore();
    useClientStore.getState().initStore();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
