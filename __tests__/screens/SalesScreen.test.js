import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import SalesScreen from '../../src/screens/SalesScreen';
import { useFinanceStore } from '../../src/store/useFinanceStore';
import { useProductStore } from '../../src/store/useProductStore';
import { SyncService } from '../../src/services/syncService';
import { LocalDbService } from '../../src/services/localDbService';
import { supabase } from '../../src/services/supabase';
import { Alert, InteractionManager } from 'react-native';
import * as pdfHelper from '../../src/utils/pdfHelper';

// Mock dependencies
jest.mock('../../src/store/useFinanceStore', () => ({
  useFinanceStore: jest.fn(),
}));

jest.mock('../../src/store/useProductStore', () => ({
  useProductStore: {
    getState: jest.fn(),
    setState: jest.fn(),
  }
}));

jest.mock('../../src/services/syncService', () => ({
  SyncService: {
    queueAction: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../src/services/localDbService', () => ({
  LocalDbService: {
    saveItems: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis()
    }))
  }
}));

jest.mock('../../src/utils/pdfHelper', () => ({
  printOrSharePDF: jest.fn().mockResolvedValue(true)
}));

jest.spyOn(Alert, 'alert');

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('SalesScreen', () => {
  let mockFetchAllData;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFetchAllData = jest.fn();

    // Mock InteractionManager to execute synchronously
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((cb) => cb());

    useFinanceStore.mockReturnValue({
      sales: [
        { 
          id: 'sale-1', 
          total_amount: 100, 
          status: 'completed', 
          created_at: new Date().toISOString(),
          clients: { name: 'John Doe' },
          sale_items: [{ product_id: 'prod-1', quantity: 1, unit_price_at_sale: 100, products: { name: 'Prod A' } }]
        },
        { 
          id: 'sale-2', 
          total_amount: 50, 
          status: 'budget', 
          created_at: new Date().toISOString(),
          clients: { name: 'Jane Doe' },
          sale_items: []
        },
        { 
          id: 'sale-3', 
          total_amount: 200, 
          status: 'pending', 
          created_at: new Date().toISOString(),
          clients: { name: 'Mike' },
          sale_items: []
        }
      ],
      isLoading: false,
      fetchAllData: mockFetchAllData,
    });
    
    useFinanceStore.setState = jest.fn();

    useProductStore.getState.mockReturnValue({
      products: [
        { id: 'prod-1', name: 'Prod A', current_stock: 10, stock_local: 5, stock_cordoba: 5 }
      ],
      fetchProducts: jest.fn()
    });
  });

  it('renders correctly and fetches data on focus', async () => {
    const { getByPlaceholderText, getByText } = render(
      <NavigationContainer>
        <SalesScreen navigation={mockNavigation} />
      </NavigationContainer>
    );
    
    expect(getByPlaceholderText('Buscar por cliente o ID...')).toBeTruthy();
    expect(mockFetchAllData).toHaveBeenCalled();
    
    // Shows completed sales by default
    expect(getByText('Venta #sale')).toBeTruthy(); // id is sliced
    expect(getByText(/John Doe/)).toBeTruthy();
  });

  it('filters sales by search query', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <NavigationContainer>
        <SalesScreen navigation={mockNavigation} />
      </NavigationContainer>
    );
    
    const searchInput = getByPlaceholderText('Buscar por cliente o ID...');
    
    act(() => {
      fireEvent.changeText(searchInput, 'John');
    });

    expect(getByText(/John Doe/)).toBeTruthy();
    
    // Change tab to verify 'budget' filtering
    const tabPresupuestos = getByText('📝 PRESUPUESTOS');
    act(() => {
      fireEvent.press(tabPresupuestos);
    });

    // Clear search manually in code simulation
    act(() => {
      fireEvent.changeText(searchInput, 'Jane');
    });

    expect(getByText(/Jane Doe/)).toBeTruthy();
    expect(queryByText(/John Doe/)).toBeNull();
  });

  it('expands sale item to show details and buttons', async () => {
    const { getByText, queryByText, getAllByText } = render(
      <NavigationContainer>
        <SalesScreen navigation={mockNavigation} />
      </NavigationContainer>
    );

    // Click the sale item to expand
    const saleItems = getAllByText('Venta #sale');
    act(() => {
      fireEvent.press(saleItems[0]);
    });

    // Details should be visible
    expect(getByText('Prod A')).toBeTruthy();
    expect(getByText('x1')).toBeTruthy();
    expect(getByText('ANULAR')).toBeTruthy();
  });

  it('handles cancel sale correctly', async () => {
    const { getAllByText, getByText } = render(
      <NavigationContainer>
        <SalesScreen navigation={mockNavigation} />
      </NavigationContainer>
    );

    // Expand
    const saleItems = getAllByText('Venta #sale');
    act(() => {
      fireEvent.press(saleItems[0]);
    });

    // Press Anular
    act(() => {
      fireEvent.press(getByText('ANULAR'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Anular Venta',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'SÍ, ANULAR' })
      ])
    );

    // Simulate clicking SÍ, ANULAR
    const confirmButton = Alert.alert.mock.calls[0][2].find(b => b.text === 'SÍ, ANULAR');
    await act(async () => {
      await confirmButton.onPress();
    });

    // Verify background sync
    await waitFor(() => {
      expect(useFinanceStore.setState).toHaveBeenCalled();
      expect(SyncService.queueAction).toHaveBeenCalledWith('sale', expect.objectContaining({ status: 'cancelled' }), {}, 'UPDATE');
    });
  });

  it('handles convert budget to sale correctly', async () => {
    const { getByText, getAllByText } = render(
      <NavigationContainer>
        <SalesScreen navigation={mockNavigation} />
      </NavigationContainer>
    );

    // Go to Presupuestos Tab
    act(() => {
      fireEvent.press(getByText('📝 PRESUPUESTOS'));
    });

    // Expand budget
    const saleItems = getAllByText('Venta #sale');
    act(() => {
      fireEvent.press(saleItems[0]); // Jane Doe budget
    });

    act(() => {
      fireEvent.press(getByText('COBRAR PRESUPUESTO'));
    });

    // Confirm alert
    const confirmButton = Alert.alert.mock.calls[0][2].find(b => b.text === 'SÍ, CONVERTIR');
    
    // Mock supabase update to succeed
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockReturnThis()
    }).mockReturnValueOnce({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null })
    });

    await act(async () => {
      await confirmButton.onPress();
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('✅ Convertido', 'Venta finalizada con éxito.');
      expect(mockFetchAllData).toHaveBeenCalled();
    });
  });

  it('generates PDF correctly', async () => {
    const { getByText, getAllByText } = render(
      <NavigationContainer>
        <SalesScreen navigation={mockNavigation} />
      </NavigationContainer>
    );

    // Expand
    const saleItems = getAllByText('Venta #sale');
    act(() => {
      fireEvent.press(saleItems[0]);
    });

    act(() => {
      fireEvent.press(getByText('DESCARGAR PDF'));
    });

    await waitFor(() => {
      expect(pdfHelper.printOrSharePDF).toHaveBeenCalled();
    });
  });
});
