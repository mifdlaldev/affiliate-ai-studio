# USER_GUIDE.md — User Guide

> Panduan lengkap menggunakan AffiliateAI Studio. Untuk user akhir.

## 🚀 Getting Started

### 1. Buat Akun

1. Buka [https://affiliateai.id](https://affiliateai.id) (atau domain yang ditentukan)
2. Klik **"Daftar"** di kanan atas
3. Pilih metode daftar:
   - **Magic Link** — Masukkan email, klik link di email Anda
   - **Google** — Login dengan akun Google
4. Selesai! Anda akan masuk ke dashboard

### 2. Onboarding (First Time)

Saat pertama kali masuk, Anda akan melihat **welcome modal 3 langkah**:

1. **Selamat Datang** — Intro aplikasi dan fitur utama
2. **Coba Data Contoh** — Pilih untuk auto-load sample data (2 produk, 4 proyek)
3. **Mulai** — Mulai gunakan aplikasi

Anda bisa skip onboarding dan langsung mulai dari kosong.

### 3. Dashboard Overview

Setelah login, Anda akan melihat:
- **Sidebar kiri** — Menu navigasi (13 modul utama)
- **Top bar** — Search, notifications, user menu
- **Content area** — Modul yang sedang aktif

## 📦 Product Studio

Modul untuk menyimpan detail produk yang akan jadi basis AI generation.

### Cara Pakai:

1. **Klik "Product Studio"** di sidebar
2. **Step 1: Upload Foto**
   - Klik area upload atau drag & drop foto produk
   - Supported: PNG, JPG, WEBP (max 5MB)
3. **Step 1b: Link Referensi (Opsional)**
   - Masukkan link produk (Shopee/TikTok/Tokopedia) untuk analisis lebih akurat
4. **Step 2: Preview** — Lihat foto yang diupload
5. **Step 3: Auto-Analyze**
   - Klik **"Jalankan Auto-Analisis"**
   - AI akan menganalisis foto + link, lalu mengisi form secara otomatis
   - Estimasi: 5-10 detik
6. **Step 4: Review & Edit Detail**
   - Cek hasil AI: nama, kategori, brand, harga, target, USP, benefits
   - Edit jika ada yang kurang tepat
7. **Klik "Simpan Data"** — Produk tersimpan di Asset Library

### Form Fields:
- **Nama Produk** (required)
- **Kategori** — Kecantikan, Fashion, etc.
- **Brand / Merek**
- **Harga** — Free text (bisa "Rp 150.000" atau "Rp 100rb-200rb")
- **Target Pasar** — Contoh: "Remaja wanita 18-24 tahun"
- **USP (Unique Selling Point)** — Apa yang membedakan produk
- **Benefits** — 3-5 manfaat langsung

## 🎨 AI Photo Prompt Generator

Modul untuk generate prompt detail untuk image generation (ChatGPT, Midjourney, DALL-E).

### Cara Pakai:

1. **Klik "AI Generator" → "Photo Generator"** di sidebar
2. **Pilih Produk** dari dropdown (produk yang sudah disimpan)
3. **Atur parameter**:
   - **Style** — Luxury, Casual, Minimalist, Vintage, Modern, dll
   - **Lighting** — Studio, Natural, Dramatic, Soft, dll
   - **Camera** — DSLR 85mm, iPhone, Film, Wide Angle, dll
   - **Aspect Ratio** — 9:16 (TikTok), 1:1 (IG), 16:9 (YouTube), 4:5 (IG Portrait)
   - **Background** — Custom description
4. **Klik "Generate"** (5-10 detik)
5. **Hasil**:
   - 1 prompt utama (detail, bahasa Inggris)
   - 3 variasi alternatif
6. **Cara Pakai Hasil**:
   - Klik **"Copy"** untuk copy prompt
   - Buka [ChatGPT](https://chatgpt.com) di tab baru
   - Paste prompt, gunakan model GPT Image / DALL-E
   - Generate, download hasilnya
   - Kembali ke AffiliateAI, upload ke Asset Library

## 🎭 AI Model Prompt Generator

Modul untuk generate model AI (orang) untuk product photography.

### Cara Pakai:

1. **Klik "AI Generator" → "Model Generator"**
2. **Pilih Preset**:
   - **Hijab Model** — Wanita berhijab modern
   - **Beauty Influencer** — Wanita makeup flawless
   - **Professional Woman** — Blazer, kerja
   - **Casual Lifestyle** — Santai, pria/wanita
   - **Luxury Fashion** — Gaun desainer
3. **Atur Detail**:
   - Gender, Age, Ethnicity (default Asia Indonesia)
   - Fashion description
   - Expression
4. **Klik "Generate"**
5. **Hasil**:
   - Character description lengkap
   - Image prompt detail
6. **Copy → Generate di ChatGPT → Upload hasil**

## 🎬 UGC Generator

Modul dengan 4 sub-tab untuk membuat konten UGC (User-Generated Content).

### Tab: Hooks

1. **Pilih produk** + masukkan USP + target audience
2. **Generate** → 10 hooks berbeda (viral, FOMO, curiosity, dll)
3. **Copy hooks** yang paling menarik

### Tab: Script

1. **Pilih produk** + USP + target + duration (15s/30s/60s)
2. **Generate** → Full script dengan scenes + voiceover notes
3. **Edit sesuai gaya** Anda, lalu rekam video

### Tab: Storyboard

1. **Input sama** seperti script
2. **Generate** → Scene-by-scene visual + narasi
3. **Berguna untuk bagi task** ke videografer / editor

### Tab: Prompt (AI Video & Voice)

1. **Input sama** seperti script
2. **Generate** → Prompts untuk AI video generator (Runway, Pika) + voice
3. **Copy** prompt ke tools external

## 📅 Content Calendar

Generate 30-day content plan sekaligus.

### Cara Pakai:

1. **Klik "AI Generator" → "Kalender"**
2. **Input**:
   - Pilih produk
   - Platform (TikTok, Instagram, All)
   - Duration (default 30 hari)
3. **Klik "Generate Calendar"** (estimasi 30-60 detik, **streaming real-time**)
4. **Hasil**: Tabel 30 hari dengan:
   - Day (tanggal)
   - Theme (topik konten)
   - Format (video, image, carousel, story)
   - Hook (kalimat pembuka)
   - CTA (call to action)
   - Hashtags
5. **Save** ke Asset Library atau **Export** ke CSV/Excel

## 🛍 Marketplace Content

Generate deskripsi produk untuk Shopee & TikTok Shop.

### Cara Pakai:

1. **Klik "Marketplace"** di sidebar
2. **Pilih platform**: Shopee atau TikTok Shop
3. **Pilih produk** dari dropdown
4. **Tambah USP** (jika ada, opsional)
5. **Klik "Generate Konten"**
6. **Hasil**:
   - **Title** (SEO-optimized, max 100 char)
   - **Bullets** (5 poin keunggulan)
   - **Description** (full deskripsi)
   - **Tags/Keywords** (untuk search optimization)
7. **Copy per field** atau copy all

## 📱 Social Media Content

Generate caption + hashtags untuk TikTok/Instagram.

### Cara Pakai:

1. **Klik "Social Media"**
2. **Pilih platform**: TikTok atau Instagram
3. **Pilih produk** + USP
4. **Klik "Generate Post"**
5. **Hasil**:
   - Caption (engaging, max 2200 char)
   - Hashtags (15-20 relevan)
   - Emoji suggestions
   - Posting time suggestion
6. **Copy** → Paste ke TikTok/IG

## 🌍 Landing Page Generator

Generate copywriting AIDA (Attention-Interest-Desire-Action) untuk landing page.

### Cara Pakai:

1. **Klik "Landing Page"**
2. **Pilih produk** + USP + target audience
3. **Klik "Menyusun AIDA"**
4. **Hasil**:
   - **Headline** (Attention)
   - **Subheadline** (Interest)
   - **Features** (Desire)
   - **Social Proof** (Desire)
   - **CTA** (Action)
5. **Copy** → Buat landing page di Carrd, Framer, dll

## 🎙 Live Host AI

Generate script untuk live streaming (TikTok Live, Shopee Live).

### Cara Pakai:

1. **Klik "Live Host"**
2. **Pilih produk** + USP
3. **Pilih host type**: Beauty Expert, Tech Reviewer, dll
4. **Klik "Generate Script"**
5. **Hasil**:
   - **Opening** (sapa penonton, perkenalan produk)
   - **Product Intro** (highlight USP)
   - **Demo** (cara pakai, test)
   - **Q&A Prompts** (jawaban untuk pertanyaan umum)
   - **Closing CTA** (urgency, close deal)
6. **Latihan script** → Live streaming

## 🏆 Competitor Analyzer (PRO)

Analisis kompetitor dari TikTok + Shopee.

### Cara Pakai:

1. **Klik "AI Generator" → "Kompetitor"**
2. **Input**:
   - Link TikTok kompetitor
   - Link Shopee kompetitor
3. **Klik "Analyze"** (30-60 detik)
4. **Hasil**:
   - **Strengths** (kekuatan kompetitor)
   - **Weaknesses** (kelemahan)
   - **Opportunities** (peluang untuk Anda)
   - **Content Gaps** (konten yang belum dibuat kompetitor)
   - **Recommended Strategy** (strategi yang disarankan)
5. **Save** → reference untuk content strategy

## ⚡ Batch Generator (PRO)

Generate 4 jenis content sekaligus (hook + script + storyboard + prompt).

### Cara Pakai:

1. **Klik "AI Generator" → "Batch"**
2. **Pilih produk**
3. **Pilih output** (checklist): Hook, Script, Storyboard, Prompt
4. **Pilih platform** (TikTok, IG, All)
5. **Klik "Generate All"** (30-60 detik, 1 request)
6. **Hasil**: Semua 4 jenis content untuk 1 produk
7. **Hemat token** vs generate satu-satu

## 🗂 Asset Library

Semua generated content dan uploaded files tersimpan di sini.

### Cara Pakai:

1. **Klik "Assets"** di sidebar
2. **Filter by category**: Semua / Foto / Video / Teks / Dokumen
3. **Search** by name atau content
4. **View mode**: Grid atau List
5. **Per asset**:
   - **View** — Lihat detail
   - **Copy** — Copy content (untuk teks)
   - **Download** — Download file
   - **Delete** — Hapus

## 📁 Project Management

Organize projects untuk campaign, review, unboxing, dll.

### Cara Pakai:

1. **Klik "Projects"** di sidebar
2. **Lihat tabel projects**:
   - Nama, Tanggal, Jumlah Aset, Status (Aktif/Diarsipkan)
3. **Buat Project Baru**:
   - Klik **"+ Proyek Baru"**
   - Masukkan nama
   - Submit
4. **Aksi per project** (hover row):
   - **Edit** — Rename
   - **Duplicate** — Copy project + assets
   - **Archive/Unarchive** — Pindah ke arsip
   - **Delete** — Hapus permanen

## 📤 Export Center

Export generated content ke 5 format.

### Cara Pakai:

1. **Klik "Export"** di sidebar
2. **Pilih items** yang akan di-export (dari Asset Library)
3. **Pilih format**:
   - **PDF** — Siap cetak
   - **DOCX** — Bisa diedit di Word
   - **TXT** — Plain text
   - **JSON** — Structured data
   - **CSV** — Bisa dibuka di Excel
4. **Klik "Export"**
5. **Toast**: "Mengekspor... selesai!"
6. **File terdownload** ke device Anda

## ⚙️ Settings

1. **Klik avatar Anda** di top-right
2. **Pilih "Settings"**
3. **Edit**:
   - Full name
   - Avatar
   - Email preferences
4. **Save**

## 💡 Tips & Best Practices

### Hemat Token:
- Gunakan **Batch Generator** untuk generate 4 sekaligus (lebih hemat)
- **Cached** request tidak makan token (1 jam)
- **Soft limit**: 50 generate/bulan (reset tiap bulan)

### Kualitas Output:
- **Isi form dengan detail** — USP, target yang spesifik = output lebih baik
- **Ganti preset** jika hasil kurang sesuai
- **Iterasi** — generate berkali-kali sampai dapat yang pas

### Workflow Optimal:
1. **Save product** dulu di Product Studio
2. **Generate photo prompt** → copy → generate di ChatGPT → upload
3. **Generate hooks/script** → rekam video
4. **Generate marketplace/social caption** → posting
5. **Save all** ke Asset Library
6. **Export** untuk dokumentasi

## ❓ FAQ

**Q: Berapa lama AI generation?**
A: 5-60 detik tergantung kompleksitas. Content Calendar bisa 30-60 detik (streaming).

**Q: Apakah hasil AI langsung jadi?**
A: Hasil AI adalah **draft**. Anda perlu review, edit, dan polish sesuai brand voice Anda.

**Q: Bagaimana cara dapat image?**
A: AI di AffiliateAI hanya generate **prompt**. Copy prompt → buka ChatGPT → gunakan GPT Image model → generate → upload balik ke Asset Library.

**Q: Berapa kali saya bisa generate per bulan?**
A: **50 generate/bulan** per user (soft limit). Reset otomatis tiap awal bulan.

**Q: Apakah data saya aman?**
A: Ya. RLS enabled, user hanya bisa akses data sendiri. Auth via Supabase (industry-standard).

**Q: Bisa collab dengan tim?**
A: Saat ini **solo only** (1 user = 1 workspace). Fitur tim akan datang di update berikutnya.

**Q: Bisa diakses di mobile?**
A: **Ya, responsive** di semua device (mobile, tablet, desktop). Sidebar jadi drawer di mobile.

**Q: Bagaimana kalau AI error?**
A: Otomatis retry 3x. Kalau masih gagal, tampilkan error message + tombol "Coba Lagi". Lapor ke support jika persistent.

---

Butuh bantuan lebih? Lihat [ARCHITECTURE.md](ARCHITECTURE.md) atau hubungi support.
