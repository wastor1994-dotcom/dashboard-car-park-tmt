import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { fetchSheetCsv, filterRecords, summarize } from './sheetsReader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

let cache = {
  ok: false,
  error: 'กำลังโหลดข้อมูล…',
  sheetName: config.sheetName,
  fileName: 'Google Sheets',
  updatedAt: null,
  records: [],
  meta: { total: 0, vehicleTypes: [], parkingLots: [], brandsByType: {} },
  fingerprint: '',
};

let refreshing = false;
let lastFetchAt = 0;
const sseClients = new Set();

function publicSnapshot() {
  return {
    ok: cache.ok,
    error: cache.error,
    sheetName: cache.sheetName,
    fileName: cache.fileName,
    source: 'google-sheets',
    spreadsheetId: config.spreadsheetId,
    updatedAt: cache.updatedAt,
    meta: cache.meta,
    detectedColumns: cache.detectedColumns || {},
  };
}

function broadcast(message) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

export async function refresh(reason = 'poll') {
  if (refreshing) return cache;
  refreshing = true;
  try {
    const next = await fetchSheetCsv();
    const changed = next.fingerprint !== cache.fingerprint;
    cache = next;
    lastFetchAt = Date.now();

    if (changed || reason === 'api' || reason === 'startup') {
      broadcast({ type: 'data', reason, payload: publicSnapshot() });
    }

    const status = next.ok ? `${next.records.length} rows` : `error: ${next.error}`;
    console.log(`[sheets] refreshed (${reason}) — ${status}${changed ? ' [changed]' : ''}`);
    return cache;
  } finally {
    refreshing = false;
  }
}

/** Ensure cache is warm; refetch if empty or older than poll interval */
export async function ensureData(force = false) {
  const stale = Date.now() - lastFetchAt > config.pollIntervalMs;
  if (force || !lastFetchAt || stale || !cache.ok) {
    await refresh(force ? 'api' : 'request');
  }
  return cache;
}

export function createApp({ serveStatic = true } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  if (serveStatic) {
    app.use(express.static(publicDir));
  }

  app.get('/api/health', async (_req, res) => {
    await ensureData();
    res.json({
      ok: true,
      sheets: cache.ok,
      updatedAt: cache.updatedAt,
      pollIntervalMs: config.pollIntervalMs,
    });
  });

  app.get('/api/snapshot', async (_req, res) => {
    await ensureData();
    res.json(publicSnapshot());
  });

  app.get('/api/vehicle-types', async (_req, res) => {
    await ensureData();
    res.json({ items: cache.meta?.vehicleTypes || [] });
  });

  app.get('/api/brands', async (req, res) => {
    await ensureData();
    const vehicleType = req.query.vehicleType;
    if (!vehicleType) {
      return res.status(400).json({ error: 'ต้องระบุ vehicleType' });
    }
    const brands = cache.meta?.brandsByType?.[vehicleType] || [];
    const filtered = filterRecords(cache.records || [], { vehicleType });
    res.json({
      vehicleType,
      items: brands.map((name) => ({
        name,
        count: filtered.filter((r) => r.brand === name).length,
      })),
    });
  });

  app.get('/api/parking-lots', async (_req, res) => {
    await ensureData();
    res.json({ items: cache.meta?.parkingLots || [] });
  });

  app.get('/api/summary', async (req, res) => {
    await ensureData();
    const { vehicleType, brand, parkingLot } = req.query;
    const filtered = filterRecords(cache.records || [], {
      vehicleType: vehicleType || undefined,
      brand: brand || undefined,
      parkingLot: parkingLot || undefined,
    });
    res.json({
      filters: {
        vehicleType: vehicleType || null,
        brand: brand || null,
        parkingLot: parkingLot || null,
      },
      summary: summarize(filtered),
    });
  });

  app.get('/api/events', async (req, res) => {
    await ensureData();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'connected', payload: publicSnapshot() })}\n\n`);

    // On serverless, keep connection short — client should poll as fallback
    const isServerless = Boolean(process.env.VERCEL);
    if (isServerless) {
      setTimeout(() => {
        sseClients.delete(res);
        try {
          res.end();
        } catch {
          /* ignore */
        }
      }, 2500);
    }

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.post('/api/reload', async (_req, res) => {
    await refresh('api');
    res.json(publicSnapshot());
  });

  if (serveStatic) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  return app;
}

export { cache, publicSnapshot, sseClients };
