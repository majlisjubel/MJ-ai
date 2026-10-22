const audioPlayer = document.getElementById("audioPlayer");
const surahSelect = document.getElementById("surahSelect");
const reciterSelect = document.getElementById("reciterSelect");
const btnPlay = document.getElementById("btnPlay");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnSpeed = document.getElementById("btnSpeed");
const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const totalDurationEl = document.getElementById("totalDuration");
const currentSurahTitle = document.getElementById("currentSurahTitle");
const currentReciterName = document.getElementById("currentReciterName");
const vinylDisk = document.getElementById("vinylDisk");

let chaptersList = [];
let isPlaying = false;
let currentPlaybackSpeed = 1.0;

// 1. Fetch Daftar Qari Lengkap & Sisipkan Syekh Saud Al-Jumaa
async function loadReciters() {
  try {
    reciterSelect.innerHTML = `<option value="">Memuat daftar Qari...</option>`;
    const res = await fetch("https://api.quran.com/api/v4/resources/recitations");
    const data = await res.json();
    
    reciterSelect.innerHTML = "";

    // 🌟 1. Tambahkan Syekh Saud Al-Jumaa di Paling Atas (Full 30 Juz)
    const optSaud = document.createElement("option");
    optSaud.value = "saud_jumaa";
    optSaud.textContent = "Saud Al-Jumaa (سعود آل جمعة) - Full 30 Juz";
    reciterSelect.appendChild(optSaud);

    if (data.recitations && data.recitations.length > 0) {
      // Urutkan Qari API berdasarkan nama
      const sortedReciters = data.recitations.sort((a, b) => 
        (a.reciter_name || a.translated_name.name).localeCompare(b.reciter_name || b.translated_name.name)
      );

      // 🌟 2. Masukkan Qari API (Termasuk Al-Juhany & Badr Al-Turki)
      sortedReciters.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        const style = r.style ? ` (${r.style})` : "";
        opt.textContent = `${r.reciter_name || r.translated_name.name}${style}`;
        reciterSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Gagal memuat daftar Qari API:", err);
    reciterSelect.innerHTML = `
      <option value="saud_jumaa">Saud Al-Jumaa (سعود آل جمعة)</option>
      <option value="7">Mishary Rashid Alafasy</option>
      <option value="13">Abdullah Awad Al-Juhany</option>
    `;
  }
}

// 2. Ambil Daftar 114 Surah (Full 30 Juz)
async function loadChapters() {
  try {
    const res = await fetch("https://api.quran.com/api/v4/chapters");
    const data = await res.json();
    chaptersList = data.chapters;

    surahSelect.innerHTML = "";
    chaptersList.forEach(ch => {
      const opt = document.createElement("option");
      opt.value = ch.id;
      opt.textContent = `${ch.id}. ${ch.name_simple} (${ch.translated_name.name}) - ${ch.verses_count} Ayat`;
      surahSelect.appendChild(opt);
    });

    // Otomatis load audio pertama kali
    loadAudioSource();
  } catch (err) {
    console.error("Gagal memuat daftar surah:", err);
  }
}

// 3. Ambil Link Audio Berdasarkan Qari & Surah yang Dipilih
async function loadAudioSource() {
  const surahId = surahSelect.value || 1;
  const reciterId = reciterSelect.value || "saud_jumaa";

  const currentChapter = chaptersList.find(c => c.id == surahId);
  if (currentChapter) {
    currentSurahTitle.textContent = currentChapter.name_simple;
  }

  // 🔴 CASE KHUSUS: Syekh Saud Al-Jumaa (Custom Server mp3quran - 30 Juz)
  if (reciterId === "saud_jumaa") {
    const paddedSurah = String(surahId).padStart(3, '0');
    audioPlayer.src = `https://server11.mp3quran.net/saud_jumaa/${paddedSurah}.mp3`;
    currentReciterName.textContent = "Saud Al-Jumaa (سعود آل جمعة)";

    if (isPlaying) audioPlayer.play();
    return;
  }

  // 🟢 CASE UMUM: Qari dari API Quran.com
  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${surahId}`);
    const data = await res.json();

    if (data.audio_file && data.audio_file.audio_url) {
      audioPlayer.src = data.audio_file.audio_url;
      if (reciterSelect.options[reciterSelect.selectedIndex]) {
        currentReciterName.textContent = reciterSelect.options[reciterSelect.selectedIndex].text;
      }

      if (isPlaying) audioPlayer.play();
    } else {
      alert("Audio untuk Surah ini belum tersedia untuk Qari tersebut.");
    }
  } catch (e) {
    console.error("Gagal memuat audio murottal:", e);
  }
}

// 4. Kontrol Tombol Play / Pause
function togglePlay() {
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    btnPlay.textContent = "▶";
    if (vinylDisk) vinylDisk.classList.remove("spinning");
  } else {
    audioPlayer.play().then(() => {
      isPlaying = true;
      btnPlay.textContent = "⏸";
      if (vinylDisk) vinylDisk.classList.add("spinning");
    }).catch(err => {
      console.error("Gagal memutar audio:", err);
    });
  }
}

// Format Waktu (detik ke mm:ss)
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Event Listeners Controls
btnPlay.addEventListener("click", togglePlay);

surahSelect.addEventListener("change", () => {
  loadAudioSource();
});

reciterSelect.addEventListener("change", () => {
  loadAudioSource();
});

// Update Progress Bar
audioPlayer.addEventListener("timeupdate", () => {
  if (!isNaN(audioPlayer.duration)) {
    const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = progressPercent;
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    totalDurationEl.textContent = formatTime(audioPlayer.duration);
  }
});

// Seek Bar Control
progressBar.addEventListener("input", () => {
  if (!isNaN(audioPlayer.duration)) {
    const seekTime = (progressBar.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  }
});

// Tombol Next & Prev Surah
btnNext.addEventListener("click", () => {
  let nextId = parseInt(surahSelect.value) + 1;
  if (nextId > 114) nextId = 1;
  surahSelect.value = nextId;
  loadAudioSource();
});

btnPrev.addEventListener("click", () => {
  let prevId = parseInt(surahSelect.value) - 1;
  if (prevId < 1) prevId = 114;
  surahSelect.value = prevId;
  loadAudioSource();
});

// Kontrol Speed
btnSpeed.addEventListener("click", () => {
  if (currentPlaybackSpeed === 1.0) currentPlaybackSpeed = 1.25;
  else if (currentPlaybackSpeed === 1.25) currentPlaybackSpeed = 1.5;
  else if (currentPlaybackSpeed === 1.5) currentPlaybackSpeed = 0.75;
  else currentPlaybackSpeed = 1.0;

  audioPlayer.playbackRate = currentPlaybackSpeed;
  btnSpeed.textContent = `${currentPlaybackSpeed}x`;
});

// Otomatis pindah ke surah berikutnya saat audio selesai
audioPlayer.addEventListener("ended", () => {
  btnNext.click();
});

// Inisialisasi awal saat web dibuka
document.addEventListener("DOMContentLoaded", async () => {
  await loadReciters();
  await loadChapters();
});
