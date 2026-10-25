// --- KONFIGURASI WORKER & SUPABASE ---
const WORKER_URL = "https://hafalan-voice-api.rkidul416.workers.dev";

// Kredensial Supabase lo
const SUPABASE_URL = "https://rlvjdwxbnzylharbnufz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdmpkd3hibnp5bGhhcmJudWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDA3MjUsImV4cCI6MjEwODMxNjcyNX0.5mW3due5VGuaFr26WpqlRigI7Qc7LMBOZFfJadsz6dY";

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Elemen DOM
const surahInfo = document.getElementById("surahInfo");
const versePrompt = document.getElementById("versePrompt");
const verseTrans = document.getElementById("verseTrans");
const micBtn = document.getElementById("micBtn");
const statusBadge = document.getElementById("statusBadge");
const userTranscript = document.getElementById("userTranscript");
const feedbackMsg = document.getElementById("feedbackMsg");
const timerText = document.getElementById("timerText");
const scoreText = document.getElementById("scoreText");
const xpDisplay = document.getElementById("xpDisplay");
const coinDisplay = document.getElementById("coinDisplay");
const nextBtn = document.getElementById("nextBtn");

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentAnswerKey = ""; 
let userTotalXP = 0;     
let userCoins = 0;
let timeLeft = 90; 
let timerInterval;

// Ambil Data Akun & Poin User yang Aktif
async function loadUserData() {
  if (!supabaseClient) return;
  try {
    // Cek sesi user aktif di Supabase
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        userTotalXP = profile.xp || 0;
        userCoins = profile.coins || 1250;
        
        scoreText.textContent = userTotalXP;
        if (xpDisplay) xpDisplay.textContent = `⭐ ${userTotalXP} XP`;
        if (coinDisplay) coinDisplay.textContent = `🪙 ${userCoins}`;
      }
    } else {
      // Fallback ambil dari localStorage jika disimpan lokal oleh halaman utama
      const localXP = localStorage.getItem('user_xp');
      const localCoins = localStorage.getItem('user_coins');
      if (localXP) userTotalXP = parseInt(localXP);
      if (localCoins) userCoins = parseInt(localCoins);
      
      scoreText.textContent = userTotalXP;
      if (xpDisplay) xpDisplay.textContent = `⭐ ${userTotalXP} XP`;
      if (coinDisplay) coinDisplay.textContent = `🪙 ${userCoins}`;
    }
  } catch (err) {
    console.log("Error mengambil data user:", err);
  }
}

// 1. Ambil Soal Baru dari Cloudflare Worker (GPT-OSS)
async function loadNewQuestion() {
  statusBadge.textContent = "Memuat soal dari AI...";
  feedbackMsg.textContent = "";
  userTranscript.textContent = "-";
  nextBtn.style.display = "none";
  currentAnswerKey = "";

  try {
    const res = await fetch(`${WORKER_URL}/api/generate-question?mode=sambung`);
    const data = await res.json();

    if (data) {
      surahInfo.textContent = `QS. ${data.surah_name} : Ayat ${data.verse_number}`;
      
      // TAMPILKAN AYAT FULL DI ATAS (Prompt Verse + Expected Continuation)
      // Sesuai permintaan: ayat dibuat full, user tinggal lanjutkan
      const fullAyatText = `${data.prompt_verse} ${data.expected_continuation || ''}`;
      versePrompt.textContent = fullAyatText;
      
      verseTrans.textContent = `Lanjutkan bacaan ayat berikutnya dengan suara...`;
      currentAnswerKey = data.expected_continuation || ""; 
      statusBadge.textContent = "Tekan Tombol Mic untuk Mulai Merekam";
    }
  } catch (err) {
    console.error("Gagal ambil soal:", err);
    // Fallback demo
    surahInfo.textContent = "QS. Al-Fatihah : Ayat 1-2";
    versePrompt.textContent = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ٱلْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ";
    verseTrans.textContent = "Lanjutkan bacaan ayat berikutnya...";
    currentAnswerKey = "الرَّحْمَٰنِ الرَّحِيمِ";
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
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
      alert("Gagal mengakses mikrofon. Pastikan izin mic aktif!");
      console.error(err);
    }
  } else {
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
    const transcribedText = result.text || "";

    userTranscript.textContent = transcribedText;
    validateAnswer(transcribedText);

  } catch (err) {
    console.error("Error Whisper:", err);
    statusBadge.textContent = "Gagal memproses suara. Coba lagi!";
    feedbackMsg.style.color = "#f87171";
    feedbackMsg.textContent = "❌ Koneksi server bermasalah.";
  }
}

// 5. Fungsi Validasi Bacaan (Anti-Asal)
function validateAnswer(userText) {
  const cleanUser = userText.replace(/[^\w\s\u0600-\u06FF]/g, "").trim();
  const cleanKey = currentAnswerKey.replace(/[^\w\s\u0600-\u06FF]/g, "").trim();

  const isMatch = cleanUser.length > 2 && (cleanUser.includes(cleanKey) || cleanKey.includes(cleanUser) || similarityCheck(cleanUser, cleanKey));

  if (isMatch || (currentAnswerKey === "" && cleanUser.length > 3)) {
    // BENAR
    statusBadge.textContent = "Bacaan Tepat!";
    feedbackMsg.style.color = "#4ade80";
    feedbackMsg.textContent = "✨ MasyaAllah, bacaan benar! +25 XP";
    
    userTotalXP += 25;
    scoreText.textContent = userTotalXP;
    if (xpDisplay) xpDisplay.textContent = `⭐ ${userTotalXP} XP`;
    nextBtn.style.display = "block";

    // Simpan ke localStorage agar sinkron dengan halaman utama
    localStorage.setItem('user_xp', userTotalXP);

    // Sinkronisasi ke window parent jika ada
    if (window.parent && window.parent.addXP) {
      window.parent.addXP(25);
    }
  } else {
    // SALAH / JAWAB ASAL
    statusBadge.textContent = "Lafal Belum Tepat";
    feedbackMsg.style.color = "#f87171";
    feedbackMsg.textContent = "❌ Bacaan belum sesuai ayat berikutnya. Coba ulangi!";
  }
}

function similarityCheck(str1, str2) {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  let matchCount = 0;
  words1.forEach(w => {
    if (words2.some(w2 => w2.includes(w) || w.includes(w2))) matchCount++;
  });
  return matchCount >= Math.min(2, words2.length);
}

nextBtn.addEventListener("click", () => {
  loadNewQuestion();
});

window.addEventListener("DOMContentLoaded", () => {
  loadUserData();
  loadNewQuestion();
  startTimer();
});
