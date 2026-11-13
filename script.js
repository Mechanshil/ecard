/**
 * Wedding Invitation E-Card: Khulpu Merung & Keishang Muidou Kansou
 * Smooth, 60-120fps interactions, Web Audio engine, 3D tilt, and Canvas particles
 */

(() => {
  'use strict';

  // =========================================================================
  // 1. STATE & CONSTANTS
  // =========================================================================
  const TARGET_DATE = new Date('2026-12-14T11:00:00+05:30'); // Dec 14, 2026 11:00 AM IST
  
  const state = {
    curtainOpened: false,
    groomRevealed: false,
    brideRevealed: false,
    bothRevealed: false,
    timelineShown: false,
    invitationShown: false,
    envelopeOpened: false,
    cardElevated: false,
    musicPlaying: true,
    userMuted: false,
    audioInitialized: false,
    tilt: { x: 0, y: 0, targetX: 0, targetY: 0 },
    dragStartY: 0,
    currentDragY: 0,
    isDragging: false
  };

  // DOM Elements
  const curtainOverlay = document.getElementById('curtainOverlay');
  const drapeLeft = document.getElementById('drapeLeft');
  const drapeRight = document.getElementById('drapeRight');
  const ropeAssembly = document.getElementById('curtainRopeAssembly');
  const goldenCord = document.getElementById('goldenCord');
  const tasselMedallion = document.getElementById('tasselMedallion');
  const archClipPath = document.getElementById('archClipPath');
  const archShadowAmbient = document.getElementById('archShadowAmbient');
  const archShadowDirect = document.getElementById('archShadowDirect');
  const archTrimPath = document.getElementById('archTrimPath');
  const archEdgeSvg = document.getElementById('archEdgeSvg');
  const shadowsTapAdvice = document.getElementById('shadowsTapAdvice');
  const revealedNamesBanner = document.getElementById('revealedNamesBanner');

  // Stage 2: Two Shadows Holding Hands (Individual Reveal, Cardless & Wordless)
  const scratchStage = document.getElementById('scratchStage');
  const shadowsFrame = document.getElementById('shadowsFrame');
  const groomCardBox = document.getElementById('groomCardBox');
  const brideCardBox = document.getElementById('brideCardBox');
  const btnNextStage = document.getElementById('btnNextStage');

  // Stage 3: Timeline Stage
  const timelineStage = document.getElementById('timelineStage');
  const timelineList = document.getElementById('timelineList');
  const btnProceedToCard = document.getElementById('btnProceedToCard');
  const timelineActionArea = document.getElementById('timelineActionArea');
  const tlDays = document.getElementById('tlDays');
  const tlHours = document.getElementById('tlHours');
  const tlMins = document.getElementById('tlMins');
  const tlSecs = document.getElementById('tlSecs');

  // Stage 4: Real Invitation Stage
  const invitationStage = document.getElementById('invitationStage');
  const envelopeWrapper = document.getElementById('envelopeWrapper');
  const envelope = document.getElementById('envelope');
  const waxSeal = document.getElementById('waxSeal');
  const weddingCard = document.getElementById('weddingCard');
  const cardShimmer = document.getElementById('cardShimmer');

  const audioToggle = document.getElementById('audioToggle');
  const ambientCanvas = document.getElementById('ambientCanvas');

  // =========================================================================
  // 2. AUDIO PLAYLIST & ENGINE (Randomized Hook Selection + Custom Audio)
  // =========================================================================
  // Curated playlist with exact timestamps pointing to the most iconic/interesting parts:
  // - Track 1: Suzume (RADWIMPS ft. Toaka) -> 73.5s (The soaring orchestral chorus)
  // - Track 2: Kalengkhi Yamakrou (Maring Song) -> 30.0s (Beat drop & main rhythm entrance)
  const AUDIO_PLAYLIST = [
    {
      id: 'suzume',
      title: 'すずめ (Suzume) - RADWIMPS ft. 十明',
      shortTitle: 'すずめ (Suzume)',
      src: 'assets/suzume.mp3',
      fallbackSrc: 'assets/RADWIMPS - すずめ feat.十明 [Official Lyric Video] - RADWIMPS.mp3',
      startTime: 73.5, // 01:13.5 (The iconic soaring chorus: "Nande naiteru no to kikare...")
      targetVolume: 0.42
    },
    {
      id: 'maring',
      title: 'Kalengkhi Yamakrou - Rang-In-Thang',
      shortTitle: 'Kalengkhi Yamakrou',
      src: 'assets/kalengkhi-yamakrou.mp3',
      fallbackSrc: 'assets/YTDown_YouTube_Maring-Song-Kalengkhi-Yamakrou_Media_d8Wnm1OmMjQ_006_128k.mp3',
      startTime: 30.0, // 00:30.0 (Beat drops into rhythm & main vocal verse; chorus at 136.0s)
      targetVolume: 0.50
    }
  ];

  const AUDIO_CONFIG = {
    fadeInDuration: 1.5, // Volume fade-in duration (seconds)
    fadeOutDuration: 0.8 // Volume fade-out duration (seconds)
  };

  // Select a random starting song from the playlist
  let currentTrackIndex = Math.floor(Math.random() * AUDIO_PLAYLIST.length);
  let audioCtx = null;
  let musicGainNode = null;
  let synthMusicInterval = null;
  let customAudio = null;
  let isUsingCustomAudio = false;
  let customAudioFadeInterval = null;
  let hasAppliedStartTime = false;

  function initAudio() {
    if (state.audioInitialized && audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
      musicGainNode = audioCtx.createGain();
      // Set warm, audible, comfortable default presence (approx -16dB RMS)
      musicGainNode.gain.setValueAtTime(0.38, audioCtx.currentTime);
      musicGainNode.connect(audioCtx.destination);
      state.audioInitialized = true;
    } catch (e) {
      console.warn('AudioContext not supported or restricted', e);
    }
  }

  function seekToInterestingPart() {
    if (hasAppliedStartTime || !customAudio) return;
    const track = AUDIO_PLAYLIST[currentTrackIndex];
    if (!track || typeof track.startTime !== 'number' || track.startTime <= 0) {
      hasAppliedStartTime = true;
      return;
    }

    try {
      if (customAudio.seekable && customAudio.seekable.length > 0) {
        customAudio.currentTime = track.startTime;
        hasAppliedStartTime = true;
      } else if (customAudio.readyState >= 1) { // HAVE_METADATA or higher
        customAudio.currentTime = track.startTime;
        hasAppliedStartTime = true;
      }
    } catch (err) {
      // Audio stream is buffering or negotiating range; will retry on canplay/play
    }
  }

  function initCustomAudioPlayer() {
    if (customAudio) return;
    try {
      customAudio = new Audio();
      customAudio.preload = 'auto';

      const handleReadyToSeek = () => {
        seekToInterestingPart();
      };

      customAudio.addEventListener('loadedmetadata', handleReadyToSeek);
      customAudio.addEventListener('canplay', handleReadyToSeek);

      // Playback ended: pick another random track (or alternate) and seamlessly continue
      customAudio.addEventListener('ended', () => {
        let nextIndex = (currentTrackIndex + 1) % AUDIO_PLAYLIST.length;
        if (AUDIO_PLAYLIST.length > 2) {
          do {
            nextIndex = Math.floor(Math.random() * AUDIO_PLAYLIST.length);
          } while (nextIndex === currentTrackIndex);
        }
        playTrack(nextIndex);
      });

      // Graceful error fallback
      customAudio.addEventListener('error', () => {
        const track = AUDIO_PLAYLIST[currentTrackIndex];
        if (track && track.fallbackSrc && !customAudio.src.includes(encodeURI(track.fallbackSrc))) {
          console.info(`[Audio] Retrying "${track.title}" with fallback path...`);
          customAudio.src = track.fallbackSrc;
          customAudio.load();
          if (state.musicPlaying && !state.userMuted) {
            playTrack(currentTrackIndex);
          }
          return;
        }
        console.info('[Audio] Custom audio unavailable. Using romantic celeste music-box.');
        if (state.musicPlaying && isUsingCustomAudio && !state.userMuted) {
          isUsingCustomAudio = false;
          startSynthMusic();
        }
      });
    } catch (e) {
      console.warn('Custom audio setup error:', e);
      customAudio = null;
    }
  }

  // Play royal harp / sparkle chime glissando when curtain opens
  function playHarpChime() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]; // C5 to C7
    const now = audioCtx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      noteGain.gain.setValueAtTime(0.001, now + idx * 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.08 + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.9);

      osc.connect(noteGain);
      noteGain.connect(audioCtx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.0);
    });
  }

  // Play soft wax seal unsealing pop
  function playWaxPop() {
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (err) {
      // Audio fallback silent
    }
  }

  function updateAudioUI(isPlaying) {
    const track = AUDIO_PLAYLIST[currentTrackIndex];
    const trackName = track ? track.shortTitle : 'Romantic Music';

    if (isPlaying) {
      audioToggle.classList.add('playing');
      audioToggle.setAttribute('title', `Pause Music (${trackName})`);
      audioToggle.setAttribute('aria-label', `Pause Romantic Background Music: ${trackName}`);
    } else {
      audioToggle.classList.remove('playing');
      audioToggle.setAttribute('title', `Play Music (${trackName})`);
      audioToggle.setAttribute('aria-label', `Play Romantic Background Music: ${trackName}`);
    }

    // Update track badge if present in DOM
    const trackBadge = document.getElementById('audioTrackBadge');
    if (trackBadge) {
      const textElem = trackBadge.querySelector('.track-name-text') || trackBadge;
      textElem.textContent = trackName;
      trackBadge.setAttribute('title', `Now Playing: ${track ? track.title : trackName} (Click to switch song)`);

      if (isPlaying) {
        trackBadge.classList.add('visible');
        clearTimeout(trackBadge._hideTimer);
        trackBadge._hideTimer = setTimeout(() => {
          trackBadge.classList.remove('visible');
        }, 4500);
      } else {
        trackBadge.classList.remove('visible');
      }
    }
  }

  function fadeInCustomAudio(targetVolume = 0.5) {
    if (!customAudio) return;
    clearInterval(customAudioFadeInterval);
    const target = targetVolume;
    const duration = AUDIO_CONFIG.fadeInDuration || 1.5;
    const step = target / (duration * 20);
    customAudioFadeInterval = setInterval(() => {
      if (!customAudio || !state.musicPlaying || state.userMuted) {
        clearInterval(customAudioFadeInterval);
        return;
      }
      if (customAudio.volume + step >= target) {
        customAudio.volume = target;
        clearInterval(customAudioFadeInterval);
      } else {
        customAudio.volume = Math.min(target, customAudio.volume + step);
      }
    }, 50);
  }

  function fadeOutCustomAudio(callback) {
    if (!customAudio) {
      if (callback) callback();
      return;
    }
    clearInterval(customAudioFadeInterval);
    const start = customAudio.volume;
    const step = start / 8;
    customAudioFadeInterval = setInterval(() => {
      if (!customAudio || customAudio.volume - step <= 0.05) {
        if (customAudio) customAudio.volume = 0;
        clearInterval(customAudioFadeInterval);
        if (callback) callback();
      } else {
        customAudio.volume = Math.max(0, customAudio.volume - step);
      }
    }, 40);
  }

  // Romantic Celeste & Crystal Music-Box Melody Engine
  function startSynthMusic() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (synthMusicInterval) {
      clearTimeout(synthMusicInterval);
      synthMusicInterval = null;
    }

    // Pentatonic romantic wedding arpeggio melody (Gentle, pure, heartfelt)
    const melody = [
      { note: 261.63, dur: 0.85 }, // C4
      { note: 329.63, dur: 0.85 }, // E4
      { note: 392.00, dur: 0.85 }, // G4
      { note: 493.88, dur: 0.85 }, // B4
      { note: 523.25, dur: 1.30 }, // C5
      { note: 440.00, dur: 0.85 }, // A4
      { note: 392.00, dur: 0.85 }, // G4
      { note: 329.63, dur: 1.30 }, // E4
      { note: 349.23, dur: 0.85 }, // F4
      { note: 392.00, dur: 0.85 }, // G4
      { note: 440.00, dur: 0.85 }, // A4
      { note: 523.25, dur: 1.50 }, // C5
      { note: 392.00, dur: 0.85 }, // G4
      { note: 329.63, dur: 1.70 }  // E4
    ];

    let step = 0;

    function playMelodyStep() {
      if (!state.musicPlaying || state.userMuted || isUsingCustomAudio || !audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const current = melody[step % melody.length];
      const now = audioCtx.currentTime;

      try {
        // 1. Warm Fundamental Celeste Tine (Sine)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(current.note, now);

        // 2. Crystal Music-Box Bell Chime (Octave overtone harmonic)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(current.note * 2, now);

        // 3. Warm Acoustic Lowpass Filter (eliminates digital harshness)
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2600, now);

        // Envelopes: Crisp musical attack + gentle acoustic ring-out
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + current.dur * 1.4);

        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.exponentialRampToValueAtTime(0.10, now + 0.015);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + current.dur * 0.75);

        // Connections
        osc1.connect(gain1);
        gain1.connect(filter);

        osc2.connect(gain2);
        gain2.connect(filter);

        filter.connect(musicGainNode);

        osc1.start(now);
        osc1.stop(now + current.dur * 1.5);
        osc2.start(now);
        osc2.stop(now + current.dur * 0.8);
      } catch (err) {
        // Ignore single-note glitch
      }

      step++;
      synthMusicInterval = setTimeout(playMelodyStep, current.dur * 680);
    }

    playMelodyStep();
  }

  function stopSynthMusic() {
    if (synthMusicInterval) {
      clearTimeout(synthMusicInterval);
      synthMusicInterval = null;
    }
  }

  function playTrack(index) {
    if (!AUDIO_PLAYLIST || !AUDIO_PLAYLIST.length) return;
    currentTrackIndex = (index + AUDIO_PLAYLIST.length) % AUDIO_PLAYLIST.length;
    const track = AUDIO_PLAYLIST[currentTrackIndex];
    hasAppliedStartTime = false;

    if (!customAudio) {
      initCustomAudioPlayer();
    }
    if (!customAudio) return;

    stopSynthMusic();

    const targetSrc = track.src;
    if (!customAudio.src || !customAudio.src.includes(targetSrc)) {
      customAudio.src = targetSrc;
      customAudio.preload = 'auto';
      customAudio.load();
    }

    customAudio.volume = 0;
    state.musicPlaying = true;
    state.userMuted = false;
    isUsingCustomAudio = true;
    updateAudioUI(true);

    const playPromise = customAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        stopSynthMusic();
        seekToInterestingPart();
        fadeInCustomAudio(track.targetVolume || 0.5);
      }).catch(err => {
        console.info('[Audio] Playback deferred or user interaction required:', err);
        isUsingCustomAudio = false;
        startSynthMusic();
      });
    }
  }

  // Unified Background Music Controller
  function startBackgroundMusic() {
    if (state.userMuted) return; // User deliberately shut it off
    state.musicPlaying = true;

    if (AUDIO_PLAYLIST && AUDIO_PLAYLIST.length > 0) {
      const track = AUDIO_PLAYLIST[currentTrackIndex];
      if (!customAudio) {
        initCustomAudioPlayer();
        playTrack(currentTrackIndex);
        return;
      }

      if (customAudio.paused) {
        seekToInterestingPart();
        isUsingCustomAudio = true;
        updateAudioUI(true);
        const playPromise = customAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            stopSynthMusic();
            seekToInterestingPart();
            fadeInCustomAudio(track.targetVolume || 0.5);
          }).catch(err => {
            console.info('[Audio] Playback blocked by browser policy, waiting for gesture:', err);
            isUsingCustomAudio = false;
            startSynthMusic();
          });
          return;
        }
      } else {
        isUsingCustomAudio = true;
        updateAudioUI(true);
        fadeInCustomAudio(track.targetVolume || 0.5);
        return;
      }
    }

    // Default: Built-in romantic celeste music-box melody
    isUsingCustomAudio = false;
    startSynthMusic();
  }

  function stopBackgroundMusic() {
    state.musicPlaying = false;
    updateAudioUI(false);

    if (customAudio && !customAudio.paused) {
      fadeOutCustomAudio(() => {
        customAudio.pause();
      });
    }

    stopSynthMusic();
    isUsingCustomAudio = false;
  }

  function toggleMusic() {
    if (state.musicPlaying) {
      // User explicitly shuts off music
      state.userMuted = true;
      stopBackgroundMusic();
    } else {
      // User turns music back on
      state.userMuted = false;
      startBackgroundMusic();
    }
  }

  audioToggle.addEventListener('click', toggleMusic);

  const audioTrackBadge = document.getElementById('audioTrackBadge');
  if (audioTrackBadge) {
    audioTrackBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextIndex = (currentTrackIndex + 1) % AUDIO_PLAYLIST.length;
      playTrack(nextIndex);
    });
  }

  // Autoplay Initialization: Starts by default and unlocks seamlessly on first user interaction
  function initAudioAutoplay() {
    initAudio();
    startBackgroundMusic();

    const unlockOnGesture = () => {
      if (state.userMuted) return;
      if (!audioCtx) initAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      // If we have custom songs and custom audio is not actively playing, trigger playback on gesture
      if (AUDIO_PLAYLIST && AUDIO_PLAYLIST.length > 0) {
        if (!customAudio || customAudio.paused) {
          stopSynthMusic();
          playTrack(currentTrackIndex);
          return;
        }
      }
      if (!state.musicPlaying || !synthMusicInterval) {
        startBackgroundMusic();
      }
    };

    const gestures = ['pointerdown', 'touchstart', 'click', 'keydown'];
    const handleFirstGesture = () => {
      unlockOnGesture();
      gestures.forEach(evt => window.removeEventListener(evt, handleFirstGesture, true));
    };

    gestures.forEach(evt => {
      window.addEventListener(evt, handleFirstGesture, { capture: true, passive: true });
    });
  }

  // Activate default music immediately
  initAudioAutoplay();

  // =========================================================================
  // 3. CURTAIN INTERACTION ENGINE (LIFT / PULL GESTURE + TAP)
  // =========================================================================
  function updateArchGeometry(rawProgress) {
    if (!archClipPath) return;

    if (rawProgress <= 0.0005) {
      archClipPath.setAttribute('d', 'M 0 0 L 1 0 L 1 1 L 0 1 Z');
      if (archShadowAmbient) archShadowAmbient.setAttribute('d', '');
      if (archShadowDirect) archShadowDirect.setAttribute('d', '');
      if (archTrimPath) archTrimPath.setAttribute('d', '');
      if (drapeLeft) {
        drapeLeft.style.backgroundPosition = '';
        drapeLeft.style.transform = '';
      }
      if (drapeRight) {
        drapeRight.style.backgroundPosition = '';
        drapeRight.style.transform = '';
      }
      if (curtainOverlay) curtainOverlay.style.opacity = '1';
      if (archEdgeSvg) archEdgeSvg.style.opacity = '1';
      return;
    }

    // Physical easing: smooth and natural, pacing the arch travel all the way to the floor
    const p = 1 - Math.pow(1 - rawProgress, 1.45);

    // Apex travels smoothly from y = 0 to 1.12
    const apexY = p * 1.12;

    // Top opening width expands gracefully
    const topW = Math.min(0.70, p * 0.85);
    const xLeft = Math.max(0.0, 0.5 - topW);
    const xRight = Math.min(1.0, 0.5 + topW);

    // Pure C1-continuous Roman Arch:
    // Tangent at apex (0.5, apexY) is strictly horizontal (smooth bottom)
    // Curves outward gracefully to the top corners
    const cp1Y = apexY * 0.38;
    const cp1X = xLeft + (0.5 - xLeft) * 0.12;
    const cp2Y = apexY;
    const cp2X = 0.5 - (0.5 - xLeft) * 0.35;

    const cp3X = 0.5 + (xRight - 0.5) * 0.35;
    const cp3Y = apexY;
    const cp4X = xRight - (xRight - 0.5) * 0.12;
    const cp4Y = apexY * 0.38;

    const clipD = `M 0 0 L ${xLeft.toFixed(4)} 0 C ${cp1X.toFixed(4)} ${cp1Y.toFixed(4)}, ${cp2X.toFixed(4)} ${cp2Y.toFixed(4)}, 0.5 ${apexY.toFixed(4)} C ${cp3X.toFixed(4)} ${cp3Y.toFixed(4)}, ${cp4X.toFixed(4)} ${cp4Y.toFixed(4)}, ${xRight.toFixed(4)} 0 L 1 0 L 1 1 L 0 1 Z`;
    archClipPath.setAttribute('d', clipD);

    // Hardware-accelerated SVG strokes (viewBox 0 0 1000 2000)
    const sXl = xLeft * 1000;
    const sXr = xRight * 1000;
    const sCp1X = cp1X * 1000;
    const sCp1Y = cp1Y * 2000;
    const sCp2X = cp2X * 1000;
    const sCp2Y = cp2Y * 2000;
    const sApexY = apexY * 2000;
    const sCp3X = cp3X * 1000;
    const sCp3Y = cp3Y * 2000;
    const sCp4X = cp4X * 1000;
    const sCp4Y = cp4Y * 2000;

    const strokeD = `M ${sXl.toFixed(1)} 0 C ${sCp1X.toFixed(1)} ${sCp1Y.toFixed(1)}, ${sCp2X.toFixed(1)} ${sCp2Y.toFixed(1)}, 500 ${sApexY.toFixed(1)} C ${sCp3X.toFixed(1)} ${sCp3Y.toFixed(1)}, ${sCp4X.toFixed(1)} ${sCp4Y.toFixed(1)}, ${sXr.toFixed(1)} 0`;

    if (archShadowAmbient) archShadowAmbient.setAttribute('d', strokeD);
    if (archShadowDirect) archShadowDirect.setAttribute('d', strokeD);
    if (archTrimPath) archTrimPath.setAttribute('d', strokeD);

    // Natural fabric gliding: pleats shift outward as curtains part
    const pleatShift = p * 42;
    if (drapeLeft) drapeLeft.style.backgroundPosition = `-${pleatShift.toFixed(1)}px 0, 0 0`;
    if (drapeRight) drapeRight.style.backgroundPosition = `${pleatShift.toFixed(1)}px 0, 0 0`;

    // As arch sweeps down past 70%, the panels gently gather into the wings
    if (rawProgress > 0.70) {
      const wingP = (rawProgress - 0.70) / 0.30;
      const tx = wingP * 35;
      const sx = 1.0 - wingP * 0.35;
      if (drapeLeft) drapeLeft.style.transform = `translate3d(-${tx.toFixed(1)}%, 0, 0) scaleX(${sx.toFixed(2)})`;
      if (drapeRight) drapeRight.style.transform = `translate3d(${tx.toFixed(1)}%, 0, 0) scaleX(${sx.toFixed(2)})`;
    }

    // In the final phase (rawProgress >= 0.85), gently dissolve remaining side drapes
    if (rawProgress >= 0.85) {
      const fadeProgress = Math.min(1.0, (rawProgress - 0.85) / 0.15);
      const remainingAlpha = (1.0 - fadeProgress).toFixed(3);
      if (curtainOverlay) curtainOverlay.style.opacity = remainingAlpha;
      if (archEdgeSvg) archEdgeSvg.style.opacity = remainingAlpha;
    } else {
      if (curtainOverlay && curtainOverlay.style.opacity !== '1') curtainOverlay.style.opacity = '1';
      if (archEdgeSvg && archEdgeSvg.style.opacity !== '1') archEdgeSvg.style.opacity = '1';
    }

    if (rawProgress >= 1.0) {
      if (curtainOverlay) {
        curtainOverlay.style.opacity = '0';
        curtainOverlay.style.pointerEvents = 'none';
        curtainOverlay.style.visibility = 'hidden';
        curtainOverlay.style.display = 'none';
      }
    }
  }

  // =========================================================================
  // SPRING-LOADED CURTAIN HANGER & PULL-CORD SYSTEM
  // =========================================================================
  function getMidpointThreshold() {
    const screenH = window.innerHeight;
    // Threshold is way past the 50% midpoint: medallion center must travel to 58% of screen height
    const targetY = screenH * 0.58;
    const cordBaseHeight = goldenCord ? goldenCord.offsetHeight || 170 : 170;
    const medallionHeight = tasselMedallion ? tasselMedallion.offsetHeight || 80 : 80;
    const initialMedallionCenterY = cordBaseHeight + medallionHeight / 2;
    // Required drag distance to cross way past the midpoint
    return Math.max(180, Math.round(targetY - initialMedallionCenterY));
  }

  // Soft acoustic spring release/recoil pluck
  function playSpringSound(pitch = 280) {
    if (!audioCtx) initAudio();
    if (!audioCtx || audioCtx.state === 'suspended') return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.45, now + 0.22);

      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }

  let archAnimStart = null;
  let archInitialProgress = 0;
  const ARCH_DURATION = 2100; // ms: continuous, regal wedding cadence

  function animateArchReveal(timestamp) {
    if (!archAnimStart) archAnimStart = timestamp;
    const elapsed = timestamp - archAnimStart;
    const tNorm = Math.min(1.0, elapsed / ARCH_DURATION);

    // Natural regal deceleration from initial progress to 1.0
    const easedT = 1 - Math.pow(1 - tNorm, 1.8);
    const progress = archInitialProgress + (1.0 - archInitialProgress) * easedT;

    updateArchGeometry(progress);

    if (tNorm < 1.0) {
      requestAnimationFrame(animateArchReveal);
    } else {
      updateArchGeometry(1.0);
      curtainOverlay.classList.remove('drawing');
      curtainOverlay.classList.add('curtain-opened');
    }
  }

  function openCurtain(fromProgress = 0) {
    if (state.curtainOpened) return;
    state.curtainOpened = true;

    if (springAnimId) {
      cancelAnimationFrame(springAnimId);
      springAnimId = null;
    }

    initAudio();
    playHarpChime();

    // Keep background music playing seamlessly if not muted by user
    if (!state.userMuted && !state.musicPlaying) {
      startBackgroundMusic();
    }

    // Smoothly reveal stage directly beneath opening drapes
    showScratchStage();

    // Ensure curtain visibility and drawing state
    curtainOverlay.style.display = 'block';
    curtainOverlay.style.opacity = '1';
    curtainOverlay.style.visibility = 'visible';
    curtainOverlay.style.pointerEvents = 'auto';
    if (archEdgeSvg) archEdgeSvg.style.opacity = '1';
    curtainOverlay.classList.add('drawing');

    // Start 60-120fps continuous curved arch reveal from current peek position
    archAnimStart = null;
    archInitialProgress = Math.max(0, Math.min(0.85, fromProgress));
    requestAnimationFrame(animateArchReveal);

    // Emit golden sparkle burst around tassel
    spawnSparkleBurst(window.innerWidth / 2, window.innerHeight * 0.45);
  }

  // Damped harmonic spring physics for auto-closing when threshold is not reached
  let springAnimId = null;
  let currentDampedY = 0;
  let currentArchProgress = 0;

  function springBackToRest(startDispY, startProgress) {
    if (springAnimId) {
      cancelAnimationFrame(springAnimId);
      springAnimId = null;
    }
    if (state.curtainOpened) return;

    if (startDispY <= 2 && startProgress <= 0.01) {
      if (goldenCord) goldenCord.style.transform = 'scaleY(1)';
      if (tasselMedallion) {
        tasselMedallion.style.transform = 'translateY(0)';
        tasselMedallion.classList.remove('tension-ready');
      }
      currentDampedY = 0;
      currentArchProgress = 0;
      updateArchGeometry(0);
      ropeAssembly.classList.remove('dragging');
      return;
    }

    const startTime = performance.now();
    const duration = 520; // ms
    const cordBaseHeight = goldenCord ? goldenCord.offsetHeight || 180 : 180;

    function stepSpring(now) {
      const elapsed = (now - startTime) / 1000; // seconds
      const tNorm = Math.min(1.0, (now - startTime) / duration);

      if (tNorm >= 1.0) {
        if (goldenCord) goldenCord.style.transform = 'scaleY(1)';
        if (tasselMedallion) {
          tasselMedallion.style.transform = 'translateY(0)';
          tasselMedallion.classList.remove('tension-ready');
        }
        ropeAssembly.classList.remove('dragging');
        currentDampedY = 0;
        currentArchProgress = 0;
        updateArchGeometry(0);
        springAnimId = null;
        return;
      }

      // Realistic damped spring oscillation: e^(-decay*t) * cos(freq*t)
      const decay = Math.exp(-8.0 * elapsed);
      const oscillation = Math.cos(17.0 * elapsed);
      const envelope = decay * oscillation;

      const currentY = startDispY * envelope;
      const currentScaleY = Math.max(0.65, (cordBaseHeight + currentY) / cordBaseHeight);

      // Curtain arch smoothly and automatically closes back to 0
      const curtainDecay = Math.max(0, startProgress * (1 - Math.pow(tNorm, 0.75)));

      if (goldenCord) goldenCord.style.transform = `scaleY(${currentScaleY.toFixed(4)})`;
      if (tasselMedallion) tasselMedallion.style.transform = `translateY(${currentY.toFixed(2)}px)`;
      updateArchGeometry(curtainDecay);

      springAnimId = requestAnimationFrame(stepSpring);
    }

    springAnimId = requestAnimationFrame(stepSpring);
  }

  // Touch and Drag handlers for golden tassel cord (Downward pull gesture with spring tension)
  function handleDragStart(clientY) {
    if (state.curtainOpened) return;
    if (springAnimId) {
      cancelAnimationFrame(springAnimId);
      springAnimId = null;
    }
    state.isDragging = true;
    state.dragStartY = clientY;
    state.currentDragY = 0;
    currentDampedY = 0;
    currentArchProgress = 0;
    ropeAssembly.classList.add('dragging');
  }

  function handleDragMove(clientY) {
    if (!state.isDragging || state.curtainOpened) return;
    const deltaY = clientY - state.dragStartY;
    state.currentDragY = deltaY;

    const threshold = getMidpointThreshold();
    const cordBaseHeight = goldenCord ? goldenCord.offsetHeight || 180 : 180;

    // Smooth spring stretch downwards past the screen midpoint
    if (deltaY <= 0) {
      currentDampedY = deltaY * 0.16; // Resists upward push
    } else if (deltaY <= threshold) {
      currentDampedY = deltaY * 0.95;
    } else {
      // Elastic spring resistance past threshold
      currentDampedY = (threshold * 0.95) + (deltaY - threshold) * 0.32;
    }

    // Stretch cord from top anchor & translate medallion
    const currentScaleY = Math.max(0.65, (cordBaseHeight + currentDampedY) / cordBaseHeight);
    if (goldenCord) goldenCord.style.transform = `scaleY(${currentScaleY.toFixed(4)})`;
    tasselMedallion.style.transform = `translateY(${currentDampedY.toFixed(1)}px)`;

    // Calculate pull progress (0.0 to 1.0)
    const pullRatio = Math.min(1.0, Math.max(0, deltaY) / threshold);
    // Curtain opens deeply (up to 58%), displaying the actual background of the couple behind!
    currentArchProgress = pullRatio * 0.58;
    updateArchGeometry(currentArchProgress);

    // Visual feedback when way past midpoint threshold
    if (deltaY >= threshold) {
      tasselMedallion.classList.add('tension-ready');
      // If pulled past threshold by 20%, trigger release immediately for fluid swipe
      if (deltaY >= threshold * 1.20) {
        state.isDragging = false;
        ropeAssembly.classList.remove('dragging');
        openCurtain(currentArchProgress);
      }
    } else {
      tasselMedallion.classList.remove('tension-ready');
    }
  }

  function handleDragEnd() {
    if (!state.isDragging) return;
    state.isDragging = false;
    ropeAssembly.classList.remove('dragging');

    const threshold = getMidpointThreshold();
    const draggedDistance = state.currentDragY;

    if (draggedDistance >= threshold) {
      // Threshold distance reached (way past the midpoint): Open the curtain fully!
      openCurtain(currentArchProgress);
    } else if (currentDampedY > 10 || currentArchProgress > 0.04) {
      // Distance NOT reached (e.g. stopped before or at midpoint):
      // Automatically close the curtain again with spring recoil without resetting hanger animation!
      playSpringSound(260);
      springBackToRest(currentDampedY, currentArchProgress);
    } else {
      // Dragged back to near rest, or tapped without dragging:
      // Return to rest cleanly without artificial bounce or animation reset
      springBackToRest(0, 0);
    }
  }

  // Pointer event listeners on Tassel and Rope Assembly (User has to specifically tag the hanger)
  tasselMedallion.addEventListener('pointerdown', (e) => {
    handleDragStart(e.clientY);
    try {
      tasselMedallion.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  ropeAssembly.addEventListener('pointerdown', (e) => {
    if (e.target !== tasselMedallion && !tasselMedallion.contains(e.target)) {
      handleDragStart(e.clientY);
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (state.isDragging) {
      handleDragMove(e.clientY);
    }
  });

  window.addEventListener('pointerup', () => {
    handleDragEnd();
  });

  window.addEventListener('pointercancel', () => {
    handleDragEnd();
  });

  // Mobile touch event safety to prevent page scroll while pulling the spring cord
  ropeAssembly.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) {
      handleDragStart(e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (state.isDragging && e.touches && e.touches[0]) {
      handleDragMove(e.touches[0].clientY);
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    handleDragEnd();
  }, { passive: true });

  // Keyboard accessibility
  tasselMedallion.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCurtain(0.18);
    }
  });

  // =========================================================================
  // 3B. AUDIO NOTE SYNTHESIZER FOR TIMELINE & REVEALS
  // =========================================================================
  function playNote(freq, dur = 0.22) {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(noteGain);
      noteGain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + dur);
    } catch (_) {}
  }

  // =========================================================================
  // 3C. STAGE 2: TWO SHADOWS HOLDING HANDS (INDIVIDUAL REVEAL ENGINE)
  // =========================================================================
  function showScratchStage() {
    scratchStage.style.display = 'flex';
    requestAnimationFrame(() => {
      scratchStage.classList.add('stage-active', 'curtain-unveiled');
      initCoupleIndividualReveal();
    });
  }

  function initCoupleIndividualReveal() {
    if (groomCardBox && groomCardBox.dataset.bound !== 'true') {
      groomCardBox.dataset.bound = 'true';
      const handleGroom = (e) => {
        if (e) e.stopPropagation();
        revealGroom();
      };
      groomCardBox.addEventListener('click', handleGroom);
      groomCardBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleGroom(e);
        }
      });
    }

    if (brideCardBox && brideCardBox.dataset.bound !== 'true') {
      brideCardBox.dataset.bound = 'true';
      const handleBride = (e) => {
        if (e) e.stopPropagation();
        revealBride();
      };
      brideCardBox.addEventListener('click', handleBride);
      brideCardBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBride(e);
        }
      });
    }

    // Small Next Arrow Button on bottom right corner advances to Timeline
    if (btnNextStage && btnNextStage.dataset.bound !== 'true') {
      btnNextStage.dataset.bound = 'true';
      btnNextStage.addEventListener('click', (e) => {
        e.stopPropagation();
        showTimelineStage();
      });
    }
  }

  function dismissTapAdvice() {
    if (shadowsTapAdvice && !shadowsTapAdvice.classList.contains('dismissed')) {
      shadowsTapAdvice.classList.add('dismissed');
    }
  }

  function revealGroom() {
    dismissTapAdvice();
    if (state.groomRevealed) return;
    state.groomRevealed = true;

    // Remove interval border highlight from groom once disclosed
    const groomHl = document.getElementById('groomHighlight');
    if (groomHl) {
      groomHl.classList.add('highlight-removed');
    }

    if (shadowsFrame) {
      shadowsFrame.classList.add('groom-revealed');
    }
    if (groomCardBox) {
      groomCardBox.classList.add('revealed');
    }

    // Spawn golden sparkle burst on groom's position (left side)
    const anchor = groomCardBox || shadowsFrame;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const posX = rect.left + (rect.width * 0.5);
      const posY = rect.top + (rect.height * 0.45);
      spawnSparkleBurst(posX, posY, 26);
    }

    playNote(587.33, 0.24);
    updateRevealStatus();
  }

  function revealBride() {
    dismissTapAdvice();
    if (state.brideRevealed) return;
    state.brideRevealed = true;

    // Remove interval border highlight from bride once disclosed
    const brideHl = document.getElementById('brideHighlight');
    if (brideHl) {
      brideHl.classList.add('highlight-removed');
    }

    if (shadowsFrame) {
      shadowsFrame.classList.add('bride-revealed');
    }
    if (brideCardBox) {
      brideCardBox.classList.add('revealed');
    }

    // Spawn golden sparkle burst on bride's position (right side)
    const anchor = brideCardBox || shadowsFrame;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const posX = rect.left + (rect.width * 0.5);
      const posY = rect.top + (rect.height * 0.45);
      spawnSparkleBurst(posX, posY, 26);
    }

    playNote(659.25, 0.24);
    updateRevealStatus();
  }

  function updateRevealStatus() {
    const both = state.groomRevealed && state.brideRevealed;
    state.bothRevealed = both;

    if (shadowsTapAdvice && (both || state.groomRevealed || state.brideRevealed)) {
      shadowsTapAdvice.classList.add('dismissed');
    }

    if (revealedNamesBanner) {
      if (both) {
        revealedNamesBanner.classList.remove('state-groom', 'state-bride');
        revealedNamesBanner.classList.add('visible', 'state-both');
      } else if (state.groomRevealed) {
        revealedNamesBanner.classList.remove('state-bride', 'state-both');
        revealedNamesBanner.classList.add('visible', 'state-groom');
      } else if (state.brideRevealed) {
        revealedNamesBanner.classList.remove('state-groom', 'state-both');
        revealedNamesBanner.classList.add('visible', 'state-bride');
      } else {
        revealedNamesBanner.classList.remove('visible', 'state-groom', 'state-bride', 'state-both');
      }
    }

    if (both) {
      if (shadowsFrame) {
        shadowsFrame.classList.add('both-revealed');
        // Spawn celebratory sparkle burst where they hold hands (center)
        const frameRect = shadowsFrame.getBoundingClientRect();
        spawnSparkleBurst(frameRect.left + frameRect.width * 0.5, frameRect.top + frameRect.height * 0.55, 36);
      }

      playHarpChime();

      // Shower bouquet / rose petals when both the groom and bride are fully disclosed
      triggerPetalShower(85);

      // Display small next arrow button on the bottom right corner (no auto-advance)
      if (btnNextStage) {
        btnNextStage.style.display = 'flex';
        requestAnimationFrame(() => btnNextStage.classList.add('visible'));
      }
    } else {
      if (shadowsFrame) {
        shadowsFrame.classList.remove('both-revealed');
      }
      if (btnNextStage) {
        btnNextStage.classList.remove('visible');
        btnNextStage.style.display = 'none';
      }
    }
  }

  // =========================================================================
  // 3D. STAGE 3: CEREMONIAL TIMELINE & IMPORTANT DATES ENGINE
  // =========================================================================
  function showTimelineStage() {
    if (state.timelineShown) return;
    state.timelineShown = true;

    scratchStage.classList.add('stage-exit');

    setTimeout(() => {
      scratchStage.style.display = 'none';
      scratchStage.classList.add('stage-hidden');
      scratchStage.classList.remove('stage-active', 'stage-exit');

      document.body.classList.add('timeline-active');
      timelineStage.style.display = 'flex';
      requestAnimationFrame(() => {
        timelineStage.classList.add('stage-active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        runTimelineSequence();
      });
    }, 350);
  }

  function runTimelineSequence() {
    const items = timelineList.querySelectorAll('.timeline-item');
    const delayStep = 550;
    const initialDelay = 200;

    items.forEach((item, index) => {
      setTimeout(() => {
        item.classList.add('revealed');
        const icon = item.querySelector('.timeline-item-icon') || item;
        const iconRect = icon.getBoundingClientRect();
        spawnSparkleBurst(iconRect.left + iconRect.width / 2, iconRect.top + iconRect.height / 2, 14);
        playNote(523.25 + index * 98, 0.22);
      }, initialDelay + index * delayStep);
    });

    const totalTime = initialDelay + items.length * delayStep + 350;
    setTimeout(() => {
      timelineActionArea.classList.add('revealed');
      playHarpChime();
    }, totalTime);
  }

  function showRealInvitation() {
    if (state.invitationShown) return;
    state.invitationShown = true;

    document.body.classList.remove('timeline-active');
    document.body.classList.add('invitation-active');
    timelineStage.classList.add('stage-exit');

    setTimeout(() => {
      timelineStage.style.display = 'none';
      timelineStage.classList.remove('stage-active', 'stage-exit');

      invitationStage.style.display = 'flex';
      requestAnimationFrame(() => {
        invitationStage.classList.add('stage-active');
        invitationStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // The user must tap the wax seal / envelope to open the invitation card
      });
    }, 500);
  }

  btnProceedToCard.addEventListener('click', showRealInvitation);

  // =========================================================================
  // 4. WAX SEAL & ENVELOPE OPENING MECHANICS (2-STEP INTERACTION)
  // Step 1: Click Envelope -> Smoothly opens lid (0.85s) & pops card up partially
  // Step 2: Click Partially Popped Card -> Elevates card into full screen
  // =========================================================================
  state.isOpeningEnvelope = false;

  function openEnvelope() {
    if (state.envelopeOpened || state.isOpeningEnvelope) return;
    state.envelopeOpened = true;
    state.isOpeningEnvelope = true;

    try {
      initAudio();
      playWaxPop();
    } catch(err) {
      console.warn('audio error:', err);
    }

    try {
      // Visual burst at wax seal location
      const sealRect = waxSeal.getBoundingClientRect();
      spawnSparkleBurst(sealRect.left + sealRect.width / 2, sealRect.top + sealRect.height / 2, 22);
    } catch(err) {
      console.warn('sparkle error:', err);
    }

    // Step 1: Smooth fluid 3D lid opening (0.85s)
    envelope.classList.add('open');

    // Step 2: Card glides up gracefully once flap has cleared the pocket opening
    setTimeout(() => {
      weddingCard.classList.add('peeking');
      try { playNote(659.25, 0.28); } catch(e) {}

      // Allow card click elevation once peeking motion settles
      setTimeout(() => {
        state.isOpeningEnvelope = false;
      }, 500);
    }, 700);
  }

  function elevateCard() {
    if (!state.envelopeOpened || state.cardElevated || state.isOpeningEnvelope) return;
    state.cardElevated = true;

    try {
      initAudio();
      playHarpChime();
    } catch(e) {}

    try {
      const cardRect = weddingCard.getBoundingClientRect();
      spawnSparkleBurst(cardRect.left + cardRect.width / 2, cardRect.top + cardRect.height / 3, 26);
    } catch(e) {}

    // Ensure screen is pinned to top-left
    window.scrollTo(0, 0);

    // Elevate card into full-screen view
    weddingCard.classList.remove('peeking');
    weddingCard.classList.add('elevated');
    envelope.classList.add('card-elevated');
    envelopeWrapper.classList.add('card-elevated');
    weddingCard.style.transform = 'none';

    // Smooth card sweep specular shimmer reflection
    setTimeout(() => {
      cardShimmer.style.transition = 'transform 1.4s ease-out';
      cardShimmer.style.transform = 'translateX(180%) rotate(25deg)';
    }, 600);
  }

  waxSeal.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.envelopeOpened && !state.isOpeningEnvelope) {
      openEnvelope();
    }
  });

  envelope.addEventListener('click', (e) => {
    if (state.isOpeningEnvelope) return;
    if (!state.envelopeOpened) {
      openEnvelope();
    } else if (!state.cardElevated) {
      elevateCard();
    }
  });

  weddingCard.addEventListener('click', (e) => {
    if (state.isOpeningEnvelope) return;
    if (state.envelopeOpened && !state.cardElevated) {
      e.stopPropagation();
      elevateCard();
    } else if (state.cardElevated) {
      spawnSparkleBurst(e.clientX, e.clientY, 14);
      cardShimmer.style.transition = 'none';
      cardShimmer.style.transform = 'translateX(-150%) rotate(25deg)';
      setTimeout(() => {
        cardShimmer.style.transition = 'transform 1.2s ease-out';
        cardShimmer.style.transform = 'translateX(180%) rotate(25deg)';
      }, 50);
    }
  });

  waxSeal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!state.envelopeOpened) {
        openEnvelope();
      }
    }
  });

  weddingCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (state.envelopeOpened && !state.cardElevated) {
        e.preventDefault();
        elevateCard();
      }
    }
  });

  // =========================================================================
  // 5. 3D PARALLAX TILT ENGINE (Card Tilt & Dynamic Lighting)
  // =========================================================================
  let isMouseOverCard = false;

  function updateTilt() {
    if (weddingCard.classList.contains('elevated')) {
      weddingCard.style.transform = 'none';
      if (isMouseOverCard) {
        state.tilt.x += (state.tilt.targetX - state.tilt.x) * 0.08;
        const shimmerX = (state.tilt.x + 1) * 50;
        cardShimmer.style.transition = 'none';
        cardShimmer.style.transform = `translateX(${shimmerX - 80}%) rotate(25deg)`;
      }
      requestAnimationFrame(updateTilt);
      return;
    }

    requestAnimationFrame(updateTilt);
  }
  requestAnimationFrame(updateTilt);

  weddingCard.addEventListener('pointerenter', () => {
    isMouseOverCard = true;
  });

  weddingCard.addEventListener('pointermove', (e) => {
    if (!state.envelopeOpened) return;
    const rect = weddingCard.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    state.tilt.targetX = Math.max(-1, Math.min(1, x));
    state.tilt.targetY = Math.max(-1, Math.min(1, y));
  });

  weddingCard.addEventListener('pointerleave', () => {
    isMouseOverCard = false;
    state.tilt.targetX = 0;
    state.tilt.targetY = 0;
  });

  // Mobile Gyroscope DeviceOrientation support
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', (e) => {
      if (!state.envelopeOpened || isMouseOverCard) return;
      if (e.gamma !== null && e.beta !== null) {
        state.tilt.targetX = Math.max(-1, Math.min(1, e.gamma / 25));
        state.tilt.targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
      }
    });
  }

  // =========================================================================
  // 6. AMBIENT ROSE PETAL & GOLD BOKEH CANVAS ENGINE
  // =========================================================================
  const ctx = ambientCanvas.getContext('2d');
  let width = (ambientCanvas.width = window.innerWidth);
  let height = (ambientCanvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = ambientCanvas.width = window.innerWidth;
    height = ambientCanvas.height = window.innerHeight;
  });

  const celebrationPetals = [];
  const sparkleParticles = [];

  class CelebrationPetal {
    constructor(x, y) {
      this.x = x !== undefined ? x : Math.random() * width;
      this.y = y !== undefined ? y : -20 - Math.random() * 80;
      this.size = Math.random() * 16 + 10;
      this.speedY = Math.random() * 1.8 + 1.2;
      this.speedX = (Math.random() - 0.5) * 1.4;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.035;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = Math.random() * 0.035 + 0.015;
      this.opacity = Math.random() * 0.35 + 0.65;
      // Romantic bouquet palette: blush pink, deep rose, ivory, peach, white
      const colors = ['#f8b4c8', '#f596b3', '#f7cad8', '#f06292', '#fce4ec', '#fff0f5', '#ffcdd2', '#ffffff'];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.isBouquetFlower = Math.random() < 0.28; // ~28% are full delicate bouquet florets
    }

    update() {
      this.wobble += this.wobbleSpeed;
      this.x += this.speedX + Math.sin(this.wobble) * 1.1;
      this.y += this.speedY;
      this.rotation += this.rotSpeed;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(Math.cos(this.wobble), 1);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity;

      if (this.isBouquetFlower) {
        // Delicate 5-petal flower blossom
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.rotate((Math.PI * 2) / 5);
          ctx.ellipse(0, this.size * 0.35, this.size * 0.25, this.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Warm golden flower center
        ctx.fillStyle = '#ffecb3';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.16, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Natural curved rose petal
        ctx.beginPath();
        ctx.moveTo(0, -this.size / 2);
        ctx.bezierCurveTo(this.size / 2, -this.size / 2, this.size / 1.5, this.size / 2, 0, this.size);
        ctx.bezierCurveTo(-this.size / 1.5, this.size / 2, -this.size / 2, -this.size / 2, 0, -this.size / 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Shower a bouquet / cascade of petals when both groom & bride are fully disclosed
  function triggerPetalShower(count = 85) {
    for (let i = 0; i < count; i++) {
      // Stagger vertical start positions so they shower gracefully over 5-7 seconds
      const startY = -30 - Math.random() * (height * 1.1);
      const startX = Math.random() * width;
      celebrationPetals.push(new CelebrationPetal(startX, startY));
    }
  }

  // Golden burst particles on interactions
  function spawnSparkleBurst(originX, originY, count = 28) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 5 + 2.5;
      sparkleParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        radius: Math.random() * 3.5 + 2,
        color: Math.random() > 0.4 ? '#f5df88' : '#e5c365',
        life: 1.0,
        decay: Math.random() * 0.02 + 0.015
      });
    }
  }

  // Animation Loop (No continuous background petals; only renders on celebratory trigger)
  function renderAmbient() {
    ctx.clearRect(0, 0, width, height);

    // Draw active bouquet petals & blossoms
    for (let i = celebrationPetals.length - 1; i >= 0; i--) {
      const petal = celebrationPetals[i];
      petal.update();
      petal.draw(ctx);
      if (petal.y > height + 60) {
        celebrationPetals.splice(i, 1);
      }
    }

    // Draw sparkle bursts
    for (let i = sparkleParticles.length - 1; i >= 0; i--) {
      const p = sparkleParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // Gravity
      p.vx *= 0.98;
      p.life -= p.decay;

      if (p.life <= 0) {
        sparkleParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = '#ffe28a';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(renderAmbient);
  }
  requestAnimationFrame(renderAmbient);

  // =========================================================================
  // 7. COUNTDOWN TIMER TO DEC 14, 2026 11:00 AM
  // =========================================================================
  function updateCountdown() {
    const now = new Date().getTime();
    const distance = TARGET_DATE.getTime() - now;

    if (distance <= 0) {
      if (tlDays) {
        tlDays.textContent = '00';
        tlHours.textContent = '00';
        tlMins.textContent = '00';
        tlSecs.textContent = '00';
      }
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((distance % (1000 * 60)) / 1000);

    const dStr = String(days).padStart(2, '0');
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(mins).padStart(2, '0');
    const sStr = String(secs).padStart(2, '0');

    if (tlDays) {
      tlDays.textContent = dStr;
      tlHours.textContent = hStr;
      tlMins.textContent = mStr;
      tlSecs.textContent = sStr;
    }
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();

})();
