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
    const card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('aria-label', table.name + ', ' + table.capacity + ' kursi, ' + table.status);
    const isSelected = table.id === activeTableId;

    let statusClass = table.status;
    let timerText = '--:--';

    if (['waiting','preparing'].includes(table.status)) {
      const waitSeconds = Math.floor((Resto.now() - table.orderTime) / 1000);
      timerText = formatDuration(waitSeconds);
      if (waitSeconds >= LATE_THRESHOLD_SECONDS) {
        statusClass = 'late';
      }
    } else if (table.status === 'ready') {
      timerText = 'Siap diambil';
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
        <span class="table-capacity">👥 ${table.guestCount ? table.guestCount+' tamu' : table.capacity+' kursi'}</span>
        <div class="table-timer">${table.readyCount && table.status !== 'ready' ? table.readyCount + ' siap' : timerText}</div>
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

  renderCustomerPanel();
  renderMenuList();
  renderCurrentOrderList();
  updateSelectedStatus();
  renderFloorTables();
}

const drafts = new Map();
let currentMenuCategory='all',stockSignature='';
function draftFor(tableId=activeTableId){if(!drafts.has(tableId))drafts.set(tableId,{items:[],notes:'',allergies:'',visitId:visitFor(tableId)?.id||null,requestId:crypto.randomUUID()});const d=drafts.get(tableId);if(!d.items.length)d.visitId=visitFor(tableId)?.id||null;return d;}
function setDraftField(field,value){if(!activeTableId)return;const d=draftFor();d[field]=value;d.requestId=crypto.randomUUID();}
function setItemNote(id,value){const d=draftFor();const i=d.items.find(i=>i.id===id);if(i){i.note=value;d.requestId=crypto.randomUUID();}}
function renderMenuList(category=currentMenuCategory){
 currentMenuCategory=category;
 document.querySelectorAll('.menu-tab-btn').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('onclick').includes("'"+category+"'")));
 const menu=Resto.state?.menu || RestoCatalog.map(m=>({...m,available:true}));
 const container=document.getElementById('menu-items-container');container.innerHTML='';
 for(const item of menu.filter(i=>category==='all'||i.category===category)){
  const btn=document.createElement('button');btn.className='menu-btn';btn.disabled=!item.available||!visitFor();btn.onclick=()=>addItemToOrder(item);
  btn.innerHTML=`<span class="menu-name">${item.icon} ${Resto.escape(item.name)}</span><span class="menu-price">${item.available?formatRupiah(item.price):'Habis'}</span>`;container.appendChild(btn);
 }
}
function addItemToOrder(menuItem){
 if(!activeTableId){Resto.toast('Pilih meja terlebih dahulu.',true);return;}
 if(!visitFor()){Resto.toast('Buka meja dan catat jumlah pelanggan terlebih dahulu.',true);return;}
 const item=Resto.state?.menu.find(i=>i.id===menuItem.id);if(item&&!item.available){Resto.toast('Menu sedang habis.',true);return;}
 const d=draftFor(),existing=d.items.find(i=>i.id===menuItem.id);
 if(existing){if(existing.qty>=99)return;existing.qty++;}else d.items.push({...menuItem,qty:1,note:''});
 d.requestId=crypto.randomUUID();renderCurrentOrderList();updateActionButtons(tablesData.find(t=>t.id===activeTableId));
}
function changeQty(menuId,change){const d=draftFor(),i=d.items.find(i=>i.id===menuId);if(!i)return;i.qty+=change;d.items=d.items.filter(i=>i.qty>0);d.requestId=crypto.randomUUID();renderCurrentOrderList();updateActionButtons(tablesData.find(t=>t.id===activeTableId));}
function tableOrders(tableId=activeTableId){return Resto.state?.orders.filter(o=>o.table_id===tableId)||[];}
function updateTotal(){
 const total=tableOrders().flatMap(o=>o.items).filter(i=>i.status!=='cancelled').reduce((sum,i)=>sum+i.menu.price*i.qty,0)+(activeTableId?draftFor().items.reduce((sum,i)=>sum+i.price*i.qty,0):0);
 document.getElementById('order-total-price').textContent=formatRupiah(total);
}
function renderCurrentOrderList(){
 const container=document.getElementById('order-items-container');
 if(!activeTableId){container.innerHTML='<p class="empty-hint">Pilih meja terlebih dahulu.</p>';return;}
 const d=draftFor();
 container.innerHTML=d.items.length?`<ul class="cart-items-list">${d.items.map(i=>`<li class="cart-item"><div class="cart-item-name"><strong>${Resto.escape(i.name)}</strong><small>Belum dikirim</small></div><div class="cart-qty-control"><button class="qty-btn" aria-label="Kurangi ${Resto.escape(i.name)}" onclick="changeQty('${i.id}',-1)">−</button><span class="qty-number">${i.qty}×</span><button class="qty-btn" aria-label="Tambah ${Resto.escape(i.name)}" onclick="changeQty('${i.id}',1)" ${i.qty>=99?'disabled':''}>+</button></div><span class="cart-subtotal">${formatRupiah(i.price*i.qty)}</span><input class="draft-input cart-item-note" aria-label="Catatan ${Resto.escape(i.name)}" maxlength="300" placeholder="Catatan hidangan, contoh: tanpa es" value="${Resto.escape(i.note)}" oninput="setItemNote('${i.id}',this.value)"></li>`).join('')}</ul>`:'<p class="empty-hint">Tambahkan menu untuk pesanan baru atau tambahan.</p>';
 document.getElementById('draft-notes').value=d.notes;document.getElementById('draft-allergies').value=d.allergies;
 renderSubmittedOrders();updateTotal();
}
function renderSubmittedOrders(){
 const host=document.getElementById('submitted-orders');if(!activeTableId){host.innerHTML='';return;}
 const e=Resto.escape,orders=tableOrders();
 host.innerHTML=orders.length?'<h4>Pesanan terkirim</h4>'+orders.map(o=>`<section class="submitted-order"><h4>#${o.id.slice(0,6).toUpperCase()} · ${Resto.stamp(o.created_at)} <span class="status-tag ${o.status}">${Resto.labels[o.status]}</span></h4>${o.allergies?`<div class="ticket-notes allergy-note"><strong>Alergi pelanggan</strong>${e(o.allergies)}</div>`:''}${o.notes?`<div class="ticket-notes">${e(o.notes)}</div>`:''}${o.items.map(i=>`<div class="submitted-dish"><div class="submitted-dish-top"><strong>${i.qty}× ${e(i.menu.name)}</strong><span class="status-tag ${i.status}">${Resto.labels[i.status]}</span></div>${i.note?`<div class="dish-info">${e(i.note)}</div>`:''}${i.status==='ready'?`<button class="ops-button blue small" data-mutation onclick="Resto.action('${o.id}','serve','${i.id}')">Sudah disajikan</button>`:''}${['new','preparing'].includes(i.status)?`<button class="ops-button danger small" data-mutation onclick="Resto.cancel('${o.id}','${i.id}')">Batalkan hidangan</button>`:''}</div>`).join('')}${o.items.some(i=>['new','preparing'].includes(i.status))?`<button class="ops-button small" onclick="Resto.openNotes('${o.id}')">Edit catatan terkirim</button>`:''}</section>`).join(''):'';
 updateTotal();
}
function updateActionButtons(table){
 if(!table)return;
 const send=document.getElementById('btn-send-kitchen'),serve=document.getElementById('btn-mark-served'),clear=document.getElementById('btn-clear-table'),orders=tableOrders(table.id);
 send.classList.remove('hidden');send.disabled=!visitFor(table.id)||!draftFor(table.id).items.length||!Resto.connected||Resto.busy;
 send.textContent=orders.length?'Kirim pesanan tambahan':'Kirim pesanan ke dapur';
 const ready=orders.flatMap(o=>o.items).filter(i=>i.status==='ready');serve.classList.toggle('hidden',!ready.length);serve.disabled=!Resto.connected||Resto.busy;
 const finished=(orders.length||visitFor(table.id))&&orders.every(o=>o.items.every(i=>['served','cancelled'].includes(i.status)));
 clear.classList.toggle('hidden',!finished);clear.disabled=!!draftFor(table.id).items.length||!Resto.connected||Resto.busy;
}
async function sendOrderToKitchen(){
 if(!activeTableId||Resto.busy)return;const tableId=activeTableId,d=draftFor(tableId),visit=visitFor(tableId);if(!visit){Resto.toast('Catat pelanggan dan buka meja sebelum memesan.',true);return;}if(!d.items.length)return;if(d.visitId!==visit.id){Resto.toast('Draf berasal dari kunjungan sebelumnya. Periksa dan hapus draf sebelum memesan untuk tamu baru.',true);return;}
 // Snapshot the draft; a lost response can safely be retried with the same request ID.
 const sent=d.items.map(i=>({menuId:i.id,qty:i.qty,note:i.note}));
 const ok=await Resto.mutate('/api/orders',{requestId:d.requestId,tableId,visitId:visit.id,items:sent,notes:d.notes,allergies:d.allergies});
 if(ok){d.items=[];d.notes='';d.requestId=crypto.randomUUID();Resto.toast('Pesanan diterima dapur.');if(activeTableId===tableId)renderCurrentOrderList();}
 updateActionButtons(tablesData.find(t=>t.id===activeTableId));
}
async function markOrderServed(){
 if(!activeTableId)return;
 for(const o of tableOrders()){if(o.items.some(i=>i.status==='ready')){if(!await Resto.action(o.id,'serve'))break;}}
 updateActionButtons(tablesData.find(t=>t.id===activeTableId));
}
async function clearCurrentTable(){
 const table=tablesData.find(t=>t.id===activeTableId);if(!table)return;
 if(!confirm(`Kosongkan ${table.name}? Riwayat tetap tersimpan di laporan.`))return;
 const ok=await Resto.mutate('/api/tables/'+table.id+'/clear',{visitId:visitFor(table.id)?.id});if(ok){drafts.delete(table.id);renderCurrentOrderList();}
}
function updateLateBadgeCount(){
 const count=tablesData.filter(t=>['waiting','preparing'].includes(t.status)&&Resto.now()-t.orderTime>=LATE_THRESHOLD_SECONDS*1000).length;
 const badge=document.getElementById('late-counter');badge.textContent=`${count} Meja Telat`;badge.classList.toggle('alert',count>0);
}
function updateSelectedStatus(){
 const table=tablesData.find(t=>t.id===activeTableId);if(!table)return;
 const badge=document.getElementById('active-table-status');badge.className='badge-status badge-'+table.status;
 badge.textContent={available:'Meja kosong',occupied:'Menunggu pesanan',waiting:'Menunggu dapur',preparing:'Sedang dimasak',ready:'Siap diambil',served:'Selesai disajikan'}[table.status]+(table.readyCount&&table.status!=='ready'?` · ${table.readyCount} hidangan siap`:'');
 updateActionButtons(table);
}
function syncWaiter(s){
 document.getElementById('initial-error').hidden=true;
 const signature=(activeTableId||'')+':'+(visitFor()?.id||'')+s.menu.map(i=>i.id+Number(i.available)).join(',');if(signature!==stockSignature){stockSignature=signature;renderMenuList();}
 for(const table of tablesData){
  const orders=s.orders.filter(o=>o.table_id===table.id),items=orders.flatMap(o=>o.items),pending=items.filter(i=>['new','preparing'].includes(i.status));
  table.readyCount=items.filter(i=>i.status==='ready').length;
  table.orderTime=pending.length?Math.min(...pending.map(i=>i.created_at)):null;
  table.guestCount=visitFor(table.id)?.total||0;
  table.status=!orders.length?(table.guestCount?'occupied':'available'):pending.length?(pending.some(i=>i.status==='preparing')?'preparing':'waiting'):table.readyCount?'ready':'served';
 }
 renderFloorTables();renderSubmittedOrders();renderCustomerPanel();updateSelectedStatus();
}
setInterval(()=>{
 renderFloorTables();updateSelectedStatus();
 const table=tablesData.find(t=>t.id===activeTableId),box=document.getElementById('active-timer-box');
 if(table&&['waiting','preparing'].includes(table.status)&&table.orderTime){const seconds=Math.floor((Resto.now()-table.orderTime)/1000);box.classList.remove('hidden');document.getElementById('active-timer-val').textContent=formatDuration(seconds);box.classList.toggle('timer-late',seconds>=LATE_THRESHOLD_SECONDS);}else box.classList.add('hidden');
},1000);
document.addEventListener('DOMContentLoaded',()=>{
 populateTableDropdown();switchFloor(1);renderMenuList('all');setTimeout(adjustBlueprintScale,60);
 document.getElementById('draft-notes').addEventListener('input',e=>setDraftField('notes',e.target.value));
 document.getElementById('draft-allergies').addEventListener('input',e=>setDraftField('allergies',e.target.value));
 initGuests();
 Resto.init('waiter',syncWaiter);
});

const guestDrafts=new Map();let customerSignature='';
function visitFor(tableId=activeTableId){return Resto.state?.visits?.find(v=>v.table_id===tableId);}
function guestDraft(){if(!guestDrafts.has(activeTableId))guestDrafts.set(activeTableId,{men:0,women:0,children:0,requestId:crypto.randomUUID()});return guestDrafts.get(activeTableId);}
function guestValid(d){return ['men','women','children'].every(k=>Number.isInteger(d[k])&&d[k]>=0&&d[k]<=99)&&d.men+d.women+d.children>0&&d.men+d.women+d.children<=99;}
function updateGuestCount(category,value){const d=guestDraft();d[category]=Number(value);d.requestId=crypto.randomUUID();updateGuestPreview();}
function stepGuest(category,delta){const d=guestDraft();updateGuestCount(category,Math.min(99,Math.max(0,(d[category]||0)+delta)));document.getElementById('guest-'+category).value=d[category];}
function updateGuestPreview(){
 const form=document.getElementById('open-visit-form');if(!form||!activeTableId)return;
 const d=guestDraft(),total=d.men+d.women+d.children,capacity=tablesData.find(t=>t.id===activeTableId).capacity;
 document.getElementById('guest-total').textContent=`Total ${Number.isFinite(total)?total:'—'} pelanggan · Kapasitas ${capacity} kursi`;
 const warning=document.getElementById('guest-capacity-warning');warning.hidden=!(total>capacity);warning.textContent='Jumlah tamu melebihi kapasitas meja. Pastikan tempat duduk tersedia.';
 document.getElementById('btn-open-visit').disabled=!guestValid(d)||!Resto.connected||Resto.busy;
}
function renderCustomerPanel(){
 const panel=document.getElementById('customer-panel'),visit=visitFor(),signature=activeTableId+':'+(visit?visit.id+':'+visit.revision:'new');
 if(signature===customerSignature){updateGuestPreview();return;}customerSignature=signature;
 if(!activeTableId){panel.innerHTML='<p class="dish-info">Pilih meja untuk mencatat pelanggan.</p>';return;}
 const table=tablesData.find(t=>t.id===activeTableId);
 if(visit){panel.innerHTML=`<div class="customer-heading"><h3>Pelanggan meja</h3><button class="ops-button small" onclick="editGuestCounts()">Ubah jumlah</button></div><div class="customer-counts"><div><strong>${visit.men}</strong><span>Laki-laki ≥12</span></div><div><strong>${visit.women}</strong><span>Perempuan ≥12</span></div><div><strong>${visit.children}</strong><span>Anak &lt;12</span></div></div><p class="guest-summary">${visit.total} pelanggan · Datang ${Resto.stamp(visit.arrived_at)} WIB</p>${visit.total>table.capacity?'<p class="capacity-warning">Jumlah tamu melebihi kapasitas '+table.capacity+' kursi.</p>':''}`;return;}
 const d=guestDraft();panel.innerHTML=`<h3>Pelanggan meja</h3><p class="dish-info">Catat jumlah tamu sebelum memilih menu.</p><form id="open-visit-form" onsubmit="openTableVisit(event)"><div class="guest-counter-grid">${[['men','Laki-laki ≥12'],['women','Perempuan ≥12'],['children','Anak <12']].map(([key,label])=>`<label for="guest-${key}">${Resto.escape(label)}<span class="guest-stepper"><button class="ops-button small" type="button" aria-label="Kurangi ${Resto.escape(label)}" onclick="stepGuest('${key}',-1)">−</button><input id="guest-${key}" type="number" min="0" max="99" step="1" required value="${d[key]}" oninput="updateGuestCount('${key}',this.value)"><button class="ops-button small" type="button" aria-label="Tambah ${Resto.escape(label)}" onclick="stepGuest('${key}',1)">+</button></span></label>`).join('')}</div><p class="guest-summary" id="guest-total"></p><p class="capacity-warning" id="guest-capacity-warning" hidden></p>${tableOrders().length?'<p class="dish-info">Waktu datang mengikuti pesanan pertama yang sudah tercatat.</p>':''}<button type="submit" class="ops-button primary" id="btn-open-visit" data-mutation>Buka meja</button></form>`;updateGuestPreview();
}
async function openTableVisit(event){
 event.preventDefault();if(!activeTableId||Resto.busy)return;const tableId=activeTableId,d=guestDraft();if(!guestValid(d))return;
 if(await Resto.mutate('/api/visits',{...d,tableId})){guestDrafts.delete(tableId);Resto.toast('Meja dibuka; jumlah pelanggan tersimpan.');renderMenuList();updateSelectedStatus();}
}
function editGuestCounts(){
 const visit=visitFor();if(!visit)return;const dialog=document.getElementById('guests-dialog'),form=document.getElementById('guests-edit-form');
 dialog.dataset.visitId=visit.id;dialog.dataset.revision=visit.revision;dialog.dataset.capacity=visit.table.capacity;dialog.dataset.requestId=crypto.randomUUID();
 for(const key of ['men','women','children'])form.elements[key].value=visit[key];document.getElementById('edit-guests-error').hidden=true;updateEditGuestPreview();dialog.showModal();
}
function editGuestInput(){const form=document.getElementById('guests-edit-form');return Object.fromEntries(['men','women','children'].map(k=>[k,Number(form.elements[k].value)]));}
function updateEditGuestPreview(){const d=editGuestInput(),total=d.men+d.women+d.children,dialog=document.getElementById('guests-dialog');document.getElementById('edit-guests-total').textContent='Total '+(Number.isFinite(total)?total:'—')+' pelanggan';const warning=document.getElementById('edit-capacity-warning');warning.hidden=!(total>Number(dialog.dataset.capacity));warning.textContent='Jumlah tamu melebihi kapasitas meja. Pastikan tempat duduk tersedia.';document.getElementById('save-guest-changes').disabled=!guestValid(d)||Resto.busy;}
function initGuests(){
 const form=document.getElementById('guests-edit-form');form.addEventListener('input',()=>{document.getElementById('guests-dialog').dataset.requestId=crypto.randomUUID();updateEditGuestPreview();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const d=editGuestInput(),dialog=document.getElementById('guests-dialog');if(!guestValid(d))return;
  const ok=await Resto.mutate('/api/visits/'+dialog.dataset.visitId,{...d,revision:Number(dialog.dataset.revision),requestId:dialog.dataset.requestId});
  if(ok){dialog.close();Resto.toast('Jumlah pelanggan diperbarui.');}else{await Resto.refresh();const current=Resto.state?.visits.find(v=>v.id===dialog.dataset.visitId),error=document.getElementById('edit-guests-error');error.hidden=false;error.textContent=current?`Belum tersimpan. Data terbaru: ${current.men} laki-laki, ${current.women} perempuan, ${current.children} anak. Periksa kembali sebelum menyimpan.`:'Kunjungan sudah selesai. Tutup formulir dan periksa meja.';if(current)dialog.dataset.revision=current.revision;}
  updateEditGuestPreview();
 });
}
