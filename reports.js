let reportLoading=false, reportSignature='',reportGeneration=0;
async function loadReports(){
  const generation=++reportGeneration;
  const period=document.getElementById('report-period').value;
  try {
    const r=await Resto.fetchJson('/api/reports?period='+period);if(generation!==reportGeneration)return;
    const e=Resto.escape,minutes=v=>v===null||v===undefined?'—':Number(v).toFixed(1)+' mnt';
    document.getElementById('initial-error').hidden=true;
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
