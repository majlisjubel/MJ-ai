(() => {
  "use strict";

  const SUPABASE_URL = "https://rlvjdwxbnzylharbnufz.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdmpkd3hibnp5bGhhcmJudWZ6Iiwicm9sZSI6IkFub24iLCJpYXQiOjE3OTI3NDA3MjUsImV4cCI6MjEwODMxNjcyNX0.5mW3due5VGuaFr26WpqlRigI7Qc7LMBOZFfJadsz6dY";
  const supabase = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  const STORAGE_KEY = "mj-quran-arena-player-v1";
  const AVATAR_BUCKET = "mj-avatars";
  const today = new Date().toLocaleDateString("en-CA");

  const defaultPlayer = {
    username: "Petualang MJ",
    rank_title: "ROOKIE",
    xp: 0,
    completedDates: [],
    lastDate: today,
    avatar_url: "",
  };

  let player = loadPlayer();
  let currentUser = null;
  let currentMode = null;
  let answered = false;
  let currentQuestion = null;
  let soundEnabled = false;
  let toastTimer = null;
  let profileBusy = false;

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

  async function fetchProfileFromSupabase(userId) {
    if (!supabase || !userId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, rank_title, exp, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Gagal membaca profil:", error.message);
      showToast("Profil belum bisa dimuat. Periksa izin tabel profiles.");
      return;
    }

    if (data) {
      player.username = data.username || player.username;
      player.rank_title = data.rank_title || player.rank_title;
      player.xp = Number.isFinite(Number(data.exp))
        ? Math.max(0, Number(data.exp))
        : player.xp;
      player.avatar_url = data.avatar_url || "";
      savePlayer();
      renderPlayer();
      renderAvatar();
      return;
    }

    // Profil baru: insert hanya untuk user yang sedang login.
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      username: player.username,
      rank_title: "ROOKIE",
      exp: 0,
      avatar_url: null,
    });

    if (insertError) {
      console.error("Gagal membuat profil:", insertError.message);
      showToast("Profil belum dibuat. Periksa kebijakan RLS tabel profiles.");
    } else {
      player.rank_title = "ROOKIE";
      player.xp = 0;
      player.avatar_url = "";
      savePlayer();
      renderPlayer();
      renderAvatar();
    }
  }

  async function syncProgressToSupabase() {
    // XP di frontend bukan sistem anti-cheat. Produksi sebaiknya memberi XP
    // lewat RPC/server tervalidasi, bukan menerima angka XP dari browser.
    if (!supabase || !currentUser) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        username: player.username,
        avatar_url: player.avatar_url || null,
      })
      .eq("id", currentUser.id);
    if (error) console.error("Gagal sinkronisasi profil:", error.message);
  }

  async function fetchLeaderboard() {
    if (!supabase) return;
    const container = $("#leaderboardList");
    const note = $("#leaderNote");
    if (!container) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("username, rank_title, exp, avatar_url")
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
      if (item.avatar_url) {
        const img = document.createElement("img");
        img.src = item.avatar_url;
        img.alt = "";
        img.loading = "lazy";
        avatar.appendChild(img);
      } else {
        avatar.textContent = "م";
      }

      const user = document.createElement("span");
      user.className = "leader-user";
      const name = document.createElement("strong");
      name.textContent = item.username || "Petualang";
      const rankTitle = document.createElement("small");
      rankTitle.textContent = item.rank_title || "ROOKIE";
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

  function renderPlayer() {
    const level = Math.floor(player.xp / 100) + 1;
    const currentLevelXP = player.xp % 100;
    const completedToday = player.completedDates.includes(today);

    setText("#playerName", player.username);
    setText("#playerRank", player.rank_title);
    setText("#levelNumber", String(level).padStart(2, "0"));
    setText(
      "#levelLabel",
      `Level ${level} · ${ level === 1 ? "Pemula" : level < 5 ? "Penjelajah" : "Penjaga Hafalan" }`
    );
    setText("#xpLabel", `${currentLevelXP} / 100 XP`);
    setText("#xpPercent", `${currentLevelXP}%`);
    const xpBar = $("#xpBar");
    if (xpBar) xpBar.style.width = `${currentLevelXP}%`;
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

  function awardXP(amount) {
    const oldLevel = Math.floor(player.xp / 100) + 1;
    player.xp += amount;
    if (!player.completedDates.includes(today))
      player.completedDates.push(today);
    savePlayer();
    // XP sync client-side is not tamper-proof; see SQL/setup notes.
    if (currentUser && supabase) {
      supabase
        .from("profiles")
        .update({ exp: player.xp })
        .eq("id", currentUser.id)
        .then(({ error }) => {
          if (error) console.error("XP sync error:", error.message);
        });
    }
    renderPlayer();
    const newLevel = Math.floor(player.xp / 100) + 1;
    showToast(
      newLevel > oldLevel
        ? `LEVEL UP! Sekarang level ${newLevel}. Terus jaga hafalanmu!`
        : `+${amount} XP! Progres hafalanmu bertambah.`
    );
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function openModal(mode) {
    const data = modes[mode];
    if (!data) return;
    currentMode = mode;
    currentQuestion = data;
    answered = false;
    setText("#modalKicker", data.kicker);
    setText("#modalTitle", data.title);
    setText("#modalDescription", data.description);
    const verse = $("#verseBox");
    if (verse) {
      verse.textContent = data.verse;
      verse.hidden = false;
    }
    setText("#answerFeedback", "");
    const next = $("#continueButton");
    if (next) {
      next.hidden = true;
      next.textContent = "Lanjutkan →";
    }

    const list = $("#answerList");
    if (list) {
      list.replaceChildren();
      data.answers.forEach((answer, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "answer-option";
        button.textContent = answer;
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
    const correct = selectedIndex === currentQuestion.correct;
    $$("#answerList .answer-option").forEach((button, index) => {
      button.disabled = true;
      if (index === currentQuestion.correct) button.classList.add("correct");
      else if (index === selectedIndex && !correct)
        button.classList.add("wrong");
    });
    setText(
      "#answerFeedback",
      correct
        ? `✓ ${currentQuestion.explanation} +25 XP`
        : `Belum tepat. ${currentQuestion.explanation}`
    );
    if (correct) awardXP(25);
    const next = $("#continueButton");
    if (next) {
      next.hidden = false;
      next.textContent = "Kembali ke Arena →";
    }
  }

  function closeModal() {
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
      // Keep local guest progress but do not show the previous account's private identity.
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
      let avatarUrl = player.avatar_url || null;
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
        avatarUrl = publicData.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          avatar_url: avatarUrl,
        })
        .eq("id", currentUser.id);

      if (error) throw new Error(`Gagal menyimpan profil: ${error.message}`);

      player.username = username;
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
    // Header profile: one listener only, with no duplicate const declarations.
    $("#authButton")?.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthModal();
    });
    $("#closeAuthModal")?.addEventListener("click", closeAuthModal);
    $("#authModal")?.addEventListener("click", (event) => {
      if (event.target === $("#authModal")) closeAuthModal();
    });

    $("#sendOtpBtn")?.addEventListener("click", async () => {
      if (!supabase)
        return setAuthFeedback(
          "Supabase SDK belum termuat. Periksa koneksi internet.",
          true
        );
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
        // Keep email visible to the verify step, but hide its form.
        showAuthStep("otp");
        setAuthFeedback(
          `Kode dikirim ke ${email}. Gunakan kode terbaru dari email tersebut.`
        );
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
        return setAuthFeedback(
          "Email tidak ditemukan. Kembali dan masukkan email lagi.",
          true
        );
      if (!/^\d{6}$/.test(token))
        return setAuthFeedback("Masukkan kode OTP 6 digit.", true);

      const button = $("#verifyOtpBtn");
      setButtonBusy(button, true, "Memverifikasi...");
      setAuthFeedback("Memverifikasi kode...");
      try {
        // For a six-digit token delivered using {{ .Token }}, use type: "email".
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: "email",
        });
        if (error) throw error;
        currentUser = data.user || data.session?.user || null;
        if (!currentUser)
          throw new Error(
            "Login belum menghasilkan sesi. Coba kirim OTP baru."
          );
        await fetchProfileFromSupabase(currentUser.id);
        renderPlayer();
        fetchLeaderboard();
        showAuthStep("profile");
        setText("#profileEmail", currentUser.email || email);
        if ($("#profileUsername"))
          $("#profileUsername").value = player.username;
        setAuthFeedback("Login berhasil. Kamu sekarang bisa mengedit profil.");
        showToast("Berhasil login ke MJ Arena!");
      } catch (err) {
        setAuthFeedback(
          `Verifikasi gagal: ${err.message}. Jika kode kedaluwarsa, kirim OTP baru dan gunakan kode terbaru.`,
          true
        );
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
        if (modes[mode]) openModal(mode);
        else if (mode === "daily") {
          if (player.completedDates.includes(today))
            showToast("Quest hari ini sudah selesai. Mantap!");
          else {
            showToast("Quest harian: selesaikan tantangan untuk +25 XP.");
            openModal("continue");
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
      showToast("Supabase belum termuat. Periksa koneksi internet.");
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Gagal membaca sesi:", error.message);
      handleAuthState(data?.session || null);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      // Defer profile fetch to avoid doing additional Supabase auth work in callback.
      Promise.resolve().then(() => handleAuthState(session));
    });
  });
})();
