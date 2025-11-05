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

function renderBars(container, year, month, startOffset, daysCount, entries){
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month+1, 0);
  const totalCells = startOffset + daysCount;
  const weeks = Math.ceil(totalCells / 7);

  const bookings = entries
    .map(e => ({...e, s: new Date(e.start_date), e: new Date(e.end_date)}))
    .filter(b => !(b.e < monthStart || b.s > monthEnd));

  bookings.forEach((b) => {
    const s = clipToMonth(b.s, year, month);
    const e = clipToMonth(b.e, year, month);
    const sDay = s.getDate();
    const eDay = e.getDate();
    const startIndex = startOffset + (sDay - 1);
    const endIndex   = startOffset + (eDay - 1);
    const color = colorFor(b.name);

    const firstSegRow = Math.floor(startIndex/7);
    const startWeekday = (startIndex % 7);
    let labelRow = firstSegRow;
    if(startWeekday === 6 && endIndex > startIndex){ labelRow = firstSegRow + 1; }

    for(let w=0; w<weeks; w++){
      const rowStart = w*7;
      const rowEnd = w*7 + 6;
      const segStart = Math.max(startIndex, rowStart);
      const segEnd   = Math.min(endIndex, rowEnd);
      if(segStart <= segEnd){
        const seg = document.createElement('div');
        seg.className = 'bar';
        seg.style.background = color;
        const colStart = (segStart % 7) + 1;
        const colEnd   = (segEnd % 7) + 2;
        seg.style.gridColumn = `${colStart} / ${colEnd}`;
        seg.style.gridRow = (w+1).toString();

        const isSingleDay = segStart === segEnd;
        const narrowCols = (segEnd - segStart + 1) <= 2;
        if(isSingleDay || narrowCols){ seg.classList.add('compact'); }

        if(w === labelRow){
          const label = document.createElement('span');
          label.className = 'label';
          label.textContent = b.name;
          seg.appendChild(label);

          const del = document.createElement('button');
          del.textContent = isSingleDay ? '✕' : 'Löschen';
          del.title = 'Löschen';
          del.className = 'del';
          del.addEventListener('click', async (ev)=>{
            ev.stopPropagation();
            const code = $('#code')? $('#code').value.trim() : '';
            try{ await API.del(b.id, code); renderAll(); }
            catch(err){ showMsg(err); }
          });
          seg.appendChild(del);
        }
        container.appendChild(seg);
      }
    }
  });
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

      // 1) Bars zuerst einfügen
      renderBars(grid, mdate.getFullYear(), mdate.getMonth(), startOffset, count, all);

      // 2) Danach die Day-Zellen, damit diese oben liegen
      days.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'day' + (d? '' : ' is-out');
        if(d){
          const dnum = document.createElement('div');
          dnum.className='dnum';
          dnum.textContent=d.getDate();
          if(d.toDateString() === new Date().toDateString()) cell.classList.add('today');
          cell.appendChild(dnum);
        }
        grid.appendChild(cell);
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
  // DEFAULT 6 Monate ist Server-Default; falls User hochdreht, nehmen wir den Wert
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
