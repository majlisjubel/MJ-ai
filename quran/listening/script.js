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

// 1. Fetch Daftar Qari Lengkap & Tambahkan Qari Favorit Khusus
async function loadReciters() {
  try {
    reciterSelect.innerHTML = `<option value="">Memuat daftar Qari...</option>`;
    const res = await fetch("https://api.quran.com/api/v4/resources/recitations");
    const data = await res.json();
    
    if (data.recitations && data.recitations.length > 0) {
      reciterSelect.innerHTML = "";

      // Urutkan nama Qari dari API sesuai abjad
      const sortedReciters = data.recitations.sort((a, b) => 
        (a.reciter_name || a.translated_name.name).localeCompare(b.reciter_name || b.translated_name.name)
      );

      // Tambahkan Qari dari API ke dropdown
      sortedReciters.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        const style = r.style ? ` (${r.style})` : "";
        opt.textContent = `${r.reciter_name || r.translated_name.name}${style}`;
        
        // Default set ke Mishary Rashid Alafasy
        if (r.id === 7) opt.selected = true;
        
        reciterSelect.appendChild(opt);
      });

      // Pastikan Syeikh Al-Juhany & Badr Al-Turki terdaftar
      checkAndAddCustomReciters(data.recitations);
    }
  } catch (err) {
    console.error("Gagal memuat daftar Qari:", err);
    reciterSelect.innerHTML = `
      <option value="7" selected>Mishary Rashid Alafasy</option>
      <option value="13">Abdullah Awad Al-Juhany</option>
      <option value="161">Badr Al-Turki</option>
    `;
  }
}

// Fungsi pembantu untuk memastikan Syeikh Al-Juhany dan Badr Al-Turki ada di opsi
function checkAndAddCustomReciters(recitationsList) {
  // ID Qari di Quran.com API:
  // Abdullah Awad Al-Juhany -> ID 13
  // Badr Al-Turki -> ID 161 (atau dicari via nama)

  const hasJuhany = recitationsList.some(r => r.id === 13 || (r.reciter_name && r.reciter_name.toLowerCase().includes("juhany")));
  const hasTurki = recitationsList.some(r => r.id === 161 || (r.reciter_name && r.reciter_name.toLowerCase().includes("badr")));

  if (!hasJuhany) {
    const optJuhany = document.createElement("option");
    optJuhany.value = "13";
    optJuhany.textContent = "Abdullah Awad Al-Juhany";
    reciterSelect.insertBefore(optJuhany, reciterSelect.firstChild);
  }

  if (!hasTurki) {
    const optTurki = document.createElement("option");
    optTurki.value = "161"; 
    optTurki.textContent = "Badr Al-Turki";
    reciterSelect.insertBefore(optTurki, reciterSelect.firstChild);
  }
}

// 2. Ambil Daftar Surah dari API Quran.com
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

    // Load Audio pertama kali
    loadAudioSource();
  } catch (err) {
    console.error("Gagal memuat daftar surah:", err);
  }
}

// 3. Ambil Link Audio Berdasarkan Qari & Surah yang Dipilih
async function loadAudioSource() {
  const surahId = surahSelect.value || 1;
  const reciterId = reciterSelect.value || 7;

  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${surahId}`);
    const data = await res.json();

    if (data.audio_file && data.audio_file.audio_url) {
      audioPlayer.src = data.audio_file.audio_url;
      
      // Update Judul & Qari di Tampilan
      const currentChapter = chaptersList.find(c => c.id == surahId);
      if (currentChapter) {
        currentSurahTitle.textContent = currentChapter.name_simple;
      }
      if (reciterSelect.options[reciterSelect.selectedIndex]) {
        currentReciterName.textContent = reciterSelect.options[reciterSelect.selectedIndex].text;
      }

      if (isPlaying) {
        audioPlayer.play();
      }
    } else {
      // Fallback jika reciter belum punya rekaman full surah ini
      alert("Audio untuk Qari ini pada surah tersebut tidak tersedia.");
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
    audioPlayer.play();
    isPlaying = true;
    btnPlay.textContent = "⏸";
    if (vinylDisk) vinylDisk.classList.add("spinning");
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

// Otomatis lanjut ke surah berikutnya saat audio selesai
audioPlayer.addEventListener("ended", () => {
  btnNext.click();
});

// Inisialisasi awal saat halaman dibuka
document.addEventListener("DOMContentLoaded", async () => {
  await loadReciters();
  await loadChapters();
});
