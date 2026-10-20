// State Aplikasi
let currentPage = 1;
let mushafMode = "MDN"; // "MDN" = Madinah (15 baris), "AFR" = Afrika (18 baris)
let isTextHidden = false;
let currentVerseIndex = 0; // Pointer pelacak urutan AYAT yang harus dibaca
let isMicActive = false; // State untuk mengontrol status mic manual
let recognition = null;

// DOM Elements
const mushafPage = document.getElementById("mushafPage");
const surahName = document.getElementById("surahName");
const surahMeta = document.getElementById("surahMeta");
const pageNumber = document.getElementById("pageNumber");
const btnMushafType = document.getElementById("btnMushafType");
const mushafLabel = document.getElementById("mushafLabel");
const mushafBadge = document.getElementById("mushafBadge");
const btnToggleHide = document.getElementById("btnToggleHide");
const mushafCard = document.getElementById("mushafCard");
const btnMic = document.getElementById("btnMic");
const transcriptStatus = document.getElementById("transcriptStatus");

// Format Angka Arab
function toArabicDigits(num) {
  const arabicDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().split('').map(d => arabicDigits[d] || d).join('');
}

// Mapping Akurat Halaman Afrika (1-480) ke Madinah (1-604)
function getBasePageForAfrika(afrPage) {
  if (afrPage <= 1) return 1;
  if (afrPage >= 480) return 604;
  return Math.floor(((afrPage - 1) / 479) * 603) + 1;
}

// Reset pointer urutan ayat saat halaman baru dimuat
function resetMurojaahPointer() {
  currentVerseIndex = 0;
}

// Fungsi Pembersih Harakat & Tanda Baca Arab Ketat
function cleanArabicText(text) {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "") // Hapus harakat & tajwid
    .replace(/[ٱإأآء]/g, "ا") // Normalisasi Alif
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0621-\u064A\s]/g, "") // Huruf Arab & spasi saja
    .replace(/\s+/g, " ") // Rapikan spasi ganda
    .trim()
    .toLowerCase();
}

// Algoritma Levenshtein Distance untuk Cek Kemiripan Huruf (0.0 - 1.0)
function getLetterSimilarity(str1, str2) {
  const s1 = cleanArabicText(str1);
  const s2 = cleanArabicText(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return (maxLength - distance) / maxLength;
}

// Fetch Data Halaman Quran dari API
async function loadQuranPage(page) {
  resetMurojaahPointer();
  try {
    mushafPage.innerHTML = `<div style="text-align:center; padding: 40px; color: #888;">Memuat halaman...</div>`;
    
    let actualFetchPage = page;
    if (mushafMode === "AFR") {
      actualFetchPage = getBasePageForAfrika(page);
    }

    const response = await fetch(`https://api.quran.com/api/v4/verses/by_page/${actualFetchPage}?words=true&word_fields=text_uthmani`);
    const data = await response.json();

    if (!data.verses || data.verses.length === 0) {
      mushafPage.innerHTML = `<div style="text-align:center; padding: 40px; color: #e74c3c;">Gagal memuat data ayat.</div>`;
      return;
    }

    let htmlContent = "";
    let firstVerse = data.verses[0];
    const surahKey = firstVerse.verse_key.split(":")[0];
    
    fetchSurahInfo(surahKey, page, firstVerse.juz_number);

    data.verses.forEach(verse => {
      let verseHtml = `<span class="verse-block" data-verse-key="${verse.verse_key}">`;
      verse.words.forEach(word => {
        if (word.char_type_name === "word") {
          verseHtml += `<span class="verse-word">${word.text_uthmani}</span> `;
        }
      });
      const verseNum = verse.verse_key.split(":")[1];
      verseHtml += `<span class="verse-num-symbol">﴿${toArabicDigits(verseNum)}﴾</span></span> `;
      htmlContent += verseHtml;
    });

    mushafPage.innerHTML = htmlContent;
    pageNumber.innerText = page;

    if (mushafMode === "AFR") {
      mushafPage.className = "mushaf-text layout-18-lines";
      mushafBadge.innerText = "AFRIKA (18 BARIS)";
    } else {
      mushafPage.className = "mushaf-text layout-15-lines";
      mushafBadge.innerText = "MADINAH (15 BARIS)";
    }

    if (isTextHidden) {
      mushafPage.classList.add("text-hidden");
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    mushafPage.innerHTML = `<div style="text-align:center; padding: 40px; color: #e74c3c;">Koneksi terputus.</div>`;
  }
}

// Fetch Metadata Surah
async function fetchSurahInfo(surahId, page, juz) {
  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapters/${surahId}`);
    const data = await res.json();
    const ch = data.chapter;

    surahName.innerText = ch.name_simple;
    const revPlace = ch.revelation_place.toUpperCase();
    surahMeta.innerHTML = `Halaman ${page} | Juz ${juz} | ${revPlace}`;
  } catch (e) {
    surahMeta.innerHTML = `Halaman ${page} | Juz ${juz}`;
  }
}

// Handler Toggle Mode Mushaf (MDN <-> AFR)
btnMushafType.addEventListener("click", () => {
  if (mushafMode === "MDN") {
    mushafMode = "AFR";
    mushafLabel.innerText = "AFR";
  } else {
    mushafMode = "MDN";
    mushafLabel.innerText = "MDN";
  }
  currentPage = 1;
  loadQuranPage(currentPage);
});

// Handler Toggle Sembunyikan Teks (Murojaah)
btnToggleHide.addEventListener("click", () => {
  isTextHidden = !isTextHidden;
  if (isTextHidden) {
    mushafPage.classList.add("text-hidden");
    if (transcriptStatus) transcriptStatus.innerText = "Mode sembunyi aktif. Tekan Mic dan baca ayat!";
  } else {
    mushafPage.classList.remove("text-hidden");
    if (transcriptStatus) transcriptStatus.innerText = "Geser atau tap sisi layar untuk mengganti halaman...";
  }
});

// Navigasi Touch Swipe
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

document.addEventListener("touchstart", e => {
  if (e.target.closest('.bottom-dock') || e.target.closest('button')) return;
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
});

document.addEventListener("touchend", e => {
  if (e.target.closest('.bottom-dock') || e.target.closest('button')) return;
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
});

function handleSwipe() {
  const swipeThreshold = 50;
  const verticalThreshold = 100;
  
  if (Math.abs(touchEndY - touchStartY) > verticalThreshold) return;

  if (touchEndX - touchStartX > swipeThreshold) {
    changePage(currentPage + 1, "next");
  } else if (touchStartX - touchEndX > swipeThreshold) {
    changePage(currentPage - 1, "prev");
  }
}

function changePage(newPage, dir) {
  const maxPages = mushafMode === "AFR" ? 480 : 604;
  if (newPage < 1 || newPage > maxPages) return;

  currentPage = newPage;
  
  mushafCard.classList.add(dir === "next" ? "flip-next" : "flip-prev");
  setTimeout(() => {
    loadQuranPage(currentPage);
    mushafCard.classList.remove("flip-next", "flip-prev");
  }, 300);
}

// --- INISIALISASI SPEECH RECOGNITION (KONTINU & FILTER KETAT) ---
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Browser ini tidak mendukung fitur pengenalan suara.");
    return null;
  }

  const rec = new SpeechRecognition();
  rec.lang = 'ar-SA';
  rec.interimResults = true; // Mengambil hasil sementara secara realtime
  rec.continuous = true;     // Mic tetap menyala terus
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    btnMic.classList.add("recording");
    if (transcriptStatus) transcriptStatus.innerText = "Mendengarkan bacaan...";
  };

  rec.onresult = (event) => {
    let finalTranscript = "";
    
    // Ambil HANYA ucapan final yang baru saja selesai diucapkan
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + " ";
      }
    }

    if (!finalTranscript.trim()) return;

    const cleanSpeech = cleanArabicText(finalTranscript);
    console.log("Suara Ditangkap (Final):", finalTranscript, "| Clean:", cleanSpeech);

    if (transcriptStatus) {
      transcriptStatus.innerText = "Suara: " + finalTranscript;
    }

    if (isTextHidden) {
      const verseElements = mushafPage.querySelectorAll('.verse-block');
      if (verseElements.length === 0) return;

      const targetVerse = verseElements[currentVerseIndex];
      if (!targetVerse) {
        if (transcriptStatus) transcriptStatus.innerText = "Halaman ini sudah selesai!";
        return;
      }

      // Ambil kata-kata dari ayat target saat ini
      const wordNodes = targetVerse.querySelectorAll('.verse-word');
      let targetWordsArray = [];
      wordNodes.forEach(w => {
        const cleanW = cleanArabicText(w.innerText);
        if (cleanW.length > 0) targetWordsArray.push(cleanW);
      });

      const targetVerseClean = targetWordsArray.join(" ");
      const speechWordsArray = cleanSpeech.split(" ").filter(w => w.length > 0);

      // --- FILTER KETAT DUA LAPIS ---
      
      // 1. Hitung berapa KATA SPESIFIK yang benar-benar ada di ucapan
      let exactWordMatches = 0;
      targetWordsArray.forEach(word => {
        if (speechWordsArray.includes(word)) {
          exactWordMatches++;
        }
      });

      // 2. Hitung Kemiripan Huruf (Levenshtein Distance)
      const letterSimilarity = getLetterSimilarity(cleanSpeech, targetVerseClean);

      const wordMatchRatio = targetWordsArray.length > 0 ? (exactWordMatches / targetWordsArray.length) : 0;
      
      // Syarat Benar: Minim 60% kata cocok DAN Kemiripan huruf minim 75%
      const isMatched = (wordMatchRatio >= 0.6) && (letterSimilarity >= 0.75);

      console.log(`Target (Ayat ${currentVerseIndex + 1}): "${targetVerseClean}"`);
      console.log(`Word Match: ${(wordMatchRatio * 100).toFixed(0)}% | Letter Match: ${(letterSimilarity * 100).toFixed(0)}%`);

      if (isMatched) {
        // BACAAN BENAR
        targetVerse.classList.remove("verse-error");
        targetVerse.classList.add("verse-revealed");
        
        currentVerseIndex++; // Pindah ke ayat selanjutnya

        if (transcriptStatus) {
          transcriptStatus.innerText = `Benar! Ayat ke-${currentVerseIndex} terbuka.`;
        }
      } else {
        // BACAAN SALAH (BACA KASIDAH / SALAH AYAT)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        targetVerse.classList.add("verse-error");
        setTimeout(() => {
          targetVerse.classList.remove("verse-error");
        }, 1500);

        if (transcriptStatus) {
          transcriptStatus.innerText = `Salah! Cocok: ${(wordMatchRatio * 100).toFixed(0)}% (Butuh >= 60%)`;
        }
      }
    }
  };

  rec.onerror = (event) => {
    console.error("Mic error:", event.error);
    if (event.error === 'no-speech') return;
    if (navigator.vibrate) navigator.vibrate(300);
  };

  // KUNCI CONTINUOUS MIC: Auto-restart jika terhenti padahal tombol mic masih ON
  rec.onend = () => {
    if (isMicActive) {
      console.log("Auto-restarting Mic...");
      try { rec.start(); } catch (e) {}
    } else {
      btnMic.classList.remove("recording");
      if (transcriptStatus) transcriptStatus.innerText = "Mic dimatikan.";
    }
  };

  return rec;
}

// Toggle Mic On/Off Manual
if (btnMic) {
  recognition = initSpeechRecognition();

  btnMic.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!recognition) return;

    if (isMicActive) {
      // Matikan Mic
      isMicActive = false;
      recognition.stop();
    } else {
      // Jalankan Mic
      isMicActive = true;
      try {
        recognition.start();
      } catch (err) {
        console.log("Mic already started:", err);
      }
    }
  });
}

// Inisialisasi Pertama
document.addEventListener("DOMContentLoaded", () => {
  loadQuranPage(currentPage);
});
