# Dota Relay

Utilitas browser untuk menyalin hotkey, opsi permainan, dan hero grid Dota 2 di antara dua akun Steam pada satu PC. Antarmuka menggunakan bahasa Indonesia.

## Penggunaan

1. Buka Dota 2 sekali di kedua akun. Keluar, tunggu Steam Cloud selesai sinkron, lalu tutup Steam.
2. Buka situs di Chrome atau Edge desktop. Pilih direktori Steam atau `userdata`. Jika direktori Steam dipilih, nama tampilan dibaca dari `config/loginusers.vdf`. Jika hanya `userdata` yang dipilih, akun ditampilkan dengan Friend ID.
3. Pilih akun asal, akun tujuan, dan jenis pengaturan. Tinjau nama file, lalu klik **Salin pengaturan** dan izinkan akses tulis.
4. Cek hasil di Dota 2 pada akun tujuan. Bila Steam menampilkan konflik, pilih salinan lokal yang baru dibuat.

File sumber berasal dari `userdata/<Friend ID>/570/remote`. Daftar file dibatasi ke `user_keys.vcfg`, `cfg/dotakeys_personal.lst`, `user_convars.vcfg`, dan `cfg/hero_grid_config.json`. File yang identik dilewati. Salinan diperiksa menggunakan SHA-256. Cadangan file yang ditimpa dan manifest disimpan di direktori `570/relay-backup-…` akun tujuan. Untuk pemulihan manual, tutup Steam, salin file cadangan ke lokasi relatif yang sama di `remote`, dan hapus file tujuan yang nilai `previous`-nya `null` dalam manifest jika ingin kembali ke kondisi awal.

Seluruh pemrosesan berkas terjadi di browser. Situs menyimpan referensi folder di IndexedDB agar pengguna dapat menghubungkan ulang. Izin dikelola oleh browser.

## Menjalankan lokal

Dari akar repositori, jalankan `python -m http.server 5700 --bind 127.0.0.1 --directory dist`, lalu buka http://127.0.0.1:5700. Direktori `dist` juga bisa di-host sebagai situs statis melalui HTTPS. Aplikasi tidak membutuhkan build atau paket runtime.

## Lisensi dan kredit

Kode dan ilustrasi orisinal Dota Relay tersedia dengan [lisensi MIT](LICENSE). Ilustrasi peta dibuat secara prosedural di Canvas. Aplikasi menggunakan API bawaan browser dan font yang tersedia di perangkat. Distribusi ini tidak menyertakan pustaka, font, atau aset game pihak ketiga.

Dota 2 dan Steam adalah merek milik Valve Corporation. Dota Relay adalah proyek komunitas independen.

Referensi teknis: [File System Access API oleh Chrome Developers](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) dan [panduan Steam Cloud oleh Valve](https://help.steampowered.com/en/faqs/view/68D2-35AB-09A9-7678).
