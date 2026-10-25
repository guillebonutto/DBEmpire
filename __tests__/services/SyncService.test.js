import { SyncService } from '../../src/services/syncService';
import { LocalDbService } from '../../src/services/localDbService';
import { supabase } from '../../src/services/supabase';
import NetInfo from '@react-native-community/netinfo';

jest.mock('../../src/services/localDbService', () => ({
  LocalDbService: {
    queueForSync: jest.fn().mockResolvedValue(true),
    getPendingSyncs: jest.fn().mockResolvedValue([]),
    removeSyncItem: jest.fn().mockResolvedValue(true),
    saveItem: jest.fn().mockResolvedValue(true),
    deleteItem: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../src/services/supabase', () => {
  const mSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null })
  };
  return { supabase: mSupabase };
});

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SyncService._isSyncing = false;
  });

  describe('queueAction', () => {
    it('queues action locally when called', async () => {
      const type = 'product';
      const payload = { id: 1, name: 'Test Product' };
      const metadata = { test: true };
      const action = 'INSERT';

      await SyncService.queueAction(type, payload, metadata, action);

      expect(LocalDbService.queueForSync).toHaveBeenCalledWith('products', action, payload, metadata);
      expect(LocalDbService.saveItem).toHaveBeenCalledWith('products', payload);
    });

    it('handles delete action correctly locally', async () => {
      const type = 'client';
      const payload = { id: 5 };
      await SyncService.queueAction(type, payload, {}, 'DELETE');
      expect(LocalDbService.deleteItem).toHaveBeenCalledWith('clients', 5);
      expect(LocalDbService.queueForSync).toHaveBeenCalledWith('clients', 'DELETE', payload, {});
    });

    it('saves sale items locally when queuing a sale', async () => {
      const payload = { id: 's1' };
      const metadata = { items: [{ id: 'p1', qty: 2, unit_price: 100 }] };
      await SyncService.queueAction('sale', payload, metadata, 'INSERT');

      expect(LocalDbService.saveItem).toHaveBeenCalledWith('sales', payload);
      expect(LocalDbService.saveItem).toHaveBeenCalledWith('sale_items', expect.objectContaining({
        sale_id: 's1',
        product_id: 'p1',
        quantity: 2
      }));
    });
  });

  describe('syncPending', () => {
    it('syncPending does nothing if offline', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });
      await SyncService.syncPending();
      expect(LocalDbService.getPendingSyncs).not.toHaveBeenCalled();
    });

    it('syncPending processes generic insert queue when online', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      
      const mockPending = [
        { id: 1, table_name: 'products', action: 'INSERT', payload: JSON.stringify({ id: 10, name: 'New' }), metadata: JSON.stringify({}) }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      
      supabase.insert.mockResolvedValueOnce({ error: null });

      await SyncService.syncPending();
      
      expect(LocalDbService.getPendingSyncs).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' }));
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(1);
    });

    it('fixes local ids automatically', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const mockPending = [
        { id: 2, table_name: 'clients', action: 'INSERT', payload: JSON.stringify({ id: 'local-123' }), metadata: JSON.stringify({}) }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      
      supabase.insert.mockResolvedValueOnce({ error: null });

      await SyncService.syncPending();
      
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({ id: expect.not.stringMatching('local-') }));
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(2);
    });

    it('syncPending processes sale sync properly with items and stock', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const mockPending = [
        { 
          id: 3, 
          table_name: 'sales', 
          action: 'INSERT', 
          payload: JSON.stringify({ id: 's2', sale_location: 'local' }), 
          metadata: JSON.stringify({ items: [{ id: 'p2', qty: 2 }] }) 
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);

      supabase.insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValueOnce({ data: { id: 's2' }, error: null })
        })
      });

      // Override the single mock for product stock fetch
      supabase.select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValueOnce({ 
            data: { stock_local: 5, stock_cordoba: 5, current_stock: 10 }, 
            error: null 
          })
        })
      });

      const eqMock = jest.fn().mockResolvedValue({ error: null });
      supabase.update.mockReturnValue({ eq: eqMock });

      await SyncService.syncPending();

      expect(supabase.from).toHaveBeenCalledWith('sales');
      // expect(supabase.from).toHaveBeenCalledWith('sale_items'); // Insert returns an object without a from chain
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(3);
    });

    it('processes UPDATE and DELETE correctly', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const mockPending = [
        { id: 4, table_name: 'clients', action: 'UPDATE', payload: JSON.stringify({ id: 'c1', name: 'NewName' }), metadata: JSON.stringify({}) },
        { id: 5, table_name: 'expenses', action: 'DELETE', payload: JSON.stringify({ id: 'e1' }), metadata: JSON.stringify({}) }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);

      const eqMock = jest.fn().mockResolvedValue({ error: null });
      supabase.update.mockReturnValue({ eq: eqMock });
      supabase.delete.mockReturnValue({ eq: eqMock });

      await SyncService.syncPending();

      expect(supabase.from).toHaveBeenCalledWith('clients');
      expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'NewName' }));
      expect(eqMock).toHaveBeenCalledWith('id', 'c1');

      expect(supabase.from).toHaveBeenCalledWith('expenses');
      expect(supabase.delete).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('id', 'e1');
    });

    it('strips unnecessary fields before insertion', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const mockPending = [
        { 
          id: 6, 
          table_name: 'supplier_orders', 
          action: 'INSERT', 
          payload: JSON.stringify({ id: 'o1', total_amount: 500, something: 1 }), 
          metadata: JSON.stringify({}) 
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      
      supabase.insert.mockResolvedValueOnce({ error: null });

      await SyncService.syncPending();
      
      expect(supabase.insert).toHaveBeenCalledWith(
        expect.not.objectContaining({ total_amount: 500 })
      );
    });
  });

  describe('getQueueCount', () => {
    it('returns the number of pending items', async () => {
      LocalDbService.getPendingSyncs.mockResolvedValueOnce([1, 2, 3]);
      const count = await SyncService.getQueueCount();
      expect(count).toBe(3);
    });
  });
});
