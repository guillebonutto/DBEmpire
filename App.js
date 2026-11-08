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
import { navigationRef } from './src/navigation/navigationRef';

import { checkUalaListenerPermission } from './src/services/UalaNotificationListener';
import { OtaUpdateService } from './src/services/OtaUpdateService';
import { SyncService } from './src/services/syncService';

export default function App() {
  React.useEffect(() => {
    let timer = null;
    let isMounted = true;
    const refreshStoresFromLocalCache = async () => {
      await Promise.all([
        useFinanceStore.getState().initStore(true),
        useProductStore.getState().initStore(true),
        useClientStore.getState().initStore(true),
        useReminderStore.getState().initStore(true)
      ]);
      const refreshedAt = Date.now();
      useFinanceStore.setState({ lastFetch: refreshedAt });
      useProductStore.setState({ lastFetch: refreshedAt });
    };
    const initApp = async () => {
      try {
        // 1. Instant UI Hydration: initialize from the local SQLite cache first.
        // Remote schema work must never hold the first usable screen hostage.
        await Promise.all([
          useFinanceStore.getState().initStore(),
          useProductStore.getState().initStore(),
          useClientStore.getState().initStore(),
          useReminderStore.getState().initStore()
        ]);
        if (!isMounted) return;
        console.log('🚀 Empire App Initialized Successfully from Local Cache');
        GlobalDataService.schedulePreload();

        // 2. Background sync & secondary tasks deferred without blocking UI
        timer = setTimeout(() => {
          if (!isMounted) return;
          DatabaseInitService.init().catch(e => console.log('Background schema init:', e?.message));
          SyncService.syncPending().catch(e => console.log('Background syncPending:', e?.message));
          GlobalDataService.preloadAll()
            .then(didSync => didSync && isMounted ? refreshStoresFromLocalCache() : null)
            .catch(e => console.log('Background preload:', e?.message));
          checkUalaListenerPermission().catch(() => {});
          OtaUpdateService.runAutoCheck().catch(() => {});
        }, 400);
      } catch (err) {
        console.error('Initialization failed:', err);
      }
    };
    initApp();
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  const { alertProps } = useAlert();

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
        <StatusBar style="auto" />
        <CustomAlert {...alertProps} />
        <AgendaWidget />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
