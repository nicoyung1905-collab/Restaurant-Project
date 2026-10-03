// ===================================================
// 1. DATA MASTER: MEJA DENGAN KOORDINAT BLUEPRINT
// ===================================================

const tablesData = [
  // ================= LANTAI 1 (KOORDINAT PIXEL PADA KANVAS 800x600) =================
  // Meja Bulat 2-Seater (Dekat Pintu Masuk / Jendela Depan)
  { id: 'T101', name: 'M-101', floor: 1, capacity: 2, shape: 'round', x: 50, y: 440, w: 75, h: 75, status: 'available', orderTime: null, items: [] },
  { id: 'T102', name: 'M-102', floor: 1, capacity: 2, shape: 'round', x: 160, y: 440, w: 75, h: 75, status: 'available', orderTime: null, items: [] },

  // Meja Persegi 4-Seater (Tengah Aula Makan)
  { id: 'T103', name: 'M-103', floor: 1, capacity: 4, shape: 'rect', x: 50, y: 280, w: 90, h: 75, status: 'available', orderTime: null, items: [] },
  { id: 'T104', name: 'M-104', floor: 1, capacity: 4, shape: 'rect', x: 180, y: 280, w: 90, h: 75, status: 'available', orderTime: null, items: [] },
  { id: 'T105', name: 'M-105', floor: 1, capacity: 4, shape: 'rect', x: 310, y: 280, w: 90, h: 75, status: 'available', orderTime: null, items: [] },

  // Meja Persegi Panjang 6-Seater (Sisi Kanan)
  { id: 'T106', name: 'M-106', floor: 1, capacity: 6, shape: 'rect', x: 440, y: 280, w: 110, h: 75, status: 'available', orderTime: null, items: [] },
  { id: 'T107', name: 'M-107', floor: 1, capacity: 6, shape: 'rect', x: 440, y: 440, w: 110, h: 75, status: 'available', orderTime: null, items: [] },

  // Booth Sofa 8-Seater (Pojok Kiri Atas)
  { id: 'T108', name: 'M-108 Booth', floor: 1, capacity: 8, shape: 'booth', x: 50, y: 50, w: 150, h: 85, status: 'available', orderTime: null, items: [] },

  // ================= LANTAI 2 (KOORDINAT PIXEL PADA KANVAS 800x600) =================
  // VIP Room A & B (Ruang Tertutup Sisi Atas)
  { id: 'T201', name: 'VIP 201 (A)', floor: 2, capacity: 8, shape: 'vip', x: 60, y: 60, w: 160, h: 110, status: 'available', orderTime: null, items: [] },
  { id: 'T202', name: 'VIP 202 (B)', floor: 2, capacity: 8, shape: 'vip', x: 260, y: 60, w: 160, h: 110, status: 'available', orderTime: null, items: [] },

  // Balkon Outdoor Meja 2-Seater Bulat
  { id: 'T203', name: 'Balkon 203', floor: 2, capacity: 2, shape: 'round', x: 70, y: 440, w: 80, h: 80, status: 'available', orderTime: null, items: [] },
  { id: 'T204', name: 'Balkon 204', floor: 2, capacity: 2, shape: 'round', x: 210, y: 440, w: 80, h: 80, status: 'available', orderTime: null, items: [] },

  // Balkon Outdoor Meja Persegi 4-Seater
  { id: 'T205', name: 'Balkon 205', floor: 2, capacity: 4, shape: 'rect', x: 370, y: 435, w: 105, h: 80, status: 'available', orderTime: null, items: [] },
  { id: 'T206', name: 'Balkon 206', floor: 2, capacity: 4, shape: 'rect', x: 530, y: 435, w: 105, h: 80, status: 'available', orderTime: null, items: [] }
];

const menuList = [
  { id: 'm1', name: 'Big Burger Combo', category: 'food', price: 45000, icon: '🍔' },
  { id: 'm2', name: 'Double Cheese Burger', category: 'food', price: 38000, icon: '🍔' },
  { id: 'm3', name: 'Paket 2 Ayam Pedas + Nasi', category: 'food', price: 42000, icon: '🍗' },
  { id: 'm4', name: 'Crispy Chicken Wrap', category: 'food', price: 29000, icon: '🌯' },
  { id: 'm5', name: 'French Fries (L)', category: 'snack', price: 22000, icon: '🍟' },
  { id: 'm6', name: 'Chicken Nuggets (6 pcs)', category: 'snack', price: 26000, icon: '🍗' },
  { id: 'm7', name: 'Coca-Cola Dingin', category: 'drink', price: 12000, icon: '🥤' },
  { id: 'm8', name: 'Lemon Tea Segar', category: 'drink', price: 14000, icon: '🍋' },
  { id: 'm9', name: 'Sundae Cokelat Belgia', category: 'snack', price: 16500, icon: '🍦' }
];

// Ambang batas pesanan telat: 15 menit (900 detik)
const LATE_THRESHOLD_SECONDS = 15 * 60;

// State Aplikasi
let currentFloor = 1;
let activeTableId = null;

// ===================================================
// 2. FORMATTING HELPERS
// ===================================================

function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ===================================================
// 3. AUTO RESIZE ENGINE (FIXED ASPECT RATIO)
// ===================================================

function adjustBlueprintScale() {
  const viewport = document.getElementById('blueprint-viewport');
  const canvas = document.getElementById('blueprint-canvas');
  if (!viewport || !canvas) return;

  const virtualWidth = 800;
  const virtualHeight = 600;

  // Ukuran riil viewport (dikurangi margin padding)
  const availWidth = viewport.clientWidth - 20;
  const availHeight = viewport.clientHeight - 20;

  if (availWidth <= 0 || availHeight <= 0) return;

  // Pilih skala minimum agar kanvas tidak terpotong
  const scale = Math.min(availWidth / virtualWidth, availHeight / virtualHeight);
  canvas.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', adjustBlueprintScale);

// ===================================================
// 4. DROPDOWN & NAVIGASI MEJA
// ===================================================

function populateTableDropdown() {
  const dropdown = document.getElementById('table-dropdown-select');
  if (!dropdown) return;

  dropdown.innerHTML = '<option value="">-- Pilih Meja --</option>';

  [1, 2].forEach(floorNum => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = `--- Lantai ${floorNum} ---`;

    const floorTables = tablesData.filter(t => t.floor === floorNum);
    floorTables.forEach(table => {
      const option = document.createElement('option');
      option.value = table.id;
      option.textContent = `${table.name} (${table.capacity} Kursi)`;
      optgroup.appendChild(option);
    });

    dropdown.appendChild(optgroup);
  });
}

function navigateTable(direction) {
  if (!activeTableId) {
    const floorTables = tablesData.filter(t => t.floor === currentFloor);
    if (floorTables.length > 0) selectTable(floorTables[0].id);
    return;
  }

  const currentIndex = tablesData.findIndex(t => t.id === activeTableId);
  let nextIndex = currentIndex + direction;

  if (nextIndex < 0) nextIndex = tablesData.length - 1;
  if (nextIndex >= tablesData.length) nextIndex = 0;

  selectTable(tablesData[nextIndex].id);
}

// ===================================================
// 5. RENDER BLUEPRINT ARSITEKTUR & MEJA
// ===================================================

function switchFloor(floorNum) {
  currentFloor = floorNum;
  document.getElementById('btn-floor-1').classList.toggle('active', floorNum === 1);
  document.getElementById('btn-floor-2').classList.toggle('active', floorNum === 2);

  document.getElementById('floor-title').textContent = floorNum === 1 
    ? '📍 Lantai 1 (Indoor & Bar)' 
    : '📍 Lantai 2 (VIP & Balkon)';

  renderBlueprintCanvas();
  adjustBlueprintScale();
}

function renderBlueprintCanvas() {
  const canvas = document.getElementById('blueprint-canvas');
  if (!canvas) return;

  // Fasilitas Statis Sesuai Dimensi Kanvas 800x600 px
  if (currentFloor === 1) {
    canvas.innerHTML = `
      <div class="blueprint-zone entrance" style="bottom: 0; left: 120px; width: 140px; height: 35px;">
        🚪 Pintu Masuk Utama
      </div>
      <div class="blueprint-zone cashier" style="bottom: 20px; right: 30px; width: 150px; height: 80px;">
        💼 Kasir & POS
      </div>
      <div class="blueprint-zone bar" style="bottom: 120px; right: 30px; width: 150px; height: 80px;">
        ☕ Bar Minuman
      </div>
      <div class="blueprint-zone kitchen" style="top: 20px; right: 30px; width: 220px; height: 130px;">
        🍳 Dapur & Pickup
      </div>
      <div class="blueprint-zone stairs" style="top: 20px; left: 340px; width: 100px; height: 70px;">
        🪜 Tangga Lt 2
      </div>
    `;
  } else {
    canvas.innerHTML = `
      <div class="blueprint-zone stairs" style="top: 20px; right: 30px; width: 110px; height: 75px;">
        🪜 Tangga ke Lt 1
      </div>
      <div class="blueprint-zone toilet" style="top: 115px; right: 30px; width: 110px; height: 75px;">
        🚻 Toilet Lt 2
      </div>
      <div class="blueprint-divider" style="bottom: 230px; left: 0; width: 100%; border-top: 2px dashed #94a3b8;">
        <span class="divider-text">🌿 AREA BALKON / OUTDOOR SMOKING</span>
      </div>
    `;
  }

  renderFloorTables();
}

function renderFloorTables() {
  const canvas = document.getElementById('blueprint-canvas');
  if (!canvas) return;

  const existingTables = canvas.querySelectorAll('.table-card');
  existingTables.forEach(t => t.remove());

  const floorTables = tablesData.filter(t => t.floor === currentFloor);

  floorTables.forEach(table => {
    const card = document.createElement('div');
    const isSelected = table.id === activeTableId;

    let statusClass = table.status;
    let timerText = '--:--';

    if (table.status === 'waiting') {
      const waitSeconds = Math.floor((Date.now() - table.orderTime) / 1000);
      timerText = formatDuration(waitSeconds);
      if (waitSeconds >= LATE_THRESHOLD_SECONDS) {
        statusClass = 'late';
      }
    } else if (table.status === 'served') {
      timerText = 'Selesai';
    }

    card.className = `table-card table-${table.shape} ${statusClass} ${isSelected ? 'selected' : ''}`;
    // Koordinat Posisi Tetap (Pixel Virtual)
    card.style.left = `${table.x}px`;
    card.style.top = `${table.y}px`;
    card.style.width = `${table.w}px`;
    card.style.height = `${table.h}px`;
    card.onclick = () => selectTable(table.id);

    card.innerHTML = `
      <div class="table-blueprint-inner">
        <span class="table-name">${table.name}</span>
        <span class="table-capacity">👥 ${table.capacity}</span>
        <div class="table-timer">${timerText}</div>
      </div>
    `;

    canvas.appendChild(card);
  });

  updateLateBadgeCount();
}

// ===================================================
// 6. PEMILIHAN MEJA & ORDER PANEL
// ===================================================

function selectTable(tableId) {
  if (!tableId) return;
  activeTableId = tableId;
  const table = tablesData.find(t => t.id === tableId);
  if (!table) return;

  // Sinkronkan nilai dropdown
  const dropdown = document.getElementById('table-dropdown-select');
  if (dropdown && dropdown.value !== table.id) {
    dropdown.value = table.id;
  }

  // Jika meja yang dipilih berada di lantai berbeda, ubah lantai otomatis
  if (table.floor !== currentFloor) {
    switchFloor(table.floor);
  }

  // Update Header Panel Pesanan
  document.getElementById('active-table-title').textContent = table.name;
  document.getElementById('cart-table-badge').textContent = `(${table.id})`;

  const statusBadge = document.getElementById('active-table-status');
  statusBadge.className = `badge-status badge-${table.status}`;

  if (table.status === 'available') statusBadge.textContent = 'Meja Kosong';
  if (table.status === 'waiting') statusBadge.textContent = 'Menunggu Makanan';
  if (table.status === 'served') statusBadge.textContent = 'Sudah Disajikan';

  renderCurrentOrderList();
  updateActionButtons(table);
  renderFloorTables();
}

function renderMenuList(category = 'all') {
  const tabButtons = document.querySelectorAll('.menu-tab-btn');
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(category));
  });

  const menuContainer = document.getElementById('menu-items-container');
  menuContainer.innerHTML = '';

  const filtered = category === 'all' ? menuList : menuList.filter(item => item.category === category);

  filtered.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.onclick = () => addItemToOrder(item);
    btn.innerHTML = `
      <span class="menu-name">${item.icon} ${item.name}</span>
      <span class="menu-price">${formatRupiah(item.price)}</span>
    `;
    menuContainer.appendChild(btn);
  });
}

function addItemToOrder(menuItem) {
  if (!activeTableId) {
    alert('Silakan pilih meja terlebih dahulu di denah atau dropdown!');
    return;
  }

  const table = tablesData.find(t => t.id === activeTableId);
  if (table.status === 'served') {
    alert('Meja ini sudah selesai disajikan. Kosongkan meja terlebih dahulu jika ada tamu baru.');
    return;
  }

  const existing = table.items.find(i => i.id === menuItem.id);
  if (existing) {
    existing.qty += 1;
  } else {
    table.items.push({ ...menuItem, qty: 1 });
  }

  renderCurrentOrderList();
  updateActionButtons(table);
}

function changeQty(menuId, change) {
  const table = tablesData.find(t => t.id === activeTableId);
  if (!table) return;

  const itemIndex = table.items.findIndex(i => i.id === menuId);
  if (itemIndex > -1) {
    table.items[itemIndex].qty += change;
    if (table.items[itemIndex].qty <= 0) {
      table.items.splice(itemIndex, 1);
    }
  }

  renderCurrentOrderList();
  updateActionButtons(table);
}

function renderCurrentOrderList() {
  const container = document.getElementById('order-items-container');
  const totalPriceEl = document.getElementById('order-total-price');

  if (!activeTableId) {
    container.innerHTML = '<p class="empty-hint">Pilih meja di denah atau dropdown terlebih dahulu.</p>';
    totalPriceEl.textContent = 'Rp 0';
    return;
  }

  const table = tablesData.find(t => t.id === activeTableId);

  if (table.items.length === 0) {
    container.innerHTML = '<p class="empty-hint">Belum ada item pesanan untuk meja ini.</p>';
    totalPriceEl.textContent = 'Rp 0';
    return;
  }

  let total = 0;
  let html = '<ul class="cart-items-list">';

  table.items.forEach(item => {
    const subtotal = item.price * item.qty;
    total += subtotal;
    html += `
      <li class="cart-item">
        <div class="cart-item-name">
          <strong>${item.name}</strong>
          <small>${formatRupiah(item.price)}</small>
        </div>
        <div class="cart-qty-control">
          ${table.status === 'available' ? `<button class="qty-btn" onclick="changeQty('${item.id}', -1)">-</button>` : ''}
          <span class="qty-number">${item.qty}x</span>
          ${table.status === 'available' ? `<button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>` : ''}
        </div>
        <span class="cart-subtotal">${formatRupiah(subtotal)}</span>
      </li>
    `;
  });

  html += '</ul>';
  container.innerHTML = html;
  totalPriceEl.textContent = formatRupiah(total);
}

// ===================================================
// 7. STATUS CONTROL & TOMBOL AKSI
// ===================================================

function updateActionButtons(table) {
  const btnSend = document.getElementById('btn-send-kitchen');
  const btnServe = document.getElementById('btn-mark-served');
  const btnClear = document.getElementById('btn-clear-table');

  btnSend.classList.add('hidden');
  btnServe.classList.add('hidden');
  btnClear.classList.add('hidden');
  btnSend.disabled = true;

  if (table.status === 'available') {
    btnSend.classList.remove('hidden');
    btnSend.disabled = table.items.length === 0;
  } else if (table.status === 'waiting') {
    btnServe.classList.remove('hidden');
  } else if (table.status === 'served') {
    btnClear.classList.remove('hidden');
  }
}

function sendOrderToKitchen() {
  const table = tablesData.find(t => t.id === activeTableId);
  if (!table || table.items.length === 0) return;

  table.status = 'waiting';
  table.orderTime = Date.now();

  selectTable(table.id);
  renderFloorTables();
}

function markOrderServed() {
  const table = tablesData.find(t => t.id === activeTableId);
  if (!table) return;

  table.status = 'served';

  selectTable(table.id);
  renderFloorTables();
}

function clearCurrentTable() {
  const table = tablesData.find(t => t.id === activeTableId);
  if (!table) return;

  if (confirm(`Kosongkan ${table.name}? Riwayat pesanan meja ini akan dibersihkan.`)) {
    table.status = 'available';
    table.orderTime = null;
    table.items = [];

    selectTable(table.id);
    renderFloorTables();
  }
}

// ===================================================
// 8. REAL-TIME TIMER & PERINGATAN TELAT
// ===================================================

function updateLateBadgeCount() {
  const lateCount = tablesData.filter(t => {
    if (t.status === 'waiting' && t.orderTime) {
      return (Math.floor((Date.now() - t.orderTime) / 1000)) >= LATE_THRESHOLD_SECONDS;
    }
    return false;
  }).length;

  const badge = document.getElementById('late-counter');
  badge.textContent = `${lateCount} Meja Telat`;
  badge.classList.toggle('alert', lateCount > 0);
}

// Interval loop setiap 1 detik
setInterval(() => {
  renderFloorTables();

  if (activeTableId) {
    const table = tablesData.find(t => t.id === activeTableId);
    const timerBox = document.getElementById('active-timer-box');
    const timerVal = document.getElementById('active-timer-val');

    if (table && table.status === 'waiting' && table.orderTime) {
      const waitSeconds = Math.floor((Date.now() - table.orderTime) / 1000);
      timerBox.classList.remove('hidden');
      timerVal.textContent = formatDuration(waitSeconds);

      if (waitSeconds >= LATE_THRESHOLD_SECONDS) {
        timerBox.classList.add('timer-late');
      } else {
        timerBox.classList.remove('timer-late');
      }
    } else {
      timerBox.classList.add('hidden');
    }
  }
}, 1000);

// Inisialisasi awal aplikasi
document.addEventListener('DOMContentLoaded', () => {
  populateTableDropdown();
  switchFloor(1);
  renderMenuList('all');
  setTimeout(adjustBlueprintScale, 60);
});