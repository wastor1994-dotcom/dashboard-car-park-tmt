/** Excel/Sheets column letters → 0-based index */
export function col(letter) {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/**
 * Column map for sheet DATA (ตรงกับ Google Sheet จริง)
 * ยี่ห้อรถ = F, สีรถ = G — ปรับด้วย env ได้ถ้าโครงสร้างเปลี่ยน
 */
export const COLUMNS = {
  parkingLot: col(process.env.PARKING_COL || 'C'),
  plate: col(process.env.PLATE_COL || 'D'),
  brand: col(process.env.BRAND_COL || 'F'),
  vehicleType: col(process.env.VEHICLE_TYPE_COL || 'H'),
  hasSticker: col(process.env.STICKER_COL || 'I'),
  vehicleColor: col(process.env.VEHICLE_COLOR_COL || 'G'),
  stickerColor: col(process.env.STICKER_COLOR_COL || 'L'),
  employee: col(process.env.EMPLOYEE_COL || 'O'),
  division: col(process.env.DIVISION_COL || 'AE'),
  department: col(process.env.DEPARTMENT_COL || 'AF'),
};

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || '15zM5OZ4rYllNKP7NL3PpFkvGkOMJJj8Jnxutkim1bEs';

const SHEET_NAME = process.env.SHEET_NAME || 'DATA';

export const config = {
  port: Number(process.env.PORT) || 3000,
  spreadsheetId: SPREADSHEET_ID,
  sheetName: SHEET_NAME,
  /** Poll interval for near-realtime updates (ms) */
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5000,
  headerRow: 1, // skip first row as header
  columns: COLUMNS,
  /** Prefer gviz CSV by sheet name; fallback export URL uses gid if set */
  csvUrls: [
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`,
    process.env.SHEET_GID
      ? `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${process.env.SHEET_GID}`
      : `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`,
  ].filter(Boolean),
};
