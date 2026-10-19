const $ = id => document.getElementById(id);
const chat = $('chat-container');
const status = $('status');
const sendBtn = $('send');
const micBtn = $('mic');
const keyBtn = $('key-btn');
const mjSprite = $('mj-sprite');
const API = 'https://api.mj-ai.my.id/';

// Ambil PIN yang tersimpan di browser sebelumnya
let userPIN = localStorage.getItem('MJ_PIN') || "";

function updateAccessUI() {
  if (userPIN && userPIN.trim() !== "") {
    keyBtn.classList.add('active');
  } else {
    userPIN = "";
    localStorage.removeItem('MJ_PIN');
    keyBtn.classList.remove('active');
  }
}

updateAccessUI();

let currentAudio = null;

let history = [
  { role: 'model', parts: [{ text: 'Haiii, saya MJ, asisten pribadi virtual. Ada yang bisa saya bantu?' }] }
];

// Mapping File Ekspresi Sesuai Nama File di Repo GitHub
const EXPRESSIONS = {
  netral: './netral.png',
  senang: './senang.png',
  sedih: './1792299320411.png',
  marah: './marah.png',
  kaget: './kaget.png',
  blushing: './blushing.png',
  berfikir: './berfikir.png'
};

function changeExpression(expressionName) {
  if (EXPRESSIONS[expressionName]) {
    mjSprite.style.opacity = '0.3';
    setTimeout(() => {
      mjSprite.src = EXPRESSIONS[expressionName];
      mjSprite.style.opacity = '1';
    }, 150);
  }
}

function autoDetectExpression(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('[marah]') || lower.includes('😠') || lower.includes('😡')) {
    changeExpression('marah');
  } else if (lower.includes('[sedih]') || lower.includes('😭') || lower.includes('💔')) {
    changeExpression('sedih');
  } else if (lower.includes('[blushing]') || lower.includes('[malu]') || lower.includes('😳')) {
    changeExpression('blushing');
  } else if (lower.includes('[kaget]') || lower.includes('😲') || lower.includes('😱')) {
    changeExpression('kaget');
  } else if (lower.includes('[berfikir]') || lower.includes('[bingung]') || lower.includes('🤔')) {
    changeExpression('berfikir');
  } else if (lower.includes('[senang]') || lower.includes('😊') || lower.includes('😁') || lower.includes('😄')) {
    changeExpression('senang');
  } else if (lower.includes('marah') || lower.includes('kesal') || lower.includes('benci')) {
    changeExpression('marah');
  } else if (lower.includes('sedih') || lower.includes('kecewa') || lower.includes('maaf')) {
    changeExpression('sedih');
  } else if (lower.includes('senang') || lower.includes('suka') || lower.includes('haha') || lower.includes('senyum')) {
    changeExpression('senang');
  } else if (lower.includes('kaget') || lower.includes('terkejut') || lower.includes('wah')) {
    changeExpression('kaget');
  } else if (lower.includes('malu') || lower.includes('blush')) {
    changeExpression('blushing');
  } else if (lower.includes('berfikir') || lower.includes('pikir') || lower.includes('bingung') || lower.includes('renungkan')) {
    changeExpression('berfikir');
  } else {
    changeExpression('netral');
  }
}

keyBtn.onclick = () => {
  const pin = prompt("Masukkan PIN Verifikasi (Kosongkan jika ingin masuk sebagai Tamu):", userPIN);
  if (pin !== null) {
    const cleanPin = pin.trim();
    if (cleanPin !== "") {
      userPIN = cleanPin;
      localStorage.setItem('MJ_PIN', userPIN);
      alert("PIN tersimpan! Sistem siap mengenali identitasmu.");
    } else {
      userPIN = "";
      localStorage.removeItem('MJ_PIN');
      alert("Masuk sebagai Mode Tamu.");
    }
    updateAccessUI();
  }
};

function addDialogue(text, isUser = false, audioBase64 = null) {
  const div = document.createElement('div');
  div.className = isUser ? 'vn-dialogue user-action' : 'vn-dialogue';
  div.innerText = text;

  if (audioBase64 && !isUser) {
    const playBtn = document.createElement('button');
    playBtn.className = 'audio-play-btn';
    playBtn.innerText = '🔊';
    playBtn.title = 'Putar Suara';
    playBtn.onclick = () => playAudioResponse(audioBase64, text);
    div.appendChild(playBtn);
  }

  chat.appendChild(div);
  
  setTimeout(() => {
    chat.scrollTop = chat.scrollHeight;
  }, 50);
  
  return div;
}

function playAudioResponse(audioBase64, textFallback) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }

  if (audioBase64) {
    try {
      currentAudio = new Audio("data:audio/mp3;base64," + audioBase64);
      currentAudio.play().catch(e => {
        console.warn("Autoplay terhalang browser...", e);
      });
      return;
    } catch (e) {
      console.error("Gagal memutar ElevenLabs:", e);
    }
  }
}

async function run(q) {
  if (!q.trim()) return;
  
  addDialogue(q, true);
  $('cmd').value = '';
  
  history.push({ role: 'user', parts: [{ text: q }] });

  const loading = addDialogue('...');
  status.innerText = 'Memproses...';
  sendBtn.disabled = true;

  try {
    // Kirim userPIN langsung ke backend secara dinamis
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: history, 
        message: q,
        passcode: userPIN,
        pin: userPIN,
        pass: userPIN
      })
    });
    
    const data = await res.json();
    loading.remove();

    if (!res.ok) throw new Error(data.error || 'Gagal tersambung');

    const reply = data.answer || "Maaf, tidak ada respon.";
    
    addDialogue(reply, false, data.audio);
    autoDetectExpression(reply);
    history.push({ role: 'model', parts: [{ text: reply }] });

    status.innerText = 'Online';

  } catch (err) {
    loading.remove();
    addDialogue('Ralat: ' + err.message);
    status.innerText = 'Error';
    history.pop();
  } finally {
    sendBtn.disabled = false;
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

micBtn.onclick = () => {
  if (!SpeechRecognition) {
    alert('Browser kamu tidak mendukung perekaman suara langsung.');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'id-ID';
  recognition.interimResults = false;

  try {
    recognition.start();
    micBtn.classList.add('recording');
    status.innerText = 'Mendengarkan...';
  } catch (e) {
    recognition.stop();
    micBtn.classList.remove('recording');
    status.innerText = 'Online';
  }

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    $('cmd').value = transcript;
    micBtn.classList.remove('recording');
    run(transcript);
  };

  recognition.onerror = (e) => {
    micBtn.classList.remove('recording');
    status.innerText = 'Online';
    alert('Gagal mendeteksi suara / izin mikrofon belum diberikan.');
  };

  recognition.onend = () => {
    micBtn.classList.remove('recording');
    if (status.innerText === 'Mendengarkan...') {
      status.innerText = 'Online';
    }
  };
};

sendBtn.onclick = () => run($('cmd').value);
$('cmd').onkeydown = e => { if (e.key === 'Enter') sendBtn.click(); };
