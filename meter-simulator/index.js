// mocks physical water meters: fetches candidate METER devices for the org
// from the DB once at startup, then POSTs TOTAL (cumulative) + FLOW
// (instantaneous) readings for each one on its own timer. Plain Node
// script, not a framework app — see ubiqedge_tech_implementation_spec §0.
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
       WHERE dt.type = 'METER' AND d.orgId = ? AND d.connectionId IS NOT NULL
         AND d.isActive = 1 AND d.deletedAt IS NULL`,
      [ORG_CODE],
    );

    // resume from each device's last known TOTAL rather than restarting
    // from scratch, so a simulator restart never sends a lower TOTAL than
    // what's already stored — that would read as negative consumption at
    // invoicing time. Falls back to 0 on a device's first-ever run (no
    // prior TOTAL row ⇒ nothing to resume from).
    return Promise.all(
      devices.map(async (d) => {
        const [rows] = await connection.query(
          `SELECT dt.value
           FROM device_telemetry dt
           JOIN device_type_param dtp ON dtp.id = dt.deviceTypeParamId
           WHERE dt.deviceId = ? AND dtp.paramKey = 'TOTAL'
           ORDER BY dt.deviceTimestamp DESC, dt.id DESC
           LIMIT 1`,
          [d.id],
        );
        const startTotal = rows[0] ? parseFloat(rows[0].value) : 0;
        return { serialNo: d.serialNo, startTotal };
      }),
    );
  } finally {
    await connection.end();
  }
}

function randomFlow() {
  // instantaneous flow rate for this tick, litres/min — 0 sometimes (tap off)
  return Math.random() < 0.2 ? 0 : +(Math.random() * 8).toFixed(2);
}

function startDeviceLoop(serialNo, startTotal) {
  // cumulative reading — resumes from the device's last known value (or 0
  // if it has none yet) and only ever increases, same as a real meter
  let total = startTotal;

  async function sendReading() {
    const flow = randomFlow();
    const intervalMinutes = INTERVAL_MS / 60000;
    total = +(total + flow * intervalMinutes).toFixed(2);

    const body = {
      deviceTimestamp: new Date().toISOString(),
      readings: [
        { paramKey: 'TOTAL', value: total },
        { paramKey: 'FLOW', value: flow },
      ],
    };

    const url = `${INGEST_BASE_URL}/ingest/v1/${ORG_CODE}/METER/${serialNo}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (res.ok) {
        console.log(`[${serialNo}] sent TOTAL=${total} FLOW=${flow} -> ${res.status}`);
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
    console.error(`No linked METER devices found for org ${ORG_CODE} — nothing to simulate`);
    process.exit(1);
  }
  console.log(`meter-simulator starting ${candidates.length} device(s) for ${ORG_CODE}, every ${INTERVAL_MS}ms -> ${INGEST_BASE_URL}`);
  for (const { serialNo, startTotal } of candidates) {
    console.log(`[${serialNo}] resuming from TOTAL=${startTotal}`);
    startDeviceLoop(serialNo, startTotal);
  }
}

main();
