/* ===== KelasHub — inti aplikasi (Supabase) ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
document.documentElement.style.visibility = 'hidden'; // sembunyikan sampai sesi dicek
const reveal = () => { document.documentElement.style.visibility = ''; };
setTimeout(reveal, 8000);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const MAX_FILE = 10 * 1024 * 1024; // batas 10 MB per file (sama dengan batas bucket)

function fmtSize(b) {
  if (!b) return '0 KB';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  return Math.floor(s / 86400) + ' hari lalu';
}



/* ---------- Toast ---------- */
function toast(msg, type = '') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
  setTimeout(() => { t.style.transition = '.4s'; t.style.opacity = 0; t.style.transform = 'translateX(60px)'; setTimeout(() => t.remove(), 400); }, 3200);
}

/* ---------- Confetti ---------- */
function confetti() {
  const cols = ['#2563EB', '#2563EB', '#16A34A', '#F59E0B', '#FCD34D', '#ff7675'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i'); c.className = 'cf';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = cols[i % cols.length];
    c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    c.style.animationDelay = Math.random() * .4 + 's';
    c.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

/* ---------- File helpers (Supabase Storage) ---------- */
function fileKind(name = '', cat = '') {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(e)) return { l: 'PDF', c: '#ff7675' };
  if (['doc', 'docx'].includes(e)) return { l: 'DOC', c: '#2563EB' };
  if (['ppt', 'pptx'].includes(e)) return { l: 'PPT', c: '#e17055' };
  if (['xls', 'xlsx', 'csv'].includes(e)) return { l: 'XLS', c: '#16A34A' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(e)) return { l: 'IMG', c: '#93C5FD' };
  if (['zip', 'rar', '7z'].includes(e)) return { l: 'ZIP', c: '#fdb23e' };
  if (['mp4', 'mov', 'mkv'].includes(e) || cat === 'Video') return { l: 'VID', c: '#e84393' };
  if (cat === 'Link') return { l: 'URL', c: '#22C55E' };
  return { l: (e || 'FILE').slice(0, 4).toUpperCase(), c: '#2563EB' };
}

/* ---------- Dropzone ---------- */
function setupDrop(zone, input, label) {
  const show = () => {
    const f = input.files[0];
    label.innerHTML = f ? `📎 ${esc(f.name)} <small>(${fmtSize(f.size)})</small>` : '';
    if (f && f.size > MAX_FILE) { toast('File melebihi 10 MB, pilih file yang lebih kecil.', 'err'); input.value = ''; label.innerHTML = ''; }
  };
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', show);
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', e => { if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); } });
}

/* ---------- Modal ---------- */
function openModal(id) { $('#' + id).classList.add('show'); }
function closeModal(id) { $('#' + id).classList.remove('show'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('ov')) e.target.classList.remove('show');
  if (e.target.dataset.close) closeModal(e.target.dataset.close);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.ov.show').forEach(o => o.classList.remove('show')); });

/* ---------- Nav + reveal ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const b = $('.burger'); if (b) b.onclick = () => $('.links').classList.toggle('open');
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12 });
  $$('.rv').forEach(el => io.observe(el));
});

function countUp(el, to) {
  let n = 0; const step = Math.max(1, Math.ceil(to / 30));
  const t = setInterval(() => { n += step; if (n >= to) { n = to; clearInterval(t); } el.textContent = n; }, 30);
}




/* ---------- Supabase ---------- */
const CONFIGURED = typeof SUPABASE_URL !== 'undefined' && !/ISI_/.test(SUPABASE_URL + SUPABASE_KEY) && typeof supabase !== 'undefined';
const sb = CONFIGURED ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const BUCKET = 'files';
const must = ({ data, error }) => { if (error) throw error; return data; };
const fail = (e, msg) => { console.error(e); toast(msg || (e && e.message) || 'Terjadi kesalahan', 'err'); };
const go = u => { location.replace(u); return new Promise(() => {}); };
const safeName = n => String(n || 'file').normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80);

async function uploadFile(file, folder) {            // folder: "<class_id>/tasks" dst.
  const path = `${folder}/${uid()}-${safeName(file.name)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return path;
}
async function removeFiles(paths) {
  paths = (paths || []).filter(Boolean);
  if (paths.length) { try { await sb.storage.from(BUCKET).remove(paths); } catch (e) { console.warn(e); } }
}
async function downloadPath(path, name) {
  if (!path) { toast('File tidak tersedia.', 'err'); return; }
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 120, { download: name || true });
  if (error) { fail(error, 'Gagal mengunduh file'); return; }
  const a = document.createElement('a'); a.href = data.signedUrl; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}
function openLink(url) { if (/^https?:\/\//i.test(url || '')) window.open(url, '_blank', 'noopener'); else toast('Tautan tidak valid.', 'err'); }

/* ---------- Sesi, profil, kelas ---------- */
const PAGE = location.pathname.split('/').pop() || 'index.html';
const DASH = ['admin.html', 'dosen.html', 'mahasiswa.html'];   // dashboard per peran
const ADMIN_PAGES = ['admin.html', 'kelola.html'];               // hanya untuk admin
const homeOf = u => u && u.role === 'admin' ? 'admin.html' : (u && u.role === 'dosen' ? 'dosen.html' : 'mahasiswa.html');
const ROLE_LABEL = { admin: 'Admin', dosen: 'Dosen', mahasiswa: 'Mahasiswa' };
let ME = null, CLS = null, CID = null, MY = [], COURSES = [], HOME = 'login.html';
let DOSEN = {};                                                  // id dosen -> nama
const isAdmin = () => !!ME && ME.role === 'admin';
const isDosen = () => !!ME && ME.role === 'dosen';
const classKey = () => 'kh_class_' + (ME ? ME.id : '');
const selectClass = id => localStorage.setItem(classKey(), id);

const Auth = {
  email: u => String(u).trim().toLowerCase() + '@kelashub.app', // login memakai username -> dipetakan ke email
  async logout() { await sb.auth.signOut(); location.href = 'login.html'; }
};

const courseById = id => COURSES.find(c => c.id === id);
const courseColor = id => (courseById(id) || {}).color || '#2563EB';
const courseName = id => (courseById(id) || {}).name || '—';
const dosenName = id => (id && DOSEN[id]) || 'Belum ada pengampu';
// mata kuliah yang diampu dosen yang sedang login (di kelas ini)
const isMine = courseId => !!ME && (courseById(courseId) || {}).dosen_id === ME.id;
const myCourses = () => COURSES.filter(c => c.dosen_id === (ME && ME.id));

// nama dosen untuk daftar id (disimpan di DOSEN)
async function loadDosen(ids) {
  ids = [...new Set((ids || []).filter(Boolean))].filter(id => !(id in DOSEN));
  if (ids.length) must(await sb.from('profiles').select('id,name').in('id', ids)).forEach(p => { DOSEN[p.id] = p.name; });
  return DOSEN;
}
async function loadCourses() {
  COURSES = must(await sb.from('courses').select('*').eq('class_id', CID).order('created_at'));
  await loadDosen(COURSES.map(c => c.dosen_id));
  return COURSES;
}
function courseOptions(sel, list = COURSES) {
  sel.innerHTML = list.length
    ? list.map(c => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join('')
    : '<option value="">— belum ada mata kuliah —</option>';
}
// jumlah mahasiswa & dosen per kelas: { class_id: { mhs, dsn } }
async function loadMemberCounts() {
  const rows = must(await sb.from('class_members').select('class_id, profiles(role)'));
  const out = {};
  rows.forEach(r => {
    const o = out[r.class_id] || (out[r.class_id] = { mhs: 0, dsn: 0 });
    const role = r.profiles && r.profiles.role;
    if (role === 'mahasiswa') o.mhs++; else if (role === 'dosen') o.dsn++;
  });
  return out;
}
// kelas + jumlah anggota/matkul/tugas/materi/pengumpulan (untuk dashboard)
async function loadClassStats() {
  const rows = must(await sb.from('classes').select('*, class_members(count), courses(count), tasks(count), materials(count), submissions(count)').order('created_at'));
  const n = r => (r && r[0] && r[0].count) || 0;
  return rows.map(c => ({ ...c, nMembers: n(c.class_members), nCourses: n(c.courses), nTasks: n(c.tasks), nMats: n(c.materials), nSubs: n(c.submissions) }));
}

const READY = (async () => {
  if (!CONFIGURED) {
    document.body.innerHTML = `<div style="max-width:560px;margin:12vh auto;padding:28px;font-family:system-ui,sans-serif;background:#fff;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.1)">
      <h2>⚙️ Supabase belum dikonfigurasi</h2>
      <p style="margin:12px 0">Buka <code>js/config.js</code>, lalu isi <b>SUPABASE_URL</b> dan <b>SUPABASE_KEY</b> (anon key) dari Supabase &gt; Project Settings &gt; API.</p>
      <p style="color:#666;font-size:.9rem">Jika sudah diisi dan masih muncul, periksa koneksi internet (library Supabase dimuat dari CDN).</p></div>`;
    reveal(); return false;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { if (PAGE !== 'login.html') await go('login.html'); return true; }

  const { data: prof } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!prof) { await sb.auth.signOut(); if (PAGE !== 'login.html') await go('login.html'); return true; }
  ME = { id: prof.id, name: prof.name, username: prof.username, nim: prof.nim || '', role: prof.role };
  HOME = homeOf(ME);

  if (PAGE === 'login.html') await go(HOME);
  if (DASH.includes(PAGE) && PAGE !== HOME) await go(HOME);
  if (isAdmin() !== ADMIN_PAGES.includes(PAGE)) await go(HOME); // admin hanya di halaman admin, selain admin sebaliknya

  if (!DASH.includes(PAGE) && !ADMIN_PAGES.includes(PAGE)) { // halaman di dalam kelas
    MY = must(await sb.from('classes').select('*').order('created_at'));
    CLS = MY.find(c => c.id === localStorage.getItem(classKey())) || (MY.length === 1 ? MY[0] : null);
    if (!CLS) await go(HOME);
    CID = CLS.id; selectClass(CID);
    await loadCourses();
  }
  buildNav();
  return true;
})().catch(e => { console.error(e); reveal(); toast('Gagal memuat: ' + (e.message || e), 'err'); return false; });

// jalankan fungsi halaman setelah sesi siap
function boot(fn) {
  return READY.then(async ok => {
    if (!ok) return;
    try { await fn(); } catch (e) { fail(e); }
    reveal();
  });
}

/* ---------- Navbar dinamis ---------- */
function buildNav() {
  const logo = $('.nav .logo'); if (logo) logo.href = HOME;
  const links = $('.links'); if (!links || !ME) return;
  const inDash = DASH.includes(PAGE);
  const items = (CID && !inDash) ? [['index.html', 'Beranda Kelas'], ['tugas.html', '📝 Tugas'], ['materi.html', '📚 Materi'], ['matakuliah.html', '🎓 Mata Kuliah']] : [];
  const dashLabel = isAdmin() ? '🛡️ Dashboard Admin' : (isDosen() ? '🏫 Dashboard Dosen' : '🎒 Dashboard');
  links.innerHTML = items.map(([h, t]) => `<a href="${h}" class="${PAGE === h ? 'on' : ''}">${t}</a>`).join('') +
    `<a href="${HOME}" class="cls ${inDash ? 'on' : ''}" title="Kembali ke dashboard">${inDash || !CLS ? dashLabel : '← ' + esc(CLS.name)}</a>` +
    `<span class="uchip"><i>${esc(ME.name.trim()[0].toUpperCase())}</i><span>${esc(ME.name)}<small>${ROLE_LABEL[ME.role] || ''}${ME.nim ? ' · ' + (isDosen() ? 'NIDN ' : 'NIM ') + esc(ME.nim) : ''}</small></span></span>` +
    `<button class="btn red sm" id="btnOut">Keluar</button>`;
  $('#btnOut').onclick = () => { if (confirm('Keluar dari akun?')) Auth.logout(); };
  const tag = $('.phead .tag'); if (tag && CLS && !inDash) tag.textContent += ' · ' + CLS.name;
}
