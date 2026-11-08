/* ===== Admin: kelola satu kelas — mata kuliah, pengampu, anggota (Supabase) ===== */
const KID = new URLSearchParams(location.search).get('id');
let K = null, KCOURSES = [], KMEMBERS = [], DOSENS = [], TCOUNT = {}, MCOUNT = {};

const dosenLabel = d => `${d.name}${d.nim ? ' · ' + d.nim : ''}`;
function dosenSelectHtml(selected) {
  return `<option value="">— belum ada pengampu —</option>` +
    DOSENS.map(d => `<option value="${esc(d.id)}" ${d.id === selected ? 'selected' : ''}>${esc(dosenLabel(d))}</option>`).join('');
}

async function load() {
  K = must(await sb.from('classes').select('*').eq('id', KID).maybeSingle());
  if (!K) { toast('Kelas tidak ditemukan', 'err'); await go('admin.html'); }
  const [c, m, d, t, mt] = await Promise.all([
    sb.from('courses').select('*').eq('class_id', KID).order('created_at'),
    sb.from('class_members').select('user_id, joined_at, profiles(name, username, nim, role)').eq('class_id', KID).order('joined_at'),
    sb.from('profiles').select('id,name,username,nim').eq('role', 'dosen').order('name'),
    sb.from('tasks').select('course_id').eq('class_id', KID),
    sb.from('materials').select('course_id').eq('class_id', KID)
  ]);
  KCOURSES = must(c); KMEMBERS = must(m); DOSENS = must(d);
  TCOUNT = {}; MCOUNT = {};
  must(t).forEach(x => TCOUNT[x.course_id] = (TCOUNT[x.course_id] || 0) + 1);
  must(mt).forEach(x => MCOUNT[x.course_id] = (MCOUNT[x.course_id] || 0) + 1);
}

function render() {
  document.title = `${K.name} — Kelola Kelas`;
  $('#ttl').innerHTML = `${esc(K.emoji)} <span class="grad">${esc(K.name)}</span>`;
  $('#head').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
    <div><h3>${esc(K.emoji)} ${esc(K.name)}</h3><p class="sub" style="margin:0">${esc(K.descr || 'Tanpa deskripsi')}</p>
      <div style="margin-top:10px"><small style="color:var(--mut);font-weight:600">Kode kelas (bagikan ke mahasiswa &amp; dosen)</small><br>
        <span class="code">${esc(K.code)}<button data-act="copy">Salin</button></span></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn sec" data-act="edit">✏️ Ubah nama</button>
      <button class="btn red" data-act="delclass">🗑 Hapus kelas</button>
    </div></div>`;

  const mhs = KMEMBERS.filter(x => x.profiles && x.profiles.role === 'mahasiswa').length;
  const dsn = KMEMBERS.filter(x => x.profiles && x.profiles.role === 'dosen').length;
  $('#k1').textContent = KCOURSES.length; $('#k2').textContent = mhs; $('#k3').textContent = dsn;
  $('#k4').textContent = Object.values(TCOUNT).reduce((a, b) => a + b, 0);

  $('#selDosen').innerHTML = dosenSelectHtml('');
  $('#noDosen').classList.toggle('hide', DOSENS.length > 0);

  $('#cList').innerHTML = KCOURSES.length ? KCOURSES.map(c => `<div class="it">
      <div class="em3">${esc(c.emoji)}</div>
      <div class="grow"><b style="color:${esc(c.color)}">${esc(c.name)}</b><br><small>${c.code ? 'Kode ' + esc(c.code) + ' · ' : ''}${TCOUNT[c.id] || 0} tugas · ${MCOUNT[c.id] || 0} materi</small></div>
      <select data-act="dosen" data-id="${c.id}" title="Dosen pengampu">${dosenSelectHtml(c.dosen_id)}</select>
      <button class="btn red sm" data-act="delcourse" data-id="${c.id}">🗑 Hapus</button>
    </div>`).join('')
    : `<div class="empty"><img src="img/empty.svg" alt=""><b>Belum ada mata kuliah</b><br>Tambahkan lewat form di atas, lalu pilih dosen pengampunya.</div>`;

  $('#mList').innerHTML = KMEMBERS.length ? KMEMBERS.map(x => {
    const p = x.profiles || {}, isD = p.role === 'dosen';
    return `<div class="it">
      <div class="av">${esc((p.name || '?').trim()[0].toUpperCase())}</div>
      <div class="grow"><b>${esc(p.name || '—')}</b><br><small>@${esc(p.username || '')}${p.nim ? ' · ' + (isD ? 'NIDN ' : 'NIM ') + esc(p.nim) : ''} · bergabung ${ago(x.joined_at)}</small></div>
      <span class="badge ${isD ? 'info' : 'ok'}">${isD ? '👩‍🏫 Dosen' : '🎒 Mahasiswa'}</span>
      <button class="btn red sm" data-act="kick" data-id="${x.user_id}">Keluarkan</button>
    </div>`;
  }).join('')
    : `<div class="empty"><img src="img/empty.svg" alt=""><b>Belum ada anggota</b><br>Bagikan kode kelas <b>${esc(K.code)}</b> ke mahasiswa dan dosen.</div>`;
}

const refresh = async () => { await load(); render(); };

// semua file di storage yang terkait daftar tugas/materi (untuk dibersihkan saat hapus)
async function filesOfCourse(courseId) {
  const [t, m] = await Promise.all([
    sb.from('tasks').select('id,attach_path').eq('course_id', courseId),
    sb.from('materials').select('file_path').eq('course_id', courseId)
  ]);
  const tasks = must(t), ids = tasks.map(x => x.id);
  const s = ids.length ? must(await sb.from('submissions').select('file_path').in('task_id', ids)) : [];
  return [...tasks.map(x => x.attach_path), ...s.map(x => x.file_path), ...must(m).map(x => x.file_path)];
}

boot(async () => {
  if (!KID) { await go('admin.html'); }
  await load(); render();

  $('#fAdd').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const { error } = await sb.from('courses').insert({
        class_id: KID, name: f.name.value.trim(), code: f.code.value.trim(), emoji: f.emoji.value, color: f.color.value,
        dosen_id: f.dosen.value || null
      });
      if (error) { if (error.code === '23505') { toast('Mata kuliah itu sudah ada di kelas ini', 'err'); return; } throw error; }
      f.reset(); f.color.value = '#2563EB';
      toast('Mata kuliah ditambahkan ✨', 'ok'); await refresh();
    } catch (err) { fail(err); } finally { btn.disabled = false; }
  });

  // pilih pengampu
  $('#cList').addEventListener('change', async e => {
    const s = e.target.closest('select[data-act=dosen]'); if (!s) return;
    try {
      must(await sb.from('courses').update({ dosen_id: s.value || null }).eq('id', s.dataset.id));
      toast(s.value ? 'Pengampu diperbarui ✅' : 'Pengampu dikosongkan', 'ok'); await refresh();
    } catch (err) { fail(err); await refresh(); }
  });

  document.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    try {
      if (act === 'copy') {
        (navigator.clipboard ? navigator.clipboard.writeText(K.code) : Promise.reject())
          .then(() => toast('Kode disalin: ' + K.code, 'ok'), () => toast('Kode: ' + K.code));
      }
      if (act === 'edit') {
        const name = prompt('Nama kelas:', K.name); if (name === null) return;
        const descr = prompt('Deskripsi kelas:', K.descr || ''); if (descr === null) return;
        const { error } = await sb.from('classes').update({ name: name.trim(), descr: descr.trim() }).eq('id', KID);
        if (error) { if (error.code === '23505') { toast('Nama kelas itu sudah dipakai kelas lain', 'err'); return; } throw error; }
        toast('Kelas diperbarui', 'ok'); await refresh();
      }
      if (act === 'delclass') {
        if (!confirm(`Hapus kelas "${K.name}" beserta SEMUA mata kuliah, tugas, pengumpulan, dan materinya? Ini tidak bisa dibatalkan.`)) return;
        const [t, s, m] = await Promise.all([
          sb.from('tasks').select('attach_path').eq('class_id', KID),
          sb.from('submissions').select('file_path').eq('class_id', KID),
          sb.from('materials').select('file_path').eq('class_id', KID)
        ]);
        const files = [...must(t).map(x => x.attach_path), ...must(s).map(x => x.file_path), ...must(m).map(x => x.file_path)];
        must(await sb.from('classes').delete().eq('id', KID));
        await removeFiles(files);
        await go('admin.html');
      }
      if (act === 'delcourse') {
        const c = KCOURSES.find(x => x.id === id); if (!c) return;
        const nt = TCOUNT[id] || 0, nm = MCOUNT[id] || 0;
        const extra = (nt || nm) ? `\n\nSebanyak ${nt} tugas dan ${nm} materi di mata kuliah ini (beserta pengumpulannya) juga akan ikut terhapus.` : '';
        if (!confirm(`Hapus mata kuliah "${c.name}"?${extra}`)) return;
        const files = await filesOfCourse(id);
        must(await sb.from('courses').delete().eq('id', id));
        await removeFiles(files);
        toast('Mata kuliah dihapus'); await refresh();
      }
      if (act === 'kick') {
        const x = KMEMBERS.find(m => m.user_id === id); if (!x) return;
        if (!confirm(`Keluarkan ${(x.profiles || {}).name || 'anggota ini'} dari kelas?`)) return;
        must(await sb.from('class_members').delete().eq('class_id', KID).eq('user_id', id));
        toast('Anggota dikeluarkan'); await refresh();
      }
    } catch (err) { fail(err); }
  });
});
