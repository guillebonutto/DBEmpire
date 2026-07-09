import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'empire_local.db')

if not os.path.exists(db_path):
    print(f"Error: Database file not found at {db_path}")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Let's inspect all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Tables in DB: {tables}")
    
    # Query recent sales
    if 'sales' in tables:
        cursor.execute("SELECT id, total_amount, payment_method, status, created_at, notes FROM sales ORDER BY created_at DESC LIMIT 20;")
        sales = cursor.fetchall()
        print(f"\n--- LATEST 20 SALES ---")
        for s in sales:
            print(f"ID: {s[0]} | Amount: {s[1]} | Method: {s[2]} | Status: {s[3]} | Created: {s[4]} | Notes: {s[5]}")
            
            # Print items of this sale
            cursor.execute("SELECT product_id, quantity, unit_price_at_sale, subtotal, color FROM sale_items WHERE sale_id = ?;", (s[0],))
            items = cursor.fetchall()
            for it in items:
                print(f"    -> Product: {it[0]} | Qty: {it[1]} | Price: {it[2]} | Subtotal: {it[3]} | Color: {it[4]}")
    else:
        print("No 'sales' table found!")

    # Query pending syncs
    if 'pending_sync' in tables:
        cursor.execute("SELECT id, table_name, action, payload, created_at FROM pending_sync ORDER BY created_at DESC LIMIT 10;")
        syncs = cursor.fetchall()
        print(f"\n--- LATEST 10 PENDING SYNCS ---")
        for s in syncs:
            print(f"ID: {s[0]} | Table: {s[1]} | Action: {s[2]} | Created: {s[4]}")
            print(f"  Payload: {s[3][:200]}...")
    else:
        print("No 'pending_sync' table found!")
        
    conn.close()
except Exception as e:
    print(f"Error reading database: {e}")

