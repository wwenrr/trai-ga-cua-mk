import {
  STORAGE_KEY,
  MAX_UPGRADE_LEVEL,
  WEATHER_ROTATE_MS,
  INCUBATOR_COST,
  INCUBATOR_DURATION_MS,
  INCUBATOR_COIN_REWARD,
  WEATHER_CONFIG,
  QUEST_METRICS,
  DEFAULT_STATE,
  FACTS,
  ACHIEVEMENTS
} from './config.js';
import { getRefs } from './dom.js';

(() => {
  const refs = getRefs();

  let toastTimer;
  let autoEggTimer;
  let weatherCycleTimer;
  let incubatorTickTimer;
  let audioCtx;
  const state = loadState();

  function toSafeNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return 0;
    }
    return Math.floor(n);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getTodayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dayDiff(fromKey, toKey) {
    const from = toLocalDate(fromKey);
    const to = toLocalDate(toKey);
    const ms = to.getTime() - from.getTime();
    return Math.round(ms / 86400000);
  }

  function toLocalDate(key) {
    const [y, m, d] = key.split('-').map((part) => Number(part));
    return new Date(y, m - 1, d);
  }

  function pickWeather(rawWeather) {
    return Object.prototype.hasOwnProperty.call(WEATHER_CONFIG, rawWeather) ? rawWeather : 'sunny';
  }

  function pickMetric(rawMetric) {
    return Object.prototype.hasOwnProperty.call(QUEST_METRICS, rawMetric) ? rawMetric : 'cluckCount';
  }

  function normalizeQuest(rawQuest) {
    if (!rawQuest || typeof rawQuest !== 'object') {
      return null;
    }

    const metric = pickMetric(rawQuest.metric);
    const startCounts = rawQuest.startCounts && typeof rawQuest.startCounts === 'object' ? rawQuest.startCounts : {};

    return {
      date: typeof rawQuest.date === 'string' ? rawQuest.date : getTodayKey(),
      metric,
      target: clamp(toSafeNumber(rawQuest.target), QUEST_METRICS[metric].min, 200),
      reward: clamp(toSafeNumber(rawQuest.reward), 1, 9999),
      startCounts: {
        cluckCount: toSafeNumber(startCounts.cluckCount),
        feedCount: toSafeNumber(startCounts.feedCount),
        eggCount: toSafeNumber(startCounts.eggCount)
      },
      claimed: Boolean(rawQuest.claimed)
    };
  }

  function normalizeIncubator(rawIncubator) {
    if (!rawIncubator || typeof rawIncubator !== 'object') {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0
      };
    }

    const active = Boolean(rawIncubator.active);
    const startedAt = toSafeNumber(rawIncubator.startedAt);
    const durationMs = clamp(toSafeNumber(rawIncubator.durationMs), 0, 86400000);

    if (!active || startedAt <= 0 || durationMs <= 0) {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0
      };
    }

    return {
      active: true,
      startedAt,
      durationMs
    };
  }

  function normalizeState(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    const upgrades = input.upgrades && typeof input.upgrades === 'object' ? input.upgrades : {};

    return {
      visitorName: typeof input.visitorName === 'string' ? input.visitorName.slice(0, 24) : '',
      cluckCount: toSafeNumber(input.cluckCount),
      feedCount: toSafeNumber(input.feedCount),
      eggCount: toSafeNumber(input.eggCount),
      hatchCount: toSafeNumber(input.hatchCount),
      coins: toSafeNumber(input.coins),
      streak: toSafeNumber(input.streak),
      lastVisitDate: typeof input.lastVisitDate === 'string' ? input.lastVisitDate : '',
      bestMood: toSafeNumber(input.bestMood),
      soundEnabled: typeof input.soundEnabled === 'boolean' ? input.soundEnabled : true,
      theme: input.theme === 'night' ? 'night' : 'day',
      factIndex: Number.isInteger(input.factIndex) ? input.factIndex : -1,
      weather: pickWeather(input.weather),
      upgrades: {
        feedLevel: clamp(toSafeNumber(upgrades.feedLevel), 0, MAX_UPGRADE_LEVEL),
        eggLevel: clamp(toSafeNumber(upgrades.eggLevel), 0, MAX_UPGRADE_LEVEL)
      },
      incubator: normalizeIncubator(input.incubator),
      dailyQuest: normalizeQuest(input.dailyQuest),
      achievementRewards: Array.isArray(input.achievementRewards)
        ? input.achievementRewards.filter((item) => typeof item === 'string').slice(0, 100)
        : [],
      logs: Array.isArray(input.logs)
        ? input.logs.filter((item) => typeof item === 'string').slice(0, 25)
        : []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return normalizeState(DEFAULT_STATE);
      }
      return normalizeState(JSON.parse(raw));
    } catch {
      return normalizeState(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function addLog(message, save = true) {
    const time = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    state.logs.unshift(`${time} - ${message}`);
    if (state.logs.length > 25) {
      state.logs.length = 25;
    }
    if (save) {
      saveState();
    }
    renderLogs();
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      refs.toast.classList.remove('show');
    }, 1900);
  }

  function playCluckTone() {
    if (!state.soundEnabled) {
      return;
    }

    try {
      audioCtx = audioCtx || new window.AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(260, audioCtx.currentTime + 0.11);

      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.14);

      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.14);
    } catch {
      // Browser may block audio until user interaction.
    }
  }

  function bounceChicken(n) {
    const chick = document.getElementById(`chicken${n}`);
    if (!chick) {
      return;
    }

    chick.style.transform = 'scale(1.35) rotate(12deg)';
    setTimeout(() => {
      chick.style.transform = 'scale(1) rotate(0deg)';
    }, 260);
  }

  function getMood() {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;
    const base = state.cluckCount * 3
      + state.feedCount * (6 + state.upgrades.feedLevel)
      + state.eggCount * 5
      + state.hatchCount * 8;
    return Math.min(100, Math.round(base * weather.moodFactor));
  }

  function getFeedPower() {
    return 1 + state.upgrades.feedLevel;
  }

  function getFeedUpgradeCost() {
    return 30 + state.upgrades.feedLevel * 35;
  }

  function getEggUpgradeCost() {
    return 40 + state.upgrades.eggLevel * 45;
  }

  function getEggCoinReward() {
    const weatherBonus = WEATHER_CONFIG[state.weather] ? WEATHER_CONFIG[state.weather].eggBonus : 0;
    return 3 + state.upgrades.eggLevel * 2 + weatherBonus;
  }

  function getAutoEggInterval() {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;
    const reduced = weather.eggInterval - state.upgrades.eggLevel * 140;
    return Math.max(1700, reduced);
  }

  function addCoins(amount) {
    const safe = toSafeNumber(amount);
    if (safe <= 0) {
      return;
    }
    state.coins += safe;
  }

  function spendCoins(amount) {
    const safe = toSafeNumber(amount);
    if (safe <= 0 || state.coins < safe) {
      return false;
    }
    state.coins -= safe;
    return true;
  }

  function renderLogs() {
    refs.actionLog.innerHTML = '';

    const rows = state.logs.slice(0, 12);
    if (rows.length === 0) {
      const li = document.createElement('li');
      li.className = 'log-item rounded-xl px-3 py-2 text-sm text-slate-500';
      li.textContent = 'Chưa có hoạt động nào.';
      refs.actionLog.appendChild(li);
      return;
    }

    rows.forEach((row) => {
      const li = document.createElement('li');
      li.className = 'log-item rounded-xl px-3 py-2 text-sm text-slate-700';
      li.textContent = row;
      refs.actionLog.appendChild(li);
    });
  }

  function applyTheme() {
    const isNight = state.theme === 'night';
    refs.body.classList.toggle('night-mode', isNight);
    refs.themeToggleBtn.textContent = isNight ? 'Chế độ: Đêm' : 'Chế độ: Ngày';

    if (refs.sun) {
      refs.sun.style.opacity = isNight ? '0.7' : '1';
    }

    if (refs.sunRays) {
      refs.sunRays.style.display = isNight ? 'none' : 'block';
    }
  }

  function renderAchievements(mood) {
    refs.achievementList.innerHTML = '';

    ACHIEVEMENTS.forEach((item) => {
      const unlocked = item.check(state, mood);
      const badge = document.createElement('div');
      badge.className = `achievement-badge rounded-xl px-4 py-3 ${unlocked ? 'unlocked' : ''}`;

      const title = document.createElement('p');
      title.className = 'font-black text-lg';
      title.textContent = `${unlocked ? '🏆' : '🔒'} ${item.label}`;

      const desc = document.createElement('p');
      desc.className = 'text-sm mt-1';
      desc.textContent = `${item.desc} • Thưởng ${item.reward} xu`;

      badge.appendChild(title);
      badge.appendChild(desc);
      refs.achievementList.appendChild(badge);
    });
  }

  function grantAchievementRewards(mood) {
    let total = 0;
    let unlockedCount = 0;

    ACHIEVEMENTS.forEach((item) => {
      const unlocked = item.check(state, mood);
      if (!unlocked || state.achievementRewards.includes(item.id)) {
        return;
      }

      state.achievementRewards.push(item.id);
      total += item.reward;
      unlockedCount += 1;
    });

    if (total > 0) {
      addCoins(total);
      addLog(`Mở ${unlockedCount} thành tích mới, nhận +${total} xu.`);
      showToast(`Mở thành tích mới: +${total} xu`);
      saveState();
    }
  }

  function createQuestForDate(dateKey) {
    const metrics = Object.keys(QUEST_METRICS);
    const seed = dateKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const metric = metrics[seed % metrics.length];
    const config = QUEST_METRICS[metric];
    const range = config.max - config.min + 1;
    const target = config.min + (seed % range);
    const reward = config.rewardBase + Math.floor(target * 1.7) + Math.min(state.streak, 10);

    return {
      date: dateKey,
      metric,
      target,
      reward,
      claimed: false,
      startCounts: {
        cluckCount: state.cluckCount,
        feedCount: state.feedCount,
        eggCount: state.eggCount
      }
    };
  }

  function ensureDailyQuest() {
    const today = getTodayKey();
    if (state.dailyQuest && state.dailyQuest.date === today) {
      return;
    }

    state.dailyQuest = createQuestForDate(today);
    const config = QUEST_METRICS[state.dailyQuest.metric];
    addLog(`Nhiệm vụ mới: ${config.label} ${state.dailyQuest.target} ${config.unit} để nhận ${state.dailyQuest.reward} xu.`);
    saveState();
  }

  function getQuestProgress() {
    ensureDailyQuest();

    const quest = state.dailyQuest;
    const startValue = quest.startCounts && Number.isFinite(quest.startCounts[quest.metric])
      ? quest.startCounts[quest.metric]
      : 0;

    const raw = Math.max(0, state[quest.metric] - startValue);
    const progress = Math.min(quest.target, raw);
    return {
      quest,
      progress,
      done: progress >= quest.target
    };
  }

  function renderQuest() {
    const { quest, progress, done } = getQuestProgress();
    const config = QUEST_METRICS[quest.metric];
    const percent = Math.round((progress / quest.target) * 100);

    refs.questTitle.textContent = `${config.icon} ${config.label}`;
    refs.questDesc.textContent = `Hoàn thành ${quest.target} ${config.unit} hôm nay để nhận ${quest.reward} xu.`;
    refs.questProgressText.textContent = `${progress}/${quest.target} ${config.unit}`;
    refs.questProgressBar.style.width = `${percent}%`;

    const disabled = quest.claimed || !done;
    refs.claimQuestBtn.disabled = disabled;
    refs.claimQuestBtn.classList.toggle('opacity-60', disabled);
    refs.claimQuestBtn.classList.toggle('cursor-not-allowed', disabled);

    if (quest.claimed) {
      refs.claimQuestBtn.textContent = 'Đã nhận thưởng';
    } else if (done) {
      refs.claimQuestBtn.textContent = `Nhận ${quest.reward} xu`;
    } else {
      refs.claimQuestBtn.textContent = 'Chưa hoàn thành';
    }
  }

  function renderEconomy() {
    refs.coinBalance.textContent = String(state.coins);
    refs.feedUpgradeLevel.textContent = `Lv${state.upgrades.feedLevel}`;
    refs.eggUpgradeLevel.textContent = `Lv${state.upgrades.eggLevel}`;

    const feedMax = state.upgrades.feedLevel >= MAX_UPGRADE_LEVEL;
    const eggMax = state.upgrades.eggLevel >= MAX_UPGRADE_LEVEL;

    const feedCost = getFeedUpgradeCost();
    const eggCost = getEggUpgradeCost();

    refs.buyFeedUpgradeBtn.disabled = feedMax;
    refs.buyEggUpgradeBtn.disabled = eggMax;
    refs.buyFeedUpgradeBtn.classList.toggle('opacity-60', feedMax);
    refs.buyFeedUpgradeBtn.classList.toggle('cursor-not-allowed', feedMax);
    refs.buyEggUpgradeBtn.classList.toggle('opacity-60', eggMax);
    refs.buyEggUpgradeBtn.classList.toggle('cursor-not-allowed', eggMax);

    refs.buyFeedUpgradeBtn.textContent = feedMax ? 'Đã max cấp' : `Nâng cấp (${feedCost} xu)`;
    refs.buyEggUpgradeBtn.textContent = eggMax ? 'Đã max cấp' : `Nâng cấp (${eggCost} xu)`;
  }

  function renderWeather() {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;
    refs.weatherLabel.textContent = weather.label;

    const intervalSec = (getAutoEggInterval() / 1000).toFixed(1);
    refs.weatherEffect.textContent = `${weather.effect} Tốc độ trứng: ${intervalSec}s/quả.`;
  }

  function getIncubatorProgress() {
    if (!state.incubator.active) {
      return {
        active: false,
        ready: false,
        progress: 0,
        remainingMs: 0
      };
    }

    const durationMs = Math.max(1, state.incubator.durationMs || INCUBATOR_DURATION_MS);
    const elapsedMs = Math.max(0, Date.now() - state.incubator.startedAt);
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    return {
      active: true,
      ready: remainingMs <= 0,
      progress: clamp(Math.round((elapsedMs / durationMs) * 100), 0, 100),
      remainingMs
    };
  }

  function renderIncubator() {
    if (!refs.startIncubatorBtn || !refs.claimIncubatorBtn || !refs.incubatorStatus || !refs.incubatorProgressBar) {
      return;
    }

    const progress = getIncubatorProgress();

    const canStart = !progress.active && state.eggCount > 0 && state.coins >= INCUBATOR_COST;
    refs.startIncubatorBtn.disabled = !canStart;
    refs.startIncubatorBtn.classList.toggle('opacity-60', !canStart);
    refs.startIncubatorBtn.classList.toggle('cursor-not-allowed', !canStart);
    refs.startIncubatorBtn.textContent = `Ủ 1 trứng (${INCUBATOR_COST} xu)`;

    if (!progress.active) {
      refs.incubatorStatus.textContent = 'Chưa có trứng nào đang ấp.';
      refs.incubatorProgressBar.style.width = '0%';
      refs.claimIncubatorBtn.disabled = true;
      refs.claimIncubatorBtn.classList.add('opacity-60', 'cursor-not-allowed');
      refs.claimIncubatorBtn.textContent = 'Chưa có trứng để nhận';
      return;
    }

    refs.incubatorProgressBar.style.width = `${progress.progress}%`;

    if (progress.ready) {
      refs.incubatorStatus.textContent = 'Trứng đã nở! Bấm nhận gà con.';
      refs.claimIncubatorBtn.disabled = false;
      refs.claimIncubatorBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      refs.claimIncubatorBtn.textContent = `Nhận gà con (+${INCUBATOR_COIN_REWARD} xu)`;
      return;
    }

    refs.incubatorStatus.textContent = `Đang ấp trứng... còn khoảng ${Math.ceil(progress.remainingMs / 1000)} giây.`;
    refs.claimIncubatorBtn.disabled = true;
    refs.claimIncubatorBtn.classList.add('opacity-60', 'cursor-not-allowed');
    refs.claimIncubatorBtn.textContent = 'Đang ấp...';
  }

  function clearEggDrops() {
    refs.eggField.querySelectorAll('.egg-drop').forEach((item) => item.remove());
  }

  function spawnEgg(auto = false) {
    const activeEggs = refs.eggField.querySelectorAll('.egg-drop').length;
    if (activeEggs > 7) {
      return;
    }

    const egg = document.createElement('button');
    egg.type = 'button';
    egg.className = 'egg-drop';
    egg.textContent = '🥚';
    egg.setAttribute('aria-label', 'Trứng rơi, bấm để nhặt');
    egg.style.left = `${Math.random() * 88 + 2}%`;

    egg.addEventListener('click', () => {
      egg.remove();
      state.eggCount += 1;
      const gain = getEggCoinReward();
      addCoins(gain);
      saveState();
      updateUI();
      showToast(`Bạn vừa nhặt trứng (+${gain} xu)`);
    });

    egg.addEventListener('animationend', () => {
      egg.remove();
    });

    refs.eggField.appendChild(egg);

    if (!auto) {
      showToast('Đã thả thêm 1 quả trứng');
    }
  }

  function restartAutoEggTimer() {
    if (autoEggTimer) {
      clearInterval(autoEggTimer);
    }

    autoEggTimer = window.setInterval(() => {
      spawnEgg(true);
    }, getAutoEggInterval());
  }

  function randomizeWeather(auto = false) {
    const weatherKeys = Object.keys(WEATHER_CONFIG);
    const candidates = weatherKeys.filter((key) => key !== state.weather);
    const picked = candidates[Math.floor(Math.random() * candidates.length)] || 'sunny';

    state.weather = picked;
    saveState();
    restartAutoEggTimer();
    updateUI();

    const label = WEATHER_CONFIG[picked].label;
    if (auto) {
      addLog(`Thời tiết tự đổi sang: ${label}`);
    } else {
      addLog(`Bạn đã đổi thời tiết sang: ${label}`);
      showToast(`Thời tiết mới: ${label}`);
    }
  }

  function updateVisitStreak() {
    const today = getTodayKey();

    if (!state.lastVisitDate) {
      state.streak = 1;
      state.lastVisitDate = today;
      addLog('Bắt đầu chuỗi ghé thăm: ngày 1.');
      saveState();
      return;
    }

    if (state.lastVisitDate === today) {
      return;
    }

    const diff = dayDiff(state.lastVisitDate, today);
    if (diff === 1) {
      state.streak += 1;
    } else {
      state.streak = 1;
    }

    state.lastVisitDate = today;
    addLog(`Bạn ghé trang trại ngày thứ ${state.streak} liên tiếp.`);
    saveState();
  }

  function updateUI() {
    const mood = getMood();
    if (mood > state.bestMood) {
      state.bestMood = mood;
      saveState();
    }

    grantAchievementRewards(mood);

    refs.cluckCount.textContent = String(state.cluckCount);
    refs.feedCount.textContent = String(state.feedCount);
    refs.eggCount.textContent = String(state.eggCount);
    refs.hatchCount.textContent = String(state.hatchCount);
    refs.coinCount.textContent = String(state.coins);
    refs.streakCount.textContent = String(state.streak);
    refs.moodCount.textContent = `${mood}%`;
    refs.bestMood.textContent = `${state.bestMood}%`;

    refs.visitorName.value = state.visitorName;
    refs.welcomeMessage.textContent = state.visitorName
      ? `Xin chào ${state.visitorName}! Hôm nay bạn sẽ chơi với mấy chú gà nào? 🐔`
      : 'Chào mừng bạn đến ngôi nhà vui vẻ! 🐔☀️';

    refs.soundToggleBtn.textContent = state.soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt';

    refs.factText.textContent = state.factIndex >= 0
      ? FACTS[state.factIndex]
      : 'Bấm "Nghe chuyện vui" để xem fact mới.';

    applyTheme();
    renderAchievements(mood);
    renderEconomy();
    renderWeather();
    renderQuest();
    renderIncubator();
    renderLogs();
  }

  function cluck(n) {
    state.cluckCount += 1;
    addCoins(1);
    saveState();
    updateUI();
    bounceChicken(n);
    playCluckTone();

    const lines = {
      1: 'Gà B 1: CỤC TÁC CỤC TÁC!!!',
      2: 'Gà B 2: Cục... tác... zzz...'
    };

    showToast(`${lines[n] || 'Cục tác!'} (+1 xu)`);
  }

  window.cluck = cluck;

  refs.saveNameBtn.addEventListener('click', () => {
    const oldName = state.visitorName;
    state.visitorName = refs.visitorName.value.trim().slice(0, 24);
    saveState();
    updateUI();

    if (oldName !== state.visitorName) {
      addLog(state.visitorName ? `Đã đổi tên hiển thị thành ${state.visitorName}.` : 'Đã xóa tên hiển thị.');
    }

    showToast(state.visitorName ? `Đã lưu tên: ${state.visitorName}` : 'Đã xóa tên khỏi lời chào');
  });

  refs.visitorName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      refs.saveNameBtn.click();
    }
  });

  refs.soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    saveState();
    updateUI();
    addLog(state.soundEnabled ? 'Đã bật âm thanh.' : 'Đã tắt âm thanh.');
    showToast(state.soundEnabled ? 'Đã bật âm thanh' : 'Đã tắt âm thanh');
  });

  refs.themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'day' ? 'night' : 'day';
    saveState();
    updateUI();
    addLog(state.theme === 'night' ? 'Đổi sang chế độ đêm.' : 'Đổi sang chế độ ngày.');
    showToast(state.theme === 'night' ? 'Chuyển sang chế độ đêm' : 'Chuyển sang chế độ ngày');
  });

  refs.exportStateBtn.addEventListener('click', async () => {
    const payload = JSON.stringify(state, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      addLog('Đã xuất dữ liệu vào clipboard.');
      showToast('Đã copy dữ liệu vào clipboard');
    } catch {
      showToast('Không thể copy tự động. Mở console để lấy dữ liệu.');
      console.log('farm-state-export', payload);
    }
  });

  refs.importStateBtn.addEventListener('click', () => {
    const raw = window.prompt('Dán JSON dữ liệu trang trại vào đây:');
    if (!raw) {
      return;
    }

    try {
      const imported = normalizeState(JSON.parse(raw));
      Object.assign(state, imported);
      ensureDailyQuest();
      saveState();
      restartAutoEggTimer();
      updateUI();
      addLog('Đã nhập dữ liệu từ ngoài vào trang trại.');
      showToast('Nhập dữ liệu thành công');
    } catch {
      showToast('JSON không hợp lệ, vui lòng kiểm tra lại');
    }
  });

  refs.feedBtn.addEventListener('click', () => {
    const feedPower = getFeedPower();
    const coinGain = 2 + state.upgrades.feedLevel;

    state.feedCount += feedPower;
    addCoins(coinGain);
    saveState();
    updateUI();

    bounceChicken(1);
    bounceChicken(2);

    showToast(`Đã cho ăn +${feedPower} lượt, +${coinGain} xu`);
  });

  refs.factBtn.addEventListener('click', () => {
    state.factIndex = (state.factIndex + 1) % FACTS.length;
    saveState();
    updateUI();
    showToast('Đã cập nhật chuyện vui mới');
  });

  refs.spawnEggBtn.addEventListener('click', () => {
    spawnEgg(false);
  });

  refs.startIncubatorBtn.addEventListener('click', () => {
    if (state.incubator.active) {
      showToast('Lò ấp đang hoạt động, chờ trứng nở nhé');
      return;
    }

    if (state.eggCount <= 0) {
      showToast('Bạn chưa có trứng để ấp');
      return;
    }

    if (!spendCoins(INCUBATOR_COST)) {
      showToast('Không đủ xu để bắt đầu ấp trứng');
      return;
    }

    state.eggCount -= 1;
    state.incubator = {
      active: true,
      startedAt: Date.now(),
      durationMs: INCUBATOR_DURATION_MS
    };

    saveState();
    updateUI();
    addLog(`Bắt đầu ấp 1 trứng (-${INCUBATOR_COST} xu).`);
    showToast('Lò ấp đã khởi động');
  });

  refs.claimIncubatorBtn.addEventListener('click', () => {
    const progress = getIncubatorProgress();
    if (!progress.active) {
      showToast('Hiện chưa có trứng đang ấp');
      return;
    }

    if (!progress.ready) {
      showToast(`Trứng chưa nở, còn khoảng ${Math.ceil(progress.remainingMs / 1000)} giây`);
      return;
    }

    state.incubator = {
      active: false,
      startedAt: 0,
      durationMs: 0
    };
    state.hatchCount += 1;
    addCoins(INCUBATOR_COIN_REWARD);
    saveState();
    updateUI();
    addLog(`Một gà con đã nở, nhận +${INCUBATOR_COIN_REWARD} xu.`);
    showToast(`Gà con đã nở! +${INCUBATOR_COIN_REWARD} xu`);
  });

  refs.buyFeedUpgradeBtn.addEventListener('click', () => {
    if (state.upgrades.feedLevel >= MAX_UPGRADE_LEVEL) {
      showToast('Nâng cấp cho ăn đã đạt mức tối đa');
      return;
    }

    const cost = getFeedUpgradeCost();
    if (!spendCoins(cost)) {
      showToast('Không đủ xu để nâng cấp cho ăn');
      return;
    }

    state.upgrades.feedLevel += 1;
    saveState();
    updateUI();
    addLog(`Nâng cấp cho ăn lên Lv${state.upgrades.feedLevel} (-${cost} xu).`);
    showToast(`Nâng cấp cho ăn thành công (Lv${state.upgrades.feedLevel})`);
  });

  refs.buyEggUpgradeBtn.addEventListener('click', () => {
    if (state.upgrades.eggLevel >= MAX_UPGRADE_LEVEL) {
      showToast('Nâng cấp trứng đã đạt mức tối đa');
      return;
    }

    const cost = getEggUpgradeCost();
    if (!spendCoins(cost)) {
      showToast('Không đủ xu để nâng cấp trứng');
      return;
    }

    state.upgrades.eggLevel += 1;
    saveState();
    restartAutoEggTimer();
    updateUI();
    addLog(`Nâng cấp trứng lên Lv${state.upgrades.eggLevel} (-${cost} xu).`);
    showToast(`Nâng cấp trứng thành công (Lv${state.upgrades.eggLevel})`);
  });

  refs.claimQuestBtn.addEventListener('click', () => {
    const { quest, done } = getQuestProgress();

    if (quest.claimed) {
      showToast('Bạn đã nhận thưởng nhiệm vụ này rồi');
      return;
    }

    if (!done) {
      showToast('Nhiệm vụ hôm nay chưa hoàn thành');
      return;
    }

    quest.claimed = true;
    addCoins(quest.reward);
    addLog(`Hoàn thành nhiệm vụ ngày và nhận +${quest.reward} xu.`);
    saveState();
    updateUI();
    showToast(`Nhận thưởng nhiệm vụ: +${quest.reward} xu`);
  });

  refs.rerollWeatherBtn.addEventListener('click', () => {
    randomizeWeather(false);
  });

  refs.resetBtn.addEventListener('click', () => {
    const keep = {
      visitorName: state.visitorName,
      theme: state.theme,
      soundEnabled: state.soundEnabled,
      streak: state.streak,
      lastVisitDate: state.lastVisitDate
    };

    Object.assign(state, normalizeState({ ...DEFAULT_STATE, ...keep }));
    ensureDailyQuest();
    clearEggDrops();
    saveState();
    restartAutoEggTimer();
    updateUI();
    addLog('Đã reset thống kê game (giữ lại tùy chọn cá nhân).');
    showToast('Đã reset thống kê game');
  });

  refs.toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.addEventListener('keydown', (event) => {
    const targetTag = (event.target && event.target.tagName) ? event.target.tagName.toLowerCase() : '';
    if (targetTag === 'input' || targetTag === 'textarea') {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === '1') {
      cluck(1);
    } else if (key === '2') {
      cluck(2);
    } else if (key === 'f') {
      refs.feedBtn.click();
    } else if (key === 'e') {
      refs.spawnEggBtn.click();
    } else if (key === 't') {
      refs.themeToggleBtn.click();
    } else if (key === 'w') {
      refs.rerollWeatherBtn.click();
    } else if (key === 'q') {
      refs.claimQuestBtn.click();
    } else if (key === 'h') {
      refs.claimIncubatorBtn.click();
    }
  });

  const navLinks = Array.from(document.querySelectorAll('.nav-link'));

  function setActiveNav(id) {
    navLinks.forEach((link) => {
      const target = link.getAttribute('href');
      link.classList.toggle('active', target === `#${id}`);
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = link.getAttribute('href');
      if (!target) {
        return;
      }

      const section = document.querySelector(target);
      if (!section) {
        return;
      }

      event.preventDefault();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible) {
      setActiveNav(visible.target.id);
    }
  }, {
    threshold: [0.35, 0.6, 0.85]
  });

  ['home', 'chickens', 'farm-lab'].forEach((id) => {
    const section = document.getElementById(id);
    if (section) {
      sectionObserver.observe(section);
    }
  });

  window.addEventListener('scroll', () => {
    refs.toTop.classList.toggle('show', window.scrollY > 420);
  }, { passive: true });

  updateVisitStreak();
  ensureDailyQuest();
  restartAutoEggTimer();

  if (weatherCycleTimer) {
    clearInterval(weatherCycleTimer);
  }

  weatherCycleTimer = window.setInterval(() => {
    randomizeWeather(true);
  }, WEATHER_ROTATE_MS);

  if (incubatorTickTimer) {
    clearInterval(incubatorTickTimer);
  }

  incubatorTickTimer = window.setInterval(() => {
    renderIncubator();
  }, 1000);

  updateUI();
  setActiveNav('home');
})();
