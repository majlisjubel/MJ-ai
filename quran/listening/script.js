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
let allVersesMapping = {}; // Untuk mapping juz ke surah
let isPlaying = false;
let currentPlaybackSpeed = 1.0;

// Buat elemen filter Juz secara dinamis di atas select surah
function setupJuzFilterUI() {
  const surahParent = surahSelect.parentElement;
  
  // Cek kalau elemen juz belum ada, kita buat
  if (!document.getElementById("juzSelect")) {
    const juzDiv = document.createElement("div");
    juzDiv.style.marginBottom = "10px";
    juzDiv.innerHTML = `
      <label for="juzSelect" style="font-size: 0.75rem; color: #888; display: block; margin-bottom: 4px;">Pilih Juz:</label>
      <select id="juzSelect" style="width: 100%; padding: 10px 14px; background: #1a1a20; border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 12px; font-size: 0.9rem; outline: none;">
        <option value="all">Semua Juz (1 - 114)</option>
        ${Array.from({length: 30}, (_, i) => `<option value="${i+1}">Juz ${i+1}</option>`).join('')}
      </select>
    `;
    surahParent.insertBefore(juzDiv, surahSelect);

    document.getElementById("juzSelect").addEventListener("change", (e) => {
      filterSurahByJuz(e.target.value);
    });
  }
}

// 1. Load Daftar Qari
async function loadReciters() {
  try {
    reciterSelect.innerHTML = `<option value="">Memuat daftar Qari...</option>`;
    const res = await fetch("https://api.quran.com/api/v4/resources/recitations");
    const data = await res.json();
    
    reciterSelect.innerHTML = "";

    const optSaud = document.createElement("option");
    optSaud.value = "saud_jumaa";
    optSaud.textContent = "Saud Al-Jumaa (Full 30 Juz)";
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
    console.error("Gagal memuat Qari:", err);
    reciterSelect.innerHTML = `<option value="saud_jumaa">Saud Al-Jumaa</option><option value="7">Mishary Rashid Alafasy</option>`;
  }
}

// 2. Load Daftar Surah (Simpel & Bahasa Indonesia / Tanpa Inggris)
async function loadChapters() {
  try {
    setupJuzFilterUI();

    const res = await fetch("https://api.quran.com/api/v4/chapters?language=id");
    const data = await res.json();
    chaptersList = data.chapters;

    renderSurahOptions(chaptersList);
    loadAudioSource(false);
  } catch (err) {
    console.error("Gagal memuat surah:", err);
  }
}

// Render option surah dengan teks bersih (contoh: "1. Al-Fatihah - 7 Ayat")
function renderSurahOptions(list) {
  surahSelect.innerHTML = "";
  list.forEach(ch => {
    const opt = document.createElement("option");
    opt.value = ch.id;
    // Menggunakan nama sederhana/terjemahan bahasa Indonesia tanpa teks inggris panjang
    const namaSurah = ch.name_simple || ch.name_arabic;
    opt.textContent = `${ch.id}. ${namaSurah} - ${ch.verses_count} Ayat`;
    surahSelect.appendChild(opt);
  });
}

// Filter surah berdasarkan pilihan Juz
async function filterSurahByJuz(juzId) {
  if (juzId === "all") {
    renderSurahOptions(chaptersList);
    loadAudioSource(true);
    return;
  }

  try {
    const res = await fetch(`https://api.quran.com/api/v4/juzs/${juzId}`);
    const data = await res.json();
    
    // Ambil daftar ID surah yang ada di juz tersebut
    const surahIdsInJuz = Object.keys(data.juz.verse_mapping).map(Number);
    
    const filteredList = chaptersList.filter(ch => surahIdsInJuz.includes(ch.id));
    renderSurahOptions(filteredList);
    loadAudioSource(true);
  } catch (e) {
    console.error("Gagal memfilter juz:", e);
  }
}

// 3. Load Audio Source
async function loadAudioSource(shouldPlay = true) {
  const surahId = surahSelect.value || 1;
  const reciterId = reciterSelect.value || "saud_jumaa";

  const currentChapter = chaptersList.find(c => c.id == surahId);
  if (currentChapter) {
    currentSurahTitle.textContent = currentChapter.name_simple;
  }

  audioPlayer.pause();
  audioPlayer.currentTime = 0;

  if (reciterSelect.options[reciterSelect.selectedIndex]) {
    currentReciterName.textContent = reciterSelect.options[reciterSelect.selectedIndex].text;
  }

  if (reciterId === "saud_jumaa") {
    const paddedSurah = String(surahId).padStart(3, '0');
    audioPlayer.src = `https://server11.mp3quran.net/saud_jumaa/${paddedSurah}.mp3`;
    audioPlayer.crossOrigin = "anonymous";

    if (shouldPlay) playAudio();
    return;
  }

  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${surahId}`);
    const data = await res.json();

    if (data.audio_file && data.audio_file.audio_url) {
      audioPlayer.src = data.audio_file.audio_url;
      if (shouldPlay) playAudio();
    } else {
      alert("Audio surah ini belum tersedia untuk Qari tersebut.");
    }
  } catch (e) {
    console.error("Gagal mengambil link audio:", e);
  }
}

// 4. Controller Play & Pause
function playAudio() {
  audioPlayer.playbackRate = currentPlaybackSpeed;
  const playPromise = audioPlayer.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
      btnPlay.textContent = "⏸";
      if (vinylDisk) vinylDisk.classList.add("spinning");
    }).catch(error => {
      console.warn("Butuh klik user:", error);
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
  if (isPlaying) pauseAudio();
  else playAudio();
}

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
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
  const currentIndex = surahSelect.selectedIndex;
  if (currentIndex < surahSelect.options.length - 1) {
    surahSelect.selectedIndex = currentIndex + 1;
  } else {
    surahSelect.selectedIndex = 0;
  }
  loadAudioSource(true);
});

btnPrev.addEventListener("click", () => {
  const currentIndex = surahSelect.selectedIndex;
  if (currentIndex > 0) {
    surahSelect.selectedIndex = currentIndex - 1;
  } else {
    surahSelect.selectedIndex = surahSelect.options.length - 1;
  }
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

audioPlayer.addEventListener("error", () => {
  pauseAudio();
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadReciters();
  await loadChapters();
});
