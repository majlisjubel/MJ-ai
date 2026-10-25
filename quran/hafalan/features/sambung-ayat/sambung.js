// --- KONFIGURASI WORKER ---
// URL Cloudflare Worker milik lo yang aktif
const WORKER_URL = "https://hafalan-voice-api.rkidul416.workers.dev";

// Elemen DOM
const verseBadge = document.getElementById("verseBadge");
const versePrompt = document.getElementById("versePrompt");
const verseTrans = document.getElementById("verseTrans");
const micBtn = document.getElementById("micBtn");
const statusBadge = document.getElementById("statusBadge");
const userTranscript = document.getElementById("userTranscript");
const feedbackMsg = document.getElementById("feedbackMsg");
const timerText = document.getElementById("timerText");
const scoreText = document.getElementById("scoreText");
const nextBtn = document.getElementById("nextBtn");

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentScore = 120;
let timeLeft = 90; // 1 menit 30 detik
let timerInterval;

// 1. Ambil Soal Baru dari Cloudflare Worker (GPT-OSS)
async function loadNewQuestion() {
  statusBadge.textContent = "Memuat soal dari AI...";
  feedbackMsg.textContent = "";
  userTranscript.textContent = "-";
  nextBtn.style.display = "none";

  try {
    const res = await fetch(`${WORKER_URL}/api/generate-question`);
    const data = await res.json();

    if (data) {
      verseBadge.textContent = `QS. ${data.surah_name} : Ayat ${data.verse_number}`;
      versePrompt.textContent = data.prompt_verse;
      verseTrans.textContent = `"${data.expected_continuation || 'Lanjutkan ayat berikutnya...'}"`;
      statusBadge.textContent = "Tekan Tombol Mic untuk Mulai Merekam";
    }
  } catch (err) {
    console.error("Gagal ambil soal:", err);
    // Fallback jika offline/gagal
    verseBadge.textContent = "QS. Al-Baqarah : 183";
    versePrompt.textContent = "يٰأَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامَ";
    verseTrans.textContent = `"Diwajibkan atas kamu berpuasa..."`;
    statusBadge.textContent = "Mode Offline - Siap Merekam";
  }
}

// 2. Timer Mundur Permainan
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      let m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      let s = (timeLeft % 60).toString().padStart(2, '0');
      timerText.textContent = `${m}:${s}`;
    } else {
      clearInterval(timerInterval);
      statusBadge.textContent = "Waktu Habis!";
      micBtn.disabled = true;
    }
  }, 1000);
}

// 3. Kontrol Rekaman Suara (Microphone)
micBtn.addEventListener("click", async () => {
  if (!isRecording) {
    // Mulai Rekam
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await sendAudioToWorker(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.classList.add("recording");
      micBtn.textContent = "⏹️";
      statusBadge.textContent = "Mendengarkan bacaanmu... Baca dengan jelas!";
    } catch (err) {
      alert("Gagal mengakses mikrofon. Pastikan izin mic aktif di browser HP lo!");
      console.error(err);
    }
  } else {
    // Berhenti Rekam
    mediaRecorder.stop();
    isRecording = false;
    micBtn.classList.remove("recording");
    micBtn.textContent = "🎙️";
    statusBadge.textContent = "Memproses suara dengan Whisper AI...";
  }
});

// 4. Kirim Audio ke Cloudflare Worker (Whisper Turbo API)
async function sendAudioToWorker(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");

  try {
    const response = await fetch(`${WORKER_URL}/api/whisper-transcribe`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (result && result.text) {
      userTranscript.textContent = result.text;
      statusBadge.textContent = "Suara berhasil divalidasi!";
      feedbackMsg.style.color = "#4ade80";
      feedbackMsg.textContent = "✨ MasyaAllah, bacaan tepat! +25 Poin";
      
      currentScore += 25;
      scoreText.textContent = currentScore;
      nextBtn.style.display = "block";

      // Sinkronisasi XP Supabase jika ada fungsi global
      if (window.parent && window.parent.addXP) {
        window.parent.addXP(25);
      }
    } else {
      throw new Error("Gagal mengenali suara");
    }
  } catch (err) {
    console.error("Error Whisper:", err);
    statusBadge.textContent = "Gagal memproses suara. Coba lagi!";
    feedbackMsg.style.color = "#f87171";
    feedbackMsg.textContent = "❌ Suara kurang jelas atau koneksi bermasalah.";
  }
}

// Tombol Soal Berikutnya
nextBtn.addEventListener("click", () => {
  loadNewQuestion();
});

// Inisialisasi Saat Halaman Dibuka
window.addEventListener("DOMContentLoaded", () => {
  loadNewQuestion();
  startTimer();
});
