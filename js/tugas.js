/* ===== Halaman Tugas (Supabase) ===== */
let TASKS = [], SUBS = [], filter = 'all', query = '', activeTask = null;

const getTasks = () => TASKS;
const getSubs = () => SUBS;
const subOf = id => SUBS.find(s => s.task_id === id && s.user_id === ME.id);
const countSubs = id => SUBS.filter(s => s.task_id === id).length;
const isLate = t => new Date(t.deadline) < Date.now();
// mahasiswa: done/late/todo ; dosen: late (deadline lewat) / todo (masih berjalan)
const status = t => isDosen() ? (isLate(t) ? 'late' : 'todo') : (subOf(t.id) ? 'done' : (isLate(t) ? 'late' : 'todo'));

function countdown(deadline) {
  const ms = new Date(deadline) - Date.now();
  if (ms <= 0) return { txt: 'Deadline terlewat', urgent: true };
  const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const txt = d > 0 ? `${d} hari ${h} jam lagi` : (h > 0 ? `${h} jam ${m} menit lagi` : `${m} menit lagi`);
  return { txt: '⏰ ' + txt, urgent: ms < 86400000 };
}
function progress(t) {
  const start = new Date(t.created_at), end = new Date(t.deadline);
  return Math.min(100, Math.max(0, (Date.now() - start) / (end - start) * 100));
}

async function load() {
  const [t, s] = await Promise.all([
    sb.from('tasks').select('*').eq('class_id', CID).order('deadline'),
    sb.from('submissions').select('*').eq('class_id', CID).order('created_at', { ascending: false })
  ]);
  TASKS = must(t); SUBS = must(s);   // RLS: mahasiswa hanya menerima pengumpulan miliknya, dosen hanya di matkul yang ia ampu
  if (isDosen()) TASKS = TASKS.filter(x => isMine(x.course_id));
}

function renderStats() {
  const ts = getTasks(), subs = getSubs();
  $('#c1').textContent = ts.length;
  if (isDosen()) {
    $('#c2').textContent = subs.length;
    $('#c3').textContent = ts.filter(t => !isLate(t)).length;
    $('#c4').textContent = ts.filter(isLate).length;
  } else {
    const st = ts.map(status);
    $('#c2').textContent = st.filter(x => x === 'done').length;
    $('#c3').textContent = st.filter(x => x === 'todo').length;
    $('#c4').textContent = st.filter(x => x === 'late').length;
  }
}

function renderTasks() {
  const list = getTasks()
    .filter(t => filter === 'all' || status(t) === filter)
    .filter(t => (t.title + ' ' + courseName(t.course_id)).toLowerCase().includes(query))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const box = $('#tasks');
  if (!list.length) {
    const none = !getTasks().length;
    box.innerHTML = `<div class="empty" style="grid-column:1/-1"><img src="img/empty.svg" alt=""><b>${none ? 'Belum ada tugas' : 'Tidak ada tugas di sini'}</b><br>${none ? (isDosen() ? (myCourses().length ? 'Klik "Kirim Tugas Baru" untuk menambahkan tugas pertama.' : 'Kamu belum menjadi pengampu mata kuliah di kelas ini. Hubungi admin.') : 'Tugas dari dosen akan muncul di sini.') : 'Coba ubah filter atau kata pencarian.'}</div>`;
    return;
  }
  box.innerHTML = list.map((t, i) => {
    const s = status(t), cd = countdown(t.deadline), sub = subOf(t.id), dosen = isDosen();
    const badge = dosen
      ? `<span class="badge info">📥 ${countSubs(t.id)} pengumpulan</span>`
      : s === 'done' ? '<span class="badge ok">✅ Terkumpul</span>' : s === 'late' ? '<span class="badge late">⚠️ Terlewat</span>' : '<span class="badge wait">⏳ Belum</span>';
    const sub2 = (!dosen && s === 'done') ? '📎 ' + esc(sub.file_name || 'tanpa file') : cd.txt;
    let action;
    if (dosen) action = `<button class="btn red sm" data-act="del" data-id="${t.id}">🗑 Hapus</button>`;
    else if (s === 'done') action = `<button class="btn sm green" data-act="submit" data-id="${t.id}">Kirim ulang</button>`;
    else action = `<button class="btn sm" data-act="submit" data-id="${t.id}" ${s === 'late' ? 'style="background:#b2bec3;box-shadow:none"' : ''}>${s === 'late' ? 'Kumpul terlambat' : 'Kumpulkan'}</button>`;
    return `<article class="card" style="--c:${esc(courseColor(t.course_id))};animation-delay:${i * .06}s">
      <div class="top"><div class="em">${esc(t.emoji)}</div><div><h3>${esc(t.title)}</h3><span class="course">${esc(courseName(t.course_id))}</span></div></div>
      <p class="desc">${esc(t.descr || 'Tidak ada deskripsi.')}</p>
      ${t.attach_path ? `<div class="attach"><span>📎 ${esc(t.attach_name)}${t.attach_size ? ' <small>(' + fmtSize(t.attach_size) + ')</small>' : ''}</span><button class="btn sec sm" data-act="dlatt" data-id="${t.id}">⬇ Unduh soal</button></div>` : ''}
      <div class="bar"><i style="width:${s === 'done' ? 100 : progress(t)}%;${s === 'late' ? 'background:var(--r)' : s === 'done' ? 'background:var(--g)' : ''}"></i></div>
      <div class="row">
        <div>${badge}<div class="cd ${cd.urgent && s !== 'done' ? 'urgent' : ''}" style="margin-top:6px">${sub2}</div></div>
        ${action}
      </div>
      <div class="meta" style="margin:12px 0 0;display:block">🗓 Deadline: ${fmtDate(t.deadline)}${t.by_name ? `<br>👩‍🏫 ${esc(t.by_name)}${t.by_nid ? ' · NIDN/NIP: ' + esc(t.by_nid) : ''}` : ''}</div>
    </article>`;
  }).join('');
}

function renderHist() {
  const ts = getTasks(), subs = getSubs();
  $('#clearAll').style.display = subs.length ? '' : 'none';
  if (!subs.length) { $('#hist').innerHTML = `<div class="empty"><img src="img/empty.svg" alt=""><b>Belum ada pengumpulan</b><br>${isDosen() ? 'Tugas yang dikirim mahasiswa akan muncul di sini.' : 'Tugas yang kamu kirim akan muncul di sini.'}</div>`; return; }
  $('#hist').innerHTML = subs.map(s => {
    const t = ts.find(x => x.id === s.task_id) || { title: 'Tugas dihapus' };
    const k = fileKind(s.file_name);
    return `<div class="it">
      <div style="background:${k.c};width:46px;height:52px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:.75rem">${k.l}</div>
      <div class="grow"><b>${esc(t.title)}</b><br><small>${esc(s.name)} (${esc(s.nim)}) · ${fmtDate(s.created_at)}${s.late ? ' · <span style="color:#d63031">terlambat</span>' : ''}</small>
      <br><small>📎 ${esc(s.file_name || 'tanpa file')} ${s.file_size ? '· ' + fmtSize(s.file_size) : ''}${s.note ? ' · 💬 ' + esc(s.note) : ''}</small></div>
      <button class="btn sec sm" data-act="dl" data-id="${s.id}">⬇ Unduh</button>
      <button class="btn red sm" data-act="rm" data-id="${s.id}">Hapus</button>
    </div>`;
  }).join('');
}
const renderAll = () => { renderStats(); renderTasks(); renderHist(); };
const reload = async () => { await load(); renderAll(); };

boot(async () => {
  /* ---- tampilan sesuai peran ---- */
  if (isDosen()) {
    $('#l2').textContent = 'Total pengumpulan'; $('#l3').textContent = 'Tugas berjalan'; $('#l4').textContent = 'Deadline lewat';
    $('#tabs [data-f=todo]').textContent = 'Berjalan'; $('#tabs [data-f=late]').textContent = 'Deadline lewat';
    $('#tabs [data-f=done]').remove();
    $('#histTitle').innerHTML = 'Pengumpulan <span>Masuk</span>';
  } else {
    $('#btnNew').remove();
  }

  await load(); renderAll();

  /* ---- events ---- */
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#tabs button').forEach(x => x.classList.remove('on')); b.classList.add('on');
    filter = b.dataset.f; renderTasks();
  });
  $('#q').addEventListener('input', e => { query = e.target.value.toLowerCase(); renderTasks(); });
  const sp = new URLSearchParams(location.search), qc = sp.get('c'), wantNew = sp.get('new') === '1' && isDosen();
  if (qc && !wantNew) { query = qc.toLowerCase(); $('#q').value = qc; renderTasks(); }

  document.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    e.preventDefault();
    const id = a.dataset.id, act = a.dataset.act;
    try {
      if (act === 'submit') {
        activeTask = getTasks().find(t => t.id === id); if (!activeTask) return;
        $('#mSubTitle').textContent = `${activeTask.emoji} ${activeTask.title} — ${courseName(activeTask.course_id)}`;
        const prev = subOf(id), f = $('#fSubmit');
        f.name.value = prev ? prev.name : ME.name; f.nim.value = prev ? prev.nim : (ME.nim || '');
        openModal('mSubmit');
      }
      if (act === 'dlatt') { const t = getTasks().find(x => x.id === id); if (t) await downloadPath(t.attach_path, t.attach_name); }
      if (act === 'dl') { const s = getSubs().find(x => x.id === id); if (s) await downloadPath(s.file_path, s.file_name); }
      if (act === 'rm') {
        const s = getSubs().find(x => x.id === id); if (!s || !confirm('Hapus pengumpulan ini?')) return;
        if (isDosen()) await removeFiles([s.file_path]);      // dosen: file dulu, selagi barisnya masih ada
        must(await sb.from('submissions').delete().eq('id', id)); if (!isDosen()) await removeFiles([s.file_path]);
        toast('Pengumpulan dihapus'); await reload();
      }
      if (act === 'del') {
        if (!isDosen()) return;
        const t = getTasks().find(x => x.id === id); if (!t) return;
        const n = countSubs(id);
        if (!confirm(`Hapus tugas "${t.title}"?${n ? `\n\n${n} pengumpulan di tugas ini juga akan terhapus.` : ''}`)) return;
        const files = [t.attach_path, ...getSubs().filter(s => s.task_id === id).map(s => s.file_path)];
        await removeFiles(files);                              // file dulu: izin baca file pengumpulan butuh barisnya
        must(await sb.from('tasks').delete().eq('id', id));
        toast('Tugas dihapus'); await reload();
      }
    } catch (err) { fail(err); }
  });

  $('#clearAll').onclick = async () => {
    const msg = isDosen() ? 'Hapus SEMUA pengumpulan dari semua mahasiswa di kelas ini?' : 'Hapus SEMUA riwayat pengumpulanmu di kelas ini?';
    if (!confirm(msg)) return;
    try {
      const files = getSubs().map(s => s.file_path);
      if (isDosen()) await removeFiles(files);                 // dosen: file dulu, selagi barisnya masih ada
      let q = sb.from('submissions').delete().eq('class_id', CID);
      if (!isDosen()) q = q.eq('user_id', ME.id);
      must(await q); if (!isDosen()) await removeFiles(files);
      toast('Riwayat dibersihkan'); await reload();
    } catch (err) { fail(err); }
  };

  setupDrop($('#dz'), $('#file'), $('#fn'));
  setupDrop($('#dz2'), $('#file2'), $('#fn2'));

  /* mahasiswa mengumpulkan tugas */
  $('#fSubmit').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, file = $('#file').files[0];
    if (!file) { toast('Pilih file tugas dulu ya 📎', 'err'); return; }
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Mengirim…';
    let path = null;
    try {
      const prev = subOf(activeTask.id);
      path = await uploadFile(file, `${CID}/subs/${ME.id}`);
      must(await sb.from('submissions').upsert({
        task_id: activeTask.id, class_id: CID, user_id: ME.id, name: f.name.value.trim(), nim: f.nim.value.trim(), note: f.note.value.trim(),
        file_path: path, file_name: file.name, file_size: file.size
      }, { onConflict: 'task_id,user_id' }));
      if (prev && prev.file_path) await removeFiles([prev.file_path]); // kirim ulang = ganti file lama
      toast('Tugas berhasil dikumpulkan! 🎉', 'ok'); confetti();
      f.reset(); $('#file').value = ''; $('#fn').textContent = ''; closeModal('mSubmit'); openModal('mOk'); await reload();
    } catch (err) {
      if (path) await removeFiles([path]);
      fail(err, 'Gagal mengirim tugas: ' + (err.message || err));
    } finally { btn.disabled = false; btn.textContent = 'Kirim Tugas 🚀'; }
  });

  /* dosen membuat & mengirim tugas */
  const bn = $('#btnNew');
  const openNew = () => {
    const mine = myCourses();
    if (!mine.length) { toast('Kamu belum ditunjuk sebagai pengampu mata kuliah di kelas ini. Hubungi admin 🎓', 'err'); return; }
    courseOptions($('#selCourse'), mine);
    const pre = mine.find(c => c.name === qc); if (pre) $('#selCourse').value = pre.id;
    const d = new Date(Date.now() + 3 * 86400000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $('#fNew').deadline.value = d.toISOString().slice(0, 16); openModal('mNew');
  };
  if (bn) bn.onclick = openNew;

  $('#fNew').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    if (!f.course.value) { toast('Pilih mata kuliah dulu', 'err'); return; }
    const file = $('#file2').files[0], btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Mengirim…';
    let path = null;
    try {
      if (file) path = await uploadFile(file, `${CID}/tasks`);
      must(await sb.from('tasks').insert({
        class_id: CID, course_id: f.course.value, title: f.title.value.trim(), descr: f.desc.value.trim(), emoji: f.emoji.value,
        deadline: new Date(f.deadline.value).toISOString(), by_id: ME.id, by_name: ME.name, by_nid: ME.nim || '',
        attach_path: path, attach_name: file ? file.name : null, attach_size: file ? file.size : null
      }));
      toast('Tugas terkirim ke mahasiswa ✨', 'ok');
      f.reset(); $('#file2').value = ''; $('#fn2').textContent = ''; closeModal('mNew'); await reload();
    } catch (err) {
      if (path) await removeFiles([path]);
      fail(err, 'Gagal mengirim tugas: ' + (err.message || err));
    } finally { btn.disabled = false; btn.textContent = 'Kirim ke Mahasiswa 🚀'; }
  });

  if (wantNew) openNew(); // datang dari tombol "Kirim Tugas"
  setInterval(renderTasks, 60000); // segarkan hitung mundur
});
