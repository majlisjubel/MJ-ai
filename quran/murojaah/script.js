// State Aplikasi
let currentPage = 1;
let mushafMode = "MDN"; // "MDN" = Madinah (15 baris), "AFR" = Afrika (18 baris)
let isTextHidden = false;
let currentVersesData = []; // Menyimpan data ayat di halaman aktif untuk validasi

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

// Fetch Data Halaman Quran dari API
async function loadQuranPage(page) {
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

    // Simpan data ayat untuk keperluan validasi suara nanti
    currentVersesData = data.verses;

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
  } else {
    mushafPage.classList.remove("text-hidden");
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

// --- FITUR VOICE RECOGNITION & VALIDASI BACAAN (HIJAU / GETAR SALAH) ---
if (btnMic) {
  btnMic.addEventListener("click", (e) => {
    e.stopPropagation();
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Browser ini tidak mendukung fitur pengenalan suara.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA'; // Set bahasa Arab
    recognition.interimResults = false;
    recognition.maxAlternatives = 3; // Ambil beberapa alternatif hasil suara agar lebih akurat

    recognition.onstart = () => {
      console.log("Mic mendengarkan bacaan...");
      btnMic.style.background = "#e74c3c"; // Indikator merah saat merekam
    };

    recognition.onresult = (event) => {
      let speechResult = "";
      // Gabungkan semua alternatif hasil tangkapan suara untuk memperbesar kecocokan
      for (let i = 0; i < event.results[0].length; i++) {
        speechResult += " " + event.results[0][i].transcript;
      }
      speechResult = speechResult.trim().toLowerCase();
      console.log("Hasil Suara:", speechResult);

      if (isTextHidden) {
        let isAnyVerseMatched = false;
        
        // Cek per blok ayat yang ada di halaman ini
        const verseBlocks = mushafPage.querySelectorAll('.verse-block');
        
        verseBlocks.forEach(block => {
          const words = block.querySelectorAll('.verse-word');
          let blockText = "";
          words.forEach(w => blockText += w.innerText + " ");
          blockText = blockText.trim().toLowerCase();

          // Logika pencocokan sederhana (bisa dikembangkan sesuai akurasi bacaan)
          // Jika sebagian besar kata dalam ayat tersebut disebut atau cocok
          let matchedWordsCount = 0;
          words.forEach(w => {
            if (speechResult.includes(w.innerText.trim().toLowerCase())) {
              matchedWordsCount++;
            }
          });

          // Jika minimal ada beberapa kata yang cocok atau terdeteksi di ayat ini
          if (matchedWordsCount > 0 || speechResult.length > 3) {
            // Cek apakah bacaan benar-benar menyentuh ayat ini
            words.forEach(w => {
              if (speechResult.includes(w.innerText.trim().toLowerCase())) {
                w.style.visibility = "visible";
                w.style.color = "#2ecc71"; // Warna Hijau Tanda Benar
                isAnyVerseMatched = true;
              }
            });
          }
        });

        if (!isAnyVerseMatched) {
          // SALAH BACA: Berikan efek getar pada HP (jika didukung browser)
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]); // Pola getar peringatan
          }
          console.warn("Bacaan tidak ditemukan di halaman ini.");
        }
      } else {
        alert("Suara dikenali: " + speechResult);
      }
    };

    recognition.onerror = (event) => {
      console.error("Mic error:", event.error);
      if (navigator.vibrate) navigator.vibrate(300); // Getar tanda error
      btnMic.style.background = "";
    };

    recognition.onend = () => {
      btnMic.style.background = "";
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
