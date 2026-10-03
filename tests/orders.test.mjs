import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker from '../worker/index.js';

// Model the D1 API with real SQLite transactions; SELECT and writes share one snapshot.
function env(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 class Statement {
  constructor(text){this.text=text;this.args=[];}
  bind(...args){this.args=args;return this;}
  async all(){return {results:sql.prepare(this.text).all(...this.args)};}
  execute(){const stmt=sql.prepare(this.text);if(stmt.columns().length)return {results:stmt.all(...this.args),meta:{changes:0}};const r=stmt.run(...this.args);return {results:[],meta:{changes:Number(r.changes)}};}
 }
 return {DB:{prepare(text){assert.ok(!/;\s*\S/.test(text),'Each prepare must contain one statement');return new Statement(text);},async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}},sql};
}
async function request(environment,path,body){const response=await worker.fetch(new Request('https://resto.test'+path,body?{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://resto.test'},body:JSON.stringify(body)}:{}),environment);return {status:response.status,data:await response.json()};}
const orderBody=(e,items=[{menuId:'m1',qty:2,note:'Saus dipisah'}])=>({requestId:crypto.randomUUID(),tableId:'T103',visitId:e.visitId,items,notes:'Makan di tempat',allergies:'Kacang'});
async function open(e,counts={men:2,women:1,children:1}){const r=await request(e,'/api/visits',{requestId:crypto.randomUUID(),tableId:'T103',...counts});assert.equal(r.status,200);e.visitId=r.data.visits[0].id;return r.data.visits[0];}
async function change(e,o,action,itemId,extra={}){return request(e,'/api/orders/'+o.id,{requestId:crypto.randomUUID(),revision:o.revision,action,itemId,...extra});}

test('waiter → chef → ready → partial serving → archive retains reports',async()=>{
 const e=env();await open(e);const b=orderBody(e,[{menuId:'m1',qty:2,note:'Saus dipisah'},{menuId:'m7',qty:1}]);
 let r=await request(e,'/api/orders',b);assert.equal(r.status,200);let o=r.data.orders[0];assert.equal(o.status,'new');assert.equal(o.allergies,'Kacang');
 const secondDevice=await request(e,'/api/state');assert.equal(secondDevice.data.orders[0].id,o.id);assert.equal(secondDevice.data.orders[0].items[0].note,'Saus dipisah');
 r=await change(e,o,'serve');assert.equal(r.status,409,'Unprepared food cannot be served');
 r=await change(e,o,'start',null,{station:'bar'});o=r.data.orders[0];assert.equal(o.items.find(i=>i.menu_id==='m7').status,'preparing');assert.equal(o.items.find(i=>i.menu_id==='m1').status,'new');
 r=await change(e,o,'ready',o.items.find(i=>i.menu_id==='m7').id);o=r.data.orders[0];assert.equal(o.status,'preparing');assert.ok(r.data.events.some(e=>e.type==='dish_ready'));
 r=await change(e,o,'serve',o.items.find(i=>i.menu_id==='m7').id);o=r.data.orders[0];assert.equal(o.items.find(i=>i.menu_id==='m1').status,'new');
 r=await request(e,'/api/tables/T103/clear',{visitId:e.visitId,requestId:crypto.randomUUID()});assert.equal(r.status,409,'Active dishes prevent clearing');
 r=await change(e,o,'start');o=r.data.orders[0];r=await change(e,o,'ready');o=r.data.orders[0];assert.equal(o.status,'ready');
 r=await change(e,o,'serve');o=r.data.orders[0];assert.equal(o.status,'served');
 r=await request(e,'/api/tables/T103/clear',{visitId:e.visitId,requestId:crypto.randomUUID()});assert.equal(r.status,200);assert.equal(r.data.orders.length,0);
 r=await request(e,'/api/reports?period=today');assert.equal(r.data.summary.portions,3);assert.equal(r.data.dishes.length,2);assert.equal(r.data.daily.length,1);assert.equal(e.sql.prepare('SELECT count(*) c FROM orders').get().c,1);
});
test('lost-response retries do not duplicate orders or alerts',async()=>{
 const e=env();await open(e);const b=orderBody(e);await request(e,'/api/orders',b);const r=await request(e,'/api/orders',b);assert.equal(r.status,200);assert.equal(r.data.orders.length,1);assert.equal(r.data.orders[0].items.length,1);assert.equal(r.data.events.filter(e=>e.type==='order_new').length,1);
 const o=r.data.orders[0],changeBody={requestId:crypto.randomUUID(),revision:o.revision,action:'start'};await request(e,'/api/orders/'+o.id,changeBody);const repeated=await request(e,'/api/orders/'+o.id,changeBody);assert.equal(repeated.status,200);assert.equal(repeated.data.orders[0].revision,2);assert.equal(repeated.data.events.filter(e=>e.type==='order_started').length,1);
});
test('concurrent stale edits are rejected without overwriting the chef',async()=>{
 const e=env();await open(e);let r=await request(e,'/api/orders',orderBody(e));const old=r.data.orders[0];await change(e,old,'start');r=await change(e,old,'cancel',old.items[0].id,{reason:'Keliru'});assert.equal(r.status,409);r=await request(e,'/api/state');assert.equal(r.data.orders[0].items[0].status,'preparing');
});
test('sold-out controls, additions, notes and cancellation synchronize',async()=>{
 const e=env();await open(e);let r=await request(e,'/api/availability',{requestId:crypto.randomUUID(),menuId:'m1',available:false});assert.equal(r.data.menu.find(m=>m.id==='m1').available,false);
 r=await request(e,'/api/orders',orderBody(e));assert.equal(r.status,409);assert.equal((await request(e,'/api/state')).data.orders.length,0);
 await request(e,'/api/availability',{requestId:crypto.randomUUID(),menuId:'m1',available:true});r=await request(e,'/api/orders',orderBody(e));let o=r.data.orders[0];
 r=await request(e,'/api/orders',orderBody(e,[{menuId:'m9',qty:1}]));assert.equal(r.data.orders.length,2);assert.ok(r.data.events.some(e=>e.type==='order_added'));
 r=await change(e,o,'notes',null,{notes:'Tanpa keju',allergies:'Susu'});o=r.data.orders.find(row=>row.id===o.id);assert.equal(o.allergies,'Susu');assert.ok(r.data.events.some(e=>e.type==='order_changed'));
 r=await change(e,o,'cancel',o.items[0].id,{reason:'Pelanggan membatalkan'});assert.equal(r.data.orders.find(row=>row.id===o.id).status,'cancelled');assert.ok(r.data.events.some(e=>e.type==='dish_cancelled'));
 r=await request(e,'/api/reports?period=7');assert.equal(r.data.summary.portions,0);
});
test('validation and storage boundaries preserve a recoverable failure',async()=>{
 const e=env();await open(e);assert.equal((await request(e,'/api/orders',orderBody(e,[{menuId:'m1',qty:-1}]))).status,400);
 const response=await worker.fetch(new Request('https://resto.test/api/orders',{method:'POST',headers:{'Origin':'https://evil.test','Content-Type':'application/json'},body:JSON.stringify(orderBody(e))}),e);assert.equal(response.status,403);
 assert.equal((await request(e,'/api/reports?period=wrong')).status,400);
});

test('customer visits are required, idempotent, editable, and counted once per party',async()=>{
 const e=env();
 let r=await request(e,'/api/orders',{...orderBody(e),visitId:crypto.randomUUID()});assert.equal(r.status,409);
 for(const counts of [{men:0,women:0,children:0},{men:-1,women:1,children:1},{men:1.5,women:0,children:0}])assert.equal((await request(e,'/api/visits',{requestId:crypto.randomUUID(),tableId:'T103',...counts})).status,400);
 const opening={requestId:crypto.randomUUID(),tableId:'T103',men:2,women:1,children:1};r=await request(e,'/api/visits',opening);assert.equal(r.status,200);e.visitId=r.data.visits[0].id;
 r=await request(e,'/api/visits',opening);assert.equal(r.data.visits.length,1);
 r=await request(e,'/api/visits',{...opening,requestId:crypto.randomUUID()});assert.equal(r.status,409,'Only one party can occupy a table');
 const update={requestId:crypto.randomUUID(),revision:1,men:3,women:1,children:1};r=await request(e,'/api/visits/'+e.visitId,update);assert.equal(r.data.visits[0].total,5);
 assert.equal((await request(e,'/api/visits/'+e.visitId,update)).status,200,'Retrying an accepted correction is safe');
 assert.equal((await request(e,'/api/visits/'+e.visitId,{...update,requestId:crypto.randomUUID(),children:2})).status,409,'Stale corrections cannot overwrite counts');
 await request(e,'/api/orders',orderBody(e));await request(e,'/api/orders',orderBody(e,[{menuId:'m9',qty:1}]));
 r=await request(e,'/api/reports');assert.equal(r.data.customers.summary.total,5);assert.equal(r.data.customers.summary.visits,1);assert.equal(r.data.customers.summary.children,1);
 let state=(await request(e,'/api/state')).data;for(const o of state.orders)await change(e,o,'cancel',o.items[0].id,{reason:'Tamu membatalkan'});
 const closing={requestId:crypto.randomUUID(),visitId:e.visitId};r=await request(e,'/api/tables/T103/clear',closing);assert.equal(r.status,200);assert.equal(r.data.visits.length,0);
 const oldVisitId=e.visitId;await open(e,{men:0,women:1,children:2});
 assert.equal((await request(e,'/api/tables/T103/clear',closing)).status,200);assert.equal((await request(e,'/api/state')).data.visits.length,1,'Retrying old clear cannot close next party');
 assert.equal((await request(e,'/api/tables/T103/clear',{requestId:crypto.randomUUID(),visitId:oldVisitId})).status,409);
 assert.equal((await request(e,'/api/orders',{...orderBody(e),visitId:oldVisitId})).status,409,'Old party cannot submit orders for a new visit');
 r=await request(e,'/api/reports');assert.equal(r.data.customers.summary.total,8);assert.equal(r.data.customers.summary.visits,2);assert.equal(r.data.customers.summary.average,4);assert.ok(r.data.customers.history.find(v=>v.id===oldVisitId).ended_at);
});
test('arrival in WIB determines the report day even after midnight corrections and closure',async()=>{
 const e=env();const v=await open(e),todayStart=Math.floor((Date.now()+7*3600000)/86400000)*86400000-7*3600000,yesterdayLate=todayStart-1800000;
 e.sql.prepare('UPDATE visits SET arrived_at=? WHERE id=?').run(yesterdayLate,v.id);
 let r=await request(e,'/api/visits/'+v.id,{requestId:crypto.randomUUID(),revision:1,men:1,women:2,children:2});assert.equal(r.status,200);
 r=await request(e,'/api/tables/T103/clear',{requestId:crypto.randomUUID(),visitId:v.id});assert.equal(r.status,200,'Visit without any food orders can end');
 r=await request(e,'/api/reports?period=today');assert.equal(r.data.customers.summary.total,0);
 r=await request(e,'/api/reports?period=7');assert.equal(r.data.customers.summary.total,5);assert.equal(r.data.customers.daily[0].day,new Date(yesterdayLate+7*3600000).toISOString().slice(0,10));assert.equal(r.data.customers.history[0].arrived_at,yesterdayLate);
});
test('existing active orders can receive customer counts without rewriting old history',async()=>{
 const e=env(),legacy=crypto.randomUUID(),arrival=Date.now()-3600000;
 e.sql.prepare('INSERT INTO orders (id,table_id,created_at,last_change_id) VALUES (?,?,?,?)').run(legacy,'T103',arrival,legacy);
 const v=await open(e);assert.equal(v.arrived_at,arrival);assert.equal(e.sql.prepare('SELECT visit_id FROM orders WHERE id=?').get(legacy).visit_id,v.id);
 assert.equal((await request(e,'/api/reports')).data.customers.summary.visits,1);
});
