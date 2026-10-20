// ==========================================
// CONFIG & STATE APLIKASI
// ==========================================
const MUROJAAH_WORKER_URL = "https://murojaah-proxy.rkidul416.workers.dev/";

let currentPage = 1;
let mushafMode = "MDN"; // "MDN" = Madinah (15 baris), "AFR" = Afrika (18 baris)
let isTextHidden = false;
let currentVerseIndex = 0; // Pointer pelacak urutan AYAT yang harus dibaca

// State Perekam Audio & VAD
let mediaRecorder = null;
let audioChunks = [];
let isMicActive = false;
let isProcessing = false; // Flag penting untuk mencegah spamming request
let audioContext = null;
let analyser = null;
let microphone = null;
let silenceTimer = null;
const SILENCE_THRESHOLD = 15; // Ambang batas suara/kebisingan
const SILENCE_DURATION = 900;  // Waktu hening (ms) pemicu kirim ke AI (0.9 detik)

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
  
  if (mushafCard) mushafCard.classList.add(dir === "next" ? "flip-next" : "flip-prev");
  setTimeout(() => {
    loadQuranPage(currentPage);
    if (mushafCard) mushafCard.classList.remove("flip-next", "flip-prev");
  }, 300);
}

// ==========================================
// CONTINUOUS AUDIO RECORDING & WORKER PROXY
// ==========================================

async function startMurojaahMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Deteksi VAD Audio Context untuk Jeda Napas
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 512;

    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      options = MediaRecorder.isTypeSupported('audio/mp4') ? { mimeType: 'audio/mp4' } : {};
    }

    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: options.mimeType || 'audio/webm' });
      audioChunks = [];

      // Kirim audio jika ukuran cukup dan tidak dalam keadaan memproses
      if (audioBlob.size > 2000 && isMicActive && !isProcessing) {
        await sendToMurojaahProxy(audioBlob);
      }

      // Lanjut rekam otomatis untuk ayat berikutnya jika mic masih menyala
      if (isMicActive && mediaRecorder.state === "inactive") {
        mediaRecorder.start();
      }
    };

    mediaRecorder.start();
    isMicActive = true;
    if (btnMic) btnMic.classList.add("recording");
    if (transcriptStatus) transcriptStatus.innerText = "Mendengarkan... Silakan baca ayat!";

    detectSilence();

  } catch (err) {
    console.error("Gagal mengakses mic:", err);
    alert("Izin mikrofon ditolak atau browser tidak mendukung perekaman audio.");
  }
}

function detectSilence() {
  if (!isMicActive) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  let average = sum / dataArray.length;

  if (average < SILENCE_THRESHOLD) {
    // Pengguna hening / jeda napas
    if (!silenceTimer && mediaRecorder && mediaRecorder.state === "recording" && !isProcessing) {
      silenceTimer = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
        silenceTimer = null;
      }, SILENCE_DURATION);
    }
  } else {
    // Pengguna masih membaca
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
  isProcessing = true; // Kunci proses agar tidak spamming

  const formData = new FormData();
  formData.append("file", audioBlob, "speech.webm");

  try {
    if (transcriptStatus) transcriptStatus.innerText = "Memverifikasi bacaan (Groq AI)...";

    // Kirim audio ke Worker Proxy Khusus Murojaah
    const response = await fetch(MUROJAAH_WORKER_URL, {
      method: "POST",
      body: formData
    });

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
    if (transcriptStatus) transcriptStatus.innerText = "Gagal terhubung ke server Murojaah.";
  } finally {
    isProcessing = false; // Buka kunci proses untuk ayat berikutnya
  }
}

function stopMurojaahMic() {
  isMicActive = false;
  isProcessing = false;
  if (silenceTimer) clearTimeout(silenceTimer);
  
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  if (audioContext) audioContext.close();
  
  if (btnMic) btnMic.classList.remove("recording");
  if (transcriptStatus) transcriptStatus.innerText = "Mic dimatikan.";
}

// ==========================================
// LOGIKA VALIDASI BACAAN AYAT
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
  let targetWordsArray = [];
  wordNodes.forEach(w => {
    // PERBAIKAN: Menggunakan textContent agar teks tetap terbaca JS meskipun tersembunyi secara visual
    const cleanW = cleanArabicText(w.textContent || w.innerText);
    if (cleanW.length > 0) targetWordsArray.push(cleanW);
  });

  const targetVerseClean = targetWordsArray.join(" ");
  const speechWordsArray = cleanArabicText(spokenText).split(" ").filter(w => w.length > 0);

  let exactWordMatches = 0;
  targetWordsArray.forEach(word => {
    if (speechWordsArray.some(sWord => sWord.includes(word) || word.includes(sWord))) {
      exactWordMatches++;
    }
  });

  const letterSimilarity = getLetterSimilarity(spokenText, targetVerseClean);
  const wordMatchRatio = targetWordsArray.length > 0 ? (exactWordMatches / targetWordsArray.length) : 0;

  // Syarat Lolos: Minimal 35% kata cocok ATAU kemiripan huruf 50%
  const isMatched = (wordMatchRatio >= 0.35) || (letterSimilarity >= 0.50);

  console.log(`Target Verse [${currentVerseIndex + 1}]: "${targetVerseClean}"`);
  console.log(`Match Score -> Word: ${(wordMatchRatio * 100).toFixed(0)}% | Letter: ${(letterSimilarity * 100).toFixed(0)}%`);

  if (isMatched) {
    targetVerse.classList.remove("verse-error");
    targetVerse.classList.add("verse-revealed");
    
    currentVerseIndex++; // Lanjut ke ayat berikutnya

    if (transcriptStatus) {
      transcriptStatus.innerText = `Benar! Ayat ke-${currentVerseIndex} terbuka.`;
    }
  } else {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    targetVerse.classList.add("verse-error");
    setTimeout(() => {
      targetVerse.classList.remove("verse-error");
    }, 1500);

    if (transcriptStatus) {
      transcriptStatus.innerText = `Belum tepat (Cocok: ${(wordMatchRatio * 100).toFixed(0)}%), coba ulangi!`;
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
