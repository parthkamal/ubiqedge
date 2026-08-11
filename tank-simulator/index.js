// mocks level-sensor tanks: fetches candidate TANK devices for the org from
// the DB once at startup, then POSTs LEVEL readings for each one on its own
// timer. Plain Node script, not a framework app — see
// ubiqedge_tech_implementation_spec §0.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const INGEST_BASE_URL = process.env.INGEST_BASE_URL ?? 'http://localhost:3001';
const ORG_CODE = process.env.ORG_CODE;
const API_KEY = process.env.API_KEY;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? '300000', 10); // 5 min, per FR cadence

if (!ORG_CODE || !API_KEY) {
  console.error('ORG_CODE and API_KEY are required — see .env.example');
  process.exit(1);
}

async function fetchCandidates() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    // only devices actually linked to an account and active — these are
    // the ones ingestion-service will accept telemetry for
    const [devices] = await connection.query(
      `SELECT d.id, d.serialNo
       FROM device d
       JOIN device_type dt ON dt.id = d.deviceTypeId
       WHERE dt.type = 'TANK' AND d.orgId = ? AND d.connectionId IS NOT NULL
         AND d.isActive = 1 AND d.deletedAt IS NULL`,
      [ORG_CODE],
    );

    // resume from each device's last known LEVEL rather than a fresh
    // random value, so a restart doesn't show a jarring jump. This one-time
    // startup lookup is cheap regardless of indexing (bounded by device
    // count, runs once per process) — a real indexing pass on
    // device_telemetry is a separate, deliberately deferred task.
    return Promise.all(
      devices.map(async (d) => {
        const [rows] = await connection.query(
          `SELECT dt.value
           FROM device_telemetry dt
           JOIN device_type_param dtp ON dtp.id = dt.deviceTypeParamId
           WHERE dt.deviceId = ? AND dtp.paramKey = 'LEVEL'
           ORDER BY dt.deviceTimestamp DESC, dt.id DESC
           LIMIT 1`,
          [d.id],
        );
        const startLevel = rows[0] ? parseFloat(rows[0].value) : 0;
        return { serialNo: d.serialNo, startLevel };
      }),
    );
  } finally {
    await connection.end();
  }
}

function startDeviceLoop(serialNo, startLevel) {
  // random walk, clamped to [0, 100] — looks like a tank draining/filling
  // rather than teleporting between unrelated values each tick
  let level = startLevel;

  async function sendReading() {
    const delta = (Math.random() - 0.5) * 10; // ±5 per tick
    level = Math.min(100, Math.max(0, +(level + delta).toFixed(2)));

    const body = {
      deviceTimestamp: new Date().toISOString(),
      readings: [{ paramKey: 'LEVEL', value: level }],
    };

    const url = `${INGEST_BASE_URL}/ingest/v1/${ORG_CODE}/TANK/${serialNo}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (res.ok) {
        console.log(`[${serialNo}] sent LEVEL=${level} -> ${res.status}`);
      } else {
        console.error(`[${serialNo}] rejected -> ${res.status} ${text}`);
      }
    } catch (err) {
      // network hiccups shouldn't kill the process — just skip this tick
      console.error(`[${serialNo}] request failed:`, err.message);
    }
  }

  sendReading();
  setInterval(sendReading, INTERVAL_MS);
}

async function main() {
  const candidates = await fetchCandidates();
  if (candidates.length === 0) {
    console.error(`No linked TANK devices found for org ${ORG_CODE} — nothing to simulate`);
    process.exit(1);
  }
  console.log(`tank-simulator starting ${candidates.length} device(s) for ${ORG_CODE}, every ${INTERVAL_MS}ms -> ${INGEST_BASE_URL}`);
  for (const { serialNo, startLevel } of candidates) {
    console.log(`[${serialNo}] resuming from LEVEL=${startLevel}`);
    startDeviceLoop(serialNo, startLevel);
  }
}

main();
