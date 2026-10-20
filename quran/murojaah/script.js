document.addEventListener('DOMContentLoaded', () => {
  const mushafCurrent = document.getElementById('mushafPageCurrent');
  const mushafNext = document.getElementById('mushafPageNext');
  const pageNumCurrent = document.getElementById('pageNumberCurrent');
  const pageNumNext = document.getElementById('pageNumberNext');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');
  const transcriptStatus = document.getElementById('transcriptStatus');

  const urlParams = new URLSearchParams(window.location.search);
  let currentPage = parseInt(urlParams.get('page')) || 77;
  let pageFlipInstance = null;

  // 1. Inisialisasi PageFlip menyesuaikan ukuran layar HP secara dinamis
  function initPageFlip() {
    const bookElem = document.getElementById('pageFlipContainer');
    if (!bookElem) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight - 150; // Kurangi header & dock

    pageFlipInstance = new St.PageFlip(bookElem, {
      width: screenWidth,
      height: screenHeight,
      size: 'fixed',
      minWidth: 280,
      maxWidth: screenWidth,
      minHeight: 400,
      maxHeight: screenHeight,
      maxShadowOpacity: 0.5,
      showCover: false,
      usePortrait: true,
      mobileScrollSupport: false
    });

    pageFlipInstance.loadFromHTML(document.querySelectorAll('.page'));

    pageFlipInstance.on('flip', (e) => {
      const targetPage = currentPage + 1;
      if (targetPage <= 604) {
        currentPage = targetPage;
        updateUrl(currentPage);
        loadPageData(currentPage);
      }
    });
  }

  function updateUrl(page) {
    const newUrl = `${window.location.pathname}?page=${page}`;
    window.history.pushState({ page: page }, '', newUrl);
  }

  // 2. Fetch Data Ayat Quran.com v4
  async function loadPageData(page) {
    transcriptStatus.textContent = `Memuat Halaman ${page}...`;
    const cacheKey = `quran_page_v3_${page}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      renderPage(JSON.parse(cachedData));
      return;
    }

    try {
      const res = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${page}`);
      const json = await res.json();

      const metaRes = await fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?language=id&words=false&page=1&per_page=1`);
      const metaJson = await metaRes.json();

      if (json.verses && metaJson.verses.length > 0) {
        const firstVerse = metaJson.verses[0];
        const chapterId = firstVerse.verse_key.split(':')[0];

        let validJuz = firstVerse.juz_number;
        if (!validJuz || validJuz > 30) validJuz = Math.min(30, Math.ceil(page / 20));

        const chapterRes = await fetch(`https://api.quran.com/api/v4/chapters/${chapterId}`);
        const chapterJson = await chapterRes.json();

        const payload = {
          page: parseInt(page),
          surahName: chapterJson.chapter.name_simple,
          juz: validJuz,
          origin: chapterJson.chapter.revelation_place.toUpperCase(),
          verses: json.verses
        };

        localStorage.setItem(cacheKey, JSON.stringify(payload));
        renderPage(payload);
      }
    } catch (err) {
      console.error("Gagal memuat data:", err);
      transcriptStatus.textContent = "Gagal memuat data. Periksa koneksi internet.";
    }
  }

  function renderPage(data) {
    surahName.textContent = data.surahName;
    surahMeta.textContent = `Halaman ${data.page} | Juz ${data.juz} | ${data.origin}`;
    pageNumCurrent.textContent = data.page;
    pageNumNext.textContent = data.page + 1;

    let htmlContent = '';
    data.verses.forEach((verse) => {
      const verseNum = verse.verse_key ? verse.verse_key.split(':')[1] : '';
      const arabicNum = convertToArabicNumbers(verseNum);

      htmlContent += `<span class="verse-word">${verse.text_uthmani}</span> `;
      if (arabicNum) {
        htmlContent += `<span class="verse-num-symbol">﴿${arabicNum}﴾</span> `;
      }
    });

    mushafCurrent.innerHTML = htmlContent;
    mushafNext.innerHTML = htmlContent;
    transcriptStatus.textContent = "Seret pinggir layar untuk membuka halaman...";
  }

  function convertToArabicNumbers(num) {
    if (!num) return '';
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return num.toString().split('').map(d => arabicDigits[d]).join('');
  }

  // 3. Mode Hafalan (Hide Teks)
  btnToggleHide.addEventListener('click', () => {
    mushafCurrent.classList.toggle('text-hidden');
  });

  // 4. Web Speech API (Voice Recognition)
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

  initPageFlip();
  loadPageData(currentPage);
});
