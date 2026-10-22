(() => {
const timers=[...document.querySelectorAll('[data-offer-end]')];
function tick(){for(const el of timers){const end=Date.parse(el.dataset.offerEnd);if(!Number.isFinite(end)){el.textContent='';continue;}const s=Math.max(0,Math.floor((end-Date.now())/1000));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;el.textContent=s?`${d} DIAS ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:'OFERTA ENCERRADA';}}
tick();if(timers.length)setInterval(tick,1000);
document.querySelectorAll('form').forEach(form=>{if(form.id!=='formbusca')form.addEventListener('submit',e=>{e.preventDefault();});});
})();
