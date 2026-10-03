let reportLoading=false, reportSignature='',reportGeneration=0;
async function loadReports(){
  const generation=++reportGeneration;
  const period=document.getElementById('report-period').value;
  try {
    const r=await Resto.fetchJson('/api/reports?period='+period);if(generation!==reportGeneration)return;
    const e=Resto.escape,minutes=v=>v===null||v===undefined?'—':Number(v).toFixed(1)+' mnt';
    document.getElementById('initial-error').hidden=true;
    renderCustomerReport(r.customers,r.period);
    document.getElementById('report-portions').textContent=r.summary.portions;
    document.getElementById('report-wait').textContent=minutes(r.summary.avg_wait);
    document.getElementById('report-cook').textContent=minutes(r.summary.avg_cook);
    document.getElementById('report-overdue').textContent=r.overdue;
    document.getElementById('station-report').innerHTML=r.stations.map(s=>`<tr><td>${Resto.stations[s.station]}</td><td>${s.portions}</td><td>${minutes(s.avg_wait)}</td></tr>`).join('');
    document.getElementById('dish-report').innerHTML=r.dishes.length?r.dishes.map(d=>`<tr><td>${e(d.menu.name)}</td><td>${Resto.stations[d.menu.station]}</td><td>${d.portions}</td><td>${minutes(d.avg_wait)}</td><td>${minutes(d.avg_cook)}</td><td>${d.menu.prepMinutes} mnt</td></tr>`).join(''):'<tr><td colspan="6">Belum ada hidangan siap pada periode ini.</td></tr>';
    document.getElementById('daily-report').innerHTML=r.daily.length?r.daily.map(d=>`<tr><td>${e(d.day)}</td><td>${d.portions}</td><td>${minutes(d.avg_wait)}</td></tr>`).join(''):'<tr><td colspan="3">Laporan akan terisi setelah dapur menandai hidangan siap.</td></tr>';
  } catch(error){if(generation!==reportGeneration)return;const el=document.getElementById('initial-error');el.hidden=false;el.textContent=error.message;}
}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('report-period').addEventListener('change',loadReports);
  Resto.init('reports',s=>{const signature=s.events.at(-1)?.seq||0;if(signature!==reportSignature){reportSignature=signature;loadReports();}});
  setInterval(loadReports,15000);
});

function renderCustomerReport(c,period){
 const e=Resto.escape;for(const key of ['total','men','women','children','visits'])document.getElementById('customer-'+key).textContent=c.summary[key];
 document.getElementById('customer-average').textContent=c.summary.average===null?'—':Number(c.summary.average).toFixed(1);
 const date=ms=>new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(ms));
 document.getElementById('visit-history-count').textContent=`Menampilkan ${c.history.length} dari ${c.summary.visits} kunjungan${c.summary.visits>100?' terbaru':''}.`;
 document.getElementById('visit-history').innerHTML=c.history.length?c.history.map(v=>`<tr><td>${e(v.table.name)}</td><td>${date(v.arrived_at)}</td><td>${v.ended_at?date(v.ended_at):'<span class="status-tag preparing">Masih di meja</span>'}</td><td>${v.men}</td><td>${v.women}</td><td>${v.children}</td><td><strong>${v.total}</strong></td></tr>`).join(''):'<tr><td colspan="7">Belum ada kunjungan tercatat pada periode ini.</td></tr>';
 const count=period==='today'?1:Number(period),map=new Map(c.daily.map(d=>[d.day,d]));
 const days=Array.from({length:count},(_,i)=>{const day=new Date(c.since+i*86400000+7*3600000).toISOString().slice(0,10);return map.get(day)||{day,total:0,men:0,women:0,children:0};});
 const peak=Math.max(1,...days.map(d=>d.total));
 document.getElementById('customer-chart').innerHTML=days.map(d=>`<div class="customer-chart-row" aria-label="${d.day}: ${d.total} pelanggan, ${d.men} laki-laki, ${d.women} perempuan, ${d.children} anak"><span class="chart-date">${d.day.slice(8)+'/'+d.day.slice(5,7)}</span><div class="customer-bar-track"><div class="customer-bar" style="width:${d.total/peak*100}%"><span class="bar-men" style="width:${d.total?d.men/d.total*100:0}%"></span><span class="bar-women" style="width:${d.total?d.women/d.total*100:0}%"></span><span class="bar-children" style="width:${d.total?d.children/d.total*100:0}%"></span></div></div><strong>${d.total}</strong></div>`).join('');
 document.getElementById('customer-chart').setAttribute('aria-label',`Pelanggan per hari: ${days.map(d=>d.day+': '+d.total).join('; ')}`);
}
