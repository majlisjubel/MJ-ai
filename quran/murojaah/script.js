document.addEventListener('DOMContentLoaded', () => {
  const mushafPage = document.getElementById('mushafPage');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const pageNumber = document.getElementById('pageNumber');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');
  const transcriptStatus = document.getElementById('transcriptStatus');

  // Ambil parameter page dari URL (Default: Halaman 101)
  const urlParams = new URLSearchParams(window.location.search);
  const pageId = urlParams.get('page') || 101;

  // 1. Fetch Data berdasarkan Nomor Halaman Mushaf
  async function loadPageData(page) {
    transcriptStatus.textContent = `Memuat Halaman ${page}...`;
    const cachedData = localStorage.getItem(`quran_page_${page}`);
    
    if (cachedData) {
      renderPage(JSON.parse(cachedData));
      return;
    }

    try {
      // Endpoint Quran.com v4 khusus per halaman
      const res = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${page}`);
      const json = await res.json();

      // Ambil metadata halaman (surah apa, juz berapa)
      const metaRes = await fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?language=id&words=false&page=1&per_page=1`);
      const metaJson = await metaRes.json();

      if (json.verses && metaJson.verses.length > 0) {
        const firstVerseKey = metaJson.verses[0].verse_key; // Contoh "4:141"
        const chapterId = firstVerseKey.split(':')[0];

        // Fetch detail nama surah
        const chapterRes = await fetch(`https://api.quran.com/api/v4/chapters/${chapterId}`);
        const chapterJson = await chapterRes.json();

        const payload = {
          page: page,
          surahName: chapterJson.chapter.name_simple,
          juz: metaJson.verses[0].juz_number,
          origin: chapterJson.chapter.revelation_place.toUpperCase(),
          verses: json.verses
        };

        localStorage.setItem(`quran_page_${page}`, JSON.stringify(payload));
        renderPage(payload);
      }
    } catch (err) {
      console.error("Gagal memuat data halaman:", err);
      transcriptStatus.textContent = "Gagal memuat data. Cek koneksi internet Anda.";
    }
  }

  function renderPage(data) {
    surahName.textContent = data.surahName;
    surahMeta.textContent = `Halaman ${data.page} | Juz ${data.juz} | ${data.origin}`;
    pageNumber.textContent = data.page;

    let htmlContent = '';
    
    data.verses.forEach((verse) => {
      // verse_key contohnya "4:141" -> kita ambil nomor ayatnya saja (141)
      const verseNum = verse.verse_key ? verse.verse_key.split(':')[1] : 1;
      const arabicNum = convertToArabicNumbers(verseNum);
      
      htmlContent += `<span class="verse-word">${verse.text_uthmani}</span> `;
      htmlContent += `<span class="verse-num-symbol">﴿${arabicNum}﴾</span> `;
    });

    mushafPage.innerHTML = htmlContent;
    transcriptStatus.textContent = "Tekan mikrofon untuk mulai Murojaah AI...";
  }

  function convertToArabicNumbers(num) {
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return num.toString().split('').map(d => arabicDigits[d]).join('');
  }

  // 2. Toggle Mode Hafalan (Hide Teks)
  btnToggleHide.addEventListener('click', () => {
    mushafPage.classList.toggle('text-hidden');
  });

  // 3. Web Speech API (Voice Recognition)
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
      transcriptStatus.textContent = "Izin mic ditolak atau audio tidak terdeteksi.";
      stopListening();
    };

    recognition.onend = () => {
      if (isListening) recognition.start();
    };
  } else {
    transcriptStatus.textContent = "Browser Anda tidak mendukung Web Speech API.";
  }

  function stopListening() {
    isListening = false;
    btnMic.classList.remove('recording');
    if (recognition) recognition.stop();
    transcriptStatus.textContent = "Murojaah dihentikan. Klik mic untuk mulai lagi.";
  }

  btnMic.addEventListener('click', () => {
    if (!recognition) return alert("Browser tidak mendukung mikrofon!");
    if (isListening) stopListening();
    else recognition.start();
  });

  loadPageData(pageId);
});
