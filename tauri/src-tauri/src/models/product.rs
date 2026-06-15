// src-tauri/src/models/product.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id:            String,
    pub restaurant_id: String,
    pub name:          String,
    pub sort_order:    i32,
    pub created_at:    i64,
    pub updated_at:    i64,
    pub deleted_at:    Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id:            String,
    pub restaurant_id: String,
    pub category_id:   Option<String>,
    pub name:          String,
    pub description:   Option<String>,
    pub price_cents:   i64,
    pub tax_rate_pct:  f64,
    pub is_available:  bool,
    pub image_url:     Option<String>,
    pub created_at:    i64,
    pub updated_at:    i64,
    pub deleted_at:    Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductPayload {
    pub name:         String,
    pub category_id:  Option<String>,
    pub description:  Option<String>,
    pub price_cents:  i64,
    pub tax_rate_pct: Option<f64>,
    pub image_url:    Option<String>,
}
