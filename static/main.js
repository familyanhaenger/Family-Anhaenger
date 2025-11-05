const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];

const API = {
  async list(from, to){
    const u = new URL('/api/bookings', location.origin);
    if(from && to){ u.searchParams.set('from', from); u.searchParams.set('to', to); }
    const r = await fetch(u);
    return r.json();
  },
  async add({name, start, end, note, code}){
    const body = {name,start,end,note};
    if(code) body.code = code;
    const r = await fetch('/api/bookings', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
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

function hashColor(str){
  let h=0; for(const c of str) h=(h*31 + c.charCodeAt(0))>>>0;
  const hue = h % 360; const sat = 65; const lig = 55;
  return `hsl(${hue} ${sat}% ${lig}%)`;
}

function clipToMonth(d, year, month){
  const start = new Date(year, month, 1);
  const end = new Date(year, month+1, 0);
  if(d < start) return start;
  if(d > end) return end;
  return d;
}

function renderBars(grid, year, month, startOffset, daysCount, entries){
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
    const color = hashColor(b.name);
    const firstSegRow = Math.floor(startIndex/7);

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
        const colEnd   = (segEnd % 7) + 2; // exclusive
        seg.style.gridColumn = `${colStart} / ${colEnd}`;
        seg.style.gridRow = (w+1).toString();
        if(w === firstSegRow){
          const label = document.createElement('span');
          label.className = 'label';
          label.textContent = b.name + (b.note ? ' · ' + b.note : '');
          seg.appendChild(label);

          // Delete Button nur wenn Start im aktuellen Monat liegt
          const startInThisMonth = b.s.getMonth() === month && b.s.getFullYear() === year;
          if(startInThisMonth){
            const del = document.createElement('button');
            del.textContent = 'Löschen';
            del.className = 'del tag';
            del.style.marginLeft = 'auto';
            del.addEventListener('click', async ()=>{
              const codeEl = document.getElementById('code');
              const code = codeEl ? codeEl.value.trim() : '';
              try{ await API.del(b.id, code); renderCalendar(parseInt($('#months').value,10)); }
              catch(err){ showMsg(err); }
            });
            seg.appendChild(del);
          }
        }
        grid.appendChild(seg);
      }
    }
  });
}

function renderCalendar(monthsAhead){
  const cal = $('#calendar'); cal.innerHTML='';
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end   = addMonths(start, monthsAhead);
  const from = fmt(start), to = fmt(new Date(end.getFullYear(), end.getMonth(), 0));

  API.list(from, to).then(all => {
    for(let i=0;i<monthsAhead;i++){
      const mdate = addMonths(start, i);
      const {first,last,days,startOffset,count} = monthMatrix(mdate.getFullYear(), mdate.getMonth());
      const node = document.importNode($('#tpl-month').content, true);
      node.querySelector('.month-title').textContent = first.toLocaleString('de-DE', {month:'long', year:'numeric'});
      const grid = node.querySelector('.grid-days');

      days.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'day' + (d? '' : ' is-out');
        if(d){
          const dnum = document.createElement('div'); dnum.className='dnum'; dnum.textContent=d.getDate(); cell.appendChild(dnum);
        }
        grid.appendChild(cell);
      });

      renderBars(grid, mdate.getFullYear(), mdate.getMonth(), startOffset, count, all);
      cal.appendChild(node);
    }
  });
}

function showMsg(errOrText){
  const el = $('#msg');
  if(typeof errOrText === 'string'){ el.textContent = errOrText; return; }
  const e = errOrText||{}; const d = e.data||{};
  const map = {401:'Falscher Code.', 400:'Bitte Name/Zeitraum prüfen.', 409:'Konflikt: Zeitraum überschneidet sich.'};
  el.textContent = map[e.status] || 'Fehler. Bitte erneut versuchen.';
}

$('#btnAdd').addEventListener('click', async ()=>{
  const name = $('#name').value.trim();
  const start = $('#start').value; const end = $('#end').value;
  const note = $('#note').value.trim();
  const codeEl = document.getElementById('code');
  const code = codeEl ? codeEl.value.trim() : '';
  if(!name || !start || !end) return showMsg('Bitte Name/Start/Ende ausfüllen.');
  try{ await API.add({name,start,end,note,code}); $('#msg').textContent='Gespeichert.'; renderCalendar(parseInt($('#months').value,10)); }
  catch(err){ showMsg(err); }
});

$('#btnReload').addEventListener('click', ()=> renderCalendar(parseInt($('#months').value,10)));

$('#months').value = MONTHS_AHEAD; renderCalendar(MONTHS_AHEAD);
