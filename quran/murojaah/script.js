document.addEventListener('DOMContentLoaded', () => {
  const mushafPage = document.getElementById('mushafPage');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const pageNumber = document.getElementById('pageNumber');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');
  const transcriptStatus = document.getElementById('transcriptStatus');
  const bookViewport = document.querySelector('.book-viewport');

  const urlParams = new URLSearchParams(window.location.search);
  let currentPage = parseInt(urlParams.get('page')) || 77;

  // Touch Swipe Handler Variables
  let touchStartX = 0;
  let touchEndX = 0;

  async function loadPageData(page) {
    if (page < 1) page = 1;
    if (page > 604) page = 604;
    currentPage = page;

    const newUrl = `${window.location.pathname}?page=${currentPage}`;
    window.history.pushState({ page: currentPage }, '', newUrl);

    transcriptStatus.textContent = `Memuat Halaman ${currentPage}...`;
    
    const cacheKey = `quran_page_v3_${currentPage}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      renderPage(JSON.parse(cachedData));
      return;
    }

    try {
      const res = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${currentPage}`);
      const json = await res.json();

      const metaRes = await fetch(`https://api.quran.com/api/v4/verses/by_page/${currentPage}?language=id&words=false&page=1&per_page=1`);
      const metaJson = await metaRes.json();

      if (json.verses && metaJson.verses.length > 0) {
        const firstVerse = metaJson.verses[0];
        const chapterId = firstVerse.verse_key.split(':')[0];
        
        let validJuz = firstVerse.juz_number;
        if (!validJuz || validJuz > 30) {
          validJuz = Math.min(30, Math.ceil(currentPage / 20));
        }

        const chapterRes = await fetch(`https://api.quran.com/api/v4/chapters/${chapterId}`);
        const chapterJson = await chapterRes.json();

        const payload = {
          page: parseInt(currentPage),
          surahName: chapterJson.chapter.name_simple,
          juz: validJuz,
          origin: chapterJson.chapter.revelation_place.toUpperCase(),
          verses: json.verses
        };

        localStorage.setItem(cacheKey, JSON.stringify(payload));
        renderPage(payload);
      }
    } catch (err) {
      console.error("Gagal memuat data halaman:", err);
      transcriptStatus.textContent = "Gagal memuat data. Cek koneksi internet.";
    }
  }

  function renderPage(data) {
    surahName.textContent = data.surahName;
    surahMeta.textContent = `Halaman ${data.page} | Juz ${data.juz} | ${data.origin}`;
    pageNumber.textContent = data.page;

    let htmlContent = '';
    
    data.verses.forEach((verse) => {
      const verseNum = verse.verse_key ? verse.verse_key.split(':')[1] : '';
      const arabicNum = convertToArabicNumbers(verseNum);
      
      htmlContent += `<span class="verse-word">${verse.text_uthmani}</span> `;
      if (arabicNum) {
        htmlContent += `<span class="verse-num-symbol">﴿${arabicNum}﴾</span> `;
      }
    });

    mushafPage.innerHTML = htmlContent;
    transcriptStatus.textContent = "Usap / Swipe layar untuk ganti halaman.";
  }

  function convertToArabicNumbers(num) {
    if (!num) return '';
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return num.toString().split('').map(d => arabicDigits[d]).join('');
  }

  // Detect Swipe / Drag Jari Tangannya
  bookViewport.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  bookViewport.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeThreshold = 50; // Jarak minimal geseran jari (px)
    
    if (touchStartX - touchEndX > swipeThreshold) {
      // Swipe Kiri -> Halaman Selanjutnya
      loadPageData(currentPage + 1);
    } else if (touchEndX - touchStartX > swipeThreshold) {
      // Swipe Kanan -> Halaman Sebelumnya
      loadPageData(currentPage - 1);
    }
  }

  // Toggle Mode Hafalan
  btnToggleHide.addEventListener('click', () => {
    mushafPage.classList.toggle('text-hidden');
  });

  // Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ar-SA';

    recognition.onstart = () => {
      isListening = true;
      btnMic.classList.add('recording');
      transcriptStatus.textContent = "🎙️ Mendengarkan bacaan Anda...";
    };

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      transcriptStatus.textContent = `🔊 " ${currentTranscript} "`;
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      transcriptStatus.textContent = "Izin mikrofon ditolak.";
      stopListening();
    };

    recognition.onend = () => {
      if (isListening) recognition.start();
    };
  } else {
    transcriptStatus.textContent = "Browser tidak mendukung Web Speech API.";
  }

  function stopListening() {
    isListening = false;
    btnMic.classList.remove('recording');
    if (recognition) recognition.stop();
    transcriptStatus.textContent = "Murojaah dihentikan.";
  }

  btnMic.addEventListener('click', () => {
    if (!recognition) return alert("Browser tidak mendukung mikrofon!");
    if (isListening) stopListening();
    else recognition.start();
  });

  loadPageData(currentPage);
});
