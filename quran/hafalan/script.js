(() => {
  "use strict";

  // --- KONFIGURASI SUPABASE ---
  const SUPABASE_URL = 'https://rlvjdwxbnzylharbnufz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdmpkd3hibnp5bGhhcmJudWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NDA3MjUsImV4cCI6MjEwODMxNjcyNX0.5mW3due5VGuaFr26WpqlRigI7Qc7LMBOZFfJadsz6dY';

  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
      if (!saved || typeof saved.xp !== "number") {
        return { ...defaultPlayer };
      }
      return {
        ...defaultPlayer,
        ...saved,
        xp: Math.max(0, saved.xp)
      };
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
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      await fetchProfileFromSupabase(currentUser.id);
    }
    fetchLeaderboard();
  }

  async function fetchProfileFromSupabase(userId) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      player.username = data.username || player.username;
      player.rank_title = data.rank_title || player.rank_title;
      player.xp = data.exp || player.xp;
      savePlayer();
      renderPlayer();
    }
  }

  async function syncProgressToSupabase() {
    if (!supabase || !currentUser) return;
    await supabase
      .from('profiles')
      .update({
        exp: player.xp,
        rank_title: player.rank_title
      })
      .eq('id', currentUser.id);
  }

  async function fetchLeaderboard() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('username, rank_title, exp')
      .order('exp', { ascending: false })
      .limit(5);

    if (data && data.length > 0) {
      const listContainer = $("#leaderboardList");
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
      $("#leaderNote").textContent = "Peringkat Real-time dari Supabase Arena.";
    }
  }

  // --- SYSTEM RENDER & GAMEPLAY ---

  function getLevel(xp) {
    return Math.floor(xp / 100) + 1;
  }

  function renderPlayer() {
    const level = getLevel(player.xp);
    const currentLevelXP = player.xp % 100;
    const completedToday = player.completedDates.includes(today);

    $("#playerName").textContent = player.username;
    $("#playerRank").textContent = player.rank_title;
    $("#levelNumber").textContent = String(level).padStart(2, "0");
    $("#levelLabel").textContent = `Level ${level} · ${level === 1 ? "Pemula" : level < 5 ? "Penjelajah" : "Penjaga Hafalan"}`;

    $("#xpLabel").textContent = `${currentLevelXP} / 100 XP`;
    $("#xpPercent").textContent = `${currentLevelXP}%`;
    $("#xpBar").style.width = `${currentLevelXP}%`;

    $("#questCount").textContent = completedToday ? "1/1" : "0/1";
    $("#questBar").style.width = completedToday ? "100%" : "0%";

    $("#questDescription").textContent = completedToday
      ? "Quest hari ini selesai. Kembali besok untuk tantangan berikutnya."
      : "Selesaikan satu tantangan untuk memperoleh 25 XP.";
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

    $("#modalKicker").textContent = data.kicker;
    $("#modalTitle").textContent = data.title;
    $("#modalDescription").textContent = data.description;
    $("#verseBox").textContent = data.verse;
    $("#verseBox").hidden = false;
    $("#answerFeedback").textContent = "";
    $("#continueButton").hidden = true;
    $("#continueButton").textContent = "Lanjutkan →";

    const list = $("#answerList");
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

    $("#gameModal").hidden = false;
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

    $("#answerFeedback").textContent = isCorrect
      ? `✓ ${currentQuestion.explanation} +25 XP`
      : `Belum tepat. ${currentQuestion.explanation}`;

    if (isCorrect) {
      awardXP(25);
    }

    $("#continueButton").hidden = false;
    $("#continueButton").textContent = "Kembali ke Arena →";
  }

  function closeModal() {
    $("#gameModal").hidden = true;
    document.body.style.overflow = "";
    currentMode = null;
    currentQuestion = null;
  }

  // --- HANDLER LOGIN OTP ---

  function openAuthModal() {
    $("#authModal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeAuthModal() {
    $("#authModal").hidden = true;
    document.body.style.overflow = "";
  }

  $("#sendOtpBtn")?.addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    if (!email) return showToast("Masukkan email lo dulu!");

    $("#authFeedback").textContent = "Mengirim kode OTP...";
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      $("#authFeedback").textContent = "Gagal kirim OTP: " + error.message;
    } else {
      $("#authFeedback").textContent = "";
      $("#emailStep").hidden = true;
      $("#otpStep").hidden = false;
    }
  });

  $("#verifyOtpBtn")?.addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    const token = $("#authOtp").value.trim();
    if (!token) return showToast("Masukkan 6-digit OTP!");

    $("#authFeedback").textContent = "Memverifikasi...";
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) {
      $("#authFeedback").textContent = "OTP Salah / Kadaluarsa: " + error.message;
    } else {
      currentUser = data.user;
      showToast("Berhasil Login! Selamat datang di MJ Arena.");
      closeAuthModal();
      await fetchProfileFromSupabase(currentUser.id);
    }
  });

  // --- EVENT LISTENERS ---

  $("#authButton").addEventListener("click", openAuthModal);
  $("#closeAuthModal").addEventListener("click", closeAuthModal);

  function handleMode(mode) {
    if (modes[mode]) {
      openModal(mode);
      return;
    }

    switch (mode) {
      case "daily":
        if (player.completedDates.includes(today)) {
          showToast("Quest hari ini sudah selesai. Mantap, cuy!");
        } else {
          showToast("Quest harian: selesaikan tantangan untuk +25 XP.");
          openModal("continue");
        }
        break;
      case "duel-user":
        showToast("Multiplayer Arena: Mencari Room di Supabase...");
        break;
      case "duel-mj":
        showToast("Tantang MJ: Bot AI siap diajak duel!");
        break;
      default:
        showToast("Mode ini sedang disiapkan.");
    }
  }

  $$("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => handleMode(button.dataset.mode));
  });

  $("#closeModal").addEventListener("click", closeModal);
  $("#gameModal").addEventListener("click", (e) => { if (e.target === $("#gameModal")) closeModal(); });
  $("#continueButton").addEventListener("click", closeModal);

  $("#soundButton").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    $("#soundButton").textContent = soundEnabled ? "♫" : "♪";
    showToast(soundEnabled ? "Efek suara diaktifkan." : "Efek suara dinonaktifkan.");
  });

  // Load awal
  renderPlayer();
  checkUserSession();
})();
