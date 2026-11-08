/* ===== Dashboard Dosen: gabung kelas dengan kode dari admin (Supabase) ===== */
let CLASSES = [], MYC = [], MYT = [], MC = {};
function enter(id, page = 'index.html') { selectClass(id); location.href = page; }

function render() {
  const box = $('#list');
  if (!CLASSES.length) {
    box.style.display = 'block';
    box.innerHTML = `<div class="empty"><img src="img/empty.svg" alt=""><b>Kamu belum bergabung ke kelas mana pun</b><br>Masukkan kode kelas dari admin di kotak "Gabung dengan Kode".</div>`;
    return;
  }
  box.style.display = '';
  box.innerHTML = CLASSES.map((c, i) => {
    const mine = MYC.filter(x => x.class_id === c.id), nT = MYT.filter(x => x.class_id === c.id).length;
    const m = MC[c.id] || { mhs: 0 };
    return `<article class="card ccard" style="--c:${esc(c.color)};animation-delay:${i * .05}s">
      <div class="hd"><div class="em2">${esc(c.emoji)}</div><h3>${esc(c.name)}</h3><small>${esc(c.descr || 'Tanpa deskripsi')}</small></div>
      <div class="bd">
        <div class="nums"><div><b>${m.mhs}</b>mahasiswa</div><div><b>${mine.length}</b>matkul saya</div><div><b>${nT}</b>tugas saya</div></div>
        <div style="margin-bottom:14px">${mine.length
          ? `<small style="color:var(--mut);font-weight:600">Mata kuliah yang kamu ampu</small><div class="chips" style="margin-top:6px;gap:6px">${mine.map(x => `<span class="badge p">${esc(x.emoji)} ${esc(x.name)}</span>`).join('')}</div>`
          : `<span class="badge wait">⏳ Belum ada mata kuliah yang kamu ampu di kelas ini</span><br><small style="color:var(--mut)">Hubungi admin untuk ditunjuk sebagai pengampu.</small>`}</div>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          <button class="btn sm" data-act="enter" data-id="${c.id}">Masuk kelas →</button>
          ${mine.length
            ? `<button class="btn sec sm" data-act="task" data-id="${c.id}">＋ Tugas</button>`
            : `<button class="btn red sm" data-act="leave" data-id="${c.id}">Keluar kelas</button>`}
        </div>
      </div>
    </article>`;
  }).join('');
}

async function reload() {
  CLASSES = await loadClassStats();
  const [c, t, s] = await Promise.all([
    sb.from('courses').select('id,class_id,name,emoji').eq('dosen_id', ME.id),
    sb.from('tasks').select('id,class_id,course_id'),
    sb.from('submissions').select('id')      // RLS: hanya pengumpulan di mata kuliah yang diampu
  ]);
  MYC = must(c);
  const mine = new Set(MYC.map(x => x.id));
  MYT = must(t).filter(x => mine.has(x.course_id));
  MC = await loadMemberCounts();
  $('#s1').textContent = CLASSES.length;
  $('#s2').textContent = MYC.length;
  $('#s3').textContent = MYT.length;
  const nSubs = must(s).length;
  $('#s4').textContent = nSubs;
  $('#noSub').classList.toggle('hide', nSubs > 0);   // ilustrasi hanya saat belum ada pengumpulan
  render();
}

boot(async () => {
  await reload();

  $('#fJoin').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('button'); btn.disabled = true;
    try {
      const res = must(await sb.rpc('join_class', { p_code: f.code.value.trim() }));
      f.reset(); toast(`Berhasil bergabung ke ${res.name} 🎉`, 'ok'); confetti(); await reload();
    } catch (err) { fail(err); } finally { btn.disabled = false; }
  });

  $('#list').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id, c = CLASSES.find(x => x.id === id);
    try {
      if (act === 'enter') enter(id);
      if (act === 'task') enter(id, 'tugas.html?new=1');
      if (act === 'leave') {
        if (!c || !confirm(`Keluar dari kelas "${c.name}"?`)) return;
        must(await sb.from('class_members').delete().eq('class_id', id).eq('user_id', ME.id));
        if (localStorage.getItem(classKey()) === id) localStorage.removeItem(classKey());
        toast('Kamu keluar dari kelas'); await reload();
      }
    } catch (err) { fail(err); }
  });
});
