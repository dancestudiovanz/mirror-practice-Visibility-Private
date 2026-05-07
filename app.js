const STORAGE_KEY = "mirror-practice-state-v4";
const LEGACY_KEYS = ["mirror-practice-state-v3", "mirror-practice-state-v2"];

const videoPlayer = document.querySelector("#videoPlayer");
const youtubeContainer = document.querySelector("#youtubePlayer");
const youtubeFrameHost = document.querySelector("#youtubeFrameHost");
const youtubeFallback = document.querySelector("#youtubeFallback");
const youtubeFallbackLink = document.querySelector("#youtubeFallbackLink");
const emptyState = document.querySelector("#emptyState");
const dropZone = document.querySelector("#dropZone");
const sourceSheet = document.querySelector("#sourceSheet");
const sourceToggle = document.querySelector("#sourceToggle");
const urlForm = document.querySelector("#urlForm");
const videoUrl = document.querySelector("#videoUrl");
const fileInput = document.querySelector("#fileInput");
const fileName = document.querySelector("#fileName");
const lastSource = document.querySelector("#lastSource");
const lastUrlButton = document.querySelector("#lastUrlButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const mirrorToggle = document.querySelector("#mirrorToggle");
const modeLabel = document.querySelector("#modeLabel");
const speedButtons = [...document.querySelectorAll(".speed-button")];
const speedLabel = document.querySelector("#speedLabel");
const statusText = document.querySelector("#status");
const playPause = document.querySelector("#playPause");
const back5 = document.querySelector("#back5");
const forward5 = document.querySelector("#forward5");
const restart = document.querySelector("#restart");
const focusToggle = document.querySelector("#focusToggle");
const progress = document.querySelector("#progress");
const timeLabel = document.querySelector("#timeLabel");
const loopStart = document.querySelector("#loopStart");
const loopEnd = document.querySelector("#loopEnd");
const loopToggle = document.querySelector("#loopToggle");
const loopJump = document.querySelector("#loopJump");
const loopClear = document.querySelector("#loopClear");
const loopLabel = document.querySelector("#loopLabel");

let currentMode = "video";
let currentSpeed = 1;
let youtubePlayer = null;
let objectUrl = null;
let progressTimer = null;
let overlayTimer = null;
let state = loadState();
let currentYoutubeUrl = "";
let currentMediaAspect = 16 / 9;
let focusPicking = false;
let focusActive = false;
let sceneTimer = null;
let previousFrameSignature = null;
let frameSamplingAvailable = true;
let loopA = null;
let loopB = null;
let loopEnabled = false;

function readStoredState(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function loadState() {
  return readStoredState(STORAGE_KEY) || LEGACY_KEYS.map(readStoredState).find(Boolean) || {};
}

function saveState(nextState = {}) {
  state = { ...state, ...nextState };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderSavedSource();
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  state = {};
  videoUrl.value = "";
  fileInput.value = "";
  fileName.textContent = "未選択";
  lastSource.textContent = "";
  lastUrlButton.hidden = true;
  mirrorToggle.checked = true;
  applySpeed(1);
  updateMirror();
  setStatus("保存された履歴を削除しました。");
}

function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.classList.toggle("is-error", type === "error");
}

function setYoutubeFallback(isVisible) {
  youtubeFallback.hidden = !isVisible;
  youtubeFallback.classList.toggle("is-visible", isVisible);
  youtubeFallbackLink.href = currentYoutubeUrl || "#";
}

function setMediaAspect(width, height) {
  if (!width || !height) return;
  currentMediaAspect = width / height;
  document.body.classList.toggle("is-portrait-media", currentMediaAspect < 1);
  resizeYoutubeFrame();
}

function setFocusPicking(isPicking) {
  focusPicking = isPicking;
  dropZone.classList.toggle("is-focus-picking", isPicking);
  focusToggle.classList.toggle("is-active", isPicking || focusActive);
  focusToggle.setAttribute("aria-label", isPicking ? "フォーカス位置を選択中" : "フォーカス");
  showOverlay(true);
}

function applyFocusAt(clientX, clientY) {
  const rect = dropZone.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const visualX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const visualY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
  const originX = mirrorToggle.checked ? 100 - visualX : visualX;

  [videoPlayer, youtubeContainer].forEach((element) => {
    element.style.setProperty("--focus-x", `${originX}%`);
    element.style.setProperty("--focus-y", `${visualY}%`);
    element.style.setProperty("--focus-scale", "1.85");
  });

  focusActive = true;
  setFocusPicking(false);
}

function resetFocus() {
  focusActive = false;
  focusPicking = false;
  previousFrameSignature = null;
  dropZone.classList.remove("is-focus-picking");
  focusToggle.classList.remove("is-active");
  [videoPlayer, youtubeContainer].forEach((element) => {
    element.style.setProperty("--focus-x", "50%");
    element.style.setProperty("--focus-y", "50%");
    element.style.setProperty("--focus-scale", "1");
  });
}

function sampleVideoFrame() {
  if (!focusActive || currentMode !== "video" || videoPlayer.paused || !frameSamplingAvailable) {
    return;
  }

  try {
    const canvas = sampleVideoFrame.canvas || document.createElement("canvas");
    sampleVideoFrame.canvas = canvas;
    canvas.width = 24;
    canvas.height = 14;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0;
    let g = 0;
    let b = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      r += pixels[index];
      g += pixels[index + 1];
      b += pixels[index + 2];
    }

    const count = pixels.length / 4;
    const signature = {
      r: r / count,
      g: g / count,
      b: b / count,
    };
    const luminance = signature.r * 0.2126 + signature.g * 0.7152 + signature.b * 0.0722;

    if (previousFrameSignature) {
      const diff =
        Math.abs(signature.r - previousFrameSignature.r) +
        Math.abs(signature.g - previousFrameSignature.g) +
        Math.abs(signature.b - previousFrameSignature.b);
      if (luminance < 12 || diff > 88) {
        resetFocus();
      }
    }

    previousFrameSignature = signature;
  } catch {
    frameSamplingAvailable = false;
  }
}

function startSceneDetection() {
  if (sceneTimer) clearInterval(sceneTimer);
  previousFrameSignature = null;
  frameSamplingAvailable = true;
  sceneTimer = setInterval(sampleVideoFrame, 420);
}

function renderSavedSource() {
  if (state.lastUrl) {
    lastUrlButton.hidden = false;
    lastSource.textContent = `前回URL: ${state.lastUrl}`;
  } else if (state.lastFileName) {
    lastUrlButton.hidden = true;
    lastSource.textContent = `前回ファイル: ${state.lastFileName}。ファイル本体は再選択が必要です。`;
  } else {
    lastUrlButton.hidden = true;
    lastSource.textContent = "";
  }

  fileName.textContent = state.lastFileName || "未選択";
}

function setHasMedia(hasMedia) {
  document.body.classList.toggle("is-practicing", hasMedia);
  dropZone.classList.toggle("has-media", hasMedia);
  sourceSheet.classList.toggle("is-open", !hasMedia);
  sourceToggle.textContent = hasMedia ? "読み込み" : "閉じる";
}

function isPlaying() {
  return currentMode === "video" && !videoPlayer.paused;
}

function showOverlay(keepOpen = false) {
  dropZone.classList.add("is-overlay-visible");
  if (overlayTimer) clearTimeout(overlayTimer);

  if (!keepOpen && isPlaying()) {
    overlayTimer = setTimeout(() => {
      dropZone.classList.remove("is-overlay-visible");
    }, 2200);
  }
}

function hideOverlaySoon() {
  if (overlayTimer) clearTimeout(overlayTimer);
  if (isPlaying()) {
    overlayTimer = setTimeout(() => {
      dropZone.classList.remove("is-overlay-visible");
    }, 900);
  }
}

async function enterPracticeFullscreen() {
  document.body.classList.add("is-fullscreen-emulated");

  if (document.fullscreenElement || !dropZone.requestFullscreen) {
    showOverlay();
    return;
  }

  try {
    await dropZone.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // Some mobile browsers reject fullscreen for embedded players. The emulated mode above still removes page scroll.
  }

  showOverlay();
}

function syncFullscreenState() {
  const wasNativeFullscreen = document.body.classList.contains("is-native-fullscreen");
  const isNativeFullscreen = document.fullscreenElement === dropZone;
  document.body.classList.toggle("is-native-fullscreen", isNativeFullscreen);
  if (wasNativeFullscreen && !isNativeFullscreen) {
    document.body.classList.remove("is-fullscreen-emulated");
  }
  resizeYoutubeFrame();
}

function normalizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.|m\.|music\.)?youtube\.com|^youtu\.be/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function parseAllowedUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return { error: "動画URLを入力してください。" };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return { error: "URLの形式が正しくありません。https:// から始まる動画URLを入力してください。" };
  }

  if (parsedUrl.protocol !== "https:") {
    return { error: "安全のため、URL入力では https:// の動画URLのみ利用できます。" };
  }

  return { url: parsedUrl.href };
}

function getYoutubeId(rawUrl) {
  try {
    let url = new URL(normalizeUrl(rawUrl));
    let host = url.hostname.replace(/^www\./, "");

    if (host === "music.youtube.com") host = "youtube.com";
    if (host === "m.youtube.com") host = "youtube.com";

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (!host.endsWith("youtube.com")) return null;

    if (url.pathname === "/attribution_link" && url.searchParams.get("u")) {
      url = new URL(url.searchParams.get("u"), "https://www.youtube.com");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "embed", "live", "v"].includes(parts[0])) {
      return parts[1] || null;
    }

    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

function getYoutubeWatchUrl(id) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

function isYoutubeShortUrl(rawUrl) {
  try {
    const url = new URL(normalizeUrl(rawUrl));
    return url.pathname.split("/").filter(Boolean)[0] === "shorts";
  } catch {
    return false;
  }
}

function updateMirror() {
  const shouldMirror = mirrorToggle.checked;
  videoPlayer.classList.toggle("is-mirrored", shouldMirror);
  youtubeContainer.classList.toggle("is-mirrored", shouldMirror);
  modeLabel.textContent = `${shouldMirror ? "Mirror on" : "Mirror off"} / Fit`;
  saveState({ mirrored: shouldMirror });
}

function activateMode(mode) {
  currentMode = mode;
  videoPlayer.classList.toggle("is-active", mode === "video");
  youtubeContainer.classList.toggle("is-active", mode === "youtube");
  if (mode !== "youtube") setYoutubeFallback(false);
  emptyState.classList.add("is-hidden");
  setHasMedia(true);
}

function applySpeed(speed) {
  currentSpeed = speed;
  speedLabel.textContent = `${speed.toFixed(2)}x`;
  speedButtons.forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.speed) === speed);
  });

  videoPlayer.playbackRate = speed;
  if (youtubePlayer?.setPlaybackRate) {
    youtubePlayer.setPlaybackRate(speed);
  }
  saveState({ speed });
  showOverlay();
}

function cleanupObjectUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function resizeYoutubeFrame() {
  const frame = document.querySelector("#youtubeFrameHost");
  if (!frame) return;

  const box = youtubeContainer.getBoundingClientRect();
  if (!box.width || !box.height) return;

  const containerAspect = box.width / box.height;
  const shouldCover = currentMediaAspect < 1 && window.matchMedia("(orientation: portrait)").matches;

  if (!shouldCover) {
    frame.style.width = "100%";
    frame.style.height = "100%";
    return;
  }

  if (containerAspect > currentMediaAspect) {
    frame.style.width = "100%";
    frame.style.height = `${(containerAspect / currentMediaAspect) * 100}%`;
  } else {
    frame.style.width = `${(currentMediaAspect / containerAspect) * 100}%`;
    frame.style.height = "100%";
  }
}

function loadDirectVideo(src, label, rememberedUrl = "") {
  resetFocus();
  resetLoop();
  if (youtubePlayer?.stopVideo) {
    youtubePlayer.stopVideo();
  }

  activateMode("video");
  videoPlayer.src = src;
  videoPlayer.load();
  videoPlayer.playbackRate = currentSpeed;
  saveState({ lastUrl: rememberedUrl, lastFileName: rememberedUrl ? state.lastFileName : label });
  setStatus(`${label}を読み込みました。`);
  showOverlay(true);
}

function loadFromUrl(rawUrl) {
  const result = parseAllowedUrl(rawUrl);
  if (result.error) {
    setStatus(result.error, "error");
    sourceSheet.classList.add("is-open");
    return;
  }
  const url = result.url;

  const youtubeId = getYoutubeId(url);
  if (youtubeId) {
    loadYoutubeWithoutApi(youtubeId, url);
    return;
  }

  cleanupObjectUrl();
  loadDirectVideo(url, "動画URL", url);
}

function loadFile(file) {
  if (!file) return;
  cleanupObjectUrl();
  objectUrl = URL.createObjectURL(file);
  saveState({ lastFileName: file.name, lastUrl: "" });
  fileName.textContent = file.name;
  loadDirectVideo(objectUrl, file.name);
}

async function loadYoutubeWithoutApi(id, rawUrl) {
  resetFocus();
  resetLoop();
  cleanupObjectUrl();
  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.load();
  activateMode("youtube");
  currentYoutubeUrl = getYoutubeWatchUrl(id);
  setMediaAspect(isYoutubeShortUrl(rawUrl) ? 9 : 16, isYoutubeShortUrl(rawUrl) ? 16 : 9);
  setYoutubeFallback(false);
  saveState({ lastUrl: normalizeUrl(rawUrl) });

  youtubeFrameHost.replaceChildren();
  const iframe = document.createElement("iframe");
  iframe.title = "YouTube video player";
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0&modestbranding=1`;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  youtubeFrameHost.append(iframe);
  youtubePlayer = null;

  resizeYoutubeFrame();
  startProgressTimer();
  setStatus("YouTube動画を読み込みました。APIなし設定のため、再生や速度はYouTubeプレイヤー側で操作してください。");
  showOverlay(true);
}

function getDuration() {
  if (currentMode === "youtube" && youtubePlayer?.getDuration) {
    return youtubePlayer.getDuration() || 0;
  }

  return videoPlayer.duration || 0;
}

function getCurrentTime() {
  if (currentMode === "youtube" && youtubePlayer?.getCurrentTime) {
    return youtubePlayer.getCurrentTime() || 0;
  }

  return videoPlayer.currentTime || 0;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function updateLoopLabel() {
  loopLabel.textContent = `A ${loopA === null ? "--" : formatTime(loopA)} / B ${
    loopB === null ? "--" : formatTime(loopB)
  }`;
  loopToggle.classList.toggle("is-active", loopEnabled);
  loopStart.classList.toggle("is-set", loopA !== null);
  loopEnd.classList.toggle("is-set", loopB !== null);
  loopToggle.textContent = loopEnabled ? "On" : "Loop";
}

function resetLoop() {
  loopA = null;
  loopB = null;
  loopEnabled = false;
  updateLoopLabel();
}

function clearLoop() {
  resetLoop();
  setStatus("区間ループをクリアしました。");
  showOverlay(true);
}

function jumpToLoopStart() {
  if (currentMode !== "video") {
    setStatus("区間ループは動画ファイルまたはmp4/webm直リンクで利用できます。", "error");
    showOverlay(true);
    return;
  }

  if (loopA === null) {
    setStatus("A地点を先に設定してください。", "error");
    showOverlay(true);
    return;
  }

  videoPlayer.currentTime = loopA;
  showOverlay(true);
}

function setLoopPoint(point) {
  if (currentMode !== "video") {
    setStatus("区間ループは動画ファイルまたはmp4/webm直リンクで利用できます。", "error");
    showOverlay(true);
    return;
  }

  const current = getCurrentTime();
  if (point === "a") {
    loopA = current;
    if (loopB !== null && loopB <= loopA) {
      loopB = null;
      loopEnabled = false;
    }
  } else {
    loopB = current;
    if (loopA !== null && loopB <= loopA) {
      setStatus("B地点はA地点より後に設定してください。", "error");
      loopB = null;
      loopEnabled = false;
    }
  }

  updateLoopLabel();
  setStatus(`${point === "a" ? "A" : "B"}地点を設定しました。`);
  showOverlay(true);
}

function toggleLoop() {
  if (currentMode !== "video") {
    setStatus("YouTube動画はAPIなし設定のため、区間ループは利用できません。", "error");
    showOverlay(true);
    return;
  }

  if (loopA === null || loopB === null || loopB <= loopA) {
    setStatus("A地点とB地点を先に設定してください。", "error");
    showOverlay(true);
    return;
  }

  loopEnabled = !loopEnabled;
  if (loopEnabled && (videoPlayer.currentTime < loopA || videoPlayer.currentTime > loopB)) {
    videoPlayer.currentTime = loopA;
  }
  updateLoopLabel();
  setStatus(loopEnabled ? "区間ループを開始しました。" : "区間ループを停止しました。");
  showOverlay(true);
}

function updateProgress() {
  const duration = getDuration();
  const current = getCurrentTime();
  if (loopEnabled && loopA !== null && loopB !== null && current >= loopB) {
    videoPlayer.currentTime = loopA;
    return;
  }
  progress.value = duration > 0 ? String(Math.round((current / duration) * 1000)) : "0";
  timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

function startProgressTimer() {
  if (progressTimer) clearInterval(progressTimer);
  updateProgress();
  progressTimer = setInterval(updateProgress, 300);
}

function seekBy(seconds) {
  resetFocus();
  if (currentMode === "youtube" && youtubePlayer?.getCurrentTime) {
    youtubePlayer.seekTo(Math.max(0, youtubePlayer.getCurrentTime() + seconds), true);
  } else {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime + seconds);
  }
  showOverlay();
}

function restartVideo() {
  resetFocus();
  if (currentMode === "youtube" && youtubePlayer?.seekTo) {
    youtubePlayer.seekTo(0, true);
  } else {
    videoPlayer.currentTime = 0;
  }
  showOverlay();
}

function seekToProgress(value) {
  const duration = getDuration();
  if (!duration) return;
  resetFocus();
  const nextTime = (Number(value) / 1000) * duration;

  if (currentMode === "youtube" && youtubePlayer?.seekTo) {
    youtubePlayer.seekTo(nextTime, true);
  } else {
    videoPlayer.currentTime = nextTime;
  }
  showOverlay();
}

async function togglePlay() {
  if (currentMode === "youtube" && !youtubePlayer) {
    await enterPracticeFullscreen();
    setStatus("YouTube動画はAPIなし設定のため、再生や一時停止はYouTubeプレイヤー側で操作してください。");
    showOverlay(true);
    return;
  }

  if (!videoPlayer.src) {
    setStatus("先に動画を読み込んでください。", "error");
    sourceSheet.classList.add("is-open");
    return;
  }

  if (videoPlayer.paused) {
    await enterPracticeFullscreen();
    try {
      await videoPlayer.play();
    } catch {
      showOverlay(true);
    }
    hideOverlaySoon();
  } else {
    videoPlayer.pause();
    showOverlay(true);
  }
}

function updatePlayLabel() {
  const playing = isPlaying();
  playPause.textContent = playing ? "Ⅱ" : "▶";
  playPause.setAttribute("aria-label", playing ? "一時停止" : "再生");
}

sourceToggle.addEventListener("click", () => {
  sourceSheet.classList.toggle("is-open");
  sourceToggle.textContent = sourceSheet.classList.contains("is-open") ? "閉じる" : "読み込み";
});

urlForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadFromUrl(videoUrl.value);
});

lastUrlButton.addEventListener("click", () => {
  if (!state.lastUrl) return;
  videoUrl.value = state.lastUrl;
  loadFromUrl(state.lastUrl);
});

clearHistoryButton.addEventListener("click", clearHistory);

fileInput.addEventListener("change", () => {
  loadFile(fileInput.files?.[0]);
});

dropZone.addEventListener("click", (event) => {
  if (event.target.closest("button, input, label")) return;
  if (focusPicking) {
    applyFocusAt(event.clientX, event.clientY);
    return;
  }
  showOverlay();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    togglePlay();
  }
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  loadFile(event.dataTransfer.files?.[0]);
});

mirrorToggle.addEventListener("change", updateMirror);
playPause.addEventListener("click", togglePlay);
back5.addEventListener("click", () => seekBy(-5));
forward5.addEventListener("click", () => seekBy(5));
restart.addEventListener("click", restartVideo);
loopStart.addEventListener("click", () => setLoopPoint("a"));
loopEnd.addEventListener("click", () => setLoopPoint("b"));
loopToggle.addEventListener("click", toggleLoop);
loopJump.addEventListener("click", jumpToLoopStart);
loopClear.addEventListener("click", clearLoop);
focusToggle.addEventListener("click", () => {
  if (focusActive && !focusPicking) {
    resetFocus();
    showOverlay(true);
    return;
  }
  setFocusPicking(!focusPicking);
});
progress.addEventListener("input", () => seekToProgress(progress.value));
videoPlayer.addEventListener("play", () => {
  updatePlayLabel();
  startSceneDetection();
});
videoPlayer.addEventListener("pause", updatePlayLabel);
videoPlayer.addEventListener("timeupdate", updateProgress);
window.addEventListener("resize", resizeYoutubeFrame);
document.addEventListener("fullscreenchange", syncFullscreenState);

speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applySpeed(Number(button.dataset.speed));
  });
});

videoPlayer.addEventListener("loadedmetadata", () => {
  setMediaAspect(videoPlayer.videoWidth, videoPlayer.videoHeight);
  videoPlayer.playbackRate = currentSpeed;
  startProgressTimer();
  setStatus("動画を読み込みました。");
});

videoPlayer.addEventListener("error", () => {
  setStatus("このURLはブラウザで直接再生できません。mp4/webmの直リンクか、動画ファイルを試してください。", "error");
});

if (state.lastUrl) {
  videoUrl.value = state.lastUrl;
}

mirrorToggle.checked = state.mirrored ?? true;
renderSavedSource();
updateMirror();
applySpeed(Number(state.speed) || 1);
updateLoopLabel();
setHasMedia(false);
setStatus("準備できました。動画URLかファイルを読み込んでください。");

if (state.lastUrl) {
  window.setTimeout(() => loadFromUrl(state.lastUrl), 200);
}
