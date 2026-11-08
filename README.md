# KelasHub (Supabase)

## Konsep
- **Admin** satu-satunya yang membuat **kelas** & **mata kuliah**, dan menunjuk **dosen pengampu** tiap mata kuliah.
- Admin membagikan **kode kelas** ke mahasiswa dan dosen. Setiap kelas hanya ada satu (nama unik), jadi tidak ada lagi kelas kembar.
- **Dosen** hanya mengirim tugas/materi dan melihat pengumpulan di mata kuliah yang ia ampu.
- **Mahasiswa** gabung dengan kode, mengumpulkan tugas, dan berbagi materi.

## 1. Siapkan database
1. Buat project di https://supabase.com
2. Buka **SQL Editor**, jalankan **berurutan**:
   1. `supabase/migrations/20261108120000_kelashub_init.sql`
   2. `supabase/migrations/20261109090000_admin_manages_classes.sql`

   (Jika repo GitHub sudah terhubung lewat GitHub integration, kedua file otomatis dijalankan berurutan saat di-push. Jika database lama sudah menjalankan file pertama, cukup jalankan yang kedua — data lama dipertahankan.)
3. **Authentication → Providers → Email**: matikan **Confirm email** (login memakai username, bukan email sungguhan).

## 2. Buat akun Admin pertama
Admin tidak bisa dipilih saat mendaftar. Daftar dulu seperti biasa (misal sebagai mahasiswa) lewat `login.html`, lalu di **SQL Editor** jalankan:

```sql
update public.profiles set role = 'admin' where username = 'username_kamu';
```

Keluar lalu masuk lagi — kamu akan diarahkan ke **Dashboard Admin**.

## 3. Alur pemakaian
1. **Admin**: buat kelas (kode otomatis) → klik **Kelola** → tambah mata kuliah & pilih dosen pengampu.
2. **Admin**: bagikan kode kelas ke mahasiswa dan dosen.
3. **Dosen & mahasiswa**: masukkan kode di dashboard masing-masing (**Gabung dengan Kode**).
4. Dosen mengirim tugas di mata kuliahnya, mahasiswa mengumpulkan.

## 4. Hubungkan website
Isi `js/config.js` dengan **Project URL** dan **anon / publishable key** (Project Settings → API).
Jangan pernah memasukkan `service_role` key.

## 5. Jalankan
Buka `login.html` (atau `python -m http.server 8000`, lalu http://localhost:8000/login.html).
Untuk online: unggah folder ini ke Netlify / GitHub Pages / Vercel.

## 6. Foto & ilustrasi (folder `img/`)
| File | Dipakai di |
|---|---|
| 00-login-perpus.jpg | Login (kiri, overlay biru 30%) |
| 01-register-dadah.jpg | Daftar (kiri, tab Daftar di login.html) |
| 02-banner-selamat-datang.jpg | Dashboard Mahasiswa, banner atas |
| 03-empty-tidak-ada-tugas.jpg | Dashboard Mahasiswa, hanya saat tidak ada tugas |
| 04-dashboard-dosen.jpg | Dashboard Dosen, hanya saat belum ada pengumpulan |
| 05-deadline.jpg | Dashboard Mahasiswa, card Deadline Terdekat |
| 06-belajar-bareng.jpg | Dashboard Mahasiswa, header card Kelas Saya |
| 07-sukses-ngumpulin.jpg | Pop-up setelah berhasil mengumpulkan tugas |
| 08-foto-dosen-ngajar.jpg | landing.html, bagian Untuk Dosen |
| 09-foto-presentasi.jpg | landing.html, bagian Untuk Mahasiswa |
