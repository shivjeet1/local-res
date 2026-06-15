// src-tauri/src/models/order.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderStatus {
    Open,
    SentToKitchen,
    Ready,
    Completed,
    Voided,
}

impl OrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderStatus::Open          => "OPEN",
            OrderStatus::SentToKitchen => "SENT_TO_KITCHEN",
            OrderStatus::Ready         => "READY",
            OrderStatus::Completed     => "COMPLETED",
            OrderStatus::Voided        => "VOIDED",
        }
    }
}

impl TryFrom<String> for OrderStatus {
    type Error = String;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.as_str() {
            "OPEN"             => Ok(OrderStatus::Open),
            "SENT_TO_KITCHEN"  => Ok(OrderStatus::SentToKitchen),
            "READY"            => Ok(OrderStatus::Ready),
            "COMPLETED"        => Ok(OrderStatus::Completed),
            "VOIDED"           => Ok(OrderStatus::Voided),
            other              => Err(format!("Unknown status: {other}")),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub id:             String,
    pub restaurant_id:  String,
    pub table_id:       Option<String>,
    pub user_id:        String,
    pub device_id:      String,
    pub status:         OrderStatus,
    pub notes:          Option<String>,
    pub subtotal_cents: i64,
    pub tax_cents:      i64,
    pub total_cents:    i64,
    pub paid_at:        Option<i64>,
    pub created_at:     i64,
    pub updated_at:     i64,
    pub deleted_at:     Option<i64>,
    pub synced_at:      Option<i64>,
    pub items:          Vec<OrderItem>,   // always eagerly loaded
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItem {
    pub id:               String,
    pub restaurant_id:    String,
    pub order_id:         String,
    pub product_id:       String,
    pub device_id:        String,
    pub quantity:         i32,
    pub unit_price_cents: i64,
    pub notes:            Option<String>,
    pub created_at:       i64,
    pub updated_at:       i64,
    pub deleted_at:       Option<i64>,
    pub synced_at:        Option<i64>,
}

// ---- Inbound payloads ----

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderPayload {
    pub table_id: Option<String>,
    pub notes:    Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddItemPayload {
    pub order_id:   String,
    pub product_id: String,
    pub quantity:   i32,
    pub notes:      Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrderStatusPayload {
    pub order_id: String,
    pub status:   OrderStatus,
}
