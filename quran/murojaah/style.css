document.addEventListener('DOMContentLoaded', () => {
  const mushafPage = document.getElementById('mushafPage');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const pageNumber = document.getElementById('pageNumber');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');
  const transcriptStatus = document.getElementById('transcriptStatus');

  const urlParams = new URLSearchParams(window.location.search);
  const surahId = urlParams.get('surah') || 4; // Default Surah 4 (An-Nisa)

  // 1. Fetch & Render Data Surah
  async function loadSurah(id) {
    transcriptStatus.textContent = `Memuat Surah ${id}...`;
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
      transcriptStatus.textContent = "Gagal memuat data. Cek koneksi internet Anda.";
    }
  }

  function renderMushaf(data) {
    surahName.textContent = data.info.name_simple;
    const pageVal = data.info.pages ? data.info.pages[0] : 101;
    
    surahMeta.textContent = `Halaman ${pageVal} | Juz 5 | ${data.info.revelation_place.toUpperCase()}`;
    pageNumber.textContent = pageVal;

    let htmlContent = '';
    
    data.verses.forEach((verse, idx) => {
      const verseNum = idx + 1;
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

  // 2. Toggle Hide Teks (Mode Hafalan)
  btnToggleHide.addEventListener('click', () => {
    mushafPage.classList.toggle('text-hidden');
  });

  // 3. Integrasi Web Speech API (Voice Recognition)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ar-SA'; // Set pengenalan ke Bahasa Arab

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
      if (isListening) {
        recognition.start(); // Auto-restart biar terus mendengarkan
      }
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
    if (!recognition) {
      alert("Browser Anda tidak mendukung fitur mikrofon!");
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      recognition.start();
    }
  });

  loadSurah(surahId);
});
