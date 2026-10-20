// State Aplikasi
let currentPage = 1;
let mushafMode = "MDN"; // "MDN" = Madinah (15 baris), "AFR" = Afrika (18 baris)
let isTextHidden = false;
let currentVerseIndex = 0; // Pointer pelacak urutan AYAT yang harus dibaca

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

// Fungsi Pembersih Harakat & Tanda Baca Arab
function cleanArabicText(text) {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "") // Hapus harakat & tajwid
    .replace(/[ٱإأآء]/g, "ا") // Normalisasi Alif
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064A\s]/g, "") // Huruf Arab & spasi saja
    .replace(/\s+/g, " ") // Rapikan spasi ganda
    .trim()
    .toLowerCase();
}

// Fetch Data Halaman Quran dari API
async function loadQuranPage(page) {
  resetMurojaahPointer(); // Reset urutan ayat tiap ganti halaman
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
    if (transcriptStatus) transcriptStatus.innerText = "Mode sembunyi aktif. Silakan baca ayat pertama!";
  } else {
    mushafPage.classList.remove("text-hidden");
    if (transcriptStatus) transcriptStatus.innerText = "Geser atau tap sisi layar untuk mengganti halaman...";
  }
});

// Navigasi Touch Swipe (RTL Standard)
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

// --- FITUR VOICE RECOGNITION (MIC) VALIDASI PER KALIMAT / PER AYAT ---
if (btnMic) {
  btnMic.addEventListener("click", (e) => {
    e.stopPropagation();
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Browser ini tidak mendukung fitur pengenalan suara.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("Mic mendengarkan...");
      btnMic.classList.add("recording");
      if (transcriptStatus) transcriptStatus.innerText = "Mendengarkan bacaan Anda...";
    };

    recognition.onresult = (event) => {
      const rawSpeech = event.results[0][0].transcript;
      const cleanSpeech = cleanArabicText(rawSpeech);
      console.log("Suara Ditangkap (Clean):", cleanSpeech);

      if (transcriptStatus) {
        transcriptStatus.innerText = "Suara ditangkap: " + rawSpeech;
      }

      if (isTextHidden) {
        const verseElements = mushafPage.querySelectorAll('.verse-block');
        if (verseElements.length === 0) return;

        // Ambil elemen ayat target yang sedang dibaca
        const targetVerse = verseElements[currentVerseIndex];
        if (!targetVerse) {
          if (transcriptStatus) transcriptStatus.innerText = "Semua ayat di halaman ini sudah selesai dibaca!";
          return;
        }

        // Ambil teks lengkap Uthmani dalam ayat target
        const wordNodes = targetVerse.querySelectorAll('.verse-word');
        let fullVerseText = "";
        wordNodes.forEach(w => {
          fullVerseText += w.innerText + " ";
        });

        const targetVerseClean = cleanArabicText(fullVerseText);

        // Pencocokan fleksibel: suara mengandung bagian utama dari ayat target
        // atau ayat target mengandung suara yang ditangkap
        const isMatched = cleanSpeech.length > 0 && 
          (targetVerseClean.includes(cleanSpeech) || cleanSpeech.includes(targetVerseClean));

        if (isMatched) {
          // BACAAN BENAR: Munculkan seluruh kalimat dalam ayat tersebut
          targetVerse.classList.remove("verse-error");
          targetVerse.classList.add("verse-revealed");
          
          currentVerseIndex++; // Pindah ke ayat berikutnya!

          if (transcriptStatus) {
            transcriptStatus.innerText = `Benar! Ayat ke-${currentVerseIndex} terbuka.`;
          }
        } else {
          // BACAAN SALAH
          console.warn(`SALAH! Target: "${targetVerseClean}", Suara: "${cleanSpeech}"`);

          // 1. Getar HP
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }

          // 2. Beri indikator merah dan animasi shake pada ayat yang sedang dibaca
          targetVerse.classList.add("verse-error");

          // Reset status error setelah 1.5 detik
          setTimeout(() => {
            targetVerse.classList.remove("verse-error");
          }, 1500);

          if (transcriptStatus) {
            transcriptStatus.innerText = "Bacaan belum sesuai, silakan coba lagi!";
          }
        }
      } else {
        alert("Suara ditangkap: " + rawSpeech);
      }
    };

    recognition.onerror = (event) => {
      console.error("Mic error:", event.error);
      if (navigator.vibrate) navigator.vibrate(300);
      btnMic.classList.remove("recording");
      if (transcriptStatus) transcriptStatus.innerText = "Gagal menangkap suara. Coba lagi.";
    };

    recognition.onend = () => {
      btnMic.classList.remove("recording");
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Gagal start mic:", err);
    }
  });
}

// Inisialisasi Pertama
document.addEventListener("DOMContentLoaded", () => {
  loadQuranPage(currentPage);
});
