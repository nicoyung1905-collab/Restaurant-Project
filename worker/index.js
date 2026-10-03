import { MENU, TABLES } from '../data/catalog.js';
import { database } from './db.js';

const menuById = new Map(MENU.map(m => [m.id, m]));
// Prices for items recorded before price snapshots were introduced. Keep historical values fixed.
const legacyMenuPrices={m1:45000,m2:38000,m3:42000,m4:29000,m5:22000,m6:26000,m7:12000,m8:14000,m9:16500};
const tableById = new Map(TABLES.map(t => [t.id, t]));
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
class Problem extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function check(ok, message, status) { if (!ok) throw new Problem(message, status); }
function string(value, max = 500) { check(typeof value === 'string' && value.length <= max, 'Teks tidak valid atau terlalu panjang.'); return value.trim(); }
function uuid(value) { check(typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value), 'ID permintaan tidak valid.'); return value; }
function orderName(order) { return order.service_type==='takeaway' ? 'TA-'+order.takeaway_number : tableById.get(order.table_id).name; }
function itemView(row) { const m = menuById.get(row.menu_id); return {...row, menu:m}; }
function orderStatus(items) {
  const alive = items.filter(i => i.status !== 'cancelled');
  if (!alive.length) return 'cancelled';
  if (alive.every(i => i.status === 'served')) return 'served';
  if (alive.every(i => ['ready','served'].includes(i.status))) return 'ready';
  if (alive.some(i => i.status !== 'new')) return 'preparing';
  return 'new';
}
async function state(db) {
  // Batch provides a consistent snapshot for tickets, dishes, stock and alerts.
  const [o, i, a, e, v] = await db.batch([
    db.statement('SELECT * FROM orders WHERE archived_at IS NULL ORDER BY created_at ASC'),
    db.statement('SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.archived_at IS NULL ORDER BY i.created_at,i.id'),
    db.statement('SELECT * FROM menu_availability'),
    db.statement('SELECT * FROM events ORDER BY seq DESC LIMIT 100'),
    db.statement('SELECT * FROM visits WHERE ended_at IS NULL ORDER BY arrived_at'),
  ]);
  const orders = o.results.map(row => { const items = i.results.filter(i => i.order_id === row.id).map(itemView); return {...row,code:row.service_type==='takeaway'?orderName(row):null,table:row.service_type==='takeaway'?null:tableById.get(row.table_id),items,status:orderStatus(items)}; });
  const stock = new Map(a.results.map(row => [row.menu_id, !!row.available]));
  return {orders,visits:v.results.map(visit=>({...visit,table:tableById.get(visit.table_id),total:visit.men+visit.women+visit.children})),menu:MENU.map(m => ({...m,available:stock.get(m.id) ?? true})),events:e.results.reverse(),serverTime:Date.now()};
}
function guestCounts(b) {
  for(const category of ['men','women','children'])check(Number.isInteger(b[category])&&b[category]>=0&&b[category]<=99,'Jumlah tiap kategori harus bilangan bulat 0–99.');
  const total=b.men+b.women+b.children;check(total>0&&total<=99,'Total pelanggan harus 1–99 orang.');return total;
}
async function openVisit(db,b) {
  const id=uuid(b.requestId);check(tableById.has(b.tableId),'Meja tidak ditemukan.');guestCounts(b);
  if((await db.rows('SELECT id FROM visits WHERE id=?',id)).length)return;
  const now=Date.now();
  const result=await db.batch([
    db.statement(`INSERT OR IGNORE INTO visits (id,table_id,men,women,children,arrived_at,last_change_id)
      SELECT ?,?,?,?,?,COALESCE((SELECT MIN(created_at) FROM orders WHERE table_id=? AND archived_at IS NULL),?),?
      WHERE NOT EXISTS (SELECT 1 FROM visits WHERE table_id=? AND ended_at IS NULL)`,id,b.tableId,b.men,b.women,b.children,b.tableId,now,id,b.tableId),
    db.statement(`UPDATE orders SET visit_id=?,revision=revision+1,last_change_id=? WHERE table_id=? AND archived_at IS NULL AND visit_id IS NULL
      AND EXISTS (SELECT 1 FROM visits WHERE id=?)`,id,id,b.tableId,id),
    db.statement(`INSERT OR IGNORE INTO events (id,type,message,created_at) SELECT ?,'visit_opened',?,? WHERE EXISTS (SELECT 1 FROM visits WHERE id=?)`,id,tableById.get(b.tableId).name+': kunjungan dimulai, '+(b.men+b.women+b.children)+' pelanggan.',now,id),
  ]);
  check(result[0].meta.changes>0||(await db.rows('SELECT id FROM visits WHERE id=?',id)).length,'Meja sudah dibuka di perangkat lain. Periksa jumlah pelanggan yang tercatat.',409);
}
async function updateVisit(db,id,b) {
  const requestId=uuid(b.requestId);guestCounts(b);
  if((await db.rows('SELECT id FROM events WHERE id=?',requestId)).length)return;
  check(Number.isInteger(b.revision),'Versi kunjungan tidak valid.');
  const result=await db.batch([
    db.statement('UPDATE visits SET men=?,women=?,children=?,revision=revision+1,last_change_id=? WHERE id=? AND revision=? AND ended_at IS NULL',b.men,b.women,b.children,requestId,id,b.revision),
    db.statement(`INSERT OR IGNORE INTO events (id,type,message,created_at) SELECT ?,'visit_changed',?,? WHERE EXISTS (SELECT 1 FROM visits WHERE id=? AND last_change_id=?)`,requestId,'Jumlah pelanggan dikoreksi menjadi '+(b.men+b.women+b.children)+' orang.',Date.now(),id,requestId),
  ]);
  check(result[0].meta.changes===1,'Kunjungan berubah di perangkat lain atau sudah selesai. Periksa data terbaru sebelum menyimpan lagi.',409);
}
async function body(request) {
  check(Number(request.headers.get('content-length') || 0) <= 24000, 'Permintaan terlalu besar.',413);
  const raw = await request.text(); check(raw.length <= 24000,'Permintaan terlalu besar.',413);
  try { const b = JSON.parse(raw); check(b && typeof b === 'object' && !Array.isArray(b), 'Permintaan tidak valid.'); return b; } catch(e) { if(e instanceof Problem) throw e; throw new Problem('Permintaan JSON tidak valid.'); }
}
async function createOrder(db, b) {
  const id = uuid(b.requestId), serviceType=b.serviceType??'dine_in';
  check(['dine_in','takeaway'].includes(serviceType),'Jenis pesanan tidak valid.');
  const takeaway=serviceType==='takeaway';
  check(takeaway?!b.tableId&&!b.visitId:tableById.has(b.tableId),takeaway?'Takeaway tidak menggunakan meja.':'Meja tidak ditemukan.');
  const duplicate = await db.rows('SELECT id FROM orders WHERE id=?',id);
  if (duplicate.length) return;
  let visitId=null;
  if(!takeaway){
  check(typeof b.visitId==='string','Buka meja dan catat jumlah pelanggan sebelum mengirim pesanan.',409);
  visitId=uuid(b.visitId);
  check((await db.rows('SELECT id FROM visits WHERE id=? AND table_id=? AND ended_at IS NULL',visitId,b.tableId)).length,'Buka meja dan catat jumlah pelanggan sebelum mengirim pesanan.',409);
  }
  check(Array.isArray(b.items) && b.items.length > 0 && b.items.length <= 40,'Pilih 1–40 item pesanan.');
  const notes = string(b.notes ?? ''), allergies = string(b.allergies ?? '');
  const stock = await db.rows('SELECT menu_id FROM menu_availability WHERE available=0');
  const unavailable = new Set(stock.map(s => s.menu_id));
  const items = b.items.map((i,index) => {
    const m = menuById.get(i.menuId); check(m,'Menu tidak ditemukan.');
    check(!unavailable.has(m.id),m.name+' sedang habis.',409);
    check(Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 99,'Jumlah harus antara 1 dan 99.');
    return {...i,id:id+':'+index,note:string(i.note ?? '',300),menu:m};
  });
  const previous = takeaway?[]:await db.rows('SELECT id FROM orders WHERE table_id=? AND archived_at IS NULL LIMIT 1',b.tableId);
  const now=Date.now();
  // Recheck availability inside the transaction, so concurrent stock updates cannot sneak through.
  const placeholders = items.map(()=>'?').join(',');
  const day=new Date(now+7*3600000).toISOString().slice(0,10);
  // Allocation is part of the same write transaction as items and stock checks.
  // Empty table_id retains the legacy NOT NULL schema; takeaway has no physical table.
  const insert=takeaway?db.statement(`INSERT OR IGNORE INTO orders
    (id,table_id,created_at,notes,allergies,last_change_id,service_type,takeaway_day,takeaway_number)
    SELECT ?,'',?,?,?,?, 'takeaway',?,COALESCE((SELECT MAX(takeaway_number) FROM orders WHERE takeaway_day=?),0)+1
    WHERE NOT EXISTS (SELECT 1 FROM menu_availability WHERE available=0 AND menu_id IN (${placeholders}))`,id,now,notes,allergies,id,day,day,...items.map(i=>i.menu.id)):
    db.statement(`INSERT OR IGNORE INTO orders (id,table_id,created_at,notes,allergies,last_change_id,visit_id)
    SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM menu_availability WHERE available=0 AND menu_id IN (${placeholders}))
    AND EXISTS (SELECT 1 FROM visits WHERE id=? AND table_id=? AND ended_at IS NULL)`,id,b.tableId,now,notes,allergies,id,visitId,...items.map(i=>i.menu.id),visitId,b.tableId);
  const statements=[insert];
  for (const i of items) statements.push(db.statement(`INSERT OR IGNORE INTO order_items (id,order_id,menu_id,qty,note,status,created_at,unit_price)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=?)`,i.id,id,i.menu.id,i.qty,i.note,'new',now,i.menu.price,id));
  const dishes=items.map(i=>i.qty+'× '+i.menu.name).join(', ');
  statements.push(db.statement(`INSERT OR IGNORE INTO events (id,order_id,type,message,created_at)
    SELECT ?,?,?,(CASE WHEN service_type='takeaway' THEN 'TA-'||takeaway_number ELSE ? END)||': '||?,?
    FROM orders WHERE id=?`,id,id,previous.length?'order_added':'order_new',takeaway?'':tableById.get(b.tableId).name,dishes,now,id));
  const result=await db.batch(statements);
  check(result[0].meta.changes > 0 || (await db.rows('SELECT id FROM orders WHERE id=?',id)).length,'Stok atau kunjungan berubah. Periksa meja dan menu sebelum mengirim ulang.',409);
}
async function mutateOrder(db, id, b) {
  const eventId=uuid(b.requestId);
  if ((await db.rows('SELECT id FROM events WHERE id=?',eventId)).length) return;
  const [order]=await db.rows('SELECT * FROM orders WHERE id=? AND archived_at IS NULL',id); check(order,'Pesanan tidak ditemukan.',404);
  check(Number.isInteger(b.revision) && b.revision===order.revision,'Pesanan berubah di perangkat lain. Data telah diperbarui; coba lagi.',409);
  const now=Date.now(); const rows=await db.rows('SELECT * FROM order_items WHERE order_id=?',id);
  let eligible=[], type='', message='', itemSql='', itemArgs=[], notes=null, allergies=null;
  if(b.action==='close') {
    check(order.service_type==='takeaway','Aksi hanya untuk takeaway.');
    const result=await db.batch([
      db.statement(`UPDATE orders SET archived_at=?,revision=revision+1,last_change_id=? WHERE id=? AND revision=? AND archived_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id=? AND status NOT IN ('served','cancelled'))`,now,eventId,id,b.revision,id),
      db.statement(`INSERT OR IGNORE INTO events (id,order_id,type,message,created_at) SELECT ?,?,'takeaway_closed',?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=? AND last_change_id=? AND archived_at IS NOT NULL)`,eventId,id,orderName(order)+': pesanan selesai; riwayat tersimpan.',now,id,eventId),
    ]);
    check(result[0].meta.changes===1,'Serahkan / batalkan semua hidangan sebelum menyelesaikan takeaway.',409);return;
  }
  if (b.action==='notes') {
    check(rows.some(i=>['new','preparing'].includes(i.status)),'Catatan hanya dapat diubah sebelum semua hidangan siap.',409);
    notes=string(b.notes ?? ''); allergies=string(b.allergies ?? ''); type='order_changed';
    message=`${orderName(order)}: catatan / alergi diperbarui. ${notes} ${allergies}`;
  } else {
    check(['start','ready','serve','cancel'].includes(b.action),'Aksi tidak dikenal.');
    const source={start:['new'],ready:['preparing'],serve:['ready'],cancel:['new','preparing']}[b.action];
    check(b.itemId || ['start','ready','serve'].includes(b.action),'Pilih hidangan yang ingin dibatalkan.');
    check(!b.station || ['grill','fry','bar','dessert'].includes(b.station),'Stasiun tidak valid.');
    eligible=rows.filter(i=>(!b.itemId || i.id===b.itemId) && (!b.station || menuById.get(i.menu_id).station===b.station) && source.includes(i.status));
    check(eligible.length,'Status hidangan berubah atau aksi belum tersedia.',409);
    const newStatus={start:'preparing',ready:'ready',serve:'served',cancel:'cancelled'}[b.action];
    const timeCol={start:'started_at',ready:'ready_at',serve:'served_at',cancel:'cancelled_at'}[b.action];
    itemSql=`UPDATE order_items SET status=?,${timeCol}=? WHERE id IN (${eligible.map(()=>'?').join(',')}) AND EXISTS (SELECT 1 FROM orders WHERE id=? AND last_change_id=?)`;
    itemArgs=[newStatus,now,...eligible.map(i=>i.id),id,eventId];
    type={start:'order_started',ready:'dish_ready',serve:'dish_served',cancel:'dish_cancelled'}[b.action];
    const reason=b.action==='cancel'?string(b.reason ?? '',300):''; check(b.action!=='cancel'||reason.length>0,'Isi alasan pembatalan.');
    message=`${orderName(order)}: ${eligible.map(i=>i.qty+'× '+menuById.get(i.menu_id).name).join(', ')} — ${{start:'mulai dimasak',ready:'siap diambil',serve:order.service_type==='takeaway'?'diserahkan ke pelanggan':'disajikan',cancel:'dibatalkan'}[b.action]}${reason?' ('+reason+')':''}`;
  }
  const statements=[db.statement('UPDATE orders SET revision=revision+1,last_change_id=? WHERE id=? AND revision=? AND archived_at IS NULL',eventId,id,b.revision)];
  if (notes!==null) statements.push(db.statement('UPDATE orders SET notes=?,allergies=? WHERE id=? AND last_change_id=?',notes,allergies,id,eventId));
  else statements.push(db.statement(itemSql,...itemArgs));
  statements.push(db.statement('INSERT OR IGNORE INTO events (id,order_id,type,message,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=? AND last_change_id=?)',eventId,id,type,message,now,id,eventId));
  const result=await db.batch(statements); check(result[0].meta.changes===1,'Pesanan berubah di perangkat lain. Coba lagi.',409);
}
async function clearTable(db, tableId, b) {
  check(tableById.has(tableId),'Meja tidak ditemukan.'); const requestId=uuid(b.requestId);
  if ((await db.rows('SELECT id FROM events WHERE id=?',requestId)).length) return;
  const [visit]=await db.rows('SELECT id FROM visits WHERE table_id=? AND ended_at IS NULL',tableId);
  check(visit?b.visitId===visit.id:!b.visitId,'Kunjungan meja berubah. Periksa meja sebelum mengosongkannya.',409);
  const visitId=visit?.id||null,now=Date.now();
  // Closing the visit and archiving its orders share one transaction. Stale devices
  // cannot clear the next party or submit new food against a closed visit.
  const result=await db.batch([
    db.statement(`UPDATE visits SET ended_at=?,last_change_id=?,revision=revision+1 WHERE id=? AND table_id=? AND ended_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.table_id=? AND o.archived_at IS NULL AND i.status NOT IN ('served','cancelled'))`,now,requestId,visitId,tableId,tableId),
    db.statement(`UPDATE orders SET archived_at=?,last_change_id=?,revision=revision+1 WHERE table_id=? AND archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.table_id=? AND o.archived_at IS NULL AND i.status NOT IN ('served','cancelled'))
      AND (EXISTS (SELECT 1 FROM visits WHERE id=? AND last_change_id=? AND ended_at IS NOT NULL)
        OR (? IS NULL AND NOT EXISTS (SELECT 1 FROM visits WHERE table_id=? AND ended_at IS NULL)))`,now,requestId,tableId,tableId,visitId,requestId,visitId,tableId),
    db.statement(`INSERT OR IGNORE INTO events (id,order_id,type,message,created_at) SELECT ?,NULL,'table_cleared',?,?
      WHERE EXISTS (SELECT 1 FROM orders WHERE last_change_id=?) OR EXISTS (SELECT 1 FROM visits WHERE last_change_id=? AND ended_at IS NOT NULL)`,requestId,tableById.get(tableId).name+': meja dikosongkan; riwayat tetap tersimpan.',now,requestId,requestId),
  ]); check(result[0].meta.changes>0||result[1].meta.changes>0,'Selesaikan / batalkan semua pesanan sebelum mengosongkan meja.',409);
}
async function reports(db, period) {
  check(['today','7','30'].includes(period),'Periode tidak valid.');
  const now=Date.now(), day=86400000, offset=7*3600000;
  const since=period==='today'?Math.floor((now+offset)/day)*day-offset:now-Number(period)*day;
  const customerSince=Math.floor((now+offset)/day)*day-offset-(period==='today'?0:(Number(period)-1)*day);
  const legacyPrices=Object.entries(legacyMenuPrices);
  const [summary, dishes, daily, guests, guestDays, history, revenue]=await db.batch([
    db.statement(`SELECT COUNT(*) AS lines, COALESCE(SUM(qty),0) AS portions, AVG((ready_at-created_at)/60000.0) AS avg_wait,
      AVG((ready_at-started_at)/60000.0) AS avg_cook FROM order_items WHERE ready_at>=? AND status!='cancelled'`,since),
    db.statement(`SELECT menu_id,COUNT(*) AS lines,SUM(qty) AS portions,AVG((ready_at-created_at)/60000.0) AS avg_wait,AVG((ready_at-started_at)/60000.0) AS avg_cook
      FROM order_items WHERE ready_at>=? AND status!='cancelled' GROUP BY menu_id`,since),
    db.statement(`SELECT strftime('%Y-%m-%d',ready_at/1000,'unixepoch','+7 hours') AS day,SUM(qty) AS portions,AVG((ready_at-created_at)/60000.0) AS avg_wait
      FROM order_items WHERE ready_at>=? AND status!='cancelled' GROUP BY day ORDER BY day`,since),
    db.statement(`SELECT COUNT(*) AS visits,COALESCE(SUM(men),0) AS men,COALESCE(SUM(women),0) AS women,COALESCE(SUM(children),0) AS children,
      COALESCE(SUM(men+women+children),0) AS total,AVG(men+women+children) AS average FROM visits WHERE arrived_at>=?`,customerSince),
    db.statement(`SELECT strftime('%Y-%m-%d',arrived_at/1000,'unixepoch','+7 hours') AS day,COUNT(*) AS visits,SUM(men) AS men,SUM(women) AS women,
      SUM(children) AS children,SUM(men+women+children) AS total FROM visits WHERE arrived_at>=? GROUP BY day ORDER BY day`,customerSince),
    db.statement('SELECT * FROM visits WHERE arrived_at>=? ORDER BY arrived_at DESC,id LIMIT 100',customerSince),
    db.statement(`SELECT COALESCE(SUM(qty*COALESCE(unit_price,CASE menu_id ${legacyPrices.map(()=>'WHEN ? THEN ?').join(' ')} ELSE 0 END)),0) AS total
      FROM order_items WHERE status='served' AND served_at>=? AND served_at<=?`,...legacyPrices.flat(),customerSince,now),
  ]);
  const detail=dishes.results.map(row=>({...row,menu:menuById.get(row.menu_id)}));
  const stations=['grill','fry','bar','dessert'].map(station=>{
    const rows=detail.filter(r=>r.menu.station===station), lines=rows.reduce((sum,r)=>sum+r.lines,0);
    return {station,portions:rows.reduce((sum,r)=>sum+r.portions,0),avg_wait:lines?rows.reduce((sum,r)=>sum+r.avg_wait*r.lines,0)/lines:null};
  });
  const overdue=await db.rows(`SELECT menu_id,created_at FROM order_items WHERE status IN ('new','preparing')`);
  return {period,since,revenue:{total:revenue.results[0].total,since:customerSince,until:now},summary:summary.results[0],dishes:detail,stations,daily:daily.results,
    customers:{since:customerSince,summary:guests.results[0],daily:guestDays.results,history:history.results.map(v=>({...v,table:tableById.get(v.table_id),total:v.men+v.women+v.children}))},
    overdue:overdue.filter(i=>now-i.created_at>menuById.get(i.menu_id).prepMinutes*60000).length};
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return serveAsset(url.pathname);
    try {
      if (request.method!=='GET') {
        const origin=request.headers.get('origin'); check(!origin || origin===url.origin,'Sumber permintaan tidak diizinkan.',403);
        check(request.headers.get('content-type')?.startsWith('application/json'),'Gunakan JSON.',415);
      }
      const db=database(env);
      if (request.method==='GET' && url.pathname==='/api/state') return json(await state(db));
      if (request.method==='GET' && url.pathname==='/api/reports') return json(await reports(db,url.searchParams.get('period')||'today'));
      check(request.method==='POST','Endpoint tidak ditemukan.',404);
      const b=await body(request);
      if (url.pathname==='/api/visits') await openVisit(db,b);
      else if (/^\/api\/visits\/[a-f0-9-]+$/.test(url.pathname)) await updateVisit(db,url.pathname.split('/').pop(),b);
      else if (url.pathname==='/api/orders') await createOrder(db,b);
      else if (/^\/api\/orders\/[a-f0-9-]+$/.test(url.pathname)) await mutateOrder(db,url.pathname.split('/').pop(),b);
      else if (/^\/api\/tables\/T\d+\/clear$/.test(url.pathname)) await clearTable(db,url.pathname.split('/')[3],b);
      else if (url.pathname==='/api/availability') {
        check(menuById.has(b.menuId) && typeof b.available==='boolean','Menu / stok tidak valid.');
        const requestId=uuid(b.requestId);
        if (!(await db.rows('SELECT id FROM events WHERE id=?',requestId)).length) await db.batch([
          db.statement('INSERT INTO menu_availability (menu_id,available,updated_at) VALUES (?,?,?) ON CONFLICT(menu_id) DO UPDATE SET available=excluded.available,updated_at=excluded.updated_at',b.menuId,b.available?1:0,Date.now()),
          db.statement('INSERT OR IGNORE INTO events (id,type,message,created_at) VALUES (?,?,?,?)',requestId,'stock_changed',menuById.get(b.menuId).name+': '+(b.available?'tersedia kembali':'habis'),Date.now()),
        ]);
      } else throw new Problem('Endpoint tidak ditemukan.',404);
      return json(await state(db));
    } catch(e) {
      if (!(e instanceof Problem)) console.error('RestoServe storage error',e);
      return json({error:e instanceof Problem?e.message:'Penyimpanan belum tersedia. Pesanan belum dikonfirmasi; periksa koneksi dan coba lagi.'},e.status||503);
    }
  }
};

// The build embeds the existing static interface here; no external asset service is required.
function serveAsset(path) {
  const aliases={'/':'/index.html','/kitchen':'/kitchen.html','/reports':'/reports.html','/menu':'/menu.html','/index':'/index.html'};
  const asset=ASSETS[aliases[path]||path];
  if(!asset) return new Response('Halaman tidak ditemukan',{status:404});
  return new Response(asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
