const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];

const NAMES = ["Andreas","Johann","Matthias","Stefan","Viktor","Waldemar"];
const COLORS = {
  "Andreas":"hsl(220 85% 60%)",
  "Johann":"hsl(10 85% 60%)",
  "Matthias":"hsl(140 70% 45%)",
  "Stefan":"hsl(270 70% 60%)",
  "Viktor":"hsl(45 90% 55%)",
  "Waldemar":"hsl(200 70% 45%)"
};
(function(){ const s=$('#name'); s.innerHTML=NAMES.map(n=>`<option value="${n}">${n}</option>`).join(''); })();

const API = {
  async list(from, to){
    const u = new URL('/api/bookings', location.origin);
    if(from && to){ u.searchParams.set('from', from); u.searchParams.set('to', to); }
    const r = await fetch(u);
    return r.json();
  },
  async add({name, start, end, code}){
    const body = {name,start,end}; if(code) body.code = code;
    const r = await fetch('/api/bookings', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    if(!r.ok){ throw {status:r.status, data: await r.json().catch(()=>({}))}; }
    return r.json();
  },
  async update(id, {name, start, end, code}){
    const body = {name,start,end}; if(code) body.code = code;
    const r = await fetch(`/api/bookings/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    if(!r.ok){ throw {status:r.status, data: await r.json().catch(()=>({}))}; }
    return r.json();
  },
  async del(id, code){
    const u = new URL(`/api/bookings/${id}`, location.origin);
    if(code) u.searchParams.set('code', code);
    const r = await fetch(u, {method:'DELETE'});
    if(!r.ok){ throw {status:r.status, data: await r.json().catch(()=>({}))}; }
  }
}

const fmt = d=> d.toISOString().slice(0,10);
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addMonths(d, m){ const x = new Date(d); x.setMonth(x.getMonth()+m); return x; }

function monthMatrix(year, month){
  const first = new Date(year, month, 1);
  const last  = new Date(year, month+1, 0);
  const days = [];
  const startOffset = (first.getDay()+6)%7; // Mon=0
  for(let i=0;i<startOffset;i++) days.push(null);
  for(let d=1; d<=last.getDate(); d++) days.push(new Date(year, month, d));
  while(days.length%7) days.push(null);
  return {first,last,days,startOffset,count:last.getDate()};
}

function colorFor(name){ return COLORS[name] || `hsl(${(name.length*53)%360} 65% 55%)`; }

function clipToMonth(d, year, month){
  const start = new Date(year, month, 1);
  const end = new Date(year, month+1, 0);
  if(d < start) return start;
  if(d > end) return end;
  return d;
}

function daysBetweenInclusive(a, b){
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const out = [];
  for(let d = aa; d <= bb; d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1)){
    out.push(new Date(d));
  }
  return out;
}

function renderMarks(grid, year, month, startOffset, daysCount, entries){
  // Build cell refs array for current month grid
  const cells = [...grid.children]; // we'll append days after marks; but here we need only placeholders
  // Instead we will generate days first to get refs, then marks - but we want days above marks.
  // So we'll instead build day refs while creating day cells, and attach marks later via data-index.

  // This function will be called AFTER day cells exist (we'll structure calls accordingly).
}

function renderCalendar(monthsAhead, cache){
  const cal = $('#calendar'); cal.innerHTML='';
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = addMonths(start, monthsAhead);
  const from = fmt(start), to = fmt(new Date(end.getFullYear(), end.getMonth(), 0));
  const dataPromise = cache ? Promise.resolve(cache) : API.list(from, to);
  dataPromise.then(all => {
    for(let i=0;i<monthsAhead;i++){
      const mdate = addMonths(start, i);
      const {first,last,days,startOffset,count} = monthMatrix(mdate.getFullYear(), mdate.getMonth());
      const frag = document.importNode($('#tpl-month').content, true);
      frag.querySelector('.month-title').textContent = first.toLocaleString('de-DE', {month:'long', year:'numeric'});
      const grid = frag.querySelector('.grid-days');

      // 1) create day cells first
      const cellRefs = [];
      days.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'day' + (d? '' : ' is-out');
        if(d){
          const dnum = document.createElement('div');
          dnum.className='dnum';
          dnum.textContent=d.getDate();
          if(d.toDateString() === new Date().toDateString()) cell.classList.add('today');
          cell.appendChild(dnum);
          const marks = document.createElement('div');
          marks.className = 'marks';
          cell.appendChild(marks);
        }
        cellRefs.push(cell);
        grid.appendChild(cell);
      });

      // 2) add marks for each booking day
      const monthStart = new Date(mdate.getFullYear(), mdate.getMonth(), 1);
      const monthEnd   = new Date(mdate.getFullYear(), mdate.getMonth()+1, 0);
      const bookings = all
        .map(e => ({...e, s: new Date(e.start_date), e: new Date(e.end_date)}))
        .filter(b => !(b.e < monthStart || b.s > monthEnd));

      bookings.forEach(b => {
        const s = new Date(Math.max(b.s, monthStart));
        const e = new Date(Math.min(b.e, monthEnd));
        const color = colorFor(b.name);
        const letter = b.name.slice(0,1).toUpperCase();
        daysBetweenInclusive(s,e).forEach(d => {
          const idx = startOffset + (d.getDate()-1);
          const cell = cellRefs[idx];
          if(!cell) return;
          const marks = cell.querySelector('.marks');
          if(!marks) return;
          const m = document.createElement('div');
          m.className = 'mark';
          m.textContent = letter;
          m.style.background = color;
          marks.appendChild(m);
        });
      });

      cal.appendChild(frag);
    }
  });
}

function renderTable(all){
  const mount = $('#tableMount');
  if(!all) { mount.innerHTML=''; return; }
  const today = startOfDay(new Date());
  const future = all.filter(b => startOfDay(new Date(b.end_date)) >= today);
  $('#count').textContent = `(${future.length})`;

  const rows = future.map(b=>{
    const dur = (new Date(b.end_date) - new Date(b.start_date))/(1000*60*60*24) + 1;
    return `<tr data-id="${b.id}">
      <td><span class="tag" style="background:${colorFor(b.name)}20; border:1px solid ${colorFor(b.name)}40; color:${colorFor(b.name)}">${b.name}</span></td>
      <td>${b.start_date}</td>
      <td>${b.end_date}</td>
      <td>${dur}</td>
      <td>
        <button class="btn-edit">Bearbeiten</button>
        <button class="btn-del">Löschen</button>
      </td>
    </tr>`
  }).join('');
  mount.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Start</th><th>Ende</th><th>Tage</th><th>Aktionen</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  mount.querySelectorAll('.btn-edit').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const tr = e.target.closest('tr');
      const id = parseInt(tr.dataset.id,10);
      const b = future.find(x=>x.id===id);
      enterEditMode(b);
      const det = $('#bookingsDetails'); if(det && det.open){ det.open = false; }
    });
  });
  mount.querySelectorAll('.btn-del').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const tr = e.target.closest('tr');
      const id = parseInt(tr.dataset.id,10);
      const code = $('#code')? $('#code').value.trim() : '';
      try{ await API.del(id, code); renderAll(); }
      catch(err){ showMsg(err); }
    });
  });
}

let EDITING = null;
let lastCheck = { day: (new Date()).getDate(), month: (new Date()).getMonth() };

function enterEditMode(b){
  EDITING = b;
  $('#formTitle').textContent = 'Buchung bearbeiten';
  $('#name').value = b.name;
  $('#start').value = b.start_date;
  $('#end').value = b.end_date;
  $('#btnAdd').textContent = 'Speichern';
  $('#btnCancel').hidden = false;
}

function exitEditMode(){
  EDITING = null;
  $('#formTitle').textContent = 'Neuen Zeitraum eintragen';
  $('#btnAdd').textContent = 'Eintragen';
  $('#btnCancel').hidden = true;
  $('#start').value = '';
  $('#end').value = '';
}

$('#btnCancel').addEventListener('click', ()=>{ exitEditMode(); });

function showMsg(errOrText){
  const el = $('#msg');
  if(typeof errOrText === 'string'){ el.textContent = errOrText; return; }
  const e = errOrText||{};
  const map = {401:'Falsches Passwort.', 400:'Bitte Felder prüfen.', 409:'Konflikt: Zeitraum überschneidet sich.'};
  el.textContent = map[e.status] || 'Fehler. Bitte erneut versuchen.';
}

async function renderAll(){
  const monthsAhead = parseInt($('#months').value,10);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = addMonths(start, monthsAhead);
  const from = fmt(start), to = fmt(new Date(end.getFullYear(), end.getMonth(), 0));
  const all = await API.list(from, to);
  renderCalendar(monthsAhead, all);
  renderTable(all);
}

// Auto-Reload bei Tages-/Monatswechsel
setInterval(()=>{
  const now = new Date();
  if(now.getDate() !== lastCheck.day || now.getMonth() !== lastCheck.month){
    lastCheck = { day: now.getDate(), month: now.getMonth() };
    renderAll();
  }
}, 5*60*1000);

$('#btnAdd').addEventListener('click', async ()=>{
  const name = $('#name').value;
  const start = $('#start').value; const end = $('#end').value;
  const code = $('#code')? $('#code').value.trim() : '';
  if(!name || !start || !end) return showMsg('Bitte Name/Start/Ende ausfüllen.');
  try{
    if(EDITING){
      await API.update(EDITING.id, {name,start,end,code});
      exitEditMode();
      $('#msg').textContent='Gespeichert.';
    }else{
      await API.add({name,start,end,code});
      $('#msg').textContent='Gespeichert.';
    }
    renderAll();
  }catch(err){ showMsg(err); }
});

$('#btnReload').addEventListener('click', ()=> renderAll());

renderAll();
