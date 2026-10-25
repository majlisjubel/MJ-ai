// Konfigurasi Cloudflare Worker Endpoint (Backend Groq)
const WORKER_URL = "https://quran-worker.YOUR-SUBDOMAIN.workers.dev"; // Ganti dengan URL Worker lo nanti

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentAnswerKey = "";

const micBtn = document.getElementById("micBtn");
const statusBadge = document.getElementById("statusBadge");
const userTranscript = document.getElementById("userTranscript");
const feedbackMsg = document.getElementById("feedbackMsg");
const versePrompt = document.getElementById("versePrompt");
const surahInfo = document.getElementById("surahInfo");
const nextBtn = document.getElementById("nextBtn");

// 1. Ambil Soal Baru dari Cloudflare Worker (GPT-OSS)
async function loadNewQuestion() {
  versePrompt.innerText = "Mengecek kitab...";
  feedbackMsg.innerText = "";
  userTranscript.innerText = "-";
  nextBtn.style.display = "none";

  try {
    const res = await fetch(`${WORKER_URL}/api/generate-question?mode=sambung`);
    const data = await res.json();
    
    // Set soal dan kunci jawaban
    versePrompt.innerText = data.prompt_verse; // Teks ayat potongan
    surahInfo.innerText = `${data.surah_name} : Ayat ${data.verse_number}`;
    currentAnswerKey = data.expected_continuation; // Kunci jawaban teks Arab
  } catch (err) {
    console.error("Gagal load soal:", err);
    versePrompt.innerText = "وَالضُّحَىٰ"; // Fallback demo jika worker belum terhubung
    surahInfo.innerText = "QS. Ad-Duha : Ayat 1";
    currentAnswerKey = "وَاللَّيْلِ إِذَا سَجَىٰ";
  }
}

// 2. Inisialisasi Perekam Suara (MediaRecorder API)
async function setupAudioRecorder() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      audioChunks = [];
      await sendAudioToWhisper(audioBlob);
    };
  } catch (err) {
    alert("Izin mikrofon ditolak! Harap beri izin mic di browser HP lo.");
  }
}

// 3. Kontrol Tombol Mic
micBtn.addEventListener("click", () => {
  if (!mediaRecorder) return;

  if (!isRecording) {
    // Mulai Merekam
    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add("recording");
    statusBadge.innerText = "Merekam suara... Ucapkan ayat!";
    statusBadge.style.color = "#ef4444";
  } else {
    // Stop Merekam & Kirim ke AI
    mediaRecorder.stop();
    isRecording = false;
    micBtn.classList.remove("recording");
    statusBadge.innerText = "Memproses bacaan via Whisper AI...";
    statusBadge.style.color = "#fbbf24";
  }
});

// 4. Kirim Audio ke Cloudflare Worker -> Groq Whisper Turbo
async function sendAudioToWhisper(blob) {
  const formData = new FormData();
  formData.append("file", blob, "rec.webm");

  try {
    const response = await fetch(`${WORKER_URL}/api/whisper-transcribe`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    const transcribedText = result.text || "";

    userTranscript.innerText = transcribedText;
    validateAnswer(transcribedText);
  } catch (err) {
    console.error("Whisper Error:", err);
    statusBadge.innerText = "Gagal memproses suara. Coba lagi!";
  }
}

// 5. Validasi Bacaan Suara & Penambahan XP
function validateAnswer(userText) {
  // Normalisasi teks sederhana untuk mencocokkan bacaan
  const cleanUser = userText.replace(/[^\w\s\u0600-\u06FF]/g, "").trim();
  const cleanKey = currentAnswerKey.replace(/[^\w\s\u0600-\u06FF]/g, "").trim();

  if (cleanUser.length > 0 && (cleanUser.includes(cleanKey) || cleanKey.includes(cleanUser))) {
    feedbackMsg.className = "feedback-message success";
    feedbackMsg.innerText = "🎉 Masya Allah, Bacaan Benar! (+25 XP)";
    statusBadge.innerText = "Selesai!";
    nextBtn.style.display = "inline-block";
    
    // Panggil fungsi penambah XP Supabase (jika tersambung)
    if (window.parent && window.parent.addXP) {
      window.parent.addXP(25);
    }
  } else {
    feedbackMsg.className = "feedback-message error";
    feedbackMsg.innerText = "❌ Lafal belum tepat / kurang jelas. Coba ulangi!";
    statusBadge.innerText = "Klik Mic untuk Ulangi";
  }
}

nextBtn.addEventListener("click", loadNewQuestion);

// Jalankan saat pertama kali dibuka
setupAudioRecorder();
loadNewQuestion();
    
