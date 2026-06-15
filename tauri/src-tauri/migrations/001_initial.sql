-- ============================================================
-- POS LOCAL SCHEMA — SQLite
-- Rules: CUID2 PKs, soft deletes, sync metadata on transactional tables
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            TEXT    NOT NULL PRIMARY KEY,
    restaurant_id TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('ADMIN','STAFF','KITCHEN')),
    created_at    INTEGER NOT NULL,   -- Unix ms
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER,
    _synced       INTEGER NOT NULL DEFAULT 0  -- 0=dirty, 1=synced
);
CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_synced     ON users(_synced) WHERE _synced = 0;

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id            TEXT    NOT NULL PRIMARY KEY,
    restaurant_id TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER,
    _synced       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);

-- ------------------------------------------------------------
-- PRODUCTS (menu items)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id            TEXT    NOT NULL PRIMARY KEY,
    restaurant_id TEXT    NOT NULL,
    category_id   TEXT    REFERENCES categories(id),
    name          TEXT    NOT NULL,
    description   TEXT,
    price_cents   INTEGER NOT NULL CHECK(price_cents >= 0),
    tax_rate_pct  REAL    NOT NULL DEFAULT 0.0,
    is_available  INTEGER NOT NULL DEFAULT 1,  -- boolean
    image_url     TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER,
    _synced       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_synced     ON products(_synced) WHERE _synced = 0;

-- ------------------------------------------------------------
-- TABLES (restaurant seating)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id            TEXT    NOT NULL PRIMARY KEY,
    restaurant_id TEXT    NOT NULL,
    label         TEXT    NOT NULL,   -- e.g. "T-01", "Bar 3"
    capacity      INTEGER NOT NULL DEFAULT 4,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER,
    _synced       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON restaurant_tables(restaurant_id);

-- ------------------------------------------------------------
-- ORDERS  (transactional — includes device + sync metadata)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id            TEXT    NOT NULL PRIMARY KEY,
    restaurant_id TEXT    NOT NULL,
    table_id      TEXT    REFERENCES restaurant_tables(id),
    user_id       TEXT    NOT NULL REFERENCES users(id),
    device_id     TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'OPEN'
                          CHECK(status IN ('OPEN','SENT_TO_KITCHEN','READY','COMPLETED','VOIDED')),
    notes         TEXT,
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents      INTEGER NOT NULL DEFAULT 0,
    total_cents    INTEGER NOT NULL DEFAULT 0,
    paid_at        INTEGER,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    deleted_at     INTEGER,
    synced_at      INTEGER,           -- last cloud ACK timestamp
    _synced        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_synced     ON orders(_synced) WHERE _synced = 0;
CREATE INDEX IF NOT EXISTS idx_orders_updated    ON orders(updated_at);

-- ------------------------------------------------------------
-- ORDER ITEMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id            TEXT    NOT NULL PRIMARY KEY,
    restaurant_id TEXT    NOT NULL,
    order_id      TEXT    NOT NULL REFERENCES orders(id),
    product_id    TEXT    NOT NULL REFERENCES products(id),
    device_id     TEXT    NOT NULL,
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    unit_price_cents INTEGER NOT NULL,
    notes         TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER,
    synced_at     INTEGER,
    _synced       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_synced   ON order_items(_synced) WHERE _synced = 0;

-- ------------------------------------------------------------
-- SYNC CHECKPOINT  (one row per entity type)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_checkpoints (
    entity        TEXT    NOT NULL PRIMARY KEY,  -- 'orders', 'products', ...
    last_pulled_at INTEGER NOT NULL DEFAULT 0    -- last cloud timestamp we pulled from
);

INSERT OR IGNORE INTO sync_checkpoints(entity, last_pulled_at) VALUES
    ('users',     0),
    ('categories',0),
    ('products',  0),
    ('orders',    0),
    ('order_items',0);
