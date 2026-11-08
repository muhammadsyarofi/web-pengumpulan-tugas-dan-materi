/* ===== Dashboard Mahasiswa: gabung kelas dengan kode (Supabase) ===== */
let CLASSES = [], PENG = {};   // PENG: class_id -> nama dosen pengampu
function enter(id, page = 'index.html') { selectClass(id); location.href = page; }

async function reload() {
  CLASSES = await loadClassStats();
  const crs = must(await sb.from('courses').select('class_id,dosen_id'));
  await loadDosen(crs.map(x => x.dosen_id));
  PENG = {};
  crs.forEach(x => { if (x.dosen_id && DOSEN[x.dosen_id]) (PENG[x.class_id] || (PENG[x.class_id] = new Set())).add(DOSEN[x.dosen_id]); });

  const [t, s] = await Promise.all([
    sb.from('tasks').select('id,title,emoji,deadline,class_id,course:courses(name)').order('deadline'),
    sb.from('submissions').select('task_id').eq('user_id', ME.id)
  ]);
  const tasks = must(t), sent = new Set(must(s).map(x => x.task_id));
  let todo = 0, done = 0, late = 0; const soon = [];
  tasks.forEach(x => {
    if (sent.has(x.id)) done++; else if (new Date(x.deadline) < Date.now()) late++; else { todo++; soon.push(x); }
  });
  $('#s1').textContent = CLASSES.length; $('#s2').textContent = todo; $('#s3').textContent = done; $('#s4').textContent = late;

  $('#soon').innerHTML = soon.length
    ? soon.slice(0, 5).map(x => { const c = CLASSES.find(k => k.id === x.class_id) || {}; return `<div class="it">
        <div style="font-size:1.7rem">${esc(x.emoji)}</div>
        <div class="grow"><b>${esc(x.title)}</b><br><small>${esc(c.name)} · ${esc((x.course || {}).name)} · 🗓 ${fmtDate(x.deadline)}</small></div>
        <button class="btn sm" data-act="task" data-id="${x.class_id}">Kerjakan</button></div>`; }).join('')
    : `<div class="empty empty-ok"><img src="img/03-empty-tidak-ada-tugas.jpg" alt="Ilustrasi santai tanpa tugas" width="700" height="467" loading="lazy"><b>Aman, tidak ada tugas!</b><br>${CLASSES.length ? 'Kamu sudah beres semua 🎉' : 'Gabung ke kelas dulu untuk melihat tugas.'}</div>`;

  const box = $('#list');
  if (!CLASSES.length) {
    box.style.display = 'block';
    box.innerHTML = `<div class="empty"><img src="img/empty.svg" alt=""><b>Kamu belum bergabung ke kelas mana pun</b><br>Masukkan kode kelas dari admin di kotak "Gabung dengan Kode".</div>`;
    return;
  }
  box.style.display = '';
  box.innerHTML = CLASSES.map((c, i) => `<article class="card ccard" style="--c:${esc(c.color)};animation-delay:${i * .05}s">
      <img class="cc-img" src="img/06-belajar-bareng.jpg" alt="Belajar bareng" width="800" height="534" loading="lazy">
      <div class="hd"><div class="em2">${esc(c.emoji)}</div><h3>${esc(c.name)}</h3><small>👩‍🏫 ${esc([...(PENG[c.id] || [])].join(', ') || 'Belum ada pengampu')}</small></div>
      <div class="bd">
        <div class="nums"><div><b>${c.nCourses}</b>matkul</div><div><b>${c.nTasks}</b>tugas</div><div><b>${c.nMats}</b>materi</div></div>
        <div class="row">
          <button class="btn sm" data-act="enter" data-id="${c.id}">Masuk →</button>
          <button class="btn red sm" data-act="leave" data-id="${c.id}">Keluar kelas</button>
        </div>
      </div>
    </article>`).join('');
}

boot(async () => {
  $('#nm').textContent = (ME.name || '').trim().split(' ')[0] || 'Mahasiswa';
  await reload();

  $('#fJoin').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('button'); btn.disabled = true;
    try {
      const res = must(await sb.rpc('join_class', { p_code: f.code.value.trim() }));
      f.reset(); toast(`Berhasil bergabung ke ${res.name} 🎉`, 'ok'); confetti(); await reload();
    } catch (err) { fail(err); } finally { btn.disabled = false; }
  });

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    try {
      if (act === 'enter') enter(id);
      if (act === 'task') enter(id, 'tugas.html');
      if (act === 'leave') {
        const c = CLASSES.find(x => x.id === id); if (!c || !confirm(`Keluar dari kelas "${c.name}"?`)) return;
        must(await sb.from('class_members').delete().eq('class_id', id).eq('user_id', ME.id));
        if (localStorage.getItem(classKey()) === id) localStorage.removeItem(classKey());
        toast('Kamu keluar dari kelas'); await reload();
      }
    } catch (err) { fail(err); }
  });
});
