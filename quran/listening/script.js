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

// 1. Fetch Daftar Qari
async function loadReciters() {
  try {
    reciterSelect.innerHTML = `<option value="">Memuat daftar Qari...</option>`;
    const res = await fetch("https://api.quran.com/api/v4/resources/recitations");
    const data = await res.json();
    
    reciterSelect.innerHTML = "";

    // 🌟 Syekh Saud Al-Jumaa (Custom High-Speed CDN)
    const optSaud = document.createElement("option");
    optSaud.value = "saud_jumaa";
    optSaud.textContent = "Saud Al-Jumaa (سعود آل جمعة) - Full 30 Juz";
    reciterSelect.appendChild(optSaud);

    if (data.recitations && data.recitations.length > 0) {
      const sortedReciters = data.recitations.sort((a, b) => 
        (a.reciter_name || a.translated_name.name).localeCompare(b.reciter_name || b.translated_name.name)
      );

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

// 2. Ambil Daftar Surah
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

    loadAudioSource(false);
  } catch (err) {
    console.error("Gagal memuat daftar surah:", err);
  }
}

// 3. Ambil Audio Source (Fix CORS & HTTPS)
async function loadAudioSource(autoPlay = true) {
  const surahId = surahSelect.value || 1;
  const reciterId = reciterSelect.value || "saud_jumaa";

  const currentChapter = chaptersList.find(c => c.id == surahId);
  if (currentChapter) {
    currentSurahTitle.textContent = currentChapter.name_simple;
  }

  // Reset audio
  audioPlayer.pause();
  audioPlayer.currentTime = 0;

  // 🟢 SYEKH SAUD AL-JUMAA (Menggunakan CDN HTTPS Resmi QuranCentral)
  if (reciterId === "saud_jumaa") {
    const paddedSurah = String(surahId).padStart(3, '0');
    // CDN ini dipastikan mendukung HTTPS & CORS dari semua domain web
    audioPlayer.src = `https://download.quranicaudio.com/quran/saud_al-juma'ah/${paddedSurah}.mp3`;
    currentReciterName.textContent = "Saud Al-Jumaa (سعود آل جمعة)";

    if (autoPlay || isPlaying) playAudio();
    return;
  }

  // 🟢 QARI LAIN DARI API QURAN.COM
  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${surahId}`);
    const data = await res.json();

    if (data.audio_file && data.audio_file.audio_url) {
      audioPlayer.src = data.audio_file.audio_url;
      if (reciterSelect.options[reciterSelect.selectedIndex]) {
        currentReciterName.textContent = reciterSelect.options[reciterSelect.selectedIndex].text;
      }

      if (autoPlay || isPlaying) playAudio();
    } else {
      alert("Audio tidak tersedia untuk Qari ini.");
    }
  } catch (e) {
    console.error("Gagal memuat audio murottal:", e);
  }
}

// 4. Logika Play & Pause
function playAudio() {
  audioPlayer.playbackRate = currentPlaybackSpeed;
  const playPromise = audioPlayer.play();
  
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
      btnPlay.textContent = "⏸";
      if (vinylDisk) vinylDisk.classList.add("spinning");
    }).catch(error => {
      console.warn("Menunggu interaksi klik tombol:", error);
      isPlaying = false;
      btnPlay.textContent = "▶";
      if (vinylDisk) vinylDisk.classList.remove("spinning");
    });
  }
}

function pauseAudio() {
  audioPlayer.pause();
  isPlaying = false;
  btnPlay.textContent = "▶";
  if (vinylDisk) vinylDisk.classList.remove("spinning");
}

function togglePlay() {
  if (isPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

// Format Waktu mm:ss
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Event Listeners
btnPlay.addEventListener("click", togglePlay);

surahSelect.addEventListener("change", () => {
  loadAudioSource(isPlaying);
});

reciterSelect.addEventListener("change", () => {
  loadAudioSource(isPlaying);
});

// Update Progress Bar
audioPlayer.addEventListener("timeupdate", () => {
  if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
    const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = progressPercent;
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    totalDurationEl.textContent = formatTime(audioPlayer.duration);
  }
});

progressBar.addEventListener("input", () => {
  if (!isNaN(audioPlayer.duration)) {
    const seekTime = (progressBar.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  }
});

btnNext.addEventListener("click", () => {
  let nextId = parseInt(surahSelect.value) + 1;
  if (nextId > 114) nextId = 1;
  surahSelect.value = nextId;
  loadAudioSource(true);
});

btnPrev.addEventListener("click", () => {
  let prevId = parseInt(surahSelect.value) - 1;
  if (prevId < 1) prevId = 114;
  surahSelect.value = prevId;
  loadAudioSource(true);
});

btnSpeed.addEventListener("click", () => {
  if (currentPlaybackSpeed === 1.0) currentPlaybackSpeed = 1.25;
  else if (currentPlaybackSpeed === 1.25) currentPlaybackSpeed = 1.5;
  else if (currentPlaybackSpeed === 1.5) currentPlaybackSpeed = 0.75;
  else currentPlaybackSpeed = 1.0;

  audioPlayer.playbackRate = currentPlaybackSpeed;
  btnSpeed.textContent = `${currentPlaybackSpeed}x`;
});

audioPlayer.addEventListener("ended", () => {
  btnNext.click();
});

audioPlayer.addEventListener("error", (e) => {
  console.error("Gagal memuat file audio MP3:", e);
  pauseAudio();
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadReciters();
  await loadChapters();
});
