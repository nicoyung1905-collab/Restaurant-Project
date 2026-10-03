import { MENU, TABLES } from '../data/catalog.js';
import { database } from './db.js';

const menuById = new Map(MENU.map(m => [m.id, m]));
const tableById = new Map(TABLES.map(t => [t.id, t]));
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
class Problem extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function check(ok, message, status) { if (!ok) throw new Problem(message, status); }
function string(value, max = 500) { check(typeof value === 'string' && value.length <= max, 'Teks tidak valid atau terlalu panjang.'); return value.trim(); }
function uuid(value) { check(typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value), 'ID permintaan tidak valid.'); return value; }
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
  const [o, i, a, e] = await db.batch([
    db.statement('SELECT * FROM orders WHERE archived_at IS NULL ORDER BY created_at ASC'),
    db.statement('SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.archived_at IS NULL ORDER BY i.created_at,i.id'),
    db.statement('SELECT * FROM menu_availability'),
    db.statement('SELECT * FROM events ORDER BY seq DESC LIMIT 100'),
  ]);
  const orders = o.results.map(row => { const items = i.results.filter(i => i.order_id === row.id).map(itemView); return {...row,table:tableById.get(row.table_id),items,status:orderStatus(items)}; });
  const stock = new Map(a.results.map(row => [row.menu_id, !!row.available]));
  return {orders,menu:MENU.map(m => ({...m,available:stock.get(m.id) ?? true})),events:e.results.reverse(),serverTime:Date.now()};
}
async function body(request) {
  check(Number(request.headers.get('content-length') || 0) <= 24000, 'Permintaan terlalu besar.',413);
  const raw = await request.text(); check(raw.length <= 24000,'Permintaan terlalu besar.',413);
  try { const b = JSON.parse(raw); check(b && typeof b === 'object' && !Array.isArray(b), 'Permintaan tidak valid.'); return b; } catch(e) { if(e instanceof Problem) throw e; throw new Problem('Permintaan JSON tidak valid.'); }
}
async function createOrder(db, b) {
  const id = uuid(b.requestId); check(tableById.has(b.tableId),'Meja tidak ditemukan.');
  const duplicate = await db.rows('SELECT id FROM orders WHERE id=?',id);
  if (duplicate.length) return;
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
  const previous = await db.rows('SELECT id FROM orders WHERE table_id=? AND archived_at IS NULL LIMIT 1',b.tableId);
  const now=Date.now();
  // Recheck availability inside the transaction, so concurrent stock updates cannot sneak through.
  const placeholders = items.map(()=>'?').join(',');
  const statements = [db.statement(`INSERT OR IGNORE INTO orders (id,table_id,created_at,notes,allergies,last_change_id)
    SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM menu_availability WHERE available=0 AND menu_id IN (${placeholders}))`,id,b.tableId,now,notes,allergies,id,...items.map(i=>i.menu.id))];
  for (const i of items) statements.push(db.statement(`INSERT OR IGNORE INTO order_items (id,order_id,menu_id,qty,note,status,created_at)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=?)`,i.id,id,i.menu.id,i.qty,i.note,'new',now,id));
  const message=`${tableById.get(b.tableId).name}: ${items.map(i=>i.qty+'× '+i.menu.name).join(', ')}`;
  statements.push(db.statement('INSERT OR IGNORE INTO events (id,order_id,type,message,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=?)',id,id,previous.length?'order_added':'order_new',message,now,id));
  const result=await db.batch(statements);
  check(result[0].meta.changes > 0 || (await db.rows('SELECT id FROM orders WHERE id=?',id)).length,'Stok berubah. Periksa menu dan kirim ulang.',409);
}
async function mutateOrder(db, id, b) {
  const eventId=uuid(b.requestId);
  if ((await db.rows('SELECT id FROM events WHERE id=?',eventId)).length) return;
  const [order]=await db.rows('SELECT * FROM orders WHERE id=? AND archived_at IS NULL',id); check(order,'Pesanan tidak ditemukan.',404);
  check(Number.isInteger(b.revision) && b.revision===order.revision,'Pesanan berubah di perangkat lain. Data telah diperbarui; coba lagi.',409);
  const now=Date.now(); const rows=await db.rows('SELECT * FROM order_items WHERE order_id=?',id);
  let eligible=[], type='', message='', itemSql='', itemArgs=[], notes=null, allergies=null;
  if (b.action==='notes') {
    check(rows.some(i=>['new','preparing'].includes(i.status)),'Catatan hanya dapat diubah sebelum semua hidangan siap.',409);
    notes=string(b.notes ?? ''); allergies=string(b.allergies ?? ''); type='order_changed';
    message=`${tableById.get(order.table_id).name}: catatan / alergi diperbarui. ${notes} ${allergies}`;
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
    message=`${tableById.get(order.table_id).name}: ${eligible.map(i=>i.qty+'× '+menuById.get(i.menu_id).name).join(', ')} — ${{start:'mulai dimasak',ready:'siap diambil',serve:'disajikan',cancel:'dibatalkan'}[b.action]}${reason?' ('+reason+')':''}`;
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
  // A new order sent at the same time either prevents clearing or becomes the next active order.
  const result=await db.batch([
    db.statement(`UPDATE orders SET archived_at=?,last_change_id=?,revision=revision+1 WHERE table_id=? AND archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.table_id=? AND o.archived_at IS NULL AND i.status NOT IN ('served','cancelled'))`,Date.now(),requestId,tableId,tableId),
    db.statement(`INSERT OR IGNORE INTO events (id,order_id,type,message,created_at) SELECT ?,NULL,'table_cleared',?,? WHERE EXISTS (SELECT 1 FROM orders WHERE last_change_id=?)`,requestId,tableById.get(tableId).name+': meja dikosongkan; riwayat tetap tersimpan.',Date.now(),requestId),
  ]); check(result[0].meta.changes>0,'Selesaikan / batalkan semua pesanan sebelum mengosongkan meja.',409);
}
async function reports(db, period) {
  check(['today','7','30'].includes(period),'Periode tidak valid.');
  const now=Date.now(), day=86400000, offset=7*3600000;
  const since=period==='today'?Math.floor((now+offset)/day)*day-offset:now-Number(period)*day;
  const [summary, dishes, daily]=await db.batch([
    db.statement(`SELECT COUNT(*) AS lines, COALESCE(SUM(qty),0) AS portions, AVG((ready_at-created_at)/60000.0) AS avg_wait,
      AVG((ready_at-started_at)/60000.0) AS avg_cook FROM order_items WHERE ready_at>=? AND status!='cancelled'`,since),
    db.statement(`SELECT menu_id,COUNT(*) AS lines,SUM(qty) AS portions,AVG((ready_at-created_at)/60000.0) AS avg_wait,AVG((ready_at-started_at)/60000.0) AS avg_cook
      FROM order_items WHERE ready_at>=? AND status!='cancelled' GROUP BY menu_id`,since),
    db.statement(`SELECT strftime('%Y-%m-%d',ready_at/1000,'unixepoch','+7 hours') AS day,SUM(qty) AS portions,AVG((ready_at-created_at)/60000.0) AS avg_wait
      FROM order_items WHERE ready_at>=? AND status!='cancelled' GROUP BY day ORDER BY day`,since),
  ]);
  const detail=dishes.results.map(row=>({...row,menu:menuById.get(row.menu_id)}));
  const stations=['grill','fry','bar','dessert'].map(station=>{
    const rows=detail.filter(r=>r.menu.station===station), lines=rows.reduce((sum,r)=>sum+r.lines,0);
    return {station,portions:rows.reduce((sum,r)=>sum+r.portions,0),avg_wait:lines?rows.reduce((sum,r)=>sum+r.avg_wait*r.lines,0)/lines:null};
  });
  const overdue=await db.rows(`SELECT menu_id,created_at FROM order_items WHERE status IN ('new','preparing')`);
  return {period,since,summary:summary.results[0],dishes:detail,stations,daily:daily.results,overdue:overdue.filter(i=>now-i.created_at>menuById.get(i.menu_id).prepMinutes*60000).length};
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
      if (url.pathname==='/api/orders') await createOrder(db,b);
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
