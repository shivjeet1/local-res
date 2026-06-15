// src-tauri/src/db/mod.rs

pub mod orders;
pub mod products;
pub mod users;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;

pub type DbPool = Pool<SqliteConnectionManager>;

const MIGRATIONS: &[&str] = &[
    include_str!("../../migrations/001_initial.sql"),
];

pub fn init_pool(db_path: &Path) -> Result<DbPool, String> {
    let manager = SqliteConnectionManager::file(db_path)
        .with_init(|conn| {
            conn.execute_batch(
                "PRAGMA journal_mode = WAL;
                 PRAGMA foreign_keys = ON;
                 PRAGMA synchronous   = NORMAL;
                 PRAGMA cache_size    = -8000;",
            )
        });

    let pool = Pool::builder()
        .max_size(4)
        .build(manager)
        .map_err(|e| format!("Pool init failed: {e}"))?;

    // Get a PooledConnection — deref to &Connection via run_migrations
    {
        let conn = pool.get().map_err(|e| e.to_string())?;
        run_migrations(&*conn)?;
    }

    Ok(pool)
}

fn run_migrations(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            applied_at INTEGER NOT NULL
         );",
    ).map_err(|e| e.to_string())?;

    let applied: i64 = conn
        .query_row("SELECT COUNT(*) FROM _migrations", [], |r| r.get(0))
        .unwrap_or(0);

    for (i, sql) in MIGRATIONS.iter().enumerate() {
        if (i as i64) < applied { continue; }
        conn.execute_batch(sql).map_err(|e| format!("Migration {i} failed: {e}"))?;
        conn.execute(
            "INSERT INTO _migrations (applied_at) VALUES (?1)",
            [now_ms()],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
