(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={new:'Baru',preparing:'Dimasak',ready:'Siap diambil',served:'Disajikan',cancelled:'Dibatalkan'};
  const stations={grill:'Grill',fry:'Goreng',bar:'Minuman',dessert:'Dessert'};
  let state=null, listeners=[],poll=null,busy=false,role='waiter',lastSeq=null,audio=null,sound=false,lastSuccess=0,offset=0;
  let acknowledged={}; try{acknowledged=JSON.parse(localStorage.getItem('restoserve-ack')||'{}');}catch{}
  const stamp=ms=>new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(ms));
  const duration=ms=>{const seconds=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
  function status(message,offline=false) {
    const el=document.getElementById('sync-status'); if(el){if(el.textContent!==message)el.textContent=message;el.classList.toggle('offline',offline);}
    const error=document.getElementById('connection-error');if(error) error.hidden=!offline;
  }
  function toast(message,error=false) {
    const host=document.getElementById('toast-host'); if(!host)return;
    const item=document.createElement('div');item.className='toast'+(error?' error':'');item.textContent=message;host.append(item);
    setTimeout(()=>item.remove(),error?12000:8000);
  }
  function beep(){if(!sound||!audio||audio.state!=='running')return;for(const [delay,freq] of [[0,660],[.22,880]]){const osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=freq;gain.gain.setValueAtTime(.08,audio.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+delay+.18);osc.connect(gain);gain.connect(audio.destination);osc.start(audio.currentTime+delay);osc.stop(audio.currentTime+delay+.2);}}
  function notificationEvents(s){return s.events.filter(e=>role==='kitchen'?['order_new','order_added','order_changed','dish_cancelled'].includes(e.type):role==='waiter'?['dish_ready','dish_cancelled','order_changed'].includes(e.type):e.type==='stock_changed');}
  function apply(s){
    state=s;lastSuccess=Date.now();offset=s.serverTime-Date.now();status('Tersinkron');document.getElementById('sync-status')?.setAttribute('title','Terakhir diperbarui '+stamp(lastSuccess)+' WIB');
    const events=notificationEvents(s);const fresh=lastSeq===null?[]:events.filter(e=>e.seq>lastSeq);
    if(fresh.length){beep();fresh.slice(-3).forEach(e=>toast(e.message));}
    lastSeq=Math.max(lastSeq||0,...s.events.map(e=>e.seq),0);
    const feed=document.getElementById('notice-feed');
    if(feed)feed.innerHTML=events.length?events.slice(-8).reverse().map(e=>`<li><time>${stamp(e.created_at)}</time><span>${escape(e.message)}</span></li>`).join(''):'<li>Belum ada pemberitahuan.</li>';
    const count=document.getElementById('notice-count');if(count){count.textContent=events.length||'';count.parentElement.setAttribute('aria-label','Pemberitahuan, '+events.length+' notifikasi');}
    listeners.forEach(fn=>fn(s));
  }
  async function fetchJson(url,options={}) {
    const response=await fetch(url,{cache:'no-store',...options,signal:AbortSignal.timeout(15000)});
    let data;try{data=await response.json();}catch{throw new Error('Server tidak dapat dihubungi. Coba lagi.');}
    if(!response.ok)throw new Error(data.error||'Permintaan gagal.');return data;
  }
  async function refresh(){
    if(busy)return;if(poll)return poll;
    poll=(async()=>{try{apply(await fetchJson('/api/state'));}catch(e){status('Koneksi terputus · coba lagi',true);if(!state){const host=document.getElementById('initial-error');if(host){host.hidden=false;host.textContent=e.message;}}}finally{poll=null;}})();return poll;
  }
  async function mutate(url,body){
    if(busy)return false;busy=true;document.body.classList.add('saving');
    const panel=document.getElementById('order-panel');if(panel)panel.inert=true;
    // Wait for an in-flight snapshot before applying a write response.
    if(poll)await poll;
    const requestId=body.requestId||crypto.randomUUID();
    try{apply(await fetchJson(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestId})}));return true;}
    catch(e){toast(e.message,true);status('Perubahan belum dikonfirmasi · coba lagi',true);return false;}
    finally{busy=false;document.body.classList.remove('saving');if(panel)panel.inert=false;}
  }
  function acknowledge(orderId){acknowledged[orderId]=lastSeq;try{localStorage.setItem('restoserve-ack',JSON.stringify(acknowledged));}catch{}if(state)listeners.forEach(fn=>fn(state));}
  function changes(order){return state?.events.filter(e=>['order_new','order_added','order_changed','dish_cancelled'].includes(e.type)&&e.order_id===order.id&&e.seq>(acknowledged[order.id]||0))||[];}
  async function action(orderId,action,itemId,extra={}){
    const order=state?.orders.find(o=>o.id===orderId);if(!order)return false;
    return mutate('/api/orders/'+orderId,{revision:order.revision,action,itemId,...extra});
  }
  async function cancel(orderId,itemId){const reason=prompt('Alasan pembatalan hidangan:');if(reason===null)return;return action(orderId,'cancel',itemId,{reason});}
  function openNotes(orderId){
    const o=state?.orders.find(o=>o.id===orderId);if(!o)return;
    const dialog=document.getElementById('notes-dialog');if(!dialog)return;
    dialog.dataset.orderId=orderId;dialog.dataset.revision=o.revision;
    dialog.querySelector('[name=notes]').value=o.notes;dialog.querySelector('[name=allergies]').value=o.allergies;dialog.showModal();
  }
  function registerTools(view){
    const context=document.modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Restaurant tool registration unavailable',error));}catch(error){console.warn('Restaurant tool registration unavailable',error);}};
    register({name:'read_restaurant_orders',description:'Read current shared restaurant orders, dishes, and menu availability.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},async execute(input){if(!input||Object.keys(input).length)throw new Error('No input fields are accepted.');await refresh();if(!state)throw new Error('Shared orders are unavailable.');return {orders:state.orders,menu:state.menu};}});
    if(['waiter','kitchen'].includes(view))register({name:'update_restaurant_dish',description:view==='kitchen'?'Start preparing a dish or mark a prepared dish ready. Updates the visible kitchen queue.':'Mark a ready dish served to the table. Updates the visible waiter screen.',inputSchema:{type:'object',properties:{orderId:{type:'string'},itemId:{type:'string'},action:{type:'string',enum:view==='kitchen'?['start','ready']:['serve']}},required:['orderId','itemId','action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){const allowed=view==='kitchen'?['start','ready']:['serve'];if(!input||typeof input.orderId!=='string'||typeof input.itemId!=='string'||!allowed.includes(input.action)||Object.keys(input).some(k=>!['orderId','itemId','action'].includes(k)))throw new Error('Invalid dish action.');const o=state?.orders.find(o=>o.id===input.orderId);if(!o?.items.some(i=>i.id===input.itemId))throw new Error('Dish not found.');if(!await action(input.orderId,input.action,input.itemId))throw new Error('The dish update was not confirmed.');return {orderId:input.orderId,itemId:input.itemId,status:state.orders.find(o=>o.id===input.orderId)?.items.find(i=>i.id===input.itemId)?.status};}});
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
  function init(view,listener){
    role=view;listeners.push(listener);registerTools(view);
    document.getElementById('enable-sound')?.addEventListener('click',async()=>{
      const btn=document.getElementById('enable-sound');try{
        audio ||= new (window.AudioContext||window.webkitAudioContext)();await audio.resume();sound=!sound;btn.setAttribute('aria-label',sound?'Nonaktifkan suara':'Aktifkan suara');btn.title=sound?'Suara aktif':'Aktifkan suara';btn.setAttribute('aria-pressed',String(sound));if(sound)beep();
      }catch{toast('Suara tidak tersedia di browser ini.',true);}
    });
    document.getElementById('retry-sync')?.addEventListener('click',refresh);
    document.getElementById('notes-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const d=document.getElementById('notes-dialog'),form=e.currentTarget;
      const ok=await mutate('/api/orders/'+d.dataset.orderId,{revision:Number(d.dataset.revision),action:'notes',notes:form.elements.notes.value,allergies:form.elements.allergies.value});if(ok)d.close();else{await refresh();const current=state?.orders.find(o=>o.id===d.dataset.orderId);if(current)d.dataset.revision=current.revision;}
    });
    refresh();setInterval(refresh,2000);
    setInterval(()=>{if(lastSuccess&&Date.now()-lastSuccess>10000)status('Sinkronisasi tertunda · periksa koneksi',true);},1000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  }
  window.Resto={init,refresh,mutate,action,cancel,openNotes,acknowledge,changes,fetchJson,toast,escape,labels,stations,duration,stamp,get state(){return state},get busy(){return busy},get connected(){return !!state&&Date.now()-lastSuccess<10000},now:()=>Date.now()+offset};
})();
