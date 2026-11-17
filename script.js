(() => {
  "use strict";

  const sceneNames = ["intro", "cake", "wish", "princess-cake", "cut", "letter", "final"];
  const scenes = sceneNames.map((name) => document.getElementById(`scene-${name}`));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let audioContext = null;
  let soundEnabled = false;
  let microphoneStream = null;
  let microphoneContext = null;
  let microphoneFrame = 0;
  let typingTimer = 0;
  let letterReady = false;
  let letterOpened = false;

  function showScene(name) {
    const nextIndex = sceneNames.indexOf(name);
    if (nextIndex < 0) return;
    scenes.forEach((scene, index) => {
      const active = index === nextIndex;
      scene.classList.toggle("active", active);
      scene.setAttribute("aria-hidden", String(!active));
    });
    if (nextIndex === 6) launchFinalConfetti();
  }

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => showScene(button.dataset.go));
  });
  scenes.forEach((scene, index) => {
    scene.addEventListener("click", (event) => {
      if (index === 0 || index === sceneNames.length - 1) return;
      if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
      if (index === 2 && candles.some((candle) => !candle.classList.contains("extinguished"))) return;
      if (index === 4 && !cutStage.classList.contains("sliced")) return;
      if (index === 5 && !letterReady) return;
      showScene(sceneNames[index + 1]);
    });
  });
  document.getElementById("replay-button").addEventListener("click", () => {
    resetExperience();
    showScene("intro");
  });

  function createParticles(container, count, className) {
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      particle.className = className;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.setProperty("--duration", `${6 + Math.random() * 8}s`);
      particle.style.setProperty("--drift", `${Math.round(Math.random() * 90 - 45)}px`);
      particle.style.animationDelay = `${Math.random() * 9}s`;
      container.appendChild(particle);
    }
  }
  if (!reducedMotion) {
    createParticles(document.querySelector(".particle-field"), 45, "particle");
    createParticles(document.querySelector(".final-sparkles"), 30, "particle");
  }

  const soundButton = document.querySelector(".sound-toggle");
  if (soundButton) soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    soundButton.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
    soundButton.querySelector(".sound-label").textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
    if (soundEnabled) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Audio is not supported in this browser.");
        audioContext = audioContext || new AudioContextClass();
        if (audioContext.state === "suspended") audioContext.resume();
        playChime();
      } catch (error) {
        soundEnabled = false;
        soundButton.setAttribute("aria-pressed", "false");
        soundButton.setAttribute("aria-label", "Turn sound on");
        soundButton.querySelector(".sound-label").textContent = "SOUND OFF";
        console.info("Optional sound is unavailable in this browser.", error);
      }
    } else if (audioContext) {
      audioContext.suspend();
    }
  });

  function playChime() {
    if (!soundEnabled || !audioContext) return;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + index * 0.13 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + index * 0.13 + 0.65);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime + index * 0.13);
      oscillator.stop(audioContext.currentTime + index * 0.13 + 0.7);
    });
  }

  const cutStage = document.getElementById("cut-stage");
  const cutCake = document.getElementById("cut-cake");
  const knife = document.getElementById("drag-knife");
  const cutPath = document.querySelector(".cut-path");
  const cutStatus = document.getElementById("cut-status");
  const cutConfetti = document.getElementById("cut-confetti");
  let knifeDrag = null;

  function pointInCake(event) {
    const rect = cutCake.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * 300,
      y: (event.clientY - rect.top) / rect.height * 205
    };
  }
  knife.addEventListener("pointerdown", (event) => {
    if (cutStage.classList.contains("sliced")) return;
    event.preventDefault();
    knife.setPointerCapture(event.pointerId);
    knifeDrag = { pointerId: event.pointerId, points: [pointInCake(event)], startedInside: false };
    cutStage.classList.add("is-dragging");
    knife.style.left = `${event.clientX - cutStage.getBoundingClientRect().left - 15}px`;
    knife.style.top = `${event.clientY - cutStage.getBoundingClientRect().top - 15}px`;
    cutStatus.textContent = "Keep dragging across the cake...";
  });
  knife.addEventListener("pointermove", (event) => {
    if (!knifeDrag || knifeDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = pointInCake(event);
    knifeDrag.points.push(point);
    const stageRect = cutStage.getBoundingClientRect();
    knife.style.left = `${event.clientX - stageRect.left - 15}px`;
    knife.style.top = `${event.clientY - stageRect.top - 15}px`;
    const cakeRect = cutCake.getBoundingClientRect();
    knifeDrag.startedInside = knifeDrag.startedInside || (
      event.clientX >= cakeRect.left && event.clientX <= cakeRect.right &&
      event.clientY >= cakeRect.top && event.clientY <= cakeRect.bottom
    );
    cutPath.setAttribute("d", knifeDrag.points.map((entry, index) => `${index ? "L" : "M"} ${entry.x} ${entry.y}`).join(" "));
  });
  function finishCut(event) {
    if (!knifeDrag || (event && knifeDrag.pointerId !== event.pointerId)) return;
    const points = knifeDrag.points;
    const horizontalSweep = points.length > 3 && Math.abs(points[points.length - 1].x - points[0].x) > 130;
    const crossedCake = knifeDrag.startedInside && horizontalSweep;
    knifeDrag = null;
    cutStage.classList.remove("is-dragging");
    if (!crossedCake) {
      cutStatus.textContent = "Try again—drag the knife right across the cake.";
      cutPath.setAttribute("d", "");
      knife.style.left = "16%";
      knife.style.top = "210px";
      return;
    }
    cutStage.classList.add("sliced");
    cutStatus.textContent = "A perfect first slice! ✨";
    celebrateSlice();
    playChime();
  }
  knife.addEventListener("pointerup", finishCut);
  knife.addEventListener("pointercancel", finishCut);
  function celebrateSlice() {
    if (reducedMotion) return;
    for (let index = 0; index < 38; index += 1) {
      const bit = document.createElement("i");
      bit.className = "confetti-bit";
      bit.style.setProperty("--x", `${Math.round(Math.random() * 400 - 200)}px`);
      bit.style.setProperty("--y", `${Math.round(Math.random() * 240 - 130)}px`);
      bit.style.setProperty("--r", `${Math.round(Math.random() * 720 - 360)}deg`);
      cutConfetti.appendChild(bit);
      window.setTimeout(() => bit.remove(), 1100);
    }
  }

  const candles = [...document.querySelectorAll(".wish-candle")];
  const wishStatus = document.getElementById("wish-status");
  function extinguishCandle(candle) {
    if (candle.classList.contains("extinguished")) return;
    candle.classList.add("extinguished");
    candle.setAttribute("aria-label", `${candle.dataset.number} extinguished`);
    const remaining = candles.filter((item) => !item.classList.contains("extinguished")).length;
    wishStatus.textContent = remaining ? `${remaining} little ${remaining === 1 ? "flame" : "flames"} left. Keep wishing!` : "Wish made. May it find its way to you. ✨";
    playChime();
  }
  candles.forEach((candle, index) => {
    candle.dataset.number = `Candle ${index + 1}`;
    candle.addEventListener("click", () => extinguishCandle(candle));
  });

  const micButton = document.getElementById("mic-button");
  const micNote = document.getElementById("mic-note");
  micButton.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showMicNote("Microphone access isn't available here. You can still tap each candle.");
      return;
    }
    micButton.disabled = true;
    showMicNote("Allow microphone access when your browser asks, then give a gentle blow.");
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio analysis is not supported in this browser.");
      const context = new AudioContextClass();
      microphoneContext = context;
      const analyser = context.createAnalyser();
      const source = context.createMediaStreamSource(microphoneStream);
      const data = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      showMicNote("Listening for a gentle blow... You can also tap the candles anytime.");
      let consecutiveLoudFrames = 0;
      const listen = () => {
        analyser.getByteTimeDomainData(data);
        let energy = 0;
        for (let index = 0; index < data.length; index += 1) {
          const sample = (data[index] - 128) / 128;
          energy += sample * sample;
        }
        consecutiveLoudFrames = Math.sqrt(energy / data.length) > 0.13 ? consecutiveLoudFrames + 1 : 0;
        if (consecutiveLoudFrames > 5) {
          const nextCandle = candles.find((candle) => !candle.classList.contains("extinguished"));
          if (nextCandle) extinguishCandle(nextCandle);
          consecutiveLoudFrames = 0;
        }
        microphoneFrame = window.requestAnimationFrame(listen);
      };
      listen();
      window.setTimeout(stopMicrophone, 30000);
    } catch (error) {
      stopMicrophone();
      showMicNote("Microphone permission wasn't available. Tapping the candles still works perfectly.");
      console.info("Optional microphone interaction unavailable.", error);
    }
  });
  function showMicNote(message) {
    micNote.textContent = message;
    micNote.classList.remove("is-hidden");
  }
  function stopMicrophone() {
    if (microphoneFrame) window.cancelAnimationFrame(microphoneFrame);
    microphoneFrame = 0;
    if (microphoneStream) microphoneStream.getTracks().forEach((track) => track.stop());
    microphoneStream = null;
    if (microphoneContext && microphoneContext.state !== "closed") microphoneContext.close();
    microphoneContext = null;
    micButton.disabled = false;
  }

  const envelope = document.getElementById("envelope");
  envelope.addEventListener("click", () => {
    if (envelope.classList.contains("open")) return;
    letterOpened = true;
    envelope.classList.add("open");
    document.getElementById("letter-hint").classList.add("is-hidden");
    window.setTimeout(() => {
      envelope.classList.add("is-hidden");
      const card = document.getElementById("letter-card");
      card.classList.remove("is-hidden");
      typeLetter();
    }, reducedMotion ? 0 : 550);
  });
  const birthdayMessage = "Today is all about celebrating you—your hopes, your dreams, and all the wonderful possibilities waiting in the year ahead. May the days to come bring you joy, warmth, little moments of magic, and every reason to smile. Keep shining in your own beautiful way. You deserve a birthday as lovely as you are.";
  function typeLetter() {
    const letterBody = document.getElementById("letter-body");
    if (letterBody.textContent.length > 0) return;
    if (reducedMotion) {
      letterBody.textContent = birthdayMessage;
      letterReady = true;
    } else {
      let index = 0;
      const writeNext = () => {
        if (!letterBody.isConnected || letterBody.textContent.length >= birthdayMessage.length) {
          typingTimer = 0;
          letterReady = true;
          return;
        }
        letterBody.textContent += birthdayMessage[index];
        index += 1;
        typingTimer = window.setTimeout(writeNext, 19);
      };
      writeNext();
    }
  }
  document.getElementById("letter-body").addEventListener("input", () => {
    if (typingTimer) window.clearTimeout(typingTimer);
    typingTimer = 0;
    if (letterOpened) letterReady = true;
  });

  function launchFinalConfetti() {
    const field = document.querySelector(".final-sparkles");
    if (reducedMotion) return;
    for (let index = 0; index < 72; index += 1) {
      const bit = document.createElement("i");
      bit.className = "confetti-bit";
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.top = `${Math.random() * 35}%`;
      bit.style.setProperty("--x", `${Math.round(Math.random() * 180 - 90)}px`);
      bit.style.setProperty("--y", `${Math.round(250 + Math.random() * 420)}px`);
      bit.style.setProperty("--r", `${Math.round(Math.random() * 720 - 360)}deg`);
      field.appendChild(bit);
      window.setTimeout(() => bit.remove(), 1500);
    }
  }

  function resetExperience() {
    stopMicrophone();
    cutStage.classList.remove("sliced", "is-dragging");
    cutPath.setAttribute("d", "");
    knife.style.left = "";
    knife.style.top = "";
    cutStatus.textContent = "Hold the knife and sweep across the cake.";
    document.getElementById("cut-confetti").replaceChildren();
    candles.forEach((candle) => {
      candle.classList.remove("extinguished");
      candle.setAttribute("aria-label", `Extinguish ${candle.dataset.number.toLowerCase()}`);
    });
    wishStatus.textContent = "Five little wishes, just for you.";
    micNote.classList.add("is-hidden");
    document.getElementById("letter-card").classList.add("is-hidden");
    if (typingTimer) window.clearTimeout(typingTimer);
    typingTimer = 0;
    document.getElementById("letter-body").textContent = "";
    letterReady = false;
    letterOpened = false;
    document.getElementById("envelope").classList.remove("open", "is-hidden");
    document.getElementById("letter-hint").classList.remove("is-hidden");
  }
})();
