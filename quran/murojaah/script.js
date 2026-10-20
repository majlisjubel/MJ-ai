
document.addEventListener('DOMContentLoaded', () => {
  // ==============================
  // 1. AMBIL ELEMEN WEBSITE
  // ==============================
  const mushafCard = document.getElementById('mushafCard');
  const mushafPage = document.getElementById('mushafPage');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const pageNumber = document.getElementById('pageNumber');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');
  const transcriptStatus = document.getElementById('transcriptStatus');
  const btnMushafType = document.getElementById('btnMushafType');
  const mushafLabel = document.getElementById('mushafLabel');

  // Pastikan elemen utama tersedia
  if (!mushafPage || !surahName || !surahMeta || !pageNumber) {
    console.error('Elemen utama Mushaf tidak ditemukan. Periksa index.html.');
    return;
  }

  // ==============================
  // 2. VARIABEL UTAMA
  // ==============================
  const urlParams = new URLSearchParams(window.location.search);

  let currentPage = parseInt(urlParams.get('page'), 10) || 1;
  let isAnimating = false;
  let currentVerses = [];
  let currentMushafType =
    localStorage.getItem('mushafType') || 'madinah';

  // ==============================
  // 3. PILIHAN JENIS MUSHAF
  // ==============================
  function updateMushafUI() {
    if (mushafLabel) {
      mushafLabel.textContent =
        currentMushafType === 'afrika' ? 'AFR' : 'MDN';
    }
  }

  updateMushafUI();

  if (btnMushafType) {
    btnMushafType.addEventListener('click', () => {
      currentMushafType =
        currentMushafType === 'madinah' ? 'afrika' : 'madinah';

      localStorage.setItem('mushafType', currentMushafType);
      updateMushafUI();

      const maxPages =
        currentMushafType === 'afrika' ? 480 : 604;

      if (currentPage > maxPages) {
        currentPage = maxPages;
      }

      loadPageData(currentPage);
    });
  }

  // ==============================
  // 4. GANTI HALAMAN DENGAN SWIPE
  // ==============================
  let touchStartX = 0;
  let touchEndX = 0;

  async function changePage(targetPage, direction = 'next') {
    if (isAnimating) return;

    const maxPages =
      currentMushafType === 'afrika' ? 480 : 604;

    if (targetPage < 1 || targetPage > maxPages) return;

    isAnimating = true;

    if (mushafCard) {
      mushafCard.classList.add(
        direction === 'next' ? 'flip-next' : 'flip-prev'
      );
    }

    setTimeout(async () => {
      currentPage = targetPage;

      const newUrl =
        `${window.location.pathname}?page=${currentPage}`;

      window.history.pushState(
        { page: currentPage },
        '',
        newUrl
      );

      await loadPageData(currentPage);

      if (mushafCard) {
        mushafCard.classList.remove('flip-next', 'flip-prev');
      }

      isAnimating = false;
    }, 300);
  }

  document.addEventListener('touchstart', (event) => {
    if (
      event.target.closest('.bottom-dock') ||
      event.target.closest('.top-bar')
    ) {
      return;
    }

    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  document.addEventListener('touchend', (event) => {
    if (
      event.target.closest('.bottom-dock') ||
      event.target.closest('.top-bar')
    ) {
      return;
    }

    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const threshold = 40;

    if (touchEndX - touchStartX > threshold) {
      changePage(currentPage + 1, 'next');
    } else if (touchStartX - touchEndX > threshold) {
      changePage(currentPage - 1, 'prev');
    }
  }

  // Mendukung tombol kembali/maju browser
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const page = parseInt(params.get('page'), 10) || 1;

    currentPage = page;
    loadPageData(currentPage);
  });

  // ==============================
  // 5. MEMUAT DATA AL-QUR'AN
  // ==============================
  async function loadPageData(page) {
    if (transcriptStatus) {
      transcriptStatus.textContent = `Memuat halaman ${page}...`;
    }

    const cacheKey =
      `quran_${currentMushafType}_page_v5_${page}`;

    try {
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        const parsedData = JSON.parse(cachedData);

        if (
          parsedData &&
          Array.isArray(parsedData.verses) &&
          parsedData.verses.length > 0
        ) {
          renderPage(parsedData);
          return;
        }
      }
    } catch (error) {
      console.warn('Cache Quran tidak bisa dibaca:', error);
    }

    try {
      // API Quran.com menggunakan halaman standar Madinah.
      // Pemetaan Afrika di bawah hanya perkiraan, bukan layout resmi.
      let apiPage = page;

      if (currentMushafType === 'afrika') {
        apiPage = Math.min(
          604,
          Math.max(1, Math.round(page * (604 / 480)))
        );
      }

      const res = await fetch(
        `https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${apiPage}`
      );

      if (!res.ok) {
        throw new Error(`API ayat gagal: HTTP ${res.status}`);
      }

      const json = await res.json();

      if (!Array.isArray(json.verses) || json.verses.length === 0) {
        throw new Error('Data ayat kosong dari API.');
      }

      const metaRes = await fetch(
        `https://api.quran.com/api/v4/verses/by_page/${apiPage}?language=id&words=false&page=1&per_page=1`
      );

      if (!metaRes.ok) {
        throw new Error(`API metadata gagal: HTTP ${metaRes.status}`);
      }

      const metaJson = await metaRes.json();
      const firstVerse =
        Array.isArray(metaJson.verses) && metaJson.verses.length
          ? metaJson.verses[0]
          : json.verses[0];

      const chapterId = firstVerse.verse_key.split(':')[0];

      const chapterRes = await fetch(
        `https://api.quran.com/api/v4/chapters/${chapterId}?language=id`
      );

      if (!chapterRes.ok) {
        throw new Error('Gagal mengambil informasi surah.');
      }

      const chapterJson = await chapterRes.json();
      const chapter = chapterJson.chapter;

      const revelationPlace =
        (chapter.revelation_place || '').toLowerCase();

      const originLabel =
        revelationPlace === 'maddani' ||
        revelationPlace === 'madinah'
          ? 'MADANIYAH'
          : revelationPlace === 'makkah' ||
            revelationPlace === 'makkah'
            ? 'MAKKIYAH'
            : revelationPlace === 'maddinah'
              ? 'MADANIYAH'
              : 'MAKKIYAH';

      const payload = {
        page: parseInt(page, 10),
        surahName: chapter.name_simple || 'Al-Qur’an',
        juz: firstVerse.juz_number || '',
        origin: originLabel,
        verses: json.verses
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (error) {
        console.warn('Cache tidak dapat disimpan:', error);
      }

      renderPage(payload);
    } catch (error) {
      console.error('Gagal memuat halaman Quran:', error);

      if (transcriptStatus) {
        transcriptStatus.textContent =
          'Gagal memuat ayat. Periksa internet lalu muat ulang halaman.';
      }
    }
  }

  // ==============================
  // 6. MENAMPILKAN AYAT
  // ==============================
  function renderPage(data) {
    if (!data || !Array.isArray(data.verses)) {
      console.error('Data halaman Quran tidak valid:', data);
      return;
    }

    // Referensi ayat untuk fitur murojaah
    currentVerses = data.verses;

    surahName.textContent = data.surahName || 'Al-Qur’an';

    surahMeta.textContent =
      `Halaman ${data.page} | Juz ${data.juz} | ${data.origin}`;

    pageNumber.textContent = data.page;

    if (currentMushafType === 'afrika') {
      mushafPage.classList.add('layout-18-lines');
      mushafPage.classList.remove('layout-15-lines');
    } else {
      mushafPage.classList.add('layout-15-lines');
      mushafPage.classList.remove('layout-18-lines');
    }

    let htmlContent = '';

    data.verses.forEach((verse) => {
      const verseNum = verse.verse_key
        ? verse.verse_key.split(':')[1]
        : '';

      const arabicNum = convertToArabicNumbers(verseNum);

      htmlContent +=
        `<span class="verse-word">${escapeHTML(verse.text_uthmani || '')}</span> `;

      if (arabicNum) {
        htmlContent +=
          `<span class="verse-num-symbol">﴿${arabicNum}﴾</span> `;
      }
    });

    mushafPage.innerHTML = htmlContent;

    if (transcriptStatus) {
      transcriptStatus.textContent =
        'Geser layar ke kiri/kanan untuk buka halaman.';
    }
  }

  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (character) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };

      return entities[character];
    });
  }

  function convertToArabicNumbers(number) {
    if (!number) return '';

    const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    return String(number)
      .split('')
      .map((digit) => digits[Number(digit)])
      .join('');
  }

  // ==============================
  // 7. SEMBUNYIKAN / TAMPILKAN AYAT
  // ==============================
  if (btnToggleHide) {
    btnToggleHide.addEventListener('click', () => {
      mushafPage.classList.toggle('text-hidden');
    });
  }

  // ==============================
  // 8. FITUR MURAJAAH / MIKROFON
  // ==============================
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  let recognition = null;
  let isListening = false;
  let finalTranscript = '';

  function normalizeArabic(text) {
    return (text || '')
      .normalize('NFC')
      // Hilangkan harakat dan tanda baca Arab tertentu
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/\u0640/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/[۞۩،؛؟.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getExpectedWords() {
    return currentVerses
      .map((verse) => verse.text_uthmani || '')
      .join(' ')
      .split(/\s+/)
      .map(normalizeArabic)
      .filter(Boolean);
  }

  // Perkiraan kecocokan urutan kata, bukan pemeriksaan tajwid.
  function compareRecitation(spokenText) {
    const spoken = normalizeArabic(spokenText)
      .split(/\s+/)
      .filter(Boolean);

    const expected = getExpectedWords();

    if (!spoken.length || !expected.length) {
      return {
        percent: 0,
        matched: 0,
        message: 'Menunggu bacaan...'
      };
    }

    // LCS dengan satu baris memori agar lebih ringan.
    const row = new Uint16Array(expected.length + 1);

    for (const word of spoken) {
      let diagonal = 0;

      for (let j = 1; j <= expected.length; j++) {
        const oldValue = row[j];

        if (word === expected[j - 1]) {
          row[j] = diagonal + 1;
        } else {
          row[j] = Math.max(row[j], row[j - 1]);
        }

        diagonal = oldValue;
      }
    }

    const matched = row[expected.length];
    const percent = Math.min(
      100,
      Math.round((matched / spoken.length) * 100)
    );

    let message;

    if (percent >= 90) {
      message = '🟢 Banyak kata cocok dengan teks halaman.';
    } else if (percent >= 65) {
      message = '🟡 Sebagian bacaan cocok. Periksa kembali.';
    } else {
      message = '🟠 Kecocokan rendah. Coba ulangi bacaan.';
    }

    return { percent, matched, message };
  }

  function updateRecitationStatus(transcript) {
    if (!transcriptStatus) return;

    if (!transcript.trim()) {
      transcriptStatus.textContent = '🎙️ Mendengarkan bacaan...';
      return;
    }

    const result = compareRecitation(transcript);

    transcriptStatus.textContent =
      `${result.message} ${result.percent}% | ${transcript}`;
  }

  function stopListening() {
    isListening = false;

    if (btnMic) {
      btnMic.classList.remove('recording');
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        console.warn('Mikrofon sudah berhenti:', error);
      }
    }

    if (transcriptStatus) {
      transcriptStatus.textContent = 'Murojaah dihentikan.';
    }
  }

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;

      if (btnMic) {
        btnMic.classList.add('recording');
      }

      if (transcriptStatus) {
        transcriptStatus.textContent =
          '🎙️ Mendengarkan bacaan Anda...';
      }
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const recognizedText = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += ' ' + recognizedText;
        } else {
          interimTranscript += ' ' + recognizedText;
        }
      }

      const fullTranscript =
        `${finalTranscript} ${interimTranscript}`.trim();

      updateRecitationStatus(fullTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech Recognition Error:', event.error);

      if (event.error === 'no-speech') {
        if (transcriptStatus) {
          transcriptStatus.textContent =
            'Belum ada bacaan terdeteksi. Coba bicara lebih dekat ke mikrofon.';
        }
        return;
      }

      isListening = false;

      if (btnMic) {
        btnMic.classList.remove('recording');
      }

      if (transcriptStatus) {
        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed'
        ) {
          transcriptStatus.textContent =
            'Izin mikrofon ditolak. Periksa izin browser dan coba lagi.';
        } else if (event.error === 'language-not-supported') {
          transcriptStatus.textContent =
            'Layanan pengenalan suara tidak mendukung bahasa Arab.';
        } else {
          transcriptStatus.textContent =
            `Pengenalan suara bermasalah: ${event.error}`;
        }
      }
    };

    recognition.onend = () => {
      isListening = false;

      if (btnMic) {
        btnMic.classList.remove('recording');
      }

      // Tidak memulai ulang otomatis agar tidak terjadi loop error.
      if (
        transcriptStatus &&
        transcriptStatus.textContent.includes('Mendengarkan')
      ) {
        transcriptStatus.textContent =
          'Pengenalan suara berhenti. Tekan mikrofon untuk mencoba lagi.';
      }
    };
  } else if (transcriptStatus) {
    transcriptStatus.textContent =
      'Browser ini tidak mendukung Web Speech API. Coba Chrome.';
  }

  if (btnMic) {
    btnMic.addEventListener('click', () => {
      if (!recognition) {
        alert(
          'Browser tidak mendukung pengenalan suara. Coba Chrome.'
        );
        return;
      }

      if (isListening) {
        stopListening();
        return;
      }

      finalTranscript = '';

      try {
        recognition.start();
      } catch (error) {
        console.error('Gagal memulai mikrofon:', error);

        if (transcriptStatus) {
          transcriptStatus.textContent =
            'Mikrofon gagal dimulai. Tunggu sebentar lalu tekan lagi.';
        }
      }
    });
  }

  // ==============================
  // 9. MULAI MUAT HALAMAN
  // ==============================
  loadPageData(currentPage);
});
