# Menjalankan RestoServe di PC

Versi ini menjalankan server dan database D1 **lokal di PC**, bukan membuka file HTML langsung. Setelah penyiapan pertama selesai, aplikasi dapat dipakai tanpa internet. Data lokal ini terpisah dari data pada situs online.

## Windows

1. Pasang Node.js 24 LTS.
2. Ekstrak seluruh isi ZIP RestoServe ke sebuah folder di PC.
3. Saat internet tersedia untuk penyiapan pertama, klik dua kali `start-restoserve.bat`. Script akan memasang kebutuhan aplikasi dan menyiapkan database lokal.
4. Setelah terminal menampilkan alamat lokal, buka `http://localhost:8787` di browser.
5. Biarkan jendela terminal terbuka saat memakai aplikasi. Tekan `Ctrl+C` untuk menghentikan server.

## macOS atau Linux

1. Pasang Node.js 24 LTS.
2. Ekstrak ZIP ke sebuah folder. Dari folder itu, jalankan `sh start-restoserve.sh` saat internet tersedia untuk penyiapan pertama.
3. Buka `http://localhost:8787` di browser setelah alamat lokal muncul. Biarkan terminal terbuka selama aplikasi digunakan; tekan `Ctrl+C` untuk berhenti.

Internet hanya diperlukan sekali untuk memasang kebutuhan aplikasi. Setelah itu, server dan database berjalan pada komputer sendiri. Database tersimpan di folder `.wrangler` dalam folder proyek. Gunakan folder proyek yang sama setiap kali agar data lokal tetap tersedia. Pesanan lokal tidak tersinkron dengan situs online atau komputer lain.
