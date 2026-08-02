import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set before clearing legacy stream keys.");
}

const { Pool } = pg;
const pool = new Pool({ connectionString });

try {
  const result = await pool.query(
    "UPDATE channels SET mux_stream_key = NULL WHERE mux_stream_key IS NOT NULL",
  );
  console.log(`Cleared ${result.rowCount ?? 0} legacy persisted stream key value(s).`);
} finally {
  await pool.end();
}
