document.addEventListener('DOMContentLoaded', () => {
  const btnToggleHide = document.getElementById('btnToggleHide');
  const quranContainer = document.getElementById('quranContainer');
  const surahTitle = document.querySelector('.surah-info h2');
  const surahMeta = document.querySelector('.surah-meta');
  const liveText = document.getElementById('liveText');

  // 1. Ambil nomor surah dari parameter URL (Default: Surah 1 / Al-Fatihah)
  const urlParams = new URLSearchParams(window.location.search);
  const surahId = urlParams.get('surah') || 1;

  // 2. Fungsi Load Data Surah menggunakan Quran.com API v4
  async function loadSurahData(id) {
    liveText.textContent = `Memuat data Surah ${id} dari Quran.com...`;
    
    // Cek cache lokal biar offline-first & instan
    const cachedData = localStorage.getItem(`quran_com_surah_${id}`);
    if (cachedData) {
      const data = JSON.parse(cachedData);
      renderSurah(data);
      return;
    }

    try {
      // Endpoint publik Quran.com v4 untuk teks Uthmani dan terjemahan
      const res = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${id}`);
      const json = await res.json();

      // Kita fetch juga informasi detail surahnya (nama latin, jumlah ayat, dll)
      const chapterRes = await fetch(`https://api.quran.com/api/v4/chapters/${id}`);
      const chapterJson = await chapterRes.json();

      if (json.verses && chapterJson.chapter) {
        const surahPayload = {
          namaLatin: chapterJson.chapter.name_simple,
          namaComplex: chapterJson.chapter.name_arabic,
          jumlahAyat: chapterJson.chapter.verses_count,
          tempatTurun: chapterJson.chapter.revelation_place,
          verses: json.verses
        };

        // Simpan ke localStorage
        localStorage.setItem(`quran_com_surah_${id}`, JSON.stringify(surahPayload));
        renderSurah(surahPayload);
      } else {
        liveText.textContent = 'Gagal memuat data surah.';
      }
    } catch (error) {
      console.error('Error fetching quran.com API:', error);
      liveText.textContent = 'Terjadi kesalahan jaringan. Cek koneksi Anda.';
    }
  }

  // 3. Render Teks ke UI
  function renderSurah(data) {
    surahTitle.textContent = data.namaLatin;
    surahMeta.textContent = `Ayat 1 - ${data.jumlahAyat} • ${data.tempatTurun.toUpperCase()}`;
    
    quranContainer.innerHTML = '';

    data.verses.forEach((verse, index) => {
      const verseItem = document.createElement('div');
      verseItem.className = 'verse-item';
      verseItem.setAttribute('data-verse', index + 1);

      // Menggunakan teks Uthmani asli dari quran.com
      verseItem.innerHTML = `
        <span class="verse-arabic">${verse.text_uthmani}</span>
        <span class="verse-number">(${index + 1})</span>
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

  loadSurahData(surahId);
});
