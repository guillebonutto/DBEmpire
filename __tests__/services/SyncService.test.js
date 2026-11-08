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
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    rpc: jest.fn().mockResolvedValue({ data: { success: true }, error: null })
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

    it('generates distinct deterministic IDs for multiple lines of the same product within a sale', async () => {
      const payload = { id: 'sale_multi_1' };
      const metadata = {
        items: [
          { id: 'prod_same', qty: 2, unit_price: 100, color: 'Azul' },
          { id: 'prod_same', qty: 1, unit_price: 100, color: 'Rojo' }
        ]
      };
      await SyncService.queueAction('sale', payload, metadata, 'INSERT');

      expect(LocalDbService.saveItem).toHaveBeenCalledWith('sale_items', expect.objectContaining({
        id: 'sale_multi_1_prod_same_0',
        product_id: 'prod_same',
        color: 'Azul',
        quantity: 2
      }));

      expect(LocalDbService.saveItem).toHaveBeenCalledWith('sale_items', expect.objectContaining({
        id: 'sale_multi_1_prod_same_1',
        product_id: 'prod_same',
        color: 'Rojo',
        quantity: 1
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

    it('syncs product packaging costs and type to the remote schema', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const product = {
        id: 'product-packaging-1',
        name: 'Test Product',
        packaging_type: 'rfid',
        packaging_cost: 60,
        packaging_sticker_cost: 12
      };
      LocalDbService.getPendingSyncs.mockResolvedValueOnce([
        { id: 8, table_name: 'products', action: 'INSERT', payload: JSON.stringify(product), metadata: '{}' }
      ]);
      supabase.insert.mockResolvedValueOnce({ error: null });

      await SyncService.syncPending();

      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        packaging_type: 'rfid',
        packaging_cost: 60,
        packaging_sticker_cost: 12
      }));
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(8);
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
          payload: JSON.stringify({ id: '00000000-0000-4000-8000-000000000002', sale_location: 'local' }),
          metadata: JSON.stringify({ items: [{ id: 'p2', qty: 2 }] })
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      supabase.rpc.mockResolvedValueOnce({ data: { success: true, sale_id: 's2' }, error: null });

      await SyncService.syncPending();

      expect(supabase.rpc).toHaveBeenCalledWith('process_sale_atomic', expect.objectContaining({
        p_sale: expect.objectContaining({ id: '00000000-0000-4000-8000-000000000002' }),
        p_items: expect.arrayContaining([expect.objectContaining({ product_id: 'p2', quantity: 2 })]),
        p_location: 'local'
      }));
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

    it('preserves pending item in queue when remote operation fails', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const mockPending = [
        { id: 7, table_name: 'clients', action: 'UPDATE', payload: JSON.stringify({ id: 'client-fail', name: 'Fail' }), metadata: JSON.stringify({}) }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);

      const eqMock = jest.fn().mockRejectedValueOnce(new Error('Network Supabase 500'));
      supabase.update.mockReturnValue({ eq: eqMock });

      await SyncService.syncPending();

      expect(supabase.from).toHaveBeenCalledWith('clients');
      // removeSyncItem must NOT have been called because the sync operation threw an error
      expect(LocalDbService.removeSyncItem).not.toHaveBeenCalledWith(7);
    });

    it('avoids duplicating sale_items on retry if items already exist in remote Supabase', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const mockPending = [
        {
          id: 101,
          table_name: 'sales',
          action: 'INSERT',
          payload: JSON.stringify({ id: 's_retry_1', sale_location: 'local' }),
          metadata: JSON.stringify({ items: [{ id: 'p_retry_1', qty: 1 }] })
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);

      const dupError = new Error('duplicate key value violates unique constraint "sales_pkey"');
      dupError.code = '23505';
      supabase.insert.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({ data: null, error: dupError })
        })
      });

      // Simulate items already existing on remote
      supabase.select.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValueOnce({ data: [{ id: 'existing_item_1' }], error: null })
      });

      // Product stock lookup
      supabase.select.mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({ data: { stock_local: 5, stock_cordoba: 0, current_stock: 5 }, error: null })
        })
      });
      supabase.update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

      await SyncService.syncPending();

      expect(supabase.rpc).toHaveBeenCalledWith('process_sale_atomic', expect.objectContaining({
        p_sale: expect.objectContaining({ id: expect.any(String) })
      }));
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(101);
    });

    it('strips joined and local fields when processing generic UPDATE on sales', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const mockPending = [
        {
          id: 102,
          table_name: 'sales',
          action: 'UPDATE',
          payload: JSON.stringify({
            id: 'sale_debt_1',
            status: 'completed',
            paid_at: '2026-10-25T20:00:00Z',
            payment_method: 'Efectivo',
            clients: { name: 'Juan Perez' },
            profiles: { full_name: 'Admin' },
            sale_items: [{ id: 'si1' }]
          }),
          metadata: JSON.stringify({})
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);

      const eqMock = jest.fn().mockResolvedValue({ error: null });
      supabase.update.mockReturnValue({ eq: eqMock });

      await SyncService.syncPending();

      expect(supabase.from).toHaveBeenCalledWith('sales');
      expect(supabase.update).toHaveBeenCalledWith({
        status: 'completed',
        paid_at: '2026-10-25T20:00:00Z'
      });
      expect(eqMock).toHaveBeenCalledWith('id', 'sale_debt_1');
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(102);
    });
  });

  describe('getQueueCount', () => {
    it('returns the number of pending items', async () => {
      LocalDbService.getPendingSyncs.mockResolvedValueOnce([1, 2, 3]);
      const count = await SyncService.getQueueCount();
      expect(count).toBe(3);
    });
  });

  describe('Priority 1: Idempotent Sale Sync Scenarios (Transactional RPC)', () => {
    it('Scenario 1: Sale and all items save successfully via process_sale_atomic without duplicates', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const saleId = '00000000-0000-4000-8000-000000000001';
      const mockPending = [
        {
          id: 201,
          table_name: 'sales',
          action: 'INSERT',
          payload: JSON.stringify({ id: saleId, sale_location: 'local', total_amount: 500 }),
          metadata: JSON.stringify({
            items: [
              { id: 'prod_1', qty: 2, sale_price: 150 },
              { id: 'prod_2', qty: 1, sale_price: 200 }
            ]
          })
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      supabase.rpc.mockResolvedValueOnce({ data: { success: true, sale_id: saleId }, error: null });

      await SyncService.syncPending();

      expect(supabase.rpc).toHaveBeenCalledWith('process_sale_atomic', expect.objectContaining({
        p_sale: expect.objectContaining({ id: saleId, total_amount: 500 }),
        p_items: expect.arrayContaining([
          expect.objectContaining({ product_id: 'prod_1', quantity: 2 }),
          expect.objectContaining({ product_id: 'prod_2', quantity: 1 })
        ]),
        p_location: 'local'
      }));
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(201);
    });

    it('Scenario 2: Network drops during RPC call; item remains in queue until retry succeeds', async () => {
      const saleId = '00000000-0000-4000-8000-000000000002';
      const mockPendingItem = {
        id: 202,
        table_name: 'sales',
        action: 'INSERT',
        payload: JSON.stringify({ id: saleId, sale_location: 'local', total_amount: 300 }),
        metadata: JSON.stringify({
          items: [{ id: 'prod_1', qty: 2, sale_price: 150 }]
        })
      };

      // Run 1: Network drop / rejection in RPC
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      LocalDbService.getPendingSyncs.mockResolvedValueOnce([mockPendingItem]);
      supabase.rpc.mockRejectedValueOnce(new Error('Network request failed'));

      await SyncService.syncPending();

      // Queue item must NOT be removed when RPC fails
      expect(LocalDbService.removeSyncItem).not.toHaveBeenCalledWith(202);

      // Run 2: Retry succeeds
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      LocalDbService.getPendingSyncs.mockResolvedValueOnce([mockPendingItem]);
      supabase.rpc.mockResolvedValueOnce({ data: { success: true, sale_id: saleId }, error: null });

      await SyncService.syncPending();

      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(202);
    });

    it('Scenario 3: Sale and legacy/partial items in queue are converted with stable UUIDs', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const saleId = '00000000-0000-4000-8000-000000000003';
      const mockPending = [
        {
          id: 203,
          table_name: 'sales',
          action: 'INSERT',
          payload: JSON.stringify({ id: saleId, sale_location: 'local', total_amount: 400 }),
          metadata: JSON.stringify({
            items: [
              { id: 'prod_1', qty: 2, item_id: '00000000-0000-4000-8000-00000000000a' },
              { id: 'prod_missing', qty: 1 } // legacy item without explicit item_id
            ]
          })
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      supabase.rpc.mockResolvedValueOnce({ data: { success: true, sale_id: saleId }, error: null });

      await SyncService.syncPending();

      expect(supabase.rpc).toHaveBeenCalledWith('process_sale_atomic', expect.objectContaining({
        p_items: expect.arrayContaining([
          expect.objectContaining({ id: '00000000-0000-4000-8000-00000000000a', product_id: 'prod_1' }),
          expect.objectContaining({ id: expect.stringMatching(/^[0-9a-f-]{36}$/i), product_id: 'prod_missing' })
        ])
      }));
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(203);
    });

    it('Scenario 4: Sale already exists remotely; process_sale_atomic resolves idempotently', async () => {
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
      const saleId = '00000000-0000-4000-8000-000000000004';
      const mockPending = [
        {
          id: 204,
          table_name: 'sales',
          action: 'INSERT',
          payload: JSON.stringify({ id: saleId, sale_location: 'local', total_amount: 150 }),
          metadata: JSON.stringify({
            items: [{ id: 'prod_1', qty: 1, sale_price: 150 }]
          })
        }
      ];
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      supabase.rpc.mockResolvedValueOnce({ data: { success: true, sale_id: saleId }, error: null });

      await SyncService.syncPending();

      expect(supabase.rpc).toHaveBeenCalledWith('process_sale_atomic', expect.objectContaining({
        p_sale: expect.objectContaining({ id: saleId })
      }));
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(204);
    });

    it('Scenario 5: Same sale processed twice from local queue; both calls succeed idempotently', async () => {
      const saleId = '00000000-0000-4000-8000-000000000005';
      const mockPending = [
        {
          id: 205,
          table_name: 'sales',
          action: 'INSERT',
          payload: JSON.stringify({ id: saleId, sale_location: 'local', total_amount: 100 }),
          metadata: JSON.stringify({ items: [{ id: 'prod_1', qty: 1, sale_price: 100 }] })
        },
        {
          id: 206,
          table_name: 'sales',
          action: 'INSERT',
          payload: JSON.stringify({ id: saleId, sale_location: 'local', total_amount: 100 }),
          metadata: JSON.stringify({ items: [{ id: 'prod_1', qty: 1, sale_price: 100 }] })
        }
      ];

      NetInfo.fetch.mockResolvedValue({ isConnected: true });
      LocalDbService.getPendingSyncs.mockResolvedValueOnce(mockPending);
      supabase.rpc
        .mockResolvedValueOnce({ data: { success: true, sale_id: saleId }, error: null })
        .mockResolvedValueOnce({ data: { success: true, sale_id: saleId }, error: null });

      await SyncService.syncPending();

      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(205);
      expect(LocalDbService.removeSyncItem).toHaveBeenCalledWith(206);
    });
  });
});
