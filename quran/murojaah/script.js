document.addEventListener('DOMContentLoaded', () => {
  const mushafPage = document.getElementById('mushafPage');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');

  const urlParams = new URLSearchParams(window.location.search);
  const surahId = urlParams.get('surah') || 4; // Default Surah 4 (An-Nisa)

  async function loadSurah(id) {
    const cachedData = localStorage.getItem(`quran_v4_surah_${id}`);
    if (cachedData) {
      renderMushaf(JSON.parse(cachedData));
      return;
    }

    try {
      const res = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${id}`);
      const json = await res.json();

      const chapterRes = await fetch(`https://api.quran.com/api/v4/chapters/${id}`);
      const chapterJson = await chapterRes.json();

      if (json.verses && chapterJson.chapter) {
        const payload = {
          info: chapterJson.chapter,
          verses: json.verses
        };
        localStorage.setItem(`quran_v4_surah_${id}`, JSON.stringify(payload));
        renderMushaf(payload);
      }
    } catch (err) {
      console.error("Gagal memuat data Quran:", err);
    }
  }

  function renderMushaf(data) {
    surahName.textContent = data.info.name_simple;
    surahMeta.textContent = `Halaman 101 | Juz ${data.info.pages[0]} | ${data.info.revelation_place.toUpperCase()}`;

    let htmlContent = '';
    
    data.verses.forEach((verse, idx) => {
      const verseNum = idx + 1;
      const arabicNum = convertToArabicNumbers(verseNum);
      
      // Bungkus kata agar bisa di-hide saat mode hafalan
      htmlContent += `<span class="verse-word">${verse.text_uthmani}</span> `;
      htmlContent += `<span class="verse-num-symbol">﴿${arabicNum}﴾</span> `;
    });

    mushafPage.innerHTML = htmlContent;
  }

  function convertToArabicNumbers(num) {
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return num.toString().split('').map(d => arabicDigits[d]).join('');
  }

  // Toggle Mode Hafalan (Hide Teks)
  btnToggleHide.addEventListener('click', () => {
    mushafPage.classList.toggle('text-hidden');
  });

  // Visual Toggle Mikrofon
  btnMic.addEventListener('click', () => {
    btnMic.classList.toggle('recording');
  });

  loadSurah(surahId);
});
