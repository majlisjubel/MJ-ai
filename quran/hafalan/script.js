(() => {
  "use strict";

  // --- KONFIGURASI SUPABASE ---
  const SUPABASE_URL = 'https://rlvjdwxbnzylharbnufz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdmpkd3hibnp5bGhhcmJudWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDA3MjUsImV4cCI6MjEwODMxNjcyNX0.5mW3due5VGuaFr26WpqlRigI7Qc7LMBOZFfJadsz6dY';

  const supabase = (window.supabase && window.supabase.createClient) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const STORAGE_KEY = "mj-quran-arena-player-v1";
  const today = new Date().toLocaleDateString("en-CA");

  const defaultPlayer = {
    username: "Petualang MJ",
    rank_title: "ROOKIE",
    xp: 0,
    completedDates: [],
    lastDate: today
  };

  let player = loadPlayer();
  let currentUser = null;
  let currentMode = null;
  let answered = false;
  let currentQuestion = null;
  let soundEnabled = false;
  let toastTimer;

  const modes = {
    continue: {
      title: "Sambung Ayat",
      kicker: "MEMORY CHALLENGE",
      description: "Pilih kelanjutan ayat yang tepat.",
      verse: "قُلْ هُوَ اللَّهُ أَحَدٌ",
      answers: [
        "اللَّهُ الصَّمَدُ",
        "لَمْ يَلِدْ وَلَمْ يُولَدْ",
        "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ"
      ],
      correct: 0,
      explanation: "Benar! Kelanjutan Surah Al-Ikhlas ayat 2 adalah اللَّهُ الصَّمَدُ."
    },
    guess: {
      title: "Tebak Ayat",
      kicker: "VERSE QUIZ",
      description: "Surah apa yang memiliki ayat pembuka berikut?",
      verse: "قُلْ هُوَ اللَّهُ أَحَدٌ",
      answers: [
        "Al-Ikhlas",
        "Al-Falaq",
        "An-Nas",
        "Al-Kautsar"
      ],
      correct: 0,
      explanation: "Benar! قُلْ هُوَ اللَّهُ أَحَدٌ adalah Surah Al-Ikhlas ayat 1."
    },
    previous: {
      title: "Ayat Sebelumnya",
      kicker: "MEMORY RECALL",
      description: "Potongan berikut adalah Al-Ikhlas ayat 2. Ingat ayat sebelumnya?",
      verse: "اللَّهُ الصَّمَدُ",
      answers: [
        "قُلْ هُوَ اللَّهُ أَحَدٌ",
        "لَمْ يَلِدْ وَلَمْ يُولَدْ",
        "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ",
        "قُلْ أَعُوذُ بِرَبِّ النَّاسِ"
      ],
      correct: 0,
      explanation: "Benar! Ayat sebelumnya adalah Al-Ikhlas ayat 1: قُلْ هُوَ اللَّهُ أَحَدٌ."
    }
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

  // --- INTEGRASI SUPABASE DATABASE & AUTH ---

  async function checkUserSession() {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
        await fetchProfileFromSupabase(currentUser.id);
      }
      fetchLeaderboard();
    } catch (err) {
      console.log("Supabase Session Error:", err);
    }
  }

  async function fetchProfileFromSupabase(userId) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data && !error) {
      player.username = data.username || player.username;
      player.rank_title = data.rank_title || player.rank_title;
      player.xp = data.exp || player.xp;
      savePlayer();
      renderPlayer();
    } else {
      await supabase.from('profiles').insert([{
        id: userId,
        username: player.username,
        rank_title: player.rank_title,
        exp: player.xp
      }]);
    }
  }

  async function syncProgressToSupabase() {
    if (!supabase || !currentUser) return;
    await supabase
      .from('profiles')
      .upsert({
        id: currentUser.id,
        username: player.username,
        exp: player.xp,
        rank_title: player.rank_title
      });
  }

  async function fetchLeaderboard() {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, rank_title, exp')
      .order('exp', { ascending: false })
      .limit(5);

    if (data && data.length > 0) {
      const listContainer = $("#leaderboardList");
      if (listContainer) {
        listContainer.innerHTML = "";
        data.forEach((item, index) => {
          const row = document.createElement("div");
          row.className = "leader-row";
          row.innerHTML = `
            <span class="leader-rank">${String(index + 1).padStart(2, "0")}</span>
            <span class="leader-avatar">م</span>
            <span class="leader-user"><strong>${item.username || "Petualang"}</strong><small>${item.rank_title || "ROOKIE"}</small></span>
            <span class="leader-xp">${item.exp || 0} XP</span>
          `;
          listContainer.appendChild(row);
        });
      }
      const leaderNote = $("#leaderNote");
      if (leaderNote) leaderNote.textContent = "Peringkat Real-time dari Supabase Arena.";
    }
  }

  // --- GAMEPLAY & UI RENDER ---

  function getLevel(xp) {
    return Math.floor(xp / 100) + 1;
  }

  function renderPlayer() {
    const level = getLevel(player.xp);
    const currentLevelXP = player.xp % 100;
    const completedToday = player.completedDates.includes(today);

    if ($("#playerName")) $("#playerName").textContent = player.username;
    if ($("#playerRank")) $("#playerRank").textContent = player.rank_title;
    if ($("#levelNumber")) $("#levelNumber").textContent = String(level).padStart(2, "0");
    if ($("#levelLabel")) $("#levelLabel").textContent = `Level ${level} · ${level === 1 ? "Pemula" : level < 5 ? "Penjelajah" : "Penjaga Hafalan"}`;

    if ($("#xpLabel")) $("#xpLabel").textContent = `${currentLevelXP} / 100 XP`;
    if ($("#xpPercent")) $("#xpPercent").textContent = `${currentLevelXP}%`;
    if ($("#xpBar")) $("#xpBar").style.width = `${currentLevelXP}%`;

    if ($("#questCount")) $("#questCount").textContent = completedToday ? "1/1" : "0/1";
    if ($("#questBar")) $("#questBar").style.width = completedToday ? "100%" : "0%";

    if ($("#questDescription")) {
      $("#questDescription").textContent = completedToday
        ? "Quest hari ini selesai. Kembali besok untuk tantangan berikutnya."
        : "Selesaikan satu tantangan untuk memperoleh 25 XP.";
    }
  }

  function awardXP(amount) {
    const oldLevel = getLevel(player.xp);
    player.xp += amount;

    if (!player.completedDates.includes(today)) {
      player.completedDates.push(today);
    }

    savePlayer();
    syncProgressToSupabase();
    renderPlayer();

    const newLevel = getLevel(player.xp);
    if (newLevel > oldLevel) {
      showToast(`LEVEL UP! Sekarang level ${newLevel}. Terus jaga hafalanmu!`);
    } else {
      showToast(`+${amount} XP! Progres hafalanmu bertambah.`);
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  function openModal(mode) {
    const data = modes[mode];
    if (!data) return;

    currentMode = mode;
    currentQuestion = data;
    answered = false;

    if ($("#modalKicker")) $("#modalKicker").textContent = data.kicker;
    if ($("#modalTitle")) $("#modalTitle").textContent = data.title;
    if ($("#modalDescription")) $("#modalDescription").textContent = data.description;
    if ($("#verseBox")) {
      $("#verseBox").textContent = data.verse;
      $("#verseBox").hidden = false;
    }
    if ($("#answerFeedback")) $("#answerFeedback").textContent = "";
    if ($("#continueButton")) {
      $("#continueButton").hidden = true;
      $("#continueButton").textContent = "Lanjutkan →";
    }

    const list = $("#answerList");
    if (list) {
      list.replaceChildren();
      data.answers.forEach((answer, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "answer-option";
        button.textContent = answer;
        button.dataset.index = String(index);

        if (mode === "continue" || mode === "previous") {
          button.style.direction = "rtl";
          button.style.textAlign = "center";
          button.style.fontFamily = "Georgia, serif";
          button.style.fontSize = "19px";
        }

        button.addEventListener("click", () => checkAnswer(index));
        list.appendChild(button);
      });
    }

    if ($("#gameModal")) $("#gameModal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function checkAnswer(selectedIndex) {
    if (answered || !currentQuestion) return;
    answered = true;

    const isCorrect = selectedIndex === currentQuestion.correct;
    const buttons = $$("#answerList .answer-option");

    buttons.forEach((button, index) => {
      button.disabled = true;
      if (index === currentQuestion.correct) {
        button.classList.add("correct");
      } else if (index === selectedIndex && !isCorrect) {
        button.classList.add("wrong");
      }
    });

    if ($("#answerFeedback")) {
      $("#answerFeedback").textContent = isCorrect
        ? `✓ ${currentQuestion.explanation} +25 XP`
        : `Belum tepat. ${currentQuestion.explanation}`;
    }

    if (isCorrect) awardXP(25);

    if ($("#continueButton")) {
      $("#continueButton").hidden = false;
      $("#continueButton").textContent = "Kembali ke Arena →";
    }
  }

  function closeModal() {
    if ($("#gameModal")) $("#gameModal").hidden = true;
    document.body.style.overflow = "";
    currentMode = null;
    currentQuestion = null;
  }

  // --- RENDERING & RESET MODAL AUTH ---

  function resetAuthModal() {
    if ($("#emailStep")) $("#emailStep").hidden = false;
    if ($("#otpStep")) $("#otpStep").hidden = true;
    if ($("#authFeedback")) $("#authFeedback").textContent = "";
    if ($("#authEmail")) $("#authEmail").value = "";
    if ($("#authOtp")) $("#authOtp").value = "";
  }

  function openAuthModal() {
    const authModal = $("#authModal");
    if (authModal) authModal.hidden = false;
    document.body.style.overflow = "hidden";

    if (currentUser) {
      if ($("#emailStep")) $("#emailStep").hidden = true;
      if ($("#otpStep")) $("#otpStep").hidden = true;
      if ($("#authFeedback")) {
        $("#authFeedback").innerHTML = `
          <div style="text-align: center; padding: 10px 0;">
            <p style="color: #42e0a4; font-weight: bold; margin-bottom: 5px;">✓ Terhubung sebagai:</p>
            <p style="font-size: 14px; color: #fff; word-break: break-all;">${currentUser.email}</p>
            <button id="logoutBtn" type="button" style="margin-top: 15px; background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%;">
              Keluar / Logout
            </button>
          </div>
        `;

        const logoutBtn = $("#logoutBtn");
        if (logoutBtn) {
          logoutBtn.addEventListener("click", async () => {
            if (supabase) await supabase.auth.signOut();
            currentUser = null;
            showToast("Berhasil Logout!");
            resetAuthModal();
            closeAuthModal();
          });
        }
      }
    } else {
      resetAuthModal();
    }
  }

  function closeAuthModal() {
    const authModal = $("#authModal");
    if (authModal) authModal.hidden = true;
    document.body.style.overflow = "";
    resetAuthModal();
  }

  // --- EVENT LISTENERS & INITIALIZATION ---

  document.addEventListener("DOMContentLoaded", () => {
    console.log("MJ Arena JS aktif");

const authBtn = document.querySelector("#authButton");

if (authBtn) {
  authBtn.addEventListener("click", () => {
    alert("Tombol profil berhasil diklik!");
  });
} else {
  console.error("Tombol authButton tidak ditemukan!");
}
    // Tangkap tombol profil secara aman (mencegah null element)
    const authBtn = $("#authButton");
    if (authBtn) {
      authBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthModal();
      });
    }

    const closeAuthBtn = $("#closeAuthModal");
    if (closeAuthBtn) closeAuthBtn.addEventListener("click", closeAuthModal);

    const authModal = $("#authModal");
    if (authModal) {
      authModal.addEventListener("click", (e) => {
        if (e.target === authModal) closeAuthModal();
      });
    }

    // Handlers Kirim & Verifikasi OTP
    const sendOtpBtn = $("#sendOtpBtn");
    if (sendOtpBtn) {
      sendOtpBtn.addEventListener("click", async () => {
        const emailInput = $("#authEmail");
        const email = emailInput ? emailInput.value.trim() : "";
        if (!email) return showToast("Masukkan email lo dulu!");

        if ($("#authFeedback")) $("#authFeedback").textContent = "Mengirim 6-digit OTP...";
        if (!supabase) return showToast("Supabase Client belum terpasang!");

        const { error } = await supabase.auth.signInWithOtp({
          email: email,
          options: { shouldCreateUser: true }
        });

        if (error) {
          if ($("#authFeedback")) $("#authFeedback").textContent = "Gagal kirim: " + error.message;
        } else {
          if ($("#authFeedback")) $("#authFeedback").textContent = "";
          showToast("Kode OTP terkirim! Periksa inbox/spam email lo.");
          if ($("#emailStep")) $("#emailStep").hidden = true;
          if ($("#otpStep")) $("#otpStep").hidden = false;
        }
      });
    }

    const verifyOtpBtn = $("#verifyOtpBtn");
    if (verifyOtpBtn) {
      verifyOtpBtn.addEventListener("click", async () => {
        const emailInput = $("#authEmail");
        const otpInput = $("#authOtp");
        const email = emailInput ? emailInput.value.trim() : "";
        const token = otpInput ? otpInput.value.trim() : "";

        if (!token) return showToast("Masukkan 6-digit OTP!");

        if ($("#authFeedback")) $("#authFeedback").textContent = "Memverifikasi OTP...";
        
        let res = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        if (res.error) {
          res = await supabase.auth.verifyOtp({ email, token, type: 'magiclink' });
        }
        if (res.error) {
          res = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
        }

        if (res.error) {
          if ($("#authFeedback")) $("#authFeedback").textContent = "OTP Salah / Kedaluwarsa: " + res.error.message;
        } else {
          currentUser = res.data.user;
          showToast("Berhasil Login! Sesi kamu aman tersimpan.");
          closeAuthModal();
          if (currentUser) {
            await fetchProfileFromSupabase(currentUser.id);
          }
        }
      });
    }

    // Modal Game Event Handlers
    $$("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode;
        if (modes[mode]) {
          openModal(mode);
        } else if (mode === "daily") {
          if (player.completedDates.includes(today)) {
            showToast("Quest hari ini sudah selesai. Mantap!");
          } else {
            showToast("Quest harian: selesaikan tantangan untuk +25 XP.");
            openModal("continue");
          }
        } else if (mode === "duel-user") {
          showToast("Multiplayer Arena: Mencari Room di Supabase...");
        } else if (mode === "duel-mj") {
          showToast("Tantang MJ: Bot AI siap diajak duel!");
        } else {
          showToast("Mode ini sedang disiapkan.");
        }
      });
    });

    if ($("#closeModal")) $("#closeModal").addEventListener("click", closeModal);
    if ($("#gameModal")) {
      $("#gameModal").addEventListener("click", (e) => {
        if (e.target === $("#gameModal")) closeModal();
      });
    }
    if ($("#continueButton")) $("#continueButton").addEventListener("click", closeModal);

    const soundBtn = $("#soundButton");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? "♫" : "♪";
        showToast(soundEnabled ? "Efek suara diaktifkan." : "Efek suara dinonaktifkan.");
      });
    }

    // Initial Execution
    renderPlayer();
    checkUserSession();
  });
})();
