// ==========================================
// GROQ WHISPER AI - CONTINUOUS SILENCE DETECTION
// ==========================================

let audioContext = null;
let analyser = null;
let microphone = null;
let silenceTimer = null;
const SILENCE_THRESHOLD = 15; // Ambang batas kebisingan/suara
const SILENCE_DURATION = 900;  // Waktu hening (ms) untuk pemicu kirim ke AI (0.9 detik)

async function startMurojaahMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Setup Audio Analyzer untuk Deteksi Suara/Hening
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

      // Kirim ke Groq jika durasi perekaman memadai
      if (audioBlob.size > 2000 && isMicActive) {
        await sendToGroqWhisper(audioBlob);
      }

      // Jika Mic masih status aktif, otomatis mulai rekam ayat berikutnya!
      if (isMicActive) {
        mediaRecorder.start();
      }
    };

    mediaRecorder.start();
    isMicActive = true;
    if (btnMic) btnMic.classList.add("recording");
    if (transcriptStatus) transcriptStatus.innerText = "Mode Hands-Free Aktif! Bacalah ayat...";

    // Jalankan pemantau jeda suara
    detectSilence();

  } catch (err) {
    console.error("Gagal mengakses mic:", err);
    alert("Izin mikrofon ditolak atau browser tidak mendukung.");
  }
}

function detectSilence() {
  if (!isMicActive) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  // Hitung rata-rata volume suara yang masuk
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  let average = sum / dataArray.length;

  if (average < SILENCE_THRESHOLD) {
    // Pengguna sedang hening / jeda napas
    if (!silenceTimer && mediaRecorder && mediaRecorder.state === "recording") {
      silenceTimer = setTimeout(() => {
        // Hening telah mencapai durasi -> Stop rekam sebentar untuk memproses ayat
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
        silenceTimer = null;
      }, SILENCE_DURATION);
    }
  } else {
    // Pengguna masih bersuara/membaca -> Reset timer jeda
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  // Loop deteksi secara kontinyu
  if (isMicActive) {
    requestAnimationFrame(detectSilence);
  }
}

async function sendToGroqWhisper(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "speech.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("language", "ar");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: formData
    });

    const data = await response.json();

    if (data.text && data.text.trim().length > 0) {
      console.log("Transkrip Groq:", data.text);
      validateMurojaahVerse(data.text);
    }
  } catch (error) {
    console.error("Groq Whisper API Error:", error);
  }
}

function stopMurojaahMic() {
  isMicActive = false;
  if (silenceTimer) clearTimeout(silenceTimer);
  
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  if (audioContext) audioContext.close();
  
  if (btnMic) btnMic.classList.remove("recording");
  if (transcriptStatus) transcriptStatus.innerText = "Mic dimatikan.";
}
