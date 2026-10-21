// ==========================================
// CONFIG & STATE APLIKASI
// ==========================================
const MUROJAAH_WORKER_URL = "https://murojaah-proxy.rkidul416.workers.dev/";

let currentPage = 1;
let mushafMode = "MDN"; // "MDN" = Madinah (15 baris), "AFR" = Afrika (18 baris)
let isTextHidden = false;
let currentVerseIndex = 0; // Pointer pelacak urutan AYAT yang harus dibaca

// Mapping Halaman Awal Tiap Juz (Mushaf Madinah 1-604)
const JUZ_PAGE_MAP = {
  1: 1, 2: 22, 3: 42, 4: 62, 5: 82, 6: 102, 7: 122, 8: 142, 9: 162, 10: 182,
  11: 202, 12: 222, 13: 242, 14: 262, 15: 282, 16: 302, 17: 322, 18: 342, 19: 362, 20: 382,
  21: 402, 22: 422, 23: 442, 24: 462, 25: 482, 26: 502, 27: 522, 28: 542, 29: 562, 30: 582
};

// State Perekam Audio & VAD
let mediaRecorder = null;
let audioChunks = [];
let isMicActive = false;
let isProcessing = false; // Flag pencegah spam request
let audioContext = null;
let analyser = null;
let microphone = null;
let silenceTimer = null;
const SILENCE_THRESHOLD = 25; // Dinaikkan dari 15 agar lebih tahan kebisingan HP
const SILENCE_DURATION = 800;  // Waktu hening (ms) pemicu kirim ke AI (0.8 detik)

// ==========================================
// DOM ELEMENTS
// ==========================================
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

// Sidebar DOM Elements
const btnMenu = document.querySelector('.top-bar .icon-btn'); // Tombol Garis 3
const juzSidebar = document.getElementById("juzSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const btnCloseSidebar = document.getElementById("btnCloseSidebar");
const tabJuz = document.getElementById("tabJuz");
const tabSurah = document.getElementById("tabSurah");
const juzListContainer = document.getElementById("juzListContainer");
const surahListContainer = document.getElementById("surahListContainer");

// ==========================================
// HELPER & UTILS ARAB
// ==========================================

function toArabicDigits(num) {
  const arabicDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().split('').map(d => arabicDigits[d] || d).join('');
}

function getBasePageForAfrika(afrPage) {
  if (afrPage <= 1) return 1;
  if (afrPage >= 480) return 604;
  return Math.floor(((afrPage - 1) / 479) * 603) + 1;
}

function resetMurojaahPointer() {
  currentVerseIndex = 0;
}

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
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return (maxLength - distance) / maxLength;
}

// ==========================================
// LOAD DATA MUSHAF & API QURAN
// ==========================================
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
      if (mushafBadge) mushafBadge.innerText = "AFRIKA (18 BARIS)";
    } else {
      mushafPage.className = "mushaf-text layout-15-lines";
      if (mushafBadge) mushafBadge.innerText = "MADINAH (15 BARIS)";
    }

    if (isTextHidden) {
      mushafPage.classList.add("text-hidden");
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    mushafPage.innerHTML = `<div style="text-align:center; padding: 40px; color: #e74c3c;">Koneksi terputus.</div>`;
  }
}

async function fetchSurahInfo(surahId, page, juz) {
  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapters/${surahId}`);
    const data = await res.json();
    const ch = data.chapter;

    if (surahName) surahName.innerText = ch.name_simple;
    const revPlace = ch.revelation_place.toUpperCase();
    if (surahMeta) surahMeta.innerHTML = `Halaman ${page} | Juz ${juz} | ${revPlace}`;
  } catch (e) {
    if (surahMeta) surahMeta.innerHTML = `Halaman ${page} | Juz ${juz}`;
  }
}

// ==========================================
// FITUR SIDEBAR NAVIGASI JUZ & SURAH
// ==========================================
function openSidebar() {
  if (juzSidebar && sidebarOverlay) {
    renderJuzList();
    renderSurahList();
    juzSidebar.classList.add("active");
    sidebarOverlay.classList.add("active");
  }
}

function closeSidebar() {
  if (juzSidebar && sidebarOverlay) {
    juzSidebar.classList.remove("active");
    sidebarOverlay.classList.remove("active");
  }
}

function renderJuzList() {
  if (!juzListContainer) return;
  let html = "";
  for (let i = 1; i <= 30; i++) {
    const pageTarget = JUZ_PAGE_MAP[i] || 1;
    html += `
      <button class="list-item-btn" onclick="jumpToPage(${pageTarget})">
        <span>Juz ${i}</span>
        <span class="item-sub">Halaman ${pageTarget}</span>
      </button>
    `;
  }
  juzListContainer.innerHTML = html;
}

async function renderSurahList() {
  if (!surahListContainer || surahListContainer.children.length > 0) return;
  try {
    const res = await fetch("https://api.quran.com/api/v4/chapters");
    const data = await res.json();
    let html = "";
    data.chapters.forEach(ch => {
      html += `
        <button class="list-item-btn" onclick="jumpToPage(${ch.pages[0]})">
          <span>${ch.id}. ${ch.name_simple}</span>
          <span class="item-sub">${ch.verses_count} Ayat</span>
        </button>
      `;
    });
    surahListContainer.innerHTML = html;
  } catch (e) {
    surahListContainer.innerHTML = `<div style="padding:16px; color:#aaa;">Gagal memuat surah.</div>`;
  }
}

function jumpToPage(page) {
  closeSidebar();
  currentPage = page;
  loadQuranPage(currentPage);
}

if (btnMenu) btnMenu.addEventListener("click", openSidebar);
if (btnCloseSidebar) btnCloseSidebar.addEventListener("click", closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

if (tabJuz && tabSurah) {
  tabJuz.addEventListener("click", () => {
    tabJuz.classList.add("active");
    tabSurah.classList.remove("active");
    juzListContainer.style.display = "block";
    surahListContainer.style.display = "none";
  });

  tabSurah.addEventListener("click", () => {
    tabSurah.classList.add("active");
    tabJuz.classList.remove("active");
    surahListContainer.style.display = "block";
    juzListContainer.style.display = "none";
  });
}

// ==========================================
// EVENT HANDLERS (MODE & SWIPE)
// ==========================================
if (btnMushafType) {
  btnMushafType.addEventListener("click", () => {
    if (mushafMode === "MDN") {
      mushafMode = "AFR";
      if (mushafLabel) mushafLabel.innerText = "AFR";
    } else {
      mushafMode = "MDN";
      if (mushafLabel) mushafLabel.innerText = "MDN";
    }
    currentPage = 1;
    loadQuranPage(currentPage);
  });
}

if (btnToggleHide) {
  btnToggleHide.addEventListener("click", () => {
    isTextHidden = !isTextHidden;
    if (isTextHidden) {
      mushafPage.classList.add("text-hidden");
      if (transcriptStatus) transcriptStatus.innerText = "Mode sembunyi aktif. Tekan Mic dan mulai baca!";
    } else {
      mushafPage.classList.remove("text-hidden");
      if (transcriptStatus) transcriptStatus.innerText = "Geser atau tap sisi layar untuk mengganti halaman...";
    }
  });
}

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

document.addEventListener("touchstart", e => {
  if (e.target.closest('.bottom-dock') || e.target.closest('button') || e.target.closest('#juzSidebar')) return;
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
});

document.addEventListener("touchend", e => {
  if (e.target.closest('.bottom-dock') || e.target.closest('button') || e.target.closest('#juzSidebar')) return;
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
  
  if (mushafCard) mushafCard.classList.add(dir === "next" ? "flip-next" : "flip-prev");
  setTimeout(() => {
    loadQuranPage(currentPage);
    if (mushafCard) mushafCard.classList.remove("flip-next", "flip-prev");
  }, 300);
}

// ==========================================
// CONTINUOUS AUDIO RECORDING & WORKER PROXY (PERBAIKAN FULL)
// ==========================================

async function startMurojaahMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 512;

    // Pilihan MIME Type HP yang aman
    let options = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options = { mimeType: 'audio/webm;codecs=opus' };
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' };
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options = { mimeType: 'audio/mp4' };
    }

    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: options.mimeType || 'audio/webm' });
      audioChunks = [];

      if (audioBlob.size > 1200 && isMicActive && !isProcessing) {
        await sendToMurojaahProxy(audioBlob);
      } else {
        isProcessing = false;
      }

      if (isMicActive && mediaRecorder && mediaRecorder.state === "inactive") {
        try {
          mediaRecorder.start();
        } catch (err) {
          console.error("Error restart recorder:", err);
        }
      }
    };

    mediaRecorder.start();
    isMicActive = true;
    isProcessing = false;
    if (btnMic) btnMic.classList.add("recording");
    if (transcriptStatus) transcriptStatus.innerText = "Mendengarkan... Silakan baca ayat!";

    detectSilence();

  } catch (err) {
    console.error("Gagal mengakses mic:", err);
    alert("Izin mikrofon ditolak atau browser tidak mendukung perekaman audio.");
    stopMurojaahMic();
  }
}

function detectSilence() {
  if (!isMicActive || !analyser) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  let average = sum / dataArray.length;

  if (average < SILENCE_THRESHOLD) {
    if (!silenceTimer && mediaRecorder && mediaRecorder.state === "recording" && !isProcessing) {
      silenceTimer = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
        silenceTimer = null;
      }, SILENCE_DURATION);
    }
  } else {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  if (isMicActive) {
    requestAnimationFrame(detectSilence);
  }
}

async function sendToMurojaahProxy(audioBlob) {
  if (isProcessing) return;
  isProcessing = true; // Kunci proses

  const formData = new FormData();
  formData.append("file", audioBlob, "speech.webm");

  try {
    if (transcriptStatus) transcriptStatus.innerText = "Memverifikasi bacaan (Groq AI)...";

    const response = await fetch(MUROJAAH_WORKER_URL, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const data = await response.json();

    if (data.text && data.text.trim().length > 0) {
      console.log("Transkrip AI:", data.text);
      if (transcriptStatus) transcriptStatus.innerText = "Terdeteksi: " + data.text;
      
      validateMurojaahVerse(data.text);
    } else {
      if (transcriptStatus) transcriptStatus.innerText = "Mendengarkan bacaan...";
    }
  } catch (error) {
    console.error("Murojaah Proxy Error:", error);
    if (transcriptStatus) transcriptStatus.innerText = "Gagal terhubung, mencoba lagi...";
  } finally {
    // KUNCI UTAMA: Reset flag isProcessing agar siklus rekaman berikutnya tidak pernah terkunci
    isProcessing = false;
  }
}

function stopMurojaahMic() {
  isMicActive = false;
  isProcessing = false;
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.stop();
    } catch (e) {}
  }
  
  if (mediaRecorder && mediaRecorder.stream) {
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  if (audioContext && audioContext.state !== "closed") {
    try {
      audioContext.close();
    } catch (e) {}
  }
  
  if (btnMic) btnMic.classList.remove("recording");
  if (transcriptStatus) transcriptStatus.innerText = "Mic dimatikan.";
}

// ==========================================
// LOGIKA VALIDASI BACAAN AYAT (BERTAHAP / PER KATA)
// ==========================================
function validateMurojaahVerse(spokenText) {
  if (!isTextHidden) return;

  const verseElements = mushafPage.querySelectorAll('.verse-block');
  if (verseElements.length === 0) return;

  const targetVerse = verseElements[currentVerseIndex];
  if (!targetVerse) {
    if (transcriptStatus) transcriptStatus.innerText = "Halaman ini sudah selesai dibaca!";
    return;
  }

  const wordNodes = targetVerse.querySelectorAll('.verse-word');
  if (wordNodes.length === 0) return;

  // Bersihkan teks bacaan user
  const speechClean = cleanArabicText(spokenText);
  const speechWords = speechClean.split(" ").filter(w => w.length > 0);

  // Cek kata demi kata di ayat target yang cocok dengan kata yang diucapkan user
  let matchedCount = 0;
  
  wordNodes.forEach((wordNode) => {
    const targetWord = cleanArabicText(wordNode.textContent || wordNode.innerText);
    
    // Jika kata ini sudah terbuka sebelumnya ATAU cocok dengan ucapan user
    if (wordNode.classList.contains('word-revealed')) {
      matchedCount++;
    } else {
      const isWordMatch = speechWords.some(sWord => sWord === targetWord || (targetWord.length > 2 && sWord.includes(targetWord)));
      if (isWordMatch) {
        wordNode.classList.add('word-revealed'); // Terbuka hijau per kata/frasa
        matchedCount++;
      }
    }
  });

  const progressRatio = matchedCount / wordNodes.length;
  console.log(`Progress Ayat Ke-${currentVerseIndex + 1}: ${matchedCount}/${wordNodes.length} kata (${(progressRatio * 100).toFixed(0)}%)`);

  // Jika minimal 65% kata dalam ayat tersebut sudah terbuka atau hampir selesai seluruhnya
  if (progressRatio >= 0.65 || matchedCount >= wordNodes.length - 1) {
    // Tandai seluruh ayat selesai
    targetVerse.classList.remove("verse-error");
    targetVerse.classList.add("verse-revealed");
    
    // Pastikan semua kata dalam ayat ini ikut hijau
    wordNodes.forEach(w => w.classList.add('word-revealed'));

    currentVerseIndex++; // Pindah pointer ke ayat berikutnya
    if (transcriptStatus) {
      transcriptStatus.innerText = `Sempurna! Lanjut ke ayat ke-${currentVerseIndex + 1}.`;
    }
  } else if (matchedCount > 0) {
    // Baru sebagian kata yang benar (bertahap)
    if (transcriptStatus) {
      transcriptStatus.innerText = `Bagus, lanjutkan potongan ayat berikutnya... (${matchedCount}/${wordNodes.length} kata)`;
    }
  } else {
    // Belum ada kata yang cocok
    if (navigator.vibrate) navigator.vibrate(100);
    if (transcriptStatus) {
      transcriptStatus.innerText = `Belum tepat, silakan ulangi bacaan potongan ayat!`;
    }
  }
}

// Handler Tombol Mic
if (btnMic) {
  btnMic.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMicActive) {
      stopMurojaahMic();
    } else {
      startMurojaahMic();
    }
  });
}

// Inisialisasi Pertama
document.addEventListener("DOMContentLoaded", () => {
  loadQuranPage(currentPage);
});
