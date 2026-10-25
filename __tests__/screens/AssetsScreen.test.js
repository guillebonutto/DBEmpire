import React from 'react';
import { render } from '@testing-library/react-native';
import AssetsScreen from '../../src/screens/AssetsScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock dependencies to prevent errors during rendering
jest.mock('../../src/services/geminiService', () => ({
    GeminiService: { handleGeneralRequest: jest.fn() }
}));
jest.mock('../../src/services/supabase', () => ({
    supabase: { storage: { from: jest.fn() } }
}));
jest.mock('../../src/services/deviceAuth', () => ({
    DeviceAuthService: { getDeviceSignature: jest.fn() }
}));
jest.mock('../../src/services/syncService', () => ({
    SyncService: { queueAction: jest.fn() }
}));

describe('AssetsScreen', () => {
    it('renders without syntax errors and displays the header', () => {
        const mockNavigation = { goBack: jest.fn() };
        
        // Wrap with SafeAreaProvider as it's used inside the screen
        const { getByText } = render(
            <SafeAreaProvider initialSafeAreaInsets={{ top: 0, left: 0, right: 0, bottom: 0 }}>
                <AssetsScreen navigation={mockNavigation} />
            </SafeAreaProvider>
        );

        // Verify the screen renders and the header text is present
        // If there was a syntax error (like the duplicate 'decode' const), 
        // this test would fail to even compile before reaching this assertion.
        expect(getByText('CREADOR DE CONTENIDO')).toBeTruthy();
    });
});
