// src-tauri/src/db/orders.rs
use rusqlite::{params, Connection};
use cuid2::cuid;
use crate::db::{now_ms, products::get_product};
use crate::error::PosError;
use crate::models::order::{
    AddItemPayload, CreateOrderPayload, Order, OrderItem, OrderStatus, UpdateOrderStatusPayload,
};

pub fn get_order(conn: &Connection, id: &str) -> Result<Order, PosError> {
    let mut order = conn.query_row(
        "SELECT id, restaurant_id, table_id, user_id, device_id, status,
                notes, subtotal_cents, tax_cents, total_cents,
                paid_at, created_at, updated_at, deleted_at, synced_at
         FROM orders WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        map_order,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => PosError::NotFound(format!("Order {id}")),
        other => PosError::Database(other),
    })?;
    order.items = list_items_for_order(conn, id)?;
    Ok(order)
}

pub fn list_open_orders(conn: &Connection, restaurant_id: &str) -> Result<Vec<Order>, PosError> {
    let mut stmt = conn.prepare(
        "SELECT id, restaurant_id, table_id, user_id, device_id, status,
                notes, subtotal_cents, tax_cents, total_cents,
                paid_at, created_at, updated_at, deleted_at, synced_at
         FROM orders
         WHERE restaurant_id = ?1
           AND deleted_at IS NULL
           AND status NOT IN ('COMPLETED','VOIDED')
         ORDER BY created_at DESC",
    )?;
    let mut orders: Vec<Order> = stmt
        .query_map(params![restaurant_id], map_order)?
        .collect::<Result<_, _>>()
        .map_err(PosError::Database)?;
    for o in &mut orders {
        o.items = list_items_for_order(conn, &o.id)?;
    }
    Ok(orders)
}

fn list_items_for_order(conn: &Connection, order_id: &str) -> Result<Vec<OrderItem>, PosError> {
    let mut stmt = conn.prepare(
        "SELECT id, restaurant_id, order_id, product_id, device_id,
                quantity, unit_price_cents, notes,
                created_at, updated_at, deleted_at, synced_at
         FROM order_items
         WHERE order_id = ?1 AND deleted_at IS NULL
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![order_id], map_item)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PosError::Database)
}

pub fn create_order(
    conn: &Connection,
    restaurant_id: &str,
    user_id: &str,
    device_id: &str,
    payload: &CreateOrderPayload,
) -> Result<Order, PosError> {
    let id  = cuid();
    let now = now_ms();
    conn.execute(
        "INSERT INTO orders
            (id, restaurant_id, table_id, user_id, device_id,
             status, notes, subtotal_cents, tax_cents, total_cents,
             created_at, updated_at, _synced)
         VALUES (?1,?2,?3,?4,?5,'OPEN',?6,0,0,0,?7,?7,0)",
        params![id, restaurant_id, payload.table_id, user_id, device_id, payload.notes, now],
    )?;
    get_order(conn, &id)
}

pub fn add_item(
    conn: &Connection,
    restaurant_id: &str,
    device_id: &str,
    payload: &AddItemPayload,
) -> Result<Order, PosError> {
    if payload.quantity < 1 {
        return Err(PosError::Validation("quantity must be >= 1".into()));
    }
    let status_str: String = conn
        .query_row(
            "SELECT status FROM orders WHERE id = ?1 AND deleted_at IS NULL",
            params![payload.order_id],
            |r| r.get(0),
        )
        .map_err(|_| PosError::NotFound(format!("Order {}", payload.order_id)))?;

    let status = OrderStatus::try_from(status_str).map_err(PosError::Validation)?;
    if !matches!(status, OrderStatus::Open) {
        return Err(PosError::Validation(format!(
            "Cannot modify order in status {:?}", status
        )));
    }
    let product = get_product(conn, &payload.product_id)?;
    let item_id = cuid();
    let now     = now_ms();
    conn.execute(
        "INSERT INTO order_items
            (id, restaurant_id, order_id, product_id, device_id,
             quantity, unit_price_cents, notes, created_at, updated_at, _synced)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9,0)",
        params![
            item_id, restaurant_id, payload.order_id, payload.product_id,
            device_id, payload.quantity, product.price_cents, payload.notes, now
        ],
    )?;
    recalculate_order_totals(conn, &payload.order_id)?;
    get_order(conn, &payload.order_id)
}

pub fn remove_item(conn: &Connection, order_id: &str, item_id: &str) -> Result<Order, PosError> {
    let now = now_ms();
    let rows = conn.execute(
        "UPDATE order_items SET deleted_at = ?1, updated_at = ?1, _synced = 0
         WHERE id = ?2 AND order_id = ?3 AND deleted_at IS NULL",
        params![now, item_id, order_id],
    )?;
    if rows == 0 { return Err(PosError::NotFound(format!("OrderItem {item_id}"))); }
    recalculate_order_totals(conn, order_id)?;
    get_order(conn, order_id)
}

pub fn update_order_status(
    conn: &Connection,
    payload: &UpdateOrderStatusPayload,
) -> Result<Order, PosError> {
    let now    = now_ms();
    let paid_at = if payload.status == OrderStatus::Completed { Some(now) } else { None };
    let rows = conn.execute(
        "UPDATE orders
         SET status = ?1, updated_at = ?2, paid_at = COALESCE(?3, paid_at), _synced = 0
         WHERE id = ?4 AND deleted_at IS NULL",
        params![payload.status.as_str(), now, paid_at, payload.order_id],
    )?;
    if rows == 0 { return Err(PosError::NotFound(format!("Order {}", payload.order_id))); }
    get_order(conn, &payload.order_id)
}

pub fn void_order(conn: &Connection, order_id: &str) -> Result<(), PosError> {
    let now = now_ms();
    conn.execute(
        "UPDATE order_items SET deleted_at = ?1, updated_at = ?1, _synced = 0
         WHERE order_id = ?2 AND deleted_at IS NULL",
        params![now, order_id],
    )?;
    let rows = conn.execute(
        "UPDATE orders SET deleted_at = ?1, updated_at = ?1, status = 'VOIDED', _synced = 0
         WHERE id = ?2 AND deleted_at IS NULL",
        params![now, order_id],
    )?;
    if rows == 0 { return Err(PosError::NotFound(format!("Order {order_id}"))); }
    Ok(())
}

fn recalculate_order_totals(conn: &Connection, order_id: &str) -> Result<(), PosError> {
    let (subtotal, tax): (i64, i64) = conn.query_row(
        "SELECT
            COALESCE(SUM(oi.quantity * oi.unit_price_cents), 0),
            COALESCE(SUM(CAST(oi.quantity * oi.unit_price_cents * p.tax_rate_pct / 100.0 AS INTEGER)), 0)
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?1 AND oi.deleted_at IS NULL",
        params![order_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    let now = now_ms();
    conn.execute(
        "UPDATE orders SET subtotal_cents=?1, tax_cents=?2, total_cents=?3,
                           updated_at=?4, _synced=0
         WHERE id = ?5",
        params![subtotal, tax, subtotal + tax, now, order_id],
    )?;
    Ok(())
}

fn map_order(r: &rusqlite::Row<'_>) -> rusqlite::Result<Order> {
    let status_str: String = r.get(5)?;
    Ok(Order {
        id:             r.get(0)?,
        restaurant_id:  r.get(1)?,
        table_id:       r.get(2)?,
        user_id:        r.get(3)?,
        device_id:      r.get(4)?,
        status: OrderStatus::try_from(status_str)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e))?,
        notes:          r.get(6)?,
        subtotal_cents: r.get(7)?,
        tax_cents:      r.get(8)?,
        total_cents:    r.get(9)?,
        paid_at:        r.get(10)?,
        created_at:     r.get(11)?,
        updated_at:     r.get(12)?,
        deleted_at:     r.get(13)?,
        synced_at:      r.get(14)?,
        items:          vec![],
    })
}

fn map_item(r: &rusqlite::Row<'_>) -> rusqlite::Result<OrderItem> {
    Ok(OrderItem {
        id:               r.get(0)?,
        restaurant_id:    r.get(1)?,
        order_id:         r.get(2)?,
        product_id:       r.get(3)?,
        device_id:        r.get(4)?,
        quantity:         r.get(5)?,
        unit_price_cents: r.get(6)?,
        notes:            r.get(7)?,
        created_at:       r.get(8)?,
        updated_at:       r.get(9)?,
        deleted_at:       r.get(10)?,
        synced_at:        r.get(11)?,
    })
}
