(() => {
"use strict";

// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL =
"https://rlvjdwxbnzylharbnufz.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_kNpC2N_taG7qJCuMdeBoNA_yLKSn2tx";

const supabase = window.supabase?.createClient
? window.supabase.createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
)
: null;

if (!supabase) {
console.error(
"Supabase gagal dimuat. Periksa script CDN Supabase JS v2 di index.html."
);
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const STORAGE_KEY = "mj-quran-arena-player-v1";
const AVATAR_BUCKET = "mj-avatars";
const today = new Date().toLocaleDateString("en-CA");

const defaultPlayer = {
username: "Petualang MJ",
rank_title: "QARI'",
xp: 0,
completedDates: [],
lastDate: today,
avatar_url: "",
avatar_key: "",
};

let player = loadPlayer();
let currentUser = null;
let currentMode = null;
let answered = false;
let currentQuestion = null;
let soundEnabled = false;
let toastTimer = null;
let profileBusy = false;

// --- STATE KUIS DINAMIS 50 SOAL & TIMER ---
let quizSession = {
  questions: [],
  currentIndex: 0,
  score: 0,
  timer: null,
  timeLeft: 15,
  isAnswered: false
};

const modes = {
continue: {
title: "Sambung Ayat",
kicker: "MEMORY CHALLENGE",
description: "Pilih kelanjutan ayat yang tepat.",
verse: "قُلْ هُوَ اللَّهُ أَحَدٌ",
answers: [
"اللَّهُ الصَّمَدُ",
"لَمْ يَلِدْ وَلَمْ يُولَدْ",
"وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ",
],
correct: 0,
explanation:
"Benar! Kelanjutan Surah Al-Ikhlas ayat 2 adalah اللَّهُ الصَّمَدُ.",
},
guess: {
title: "Tebak Ayat",
kicker: "VERSE QUIZ",
description: "Surah apa yang memiliki ayat pembuka berikut?",
verse: "قُلْ هُوَ اللَّهُ أَحَدٌ",
answers: ["Al-Ikhlas", "Al-Falaq", "An-Nas", "Al-Kautsar"],
correct: 0,
explanation:
"Benar! قُلْ هُوَ اللَّهُ أَحَدٌ adalah Surah Al-Ikhlas ayat 1.",
},
previous: {
title: "Ayat Sebelumnya",
kicker: "MEMORY RECALL",
description:
"Potongan berikut adalah Al-Ikhlas ayat 2. Ingat ayat sebelumnya?",
verse: "اللَّهُ الصَّمَدُ",
answers: [
"قُلْ هُوَ اللَّهُ أَحَدٌ",
"لَمْ يَلِدْ وَلَمْ يُولَدْ",
"قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ",
"قُلْ أَعُوذُ بِرَبِّ النَّاسِ",
],
correct: 0,
explanation:
"Benar! Ayat sebelumnya adalah Al-Ikhlas ayat 1: قُلْ هُوَ اللَّهُ أَحَدٌ.",
},
};

function loadPlayer() {
try {
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
if (!saved || typeof saved.xp !== "number") return { ...defaultPlayer };
return { ...defaultPlayer, ...saved, xp: Math.max(0, saved.xp) };
} catch {
return { ...defaultPlayer };
}
}

function savePlayer() {
try {
localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
} catch {
showToast("Penyimpanan lokal tidak tersedia.");
}
}

function setText(selector, value) {
const el = $(selector);
if (el) el.textContent = value;
}

function setAuthFeedback(message, isError = false) {
const el = $("#authFeedback");
if (!el) return;
el.textContent = message;
el.classList.toggle("is-error", isError);
}

function setButtonBusy(button, busy, busyText) {
if (!button) return;
if (busy) {
button.dataset.originalText = button.textContent;
button.disabled = true;
if (busyText) button.textContent = busyText;
} else {
button.disabled = false;
if (button.dataset.originalText)
button.textContent = button.dataset.originalText;
delete button.dataset.originalText;
}
}

function showToast(message) {
const toast = $("#toast") || createToastElement();
toast.textContent = message;
toast.className = "toast show";
clearTimeout(toastTimer);
toastTimer = setTimeout(() => {
toast.className = "toast";
}, 3000);
}

function createToastElement() {
let t = document.createElement("div");
t.id = "toast";
t.className = "toast";
document.body.appendChild(t);
return t;
}

// ==========================================
// SISTEM RANK & LEVEL (300 EXP / LEVEL)
// ==========================================
function calculateRank(xp) {
  const currentXP = Math.max(0, Number(xp) || 0);
  const level = Math.floor(currentXP / 300) + 1;
  
  let title = "QARI'";
  if (level >= 26) {
    title = "HAMILUL QUR'AN";
  } else if (level >= 19) {
    title = "AMIL";
  } else if (level >= 13) {
    title = "MUTQIN";
  } else if (level >= 8) {
    title = "HAFIDZ";
  } else if (level >= 4) {
    title = "MUKHLIS";
  }

  return { level, title };
}

function renderPlayer() {
  const rankInfo = calculateRank(player.xp);
  const level = rankInfo.level;
  player.rank_title = rankInfo.title;

  const currentLevelXP = player.xp % 300;
  const xpPercent = Math.floor((currentLevelXP / 300) * 100);
  const completedToday = player.completedDates.includes(today);

  setText("#playerName", player.username);  
  setText("#playerRank", player.rank_title);  
  setText("#levelNumber", String(level).padStart(2, "0"));  
  setText(  
    "#levelLabel",  
    `Level ${level} · ${player.rank_title}`  
  );  
  setText("#xpLabel", `${currentLevelXP} / 300 XP`);  
  setText("#xpPercent", `${xpPercent}%`);  
  
  const xpBar = $("#xpBar");  
  if (xpBar) xpBar.style.width = `${xpPercent}%`;  
  
  setText("#questCount", completedToday ? "1/1" : "0/1");  
  const questBar = $("#questBar");  
  if (questBar) questBar.style.width = completedToday ? "100%" : "0%";  
  
  setText(  
    "#questDescription",  
    completedToday  
      ? "Quest hari ini selesai. Kembali besok untuk tantangan berikutnya."  
      : "Selesaikan satu tantangan untuk memperoleh 25 XP."  
  );  
  setText(  
    "#userGreeting",  
    currentUser  
      ? `Assalamu'alaikum, ${player.username}!`  
      : "Assalamu'alaikum, Petualang!"  
  );  
  renderAvatar();
}

async function awardXP(amount) {
  if (typeof amount !== "number" || amount <= 0) return;

  const oldRank = calculateRank(player.xp);
  player.xp += amount;
  const newRank = calculateRank(player.xp);

  if (!player.completedDates.includes(today)) {
    player.completedDates.push(today);
  }

  savePlayer();
  renderPlayer();

  if (newRank.level > oldRank.level) {
    showToast(`🎉 LEVEL UP! Sekarang Level ${newRank.level} (${newRank.title}). Terus jaga hafalanmu!`);
  } else {
    showToast(`+${amount} XP! Progres hafalanmu bertambah.`);
  }

  if (currentUser && supabase) {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          exp: player.xp,
          rank_title: newRank.title,
        })
        .eq("id", currentUser.id);

      if (error) console.error("XP sync error:", error.message);
    } catch (err) {
      console.error("Error awardXP Supabase:", err);
    }
  }
}

async function fetchProfileFromSupabase(userId) {
  if (!supabase || !userId) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, rank_title, exp, avatar_key")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca profil:", error.message);
    showToast("Profil gagal dimuat. Periksa nama kolom dan RLS.");
    return;
  }

  if (data) {
    player.username = data.display_name || player.username;
    player.rank_title = data.rank_title || player.rank_title;

    player.xp = Number.isFinite(Number(data.exp))
      ? Math.max(0, Number(data.exp))
      : player.xp;

    player.avatar_key =
      data.avatar_key && data.avatar_key !== "default"
        ? data.avatar_key
        : "";

    player.avatar_url = player.avatar_key
      ? supabase.storage
          .from(AVATAR_BUCKET)
          .getPublicUrl(player.avatar_key).data.publicUrl
      : "";

    savePlayer();
    renderPlayer();
    renderAvatar();
    return;
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      display_name: player.username,
      rank_title: "QARI'",
      exp: 0,
      avatar_key: "",
    });

  if (insertError) {
    console.error("Gagal membuat profil:", insertError.message);
    showToast("Profil gagal dibuat. Periksa kolom dan izin RLS.");
    return;
  }

  player.rank_title = "QARI'";
  player.xp = 0;
  player.avatar_key = "";
  player.avatar_url = "";

  savePlayer();
  renderPlayer();
  renderAvatar();
}

async function fetchLeaderboard() {
if (!supabase) return;
const container = $("#leaderboardList");
const note = $("#leaderNote");
if (!container) return;

const { data, error } = await supabase  
  .from("profiles")  
  .select("display_name, rank_title, exp, avatar_key")  
  .order("exp", { ascending: false })  
  .limit(5);  

if (error) {  
  console.error("Leaderboard error:", error.message);  
  if (note) note.textContent = "Leaderboard belum dapat dimuat.";  
  return;  
}  

container.replaceChildren();  
(data || []).forEach((item, index) => {  
  const row = document.createElement("div");  
  row.className = "leader-row";  

  const rank = document.createElement("span");  
  rank.className = "leader-rank";  
  rank.textContent = String(index + 1).padStart(2, "0");  

  const avatar = document.createElement("span");  
  avatar.className = "leader-avatar";  
  if (item.avatar_key) {  
    const img = document.createElement("img");  
    img.src = supabase.storage  
      .from(AVATAR_BUCKET)  
      .getPublicUrl(item.avatar_key).data.publicUrl;  
    img.alt = "";  
    img.loading = "lazy";  
    avatar.appendChild(img);  
  } else {  
    avatar.textContent = "م";  
  }  

  const user = document.createElement("span");  
  user.className = "leader-user";  
  const name = document.createElement("strong");  
  name.textContent = item.display_name || "Petualang";  
  const rankTitle = document.createElement("small");  
  rankTitle.textContent = item.rank_title || calculateRank(item.exp).title;  
  user.append(name, rankTitle);  

  const xp = document.createElement("span");  
  xp.className = "leader-xp";  
  xp.textContent = `${Number(item.exp) || 0} XP`;  
  row.append(rank, avatar, user, xp);  
  container.appendChild(row);  
});  

if (note) note.textContent = "Peringkat dari data Supabase Arena.";  
if (!data?.length) {  
  const empty = document.createElement("p");  
  empty.className = "leader-empty";  
  empty.textContent = "Belum ada pemain di leaderboard.";  
  container.appendChild(empty);  
}
}

function renderAvatar() {
const url = player.avatar_url;
const avatar = $(".player-avatar");
if (avatar) {
avatar.replaceChildren();
if (url) {
const img = document.createElement("img");
img.src = url;
img.alt = "Foto profil";
img.onerror = () => {
avatar.replaceChildren(document.createTextNode("م"));
};
avatar.appendChild(img);
} else {
avatar.textContent = "م";
}
const dot = document.createElement("i");
avatar.appendChild(dot);
}

const preview = $("#profileAvatarPreview");  
if (preview) {  
  preview.replaceChildren();  
  if (url) {  
    const img = document.createElement("img");  
    img.src = url;  
    img.alt = "Pratinjau foto profil";  
    preview.appendChild(img);  
  } else {  
    preview.textContent = "م";  
  }  
}
}

// ==========================================
// INTEGRASI KUIS DINAMIS API AL-QUR'AN (50 SOAL & TIMER 15s)
// ==========================================
async function startDynamicQuiz(modeType) {
  showToast("Memuat bank soal Al-Qur'an...");
  
  try {
    const response = await fetch('https://equran.id/api/v2/surat');
    const json = await response.json();
    const suratList = json.data;

    let targetSuratList = filterSuratByRank(suratList, player.rank_title);

    quizSession.questions = generateRandomQuestions(targetSuratList, 50, modeType);
    quizSession.currentIndex = 0;
    quizSession.score = 0;

    if (quizSession.questions.length === 0) {
      showToast("Gagal memuat soal. Coba lagi.");
      return;
    }

    openQuizModalUI();
    loadQuizQuestion();

  } catch (err) {
    console.error("Gagal koneksi API Quran:", err);
    showToast("Gagal terhubung ke server Al-Qur'an.");
  }
}

function filterSuratByRank(suratList, rank) {
  if (rank === "ROOKIE" || rank === "QARI'") {
    return suratList.filter(s => s.nomor >= 78); // Fokus Juz 30
  } else if (rank === "MUKHLIS" || rank === "HAFIDZ") {
    return suratList.filter(s => s.nomor >= 40); // Juz menengah ke akhir
  } else {
    return suratList; // Semua Juz (1-30) untuk Mutqin / Hamilul Qur'an
  }
}

function generateRandomQuestions(suratList, totalSoal, mode) {
  let questions = [];
  for (let i = 0; i < totalSoal; i++) {
    let randomSurat = suratList[Math.floor(Math.random() * suratList.length)];
    questions.push({
      suratNama: randomSurat.namaLatin,
      verseText: `Uji hafalan Surah ${randomSurat.namaLatin} (${randomSurat.arti})`,
      correctAnswer: randomSurat.namaLatin,
      options: [randomSurat.namaLatin, "Al-Fatihah", "Al-Baqarah", "An-Nas"].sort(() => Math.random() - 0.5)
    });
  }
  return questions;
}

function openQuizModalUI() {
  const modal = $("#gameModal");
  if (modal) modal.hidden = false;
  document.body.style.overflow = "hidden";
  const nextBtn = $("#continueButton");
  if (nextBtn) nextBtn.hidden = true;
}

function loadQuizQuestion() {
  if (quizSession.currentIndex >= quizSession.questions.length) {
    endQuizSession();
    return;
  }

  let q = quizSession.questions[quizSession.currentIndex];
  quizSession.isAnswered = false;
  quizSession.timeLeft = 15;

  setText("#modalTitle", `Soal ${quizSession.currentIndex + 1} dari 50`);
  setText("#modalKicker", "JUZ & RANK MATCH");
  setText("#modalDescription", `Surah: ${q.suratNama}`);
  setText("#verseBox", q.verseText);
  setText("#answerFeedback", `⏱️ Waktu: 15 detik`);
  
  let list = $("#answerList");
  if (list) {
    list.replaceChildren();
    q.options.forEach((opt, idx) => {
      let btn = document.createElement("button");
      btn.className = "answer-option";
      btn.textContent = opt;
      btn.onclick = () => submitAnswer(opt, q.correctAnswer);
      list.appendChild(btn);
    });
  }

  startCountdownTimer();
}

function startCountdownTimer() {
  clearInterval(quizSession.timer);
  let feedbackEl = $("#answerFeedback");
  
  quizSession.timer = setInterval(() => {
    quizSession.timeLeft--;
    if (feedbackEl) {
      feedbackEl.textContent = `⏱️ Waktu tersisa: ${quizSession.timeLeft} detik`;
    }

    if (quizSession.timeLeft <= 0) {
      clearInterval(quizSession.timer);
      if (!quizSession.isAnswered) {
        handleTimeOut();
      }
    }
  }, 1000);
}

function handleTimeOut() {
  quizSession.isAnswered = true;
  showToast("Waktu habis! Lanjut ke soal berikutnya.");
  setTimeout(() => {
    quizSession.currentIndex++;
    loadQuizQuestion();
  }, 1200);
}

function submitAnswer(selectedOpt, correctOpt) {
  if (quizSession.isAnswered) return;
  quizSession.isAnswered = true;
  clearInterval(quizSession.timer);

  let isCorrect = selectedOpt === correctOpt;
  if (isCorrect) {
    quizSession.score += 5;
    showToast("Benar! +5 XP");
    awardXP(5);
  } else {
    showToast(`Kurang tepat. Jawaban: ${correctOpt}`);
  }

  setTimeout(() => {
    quizSession.currentIndex++;
    loadQuizQuestion();
  }, 1200);
}

function endQuizSession() {
  clearInterval(quizSession.timer);
  let modal = $("#gameModal");
  if (modal) modal.hidden = true;
  showToast(`Sesi Kuis Selesai! Total XP Diperoleh: ${quizSession.score}`);
}

function closeModal() {
  clearInterval(quizSession.timer);
  if ($("#gameModal")) $("#gameModal").hidden = true;
  document.body.style.overflow = "";
  currentMode = null;
  currentQuestion = null;
}

function showAuthStep(step) {
if ($("#emailStep")) $("#emailStep").hidden = step !== "email";
if ($("#otpStep")) $("#otpStep").hidden = step !== "otp";
if ($("#profileStep")) $("#profileStep").hidden = step !== "profile";
}

function openAuthModal() {
const modal = $("#authModal");
if (!modal) {
showToast("Modal akun tidak ditemukan di HTML.");
return;
}
modal.hidden = false;
document.body.style.overflow = "hidden";

if (currentUser) {  
  showAuthStep("profile");  
  setAuthFeedback("");  
  setText("#profileEmail", currentUser.email || "Email tidak tersedia");  
  const nameInput = $("#profileUsername");  
  if (nameInput) nameInput.value = player.username;  
  renderAvatar();  
} else {  
  showAuthStep("email");  
  setAuthFeedback("");  
  if ($("#authEmail")) $("#authEmail").value = "";  
  if ($("#authOtp")) $("#authOtp").value = "";  
}
}

function closeAuthModal() {
if ($("#authModal")) $("#authModal").hidden = true;
document.body.style.overflow = "";
setAuthFeedback("");
}

async function handleAuthState(session) {
currentUser = session?.user || null;
if (currentUser) {
await fetchProfileFromSupabase(currentUser.id);
} else {
player = loadPlayer();
renderPlayer();
}
renderPlayer();
fetchLeaderboard();
}

async function saveProfile() {
if (!supabase || !currentUser || profileBusy) return;
const input = $("#profileUsername");
const username = input?.value.trim() || "";
if (username.length < 3 || username.length > 24) {
setAuthFeedback("Username harus terdiri dari 3–24 karakter.", true);
return;
}
if (!/^[\p{L}\p{N} _.-]+$/u.test(username)) {
setAuthFeedback(
"Username hanya boleh berisi huruf, angka, spasi, titik, garis bawah, atau tanda hubung.",
true
);
return;
}

profileBusy = true;  
const saveBtn = $("#saveProfileBtn");  
setButtonBusy(saveBtn, true, "Menyimpan...");  
setAuthFeedback("Menyimpan profil...");  

try {  
  let avatarKey = player.avatar_key || "";  
  let avatarUrl = player.avatar_url || "";  
  const file = $("#profileAvatarFile")?.files?.[0] || null;  
  if (file) {  
    const allowed = ["image/jpeg", "image/png", "image/webp"];  
    if (!allowed.includes(file.type))  
      throw new Error("Gunakan foto JPG, PNG, atau WebP.");  
    if (file.size > 2 * 1024 * 1024)  
      throw new Error("Ukuran foto maksimal 2 MB.");  

    const ext =  
      file.type === "image/png"  
        ? "png"  
        : file.type === "image/webp"  
        ? "webp"  
        : "jpg";  
    const path = `${currentUser.id}/avatar-${Date.now()}.${ext}`;  
    const { error: uploadError } = await supabase.storage  
      .from(AVATAR_BUCKET)  
      .upload(path, file, {  
        cacheControl: "3600",  
        upsert: true,  
        contentType: file.type,  
      });  
    if (uploadError)  
      throw new Error(`Upload foto gagal: ${uploadError.message}`);  
    const { data: publicData } = supabase.storage  
      .from(AVATAR_BUCKET)  
      .getPublicUrl(path);  
    avatarKey = path;  
    avatarUrl = publicData.publicUrl;  
  }  

  const { error } = await supabase  
    .from("profiles")  
    .update({  
      display_name: username,  
      avatar_key: avatarKey || "",  
    })  
    .eq("id", currentUser.id);  

  if (error) throw new Error(`Gagal menyimpan profil: ${error.message}`);  

  player.username = username;  
  player.avatar_key = avatarKey || "";  
  player.avatar_url = avatarUrl || "";  
  savePlayer();  
  renderPlayer();  
  renderAvatar();  
  setAuthFeedback("Profil berhasil disimpan.");  
  fetchLeaderboard();  
  showToast("Profil MJ Arena berhasil diperbarui!");  
  if ($("#profileAvatarFile")) $("#profileAvatarFile").value = "";  
} catch (err) {  
  console.error(err);  
  setAuthFeedback(err.message || "Gagal menyimpan profil.", true);  
} finally {  
  profileBusy = false;  
  setButtonBusy(saveBtn, false);  
}
}

function bindEvents() {
$("#authButton")?.addEventListener("click", async (event) => {
event.preventDefault();
if (!supabase) {
showToast("Supabase belum termuat.");
return;
}
const { data, error } = await supabase.auth.getSession();
if (error) {
showToast("Gagal memeriksa sesi login.");
console.error("Session error:", error.message);
return;
}
currentUser = data.session?.user || null;
if (currentUser) {
await fetchProfileFromSupabase(currentUser.id);
}
openAuthModal();
});

$("#closeAuthModal")?.addEventListener("click", closeAuthModal);  
$("#authModal")?.addEventListener("click", (event) => {  
  if (event.target === $("#authModal")) closeAuthModal();  
});  

$("#sendOtpBtn")?.addEventListener("click", async () => {  
  if (!supabase)  
    return setAuthFeedback("Supabase SDK belum termuat.", true);  
  const email = $("#authEmail")?.value.trim().toLowerCase() || "";  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))  
    return setAuthFeedback("Masukkan alamat email yang valid.", true);  

  const button = $("#sendOtpBtn");  
  setButtonBusy(button, true, "Mengirim OTP...");  
  setAuthFeedback("Mengirim kode OTP...");  
  try {  
    const { error } = await supabase.auth.signInWithOtp({  
      email,  
      options: { shouldCreateUser: true },  
    });  
    if (error) throw error;  
    showAuthStep("otp");  
    setAuthFeedback(`Kode dikirim ke ${email}. Gunakan kode terbaru.`);  
    showToast("OTP terkirim. Periksa inbox dan spam.");  
  } catch (err) {  
    setAuthFeedback(`Gagal mengirim OTP: ${err.message}`, true);  
  } finally {  
    setButtonBusy(button, false);  
  }  
});  

$("#verifyOtpBtn")?.addEventListener("click", async () => {  
  if (!supabase)  
    return setAuthFeedback("Supabase SDK belum termuat.", true);  
  const email = $("#authEmail")?.value.trim().toLowerCase() || "";  
  const token = $("#authOtp")?.value.trim() || "";  
  if (!email)  
    return setAuthFeedback("Email tidak ditemukan.", true);  
  if (!/^\d{6}$/.test(token))  
    return setAuthFeedback("Masukkan kode OTP 6 digit.", true);  

  const button = $("#verifyOtpBtn");  
  setButtonBusy(button, true, "Memverifikasi...");  
  setAuthFeedback("Memverifikasi kode...");  
  try {  
    const { data, error } = await supabase.auth.verifyOtp({  
      email,  
      token,  
      type: "email",  
    });  
    if (error) throw error;  
    currentUser = data.user || data.session?.user || null;  
    if (!currentUser) throw new Error("Login belum menghasilkan sesi.");  
    await fetchProfileFromSupabase(currentUser.id);  
    renderPlayer();  
    fetchLeaderboard();  
    showAuthStep("profile");  
    setText("#profileEmail", currentUser.email || email);  
    if ($("#profileUsername"))  
      $("#profileUsername").value = player.username;  
    setAuthFeedback("Login berhasil.");  
    showToast("Berhasil login ke MJ Arena!");  
  } catch (err) {  
    setAuthFeedback(`Verifikasi gagal: ${err.message}`, true);  
  } finally {  
    setButtonBusy(button, false);  
  }  
});  

$("#backToEmailBtn")?.addEventListener("click", () => {  
  showAuthStep("email");  
  setAuthFeedback("");  
});  

$("#saveProfileBtn")?.addEventListener("click", saveProfile);  

$("#profileAvatarFile")?.addEventListener("change", () => {  
  const file = $("#profileAvatarFile")?.files?.[0];  
  if (!file) return;  
  if (file.size > 2 * 1024 * 1024) {  
    $("#profileAvatarFile").value = "";  
    setAuthFeedback("Ukuran foto maksimal 2 MB.", true);  
    return;  
  }  
  const preview = $("#profileAvatarPreview");  
  if (preview) {  
    const url = URL.createObjectURL(file);  
    preview.replaceChildren();  
    const img = document.createElement("img");  
    img.src = url;  
    img.alt = "Pratinjau foto";  
    preview.appendChild(img);  
  }  
});  

$("#logoutBtn")?.addEventListener("click", async () => {  
  if (!supabase) return;  
  const { error } = await supabase.auth.signOut();  
  if (error) return setAuthFeedback(`Logout gagal: ${error.message}`, true);  
  currentUser = null;  
  showToast("Berhasil logout.");  
  closeAuthModal();  
  renderPlayer();  
});  

$$("[data-mode]").forEach((button) => {  
  button.addEventListener("click", () => {  
    const mode = button.dataset.mode;  
    if (mode === "continue" || mode === "guess" || mode === "previous") {  
      startDynamicQuiz(mode);  
    } else if (mode === "daily") {  
      if (player.completedDates.includes(today))  
        showToast("Quest hari ini sudah selesai. Mantap!");  
      else {  
        showToast("Quest harian: selesaikan tantangan untuk +25 XP.");  
        startDynamicQuiz("continue");  
      }  
    } else if (mode === "duel-user")  
      showToast("Multiplayer Arena sedang disiapkan.");  
    else if (mode === "duel-mj") showToast("Tantang MJ sedang disiapkan.");  
    else showToast("Mode ini sedang disiapkan.");  
  });  
});  

$("#closeModal")?.addEventListener("click", closeModal);  
$("#gameModal")?.addEventListener("click", (event) => {  
  if (event.target === $("#gameModal")) closeModal();  
});  
$("#continueButton")?.addEventListener("click", closeModal);  

$("#soundButton")?.addEventListener("click", () => {  
  soundEnabled = !soundEnabled;  
  setText("#soundButton", soundEnabled ? "♫" : "♪");  
  showToast(  
    soundEnabled ? "Efek suara diaktifkan." : "Efek suara dinonaktifkan."  
  );  
});
}

document.addEventListener("DOMContentLoaded", () => {
bindEvents();
renderPlayer();

if (!supabase) {
console.error("Supabase SDK tidak tersedia.");
showToast("Supabase belum termuat.");
return;
}

supabase.auth.getSession().then(({ data, error }) => {  
  if (error) console.error("Gagal membaca sesi:", error.message);  
  handleAuthState(data?.session || null);  
});  

supabase.auth.onAuthStateChange((_event, session) => {  
  Promise.resolve().then(() => handleAuthState(session));  
});
});

})();
