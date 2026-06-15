// src-tauri/src/db/products.rs
use rusqlite::{params, Connection};
use crate::db::now_ms;
use crate::error::PosError;
use crate::models::product::{Category, CreateProductPayload, Product};
use cuid2::cuid;

pub fn list_categories(conn: &Connection, restaurant_id: &str) -> Result<Vec<Category>, PosError> {
    let mut stmt = conn.prepare(
        "SELECT id, restaurant_id, name, sort_order, created_at, updated_at, deleted_at
         FROM categories
         WHERE restaurant_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, name ASC",
    )?;
    let rows = stmt.query_map(params![restaurant_id], |r| {
        Ok(Category {
            id:            r.get(0)?,
            restaurant_id: r.get(1)?,
            name:          r.get(2)?,
            sort_order:    r.get(3)?,
            created_at:    r.get(4)?,
            updated_at:    r.get(5)?,
            deleted_at:    r.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PosError::Database)
}

pub fn list_products(conn: &Connection, restaurant_id: &str) -> Result<Vec<Product>, PosError> {
    let mut stmt = conn.prepare(
        "SELECT id, restaurant_id, category_id, name, description,
                price_cents, tax_rate_pct, is_available, image_url,
                created_at, updated_at, deleted_at
         FROM products
         WHERE restaurant_id = ?1 AND deleted_at IS NULL
         ORDER BY name ASC",
    )?;
    let rows = stmt.query_map(params![restaurant_id], map_product)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PosError::Database)
}

pub fn get_product(conn: &Connection, id: &str) -> Result<Product, PosError> {
    conn.query_row(
        "SELECT id, restaurant_id, category_id, name, description,
                price_cents, tax_rate_pct, is_available, image_url,
                created_at, updated_at, deleted_at
         FROM products WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        map_product,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => PosError::NotFound(format!("Product {id}")),
        other => PosError::Database(other),
    })
}

pub fn create_product(
    conn: &Connection,
    restaurant_id: &str,
    p: &CreateProductPayload,
) -> Result<Product, PosError> {
    if p.name.trim().is_empty() {
        return Err(PosError::Validation("Product name required".into()));
    }
    if p.price_cents < 0 {
        return Err(PosError::Validation("price_cents cannot be negative".into()));
    }
    let id  = cuid();
    let now = now_ms();
    let tax = p.tax_rate_pct.unwrap_or(0.0);
    conn.execute(
        "INSERT INTO products
            (id, restaurant_id, category_id, name, description,
             price_cents, tax_rate_pct, is_available, image_url,
             created_at, updated_at, _synced)
         VALUES (?1,?2,?3,?4,?5,?6,?7,1,?8,?9,?9,0)",
        params![id, restaurant_id, p.category_id, p.name.trim(),
                p.description, p.price_cents, tax, p.image_url, now],
    )?;
    get_product(conn, &id)
}

pub fn delete_product(conn: &Connection, id: &str) -> Result<(), PosError> {
    let now = now_ms();
    let rows = conn.execute(
        "UPDATE products SET deleted_at = ?1, updated_at = ?1, _synced = 0
         WHERE id = ?2 AND deleted_at IS NULL",
        params![now, id],
    )?;
    if rows == 0 { return Err(PosError::NotFound(format!("Product {id}"))); }
    Ok(())
}

fn map_product(r: &rusqlite::Row<'_>) -> rusqlite::Result<Product> {
    let avail: i32 = r.get(7)?;
    Ok(Product {
        id:            r.get(0)?,
        restaurant_id: r.get(1)?,
        category_id:   r.get(2)?,
        name:          r.get(3)?,
        description:   r.get(4)?,
        price_cents:   r.get(5)?,
        tax_rate_pct:  r.get(6)?,
        is_available:  avail != 0,
        image_url:     r.get(8)?,
        created_at:    r.get(9)?,
        updated_at:    r.get(10)?,
        deleted_at:    r.get(11)?,
    })
}
