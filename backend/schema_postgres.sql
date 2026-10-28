CREATE TABLE IF NOT EXISTS canteens (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, organization TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'college', timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'
);
CREATE TABLE IF NOT EXISTS canteen_settings (
 canteen_id TEXT PRIMARY KEY REFERENCES canteens(id),
 open_time TEXT NOT NULL DEFAULT '08:00', close_time TEXT NOT NULL DEFAULT '17:00',
 slot_duration INTEGER NOT NULL DEFAULT 15, slot_capacity INTEGER NOT NULL DEFAULT 20,
 closed_days TEXT NOT NULL DEFAULT 'Sunday', is_closed INTEGER NOT NULL DEFAULT 0,
 closure_reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','owner')),
 canteen_id TEXT NOT NULL REFERENCES canteens(id), deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
 digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS menu (
 id TEXT PRIMARY KEY, canteen_id TEXT NOT NULL REFERENCES canteens(id),
 name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0),
 stock INTEGER NOT NULL CHECK(stock>=0), active INTEGER NOT NULL DEFAULT 1,
 vegetarian INTEGER NOT NULL DEFAULT 1, allergens TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS menu_media (
 menu_id TEXT PRIMARY KEY REFERENCES menu(id),
 image_url TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS slots (
 id TEXT PRIMARY KEY, canteen_id TEXT NOT NULL REFERENCES canteens(id),
 starts TEXT NOT NULL, ends TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity>0),
 UNIQUE(canteen_id,starts)
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 canteen_id TEXT NOT NULL REFERENCES canteens(id), slot_id TEXT NOT NULL REFERENCES slots(id),
 token TEXT NOT NULL UNIQUE, pickup_code TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'placed', payment_mode TEXT NOT NULL,
 payment_status TEXT NOT NULL DEFAULT 'due', total INTEGER NOT NULL,
 created INTEGER NOT NULL, expires INTEGER NOT NULL,
 cancel_requested INTEGER NOT NULL DEFAULT 0, cancel_reason TEXT NOT NULL DEFAULT '',
 idempotency TEXT NOT NULL, fingerprint TEXT NOT NULL,
 provider_order TEXT UNIQUE, provider_payment TEXT UNIQUE, checkout_ticket TEXT,
 checkout_expires INTEGER, refund_reference TEXT,
 UNIQUE(user_id,idempotency)
);
CREATE TABLE IF NOT EXISTS order_items (
 order_id TEXT NOT NULL REFERENCES orders(id), menu_id TEXT NOT NULL REFERENCES menu(id),
 name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0),
 PRIMARY KEY(order_id,menu_id)
);
CREATE TABLE IF NOT EXISTS audit (
 id BIGSERIAL PRIMARY KEY, actor TEXT, order_id TEXT,
 action TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
 bucket TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_canteen ON orders(canteen_id,created);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS stock_movements (
 id BIGSERIAL PRIMARY KEY,
 canteen_id TEXT NOT NULL, menu_id TEXT NOT NULL, item_name TEXT NOT NULL,
 delta INTEGER NOT NULL, balance INTEGER NOT NULL,
 reason TEXT NOT NULL, actor TEXT, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS stock_movement_canteen ON stock_movements(canteen_id,id);

CREATE OR REPLACE FUNCTION record_menu_stock() RETURNS trigger AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  INSERT INTO stock_movements(canteen_id,menu_id,item_name,delta,balance,reason,created)
  VALUES(NEW.canteen_id,NEW.id,NEW.name,NEW.stock,NEW.stock,'Opening stock',EXTRACT(EPOCH FROM clock_timestamp())::bigint);
 ELSIF NEW.stock <> OLD.stock THEN
  INSERT INTO stock_movements(canteen_id,menu_id,item_name,delta,balance,reason,created)
  VALUES(NEW.canteen_id,NEW.id,NEW.name,NEW.stock-OLD.stock,NEW.stock,'Order or menu stock change',EXTRACT(EPOCH FROM clock_timestamp())::bigint);
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS menu_opening_stock ON menu;
CREATE TRIGGER menu_opening_stock AFTER INSERT ON menu FOR EACH ROW EXECUTE FUNCTION record_menu_stock();
DROP TRIGGER IF EXISTS menu_stock_change ON menu;
CREATE TRIGGER menu_stock_change AFTER UPDATE OF stock ON menu FOR EACH ROW EXECUTE FUNCTION record_menu_stock();
