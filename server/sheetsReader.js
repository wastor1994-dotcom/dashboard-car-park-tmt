import { config } from './config.js';

function cell(row, index) {
  const v = row?.[index];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function normalizeType(raw) {
  const t = raw.replace(/\s+/g, '').toLowerCase();
  if (!raw || t === '-' || t === 'n/a' || t === 'na') return 'ไม่มีประเภทรถ';
  if (t.includes('มอ') || t.includes('motor') || t.includes('bike') || t.includes('จักรยานยนต์')) {
    return 'มอร์เตอร์ไซต์';
  }
  if (t.includes('รถยน') || t.includes('car') || t.includes('sedan') || t.includes('pickup')) {
    return 'รถยนต์';
  }
  if (!raw) return 'ไม่มีประเภทรถ';
  return raw;
}

function normalizeSticker(raw) {
  const t = raw.replace(/\s+/g, '').toLowerCase();
  if (!raw || t === '-' || t === 'ไม่มี' || t === 'no' || t === 'n' || t === '0' || t === 'false') {
    return 'ไม่มีสติ๊กเกอร์';
  }
  if (t.includes('มี') || t === 'yes' || t === 'y' || t === '1' || t === 'true') {
    return 'มีสติ๊กเกอร์';
  }
  return raw;
}

/** RFC4180-ish CSV parser (handles quotes and newlines in fields) */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    // skip completely empty trailing rows
    if (row.length === 1 && row[0] === '' && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field.length || row.length) {
    pushField();
    pushRow();
  }

  return rows;
}

function emptyMeta() {
  return {
    total: 0,
    vehicleTypes: [],
    parkingLots: [],
    parkingStatus: [],
    departments: [],
    brandsByType: {},
  };
}

function uniqueSorted(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
}

function countMap(items, keyFn) {
  const map = {};
  for (const item of items) {
    const k = keyFn(item);
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
}

function buildMeta(records) {
  const vehicleTypes = ['รถยนต์', 'มอร์เตอร์ไซต์'];
  const brandsByType = {};
  for (const vt of vehicleTypes) {
    const subset = records.filter((r) => r.vehicleType === vt);
    brandsByType[vt] = uniqueSorted(subset.map((r) => r.brand));
  }

  const hasParking = records.filter((r) => r.hasSticker === 'มีสติ๊กเกอร์').length;
  const noParking = records.filter((r) => r.hasSticker !== 'มีสติ๊กเกอร์').length;

  return {
    total: records.length,
    vehicleTypes: vehicleTypes.map((name) => ({
      name,
      count: records.filter((r) => r.vehicleType === name).length,
    })),
    parkingLots: countMap(records, (r) => r.parkingLot),
    /** จากคอลัมน์ Sticker */
    parkingStatus: [
      { key: 'has', name: 'มีสติ๊กเกอร์', count: hasParking },
      { key: 'none', name: 'ไม่มีสติ๊กเกอร์', count: noParking },
    ],
    departments: countMap(
      records.filter((r) => r.department && r.department !== '-'),
      (r) => r.department,
    ),
    brandsByType,
  };
}

/**
 * Auto-detect brand / vehicle-color columns from Thai/English header labels
 * when present; otherwise keep config letter mapping.
 */
function resolveColumns(headerRow) {
  const cols = { ...config.columns };
  if (!headerRow?.length) return { cols, detected: {} };

  const detected = {};
  const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

  headerRow.forEach((label, idx) => {
    const n = norm(label);
    if (!n) return;
    if (
      (n.includes('ยี่ห้อ') || n.includes('brand') || n === 'make') &&
      detected.brand === undefined
    ) {
      cols.brand = idx;
      detected.brand = label;
    }
    if (
      (n.includes('สีรถ') || n === 'สี' || n.includes('vehiclecolor') || n.includes('carcolor')) &&
      detected.vehicleColor === undefined
    ) {
      cols.vehicleColor = idx;
      detected.vehicleColor = label;
    }
    if ((n.includes('ประเภทรถ') || n.includes('vehicletype')) && detected.vehicleType === undefined) {
      cols.vehicleType = idx;
      detected.vehicleType = label;
    }
    if (
      (n.includes('ลานจอด') || n.includes('ประเภทลาน') || n.includes('parking')) &&
      detected.parkingLot === undefined
    ) {
      cols.parkingLot = idx;
      detected.parkingLot = label;
    }
    if ((n.includes('ทะเบียน') || n.includes('plate') || n.includes('license')) && detected.plate === undefined) {
      cols.plate = idx;
      detected.plate = label;
    }
    if (
      (n.includes('สีสติ๊ก') ||
        n.includes('สีสติก') ||
        n.includes('สีsticker') ||
        n.includes('stickercolor') ||
        (n.includes('สี') && n.includes('sticker'))) &&
      detected.stickerColor === undefined
    ) {
      cols.stickerColor = idx;
      detected.stickerColor = label;
    }
    if (
      (n === 'สติ๊กเกอร์' ||
        n === 'สติกเกอร์' ||
        n === 'sticker' ||
        n.includes('hassticker')) &&
      detected.hasSticker === undefined
    ) {
      cols.hasSticker = idx;
      detected.hasSticker = label;
    }
    if (
      (n.includes('พนักงาน') || n.includes('employee') || n.startsWith('ชื่อ')) &&
      detected.employee === undefined
    ) {
      cols.employee = idx;
      detected.employee = label;
    }
    if ((n.includes('ฝ่าย') || n.includes('division')) && detected.division === undefined) {
      cols.division = idx;
      detected.division = label;
    }
    if ((n.includes('แผนก') || n.includes('department')) && detected.department === undefined) {
      cols.department = idx;
      detected.department = label;
    }
  });

  return { cols, detected };
}

function isMissingPlate(plate) {
  const t = String(plate || '')
    .replace(/\s+/g, '')
    .toLowerCase();
  return !t || t === '-' || t === 'n/a' || t === 'na' || t === 'ไม่มี' || t === 'ไม่มีทะเบียน';
}

function rowsToRecords(rows) {
  const header = rows[0] || [];
  const { cols, detected } = resolveColumns(header);
  const start = config.headerRow;
  const records = [];

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => cell([c], 0) === '')) continue;

    const plate = cell(row, cols.plate);
    const parkingLot = cell(row, cols.parkingLot);
    if (!plate && !parkingLot) continue;

    // ตัดรถที่ไม่มีทะเบียน
    if (isMissingPlate(plate)) continue;

    const vehicleType = normalizeType(cell(row, cols.vehicleType));
    // ตัดรถที่ไม่ระบุประเภท
    if (vehicleType === 'ไม่มีประเภทรถ') continue;

    records.push({
      id: i + 1,
      parkingLot: parkingLot || 'ไม่ระบุลานจอด',
      plate,
      brand: cell(row, cols.brand) || 'ไม่ระบุยี่ห้อ',
      vehicleType,
      hasSticker: normalizeSticker(cell(row, cols.hasSticker)),
      vehicleColor: cell(row, cols.vehicleColor) || 'ไม่ระบุสี',
      stickerColor: cell(row, cols.stickerColor) || '-',
      employee: cell(row, cols.employee) || '-',
      division: cell(row, cols.division) || '-',
      department: cell(row, cols.department) || '-',
    });
  }

  return { records, header, detected, cols };
}

function fingerprint(records) {
  // cheap change detector for SSE broadcast gating
  return `${records.length}:${records.map((r) => `${r.plate}|${r.parkingLot}|${r.brand}|${r.stickerColor}`).join(';')}`;
}

export async function fetchSheetCsv() {
  let lastError = null;

  for (const url of config.csvUrls) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Dashboard-Car-Park-TMT/1.0',
          Accept: 'text/csv,text/plain,*/*',
        },
      });

      const text = await res.text();
      if (!res.ok) {
        lastError = `HTTP ${res.status} จาก ${url}`;
        continue;
      }

      // Google login / HTML error pages
      const trimmed = text.trimStart();
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
        lastError =
          'ชีตยังไม่เปิดสาธารณะ (Anyone with the link) หรือ URL ไม่ถูกต้อง — เปิด Share เป็น Viewer';
        continue;
      }

      const rows = parseCsv(text);
      if (!rows.length) {
        lastError = 'CSV ว่าง';
        continue;
      }

      const { records, header, detected } = rowsToRecords(rows);
      const now = new Date().toISOString();

      return {
        ok: true,
        error: null,
        sheetName: config.sheetName,
        fileName: `Google Sheets (${config.spreadsheetId.slice(0, 8)}…)`,
        sourceUrl: url,
        updatedAt: now,
        header,
        detectedColumns: detected,
        records,
        meta: buildMeta(records),
        fingerprint: fingerprint(records),
      };
    } catch (err) {
      lastError = err.message || String(err);
    }
  }

  return {
    ok: false,
    error: lastError || 'ดึงข้อมูล Google Sheets ไม่สำเร็จ',
    sheetName: config.sheetName,
    fileName: 'Google Sheets',
    sourceUrl: null,
    updatedAt: null,
    header: [],
    detectedColumns: {},
    records: [],
    meta: emptyMeta(),
    fingerprint: 'error',
  };
}

export function summarize(records) {
  return {
    total: records.length,
    byBrand: countMap(records, (r) => r.brand),
    byVehicleColor: countMap(records, (r) => r.vehicleColor),
    byStickerColor: countMap(
      records.filter((r) => r.hasSticker === 'มีสติ๊กเกอร์' && r.stickerColor && r.stickerColor !== '-'),
      (r) => r.stickerColor,
    ),
    bySticker: countMap(records, (r) => r.hasSticker),
    byDepartment: countMap(records, (r) => r.department),
    byDivision: countMap(records, (r) => r.division),
    vehicles: records.map((r) => ({
      plate: r.plate,
      brand: r.brand,
      vehicleColor: r.vehicleColor,
      stickerColor: r.stickerColor,
      hasSticker: r.hasSticker,
      employee: r.employee,
      department: r.department,
      division: r.division,
      vehicleType: r.vehicleType,
      parkingLot: r.parkingLot,
    })),
  };
}

export function filterRecords(
  records,
  { vehicleType, brand, parkingLot, parkingStatus, department } = {},
) {
  return records.filter((r) => {
    if (vehicleType && r.vehicleType !== vehicleType) return false;
    if (brand && r.brand !== brand) return false;
    if (parkingLot && r.parkingLot !== parkingLot) return false;
    if (department && r.department !== department) return false;
    if (parkingStatus === 'has' && r.hasSticker !== 'มีสติ๊กเกอร์') return false;
    if (parkingStatus === 'none' && r.hasSticker === 'มีสติ๊กเกอร์') return false;
    return true;
  });
}
