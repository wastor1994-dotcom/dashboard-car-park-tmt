const state = {
  view: 'home', // home | vehicleTypes | brands | parkingLots | summary
  vehicleType: null,
  brand: null,
  parkingLot: null,
  snapshot: null,
  summary: null,
};

const els = {
  btnGrid: document.getElementById('btn-grid'),
  panelTitle: document.getElementById('panel-title'),
  panelDesc: document.getElementById('panel-desc'),
  crumbs: document.getElementById('crumbs'),
  summary: document.getElementById('summary'),
  statTotal: document.getElementById('stat-total'),
  statFile: document.getElementById('stat-file'),
  statSheet: document.getElementById('stat-sheet'),
  liveDot: document.getElementById('live-dot'),
  liveLabel: document.getElementById('live-label'),
  updatedAt: document.getElementById('updated-at'),
  btnReload: document.getElementById('btn-reload'),
};

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API ${path} failed`);
  return res.json();
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

function applySnapshot(snapshot) {
  state.snapshot = snapshot;
  els.statTotal.textContent = snapshot?.meta?.total ?? 0;
  els.statFile.textContent = snapshot?.fileName || '—';
  els.statSheet.textContent = snapshot?.sheetName || 'DATA';
  els.updatedAt.textContent = `อัปเดตล่าสุด ${formatTime(snapshot?.updatedAt)}`;
}

function setLive(ok) {
  els.liveDot.classList.toggle('on', ok);
  els.liveDot.classList.toggle('off', !ok);
  els.liveLabel.textContent = ok ? 'Realtime เชื่อมต่อแล้ว' : 'ขาดการเชื่อมต่อ';
}

function crumb(label, onClick, active = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `crumb${active ? ' active' : ''}`;
  b.textContent = label;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function renderCrumbs() {
  els.crumbs.innerHTML = '';
  els.crumbs.appendChild(
    crumb('หน้าแรก', () => {
      state.view = 'home';
      state.vehicleType = null;
      state.brand = null;
      state.parkingLot = null;
      state.summary = null;
      render();
    }, state.view === 'home'),
  );

  if (state.vehicleType || state.view === 'vehicleTypes' || state.view === 'brands') {
    els.crumbs.appendChild(
      crumb('ประเภทรถ', () => {
        state.view = 'vehicleTypes';
        state.vehicleType = null;
        state.brand = null;
        state.summary = null;
        render();
      }, state.view === 'vehicleTypes'),
    );
  }

  if (state.vehicleType) {
    els.crumbs.appendChild(
      crumb(state.vehicleType, () => {
        state.view = 'brands';
        state.brand = null;
        state.summary = null;
        render();
      }, state.view === 'brands' && !state.brand),
    );
  }

  if (state.brand) {
    els.crumbs.appendChild(crumb(state.brand, null, true));
  }

  if (state.view === 'parkingLots' || state.parkingLot) {
    els.crumbs.appendChild(
      crumb('ลานจอด', () => {
        state.view = 'parkingLots';
        state.parkingLot = null;
        state.vehicleType = null;
        state.brand = null;
        state.summary = null;
        render();
      }, state.view === 'parkingLots'),
    );
  }

  if (state.parkingLot) {
    els.crumbs.appendChild(crumb(state.parkingLot, null, true));
  }
}

function choiceButton({ label, count, primary = false, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `choice${primary ? ' primary' : ''}`;
  btn.innerHTML = `<span class="label"></span><span class="count"></span>`;
  btn.querySelector('.label').textContent = label;
  btn.querySelector('.count').textContent =
    count === undefined || count === null ? '' : Number(count).toLocaleString('th-TH');
  btn.addEventListener('click', onClick);
  return btn;
}

function renderHome() {
  els.panelTitle.textContent = 'เลือกหัวข้อ';
  els.panelDesc.textContent = 'เลือกประเภทรถ หรือลานจอด เพื่อดูข้อมูลย่อยและสรุป';
  els.btnGrid.innerHTML = '';
  els.summary.classList.add('hidden');
  els.summary.innerHTML = '';

  els.btnGrid.appendChild(
    choiceButton({
      label: 'ประเภทรถ',
      count: state.snapshot?.meta?.total,
      primary: true,
      onClick: () => {
        state.view = 'vehicleTypes';
        render();
      },
    }),
  );

  els.btnGrid.appendChild(
    choiceButton({
      label: 'ลานจอด',
      count: state.snapshot?.meta?.parkingLots?.length,
      primary: true,
      onClick: () => {
        state.view = 'parkingLots';
        render();
      },
    }),
  );
}

function renderVehicleTypes() {
  els.panelTitle.textContent = 'ประเภทรถ';
  els.panelDesc.textContent = 'เลือกประเภทรถ แล้วระบบจะแสดงปุ่มย่อยยี่ห้อรถ';
  els.btnGrid.innerHTML = '';
  els.summary.classList.add('hidden');

  const items = state.snapshot?.meta?.vehicleTypes || [];
  if (!items.length) {
    els.btnGrid.innerHTML = '<p class="empty">ยังไม่มีข้อมูลประเภทรถ</p>';
    return;
  }

  for (const item of items) {
    els.btnGrid.appendChild(
      choiceButton({
        label: item.name,
        count: item.count,
        onClick: () => {
          state.vehicleType = item.name;
          state.view = 'brands';
          render();
        },
      }),
    );
  }
}

async function renderBrands() {
  els.panelTitle.textContent = `ยี่ห้อรถ — ${state.vehicleType}`;
  els.panelDesc.textContent = 'เลือกยี่ห้อเพื่อดูสรุปจำนวน สีรถ และสีสติ๊กเกอร์';
  els.btnGrid.innerHTML = '<p class="empty">กำลังโหลดยี่ห้อ…</p>';
  els.summary.classList.add('hidden');

  const data = await api(`/api/brands?vehicleType=${encodeURIComponent(state.vehicleType)}`);
  els.btnGrid.innerHTML = '';

  if (!data.items?.length) {
    els.btnGrid.innerHTML = '<p class="empty">ไม่พบยี่ห้อในประเภทรถนี้</p>';
    return;
  }

  for (const item of data.items) {
    els.btnGrid.appendChild(
      choiceButton({
        label: item.name,
        count: item.count,
        onClick: async () => {
          state.brand = item.name;
          state.view = 'summary';
          await loadSummary({ vehicleType: state.vehicleType, brand: state.brand });
          render();
        },
      }),
    );
  }
}

async function renderParkingLots() {
  els.panelTitle.textContent = 'ประเภทลานจอด';
  els.panelDesc.textContent = 'เลือกประเภทลานจอดเพื่อดูสรุปจำนวนรถ สีรถ ยี่ห้อรถ และสีสติ๊กเกอร์';
  els.btnGrid.innerHTML = '';
  els.summary.classList.add('hidden');

  const items = state.snapshot?.meta?.parkingLots || [];
  if (!items.length) {
    els.btnGrid.innerHTML = '<p class="empty">ยังไม่มีข้อมูลลานจอด</p>';
    return;
  }

  for (const item of items) {
    els.btnGrid.appendChild(
      choiceButton({
        label: item.name,
        count: item.count,
        onClick: async () => {
          state.parkingLot = item.name;
          state.view = 'summary';
          await loadSummary({ parkingLot: state.parkingLot });
          render();
        },
      }),
    );
  }
}

async function loadSummary(filters) {
  const q = new URLSearchParams();
  if (filters.vehicleType) q.set('vehicleType', filters.vehicleType);
  if (filters.brand) q.set('brand', filters.brand);
  if (filters.parkingLot) q.set('parkingLot', filters.parkingLot);
  const data = await api(`/api/summary?${q.toString()}`);
  state.summary = data;
}

function bucketHtml(title, rows, total) {
  if (!rows?.length) {
    return `<div class="bucket"><h3>${title}</h3><p class="empty">ไม่มีข้อมูล</p></div>`;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  const list = rows
    .map((r) => {
      const pct = total ? Math.round((r.count / total) * 100) : 0;
      const width = Math.round((r.count / max) * 100);
      return `<div class="bar-row">
        <span>${escapeHtml(r.name)}</span>
        <strong>${r.count.toLocaleString('th-TH')} (${pct}%)</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      </div>`;
    })
    .join('');
  return `<div class="bucket"><h3>${title}</h3>${list}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderSummary() {
  const s = state.summary?.summary;
  const filters = state.summary?.filters || {};
  const titleParts = [];
  if (filters.parkingLot) titleParts.push(filters.parkingLot);
  if (filters.vehicleType) titleParts.push(filters.vehicleType);
  if (filters.brand) titleParts.push(filters.brand);

  els.panelTitle.textContent = `สรุป — ${titleParts.join(' / ') || 'ทั้งหมด'}`;
  els.panelDesc.textContent = 'จำนวนรถ สีรถ ยี่ห้อรถ และสีสติ๊กเกอร์ จากข้อมูล realtime';
  els.btnGrid.innerHTML = '';
  els.summary.classList.remove('hidden');

  if (!s) {
    els.summary.innerHTML = '<p class="empty">ไม่มีข้อมูลสรุป</p>';
    return;
  }

  const rows = (s.vehicles || [])
    .map(
      (v) => `<tr>
        <td>${escapeHtml(v.plate)}</td>
        <td>${escapeHtml(v.brand)}</td>
        <td>${escapeHtml(v.vehicleColor)}</td>
        <td>${escapeHtml(v.stickerColor)}</td>
        <td>${escapeHtml(v.hasSticker)}</td>
        <td>${escapeHtml(v.employee)}</td>
        <td>${escapeHtml(v.department)}</td>
        <td>${escapeHtml(v.division)}</td>
      </tr>`,
    )
    .join('');

  els.summary.innerHTML = `
    <div class="summary-hero">
      <div>
        <div class="big">${s.total.toLocaleString('th-TH')}</div>
        <div class="caption">จำนวนรถ (แถวใน Excel)</div>
      </div>
    </div>
    <div class="buckets">
      ${bucketHtml('ยี่ห้อรถ', s.byBrand, s.total)}
      ${bucketHtml('สีรถ', s.byVehicleColor, s.total)}
      ${bucketHtml('สีสติ๊กเกอร์', s.byStickerColor, s.total)}
      ${bucketHtml('สถานะสติ๊กเกอร์', s.bySticker, s.total)}
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ทะเบียน</th>
            <th>ยี่ห้อ</th>
            <th>สีรถ</th>
            <th>สีสติ๊กเกอร์</th>
            <th>สติ๊กเกอร์</th>
            <th>พนักงาน</th>
            <th>แผนก</th>
            <th>ฝ่าย</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8">ไม่มีรายการ</td></tr>'}</tbody>
      </table>
    </div>
  `;

  requestAnimationFrame(() => {
    els.summary.querySelectorAll('.bar-fill').forEach((el) => {
      const w = el.style.width;
      el.style.width = '0';
      requestAnimationFrame(() => {
        el.style.width = w;
      });
    });
  });
}

async function render() {
  renderCrumbs();

  if (state.snapshot && state.snapshot.ok === false) {
    // keep going; show banner in panel via desc
    els.panelDesc.textContent = state.snapshot.error || 'อ่าน Excel ไม่สำเร็จ';
  }

  try {
    if (state.view === 'home') renderHome();
    else if (state.view === 'vehicleTypes') renderVehicleTypes();
    else if (state.view === 'brands') await renderBrands();
    else if (state.view === 'parkingLots') await renderParkingLots();
    else if (state.view === 'summary') {
      if (!state.summary) {
        await loadSummary({
          vehicleType: state.vehicleType,
          brand: state.brand,
          parkingLot: state.parkingLot,
        });
      }
      renderSummary();
    }
  } catch (err) {
    console.error(err);
    els.btnGrid.innerHTML = `<p class="error-banner">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message)}</p>`;
  }
}

async function refreshCurrentView() {
  if (state.view === 'summary') {
    await loadSummary({
      vehicleType: state.vehicleType,
      brand: state.brand,
      parkingLot: state.parkingLot,
    });
  }
  await render();
}

let lastFingerprint = '';

async function pollOnce() {
  try {
    const snap = await api('/api/snapshot');
    applySnapshot(snap);
    setLive(Boolean(snap?.ok));
    const fp = `${snap?.updatedAt}|${snap?.meta?.total}`;
    if (fp !== lastFingerprint) {
      lastFingerprint = fp;
      await refreshCurrentView();
    }
  } catch {
    setLive(false);
  }
}

function startPolling(ms = 5000) {
  pollOnce();
  return setInterval(pollOnce, ms);
}

function connectSSE() {
  try {
    const es = new EventSource('/api/events');
    es.onopen = () => setLive(true);
    es.onerror = () => {
      // Keep polling as the reliable path (especially on Vercel)
    };
    es.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.payload) applySnapshot(msg.payload);
        if (msg.type === 'data' || msg.type === 'connected') {
          lastFingerprint = `${msg.payload?.updatedAt}|${msg.payload?.meta?.total}`;
          setLive(Boolean(msg.payload?.ok));
          await refreshCurrentView();
        }
      } catch (err) {
        console.error(err);
      }
    };
    return es;
  } catch {
    return null;
  }
}

els.btnReload.addEventListener('click', async () => {
  const res = await fetch('/api/reload', { method: 'POST' });
  const snap = await res.json();
  applySnapshot(snap);
  lastFingerprint = `${snap?.updatedAt}|${snap?.meta?.total}`;
  await refreshCurrentView();
});

async function boot() {
  try {
    const snap = await api('/api/snapshot');
    applySnapshot(snap);
    lastFingerprint = `${snap?.updatedAt}|${snap?.meta?.total}`;
    setLive(Boolean(snap?.ok));
  } catch {
    setLive(false);
  }
  await render();
  startPolling(5000);
  connectSSE();
}

boot();
