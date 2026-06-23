-- ============================================================
-- 002: restaurant_tables sync checkpoint
--
-- restaurant_tables existed in 001_initial.sql with sync columns, but the
-- sync engine never pulled it (no checkpoint row, no pull/upsert calls).
-- This adds the missing checkpoint row so the generic pull mechanism in
-- sync/mod.rs can track "last pulled at" for tables the same way it does
-- for orders/order_items/products.
-- ============================================================

INSERT OR IGNORE INTO sync_checkpoints(entity, last_pulled_at) VALUES
    ('restaurant_tables', 0);
