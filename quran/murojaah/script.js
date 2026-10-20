document.addEventListener('DOMContentLoaded', () => {
  const mushafPage = document.getElementById('mushafPage');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const pageNumber = document.getElementById('pageNumber');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');
  const transcriptStatus = document.getElementById('transcriptStatus');

  // Ambil parameter page dari URL (Default: Halaman 77 - Awal Surah An-Nisa)
  const urlParams = new URLSearchParams(window.location.search);
  const pageId = urlParams.get('page') || 77;

  // 1. Fetch Data berdasarkan Nombor Halaman Mushaf yang Betul
  async function loadPageData(page) {
    transcriptStatus.textContent = `Memuat Halaman ${page}...`;
    
    // Guna key versi 2 untuk elak konflik dengan cache salah yang lama
    const cacheKey = `quran_page_v2_${page}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      renderPage(JSON.parse(cachedData));
      return;
    }

    try {
      // Fetch ayat-ayat khusus untuk halaman ini sahaja dari Quran.com v4
      const res = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${page}`);
      const json = await res.json();

      // Fetch maklumat juz dan verse key untuk halaman ini
      const metaRes = await fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?language=id&words=false&page=1&per_page=1`);
      const metaJson = await metaRes.json();

      if (json.verses && metaJson.verses.length > 0) {
        const firstVerse = metaJson.verses[0];
        const chapterId = firstVerse.verse_key.split(':')[0];

        // Fetch nama surah yang betul
        const chapterRes = await fetch(`https://api.quran.com/api/v4/chapters/${chapterId}`);
        const chapterJson = await chapterRes.json();

        const payload = {
          page: parseInt(page),
          surahName: chapterJson.chapter.name_simple,
          juz: firstVerse.juz_number, // Juz yang betul (1 - 30)
          origin: chapterJson.chapter.revelation_place.toUpperCase(),
          verses: json.verses
        };

        // Simpan ke localStorage
        localStorage.setItem(cacheKey, JSON.stringify(payload));
        renderPage(payload);
      } else {
        transcriptStatus.textContent = "Data halaman tidak ditemui.";
      }
    } catch (err) {
      console.error("Gagal memuat data halaman:", err);
      transcriptStatus.textContent = "Gagal memuat data. Sila semak sambungan internet anda.";
    }
  }

  function renderPage(data) {
    surahName.textContent = data.surahName;
    surahMeta.textContent = `Halaman ${data.page} | Juz ${data.juz} | ${data.origin}`;
    pageNumber.textContent = data.page;

    let htmlContent = '';
    
    data.verses.forEach((verse) => {
      // Ambil nombor ayat dari verse_key (contoh "4:1" -> "1")
      const verseNum = verse.verse_key ? verse.verse_key.split(':')[1] : '';
      const arabicNum = convertToArabicNumbers(verseNum);
      
      htmlContent += `<span class="verse-word">${verse.text_uthmani}</span> `;
      if (arabicNum) {
        htmlContent += `<span class="verse-num-symbol">﴿${arabicNum}﴾</span> `;
      }
    });

    mushafPage.innerHTML = htmlContent;
    transcriptStatus.textContent = "Tekan mikrofon untuk mula Murojaah AI...";
  }

  function convertToArabicNumbers(num) {
    if (!num) return '';
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return num.toString().split('').map(d => arabicDigits[d]).join('');
  }

  // 2. Toggle Mode Hafalan (Sembunyi Teks)
  btnToggleHide.addEventListener('click', () => {
    mushafPage.classList.toggle('text-hidden');
  });

  // 3. Web Speech API (Pengecaman Suara)
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
      transcriptStatus.textContent = "🎙️ Mendengar bacaan anda...";
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
      transcriptStatus.textContent = "Kebenaran mic ditolak atau audio tidak dikesan.";
      stopListening();
    };

    recognition.onend = () => {
      if (isListening) recognition.start();
    };
  } else {
    transcriptStatus.textContent = "Pelayar anda tidak menyokong Web Speech API.";
  }

  function stopListening() {
    isListening = false;
    btnMic.classList.remove('recording');
    if (recognition) recognition.stop();
    transcriptStatus.textContent = "Murojaah dihentikan. Klik mic untuk mula semula.";
  }

  btnMic.addEventListener('click', () => {
    if (!recognition) return alert("Pelayar tidak menyokong mikrofon!");
    if (isListening) stopListening();
    else recognition.start();
  });

  loadPageData(pageId);
});
