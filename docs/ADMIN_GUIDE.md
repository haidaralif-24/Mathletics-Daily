# Panduan admin (satu halaman)

Untuk guru/admin klub. Aplikasi berbahasa Indonesia; panduan ini sengaja singkat.

Menu admin: **Dasbor · Soal · Koreksi · Member**.

## Rutinitas harian (5 menit)
1. Buka **Dasbor**. Kalau ada peringatan *"Belum ada soal untuk besok"*, buat soalnya sekarang.
2. Setelah soal kemarin ditutup, buka **Koreksi** dan nilai kiriman yang masuk.
3. Kalau muncul tanda **Perlu dinilai ulang**, ada anggota yang mengubah langkah pengerjaannya setelah dinilai. Periksa dan simpan ulang nilainya.

## Menambah soal
1. **Soal → tombol "Soal baru"**. Pilih tanggal rilis. Soal otomatis terbit pukul **04.00 WIB** dan ditutup **24 jam** kemudian. Tidak ada tombol buka/tutup.
2. Tulis soal. Toolbar menyisipkan pecahan, akar, pangkat, sigma, dan huruf Yunani. Pratinjau di bawahnya langsung memperbarui.
3. Isi **kunci jawaban** (jawaban yang diterima, boleh lebih dari satu) dan **mark scheme** (kriteria, total maksimal 5).
4. Opsional: gambar, topik, tingkat kesulitan.

**Penting:** kalau kamu menyimpan soal tanpa kunci atau tanpa mark scheme, soal itu tetap **menempati tanggalnya dan akan tetap terbit**. Simpan sebagai draf hanya kalau kamu akan segera melengkapinya. Daftar soal menandai draf dengan warna merah.

Kalau KaTeX tidak bisa membaca rumusmu, penyimpanan diblokir dan bagian yang salah ditandai. Perbaiki dulu.

## Menilai (Koreksi)
1. Pilih soal di panel kiri. Daftar memuat **semua anggota aktif**, dengan status Belum kirim / Belum dinilai / Sudah dinilai. Bisa disaring dan diurutkan menurut waktu kirim.
2. Kolom kanan menampilkan jawaban akhir, langkah pengerjaan, foto (bisa di-zoom dan diputar), waktu kirim, jarak dari waktu terbit, **kunci jawaban dan mark scheme pada layar yang sama**.
3. **Tebakan otomatis sudah terisi** (Benar/Salah). Periksa dan ubah kalau perlu. Tebakan bertanda *perlu ditinjau* sengaja tidak diisi — jawaban yang tidak bisa dibaca otomatis tidak pernah dianggap salah.
4. Centang kriteria mark scheme, tulis catatan pribadi, lalu simpan. Total poin terlihat sebelum kamu menyimpan.
5. Pintasan keyboard: **C** = benar, **X** = salah, **Enter** = simpan lalu lanjut ke kiriman belum dinilai berikutnya. Pintasan tidak aktif saat kamu sedang menulis catatan.
6. Kalau dua admin menyimpan kiriman yang sama, **yang terakhir menyimpan menang**, dan layar menampilkan siapa yang terakhir menilai.

Catatan pribadi **hanya** terlihat oleh admin. Anggota tidak pernah melihat jawaban, foto, atau catatan anggota lain.

## Cara poin dihitung
Maksimum **20** per soal.

| Bagian | Aturan |
| --- | --- |
| Dasar | 10 kalau jawaban akhir benar, kalau tidak 0 |
| Kecepatan | Hanya kalau benar: `5 × (1 − waktu_selesai / 24 jam)`, 1 desimal, minimum 0 |
| Langkah | Jumlah kriteria mark scheme yang dicentang, 0–5. **Tetap dihitung walau jawaban akhirnya salah** |

Waktu kecepatan dihitung dari kiriman **pertama**. Jawaban akhir terkunci setelah kiriman pertama, jadi tidak bisa diakali dengan mengirim jawaban kosong lebih dulu.

Papan peringkat diperbarui setelah soal dinilai, bukan saat dikirim. Admin tidak pernah muncul di papan peringkat.

## Mengelola anggota (Member)
- **Impor CSV**: kolom `email, nama, kelas`. Baris yang salah atau email kembar **dilewati dan dilaporkan**, baris lain tetap masuk. Kata sandi sementara muncul **sekali** — unduh dan bagikan saat itu juga.
- **Reset kata sandi**: kata sandi sementara baru muncul sekali. Anggota wajib menggantinya saat login berikutnya.
- **Ubah nama dan kelas**: hanya admin. Anggota tidak bisa mengubahnya sendiri.
- **Nonaktifkan**: anggota tidak bisa login maupun mengirim, dan hilang dari papan peringkat. Datanya tetap tersimpan. Bisa diaktifkan kembali.
- **Jadikan admin**: berhati-hatilah, admin bisa melihat semua kunci jawaban.

Setiap anggota memakai kata sandi sementara sekali pakai dan wajib menggantinya saat login pertama.

## Kalau kunci jawaban ternyata salah
Tebakan otomatis dihitung **sekali**, saat kiriman masuk, lalu disimpan. Jadi memperbaiki kunci belakangan tidak otomatis memperbarui tebakan yang sudah tersimpan.

1. Buka **Soal**, perbaiki kuncinya, simpan.
2. Di halaman soal yang sama, tekan **"Hitung ulang tebakan otomatis"**.
3. Buka **Koreksi**. Kiriman yang tebakannya berubah sekarang bertanda **perlu dinilai ulang**. Periksa dan simpan ulang nilainya.

Poin tidak pernah berubah sendiri — hanya kamu yang mengubahnya saat menyimpan nilai. Ini disengaja: anggota sudah menerima nilainya, jadi perubahan harus lewat keputusan admin.

## Kalau ada masalah
| Gejala | Yang dilakukan |
| --- | --- |
| Anggota tidak bisa masuk | Cek statusnya di Member. Kalau aktif, reset kata sandinya |
| Soal tidak muncul | Cek tanggal rilisnya. Soal terbit 04.00 WIB, jadi soal hari ini belum ada sebelum jam 4 pagi |
| Anggota bilang jawabannya terkunci padahal salah ketik | Jawaban akhir memang tidak bisa diubah setelah kiriman pertama. Ini aturan, bukan bug. Nilai saja seadanya dan beri catatan |
| Foto gagal diunggah | Minta anggota coba lagi dengan koneksi lebih baik. Berkas yang gagal tidak menyimpan kiriman setengah jadi |
| Poin di papan peringkat terasa salah | Buka kirimannya di Koreksi dan simpan ulang nilainya. Total dihitung ulang otomatis |
| Kunci jawaban salah | Perbaiki kuncinya di **Soal**, simpan, lalu tekan **"Hitung ulang tebakan otomatis"** di halaman soal itu. Tebakan Benar/Salah dihitung ulang, dan nilai yang terpengaruh ditandai **perlu dinilai ulang**. Poin **tidak** berubah sendiri — kamu tetap harus membuka Koreksi dan menyimpan ulang nilainya |

## Belum ada di versi ini
Jangan dicari dulu; ini rencana berikutnya:
- Hitungan hari menuju OSN di header
- Editor pembahasan/penyelesaian soal
- Tab papan peringkat "Minggu Ini"
- Riwayat pengerjaan milik anggota
- Ekspor CSV papan peringkat dan hasil per soal
- Arsip soal yang sudah ditutup

## Yang tidak boleh diubah
Di dashboard Supabase, **"Allow new users to sign up" harus tetap mati**. Kalau dinyalakan, siapa pun yang punya alamat web bisa membuat akun sendiri tanpa izin.
