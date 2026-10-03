let flowStep=1;

function setTableView(view){
  const selected=view==='blueprint'&&!matchMedia('(max-width:640px)').matches?'blueprint':'cards';
  document.body.dataset.tableView=selected;
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===selected));
  requestAnimationFrame(adjustBlueprintScale);
}

function goToStep(step){
  if(Resto.busy)return;
  if(step>1&&!activeTableId)return;
  if(step>2&&!visitFor())step=2;
  flowStep=step;
  updateFlow();
  const heading=document.getElementById(step===1?'floor-title':'active-table-title');
  heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'auto'});
  if(step===1)requestAnimationFrame(adjustBlueprintScale);
}

function updateFlow(){
  const main=document.getElementById('waiter-main');if(!main)return;
  if(!activeTableId)flowStep=1;
  const visit=visitFor();if(flowStep>2&&!visit)flowStep=2;
  main.dataset.step=flowStep;
  document.querySelectorAll('[data-step-target]').forEach(button=>{
    const step=Number(button.dataset.stepTarget);
    button.disabled=step>1&&!activeTableId||step>2&&!visit;
    if(step===flowStep)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    button.classList.toggle('complete',step<flowStep);
  });
  document.getElementById('flow-stage-label').textContent={2:'PELANGGAN',3:'PILIH MENU',4:'TINJAU & KIRIM'}[flowStep]||'';
  document.getElementById('flow-customer-summary').textContent=visit?`${visit.total} pelanggan · Lantai ${visit.table.floor}`:'';
  document.querySelector('.guest-next').classList.toggle('is-open',!!visit);
  const d=activeTableId?draftFor():{items:[],notes:'',allergies:''},count=d.items.reduce((sum,item)=>sum+item.qty,0),amount=d.items.reduce((sum,item)=>sum+item.price*item.qty,0);
  document.getElementById('draft-count').textContent=`${count} porsi dipilih`;
  document.getElementById('draft-menu-total').textContent=formatRupiah(amount);
  document.getElementById('review-order').disabled=!visit||!count&&!tableOrders().length;
  for(const button of document.querySelectorAll('.menu-btn')){
    const quantity=d.items.find(item=>item.id===button.dataset.menuId)?.qty||0;
    button.classList.toggle('is-picked',quantity>0);
    const badge=button.querySelector('.menu-count');if(badge){badge.hidden=!quantity;badge.textContent=quantity;}
  }
  const warning=document.getElementById('draft-allergy-warning');warning.hidden=!d.allergies.trim();
  warning.textContent=d.allergies.trim()?'Alergi pelanggan: '+d.allergies:'';
  document.getElementById('draft-detail-badge').textContent=d.allergies.trim()?'Ada alergi':d.notes.trim()?'Ada catatan':'';
  const orders=activeTableId?tableOrders():[],items=orders.flatMap(order=>order.items),ready=items.filter(item=>item.status==='ready').reduce((sum,item)=>sum+item.qty,0);
  document.getElementById('submitted-details').hidden=!orders.length;
  document.getElementById('submitted-summary').textContent=orders.length?`${orders.length} pesanan${ready?' · '+ready+' siap':''}`:'';
  document.getElementById('sent-empty').hidden=!orders.length||!!count;
  document.getElementById('btn-send-kitchen').classList.toggle('hidden',!count);
}

function updateFloorOverview(){
  const tables=tablesData.filter(table=>table.floor===currentFloor),empty=tables.filter(table=>table.status==='available').length,ready=tables.filter(table=>table.readyCount).length;
  const overview=document.getElementById('floor-overview');
  const content=`<span><strong>${empty}</strong> meja kosong</span><span><strong>${tables.length-empty}</strong> terisi</span>${ready?`<span><strong>${ready}</strong> siap disajikan</span>`:''}`;
  if(overview.innerHTML!==content)overview.innerHTML=content;
}

window.addEventListener('resize',()=>{
  if(matchMedia('(max-width:640px)').matches&&document.body.dataset.tableView==='blueprint')setTableView('cards');
});
document.addEventListener('DOMContentLoaded',updateFlow);
