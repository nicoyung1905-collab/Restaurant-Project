let selectedStation='all';
let kitchenRenderSignature='';
function kitchenRender(s) {
  const e=Resto.escape,now=Resto.now();
  const scoped=s.orders.map(o=>({...o,visible:o.items.filter(i=>selectedStation==='all'||i.menu.station===selectedStation)})).filter(o=>o.visible.length);
  const alive=scoped.flatMap(o=>o.visible).filter(i=>!['served','cancelled'].includes(i.status));
  for(const status of ['new','preparing','ready']) document.getElementById('stat-'+status).textContent=alive.filter(i=>i.status===status).length;
  document.getElementById('stat-late').textContent=alive.filter(i=>['new','preparing'].includes(i.status)&&now-i.created_at>i.menu.prepMinutes*60000).length;
  const filter=document.getElementById('status-filter').value,search=document.getElementById('ticket-search').value.toLowerCase().trim();
  const orders=scoped.filter(o=>{
    const stages=o.visible.map(i=>i.status);
    const match=filter==='all'||(filter==='active'?stages.some(s=>['new','preparing','ready'].includes(s)):filter==='done'?stages.every(s=>['served','cancelled'].includes(s)):stages.includes(filter));
    return match&&(!search||(o.table.name+' '+o.visible.map(i=>i.menu.name).join(' ')).toLowerCase().includes(search));
  });
  const grid=document.getElementById('ticket-grid');
  // Timers update separately. Keep touch controls and focus stable between snapshots.
  const signature=JSON.stringify([selectedStation,filter,search,s.orders.length,orders.map(o=>[
    o,Resto.changes(o).map(e=>e.seq),
    o.visible.some(i=>['new','preparing'].includes(i.status)&&now-i.created_at>i.menu.prepMinutes*60000)
  ])]);
  if(signature===kitchenRenderSignature)return;
  kitchenRenderSignature=signature;
  if(!orders.length){grid.innerHTML=`<div class="empty-state"><h3>${s.orders.length?'Tidak ada pesanan yang cocok':'Belum ada pesanan'}</h3><p>${s.orders.length?'Ubah stasiun, status, atau pencarian.':'Pesanan yang dikirim pelayan akan muncul di sini.'}</p></div>`;return;}
  grid.innerHTML=orders.map(o=>{
    const change=Resto.changes(o),late=o.visible.some(i=>['new','preparing'].includes(i.status)&&now-i.created_at>i.menu.prepMinutes*60000);
    const timeEnd=o.items.filter(i=>i.ready_at).length===o.items.filter(i=>i.status!=='cancelled').length?Math.max(...o.items.map(i=>i.ready_at||o.created_at)):now;
    const stationArg=selectedStation==='all'?'':selectedStation;
    return `<article class="ticket ${late?'is-late':''} ${change.length?'has-change':''}" data-order-id="${o.id}">
      <div class="ticket-header"><div><h3>${e(o.table.name)}</h3><div class="ticket-meta">#${o.id.slice(0,6).toUpperCase()} · Lantai ${o.table.floor} · ${Resto.stamp(o.created_at)}</div></div><div><div class="ticket-clock" data-created="${o.created_at}" data-ended="${timeEnd===now?'':timeEnd}">${Resto.duration(timeEnd-o.created_at)}</div><span class="status-tag ${o.status}">${Resto.labels[o.status]}</span></div></div>
      ${change.length?`<div class="change-banner"><span>${change.some(c=>c.type==='dish_cancelled')?'Ada pembatalan':change.some(c=>c.type==='order_changed')?'Catatan berubah':change.some(c=>c.type==='order_added')?'Pesanan tambahan':'Pesanan baru'}</span><button class="ops-button small" onclick="Resto.acknowledge('${o.id}')">Sudah dibaca</button></div>`:''}
      <div class="ticket-content">${o.allergies?`<div class="ticket-notes allergy-note"><strong>ALERGI PELANGGAN</strong>${e(o.allergies)}</div>`:''}${o.notes?`<div class="ticket-notes"><strong>Catatan:</strong> ${e(o.notes)}</div>`:''}
      <ul class="dish-list">${o.visible.map(i=>`<li class="dish-row ${i.status}" data-item-id="${i.id}"><div class="dish-title"><span>${i.qty}× ${e(i.menu.name)}</span><span class="status-tag ${i.status}">${Resto.labels[i.status]}</span></div><div class="dish-info">${Resto.stations[i.menu.station]} · Target siap ${i.menu.prepMinutes} menit ${['new','preparing'].includes(i.status)?`· <span data-dish-created="${i.created_at}" data-target="${i.menu.prepMinutes}">${Resto.duration(now-i.created_at)}</span>`:''}</div>${i.note?`<div class="ticket-notes">${e(i.note)}</div>`:''}${i.menu.allergens.length?`<div class="dish-info">Mengandung: ${e(i.menu.allergens.join(', '))}</div>`:''}<div class="dish-actions">${i.status==='new'?`<button class="ops-button primary" data-mutation onclick="Resto.action('${o.id}','start','${i.id}')">Mulai masak</button>`:i.status==='preparing'?`<button class="ops-button ready" data-mutation onclick="Resto.action('${o.id}','ready','${i.id}')">Tandai siap</button>`:i.ready_at?`<span class="served-label">Siap ${Resto.stamp(i.ready_at)}</span>`:'<span></span>'}${['new','preparing'].includes(i.status)?`<button class="ops-button small danger" data-mutation onclick="Resto.cancel('${o.id}','${i.id}')">Batalkan</button>`:''}</div></li>`).join('')}</ul>
      ${o.visible.length<o.items.length?`<p class="dish-info">${o.items.length-o.visible.length} hidangan di stasiun lain.</p>`:''}</div>
      <div class="ticket-footer">${o.visible.some(i=>i.status==='new')?`<button class="ops-button primary" data-mutation onclick="kitchenBulk('${o.id}','start','${stationArg}')">Mulai ${selectedStation==='all'?'semua':'stasiun ini'}</button>`:''}${o.visible.some(i=>i.status==='preparing')?`<button class="ops-button ready" data-mutation onclick="kitchenBulk('${o.id}','ready','${stationArg}')">Siapkan yang dimasak</button>`:''}${o.items.some(i=>['new','preparing'].includes(i.status))?`<button class="ops-button small" onclick="Resto.openNotes('${o.id}')">Edit catatan</button>`:''}</div>
    </article>`;
  }).join('');
}
async function kitchenBulk(orderId,action,station){await Resto.action(orderId,action,null,station?{station}:{});}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-station]').forEach(button=>button.addEventListener('click',()=>{
    selectedStation=button.dataset.station;document.querySelectorAll('[data-station]').forEach(b=>b.classList.toggle('active',b===button));if(Resto.state)kitchenRender(Resto.state);
  }));
  document.getElementById('status-filter').addEventListener('change',()=>{if(Resto.state)kitchenRender(Resto.state)});
  document.getElementById('ticket-search').addEventListener('input',()=>{if(Resto.state)kitchenRender(Resto.state)});
  Resto.init('kitchen',kitchenRender);
  setInterval(()=>{
    document.getElementById('kitchen-clock').textContent=Resto.stamp(Resto.now())+' WIB';
    document.querySelectorAll('[data-created]').forEach(el=>el.textContent=Resto.duration((Number(el.dataset.ended)||Resto.now())-Number(el.dataset.created)));
    document.querySelectorAll('[data-dish-created]').forEach(el=>{const age=Resto.now()-Number(el.dataset.dishCreated);el.textContent=Resto.duration(age);el.style.color=age>Number(el.dataset.target)*60000?'#b91c1c':'';});
  },1000);
});
