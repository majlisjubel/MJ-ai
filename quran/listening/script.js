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

// 1. Ambil Daftar Surah dari API Quran.com
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

    // Otomatis muat surah pertama (Al-Fatihah)
    loadAudioSource();
  } catch (err) {
    console.error("Gagal memuat daftar surah:", err);
  }
}

// 2. Ambil Link Audio Berdasarkan Qari & Surah yang Dipilih
async function loadAudioSource() {
  const surahId = surahSelect.value || 1;
  const reciterId = reciterSelect.value || 7;

  try {
    // API Chapter Recitations dari Quran.com
    const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${surahId}`);
    const data = await res.json();

    if (data.audio_file && data.audio_file.audio_url) {
      audioPlayer.src = data.audio_file.audio_url;
      
      // Update Judul di Tampilan
      const currentChapter = chaptersList.find(c => c.id == surahId);
      if (currentChapter) {
        currentSurahTitle.textContent = currentChapter.name_simple;
      }
      currentReciterName.textContent = reciterSelect.options[reciterSelect.selectedIndex].text;

      if (isPlaying) {
        audioPlayer.play();
      }
    }
  } catch (e) {
    console.error("Gagal memuat audio murottal:", e);
  }
}

// 3. Kontrol Tombol Play / Pause
function togglePlay() {
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    btnPlay.textContent = "▶";
    vinylDisk.classList.remove("spinning");
  } else {
    audioPlayer.play();
    isPlaying = true;
    btnPlay.textContent = "⏸";
    vinylDisk.classList.add("spinning");
  }
}

// Format Waktu Audio (detik ke mm:ss)
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Event Listeners
btnPlay.addEventListener("click", togglePlay);

surahSelect.addEventListener("change", () => {
  loadAudioSource();
  if (isPlaying) audioPlayer.play();
});

reciterSelect.addEventListener("change", () => {
  loadAudioSource();
  if (isPlaying) audioPlayer.play();
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

// Geser Progress Bar
progressBar.addEventListener("input", () => {
  if (!isNaN(audioPlayer.duration)) {
    const seekTime = (progressBar.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  }
});

// Tombol Next / Prev Surah
btnNext.addEventListener("click", () => {
  let nextId = parseInt(surahSelect.value) + 1;
  if (nextId > 114) nextId = 1;
  surahSelect.value = nextId;
  loadAudioSource();
  if (isPlaying) audioPlayer.play();
});

btnPrev.addEventListener("click", () => {
  let prevId = parseInt(surahSelect.value) - 1;
  if (prevId < 1) prevId = 114;
  surahSelect.value = prevId;
  loadAudioSource();
  if (isPlaying) audioPlayer.play();
});

// Kontrol Kecepatan (Speed 1.0x -> 1.25x -> 1.5x -> 0.75x)
btnSpeed.addEventListener("click", () => {
  if (currentPlaybackSpeed === 1.0) {
    currentPlaybackSpeed = 1.25;
  } else if (currentPlaybackSpeed === 1.25) {
    currentPlaybackSpeed = 1.5;
  } else if (currentPlaybackSpeed === 1.5) {
    currentPlaybackSpeed = 0.75;
  } else {
    currentPlaybackSpeed = 1.0;
  }
  audioPlayer.playbackRate = currentPlaybackSpeed;
  btnSpeed.textContent = `${currentPlaybackSpeed}x`;
});

// Saat audio selesai, otomatis lanjut ke surah berikutnya
audioPlayer.addEventListener("ended", () => {
  btnNext.click();
});

// Inisialisasi awal saat halaman dibuka
document.addEventListener("DOMContentLoaded", () => {
  loadChapters();
});

