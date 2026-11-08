/* ===== Halaman Mata Kuliah (hanya lihat; dikelola admin) ===== */
let TCOUNT = {}, MCOUNT = {};

async function loadCounts() {
  const [t, m] = await Promise.all([
    sb.from('tasks').select('course_id').eq('class_id', CID),
    sb.from('materials').select('course_id').eq('class_id', CID)
  ]);
  TCOUNT = {}; MCOUNT = {};
  must(t).forEach(x => TCOUNT[x.course_id] = (TCOUNT[x.course_id] || 0) + 1);
  must(m).forEach(x => MCOUNT[x.course_id] = (MCOUNT[x.course_id] || 0) + 1);
}

function render() {
  const cs = COURSES;
  $('#c1').textContent = cs.length;
  $('#c2').textContent = Object.values(TCOUNT).reduce((a, b) => a + b, 0);
  $('#c3').textContent = Object.values(MCOUNT).reduce((a, b) => a + b, 0);
  const box = $('#list');
  if (!cs.length) {
    box.style.display = 'block';
    box.innerHTML = `<div class="empty"><img src="img/empty.svg" alt=""><b>Belum ada mata kuliah</b><br>Admin akan menambahkan mata kuliah untuk kelas ini.</div>`;
    return;
  }
  box.style.display = '';
  box.innerHTML = cs.map((c, i) => {
    const mine = isDosen() && isMine(c.id);
    return `<article class="card ccard" style="--c:${esc(c.color)};animation-delay:${i * .05}s">
      <div class="hd"><div class="em2">${esc(c.emoji)}</div><h3>${esc(c.name)}</h3><small>${c.code ? 'Kode: ' + esc(c.code) : 'Tanpa kode'}</small></div>
      <div class="bd">
        <div style="margin-bottom:12px"><small style="color:var(--mut);font-weight:600">Dosen pengampu</small><br>
          <b>👩‍🏫 ${esc(dosenName(c.dosen_id))}</b> ${mine ? '<span class="badge ok" style="margin-left:6px">Kamu</span>' : ''}</div>
        <div class="nums"><div><b>${TCOUNT[c.id] || 0}</b>tugas</div><div><b>${MCOUNT[c.id] || 0}</b>materi</div></div>
        <div class="row">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn sec sm" href="tugas.html?c=${encodeURIComponent(c.name)}">📝 Tugas</a>
            ${mine ? `<a class="btn sm" href="tugas.html?new=1&c=${encodeURIComponent(c.name)}">📤 Kirim tugas</a>` : ''}
            <a class="btn sec sm" href="materi.html?c=${encodeURIComponent(c.name)}">📚 Materi</a>
          </div>
        </div>
      </div>
    </article>`;
  }).join('');
}

boot(async () => {
  await loadCounts(); render();
});
