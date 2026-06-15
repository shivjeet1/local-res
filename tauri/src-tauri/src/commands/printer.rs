// src-tauri/src/commands/printer.rs
// Thermal receipt printer via ESC/POS. USB / Network TCP / PDF fallback.

use serde::Deserialize;
use crate::error::ApiResponse;
use crate::models::order::Order;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintReceiptPayload {
    pub order:           Order,
    pub restaurant_name: String,
    pub restaurant_addr: Option<String>,
    pub cashier_name:    String,
    pub printer_target:  PrinterTarget,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum PrinterTarget {
    Usb     { path: String },
    Network { host: String, port: u16 },
    Pdf     { output_path: String },
}

type Res<T> = Result<ApiResponse<T>, String>;

#[tauri::command]
pub async fn print_receipt(payload: PrintReceiptPayload) -> Res<()> {
    let data = build_escpos(&payload);
    match &payload.printer_target {
        PrinterTarget::Usb { path }           => write_to_usb(path, &data).await?,
        PrinterTarget::Network { host, port } => write_to_network(host, *port, &data).await?,
        PrinterTarget::Pdf { output_path }    => write_to_pdf(output_path, &payload).await?,
    }
    Ok(ApiResponse::ok(()))
}

fn build_escpos(p: &PrintReceiptPayload) -> Vec<u8> {
    let order = &p.order;
    let mut b  = EscPos::new();
    b.init();
    b.align_center();
    b.bold(true);
    b.text_size(2, 1);
    b.text(&p.restaurant_name);
    b.newline();
    b.text_size(1, 1);
    b.bold(false);
    if let Some(addr) = &p.restaurant_addr {
        b.text(addr); b.newline();
    }
    b.divider(32);
    b.align_left();
    b.text(&format!("ORDER  #{}", &order.id[order.id.len().saturating_sub(8)..]));
    b.newline();
    b.text(&format!("CASHIER: {}", p.cashier_name));
    b.newline();
    if let Some(tid) = &order.table_id {
        b.text(&format!("TABLE:   {}", &tid[tid.len().saturating_sub(8)..]));
        b.newline();
    }
    b.divider(32);
    for item in &order.items {
        let line_total = item.unit_price_cents * item.quantity as i64;
        b.text(&format!("{:<20} {:>11}", truncate(&item.product_id, 20), cents_str(line_total)));
        b.newline();
        if item.quantity > 1 {
            b.text(&format!("  {}x {}", item.quantity, cents_str(item.unit_price_cents)));
            b.newline();
        }
        if let Some(notes) = &item.notes {
            b.text(&format!("  * {notes}")); b.newline();
        }
    }
    b.divider(32);
    b.text(&format!("{:<20} {:>11}", "SUBTOTAL", cents_str(order.subtotal_cents))); b.newline();
    b.text(&format!("{:<20} {:>11}", "GST",      cents_str(order.tax_cents)));      b.newline();
    b.bold(true);
    b.text(&format!("{:<20} {:>11}", "TOTAL",    cents_str(order.total_cents)));    b.newline();
    b.bold(false);
    b.divider(32);
    b.align_center();
    b.text("Thank you! Visit again."); b.newline();
    b.feed(4);
    b.cut();
    b.finish()
}

struct EscPos(Vec<u8>);
impl EscPos {
    fn new() -> Self { EscPos(Vec::with_capacity(512)) }
    fn push(&mut self, bytes: &[u8]) { self.0.extend_from_slice(bytes); }
    fn init(&mut self)               { self.push(&[0x1B, 0x40]); }
    fn newline(&mut self)            { self.push(b"\n"); }
    fn feed(&mut self, n: u8)        { self.push(&[0x1B, 0x64, n]); }
    fn cut(&mut self)                { self.push(&[0x1D, 0x56, 0x41, 0x00]); }
    fn align_center(&mut self)       { self.push(&[0x1B, 0x61, 0x01]); }
    fn align_left(&mut self)         { self.push(&[0x1B, 0x61, 0x00]); }
    fn bold(&mut self, on: bool)     { self.push(&[0x1B, 0x45, if on { 1 } else { 0 }]); }
    fn text_size(&mut self, w: u8, h: u8) {
        let n = ((w.saturating_sub(1) & 0x07) << 4) | (h.saturating_sub(1) & 0x07);
        self.push(&[0x1D, 0x21, n]);
    }
    fn text(&mut self, s: &str)  { self.push(s.as_bytes()); }
    fn divider(&mut self, cols: usize) {
        self.push("-".repeat(cols).as_bytes()); self.push(b"\n");
    }
    fn finish(self) -> Vec<u8> { self.0 }
}

async fn write_to_usb(path: &str, data: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new().write(true).open(path)
        .map_err(|e| format!("USB open failed: {e}"))?;
    f.write_all(data).map_err(|e| format!("USB write failed: {e}"))
}

async fn write_to_network(host: &str, port: u16, data: &[u8]) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;
    use tokio::net::TcpStream;
    let mut stream = TcpStream::connect(format!("{host}:{port}"))
        .await.map_err(|e| format!("Printer connect failed: {e}"))?;
    stream.write_all(data).await.map_err(|e| format!("Printer write failed: {e}"))
}

async fn write_to_pdf(output_path: &str, p: &PrintReceiptPayload) -> Result<(), String> {
    use std::io::Write;
    let order = &p.order;
    let mut lines = vec![
        format!("=== {} ===", p.restaurant_name),
        format!("Order: #{}", &order.id[order.id.len().saturating_sub(8)..]),
        "---".into(),
    ];
    for item in &order.items {
        lines.push(format!("  {}x {} = {}",
            item.quantity,
            &item.product_id[item.product_id.len().saturating_sub(8)..],
            cents_str(item.unit_price_cents * item.quantity as i64),
        ));
    }
    lines.push("---".into());
    lines.push(format!("TOTAL: {}", cents_str(order.total_cents)));
    let mut f = std::fs::File::create(output_path)
        .map_err(|e| format!("PDF create failed: {e}"))?;
    f.write_all(lines.join("\n").as_bytes()).map_err(|e| format!("PDF write failed: {e}"))
}

fn cents_str(cents: i64) -> String { format!("Rs.{:.2}", cents as f64 / 100.0) }
fn truncate<'a>(s: &'a str, max: usize) -> &'a str {
    if s.len() <= max { s } else { &s[..max] }
}
