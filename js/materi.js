/* ===== Halaman Materi (Supabase) ===== */
let MATS = [], filter = 'all', query = '';
const CAT_EMOJI = { Slide: '🖼️', Modul: '📘', Video: '🎬', Catatan: '🗒️', Link: '🔗' };
const canDelete = m => m.author_id === ME.id || (isDosen() && isMine(m.course_id));
const likedBy = m => (m.material_likes || []).map(l => l.user_id);

async function load() {
  MATS = must(await sb.from('materials').select('*, material_likes(user_id)').eq('class_id', CID).order('created_at', { ascending: false }));
}

function renderStats() {
  $('#c1').textContent = MATS.length;
  $('#c2').textContent = COURSES.length;
  $('#c3').textContent = MATS.filter(x => x.file_path).length;
  $('#c4').textContent = MATS.reduce((a, x) => a + likedBy(x).length, 0);
}

function render() {
  const list = MATS
    .filter(m => filter === 'all' || m.cat === filter)
    .filter(m => (m.title + ' ' + courseName(m.course_id) + ' ' + m.author_name).toLowerCase().includes(query));
  const box = $('#mats');
  if (!list.length) {
    const none = !MATS.length;
    box.innerHTML = `<div class="empty" style="grid-column:1/-1"><img src="img/empty.svg" alt=""><b>${none ? 'Belum ada materi' : 'Materi tidak ditemukan'}</b><br>${none ? 'Klik "Unggah Materi" untuk membagikan materi pertama!' : 'Coba ubah kategori atau kata pencarian.'}</div>`;
    return;
  }
  box.innerHTML = list.map((m, i) => {
    const k = fileKind(m.file_name, m.cat);
    const liked = likedBy(m).includes(ME.id);
    return `<article class="card mcard" style="--c:${esc(courseColor(m.course_id))};animation-delay:${i * .05}s">
      <div class="top">
        <div class="ftype" style="background:${k.c}">${k.l}</div>
        <div><h3>${esc(m.title)}</h3><span class="course">${esc(courseName(m.course_id))}</span><br><span class="badge p" style="margin-top:6px">${CAT_EMOJI[m.cat] || '📄'} ${esc(m.cat)}</span></div>
      </div>
      <p class="desc">${esc(m.descr || 'Tidak ada deskripsi.')}</p>
      <div class="meta"><span>👤 ${esc(m.author_name)}</span><span>🕒 ${ago(m.created_at)}</span>${m.file_size ? `<span>💾 ${fmtSize(m.file_size)}</span>` : ''}</div>
      <div class="row">
        <button class="like ${liked ? 'on' : ''}" data-act="like" data-id="${m.id}">${liked ? '❤️' : '🤍'} ${likedBy(m).length}</button>
        <div style="display:flex;gap:8px">
          <button class="btn sm" data-act="dl" data-id="${m.id}">${m.link && !m.file_path ? '🔗 Buka' : '⬇ Unduh'}</button>
          ${canDelete(m) ? `<button class="btn red sm" data-act="rm" data-id="${m.id}" title="Hapus materi">🗑 Hapus</button>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}
const renderAll = () => { renderStats(); render(); };

boot(async () => {
  await load(); renderAll();

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#tabs button').forEach(x => x.classList.remove('on')); b.classList.add('on');
    filter = b.dataset.f; render();
  });
  $('#q').addEventListener('input', e => { query = e.target.value.toLowerCase(); render(); });
  const qc = new URLSearchParams(location.search).get('c');
  if (qc) { query = qc.toLowerCase(); $('#q').value = qc; render(); }

  document.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const id = a.dataset.id, act = a.dataset.act, m = MATS.find(x => x.id === id);
    if (!m) return;
    try {
      if (act === 'like') {
        const liked = likedBy(m).includes(ME.id);
        if (liked) {
          must(await sb.from('material_likes').delete().eq('material_id', id).eq('user_id', ME.id));
          m.material_likes = m.material_likes.filter(l => l.user_id !== ME.id);
        } else {
          must(await sb.from('material_likes').insert({ material_id: id, class_id: CID, user_id: ME.id }));
          m.material_likes = [...(m.material_likes || []), { user_id: ME.id }];
        }
        renderAll();
      }
      if (act === 'dl') { if (m.file_path) await downloadPath(m.file_path, m.file_name); else openLink(m.link); }
      if (act === 'rm') {
        if (!canDelete(m) || !confirm('Hapus materi "' + m.title + '"?')) return;
        must(await sb.from('materials').delete().eq('id', id)); await removeFiles([m.file_path]);
        toast('Materi dihapus'); await load(); renderAll();
      }
    } catch (err) { fail(err); }
  });

  $('#btnUp').onclick = () => {
    const list = isDosen() ? myCourses() : COURSES;
    if (!list.length) {
      toast(isDosen() ? 'Kamu belum ditunjuk sebagai pengampu mata kuliah di kelas ini. Hubungi admin 🎓' : 'Belum ada mata kuliah. Minta admin menambahkannya.', 'err');
      return;
    }
    courseOptions($('#selCourse'), list); $('#fUp').author.value = ME.name; openModal('mUp');
  };
  setupDrop($('#dz'), $('#file'), $('#fn'));

  $('#fUp').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, file = $('#file').files[0], link = f.link.value.trim();
    if (!f.course.value) { toast('Pilih mata kuliah dulu', 'err'); return; }
    if (!file && !link) { toast('Pilih file atau tempel tautan dulu ya 📎', 'err'); return; }
    if (link && !/^https?:\/\//i.test(link)) { toast('Tautan harus diawali http:// atau https://', 'err'); return; }
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Mengunggah…';
    let path = null;
    try {
      if (file) path = await uploadFile(file, `${CID}/mats`);
      must(await sb.from('materials').insert({
        class_id: CID, course_id: f.course.value, title: f.title.value.trim(), cat: link && !file ? 'Link' : f.cat.value,
        descr: f.desc.value.trim(), link: link || null, file_path: path, file_name: file ? file.name : null, file_size: file ? file.size : null,
        author_id: ME.id, author_name: ME.name
      }));
      toast('Materi berhasil dibagikan! 🎉', 'ok'); confetti();
      f.reset(); $('#file').value = ''; $('#fn').textContent = ''; closeModal('mUp'); await load(); renderAll();
    } catch (err) {
      if (path) await removeFiles([path]);
      fail(err, 'Gagal mengunggah materi: ' + (err.message || err));
    } finally { btn.disabled = false; btn.textContent = 'Bagikan Materi 🚀'; }
  });
});
