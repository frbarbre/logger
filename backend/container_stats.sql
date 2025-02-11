CREATE TABLE IF NOT EXISTS container_stats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cpu_percent REAL,
    memory_usage INTEGER,
    memory_limit INTEGER,
    memory_percent REAL,
    net_io_in INTEGER,
    net_io_out INTEGER,
    block_io_in INTEGER,
    block_io_out INTEGER,
    pids INTEGER,
    timestamp DATETIME NOT NULL
); 