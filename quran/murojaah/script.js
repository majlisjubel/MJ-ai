document.addEventListener('DOMContentLoaded', () => {
  const btnToggleHide = document.getElementById('btnToggleHide');
  const quranContainer = document.getElementById('quranContainer');
  const surahTitle = document.querySelector('.surah-info h2');
  const surahMeta = document.querySelector('.surah-meta');
  const liveText = document.getElementById('liveText');

  // 1. Ambil nomor surah dari parameter URL (Default: Surah 1 / Al-Fatihah)
  const urlParams = new URLSearchParams(window.location.search);
  const surahId = urlParams.get('surah') || 1;

  // 2. Fungsi Load Data Surah (Menggunakan API standar quran/equran dengan mekanisme Caching)
  async function loadSurahData(id) {
    liveText.textContent = `Memuat data Surah ${id}...`;
    
    // Cek apakah data sudah ada di localStorage biar offline-first & ngebut
    const cachedData = localStorage.getItem(`murojaah_surah_${id}`);
    if (cachedData) {
      const data = JSON.parse(cachedData);
      renderSurah(data);
      return;
    }

    try {
      // Mengambil data dari API publik terpercaya (standar data bersih)
      const response = await이고 `https://equran.id/api/v2/surah/${id}`;
      // Fallback atau fetch langsung: kita pakai endpoint equran.id v2 yang stabil
      const res = await fetch(`https://equran.id/api/v2/surah/${id}`);
      const json = await res.json();

      if (json.code === 200) {
        const surahData = json.data;
        // Simpan ke localStorage untuk akses offline berikutnya
        localStorage.setItem(`murojaah_surah_${id}`, JSON.stringify(surahData));
        renderSurah(surahData);
      } else {
        liveText.textContent = 'Gagal memuat data surah.';
      }
    } catch (error) {
      console.error('Error fetching surah:', error);
      liveText.textContent = 'Terjadi kesalahan jaringan. Cek koneksi Anda.';
    }
  }

  // 3. Render Teks ke UI
  function renderSurah(data) {
    surahTitle.textContent = data.namaLatin;
    surahMeta.textContent = `Ayat 1 - ${data.jumlahAyat} • ${data.tempatTurun}`;
    
    quranContainer.innerHTML = ''; // Bersihkan kontainer

    data.ayat.forEach((item) => {
      const verseItem = document.createElement('div');
      verseItem.className = 'verse-item';
      verseItem.setAttribute('data-verse', item.nomorAyat);

      verseItem.innerHTML = `
        <span class="verse-arabic">${item.teksArab}</span>
        <span class="verse-number">(${item.nomorAyat})</span>
      `;
      quranContainer.appendChild(verseItem);
    });

    liveText.textContent = 'Tekan tombol mikrofon di bawah lalu mulailah membaca...';
  }

  // Toggle Sembunyikan Teks Arab Total (Mode Hafalan)
  btnToggleHide.addEventListener('click', () => {
    quranContainer.classList.toggle('text-hidden');
    if (quranContainer.classList.contains('text-hidden')) {
      btnToggleHide.textContent = '🙈';
    } else {
      btnToggleHide.textContent = '👁️';
    }
  });

  // Eksekusi pemuatan data saat halaman dibuka
  loadSurahData(surahId);
});
