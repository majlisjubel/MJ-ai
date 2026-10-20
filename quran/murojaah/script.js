document.addEventListener('DOMContentLoaded', () => {
  const mushafCard = document.getElementById('mushafCard');
  const mushafPage = document.getElementById('mushafPage');
  const surahName = document.getElementById('surahName');
  const surahMeta = document.getElementById('surahMeta');
  const pageNumber = document.getElementById('pageNumber');
  const btnToggleHide = document.getElementById('btnToggleHide');
  const btnMic = document.getElementById('btnMic');
  const transcriptStatus = document.getElementById('transcriptStatus');

  const urlParams = new URLSearchParams(window.location.search);
  let currentPage = parseInt(urlParams.get('page')) || 77;
  let isAnimating = false;

  // 1. Fetch & Change Page dengan Efek Buku 3D
  async function changePage(targetPage, direction = 'next') {
    if (isAnimating) return;
    if (targetPage < 1 || targetPage > 604) return;

    isAnimating = true;

    // Trigger animasi rotasi lembaran buku
    const animClass = direction === 'next' ? 'flip-next' : 'flip-prev';
    mushafCard.classList.add(animClass);

    setTimeout(async () => {
      currentPage = targetPage;
      const newUrl = `${window.location.pathname}?page=${currentPage}`;
      window.history.pushState({ page: currentPage }, '', newUrl);

      await loadPageData(currentPage);

      // Kembalikan lembaran buku dengan animasi balik
      mushafCard.classList.remove(animClass);
      isAnimating = false;
    }, 350); // Waktu yang pas sesuai CSS transition
  }

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
        if (!validJuz || validJuz > 30) {
          validJuz = Math.min(30, Math.ceil(page / 20));
        }

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
    transcriptStatus.textContent = "Tap sisi layar untuk membalik halaman.";
  }

  function convertToArabicNumbers(num) {
    if (!num) return '';
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return num.toString().split('').map(d => arabicDigits[d]).join('');
  }

  // 2. Navigasi Tap Sisi Layar
  document.addEventListener('click', (e) => {
    if (e.target.closest('.bottom-dock') || e.target.closest('.top-bar') || e.target.closest('.transcript-status')) {
      return;
    }

    const screenWidth = window.innerWidth;
    const clickX = e.clientX;

    if (clickX < screenWidth * 0.35) {
      // Tap sisi kiri -> Membalik ke Halaman Berikutnya
      changePage(currentPage + 1, 'next');
    } else if (clickX > screenWidth * 0.65) {
      // Tap sisi kanan -> Membalik ke Halaman Sebelumnya
      changePage(currentPage - 1, 'prev');
    }
  });

  // 3. Toggle Mode Hafalan
  btnToggleHide.addEventListener('click', () => {
    mushafPage.classList.toggle('text-hidden');
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

  loadPageData(currentPage);
});
