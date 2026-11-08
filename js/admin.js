/* ===== Dashboard Admin: buat kelas & bagikan kode kelas (Supabase) ===== */
const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 6 }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
let CLASSES = [], MC = {};

const copyText = (txt, msg) => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
  .then(() => toast(msg || 'Disalin: ' + txt, 'ok'), () => toast('Kode: ' + txt));
const nameTaken = err => err && err.code === '23505' && /classes_name_uq/.test(err.message || '');

function render() {
  const cs = CLASSES, box = $('#list');
  if (!cs.length) {
    box.style.display = 'block';
    box.innerHTML = `<div class="empty"><img src="img/empty.svg" alt=""><b>Belum ada kelas</b><br>Isi form di atas untuk membuat kelas pertama.</div>`;
    return;
  }
  box.style.display = '';
  box.innerHTML = cs.map((c, i) => {
    const m = MC[c.id] || { mhs: 0, dsn: 0 };
    return `<article class="card ccard" style="--c:${esc(c.color)};animation-delay:${i * .05}s">
      <div class="hd"><div class="em2">${esc(c.emoji)}</div><h3>${esc(c.name)}</h3><small>${esc(c.descr || 'Tanpa deskripsi')}</small></div>
      <div class="bd">
        <div class="nums"><div><b>${m.mhs}</b>mahasiswa</div><div><b>${m.dsn}</b>dosen</div><div><b>${c.nCourses}</b>matkul</div><div><b>${c.nTasks}</b>tugas</div></div>
        <div style="margin-bottom:14px"><small style="color:var(--mut);font-weight:600">Kode kelas (bagikan ke mahasiswa &amp; dosen)</small><br>
          <span class="code">${esc(c.code)}<button data-act="copy" data-code="${esc(c.code)}">Salin</button></span></div>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          <a class="btn sm" href="kelola.html?id=${c.id}">Kelola →</a>
          <button class="btn sec sm" data-act="newcode" data-id="${c.id}" title="Buat kode baru">🔄 Kode baru</button>
          <button class="btn red sm" data-act="del" data-id="${c.id}">🗑</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

async function reload() {
  CLASSES = await loadClassStats();
  MC = await loadMemberCounts();
  const prof = must(await sb.from('profiles').select('id,role'));
  $('#s1').textContent = CLASSES.length;
  $('#s2').textContent = CLASSES.reduce((n, c) => n + c.nCourses, 0);
  $('#s3').textContent = prof.filter(p => p.role === 'mahasiswa').length;
  $('#s4').textContent = prof.filter(p => p.role === 'dosen').length;
  render();
}

boot(async () => {
  await reload();

  $('#fNew').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      let c = null;
      for (let i = 0; i < 6 && !c; i++) {            // ulangi bila kode kebetulan sudah dipakai
        const { data, error } = await sb.from('classes').insert({
          name: f.name.value.trim(), descr: f.desc.value.trim(), emoji: f.emoji.value, color: f.color.value, code: genCode()
        }).select().single();
        if (nameTaken(error)) { toast(`Kelas "${f.name.value.trim()}" sudah ada. Pakai nama lain atau kelola kelas yang sudah ada.`, 'err'); return; }
        if (error && error.code !== '23505') throw error;
        if (!error) c = data;
      }
      if (!c) throw new Error('Gagal membuat kode kelas, coba lagi.');
      f.reset(); f.color.value = '#2563EB';
      toast(`Kelas dibuat! Kode: ${c.code}`, 'ok'); confetti(); await reload();
    } catch (err) { fail(err); } finally { btn.disabled = false; }
  });

  $('#list').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id, c = CLASSES.find(x => x.id === id);
    try {
      if (act === 'copy') copyText(b.dataset.code, 'Kode disalin: ' + b.dataset.code);

      if (act === 'newcode') {
        if (!c || !confirm(`Buat kode baru untuk kelas "${c.name}"?\n\nKode lama tidak bisa dipakai lagi untuk bergabung. Anggota yang sudah bergabung tetap aman.`)) return;
        let ok = false;
        for (let i = 0; i < 6 && !ok; i++) {
          const { error } = await sb.from('classes').update({ code: genCode() }).eq('id', id);
          if (error && error.code !== '23505') throw error;
          ok = !error;
        }
        if (!ok) throw new Error('Gagal membuat kode baru, coba lagi.');
        toast('Kode kelas diperbarui', 'ok'); await reload();
      }

      if (act === 'del') {
        if (!c || !confirm(`Hapus kelas "${c.name}" beserta SEMUA mata kuliah, tugas, pengumpulan, dan materinya? Ini tidak bisa dibatalkan.`)) return;
        const [t, s, m] = await Promise.all([
          sb.from('tasks').select('attach_path').eq('class_id', id),
          sb.from('submissions').select('file_path').eq('class_id', id),
          sb.from('materials').select('file_path').eq('class_id', id)
        ]);
        const files = [...must(t).map(x => x.attach_path), ...must(s).map(x => x.file_path), ...must(m).map(x => x.file_path)];
        must(await sb.from('classes').delete().eq('id', id));
        await removeFiles(files);
        toast('Kelas dihapus'); await reload();
      }
    } catch (err) { fail(err); }
  });
});
