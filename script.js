(() => {
  const $ = (id) => document.getElementById(id);
  const participants = Array.from(document.querySelectorAll(".player-card"));
  const panel = $("lobbyPanel");
  const settings = $("settingsPopover");
  const modeMenu = $("modeMenu");
  const soundToggle = $("soundToggle");
  const soundOnIcon = $("soundOnIcon");
  const soundOffIcon = $("soundOffIcon");
  const customSound = $("customSound");
  const backgroundMusic = $("backgroundMusic");
  let soundEnabled = true;
  let soundUrl = "";
  let musicUrl = "";
  let musicMuted = false;
  let isSeekingMusic = false;
  let audioContext = null;
  let toastTimer = null;

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function playTone(kind = "click") {
    if (!soundEnabled) return;
    if (soundUrl) {
      try {
        customSound.currentTime = 0;
        customSound.play().catch(() => synthTone(kind));
      } catch (_) { synthTone(kind); }
      return;
    }
    synthTone(kind);
  }

  function synthTone(kind) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === "suspended") audioContext.resume();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      const notes = kind === "start" ? [523.25, 659.25, 783.99] : kind === "select" ? [440, 554.37] : [660];
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(notes[0], now);
      if (notes.length > 1) oscillator.frequency.setValueAtTime(notes[1], now + 0.09);
      if (notes.length > 2) oscillator.frequency.setValueAtTime(notes[2], now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "start" ? 0.42 : 0.16));
      oscillator.start(now);
      oscillator.stop(now + (kind === "start" ? 0.45 : 0.18));
    } catch (_) {
      // Audio may be blocked by browser settings; the lobby still works.
    }
  }

  function setSoundState() {
    soundOnIcon.classList.toggle("hidden", !soundEnabled);
    soundOffIcon.classList.toggle("hidden", soundEnabled);
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    backgroundMusic.muted = !soundEnabled || musicMuted;
    updateMusicMuteButton();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return hours + ":" + String(minutes % 60).padStart(2, "0") + ":" + String(remainingSeconds).padStart(2, "0");
    }
    return minutes + ":" + String(remainingSeconds).padStart(2, "0");
  }

  function updateMusicMuteButton() {
    const button = $("musicMuteButton");
    if (!button) return;
    button.textContent = (musicMuted || !soundEnabled) ? "🔇 Musik dibisukan" : "🔊 Bisukan musik";
    button.disabled = !musicUrl;
  }

  function updateMusicProgress() {
    const duration = backgroundMusic.duration;
    const current = backgroundMusic.currentTime || 0;
    $("musicCurrentTime").textContent = formatTime(current);
    $("musicDuration").textContent = formatTime(duration);
    if (!isSeekingMusic && Number.isFinite(duration) && duration > 0) {
      $("musicProgress").value = String(Math.round((current / duration) * 1000));
    }
  }

  function setMusicButtonsEnabled(enabled) {
    ["musicPlayButton", "musicPauseButton", "musicStopButton", "musicMuteButton", "musicRemoveButton", "musicProgress"].forEach(id => {
      $(id).disabled = !enabled;
    });
    updateMusicMuteButton();
  }

  function updateMusicStatus(message) {
    $("musicStatus").textContent = message;
  }

  function loadImage(input, imageElement, fallbackElement, toastMessage) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Pilih file gambar yang valid.");
      return;
    }
    const url = URL.createObjectURL(file);
    imageElement.onload = () => {
      imageElement.style.display = "block";
      if (fallbackElement) fallbackElement.style.display = "none";
      showToast(toastMessage);
      playTone("select");
    };
    imageElement.onerror = () => showToast("Gambar tidak dapat dibuka.");
    imageElement.src = url;
  }

  function loadLogo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Pilih file gambar untuk logo.");
    const url = URL.createObjectURL(file);
    $("brandImage").src = url;
    $("brandImage").style.display = "block";
    $("brandText").style.display = "none";
    showToast("Logo berhasil dipasang.");
    playTone("select");
  }

  function loadAvatar(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Pilih file gambar untuk avatar.");
    const url = URL.createObjectURL(file);
    const img = $("selectedAvatarImage");
    img.src = url;
    img.style.display = "block";
    $("selectedEmoji").style.display = "none";
    const selectedCard = document.querySelector(".player-card.selected");
    if (selectedCard) {
      let cardImg = selectedCard.querySelector(".custom-player-image");
      if (!cardImg) {
        cardImg = document.createElement("img");
        cardImg.className = "custom-player-image";
        cardImg.alt = "";
        cardImg.style.cssText = "width:40px;height:36px;object-fit:cover;border-radius:50%;flex:0 0 40px;";
        selectedCard.querySelector(".player-avatar").replaceWith(cardImg);
      }
      cardImg.src = url;
    }
    showToast("Avatar berhasil diganti.");
    playTone("select");
  }

  function selectPlayer(card) {
    participants.forEach(p => p.classList.toggle("selected", p === card));
    $("selectedName").textContent = card.dataset.name || card.querySelector(".player-name").textContent;
    const emoji = card.dataset.emoji || "🙂";
    $("selectedEmoji").textContent = emoji;
    $("selectedEmoji").style.display = "inline";
    $("selectedAvatarImage").style.display = "none";
    $("selectedAvatarImage").removeAttribute("src");
    const customImg = card.querySelector(".custom-player-image");
    if (customImg) {
      $("selectedAvatarImage").src = customImg.src;
      $("selectedAvatarImage").style.display = "block";
      $("selectedEmoji").style.display = "none";
    }
    playTone("select");
  }

  // Arrange the ten names in the same 4 / 4 / 2 rows as the reference image.
  const rowGroups = [participants.slice(0, 4), participants.slice(4, 8), participants.slice(8, 10)];
  const participantContainer = $("participants");
  participantContainer.innerHTML = "";
  rowGroups.forEach(group => {
    const row = document.createElement("div");
    row.className = "player-row";
    group.forEach(card => row.appendChild(card));
    participantContainer.appendChild(row);
  });

  participants.forEach(card => {
    card.addEventListener("click", () => selectPlayer(card));
    card.querySelector(".player-name").addEventListener("dblclick", (event) => {
      event.stopPropagation();
      const current = card.querySelector(".player-name").textContent;
      const next = window.prompt("Masukkan nama peserta:", current);
      if (next && next.trim()) {
        card.querySelector(".player-name").textContent = next.trim();
        card.dataset.name = next.trim();
        if (card.classList.contains("selected")) $("selectedName").textContent = next.trim();
        playTone("select");
      }
    });
  });

  // Start with Nightwing selected.
  selectPlayer(participants.find(p => p.dataset.name === "Nightwing") || participants[0]);

  $("brandButton").addEventListener("click", () => $("logoInput").click());
  $("logoInput").addEventListener("change", e => loadLogo(e.target));
  $("logoInputSettings").addEventListener("change", e => loadLogo(e.target));
  $("editAvatarButton").addEventListener("click", () => $("avatarInput").click());
  $("selectedAvatarButton").addEventListener("click", () => $("avatarInput").click());
  $("avatarInput").addEventListener("change", e => loadAvatar(e.target));
  $("avatarInputSettings").addEventListener("change", e => loadAvatar(e.target));

  $("settingsButton").addEventListener("click", () => {
    settings.classList.toggle("hidden");
    modeMenu.classList.add("hidden");
    playTone("click");
  });
  $("closeSettings").addEventListener("click", () => settings.classList.add("hidden"));
  $("modeButton").addEventListener("click", () => {
    modeMenu.classList.toggle("hidden");
    settings.classList.add("hidden");
    $("modeButton").setAttribute("aria-expanded", String(!modeMenu.classList.contains("hidden")));
    playTone("click");
  });
  modeMenu.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    $("modeLabel").textContent = button.dataset.mode;
    modeMenu.classList.add("hidden");
    $("modeButton").setAttribute("aria-expanded", "false");
    showToast("Mode diubah ke " + button.dataset.mode + ".");
    playTone("select");
  }));

  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    setSoundState();
    if (soundEnabled) {
      playTone("select");
      showToast("Suara diaktifkan.");
    } else {
      showToast("Semua suara dibisukan.");
    }
  });
  setSoundState();

  $("soundInput").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) return showToast("Pilih file audio yang valid.");
    if (soundUrl) URL.revokeObjectURL(soundUrl);
    soundUrl = URL.createObjectURL(file);
    customSound.src = soundUrl;
    customSound.load();
    showToast("Efek suara kustom siap digunakan.");
    playTone("select");
  });

  $("musicInput").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      showToast("Pilih file musik/audio yang valid.");
      event.target.value = "";
      return;
    }
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    musicUrl = URL.createObjectURL(file);
    backgroundMusic.pause();
    backgroundMusic.src = musicUrl;
    backgroundMusic.currentTime = 0;
    backgroundMusic.loop = $("musicLoop").checked;
    backgroundMusic.volume = Number($("musicVolume").value) / 100;
    backgroundMusic.muted = !soundEnabled || musicMuted;
    backgroundMusic.load();

    $("musicFileName").textContent = file.name;
    updateMusicStatus("File siap. Tekan Putar musik atau klik “Oke, mulai!”.");
    $("musicProgress").value = "0";
    $("musicCurrentTime").textContent = "0:00";
    $("musicDuration").textContent = "0:00";
    setMusicButtonsEnabled(true);
    showToast("Musik latar berhasil dimasukkan.");
    playTone("select");
  });

  $("musicPlayButton").addEventListener("click", async () => {
    if (!musicUrl) {
      showToast("Masukkan file musik terlebih dahulu.");
      return;
    }
    try {
      backgroundMusic.loop = $("musicLoop").checked;
      backgroundMusic.volume = Number($("musicVolume").value) / 100;
      backgroundMusic.muted = !soundEnabled || musicMuted;
      await backgroundMusic.play();
      updateMusicStatus(backgroundMusic.loop ? "Sedang diputar • mode berulang aktif." : "Sedang diputar.");
      showToast("Musik latar diputar.");
    } catch (_) {
      updateMusicStatus("Musik belum bisa diputar. Tekan Putar musik sekali lagi.");
      showToast("Browser belum dapat memutar file ini. Coba format MP3, WAV, atau OGG.");
    }
  });

  $("musicPauseButton").addEventListener("click", () => {
    if (!musicUrl) return;
    backgroundMusic.pause();
    updateMusicStatus("Musik dijeda.");
    showToast("Musik dijeda.");
  });

  $("musicStopButton").addEventListener("click", () => {
    if (!musicUrl) return;
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    updateMusicProgress();
    updateMusicStatus("Musik dihentikan.");
    showToast("Musik dihentikan.");
  });

  $("musicRemoveButton").addEventListener("click", () => {
    backgroundMusic.pause();
    backgroundMusic.removeAttribute("src");
    backgroundMusic.load();
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    musicUrl = "";
    musicMuted = false;
    $("musicInput").value = "";
    $("musicFileName").textContent = "Belum ada musik";
    updateMusicStatus("Pilih file musik untuk digunakan sebagai suara latar.");
    $("musicProgress").value = "0";
    $("musicCurrentTime").textContent = "0:00";
    $("musicDuration").textContent = "0:00";
    setMusicButtonsEnabled(false);
    backgroundMusic.muted = !soundEnabled;
    showToast("Musik dihapus.");
  });

  $("musicMuteButton").addEventListener("click", () => {
    if (!musicUrl) return;
    musicMuted = !musicMuted;
    backgroundMusic.muted = !soundEnabled || musicMuted;
    updateMusicMuteButton();
    showToast(musicMuted || !soundEnabled ? "Musik dibisukan." : "Suara musik diaktifkan.");
  });

  $("musicVolume").addEventListener("input", (event) => {
    const value = Number(event.target.value);
    backgroundMusic.volume = value / 100;
    $("musicVolumeValue").textContent = value + "%";
  });

  $("musicLoop").addEventListener("change", (event) => {
    backgroundMusic.loop = event.target.checked;
    if (musicUrl) updateMusicStatus(event.target.checked
      ? "Mode berulang aktif."
      : "Musik akan berhenti setelah selesai.");
  });

  $("musicProgress").addEventListener("pointerdown", () => { isSeekingMusic = true; });
  $("musicProgress").addEventListener("input", (event) => {
    const duration = backgroundMusic.duration;
    if (!musicUrl || !Number.isFinite(duration) || duration <= 0) return;
    const targetTime = (Number(event.target.value) / 1000) * duration;
    $("musicCurrentTime").textContent = formatTime(targetTime);
  });
  $("musicProgress").addEventListener("change", (event) => {
    const duration = backgroundMusic.duration;
    if (musicUrl && Number.isFinite(duration) && duration > 0) {
      backgroundMusic.currentTime = (Number(event.target.value) / 1000) * duration;
    }
    isSeekingMusic = false;
    updateMusicProgress();
  });
  $("musicProgress").addEventListener("pointerup", () => { isSeekingMusic = false; });
  backgroundMusic.addEventListener("timeupdate", updateMusicProgress);
  backgroundMusic.addEventListener("loadedmetadata", updateMusicProgress);
  backgroundMusic.addEventListener("durationchange", updateMusicProgress);
  backgroundMusic.addEventListener("ended", () => {
    if (musicUrl && !$("musicLoop").checked) updateMusicStatus("Musik selesai diputar.");
  });
  setMusicButtonsEnabled(false);

  $("startButton").addEventListener("click", async () => {
    playTone("start");
    let musicStarted = false;

    if (musicUrl && $("musicAutoStart").checked) {
      try {
        backgroundMusic.loop = $("musicLoop").checked;
        backgroundMusic.volume = Number($("musicVolume").value) / 100;
        backgroundMusic.muted = !soundEnabled || musicMuted;
        await backgroundMusic.play();
        updateMusicStatus(backgroundMusic.loop ? "Sedang diputar • mode berulang aktif." : "Sedang diputar.");
        musicStarted = true;
      } catch (_) {
        updateMusicStatus("Klik Putar musik untuk mencoba memulai musik latar.");
      }
    }

    $("startButton").textContent = "Siap bermain!";
    showToast(musicStarted
      ? "Lobby siap. Musik latar sedang diputar."
      : "Lobby demo siap! Tombol ini belum memulai kuis sungguhan.");
    setTimeout(() => { $("startButton").textContent = "Oke, mulai!"; }, 2200);
  });

  $("closeButton").addEventListener("click", () => {
    panel.classList.toggle("dimmed");
    if (panel.classList.contains("dimmed")) {
      panel.style.opacity = ".25";
      showToast("Panel disembunyikan. Klik tombol X lagi untuk menampilkannya.");
    } else {
      panel.style.opacity = "1";
    }
    playTone("click");
  });

  document.addEventListener("click", (event) => {
    if (!settings.contains(event.target) && event.target !== $("settingsButton") && !modeMenu.contains(event.target) && event.target !== $("modeButton")) {
      if (!event.target.closest(".top-controls")) modeMenu.classList.add("hidden");
    }
  });
})();
