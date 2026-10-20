// State Aplikasi
let currentPage = 1;
let mushafMode = "MDN"; // "MDN" = Madinah (15 baris), "AFR" = Afrika (18 baris)
let isTextHidden = false;

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

// Format Angka Arab
function toArabicDigits(num) {
  const arabicDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().split('').map(d => arabicDigits[d] || d).join('');
}

// Algoritma Mapping Afrika (480 Hal -> Base 604 Hal)
function getBasePageForAfrika(afrPage) {
  if (afrPage <= 1) return 1;
  if (afrPage >= 480) return 604;
  return Math.round(((afrPage - 1) / (480 - 1)) * (604 - 1)) + 1;
}

// Fetch Data Halaman Quran dari API
async function loadQuranPage(page) {
  try {
    mushafPage.innerHTML = `<div style="text-align:center; padding: 40px; color: #888;">Memuat data...</div>`;
    
    // Tentukan Halaman Mana yang di-fetch berdasarkan mode
    let actualFetchPage = page;
    if (mushafMode === "AFR") {
      actualFetchPage = getBasePageForAfrika(page);
    }

    const response = await fetch(`https://api.quran.com/api/v4/verses/by_page/${actualFetchPage}?words=true&word_fields=text_uthmani`);
    const data = await response.json();

    if (!data.verses || data.verses.length === 0) {
      mushafPage.innerHTML = `<div style="text-align:center; padding: 40px; color: #e74c3c;">Gagal memuat data.</div>`;
      return;
    }

    // Render Teks Ayat
    let htmlContent = "";
    let firstVerse = data.verses[0];

    // Update Header Surah Metadata
    const surahKey = firstVerse.verse_key.split(":")[0];
    fetchSurahInfo(surahKey, page, firstVerse.juz_number);

    data.verses.forEach(verse => {
      verse.words.forEach(word => {
        if (word.char_type_name === "word") {
          htmlContent += `<span class="verse-word">${word.text_uthmani}</span> `;
        }
      });
      // Nomor Ayat Arab
      const verseNum = verse.verse_key.split(":")[1];
      htmlContent += `<span class="verse-num-symbol">﴿${toArabicDigits(verseNum)}﴾</span> `;
    });

    mushafPage.innerHTML = htmlContent;
    pageNumber.innerText = page;

    // Terapkan Class Layout Sesuai Mode
    if (mushafMode === "AFR") {
      mushafPage.className = "mushaf-text layout-18-lines";
    } else {
      mushafPage.className = "mushaf-text layout-15-lines";
    }

    if (isTextHidden) {
      mushafPage.classList.add("text-hidden");
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    mushafPage.innerHTML = `<div style="text-align:center; padding: 40px; color: #e74c3c;">Koneksi gagal. Coba refresh.</div>`;
  }
}

// Fetch Metadata Surah (Nama & Tempat Turun)
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
    mushafBadge.innerText = "AFRIKA";
  } else {
    mushafMode = "MDN";
    mushafLabel.innerText = "MDN";
    mushafBadge.innerText = "MADINAH";
  }
  loadQuranPage(currentPage);
});

// Handler Toggle Sembunyikan Teks (Mode Hafalan)
btnToggleHide.addEventListener("click", () => {
  isTextHidden = !isTextHidden;
  if (isTextHidden) {
    mushafPage.classList.add("text-hidden");
  } else {
    mushafPage.classList.remove("text-hidden");
  }
});

// Navigasi Touch Swipe
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("touchstart", e => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", e => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function handleSwipe() {
  const swipeThreshold = 50;
  if (touchStartX - touchEndX > swipeThreshold) {
    // Swipe Kiri -> Halaman Selanjutnya
    changePage(currentPage + 1, "next");
  } else if (touchEndX - touchStartX > swipeThreshold) {
    // Swipe Kanan -> Halaman Sebelumnya
    changePage(currentPage - 1, "prev");
  }
}

function changePage(newPage, dir) {
  const maxPages = mushafMode === "AFR" ? 480 : 604;
  if (newPage < 1 || newPage > maxPages) return;

  currentPage = newPage;
  
  // Efek Animasi Flip
  mushafCard.classList.add(dir === "next" ? "flip-next" : "flip-prev");
  setTimeout(() => {
    loadQuranPage(currentPage);
    mushafCard.classList.remove("flip-next", "flip-prev");
  }, 300);
}

// Inisialisasi Pertama
document.addEventListener("DOMContentLoaded", () => {
  loadQuranPage(currentPage);
});
