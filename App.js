import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';

import CustomAlert from './src/components/CustomAlert';
import { useAlert } from './src/hooks/useAlert';
import { DatabaseInitService } from './src/services/DatabaseInitService';
import { GlobalDataService } from './src/services/GlobalDataService';
import { useFinanceStore } from './src/store/useFinanceStore';
import { useProductStore } from './src/store/useProductStore';
import { useClientStore } from './src/store/useClientStore';
import { useReminderStore } from './src/store/useReminderStore';
import AgendaWidget from './src/components/AgendaWidget';

import { checkUalaListenerPermission } from './src/services/UalaNotificationListener';

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
        await useReminderStore.getState().initStore();
        console.log('🚀 Empire App Initialized Successfully');
        await checkUalaListenerPermission();
      } catch (err) {
        console.error('Initialization failed:', err);
      }
    };
    initApp();
  }, []);
  const { alertProps } = useAlert();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="auto" />
        <CustomAlert {...alertProps} />
      </NavigationContainer>
      <AgendaWidget />
    </SafeAreaProvider>
  );
}
