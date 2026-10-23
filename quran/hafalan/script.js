
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const STORAGE_KEY = "mj-quran-arena-player-v1";
  const today = new Date().toLocaleDateString("en-CA");

  const defaultPlayer = {
    xp: 0,
    completedDates: [],
    lastDate: today
  };

  let player = loadPlayer();
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
      explanation: "Benar! Kelanjutan Surah Al-Ikhlas ayat 2 adalah اللَّهُ الصَّمَدُ (Allah tempat meminta segala sesuatu)."
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
        xp: Math.max(0, saved.xp),
        completedDates: Array.isArray(saved.completedDates)
          ? saved.completedDates
          : [],
        lastDate: saved.lastDate || today
      };
    } catch {
      return { ...defaultPlayer };
    }
  }

  function savePlayer() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
    } catch {
      showToast("Penyimpanan lokal tidak tersedia. Progres mungkin tidak tersimpan.");
    }
  }

  function getLevel(xp) {
    return Math.floor(xp / 100) + 1;
  }

  function renderPlayer() {
    const level = getLevel(player.xp);
    const currentLevelXP = player.xp % 100;
    const completedToday = player.completedDates.includes(today);

    $("#levelNumber").textContent = String(level).padStart(2, "0");
    $("#levelLabel").textContent =
      `Level ${level} · ${level === 1 ? "Pemula" : level < 5 ? "Penjelajah" : "Penjaga Hafalan"}`;

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

  function startDailyQuest() {
    if (player.completedDates.includes(today)) {
      showToast("Quest hari ini sudah selesai. Bagus, cuy! Jaga konsistensimu.");
      return;
    }

    showToast("Quest harian: selesaikan satu tantangan hafalan untuk mendapatkan 25 XP.");
    openModal("continue");
  }

  function handleMode(mode) {
    if (modes[mode]) {
      openModal(mode);
      return;
    }

    switch (mode) {
      case "daily":
        startDailyQuest();
        break;

      case "duel-user":
        showToast(
          "Duel sesama user direncanakan dengan room undangan dan matchmaking. Backend real-time belum terhubung."
        );
        break;

      case "duel-mj":
        showToast(
          "Arena MJ sedang disiapkan. Duel AI memerlukan integrasi backend untuk evaluasi dan penilaian yang konsisten."
        );
        break;

      default:
        showToast("Mode ini sedang disiapkan.");
    }
  }

  $$("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      handleMode(button.dataset.mode);
    });
  });

  $("#closeModal").addEventListener("click", closeModal);

  $("#gameModal").addEventListener("click", (event) => {
    if (event.target === $("#gameModal")) closeModal();
  });

  $("#continueButton").addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#gameModal").hidden) {
      closeModal();
    }
  });

  $("#soundButton").addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    $("#soundButton").textContent = soundEnabled ? "♫" : "♪";
    $("#soundButton").setAttribute(
      "aria-label",
      soundEnabled ? "Efek suara aktif secara visual" : "Efek suara nonaktif"
    );

    showToast(
      soundEnabled
        ? "Preferensi efek suara diaktifkan. Audio game belum diintegrasikan."
        : "Preferensi efek suara dinonaktifkan."
    );
  });

  renderPlayer();
})();
      
