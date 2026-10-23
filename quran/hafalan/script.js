
(() => {
  "use strict";

  // ==========================================
  // KONFIGURASI SUPABASE
  // ==========================================
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
      "Supabase gagal dimuat. Periksa CDN Supabase JS v2 di index.html."
    );
  }

  // ==========================================
  // KONFIGURASI APLIKASI
  // ==========================================
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
  let profileLoadUserId = null;

  // ==========================================
  // DATA GAME
  // ==========================================
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
      answers: [
        "Al-Ikhlas",
        "Al-Falaq",
        "An-Nas",
        "Al-Kautsar",
      ],
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

  // ==========================================
  // PENYIMPANAN LOKAL
  // ==========================================
  function loadPlayer() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      if (!saved || typeof saved.xp !== "number") {
        return { ...defaultPlayer };
      }

      return {
        ...defaultPlayer,
        ...saved,
        xp: Math.max(0, saved.xp),
        completedDates: Array.isArray(saved.completedDates)
          ? saved.completedDates
          : [],
      };
    } catch (error) {
      console.error("Gagal membaca data pemain:", error);
      return { ...defaultPlayer };
    }
  }

  function savePlayer() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(player)
      );
    } catch (error) {
      console.error("Gagal menyimpan data pemain:", error);
      showToast("Penyimpanan lokal tidak tersedia.");
    }
  }

  // ==========================================
  // UI HELPER
  // ==========================================
  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function setAuthFeedback(message, isError = false) {
    const element = $("#authFeedback");
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }

  function setButtonBusy(button, busy, busyText) {
    if (!button) return;

    if (busy) {
      if (!button.disabled) {
        button.dataset.originalText = button.textContent;
      }

      button.disabled = true;

      if (busyText) {
        button.textContent = busyText;
      }
    } else {
      button.disabled = false;

      if (button.dataset.originalText !== undefined) {
        button.textContent = button.dataset.originalText;
      }

      delete button.dataset.originalText;
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

  // ==========================================
  // PROFIL SUPABASE
  // Kolom ID menggunakan "id", bukan "uuid".
  // ==========================================
  async function fetchProfileFromSupabase(userId) {
    if (!supabase || !userId) return;

    profileLoadUserId = userId;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, rank_title, exp, avatar_key"
      )
      .eq("id", userId)
      .maybeSingle();

    // Jangan menerapkan hasil akun yang sudah berganti.
    if (currentUser && currentUser.id !== userId) return;

    if (error) {
      console.error(
        "Gagal membaca profil:",
        error.message
      );

      showToast(
        "Profil gagal dimuat. Periksa nama kolom dan RLS."
      );
      return;
    }

    if (data) {
      player.username =
        data.display_name || player.username;

      player.rank_title =
        data.rank_title || "ROOKIE";

      player.xp = Math.max(
        0,
        Number(data.exp) || 0
      );

      player.avatar_key = data.avatar_key || "";

      player.avatar_url = player.avatar_key
        ? supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(player.avatar_key)
            .data.publicUrl
        : "";

      savePlayer();
      renderPlayer();
      renderAvatar();
      return;
    }

    // Buat profil hanya jika belum ada.
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        display_name: player.username,
        rank_title: "ROOKIE",
        exp: 0,
        avatar_key: "",
      });

    if (currentUser && currentUser.id !== userId) return;

    if (insertError) {
      console.error(
        "Gagal membuat profil:",
        insertError.message
      );

      showToast(
        "Profil gagal dibuat. Periksa kolom, default, dan RLS."
      );
      return;
    }

    player.rank_title = "ROOKIE";
    player.xp = 0;
    player.avatar_key = "";
    player.avatar_url = "";

    savePlayer();
    renderPlayer();
    renderAvatar();
  }

  async function syncProgressToSupabase() {
    if (!supabase || !currentUser) return;

    const userId = currentUser.id;

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: player.username,
        avatar_key: player.avatar_key || "",
      })
      .eq("id", userId);

    if (error) {
      console.error(
        "Gagal sinkronisasi profil:",
        error.message
      );
    }
  }

  // ==========================================
  // LEADERBOARD
  // ==========================================
  async function fetchLeaderboard() {
    if (!supabase) return;

    const container = $("#leaderboardList");
    const note = $("#leaderNote");

    if (!container) return;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "display_name, rank_title, exp, avatar_key"
      )
      .order("exp", { ascending: false })
      .limit(5);

    if (error) {
      console.error(
        "Leaderboard error:",
        error.message
      );

      if (note) {
        note.textContent =
          "Leaderboard belum dapat dimuat.";
      }

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
        const image = document.createElement("img");

        image.src = supabase.storage
          .from(AVATAR_BUCKET)
          .getPublicUrl(item.avatar_key)
          .data.publicUrl;

        image.alt = "";
        image.loading = "lazy";

        avatar.appendChild(image);
      } else {
        avatar.textContent = "م";
      }

      const user = document.createElement("span");
      user.className = "leader-user";

      const name = document.createElement("strong");
      name.textContent =
        item.display_name || "Petualang";

      const rankTitle = document.createElement("small");
      rankTitle.textContent =
        item.rank_title || "ROOKIE";

      user.append(name, rankTitle);

      const xp = document.createElement("span");
      xp.className = "leader-xp";
      xp.textContent = `${Number(item.exp) || 0} XP`;

      row.append(rank, avatar, user, xp);
      container.appendChild(row);
    });

    if (note) {
      note.textContent =
        "Peringkat dari data Supabase Arena.";
    }

    if (!data?.length) {
      const empty = document.createElement("p");
      empty.className = "leader-empty";
      empty.textContent =
        "Belum ada pemain di leaderboard.";

      container.appendChild(empty);
    }
  }

  // ==========================================
  // AVATAR DAN TAMPILAN PEMAIN
  // ==========================================
  function renderAvatar() {
    const url = player.avatar_url;
    const avatar = $(".player-avatar");

    if (avatar) {
      avatar.replaceChildren();

      if (url) {
        const image = document.createElement("img");
        image.src = url;
        image.alt = "Foto profil";

        image.onerror = () => {
          avatar.replaceChildren(
            document.createTextNode("م")
          );
        };

        avatar.appendChild(image);
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
        const image = document.createElement("img");
        image.src = url;
        image.alt = "Pratinjau foto profil";
        preview.appendChild(image);
      } else {
        preview.textContent = "م";
      }
    }
  }

  function renderPlayer() {
    const level = Math.floor(player.xp / 100) + 1;
    const currentLevelXP = player.xp % 100;

    const completedToday =
      player.completedDates.includes(today);

    setText("#playerName", player.username);
    setText("#playerRank", player.rank_title);

    setText(
      "#levelNumber",
      String(level).padStart(2, "0")
    );

    setText(
      "#levelLabel",
      `Level ${level} · ${
        level === 1
          ? "Pemula"
          : level < 5
          ? "Penjelajah"
          : "Penjaga Hafalan"
      }`
    );

    setText(
      "#xpLabel",
      `${currentLevelXP} / 100 XP`
    );

    setText("#xpPercent", `${currentLevelXP}%`);

    const xpBar = $("#xpBar");
    if (xpBar) {
      xpBar.style.width = `${currentLevelXP}%`;
    }

    setText(
      "#questCount",
      completedToday ? "1/1" : "0/1"
    );

    const questBar = $("#questBar");
    if (questBar) {
      questBar.style.width =
        completedToday ? "100%" : "0%";
    }

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

  // ==========================================
  // XP PEMAIN
  // Catatan: update dari browser belum anti-cheat.
  // ==========================================
  async function awardXP(amount) {
    const points = Number(amount);

    if (
      !Number.isFinite(points) ||
      points <= 0 ||
      points > 1000
    ) {
      return;
    }

    const oldLevel =
      Math.floor(player.xp / 100) + 1;

    player.xp += points;

    if (!player.completedDates.includes(today)) {
      player.completedDates.push(today);
    }

    savePlayer();
    renderPlayer();

    if (supabase && currentUser) {
      const userId = currentUser.id;

      const { error } = await supabase
        .from("profiles")
        .update({ exp: player.xp })
        .eq("id", userId);

      if (error) {
        console.error(
          "XP sync error:",
          error.message
        );

        showToast(
          "XP lokal bertambah, tetapi gagal disinkronkan."
        );
      }
    }

    const newLevel =
      Math.floor(player.xp / 100) + 1;

    showToast(
      newLevel > oldLevel
        ? `LEVEL UP! Sekarang level ${newLevel}. Terus jaga hafalanmu!`
        : `+${points} XP! Progres hafalanmu bertambah.`
    );
  }

  // ==========================================
  // GAME
  // ==========================================
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

        if (
          mode === "continue" ||
          mode === "previous"
        ) {
          button.style.direction = "rtl";
          button.style.textAlign = "center";
          button.style.fontFamily = "Georgia, serif";
          button.style.fontSize = "19px";
        }

        button.addEventListener("click", () => {
          checkAnswer(index);
        });

        list.appendChild(button);
      });
    }

    if ($("#gameModal")) {
      $("#gameModal").hidden = false;
    }

    document.body.style.overflow = "hidden";
  }

  function checkAnswer(selectedIndex) {
    if (answered || !currentQuestion) return;

    answered = true;

    const correct =
      selectedIndex === currentQuestion.correct;

    $$("#answerList .answer-option").forEach(
      (button, index) => {
        button.disabled = true;

        if (index === currentQuestion.correct) {
          button.classList.add("correct");
        } else if (
          index === selectedIndex &&
          !correct
        ) {
          button.classList.add("wrong");
        }
      }
    );

    setText(
      "#answerFeedback",
      correct
        ? `✓ ${currentQuestion.explanation} +25 XP`
        : `Belum tepat. ${currentQuestion.explanation}`
    );

    if (correct) {
      void awardXP(25);
    }

    const next = $("#continueButton");

    if (next) {
      next.hidden = false;
      next.textContent = "Kembali ke Arena →";
    }
  }

  function closeModal() {
    if ($("#gameModal")) {
      $("#gameModal").hidden = true;
    }

    document.body.style.overflow = "";
    currentMode = null;
    currentQuestion = null;
  }

  // ==========================================
  // AUTH MODAL DAN OTP
  // ==========================================
  function showAuthStep(step) {
    if ($("#emailStep")) {
      $("#emailStep").hidden = step !== "email";
    }

    if ($("#otpStep")) {
      $("#otpStep").hidden = step !== "otp";
    }

    if ($("#profileStep")) {
      $("#profileStep").hidden = step !== "profile";
    }
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

      setText(
        "#profileEmail",
        currentUser.email || "Email tidak tersedia"
      );

      const nameInput = $("#profileUsername");

      if (nameInput) {
        nameInput.value = player.username;
      }

      renderAvatar();
    } else {
      showAuthStep("email");
      setAuthFeedback("");

      if ($("#authEmail")) {
        $("#authEmail").value = "";
      }

      if ($("#authOtp")) {
        $("#authOtp").value = "";
      }
    }
  }

  function closeAuthModal() {
    if ($("#authModal")) {
      $("#authModal").hidden = true;
    }

    document.body.style.overflow = "";
    setAuthFeedback("");
  }

  async function handleAuthState(session) {
    currentUser = session?.user || null;

    if (currentUser) {
      await fetchProfileFromSupabase(currentUser.id);
    } else {
      profileLoadUserId = null;

      // Muat progres lokal ketika tidak login.
      player = loadPlayer();
      renderPlayer();
    }

    renderPlayer();
    void fetchLeaderboard();
  }

  // ==========================================
  // SIMPAN PROFIL DAN AVATAR
  // ==========================================
  async function saveProfile() {
    if (!supabase || !currentUser || profileBusy) {
      return;
    }

    const input = $("#profileUsername");
    const username = input?.value.trim() || "";

    if (
      username.length < 3 ||
      username.length > 24
    ) {
      setAuthFeedback(
        "Username harus terdiri dari 3–24 karakter.",
        true
      );
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

    setButtonBusy(
      saveBtn,
      true,
      "Menyimpan..."
    );

    setAuthFeedback("Menyimpan profil...");

    try {
      let avatarKey = player.avatar_key || "";
      let avatarUrl = player.avatar_url || "";

      const file =
        $("#profileAvatarFile")?.files?.[0] || null;

      if (file) {
        const allowed = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (!allowed.includes(file.type)) {
          throw new Error(
            "Gunakan foto JPG, PNG, atau WebP."
          );
        }

        if (file.size > 2 * 1024 * 1024) {
          throw new Error(
            "Ukuran foto maksimal 2 MB."
          );
        }

        const ext =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
            ? "webp"
            : "jpg";

        const path =
          `${currentUser.id}/avatar-${Date.now()}.${ext}`;

        const { error: uploadError } =
          await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(path, file, {
              cacheControl: "3600",
              upsert: true,
              contentType: file.type,
            });

        if (uploadError) {
          throw new Error(
            `Upload foto gagal: ${uploadError.message}`
          );
        }

        const { data: publicData } =
          supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(path);

        avatarKey = path;
        avatarUrl = publicData.publicUrl;
      }

      const userId = currentUser.id;

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: username,
          avatar_key: avatarKey,
        })
        .eq("id", userId);

      if (error) {
        throw new Error(
          `Gagal menyimpan profil: ${error.message}`
        );
      }

      player.username = username;
      player.avatar_key = avatarKey;
      player.avatar_url = avatarUrl;

      savePlayer();
      renderPlayer();
      renderAvatar();

      setAuthFeedback("Profil berhasil disimpan.");

      void fetchLeaderboard();

      showToast(
        "Profil MJ Arena berhasil diperbarui!"
      );

      if ($("#profileAvatarFile")) {
        $("#profileAvatarFile").value = "";
      }
    } catch (error) {
      console.error("Simpan profil gagal:", error);

      setAuthFeedback(
        error.message || "Gagal menyimpan profil.",
        true
      );
    } finally {
      profileBusy = false;
      setButtonBusy(saveBtn, false);
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function bindEvents() {
    // Tombol profil: buka modal yang benar.
    $("#authButton")?.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();

        if (!supabase) {
          showToast("Supabase belum termuat.");
          return;
        }

        const { data, error } =
          await supabase.auth.getSession();

        if (error) {
          console.error(
            "Session error:",
            error.message
          );

          showToast(
            "Gagal memeriksa sesi login."
          );
          return;
        }

        currentUser =
          data.session?.user || null;

        if (currentUser) {
          await fetchProfileFromSupabase(
            currentUser.id
          );
        }

        openAuthModal();
      }
    );

    $("#closeAuthModal")?.addEventListener(
      "click",
      closeAuthModal
    );

    $("#authModal")?.addEventListener(
      "click",
      (event) => {
        if (event.target === $("#authModal")) {
          closeAuthModal();
        }
      }
    );

    // Kirim OTP.
    $("#sendOtpBtn")?.addEventListener(
      "click",
      async () => {
        if (!supabase) {
          setAuthFeedback(
            "Supabase SDK belum termuat. Periksa koneksi internet.",
            true
          );
          return;
        }

        const email =
          $("#authEmail")?.value
            .trim()
            .toLowerCase() || "";

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setAuthFeedback(
            "Masukkan alamat email yang valid.",
            true
          );
          return;
        }

        const button = $("#sendOtpBtn");

        setButtonBusy(
          button,
          true,
          "Mengirim OTP..."
        );

        setAuthFeedback("Mengirim kode OTP...");

        try {
          const { error } =
            await supabase.auth.signInWithOtp({
              email,
              options: {
                shouldCreateUser: true,
              },
            });

          if (error) throw error;

          showAuthStep("otp");

          setAuthFeedback(
            `Kode dikirim ke ${email}. Gunakan kode terbaru dari email tersebut.`
          );

          showToast(
            "OTP terkirim. Periksa inbox dan spam."
          );
        } catch (error) {
          setAuthFeedback(
            `Gagal mengirim OTP: ${error.message}`,
            true
          );
        } finally {
          setButtonBusy(button, false);
        }
      }
    );

    // Verifikasi OTP.
    $("#verifyOtpBtn")?.addEventListener(
      "click",
      async () => {
        if (!supabase) {
          setAuthFeedback(
            "Supabase SDK belum termuat.",
            true
          );
          return;
        }

        const email =
          $("#authEmail")?.value
            .trim()
            .toLowerCase() || "";

        const token =
          $("#authOtp")?.value.trim() || "";

        if (!email) {
          setAuthFeedback(
            "Email tidak ditemukan. Masukkan email lagi.",
            true
          );
          return;
        }

        if (!/^\d{6}$/.test(token)) {
          setAuthFeedback(
            "Masukkan kode OTP 6 digit.",
            true
          );
          return;
        }

        const button = $("#verifyOtpBtn");

        setButtonBusy(
          button,
          true,
          "Memverifikasi..."
        );

        setAuthFeedback(
          "Memverifikasi kode..."
        );

        try {
          const { data, error } =
            await supabase.auth.verifyOtp({
              email,
              token,
              type: "email",
            });

          if (error) throw error;

          currentUser =
            data.user ||
            data.session?.user ||
            null;

          if (!currentUser) {
            throw new Error(
              "Login belum menghasilkan sesi. Coba kirim OTP baru."
            );
          }

          await fetchProfileFromSupabase(
            currentUser.id
          );

          renderPlayer();
          void fetchLeaderboard();

          showAuthStep("profile");

          setText(
            "#profileEmail",
            currentUser.email || email
          );

          if ($("#profileUsername")) {
            $("#profileUsername").value =
              player.username;
          }

          setAuthFeedback(
            "Login berhasil. Kamu sekarang bisa mengedit profil."
          );

          showToast(
            "Berhasil login ke MJ Arena!"
          );
        } catch (error) {
          console.error(
            "Verifikasi OTP gagal:",
            error
          );

          setAuthFeedback(
            `Verifikasi gagal: ${error.message}. Jika kode kedaluwarsa, kirim OTP baru.`,
            true
          );
        } finally {
          setButtonBusy(button, false);
        }
      }
    );

    $("#backToEmailBtn")?.addEventListener(
      "click",
      () => {
        showAuthStep("email");
        setAuthFeedback("");
      }
    );

    $("#saveProfileBtn")?.addEventListener(
      "click",
      saveProfile
    );

    // Pilih dan pratinjau avatar.
    $("#profileAvatarFile")?.addEventListener(
      "change",
      () => {
        const file =
          $("#profileAvatarFile")?.files?.[0];

        if (!file) return;

        const allowed = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (!allowed.includes(file.type)) {
          $("#profileAvatarFile").value = "";

          setAuthFeedback(
            "Gunakan foto JPG, PNG, atau WebP.",
            true
          );
          return;
        }

        if (file.size > 2 * 1024 * 1024) {
          $("#profileAvatarFile").value = "";

          setAuthFeedback(
            "Ukuran foto maksimal 2 MB.",
            true
          );
          return;
        }

        const preview = $("#profileAvatarPreview");

        if (preview) {
          const url = URL.createObjectURL(file);
          preview.replaceChildren();

          const image = document.createElement("img");
          image.src = url;
          image.alt = "Pratinjau foto";

          image.onload = () => {
            URL.revokeObjectURL(url);
          };

          preview.appendChild(image);
        }
      }
    );

    // Logout.
    $("#logoutBtn")?.addEventListener(
      "click",
      async () => {
        if (!supabase) return;

        const { error } =
          await supabase.auth.signOut();

        if (error) {
          setAuthFeedback(
            `Logout gagal: ${error.message}`,
            true
          );
          return;
        }

        currentUser = null;
        profileLoadUserId = null;

        player = loadPlayer();

        savePlayer();
        renderPlayer();

        showToast("Berhasil logout.");
        closeAuthModal();
      }
    );

    // Tombol mode permainan.
    $$("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode;

        if (modes[mode]) {
          openModal(mode);
        } else if (mode === "daily") {
          if (player.completedDates.includes(today)) {
            showToast(
              "Quest hari ini sudah selesai. Mantap!"
            );
          } else {
            showToast(
              "Quest harian: selesaikan tantangan untuk +25 XP."
            );

            openModal("continue");
          }
        } else if (mode === "duel-user") {
          showToast(
            "Multiplayer Arena sedang disiapkan."
          );
        } else if (mode === "duel-mj") {
          showToast(
            "Tantang MJ sedang disiapkan."
          );
        } else {
          showToast(
            "Mode ini sedang disiapkan."
          );
        }
      });
    });

    $("#closeModal")?.addEventListener(
      "click",
      closeModal
    );

    $("#gameModal")?.addEventListener(
      "click",
      (event) => {
        if (event.target === $("#gameModal")) {
          closeModal();
        }
      }
    );

    $("#continueButton")?.addEventListener(
      "click",
      closeModal
    );

    $("#soundButton")?.addEventListener(
      "click",
      () => {
        soundEnabled = !soundEnabled;

        setText(
          "#soundButton",
          soundEnabled ? "♫" : "♪"
        );

        showToast(
          soundEnabled
            ? "Efek suara diaktifkan."
            : "Efek suara dinonaktifkan."
        );
      }
    );
  }

  // ==========================================
  // INISIALISASI APLIKASI
  // ==========================================
  function init() {
    bindEvents();
    renderPlayer();

    if (!supabase) {
      console.error(
        "Supabase SDK tidak tersedia."
      );

      showToast(
        "Supabase belum termuat. Periksa koneksi internet."
      );
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error(
            "Gagal membaca sesi:",
            error.message
          );
        }

        void handleAuthState(
          data?.session || null
        );
      });

    supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Tunda pekerjaan profil sampai callback auth selesai.
        Promise.resolve().then(() => {
          void handleAuthState(session);
        });
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
