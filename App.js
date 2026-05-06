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
    const initApp = async () => {
      try {
        await DatabaseInitService.init();
        await GlobalDataService.preloadAll(); // Download and cache all DB
        
        // Initialize Stores sequentially from local cache
        await useFinanceStore.getState().initStore();
        await useProductStore.getState().initStore();
        await useClientStore.getState().initStore();
        console.log('🚀 Empire App Initialized Successfully');
      } catch (err) {
        console.error('Initialization failed:', err);
      }
    };
    initApp();
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
