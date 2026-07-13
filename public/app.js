const state = {
  view: 'home', // home | vehicleTypes | brands | parkingLots | departments | summary
  vehicleType: null,
  brand: null,
  parkingLot: null,
  parkingStatus: null, // 'has' | 'none' | null
  department: null,
  snapshot: null,
  summary: null,
};

/** Navigation history for Back button / browser back */
const navStack = [];
let suppressHistory = false;

const els = {
  btnGrid: document.getElementById('btn-grid'),
  panelTitle: document.getElementById('panel-title'),
  panelDesc: document.getElementById('panel-desc'),
  crumbs: document.getElementById('crumbs'),
  summary: document.getElementById('summary'),
  statFile: document.getElementById('stat-file'),
  liveDot: document.getElementById('live-dot'),
  liveLabel: document.getElementById('live-label'),
  updatedAt: document.getElementById('updated-at'),
  btnReload: document.getElementById('btn-reload'),
  btnBack: document.getElementById('btn-back'),
  btnHome: document.getElementById('btn-home'),
};

function snapshotNav() {
  return {
    view: state.view,
    vehicleType: state.vehicleType,
    brand: state.brand,
    parkingLot: state.parkingLot,
    parkingStatus: state.parkingStatus,
    department: state.department,
  };
}

function applyNav(nav) {
  state.view = nav.view || 'home';
  state.vehicleType = nav.vehicleType || null;
  state.brand = nav.brand || null;
  state.parkingLot = nav.parkingLot || null;
  state.parkingStatus = nav.parkingStatus || null;
  state.department = nav.department || null;
  state.summary = null;
}

function updateBackButton() {
  const show = state.view !== 'home';
  els.btnBack?.classList.toggle('hidden', !show);
}

async function goHome() {
  navStack.length = 0;
  applyNav({ view: 'home' });
  await render();
  if (!suppressHistory) {
    history.replaceState({ nav: snapshotNav(), stack: [] }, '', '#/');
  }
}

function navHash(nav) {
  const parts = [nav.view || 'home'];
  if (nav.department) parts.push(`dept-${encodeURIComponent(nav.department)}`);
  if (nav.vehicleType) parts.push(encodeURIComponent(nav.vehicleType));
  if (nav.brand) parts.push(encodeURIComponent(nav.brand));
  if (nav.parkingLot) parts.push(encodeURIComponent(nav.parkingLot));
  if (nav.parkingStatus) parts.push(nav.parkingStatus);
  return `#/${parts.join('/')}`;
}

async function goBack() {
  if (navStack.length > 0) {
    history.back();
    return;
  }

  // Fallback one-level up when stack empty
  if (state.view === 'summary' && state.department && (state.parkingStatus || state.vehicleType)) {
    applyNav({ view: 'summary', department: state.department });
    await loadSummary({ department: state.department });
  } else if (state.view === 'summary' && state.department) {
    applyNav({ view: 'departments' });
  } else if (state.view === 'summary' && state.brand && state.vehicleType) {
    applyNav({ view: 'brands', vehicleType: state.vehicleType });
  } else if (state.view === 'summary' && state.parkingLot) {
    applyNav({ view: 'parkingLots' });
  } else if (state.view === 'brands') {
    applyNav({ view: 'vehicleTypes' });
  } else if (state.view === 'departments') {
    applyNav({ view: 'home' });
  } else {
    applyNav({ view: 'home' });
  }
  if (state.view !== 'summary') state.summary = null;
  await render();
  history.replaceState({ nav: snapshotNav(), stack: [] }, '', navHash(snapshotNav()));
}

async function navigate(next, { push = true } = {}) {
  if (push) {
    navStack.push(snapshotNav());
  }
  applyNav(next);
  if (next.view === 'summary') {
    await loadSummary({
      vehicleType: next.vehicleType,
      brand: next.brand,
      parkingLot: next.parkingLot,
      parkingStatus: next.parkingStatus,
      department: next.department,
    });
  } else {
    state.summary = null;
  }
  await render();
  if (!suppressHistory) {
    const hist = { nav: snapshotNav(), stack: navStack.map((x) => ({ ...x })) };
    const url = navHash(snapshotNav());
    if (push) history.pushState(hist, '', url);
    else history.replaceState(hist, '', url);
  }
}

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
  const sheetId = snapshot?.spreadsheetId;
  if (sheetId && els.statFile) {
    els.statFile.href = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
    els.statFile.textContent = 'ไฟล์ข้อมูล';
  }
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
    crumb(
      'หน้าแรก',
      () => {
        goHome();
      },
      state.view === 'home',
    ),
  );

  if (state.vehicleType || state.view === 'vehicleTypes' || state.view === 'brands') {
    els.crumbs.appendChild(
      crumb(
        'ประเภทรถ',
        () => {
          navigate({ view: 'vehicleTypes' }, { push: true });
        },
        state.view === 'vehicleTypes',
      ),
    );
  }

  if (state.vehicleType) {
    els.crumbs.appendChild(
      crumb(
        displayVehicleType(state.vehicleType),
        () => {
          navigate({ view: 'brands', vehicleType: state.vehicleType }, { push: true });
        },
        state.view === 'brands' && !state.brand,
      ),
    );
  }

  if (state.brand) {
    els.crumbs.appendChild(crumb(state.brand, null, true));
  }

  if (state.view === 'parkingLots' || state.parkingLot) {
    els.crumbs.appendChild(
      crumb(
        'ลานจอด',
        () => {
          navigate({ view: 'parkingLots' }, { push: true });
        },
        state.view === 'parkingLots',
      ),
    );
  }

  if (state.parkingLot) {
    els.crumbs.appendChild(crumb(state.parkingLot, null, true));
  }

  if (state.view === 'departments' || state.department) {
    els.crumbs.appendChild(
      crumb(
        'แผนก',
        () => {
          navigate({ view: 'departments' }, { push: true });
        },
        state.view === 'departments',
      ),
    );
  }

  if (state.department) {
    els.crumbs.appendChild(
      crumb(
        state.department,
        () => {
          openSummary({ department: state.department });
        },
        state.view === 'summary' && !state.parkingStatus && !state.vehicleType,
      ),
    );
  }

  if (state.parkingStatus === 'has') {
    els.crumbs.appendChild(crumb('มีสติ๊กเกอร์', null, true));
  } else if (state.parkingStatus === 'none') {
    els.crumbs.appendChild(crumb('ไม่มีสติ๊กเกอร์', null, true));
  }

  if (state.department && state.vehicleType && !state.brand) {
    els.crumbs.appendChild(crumb(displayVehicleType(state.vehicleType), null, true));
  }
}

function displayVehicleType(name) {
  if (name === 'มอร์เตอร์ไซต์') return 'รถจักรยานยนต์';
  if (name === 'ไม่มีประเภทรถ') return 'ไม่ระบุประเภท';
  return name;
}

function typeCount(name) {
  return state.snapshot?.meta?.vehicleTypes?.find((t) => t.name === name)?.count ?? 0;
}

function parkingCount(key) {
  return state.snapshot?.meta?.parkingStatus?.find((t) => t.key === key)?.count ?? 0;
}

async function openSummary(filters = {}) {
  await navigate(
    {
      view: 'summary',
      vehicleType: filters.vehicleType || null,
      brand: filters.brand || null,
      parkingLot: filters.parkingLot || null,
      parkingStatus: filters.parkingStatus || null,
      department: filters.department || null,
    },
    { push: true },
  );
}

function kpiCard({ label, count, tone, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `kpi kpi-${tone}`;
  btn.innerHTML = `<strong class="kpi-count"></strong><span class="kpi-label"></span>`;
  btn.querySelector('.kpi-count').textContent = Number(count || 0).toLocaleString('th-TH');
  btn.querySelector('.kpi-label').textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
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

function showPanelDesc(text) {
  els.panelDesc.hidden = false;
  els.panelDesc.textContent = text;
}

function clearHomeNav() {
  els.btnGrid.parentElement?.querySelectorAll('.home-nav, .home-charts').forEach((el) => el.remove());
}

function renderHome() {
  clearHomeNav();
  const head = document.querySelector('.panel-head');
  head?.classList.add('banner');
  els.panelTitle.textContent = 'Dashboard';
  els.panelDesc.textContent = '';
  els.panelDesc.hidden = true;
  els.btnGrid.innerHTML = '';
  els.btnGrid.className = 'kpi-grid';
  els.summary.classList.add('hidden');
  els.summary.innerHTML = '';

  const total = state.snapshot?.meta?.total ?? 0;

  els.btnGrid.appendChild(
    kpiCard({
      label: 'รถทั้งหมด',
      count: total,
      tone: 'navy',
      onClick: () => openSummary({}),
    }),
  );
  els.btnGrid.appendChild(
    kpiCard({
      label: 'รถยนต์',
      count: typeCount('รถยนต์'),
      tone: 'teal',
      onClick: () => openSummary({ vehicleType: 'รถยนต์' }),
    }),
  );
  els.btnGrid.appendChild(
    kpiCard({
      label: 'รถจักรยานยนต์',
      count: typeCount('มอร์เตอร์ไซต์'),
      tone: 'orange',
      onClick: () => openSummary({ vehicleType: 'มอร์เตอร์ไซต์' }),
    }),
  );
  els.btnGrid.appendChild(
    kpiCard({
      label: 'ไม่ระบุประเภท',
      count: typeCount('ไม่มีประเภทรถ'),
      tone: 'gray',
      onClick: () => openSummary({ vehicleType: 'ไม่มีประเภทรถ' }),
    }),
  );
  els.btnGrid.appendChild(
    kpiCard({
      label: 'มีสติ๊กเกอร์',
      count: parkingCount('has'),
      tone: 'green',
      onClick: () => openSummary({ parkingStatus: 'has' }),
    }),
  );
  els.btnGrid.appendChild(
    kpiCard({
      label: 'ไม่มีสติ๊กเกอร์',
      count: parkingCount('none'),
      tone: 'red',
      onClick: () => openSummary({ parkingStatus: 'none' }),
    }),
  );

  const nav = document.createElement('div');
  nav.className = 'home-nav';
  nav.appendChild(
    choiceButton({
      label: 'ประเภทรถ',
      primary: true,
      onClick: () => {
        clearHomeNav();
        els.btnGrid.className = 'btn-grid';
        navigate({ view: 'vehicleTypes' }, { push: true });
      },
    }),
  );
  nav.appendChild(
    choiceButton({
      label: 'ประเภทลานจอด',
      primary: true,
      onClick: () => {
        clearHomeNav();
        els.btnGrid.className = 'btn-grid';
        navigate({ view: 'parkingLots' }, { push: true });
      },
    }),
  );
  nav.appendChild(
    choiceButton({
      label: 'แผนก',
      primary: true,
      onClick: () => {
        clearHomeNav();
        els.btnGrid.className = 'btn-grid';
        navigate({ view: 'departments' }, { push: true });
      },
    }),
  );
  els.btnGrid.after(nav);

  const charts = document.createElement('div');
  charts.className = 'home-charts';
  charts.innerHTML = buildHomeChartsHtml();
  nav.after(charts);
  requestAnimationFrame(() => animateHomeCharts(charts));
}

const CHART_COLORS = {
  'รถยนต์': '#1f7a7a',
  'มอร์เตอร์ไซต์': '#e67e22',
  'ไม่มีประเภทรถ': '#6c757d',
  'มีสติ๊กเกอร์': '#27ae60',
  'ไม่มีสติ๊กเกอร์': '#e74c3c',
};

function buildHomeChartsHtml() {
  const types = (state.snapshot?.meta?.vehicleTypes || []).map((t) => ({
    name: displayVehicleType(t.name),
    count: t.count,
    color: CHART_COLORS[t.name] || '#6fd4a8',
  }));
  const stickers = (state.snapshot?.meta?.parkingStatus || []).map((t) => ({
    name: t.name,
    count: t.count,
    color: CHART_COLORS[t.name] || '#6fd4a8',
  }));
  const lots = (state.snapshot?.meta?.parkingLots || []).slice(0, 8);

  return `
    <div class="charts-grid">
      <div class="chart-card">
        <h3>สัดส่วนประเภทรถ</h3>
        <div class="chart-body">
          ${donutChartSvg(types)}
          ${chartLegend(types)}
        </div>
      </div>
      <div class="chart-card">
        <h3>สัดส่วนสติ๊กเกอร์</h3>
        <div class="chart-body">
          ${donutChartSvg(stickers)}
          ${chartLegend(stickers)}
        </div>
      </div>
      <div class="chart-card chart-card-wide">
        <h3>จำนวนรถตามลานจอด</h3>
        ${barChartHtml(lots)}
      </div>
    </div>
  `;
}

function chartLegend(items) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return `<ul class="chart-legend">${items
    .map((i) => {
      const pct = Math.round((i.count / total) * 100);
      return `<li><span class="swatch" style="background:${i.color}"></span>
        <span>${escapeHtml(i.name)}</span>
        <strong>${i.count.toLocaleString('th-TH')} (${pct}%)</strong></li>`;
    })
    .join('')}</ul>`;
}

function donutChartSvg(items) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (!total) {
    return `<div class="empty">ไม่มีข้อมูล</div>`;
  }
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = items
    .filter((i) => i.count > 0)
    .map((i) => {
      const len = (i.count / total) * c;
      const seg = `<circle class="donut-seg" cx="70" cy="70" r="${r}" fill="transparent"
        stroke="${i.color}" stroke-width="22"
        stroke-dasharray="${len} ${c - len}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 70 70)"></circle>`;
      offset += len;
      return seg;
    })
    .join('');

  return `<div class="donut-wrap">
    <svg viewBox="0 0 140 140" class="donut" aria-hidden="true">
      <circle cx="70" cy="70" r="${r}" fill="transparent" stroke="rgba(255,255,255,0.08)" stroke-width="22"></circle>
      ${segments}
      <text x="70" y="66" text-anchor="middle" class="donut-total">${total.toLocaleString('th-TH')}</text>
      <text x="70" y="84" text-anchor="middle" class="donut-sub">คัน</text>
    </svg>
  </div>`;
}

function barChartHtml(lots) {
  if (!lots.length) return `<p class="empty">ไม่มีข้อมูลลานจอด</p>`;
  const max = Math.max(...lots.map((l) => l.count), 1);
  return `<div class="lot-bars">${lots
    .map((l) => {
      const pct = Math.round((l.count / max) * 100);
      return `<div class="lot-bar-row">
        <span class="lot-name">${escapeHtml(l.name)}</span>
        <div class="lot-track"><div class="lot-fill" style="--w:${pct}%"></div></div>
        <strong class="lot-count">${l.count.toLocaleString('th-TH')}</strong>
      </div>`;
    })
    .join('')}</div>`;
}

function animateHomeCharts(root) {
  root.querySelectorAll('.lot-fill').forEach((el) => {
    const w = el.style.getPropertyValue('--w') || '0%';
    el.style.width = '0';
    requestAnimationFrame(() => {
      el.style.width = w.trim();
    });
  });
}

function renderVehicleTypes() {
  clearHomeNav();
  document.querySelector('.panel-head')?.classList.remove('banner');
  els.btnGrid.className = 'btn-grid';
  els.panelTitle.textContent = 'ประเภทรถ';
  showPanelDesc('เลือกประเภทรถ แล้วระบบจะแสดงปุ่มย่อยยี่ห้อรถ');
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
        label: displayVehicleType(item.name),
        count: item.count,
        onClick: () => {
          navigate({ view: 'brands', vehicleType: item.name }, { push: true });
        },
      }),
    );
  }
}

async function renderBrands() {
  clearHomeNav();
  document.querySelector('.panel-head')?.classList.remove('banner');
  els.btnGrid.className = 'btn-grid';
  els.panelTitle.textContent = `ยี่ห้อรถ — ${displayVehicleType(state.vehicleType)}`;
  showPanelDesc('เลือกยี่ห้อเพื่อดูสรุปจำนวน สีรถ และสีสติ๊กเกอร์');
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
        onClick: () => {
          openSummary({ vehicleType: state.vehicleType, brand: item.name });
        },
      }),
    );
  }
}

async function renderParkingLots() {
  clearHomeNav();
  document.querySelector('.panel-head')?.classList.remove('banner');
  els.btnGrid.className = 'btn-grid';
  els.panelTitle.textContent = 'ประเภทลานจอด';
  showPanelDesc('เลือกประเภทลานจอดเพื่อดูสรุปจำนวนรถ สีรถ ยี่ห้อรถ และสีสติ๊กเกอร์');
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
        onClick: () => {
          openSummary({ parkingLot: item.name });
        },
      }),
    );
  }
}

function renderDepartments() {
  clearHomeNav();
  document.querySelector('.panel-head')?.classList.remove('banner');
  els.btnGrid.className = 'btn-grid dept-grid';
  els.panelTitle.textContent = 'แผนก';
  showPanelDesc('เลือกแผนกเพื่อดูรถที่ใช้ และสถานะสติ๊กเกอร์');
  els.btnGrid.innerHTML = '';
  els.summary.classList.add('hidden');

  const items = state.snapshot?.meta?.departments || [];
  if (!items.length) {
    els.btnGrid.innerHTML = '<p class="empty">ยังไม่มีข้อมูลแผนก</p>';
    return;
  }

  for (const item of items) {
    els.btnGrid.appendChild(
      choiceButton({
        label: item.name,
        count: item.count,
        onClick: () => {
          openSummary({ department: item.name });
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
  if (filters.parkingStatus) q.set('parkingStatus', filters.parkingStatus);
  if (filters.department) q.set('department', filters.department);
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

function vehicleCardsHtml(vehicles, { showOwner = false } = {}) {
  if (!vehicles?.length) return '<p class="empty">ไม่มีรายการรถ</p>';
  return `<div class="vehicle-list">${vehicles
    .map((v, idx) => {
      const stickerClass = v.hasSticker === 'มีสติ๊กเกอร์' ? 'yes' : 'no';
      const owner = v.employee && v.employee !== '-' ? v.employee : 'ไม่ระบุเจ้าของ';
      return `<button type="button" class="vehicle-card${showOwner ? ' open' : ''}" data-idx="${idx}">
        <div class="vc-top">
          <strong class="vc-plate">${escapeHtml(v.plate)}</strong>
          <span class="sticker-badge ${stickerClass}">${escapeHtml(v.hasSticker)}</span>
        </div>
        <div class="vc-meta">
          <span>${escapeHtml(displayVehicleType(v.vehicleType))}</span>
          <span>${escapeHtml(v.brand)}</span>
          <span>${escapeHtml(v.vehicleColor)}</span>
        </div>
        <div class="vc-owner">เจ้าของรถ: <strong>${escapeHtml(owner)}</strong></div>
        <div class="vc-hint">${showOwner ? '' : 'คลิกเพื่อดูชื่อเจ้าของรถ'}</div>
      </button>`;
    })
    .join('')}</div>`;
}

function bindVehicleCards(root, { showOwner = false } = {}) {
  if (showOwner) return;
  root.querySelectorAll('.vehicle-card').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('open');
    });
  });
}

function renderSummary() {
  clearHomeNav();
  document.querySelector('.panel-head')?.classList.remove('banner');
  els.btnGrid.className = 'btn-grid';
  const s = state.summary?.summary;
  const filters = state.summary?.filters || {};
  const titleParts = [];
  if (filters.department) titleParts.push(`แผนก ${filters.department}`);
  if (filters.parkingLot) titleParts.push(filters.parkingLot);
  if (filters.vehicleType) titleParts.push(displayVehicleType(filters.vehicleType));
  if (filters.brand) titleParts.push(filters.brand);
  if (filters.parkingStatus === 'has') titleParts.push('มีสติ๊กเกอร์');
  if (filters.parkingStatus === 'none') titleParts.push('ไม่มีสติ๊กเกอร์');

  const isDept = Boolean(filters.department);
  const showOwnerAlways = Boolean(filters.vehicleType || filters.parkingStatus || filters.brand);
  const showVehicleCards = isDept || showOwnerAlways;

  els.panelTitle.textContent = `สรุป — ${titleParts.join(' / ') || 'รถทั้งหมด'}`;
  showPanelDesc(
    isDept
      ? 'รถของแผนกนี้ · คลิกการ์ดรถหรือดูสติ๊กเกอร์เพื่อดูชื่อเจ้าของรถ'
      : 'จำนวนรถ สีรถ ยี่ห้อรถ และสีสติ๊กเกอร์ จากข้อมูล realtime',
  );
  els.btnGrid.innerHTML = '';
  els.summary.classList.remove('hidden');

  if (!s) {
    els.summary.innerHTML = '<p class="empty">ไม่มีข้อมูลสรุป</p>';
    return;
  }

  const stickerHas = s.bySticker?.find((x) => x.name === 'มีสติ๊กเกอร์')?.count ?? 0;
  const stickerNone = s.bySticker?.find((x) => x.name === 'ไม่มีสติ๊กเกอร์')?.count ?? 0;
  const carCount = s.vehicles?.filter((v) => v.vehicleType === 'รถยนต์').length ?? 0;
  const bikeCount = s.vehicles?.filter((v) => v.vehicleType === 'มอร์เตอร์ไซต์').length ?? 0;

  let deptFilters = '';
  if (isDept && !filters.parkingStatus && !filters.vehicleType) {
    deptFilters = `
      <div class="dept-filters">
        <button type="button" class="mini-kpi mini-teal" data-filter="type" data-value="รถยนต์">
          <strong>${carCount.toLocaleString('th-TH')}</strong><span>รถยนต์</span>
        </button>
        <button type="button" class="mini-kpi mini-orange" data-filter="type" data-value="มอร์เตอร์ไซต์">
          <strong>${bikeCount.toLocaleString('th-TH')}</strong><span>รถจักรยานยนต์</span>
        </button>
        <button type="button" class="mini-kpi mini-green" data-filter="sticker" data-value="has">
          <strong>${stickerHas.toLocaleString('th-TH')}</strong><span>มีสติ๊กเกอร์</span>
        </button>
        <button type="button" class="mini-kpi mini-red" data-filter="sticker" data-value="none">
          <strong>${stickerNone.toLocaleString('th-TH')}</strong><span>ไม่มีสติ๊กเกอร์</span>
        </button>
      </div>`;
  }

  const rows = (s.vehicles || [])
    .map(
      (v) => `<tr>
        <td>${escapeHtml(v.plate)}</td>
        <td><strong>${escapeHtml(v.employee || '-')}</strong></td>
        <td>${escapeHtml(displayVehicleType(v.vehicleType))}</td>
        <td>${escapeHtml(v.brand)}</td>
        <td>${escapeHtml(v.vehicleColor)}</td>
        <td>${escapeHtml(v.stickerColor)}</td>
        <td>${escapeHtml(v.hasSticker)}</td>
        <td>${escapeHtml(v.department)}</td>
        <td>${escapeHtml(v.division)}</td>
      </tr>`,
    )
    .join('');

  els.summary.innerHTML = `
    <div class="summary-hero">
      <div>
        <div class="big">${s.total.toLocaleString('th-TH')}</div>
        <div class="caption">จำนวนรถ</div>
      </div>
    </div>
    ${deptFilters}
    ${
      showVehicleCards
        ? `<h3 class="section-title">รายการรถ${showOwnerAlways ? ' · มีชื่อเจ้าของรถ' : ' · คลิกการ์ดเพื่อดูเจ้าของ'}</h3>
           ${vehicleCardsHtml(s.vehicles, { showOwner: showOwnerAlways })}`
        : ''
    }
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
            <th>เจ้าของรถ</th>
            <th>ประเภท</th>
            <th>ยี่ห้อ</th>
            <th>สีรถ</th>
            <th>สีสติ๊กเกอร์</th>
            <th>สติ๊กเกอร์</th>
            <th>แผนก</th>
            <th>ฝ่าย</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9">ไม่มีรายการ</td></tr>'}</tbody>
      </table>
    </div>
  `;

  bindVehicleCards(els.summary, { showOwner: showOwnerAlways });

  els.summary.querySelectorAll('.mini-kpi').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.filter;
      const value = btn.dataset.value;
      if (kind === 'sticker') {
        openSummary({ department: filters.department, parkingStatus: value });
      } else if (kind === 'type') {
        openSummary({ department: filters.department, vehicleType: value });
      }
    });
  });

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
  updateBackButton();

  if (state.snapshot && state.snapshot.ok === false) {
    els.panelDesc.textContent = state.snapshot.error || 'อ่านข้อมูลไม่สำเร็จ';
  }

  try {
    if (state.view === 'home') renderHome();
    else if (state.view === 'vehicleTypes') renderVehicleTypes();
    else if (state.view === 'brands') await renderBrands();
    else if (state.view === 'parkingLots') await renderParkingLots();
    else if (state.view === 'departments') renderDepartments();
    else if (state.view === 'summary') {
      if (!state.summary) {
        await loadSummary({
          vehicleType: state.vehicleType,
          brand: state.brand,
          parkingLot: state.parkingLot,
          parkingStatus: state.parkingStatus,
          department: state.department,
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
      parkingStatus: state.parkingStatus,
      department: state.department,
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

els.btnBack?.addEventListener('click', () => {
  goBack();
});

els.btnHome?.addEventListener('click', () => {
  goHome();
});

window.addEventListener('popstate', async (ev) => {
  suppressHistory = true;
  const data = ev.state;
  if (data?.nav) {
    navStack.length = 0;
    if (Array.isArray(data.stack)) {
      for (const item of data.stack) navStack.push(item);
    }
    applyNav(data.nav);
    if (data.nav.view === 'summary') {
      await loadSummary({
        vehicleType: data.nav.vehicleType,
        brand: data.nav.brand,
        parkingLot: data.nav.parkingLot,
        parkingStatus: data.nav.parkingStatus,
        department: data.nav.department,
      });
    } else {
      state.summary = null;
    }
    await render();
  } else {
    await goHome();
  }
  suppressHistory = false;
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
  history.replaceState({ nav: snapshotNav(), stack: [] }, '', '#/');
  await render();
  startPolling(5000);
  connectSSE();
}

boot();
