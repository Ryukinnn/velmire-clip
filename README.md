# ⚡ Velmire Auto-Clip AI — Mobile App & Engine

Aplikasi mobile untuk memotong (auto-clip) video YouTube secara otomatis menjadi format **Shorts/Reels (9:16)**, **Landscape (16:9)**, atau **Square (1:1)** dengan subtitle otomatis & kustomisasi waktu persis seperti pada sampel `VID-20260725-WA0009.mp4`.

---

## 📱 Fitur Utama

1. **Auto Clip & Crop 9:16**: Otomatis memotong rentang waktu video YouTube (menit:detik) dan mengonversinya ke format vertikal Shorts/Reels/TikTok.
2. **Subtitles & Captions AI**: Menambahkan hamparan teks subtitle animasi yang jelas dan mudah dibaca di layar HP.
3. **Real-time Queue Status**: Menampilkan status antrian dan progress bar real-time (`mengirim ke backend`, `downloading`, `clipping`, `rendering (85%)`, `selesai`).
4. **Dua Mode Server**:
   - **Lokal**: Menjalankan backend server di PC/Laptop (`http://localhost:3000` / `http://IP_LOKAL:3000`).
   - **Google Colab (GPU)**: Memproses klip gratis menggunakan GPU Colab via URL Ngrok (menggunakan file `colab_backend.ipynb`).
5. **Aplikasi Native APK**: Dapat diinstall langsung di Smartphone Android!

---

## 🛠️ Cara Menjalankan Server Backend

1. Buka terminal di folder ini dan jalankan:
   ```bash
   node server.js
   ```
2. Server akan aktif di `http://localhost:3000`.

---

## 📦 Menginstall & Menggunakan APK di Smartphone Android

1. Transfer file **`Velmire_Clip.apk`** yang sudah digenerate di folder:
   `android/app/build/outputs/apk/debug/app-debug.apk` ke Smartphone Android Anda.
2. Install file APK di HP Android Anda.
3. Buka aplikasi **Velmire Clip** di HP Anda.
4. Masukkan link YouTube, atur menit & detik, lalu tekan **Buat klip**.

---

## ☁️ Menjalankan Backend Gratis di Google Colab (Opsional)

Jika ingin memproses klip secara cepat tanpa beban komputer:
1. Upload file `colab_backend.ipynb` ke Google Colab (`colab.research.google.com`).
2. Jalankan semua sel di Colab.
3. Salin URL Ngrok yang dihasilkan (contoh: `https://xxxx.ngrok-free.dev`).
4. Buka ikon ⚙️ (Pengaturan) di aplikasi Velmire Clip pada HP, lalu tempelkan URL Ngrok tersebut.
