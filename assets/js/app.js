import {
  STORAGE_KEY,
  MAX_UPGRADE_LEVEL,
  WEATHER_ROTATE_MS,
  INCUBATOR_COST,
  INCUBATOR_DURATION_MS,
  INCUBATOR_COIN_REWARD,
  COIN_MACHINE_DURATION_MS,
  COIN_MACHINE_BASE_COST,
  MARKET_ORDER_MIN_EGGS,
  MARKET_ORDER_MAX_EGGS,
  AUTO_FEEDER_MAX_LEVEL,
  AUTO_FEEDER_BASE_INTERVAL_MS,
  AUTO_FEEDER_MIN_INTERVAL_MS,
  EGG_RUSH_COST,
  EGG_RUSH_DURATION_MS,
  EGG_RUSH_INTERVAL_FACTOR,
  EGG_RUSH_COIN_BONUS,
  DECOR_ITEMS,
  COMBO_WINDOW_MS,
  COMBO_REWARDS,
  FEVER_COST_COINS,
  FEVER_COST_EGGS,
  FEVER_DURATION_MS,
  FEVER_COIN_BONUS,
  FEVER_COMBO_WINDOW_FACTOR,
  PREMIUM_FEED_CRAFT_EGGS,
  PREMIUM_FEED_FEED_BONUS,
  PREMIUM_FEED_COIN_BONUS,
  LUCKY_SPIN_REWARDS,
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
  let autoFeederTickTimer;
  let audioCtx;
  const state = loadState();
  const statPulseTimers = new WeakMap();
  const statTextCache = new Map();
  let activeLabFilter = 'all';
  let priorityActionMap = new Map();

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

  function normalizeMarketOrder(rawOrder) {
    if (!rawOrder || typeof rawOrder !== 'object') {
      return null;
    }

    return {
      date: typeof rawOrder.date === 'string' ? rawOrder.date : getTodayKey(),
      target: clamp(toSafeNumber(rawOrder.target), MARKET_ORDER_MIN_EGGS, 200),
      reward: clamp(toSafeNumber(rawOrder.reward), 1, 9999),
      claimed: Boolean(rawOrder.claimed)
    };
  }

  function normalizeAutoFeeder(rawFeeder) {
    if (!rawFeeder || typeof rawFeeder !== 'object') {
      return {
        level: 0,
        enabled: false,
        lastFeedAt: 0
      };
    }

    const level = clamp(toSafeNumber(rawFeeder.level), 0, AUTO_FEEDER_MAX_LEVEL);
    const enabled = Boolean(rawFeeder.enabled) && level > 0;
    const lastFeedAt = toSafeNumber(rawFeeder.lastFeedAt);

    return {
      level,
      enabled,
      lastFeedAt: level > 0 ? lastFeedAt : 0
    };
  }

  function normalizeEggRush(rawRush) {
    if (!rawRush || typeof rawRush !== 'object') {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0,
        used: 0
      };
    }

    const active = Boolean(rawRush.active);
    const startedAt = toSafeNumber(rawRush.startedAt);
    const durationMs = clamp(toSafeNumber(rawRush.durationMs), 0, 86400000);
    const used = toSafeNumber(rawRush.used);

    if (!active || startedAt <= 0 || durationMs <= 0) {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0,
        used
      };
    }

    return {
      active: true,
      startedAt,
      durationMs,
      used
    };
  }

  function normalizeDecorations(rawDecorations) {
    const input = rawDecorations && typeof rawDecorations === 'object' ? rawDecorations : {};
    return {
      lantern: Boolean(input.lantern),
      windmill: Boolean(input.windmill),
      musicBox: Boolean(input.musicBox)
    };
  }

  function normalizeCombo(rawCombo) {
    if (!rawCombo || typeof rawCombo !== 'object') {
      return {
        count: 0,
        best: 0,
        lastActionAt: 0,
        claimedTargets: []
      };
    }

    const count = clamp(toSafeNumber(rawCombo.count), 0, 999);
    const best = Math.max(count, toSafeNumber(rawCombo.best));
    const lastActionAt = toSafeNumber(rawCombo.lastActionAt);
    const rawTargets = Array.isArray(rawCombo.claimedTargets) ? rawCombo.claimedTargets : [];
    const targetSet = new Set(
      rawTargets
        .map((target) => toSafeNumber(target))
        .filter((target) => target > 0)
    );

    return {
      count,
      best,
      lastActionAt: count > 0 ? lastActionAt : 0,
      claimedTargets: Array.from(targetSet).sort((a, b) => a - b).slice(0, COMBO_REWARDS.length)
    };
  }

  function normalizeFever(rawFever) {
    if (!rawFever || typeof rawFever !== 'object') {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0,
        used: 0
      };
    }

    const active = Boolean(rawFever.active);
    const startedAt = toSafeNumber(rawFever.startedAt);
    const durationMs = clamp(toSafeNumber(rawFever.durationMs), 0, 86400000);
    const used = toSafeNumber(rawFever.used);

    if (!active || startedAt <= 0 || durationMs <= 0) {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0,
        used
      };
    }

    return {
      active: true,
      startedAt,
      durationMs,
      used
    };
  }

  function normalizeDailyGift(rawGift) {
    if (!rawGift || typeof rawGift !== 'object') {
      return {
        lastClaimDate: '',
        totalClaimed: 0
      };
    }

    return {
      lastClaimDate: typeof rawGift.lastClaimDate === 'string' ? rawGift.lastClaimDate : '',
      totalClaimed: toSafeNumber(rawGift.totalClaimed)
    };
  }

  function normalizeLuckySpin(rawSpin) {
    if (!rawSpin || typeof rawSpin !== 'object') {
      return {
        lastSpinDate: '',
        totalSpins: 0,
        lastRewardId: ''
      };
    }

    return {
      lastSpinDate: typeof rawSpin.lastSpinDate === 'string' ? rawSpin.lastSpinDate : '',
      totalSpins: toSafeNumber(rawSpin.totalSpins),
      lastRewardId: typeof rawSpin.lastRewardId === 'string' ? rawSpin.lastRewardId : ''
    };
  }

  function normalizePremiumFeed(rawPremiumFeed) {
    if (!rawPremiumFeed || typeof rawPremiumFeed !== 'object') {
      return {
        packs: 0,
        crafted: 0,
        used: 0
      };
    }

    return {
      packs: toSafeNumber(rawPremiumFeed.packs),
      crafted: toSafeNumber(rawPremiumFeed.crafted),
      used: toSafeNumber(rawPremiumFeed.used)
    };
  }

  function normalizeCoinMachine(rawMachine) {
    if (!rawMachine || typeof rawMachine !== 'object') {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0,
        payout: 0
      };
    }

    const active = Boolean(rawMachine.active);
    const startedAt = toSafeNumber(rawMachine.startedAt);
    const durationMs = clamp(toSafeNumber(rawMachine.durationMs), 0, 86400000);
    const payout = toSafeNumber(rawMachine.payout);

    if (!active || startedAt <= 0 || durationMs <= 0 || payout <= 0) {
      return {
        active: false,
        startedAt: 0,
        durationMs: 0,
        payout: 0
      };
    }

    return {
      active: true,
      startedAt,
      durationMs,
      payout
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
    const eggCount = toSafeNumber(input.eggCount);
    const hasEggStock = Object.prototype.hasOwnProperty.call(input, 'eggStock');

    return {
      visitorName: typeof input.visitorName === 'string' ? input.visitorName.slice(0, 24) : '',
      cluckCount: toSafeNumber(input.cluckCount),
      feedCount: toSafeNumber(input.feedCount),
      eggCount,
      eggStock: hasEggStock ? toSafeNumber(input.eggStock) : eggCount,
      soldEggCount: toSafeNumber(input.soldEggCount),
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
      autoFeeder: normalizeAutoFeeder(input.autoFeeder),
      autoEggEnabled: typeof input.autoEggEnabled === 'boolean' ? input.autoEggEnabled : true,
      eggRush: normalizeEggRush(input.eggRush),
      decorations: normalizeDecorations(input.decorations),
      combo: normalizeCombo(input.combo),
      fever: normalizeFever(input.fever),
      dailyGift: normalizeDailyGift(input.dailyGift),
      luckySpin: normalizeLuckySpin(input.luckySpin),
      premiumFeed: normalizePremiumFeed(input.premiumFeed),
      coinMachine: normalizeCoinMachine(input.coinMachine),
      incubator: normalizeIncubator(input.incubator),
      marketOrder: normalizeMarketOrder(input.marketOrder),
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
    const decorated = Math.round(base * weather.moodFactor) + getDecorationMoodBonus();
    return Math.min(100, decorated);
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

  function getAutoFeederUpgradeCost() {
    return 65 + state.autoFeeder.level * 85;
  }

  function getAutoFeederInterval() {
    const reduced = AUTO_FEEDER_BASE_INTERVAL_MS - state.autoFeeder.level * 2200;
    return Math.max(AUTO_FEEDER_MIN_INTERVAL_MS, reduced);
  }

  function getAutoFeederFeedPower() {
    return Math.max(1, Math.ceil(getFeedPower() * 0.7) + Math.floor(state.autoFeeder.level / 2));
  }

  function getAutoFeederCoinReward() {
    return 1 + Math.floor(state.autoFeeder.level / 2);
  }

  function hasDecoration(id) {
    return Boolean(state.decorations && state.decorations[id]);
  }

  function getDecorationCoinBonus() {
    return hasDecoration('lantern') ? 1 : 0;
  }

  function getDecorationMoodBonus() {
    return hasDecoration('musicBox') ? 8 : 0;
  }

  function getWindmillIntervalFactor() {
    return hasDecoration('windmill') ? 0.88 : 1;
  }

  function getComboWindowMs() {
    if (isFeverRunning()) {
      return Math.round(COMBO_WINDOW_MS * FEVER_COMBO_WINDOW_FACTOR);
    }
    return COMBO_WINDOW_MS;
  }

  function getFeverCost() {
    return {
      coins: FEVER_COST_COINS,
      eggs: FEVER_COST_EGGS
    };
  }

  function isFeverRunning() {
    if (!state.fever || !state.fever.active) {
      return false;
    }

    const duration = Math.max(1, state.fever.durationMs || FEVER_DURATION_MS);
    return Date.now() - state.fever.startedAt < duration;
  }

  function getFeverProgress() {
    if (!state.fever || !state.fever.active) {
      return {
        active: false,
        ready: false,
        progress: 0,
        remainingMs: 0
      };
    }

    const durationMs = Math.max(1, state.fever.durationMs || FEVER_DURATION_MS);
    const elapsedMs = Math.max(0, Date.now() - state.fever.startedAt);
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    return {
      active: true,
      ready: remainingMs <= 0,
      progress: clamp(Math.round((elapsedMs / durationMs) * 100), 0, 100),
      remainingMs
    };
  }

  function stopFever(completed = false) {
    if (!state.fever || !state.fever.active) {
      return false;
    }

    state.fever.active = false;
    state.fever.startedAt = 0;
    state.fever.durationMs = 0;
    saveState();

    if (completed) {
      addLog('Lễ Hội Gà đã kết thúc.');
      showToast('Lễ Hội Gà đã kết thúc');
    }

    return true;
  }

  function getFeverCoinBonus() {
    return isFeverRunning() ? FEVER_COIN_BONUS : 0;
  }

  function getComboRemainingMs() {
    if (!state.combo || state.combo.count <= 0 || state.combo.lastActionAt <= 0) {
      return 0;
    }
    return Math.max(0, getComboWindowMs() - (Date.now() - state.combo.lastActionAt));
  }

  function isComboActive() {
    return getComboRemainingMs() > 0;
  }

  function formatComboReward(reward) {
    const parts = [];
    if (reward.coins > 0) {
      parts.push(`+${reward.coins} xu`);
    }
    if (reward.eggStock > 0) {
      parts.push(`+${reward.eggStock} trứng kho`);
    }
    if (reward.premiumFeed > 0) {
      parts.push(`+${reward.premiumFeed} cám premium`);
    }
    return parts.join(' • ');
  }

  function getNextComboReward() {
    const claimed = new Set(state.combo && Array.isArray(state.combo.claimedTargets) ? state.combo.claimedTargets : []);
    return COMBO_REWARDS.find((reward) => !claimed.has(reward.target)) || null;
  }

  function registerComboAction(sourceLabel) {
    const now = Date.now();
    const wasActive = isComboActive();
    if (wasActive) {
      state.combo.count += 1;
    } else {
      state.combo.count = 1;
      state.combo.claimedTargets = [];
    }

    state.combo.lastActionAt = now;
    if (state.combo.count > state.combo.best) {
      state.combo.best = state.combo.count;
    }

    const claimed = new Set(state.combo.claimedTargets);
    const unlocked = COMBO_REWARDS.filter((reward) => state.combo.count >= reward.target && !claimed.has(reward.target));
    if (unlocked.length === 0) {
      return {
        count: state.combo.count,
        rewardText: ''
      };
    }

    const rewardTexts = [];
    unlocked.forEach((reward) => {
      state.combo.claimedTargets.push(reward.target);
      addCoins(reward.coins);
      state.eggStock += reward.eggStock;
      state.premiumFeed.packs += reward.premiumFeed;
      rewardTexts.push(`x${reward.target}: ${formatComboReward(reward)}`);
    });

    addLog(`${sourceLabel}: đạt thưởng combo ${rewardTexts.join(' | ')}.`, false);
    return {
      count: state.combo.count,
      rewardText: rewardTexts.join(' | ')
    };
  }

  function getEggRushCost() {
    return EGG_RUSH_COST;
  }

  function isEggRushRunning() {
    if (!state.eggRush.active) {
      return false;
    }

    const duration = Math.max(1, state.eggRush.durationMs || EGG_RUSH_DURATION_MS);
    return Date.now() - state.eggRush.startedAt < duration;
  }

  function getEggRushProgress() {
    if (!state.eggRush.active) {
      return {
        active: false,
        ready: false,
        progress: 0,
        remainingMs: 0
      };
    }

    const durationMs = Math.max(1, state.eggRush.durationMs || EGG_RUSH_DURATION_MS);
    const elapsedMs = Math.max(0, Date.now() - state.eggRush.startedAt);
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    return {
      active: true,
      ready: remainingMs <= 0,
      progress: clamp(Math.round((elapsedMs / durationMs) * 100), 0, 100),
      remainingMs
    };
  }

  function stopEggRush(completed = false) {
    if (!state.eggRush.active) {
      return false;
    }

    state.eggRush.active = false;
    state.eggRush.startedAt = 0;
    state.eggRush.durationMs = 0;
    saveState();
    restartAutoEggTimer();

    if (completed) {
      addLog('Mưa Trứng đã kết thúc.');
      showToast('Mưa Trứng đã kết thúc');
    }

    return true;
  }

  function getEggCoinReward() {
    const weatherBonus = WEATHER_CONFIG[state.weather] ? WEATHER_CONFIG[state.weather].eggBonus : 0;
    const rushBonus = isEggRushRunning() ? EGG_RUSH_COIN_BONUS : 0;
    const decorBonus = getDecorationCoinBonus();
    const feverBonus = getFeverCoinBonus();
    return 3 + state.upgrades.eggLevel * 2 + weatherBonus + rushBonus + decorBonus + feverBonus;
  }

  function getAutoEggInterval() {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;
    const reduced = weather.eggInterval - state.upgrades.eggLevel * 140;
    let baseInterval = Math.max(1700, reduced);
    baseInterval = Math.max(1300, Math.round(baseInterval * getWindmillIntervalFactor()));
    if (isEggRushRunning()) {
      return Math.max(900, Math.round(baseInterval * EGG_RUSH_INTERVAL_FACTOR));
    }
    return baseInterval;
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

  function createMarketOrderForDate(dateKey) {
    const seed = dateKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const range = MARKET_ORDER_MAX_EGGS - MARKET_ORDER_MIN_EGGS + 1;
    const target = MARKET_ORDER_MIN_EGGS + (seed % range);
    const reward = target * 8 + 12 + Math.min(state.streak * 2, 24);

    return {
      date: dateKey,
      target,
      reward,
      claimed: false
    };
  }

  function ensureMarketOrder() {
    const today = getTodayKey();
    if (state.marketOrder && state.marketOrder.date === today) {
      return;
    }

    state.marketOrder = createMarketOrderForDate(today);
    addLog(`Thương lái cần ${state.marketOrder.target} trứng hôm nay, thưởng ${state.marketOrder.reward} xu.`);
    saveState();
  }

  function renderMarketOrder() {
    if (!refs.orderTitle || !refs.orderDesc || !refs.orderProgressText || !refs.orderProgressBar || !refs.claimOrderBtn) {
      return;
    }

    ensureMarketOrder();
    const order = state.marketOrder;

    const progress = Math.min(order.target, state.eggStock);
    const percent = Math.round((progress / order.target) * 100);
    const ready = state.eggStock >= order.target;

    refs.orderTitle.textContent = `📦 Giao ${order.target} trứng`;
    refs.orderDesc.textContent = `Thưởng ${order.reward} xu nếu giao đủ trong ngày hôm nay.`;
    refs.orderProgressText.textContent = `${progress}/${order.target} trứng tồn kho`;
    refs.orderProgressBar.style.width = `${percent}%`;

    const disabled = order.claimed || !ready;
    refs.claimOrderBtn.disabled = disabled;
    refs.claimOrderBtn.classList.toggle('opacity-60', disabled);
    refs.claimOrderBtn.classList.toggle('cursor-not-allowed', disabled);

    if (order.claimed) {
      refs.claimOrderBtn.textContent = 'Đã giao hôm nay';
    } else if (ready) {
      refs.claimOrderBtn.textContent = `Giao trứng (+${order.reward} xu)`;
    } else {
      refs.claimOrderBtn.textContent = 'Chưa đủ trứng để giao';
    }
  }

  function getQuickSellUnitPrice() {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;
    const weatherBonus = weather.eggBonus + (state.weather === 'festival' ? 1 : 0);
    const upgradeBonus = Math.floor(state.upgrades.eggLevel / 2);
    const streakBonus = Math.min(3, Math.floor(state.streak / 3));
    return Math.max(3, 4 + weatherBonus + upgradeBonus + streakBonus);
  }

  function renderQuickSell() {
    if (!refs.quickSellPrice || !refs.quickSellStockText || !refs.quickSellTotalText || !refs.quickSellOneBtn || !refs.quickSellFiveBtn || !refs.quickSellAllBtn) {
      return;
    }

    const unitPrice = getQuickSellUnitPrice();
    const stock = state.eggStock;
    refs.quickSellPrice.textContent = `Giá hiện tại: ${unitPrice} xu/trứng`;
    refs.quickSellStockText.textContent = `Kho hiện có: ${stock} trứng`;
    refs.quickSellTotalText.textContent = `Đã bán tổng: ${state.soldEggCount} trứng`;

    const canSellOne = stock >= 1;
    const canSellFive = stock >= 5;
    const canSellAll = stock >= 1;

    refs.quickSellOneBtn.disabled = !canSellOne;
    refs.quickSellFiveBtn.disabled = !canSellFive;
    refs.quickSellAllBtn.disabled = !canSellAll;

    refs.quickSellOneBtn.classList.toggle('opacity-60', !canSellOne);
    refs.quickSellOneBtn.classList.toggle('cursor-not-allowed', !canSellOne);
    refs.quickSellFiveBtn.classList.toggle('opacity-60', !canSellFive);
    refs.quickSellFiveBtn.classList.toggle('cursor-not-allowed', !canSellFive);
    refs.quickSellAllBtn.classList.toggle('opacity-60', !canSellAll);
    refs.quickSellAllBtn.classList.toggle('cursor-not-allowed', !canSellAll);

    refs.quickSellOneBtn.textContent = `Bán 1 trứng (+${unitPrice} xu)`;
    refs.quickSellFiveBtn.textContent = `Bán 5 trứng (+${unitPrice * 5} xu)`;
    refs.quickSellAllBtn.textContent = canSellAll
      ? `Bán tất cả (+${unitPrice * stock} xu)`
      : 'Bán tất cả';
  }

  function getCoinMachineStartCost() {
    return COIN_MACHINE_BASE_COST + Math.floor(state.upgrades.feedLevel * 1.5);
  }

  function getCoinMachinePayout(cost) {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;
    const weatherBonus = weather.moodFactor >= 1.05 ? 8 : weather.moodFactor < 1 ? 3 : 5;
    const streakBonus = Math.min(12, state.streak);
    const eggBonus = Math.floor(state.upgrades.eggLevel / 2);
    return cost + 15 + weatherBonus + streakBonus + eggBonus;
  }

  function getCoinMachineProgress() {
    if (!state.coinMachine.active) {
      return {
        active: false,
        ready: false,
        progress: 0,
        remainingMs: 0
      };
    }

    const durationMs = Math.max(1, state.coinMachine.durationMs || COIN_MACHINE_DURATION_MS);
    const elapsedMs = Math.max(0, Date.now() - state.coinMachine.startedAt);
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    return {
      active: true,
      ready: remainingMs <= 0,
      progress: clamp(Math.round((elapsedMs / durationMs) * 100), 0, 100),
      remainingMs
    };
  }

  function renderCoinMachine() {
    if (!refs.coinMachineStatus || !refs.coinMachineProfit || !refs.coinMachineProgressBar || !refs.startCoinMachineBtn || !refs.claimCoinMachineBtn) {
      return;
    }

    const progress = getCoinMachineProgress();
    const cost = getCoinMachineStartCost();

    refs.startCoinMachineBtn.disabled = progress.active || state.coins < cost;
    refs.startCoinMachineBtn.classList.toggle('opacity-60', progress.active || state.coins < cost);
    refs.startCoinMachineBtn.classList.toggle('cursor-not-allowed', progress.active || state.coins < cost);
    refs.startCoinMachineBtn.textContent = `Bắt đầu mẻ ủ (-${cost} xu)`;

    if (!progress.active) {
      const expected = getCoinMachinePayout(cost);
      refs.coinMachineStatus.textContent = 'Máy đang rảnh, có thể bắt đầu mẻ mới.';
      refs.coinMachineProfit.textContent = `Dự kiến thu về: +${expected} xu sau khi ủ xong.`;
      refs.coinMachineProgressBar.style.width = '0%';
      refs.claimCoinMachineBtn.disabled = true;
      refs.claimCoinMachineBtn.classList.add('opacity-60', 'cursor-not-allowed');
      refs.claimCoinMachineBtn.textContent = 'Chưa có mẻ để thu';
      return;
    }

    refs.coinMachineProfit.textContent = `Mẻ hiện tại dự kiến thu +${state.coinMachine.payout} xu.`;
    refs.coinMachineProgressBar.style.width = `${progress.progress}%`;

    if (progress.ready) {
      refs.coinMachineStatus.textContent = 'Mẻ ủ đã hoàn tất, có thể thu xu.';
      refs.claimCoinMachineBtn.disabled = false;
      refs.claimCoinMachineBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      refs.claimCoinMachineBtn.textContent = `Thu +${state.coinMachine.payout} xu`;
      return;
    }

    refs.coinMachineStatus.textContent = `Máy đang chạy... còn khoảng ${Math.ceil(progress.remainingMs / 1000)} giây.`;
    refs.claimCoinMachineBtn.disabled = true;
    refs.claimCoinMachineBtn.classList.add('opacity-60', 'cursor-not-allowed');
    refs.claimCoinMachineBtn.textContent = 'Đang ủ...';
  }

  function getLuckySpinRewardById(id) {
    return LUCKY_SPIN_REWARDS.find((item) => item.id === id) || null;
  }

  function pickLuckySpinReward() {
    const pool = LUCKY_SPIN_REWARDS.filter((item) => item && item.weight > 0 && item.amount > 0);
    if (pool.length === 0) {
      return null;
    }

    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const item of pool) {
      roll -= item.weight;
      if (roll <= 0) {
        return item;
      }
    }

    return pool[pool.length - 1];
  }

  function applyLuckySpinReward(reward) {
    if (!reward) {
      return;
    }

    if (reward.type === 'coins') {
      addCoins(reward.amount);
      return;
    }

    if (reward.type === 'eggStock') {
      state.eggStock += reward.amount;
      return;
    }

    if (reward.type === 'feedCount') {
      state.feedCount += reward.amount;
    }
  }

  function renderLuckySpin() {
    if (!refs.luckySpinStatus || !refs.luckySpinReward || !refs.luckySpinTotal || !refs.luckySpinBtn) {
      return;
    }

    const today = getTodayKey();
    const spunToday = state.luckySpin.lastSpinDate === today;
    const lastReward = getLuckySpinRewardById(state.luckySpin.lastRewardId);

    refs.luckySpinTotal.textContent = `Tổng số lần quay: ${state.luckySpin.totalSpins}`;
    refs.luckySpinReward.textContent = lastReward
      ? `Lần gần nhất: ${lastReward.label}`
      : 'Chưa có lượt quay nào được ghi nhận.';

    refs.luckySpinBtn.disabled = spunToday;
    refs.luckySpinBtn.classList.toggle('opacity-60', spunToday);
    refs.luckySpinBtn.classList.toggle('cursor-not-allowed', spunToday);

    if (spunToday) {
      refs.luckySpinStatus.textContent = 'Bạn đã quay hôm nay rồi, quay lại vào ngày mai.';
      refs.luckySpinBtn.textContent = 'Đã quay hôm nay';
      return;
    }

    refs.luckySpinStatus.textContent = 'Có thể quay ngay để nhận thưởng ngẫu nhiên.';
    refs.luckySpinBtn.textContent = 'Quay ngay';
  }

  function getPremiumFeedCraftCost() {
    return PREMIUM_FEED_CRAFT_EGGS;
  }

  function getPremiumFeedFeedBonus() {
    return PREMIUM_FEED_FEED_BONUS + Math.floor(state.upgrades.feedLevel / 2);
  }

  function getPremiumFeedCoinBonus() {
    return PREMIUM_FEED_COIN_BONUS + Math.floor(state.upgrades.feedLevel / 2);
  }

  function renderPremiumFeed() {
    if (!refs.premiumFeedPacks || !refs.premiumFeedStats || !refs.craftPremiumFeedBtn || !refs.usePremiumFeedBtn) {
      return;
    }

    const packs = state.premiumFeed.packs;
    const craftCost = getPremiumFeedCraftCost();
    const feedBonus = getPremiumFeedFeedBonus();
    const coinBonus = getPremiumFeedCoinBonus() + getFeverCoinBonus();

    refs.premiumFeedPacks.textContent = `Bao cám hiện có: ${packs}`;
    refs.premiumFeedStats.textContent = `Đã chế biến ${state.premiumFeed.crafted} bao, đã dùng ${state.premiumFeed.used} lần.`;

    const canCraft = state.eggStock >= craftCost;
    refs.craftPremiumFeedBtn.disabled = !canCraft;
    refs.craftPremiumFeedBtn.classList.toggle('opacity-60', !canCraft);
    refs.craftPremiumFeedBtn.classList.toggle('cursor-not-allowed', !canCraft);
    refs.craftPremiumFeedBtn.textContent = `Chế biến 1 bao (-${craftCost} trứng kho)`;

    const canUse = packs > 0;
    refs.usePremiumFeedBtn.disabled = !canUse;
    refs.usePremiumFeedBtn.classList.toggle('opacity-60', !canUse);
    refs.usePremiumFeedBtn.classList.toggle('cursor-not-allowed', !canUse);
    refs.usePremiumFeedBtn.textContent = `Dùng 1 bao (+${feedBonus} cho ăn, +${coinBonus} xu)`;
  }

  function sellEggStock(amount) {
    const request = toSafeNumber(amount);
    if (request <= 0 || state.eggStock <= 0) {
      showToast('Kho trứng trống, chưa thể bán');
      return;
    }

    const quantity = Math.min(request, state.eggStock);
    const unitPrice = getQuickSellUnitPrice();
    const revenue = quantity * unitPrice;

    state.eggStock -= quantity;
    state.soldEggCount += quantity;
    addCoins(revenue);
    saveState();
    updateUI();
    addLog(`Bán nhanh ${quantity} trứng (+${revenue} xu).`);
    showToast(`Đã bán ${quantity} trứng, +${revenue} xu`);
  }

  function getDailyGiftReward() {
    const coins = 20 + Math.min(state.streak * 4, 56);
    const eggStock = state.streak >= 7 ? 4 : 0;
    return { coins, eggStock };
  }

  function renderDailyGift() {
    if (!refs.giftStatus || !refs.giftReward || !refs.giftProgressText || !refs.giftProgressBar || !refs.claimGiftBtn) {
      return;
    }

    const today = getTodayKey();
    const claimedToday = state.dailyGift.lastClaimDate === today;
    const reward = getDailyGiftReward();
    const progress = Math.min(100, Math.round((Math.min(state.streak, 7) / 7) * 100));

    refs.giftReward.textContent = `Quà hôm nay: +${reward.coins} xu${reward.eggStock > 0 ? `, +${reward.eggStock} trứng kho` : ''}.`;
    refs.giftProgressText.textContent = `Chuỗi ${Math.min(state.streak, 7)}/7 ngày`;
    refs.giftProgressBar.style.width = `${progress}%`;

    refs.claimGiftBtn.disabled = claimedToday;
    refs.claimGiftBtn.classList.toggle('opacity-60', claimedToday);
    refs.claimGiftBtn.classList.toggle('cursor-not-allowed', claimedToday);

    if (claimedToday) {
      refs.giftStatus.textContent = 'Bạn đã nhận quà hôm nay rồi.';
      refs.claimGiftBtn.textContent = 'Đã nhận hôm nay';
      return;
    }

    refs.giftStatus.textContent = 'Có thể nhận quà điểm danh ngay bây giờ.';
    refs.claimGiftBtn.textContent = 'Nhận quà hôm nay';
  }

  function getAutoFeederProgress() {
    if (state.autoFeeder.level <= 0 || !state.autoFeeder.enabled) {
      return {
        active: false,
        ready: false,
        progress: 0,
        remainingMs: 0
      };
    }

    const interval = getAutoFeederInterval();
    const lastFeedAt = state.autoFeeder.lastFeedAt > 0 ? state.autoFeeder.lastFeedAt : Date.now();
    const elapsedMs = Math.max(0, Date.now() - lastFeedAt);
    const remainingMs = Math.max(0, interval - elapsedMs);

    return {
      active: true,
      ready: remainingMs <= 0,
      progress: clamp(Math.round((elapsedMs / interval) * 100), 0, 100),
      remainingMs
    };
  }

  function renderAutoFeeder() {
    if (!refs.autoFeederLevel || !refs.autoFeederStatus || !refs.autoFeederProgressBar || !refs.buyAutoFeederBtn || !refs.toggleAutoFeederBtn) {
      return;
    }

    refs.autoFeederLevel.textContent = `Lv${state.autoFeeder.level}`;

    const levelMax = state.autoFeeder.level >= AUTO_FEEDER_MAX_LEVEL;
    const upgradeCost = getAutoFeederUpgradeCost();
    refs.buyAutoFeederBtn.disabled = levelMax;
    refs.buyAutoFeederBtn.classList.toggle('opacity-60', levelMax);
    refs.buyAutoFeederBtn.classList.toggle('cursor-not-allowed', levelMax);
    refs.buyAutoFeederBtn.textContent = levelMax ? 'Đã max cấp' : `Nâng cấp (${upgradeCost} xu)`;

    if (state.autoFeeder.level <= 0) {
      refs.autoFeederStatus.textContent = 'Chưa thuê trợ lý tự động cho ăn.';
      refs.autoFeederProgressBar.style.width = '0%';
      refs.buyAutoFeederBtn.textContent = `Thuê trợ lý (${upgradeCost} xu)`;
      refs.toggleAutoFeederBtn.disabled = true;
      refs.toggleAutoFeederBtn.classList.add('opacity-60', 'cursor-not-allowed');
      refs.toggleAutoFeederBtn.textContent = 'Tự động: Tắt';
      return;
    }

    refs.toggleAutoFeederBtn.disabled = false;
    refs.toggleAutoFeederBtn.classList.remove('opacity-60', 'cursor-not-allowed');
    refs.toggleAutoFeederBtn.textContent = state.autoFeeder.enabled ? 'Tự động: Bật' : 'Tự động: Tắt';

    if (!state.autoFeeder.enabled) {
      refs.autoFeederStatus.textContent = 'Trợ lý đang tạm nghỉ.';
      refs.autoFeederProgressBar.style.width = '0%';
      return;
    }

    const progress = getAutoFeederProgress();
    refs.autoFeederProgressBar.style.width = `${progress.progress}%`;
    refs.autoFeederStatus.textContent = `Đang cho ăn tự động, còn ${Math.ceil(progress.remainingMs / 1000)}s tới lượt tiếp theo.`;
  }

  function runAutoFeederTick() {
    if (state.autoFeeder.level <= 0 || !state.autoFeeder.enabled) {
      return;
    }

    if (state.autoFeeder.lastFeedAt <= 0) {
      state.autoFeeder.lastFeedAt = Date.now();
      saveState();
      return;
    }

    const interval = getAutoFeederInterval();
    const now = Date.now();
    if (now - state.autoFeeder.lastFeedAt < interval) {
      return;
    }

    state.autoFeeder.lastFeedAt = now;
    state.feedCount += getAutoFeederFeedPower();
    addCoins(getAutoFeederCoinReward());
    saveState();
    updateUI();
  }

  function renderEconomy() {
    refs.coinBalance.textContent = String(state.coins);
    refs.eggStockBalance.textContent = String(state.eggStock);
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

  function getDecorationStatusRef(id) {
    if (id === 'lantern') {
      return refs.decorLanternStatus;
    }
    if (id === 'windmill') {
      return refs.decorWindmillStatus;
    }
    if (id === 'musicBox') {
      return refs.decorMusicBoxStatus;
    }
    return null;
  }

  function getDecorationButtonRef(id) {
    if (id === 'lantern') {
      return refs.buyDecorLanternBtn;
    }
    if (id === 'windmill') {
      return refs.buyDecorWindmillBtn;
    }
    if (id === 'musicBox') {
      return refs.buyDecorMusicBoxBtn;
    }
    return null;
  }

  function renderDecorShop() {
    if (!refs.decorSummary) {
      return;
    }

    const unlocked = DECOR_ITEMS.filter((item) => hasDecoration(item.id)).length;
    const perks = [];
    const coinBonus = getDecorationCoinBonus();
    const moodBonus = getDecorationMoodBonus();
    if (coinBonus > 0) {
      perks.push(`+${coinBonus} xu/hành động`);
    }
    if (hasDecoration('windmill')) {
      perks.push('+12% tốc độ trứng');
    }
    if (moodBonus > 0) {
      perks.push(`+${moodBonus}% mood thụ động`);
    }

    refs.decorSummary.textContent = perks.length > 0
      ? `Kích hoạt ${unlocked}/${DECOR_ITEMS.length} công trình • ${perks.join(' • ')}.`
      : `Kích hoạt ${unlocked}/${DECOR_ITEMS.length} công trình trang trí.`;

    DECOR_ITEMS.forEach((item) => {
      const statusRef = getDecorationStatusRef(item.id);
      const buttonRef = getDecorationButtonRef(item.id);
      if (!statusRef || !buttonRef) {
        return;
      }

      const active = hasDecoration(item.id);
      const canBuy = !active && state.coins >= item.cost;

      statusRef.classList.toggle('active', active);
      statusRef.classList.toggle('affordable', !active && canBuy);
      statusRef.textContent = active
        ? `Đã kích hoạt • ${item.effect}`
        : canBuy
          ? `Đủ xu mở khóa ngay (${item.cost} xu)`
          : `Chi phí mở khóa: ${item.cost} xu`;

      buttonRef.disabled = active || !canBuy;
      buttonRef.classList.toggle('opacity-60', active || !canBuy);
      buttonRef.classList.toggle('cursor-not-allowed', active || !canBuy);
      buttonRef.textContent = active ? 'Đã mở khóa' : `Mở khóa (${item.cost} xu)`;
    });
  }

  function buyDecoration(id) {
    const item = DECOR_ITEMS.find((entry) => entry.id === id);
    if (!item) {
      return;
    }

    if (hasDecoration(item.id)) {
      showToast('Công trình này đã mở khóa');
      return;
    }

    if (!spendCoins(item.cost)) {
      showToast('Không đủ xu để mở khóa công trình');
      return;
    }

    state.decorations[item.id] = true;
    saveState();

    if (item.id === 'windmill') {
      restartAutoEggTimer();
    }

    updateUI();
    addLog(`Mở khóa công trình: ${item.label} (-${item.cost} xu).`);
    showToast(`Đã mở khóa ${item.label}`);
  }

  function renderWeather() {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;
    refs.weatherLabel.textContent = weather.label;

    const intervalSec = (getAutoEggInterval() / 1000).toFixed(1);
    refs.weatherEffect.textContent = `${weather.effect} Tốc độ trứng: ${intervalSec}s/quả.`;
  }

  function renderEggEngine() {
    if (!refs.autoEggToggleBtn || !refs.autoEggStatus || !refs.eggRushBtn || !refs.eggRushStatus || !refs.eggRushProgressBar) {
      return;
    }

    refs.autoEggToggleBtn.textContent = state.autoEggEnabled ? 'Tự động: Bật' : 'Tự động: Tắt';
    refs.autoEggToggleBtn.classList.toggle('opacity-80', !state.autoEggEnabled);

    if (!state.autoEggEnabled) {
      refs.autoEggStatus.textContent = 'Tự động thả trứng đang tạm dừng. Bật lại để tiếp tục spawn.';
    } else {
      refs.autoEggStatus.textContent = `Tự động thả trứng đang chạy, nhịp hiện tại ${(getAutoEggInterval() / 1000).toFixed(1)}s/quả.`;
    }

    const progress = getEggRushProgress();
    const cost = getEggRushCost();
    const canStartRush = !progress.active && state.coins >= cost;

    refs.eggRushBtn.disabled = progress.active || !canStartRush;
    refs.eggRushBtn.classList.toggle('opacity-60', progress.active || !canStartRush);
    refs.eggRushBtn.classList.toggle('cursor-not-allowed', progress.active || !canStartRush);

    if (!progress.active) {
      refs.eggRushBtn.textContent = `Kích hoạt Mưa Trứng (-${cost} xu)`;
      refs.eggRushStatus.textContent = `Mưa Trứng: tăng tốc trứng rơi và +${EGG_RUSH_COIN_BONUS} xu mỗi trứng trong ${Math.round(EGG_RUSH_DURATION_MS / 1000)}s.`;
      refs.eggRushProgressBar.style.width = '0%';
      return;
    }

    refs.eggRushBtn.textContent = 'Mưa Trứng đang chạy';
    refs.eggRushStatus.textContent = `Mưa Trứng còn ${Math.ceil(progress.remainingMs / 1000)}s.`;
    refs.eggRushProgressBar.style.width = `${progress.progress}%`;
  }

  function runEggRushTick() {
    const progress = getEggRushProgress();
    if (!progress.active) {
      return;
    }

    if (progress.ready) {
      stopEggRush(true);
      updateUI();
      return;
    }

    renderEggEngine();
  }

  function renderFeverPanel() {
    if (!refs.feverStatus || !refs.feverCostInfo || !refs.startFeverBtn || !refs.feverProgressBar) {
      return;
    }

    const progress = getFeverProgress();
    const cost = getFeverCost();
    const canStart = !progress.active && state.coins >= cost.coins && state.eggStock >= cost.eggs;

    refs.startFeverBtn.disabled = progress.active || !canStart;
    refs.startFeverBtn.classList.toggle('opacity-60', progress.active || !canStart);
    refs.startFeverBtn.classList.toggle('cursor-not-allowed', progress.active || !canStart);

    if (!progress.active) {
      refs.startFeverBtn.textContent = `Bắt đầu Lễ Hội (-${cost.coins} xu, -${cost.eggs} trứng)`;
      refs.feverStatus.textContent = canStart
        ? `Sẵn sàng kích hoạt: +${FEVER_COIN_BONUS} xu/hành động và kéo dài nhịp combo.`
        : 'Cần thêm tài nguyên để kích hoạt Lễ Hội Gà.';
      refs.feverCostInfo.textContent = `Yêu cầu: ${cost.coins} xu + ${cost.eggs} trứng kho • Buff ${Math.round((FEVER_COMBO_WINDOW_FACTOR - 1) * 100)}% thời gian combo.`;
      refs.feverProgressBar.style.width = '0%';
      return;
    }

    refs.startFeverBtn.textContent = 'Lễ Hội đang chạy';
    refs.feverStatus.textContent = `Lễ Hội còn ${Math.ceil(progress.remainingMs / 1000)}s • +${FEVER_COIN_BONUS} xu mỗi thao tác.`;
    refs.feverCostInfo.textContent = `Combo window hiện tại ${(getComboWindowMs() / 1000).toFixed(1)}s • Giữ chuỗi để tận dụng buff.`;
    refs.feverProgressBar.style.width = `${progress.progress}%`;
  }

  function runFeverTick() {
    const progress = getFeverProgress();
    if (!progress.active) {
      return;
    }

    if (progress.ready) {
      stopFever(true);
      updateUI();
      return;
    }

    renderFeverPanel();
  }

  function renderComboPanel() {
    if (!refs.comboStatus || !refs.comboCount || !refs.comboBest || !refs.comboNextReward || !refs.comboTimerText || !refs.comboProgressBar) {
      return;
    }

    const count = state.combo ? state.combo.count : 0;
    const best = state.combo ? state.combo.best : 0;
    const remainingMs = getComboRemainingMs();
    const comboWindowMs = getComboWindowMs();
    const active = remainingMs > 0;
    const nextReward = getNextComboReward();

    refs.comboCount.textContent = `x${count}`;
    refs.comboBest.textContent = `x${best}`;

    if (!active) {
      refs.comboStatus.textContent = 'Chuỗi đang nghỉ. Làm 1 thao tác để bắt đầu.';
      refs.comboTimerText.textContent = `Giữ nhịp trong ${(comboWindowMs / 1000).toFixed(1)}s giữa mỗi thao tác để không rơi combo.`;
      refs.comboProgressBar.style.width = '0%';
    } else {
      const remainingSec = (remainingMs / 1000).toFixed(1);
      refs.comboStatus.textContent = `Combo x${count} đang chạy, giữ nhịp để lấy mốc thưởng.`;
      refs.comboTimerText.textContent = `Còn ${remainingSec}s trước khi combo bị ngắt.`;
      refs.comboProgressBar.style.width = `${clamp(Math.round((remainingMs / comboWindowMs) * 100), 0, 100)}%`;
    }

    if (!nextReward) {
      refs.comboNextReward.textContent = 'Đã mở hết mốc thưởng combo của chuỗi hiện tại.';
      return;
    }

    const remainingSteps = Math.max(0, nextReward.target - count);
    refs.comboNextReward.textContent = remainingSteps > 0
      ? `x${nextReward.target} (còn ${remainingSteps}) • ${formatComboReward(nextReward)}`
      : `x${nextReward.target} • ${formatComboReward(nextReward)}`;
  }

  function runComboTick() {
    if (!state.combo || state.combo.count <= 0) {
      renderComboPanel();
      return;
    }

    if (isComboActive()) {
      renderComboPanel();
      return;
    }

    const endedAt = state.combo.count;
    const shouldLog = endedAt >= COMBO_REWARDS[0].target;
    state.combo.count = 0;
    state.combo.lastActionAt = 0;
    state.combo.claimedTargets = [];
    if (shouldLog) {
      addLog(`Chuỗi hưng phấn kết thúc ở mốc x${endedAt}.`, false);
    }
    saveState();
    updateUI();
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

    const canStart = !progress.active && state.eggStock > 0 && state.coins >= INCUBATOR_COST;
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
      state.eggStock += 1;
      const combo = registerComboAction('Nhặt trứng');
      const gain = getEggCoinReward();
      addCoins(gain);
      saveState();
      updateUI();
      showToast(`Bạn vừa nhặt trứng (+${gain} xu) • Combo x${combo.count}${combo.rewardText ? ` • ${combo.rewardText}` : ''}`);
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

    if (!state.autoEggEnabled) {
      autoEggTimer = null;
      return;
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

  function setStatText(ref, key, text) {
    if (!ref) {
      return;
    }

    ref.textContent = text;
    const previousText = statTextCache.get(key);
    if (previousText === undefined || previousText === text) {
      statTextCache.set(key, text);
      return;
    }

    const card = ref.closest('.stat-card');
    if (!card) {
      statTextCache.set(key, text);
      return;
    }

    card.classList.remove('stat-updated');
    void card.offsetWidth;
    card.classList.add('stat-updated');

    const prevTimer = statPulseTimers.get(card);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    const timer = setTimeout(() => {
      card.classList.remove('stat-updated');
      statPulseTimers.delete(card);
    }, 420);
    statPulseTimers.set(card, timer);
    statTextCache.set(key, text);
  }

  function renderMoodMeter(mood) {
    if (refs.moodMeter) {
      refs.moodMeter.setAttribute('aria-valuenow', String(mood));
    }

    if (refs.moodMeterBar) {
      refs.moodMeterBar.style.width = `${mood}%`;
      refs.moodMeterBar.classList.remove('mood-low', 'mood-mid', 'mood-high', 'mood-peak');

      let tierClass = 'mood-low';
      if (mood >= 85) {
        tierClass = 'mood-peak';
      } else if (mood >= 60) {
        tierClass = 'mood-high';
      } else if (mood >= 30) {
        tierClass = 'mood-mid';
      }

      refs.moodMeterBar.classList.add(tierClass);
    }

    if (!refs.moodStatus) {
      return;
    }

    if (mood >= 100) {
      refs.moodStatus.textContent = 'Đàn gà đạt mood tối đa. Giữ phong độ thật đỉnh!';
      return;
    }

    if (mood >= 70) {
      refs.moodStatus.textContent = 'Không khí trang trại đang cực kỳ sôi động.';
      return;
    }

    if (mood >= 40) {
      refs.moodStatus.textContent = 'Đàn gà đã quen bạn và bắt đầu hào hứng hơn.';
      return;
    }

    refs.moodStatus.textContent = 'Đàn gà còn hơi nhút nhát, hãy cho ăn và chơi cùng nhiều hơn.';
  }

  function renderNextActionHint() {
    if (!refs.nextActionHint) {
      return;
    }

    const { quest, done } = getQuestProgress();
    if (!quest.claimed && done) {
      refs.nextActionHint.textContent = `Gợi ý: nhiệm vụ hôm nay đã xong, nhận ngay +${quest.reward} xu.`;
      return;
    }

    const today = getTodayKey();
    if (state.dailyGift.lastClaimDate !== today) {
      refs.nextActionHint.textContent = 'Gợi ý: nhận quà điểm danh trước để có thêm tài nguyên khởi động.';
      return;
    }

    ensureMarketOrder();
    const order = state.marketOrder;
    if (order && !order.claimed && state.eggStock >= order.target) {
      refs.nextActionHint.textContent = `Gợi ý: kho đã đủ ${order.target} trứng, giao đơn thương lái để lấy thưởng lớn.`;
      return;
    }

    if (state.luckySpin.lastSpinDate !== today) {
      refs.nextActionHint.textContent = 'Gợi ý: thử vòng quay may mắn hôm nay để lấy thêm xu/trứng miễn phí.';
      return;
    }

    if (!state.autoEggEnabled) {
      refs.nextActionHint.textContent = 'Gợi ý: đang tắt tự động thả trứng, bật lại để tiết kiệm thao tác.';
      return;
    }

    if (!isEggRushRunning() && state.coins >= getEggRushCost()) {
      refs.nextActionHint.textContent = 'Gợi ý: kích hoạt Mưa Trứng để farm xu và trứng nhanh trong ngắn hạn.';
      return;
    }

    const feverCost = getFeverCost();
    if (!isFeverRunning() && state.coins >= feverCost.coins && state.eggStock >= feverCost.eggs) {
      refs.nextActionHint.textContent = 'Gợi ý: bật Lễ Hội Gà để tăng xu theo thao tác và kéo dài nhịp combo.';
      return;
    }

    const nextComboReward = getNextComboReward();
    if (isComboActive() && nextComboReward) {
      const remaining = nextComboReward.target - state.combo.count;
      if (remaining > 0 && remaining <= 2) {
        refs.nextActionHint.textContent = `Gợi ý: còn ${remaining} thao tác để chạm combo x${nextComboReward.target} (${formatComboReward(nextComboReward)}).`;
        return;
      }
    }

    const decorToBuy = DECOR_ITEMS.find((item) => !hasDecoration(item.id) && state.coins >= item.cost);
    if (decorToBuy) {
      refs.nextActionHint.textContent = `Gợi ý: đủ xu mở khóa ${decorToBuy.label}, buff sẽ có hiệu lực vĩnh viễn.`;
      return;
    }

    if (state.coins >= getFeedUpgradeCost() && state.upgrades.feedLevel < MAX_UPGRADE_LEVEL) {
      refs.nextActionHint.textContent = 'Gợi ý: đủ xu nâng cấp cho ăn, tăng tốc phát triển đàn gà.';
      return;
    }

    if (state.autoFeeder.level > 0 && !state.autoFeeder.enabled) {
      refs.nextActionHint.textContent = 'Gợi ý: bật trợ lý tự động (phím A) để duy trì nhịp tăng trưởng.';
      return;
    }

    if (!isComboActive()) {
      refs.nextActionHint.textContent = 'Gợi ý: nối nhanh gọi gà, cho ăn, nhặt trứng để khởi động chuỗi thưởng combo.';
      return;
    }

    refs.nextActionHint.textContent = 'Gợi ý: ưu tiên cho ăn + nhặt trứng để đẩy mood và lượng xu cùng lúc.';
  }

  function renderLabSnapshot(mood) {
    const weather = WEATHER_CONFIG[state.weather] || WEATHER_CONFIG.sunny;

    if (refs.labSnapMood) {
      refs.labSnapMood.textContent = `${mood}%`;
    }

    if (refs.labSnapCoins) {
      refs.labSnapCoins.textContent = String(state.coins);
    }

    if (refs.labSnapEggs) {
      refs.labSnapEggs.textContent = String(state.eggStock);
    }

    if (refs.labSnapWeather) {
      refs.labSnapWeather.textContent = weather.label;
    }
  }

  function renderReadyActions() {
    if (!Array.isArray(refs.actionCtaButtons)) {
      return;
    }

    refs.actionCtaButtons.forEach((button) => {
      const isReady = !button.disabled;
      button.classList.toggle('ready-action', isReady);
    });
  }

  function applyLabFilter(rawFilter) {
    const allowed = new Set(['all', 'economy', 'mission', 'automation']);
    const filter = allowed.has(rawFilter) ? rawFilter : 'all';
    activeLabFilter = filter;

    if (Array.isArray(refs.labFilterBtns)) {
      refs.labFilterBtns.forEach((button) => {
        const match = button.getAttribute('data-lab-filter') === filter;
        button.classList.toggle('active', match);
        button.setAttribute('aria-selected', match ? 'true' : 'false');
      });
    }

    if (!Array.isArray(refs.labGroupCards)) {
      return;
    }

    refs.labGroupCards.forEach((card) => {
      const group = card.getAttribute('data-lab-group') || 'all';
      const show = filter === 'all' || group === filter;
      card.classList.toggle('lab-card-hidden', !show);
      card.setAttribute('aria-hidden', show ? 'false' : 'true');
    });
  }

  function bindLabFilters() {
    if (!Array.isArray(refs.labFilterBtns)) {
      return;
    }

    refs.labFilterBtns.forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.getAttribute('data-lab-filter') || 'all';
        applyLabFilter(filter);
      });
    });

    applyLabFilter(activeLabFilter);
  }

  function getPriorityActions() {
    const actions = [];
    const today = getTodayKey();
    const { quest, done } = getQuestProgress();

    if (!quest.claimed && done) {
      actions.push({
        id: 'priority_quest',
        title: 'Nhiệm vụ ngày đã hoàn thành',
        desc: `Nhận ngay +${quest.reward} xu.`,
        cta: 'Nhận thưởng',
        triggerRef: refs.claimQuestBtn
      });
    }

    if (state.dailyGift.lastClaimDate !== today) {
      const reward = getDailyGiftReward();
      actions.push({
        id: 'priority_gift',
        title: 'Quà điểm danh đang chờ',
        desc: `Nhận +${reward.coins} xu${reward.eggStock > 0 ? `, +${reward.eggStock} trứng` : ''}.`,
        cta: 'Nhận quà',
        triggerRef: refs.claimGiftBtn
      });
    }

    ensureMarketOrder();
    const order = state.marketOrder;
    if (order && !order.claimed && state.eggStock >= order.target) {
      actions.push({
        id: 'priority_order',
        title: 'Đơn thương lái đã đủ hàng',
        desc: `Giao ${order.target} trứng để lấy +${order.reward} xu.`,
        cta: 'Giao ngay',
        triggerRef: refs.claimOrderBtn
      });
    }

    const machineProgress = getCoinMachineProgress();
    if (machineProgress.active && machineProgress.ready) {
      actions.push({
        id: 'priority_coin_machine',
        title: 'Máy ủ xu đã hoàn tất',
        desc: `Thu về +${state.coinMachine.payout} xu.`,
        cta: 'Thu xu',
        triggerRef: refs.claimCoinMachineBtn
      });
    }

    const incubatorProgress = getIncubatorProgress();
    if (incubatorProgress.active && incubatorProgress.ready) {
      actions.push({
        id: 'priority_incubator',
        title: 'Lò ấp đã nở trứng',
        desc: `Nhận gà con và +${INCUBATOR_COIN_REWARD} xu.`,
        cta: 'Nhận gà con',
        triggerRef: refs.claimIncubatorBtn
      });
    }

    if (state.luckySpin.lastSpinDate !== today) {
      actions.push({
        id: 'priority_spin',
        title: 'Bạn chưa quay may mắn hôm nay',
        desc: 'Thêm cơ hội lấy xu hoặc trứng miễn phí.',
        cta: 'Quay ngay',
        triggerRef: refs.luckySpinBtn
      });
    }

    if (!state.autoEggEnabled) {
      actions.push({
        id: 'priority_auto_egg',
        title: 'Tự động thả trứng đang tắt',
        desc: 'Bật lại để hệ thống tiếp tục tạo trứng theo thời gian.',
        cta: 'Bật tự động',
        triggerRef: refs.autoEggToggleBtn
      });
    }

    if (!isEggRushRunning() && state.coins >= getEggRushCost()) {
      actions.push({
        id: 'priority_egg_rush',
        title: 'Đủ xu để kích hoạt Mưa Trứng',
        desc: `Tăng tốc trứng rơi và +${EGG_RUSH_COIN_BONUS} xu mỗi trứng trong ${Math.round(EGG_RUSH_DURATION_MS / 1000)}s.`,
        cta: 'Kích hoạt',
        triggerRef: refs.eggRushBtn
      });
    }

    const feverCost = getFeverCost();
    if (!isFeverRunning() && state.coins >= feverCost.coins && state.eggStock >= feverCost.eggs) {
      actions.push({
        id: 'priority_fever',
        title: 'Đủ tài nguyên cho Lễ Hội Gà',
        desc: `Bật buff +${FEVER_COIN_BONUS} xu/hành động trong ${Math.round(FEVER_DURATION_MS / 1000)}s.`,
        cta: 'Bắt đầu',
        triggerRef: refs.startFeverBtn
      });
    }

    const decorToBuy = DECOR_ITEMS.find((item) => !hasDecoration(item.id) && state.coins >= item.cost);
    if (decorToBuy) {
      const triggerRef = getDecorationButtonRef(decorToBuy.id);
      if (triggerRef) {
        actions.push({
          id: `priority_decor_${decorToBuy.id}`,
          title: `Đủ xu mở ${decorToBuy.label}`,
          desc: `${decorToBuy.effect} (chi phí ${decorToBuy.cost} xu).`,
          cta: 'Mở khóa',
          triggerRef
        });
      }
    }

    const comboReward = getNextComboReward();
    if (comboReward && isComboActive()) {
      const remainSteps = comboReward.target - state.combo.count;
      if (remainSteps > 0 && remainSteps <= 2) {
        actions.push({
          id: 'priority_combo_finish',
          title: `Combo x${state.combo.count} sắp chạm mốc`,
          desc: `Còn ${remainSteps} thao tác để nhận ${formatComboReward(comboReward)}.`,
          cta: 'Tiếp tục combo',
          triggerRef: refs.feedBtn
        });
      }
    }

    if (state.autoFeeder.level > 0 && !state.autoFeeder.enabled) {
      actions.push({
        id: 'priority_feeder',
        title: 'Trợ lý tự động đang tắt',
        desc: 'Bật lại để đàn gà tiếp tục được chăm đều.',
        cta: 'Bật trợ lý',
        triggerRef: refs.toggleAutoFeederBtn
      });
    }

    return actions;
  }

  function renderPriorityBoard() {
    if (!refs.priorityStatus || !refs.priorityList) {
      return;
    }

    const actions = getPriorityActions();
    priorityActionMap = new Map(actions.map((item) => [item.id, item]));
    refs.priorityList.innerHTML = '';

    if (actions.length === 0) {
      refs.priorityStatus.textContent = 'Không có việc gấp. Tiếp tục nuôi đàn và tích tài nguyên.';
      const empty = document.createElement('li');
      empty.className = 'priority-empty';
      empty.textContent = 'Mọi thứ đang ổn định. Bạn có thể cho ăn hoặc nhặt trứng để tăng tốc phát triển.';
      refs.priorityList.appendChild(empty);
      return;
    }

    refs.priorityStatus.textContent = `${actions.length} việc có thể làm ngay để tăng hiệu suất.`;
    actions.slice(0, 4).forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'priority-item';

      const content = document.createElement('div');
      content.className = 'priority-content';

      const title = document.createElement('p');
      title.className = 'priority-item-title';
      title.textContent = `${idx + 1}. ${item.title}`;

      const desc = document.createElement('p');
      desc.className = 'priority-item-desc';
      desc.textContent = item.desc;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'priority-btn';
      button.dataset.priorityId = item.id;
      button.textContent = item.cta;

      content.appendChild(title);
      content.appendChild(desc);
      li.appendChild(content);
      li.appendChild(button);
      refs.priorityList.appendChild(li);
    });
  }

  function bindPriorityBoard() {
    if (!refs.priorityList) {
      return;
    }

    refs.priorityList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-priority-id]');
      if (!button) {
        return;
      }

      const priorityId = button.getAttribute('data-priority-id') || '';
      const action = priorityActionMap.get(priorityId);
      if (!action || !action.triggerRef) {
        return;
      }

      if (action.triggerRef.disabled) {
        showToast('Hành động này hiện chưa sẵn sàng');
        return;
      }

      action.triggerRef.click();
    });
  }

  function updateUI() {
    const mood = getMood();
    if (mood > state.bestMood) {
      state.bestMood = mood;
      saveState();
    }

    grantAchievementRewards(mood);

    setStatText(refs.cluckCount, 'cluckCount', String(state.cluckCount));
    setStatText(refs.feedCount, 'feedCount', String(state.feedCount));
    setStatText(refs.eggCount, 'eggCount', String(state.eggCount));
    setStatText(refs.eggStock, 'eggStock', String(state.eggStock));
    setStatText(refs.soldEggCount, 'soldEggCount', String(state.soldEggCount));
    setStatText(refs.hatchCount, 'hatchCount', String(state.hatchCount));
    setStatText(refs.coinCount, 'coinCount', String(state.coins));
    setStatText(refs.streakCount, 'streakCount', String(state.streak));
    setStatText(refs.moodCount, 'moodCount', `${mood}%`);
    setStatText(refs.bestMood, 'bestMood', `${state.bestMood}%`);

    refs.visitorName.value = state.visitorName;
    refs.welcomeMessage.textContent = state.visitorName
      ? `Xin chào ${state.visitorName}! Hôm nay bạn sẽ chơi với mấy chú gà nào? 🐔`
      : 'Chào mừng bạn đến ngôi nhà vui vẻ! 🐔☀️';

    refs.soundToggleBtn.textContent = state.soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt';

    refs.factText.textContent = state.factIndex >= 0
      ? FACTS[state.factIndex]
      : 'Bấm "Nghe chuyện vui" để xem fact mới.';
    renderMoodMeter(mood);
    renderNextActionHint();
    renderLabSnapshot(mood);

    applyTheme();
    renderAchievements(mood);
    renderEconomy();
    renderDecorShop();
    renderWeather();
    renderEggEngine();
    renderFeverPanel();
    renderComboPanel();
    renderQuest();
    renderMarketOrder();
    renderQuickSell();
    renderCoinMachine();
    renderDailyGift();
    renderLuckySpin();
    renderPremiumFeed();
    renderAutoFeeder();
    renderIncubator();
    renderPriorityBoard();
    renderReadyActions();
    renderLogs();
  }

  function cluck(n) {
    state.cluckCount += 1;
    const coinGain = 1 + getDecorationCoinBonus() + getFeverCoinBonus();
    const combo = registerComboAction('Gọi gà');
    addCoins(coinGain);
    saveState();
    updateUI();
    bounceChicken(n);
    playCluckTone();

    const lines = {
      1: 'Gà B 1: CỤC TÁC CỤC TÁC!!!',
      2: 'Gà B 2: Cục... tác... zzz...'
    };

    showToast(`${lines[n] || 'Cục tác!'} (+${coinGain} xu) • Combo x${combo.count}${combo.rewardText ? ` • ${combo.rewardText}` : ''}`);
  }

  window.cluck = cluck;

  function bindChickenSvgButtons() {
    if (!Array.isArray(refs.chickenSvgButtons)) {
      return;
    }

    refs.chickenSvgButtons.forEach((button) => {
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        event.preventDefault();
        const chickenId = Number(button.getAttribute('data-chicken'));
        if (chickenId === 1 || chickenId === 2) {
          cluck(chickenId);
        }
      });
    });
  }

  function bindLabShortcutButtons() {
    if (!Array.isArray(refs.labShortcutBtns)) {
      return;
    }

    refs.labShortcutBtns.forEach((button) => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-scroll-target');
        if (!targetId) {
          return;
        }

        const section = document.getElementById(targetId);
        if (!section) {
          return;
        }

        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  bindChickenSvgButtons();
  bindLabFilters();
  bindLabShortcutButtons();
  bindPriorityBoard();

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
      ensureMarketOrder();
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
    const coinGain = 2 + state.upgrades.feedLevel + getDecorationCoinBonus() + getFeverCoinBonus();
    const combo = registerComboAction('Cho ăn');

    state.feedCount += feedPower;
    addCoins(coinGain);
    saveState();
    updateUI();

    bounceChicken(1);
    bounceChicken(2);

    showToast(`Đã cho ăn +${feedPower} lượt, +${coinGain} xu • Combo x${combo.count}${combo.rewardText ? ` • ${combo.rewardText}` : ''}`);
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

  refs.autoEggToggleBtn.addEventListener('click', () => {
    state.autoEggEnabled = !state.autoEggEnabled;
    saveState();
    restartAutoEggTimer();
    updateUI();
    addLog(state.autoEggEnabled ? 'Đã bật tự động thả trứng.' : 'Đã tắt tự động thả trứng.');
    showToast(state.autoEggEnabled ? 'Tự động thả trứng: Bật' : 'Tự động thả trứng: Tắt');
  });

  refs.eggRushBtn.addEventListener('click', () => {
    const current = getEggRushProgress();
    if (current.active && !current.ready) {
      showToast('Mưa Trứng đang chạy, chờ hết đợt hiện tại');
      return;
    }

    const cost = getEggRushCost();
    if (!spendCoins(cost)) {
      showToast('Không đủ xu để kích hoạt Mưa Trứng');
      return;
    }

    state.eggRush.active = true;
    state.eggRush.startedAt = Date.now();
    state.eggRush.durationMs = EGG_RUSH_DURATION_MS;
    state.eggRush.used += 1;
    if (!state.autoEggEnabled) {
      state.autoEggEnabled = true;
    }
    saveState();
    restartAutoEggTimer();
    updateUI();
    addLog(`Kích hoạt Mưa Trứng (-${cost} xu) trong ${Math.round(EGG_RUSH_DURATION_MS / 1000)}s.`);
    showToast('Mưa Trứng bắt đầu! Trứng rơi nhanh hơn');
  });

  refs.startFeverBtn.addEventListener('click', () => {
    const progress = getFeverProgress();
    if (progress.active && !progress.ready) {
      showToast('Lễ Hội Gà đang chạy, chờ đợt hiện tại kết thúc');
      return;
    }

    const cost = getFeverCost();
    if (!spendCoins(cost.coins)) {
      showToast('Không đủ xu để bắt đầu Lễ Hội Gà');
      return;
    }

    if (state.eggStock < cost.eggs) {
      addCoins(cost.coins);
      showToast('Không đủ trứng kho để bắt đầu Lễ Hội Gà');
      return;
    }

    state.eggStock -= cost.eggs;
    state.fever.active = true;
    state.fever.startedAt = Date.now();
    state.fever.durationMs = FEVER_DURATION_MS;
    state.fever.used += 1;
    saveState();
    updateUI();
    addLog(`Kích hoạt Lễ Hội Gà (-${cost.coins} xu, -${cost.eggs} trứng) trong ${Math.round(FEVER_DURATION_MS / 1000)}s.`);
    showToast('Lễ Hội Gà bắt đầu! Xu thưởng tạm thời tăng');
  });

  refs.buyDecorLanternBtn.addEventListener('click', () => {
    buyDecoration('lantern');
  });

  refs.buyDecorWindmillBtn.addEventListener('click', () => {
    buyDecoration('windmill');
  });

  refs.buyDecorMusicBoxBtn.addEventListener('click', () => {
    buyDecoration('musicBox');
  });

  refs.startIncubatorBtn.addEventListener('click', () => {
    if (state.incubator.active) {
      showToast('Lò ấp đang hoạt động, chờ trứng nở nhé');
      return;
    }

    if (state.eggStock <= 0) {
      showToast('Bạn chưa có trứng để ấp');
      return;
    }

    if (!spendCoins(INCUBATOR_COST)) {
      showToast('Không đủ xu để bắt đầu ấp trứng');
      return;
    }

    state.eggStock -= 1;
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

  refs.claimOrderBtn.addEventListener('click', () => {
    ensureMarketOrder();
    const order = state.marketOrder;

    if (order.claimed) {
      showToast('Bạn đã giao đơn thương lái hôm nay rồi');
      return;
    }

    if (state.eggStock < order.target) {
      showToast(`Cần thêm ${order.target - state.eggStock} trứng trong kho`);
      return;
    }

    state.eggStock -= order.target;
    order.claimed = true;
    addCoins(order.reward);
    addLog(`Giao thành công ${order.target} trứng cho thương lái, nhận +${order.reward} xu.`);
    saveState();
    updateUI();
    showToast(`Đơn hàng hoàn tất: +${order.reward} xu`);
  });

  refs.quickSellOneBtn.addEventListener('click', () => {
    sellEggStock(1);
  });

  refs.quickSellFiveBtn.addEventListener('click', () => {
    sellEggStock(5);
  });

  refs.quickSellAllBtn.addEventListener('click', () => {
    sellEggStock(state.eggStock);
  });

  refs.startCoinMachineBtn.addEventListener('click', () => {
    if (state.coinMachine.active) {
      showToast('Máy ủ xu đang chạy, chưa thể bắt đầu mẻ mới');
      return;
    }

    const cost = getCoinMachineStartCost();
    if (!spendCoins(cost)) {
      showToast('Không đủ xu để bắt đầu mẻ ủ');
      return;
    }

    state.coinMachine = {
      active: true,
      startedAt: Date.now(),
      durationMs: COIN_MACHINE_DURATION_MS,
      payout: getCoinMachinePayout(cost)
    };

    saveState();
    updateUI();
    addLog(`Bắt đầu máy ủ xu (-${cost} xu), dự kiến thu +${state.coinMachine.payout} xu.`);
    showToast('Máy ủ xu đã khởi động');
  });

  refs.claimCoinMachineBtn.addEventListener('click', () => {
    const progress = getCoinMachineProgress();
    if (!progress.active) {
      showToast('Hiện chưa có mẻ ủ nào để thu');
      return;
    }

    if (!progress.ready) {
      showToast(`Máy chưa xong, còn khoảng ${Math.ceil(progress.remainingMs / 1000)} giây`);
      return;
    }

    const payout = state.coinMachine.payout;
    state.coinMachine = {
      active: false,
      startedAt: 0,
      durationMs: 0,
      payout: 0
    };
    addCoins(payout);
    saveState();
    updateUI();
    addLog(`Thu mẻ ủ xu thành công (+${payout} xu).`);
    showToast(`Máy ủ hoàn tất: +${payout} xu`);
  });

  refs.claimGiftBtn.addEventListener('click', () => {
    const today = getTodayKey();
    if (state.dailyGift.lastClaimDate === today) {
      showToast('Bạn đã nhận quà điểm danh hôm nay rồi');
      return;
    }

    const reward = getDailyGiftReward();
    state.dailyGift.lastClaimDate = today;
    state.dailyGift.totalClaimed += 1;
    addCoins(reward.coins);
    if (reward.eggStock > 0) {
      state.eggStock += reward.eggStock;
    }

    saveState();
    updateUI();
    addLog(`Nhận quà điểm danh ngày: +${reward.coins} xu${reward.eggStock > 0 ? `, +${reward.eggStock} trứng kho` : ''}.`);
    showToast(`Điểm danh thành công: +${reward.coins} xu${reward.eggStock > 0 ? `, +${reward.eggStock} trứng` : ''}`);
  });

  refs.luckySpinBtn.addEventListener('click', () => {
    const today = getTodayKey();
    if (state.luckySpin.lastSpinDate === today) {
      showToast('Bạn đã quay may mắn hôm nay rồi');
      return;
    }

    const reward = pickLuckySpinReward();
    if (!reward) {
      showToast('Chưa thể quay lúc này, thử lại sau');
      return;
    }

    applyLuckySpinReward(reward);
    state.luckySpin.lastSpinDate = today;
    state.luckySpin.totalSpins += 1;
    state.luckySpin.lastRewardId = reward.id;

    saveState();
    updateUI();
    addLog(`Quay may mắn nhận thưởng: ${reward.label}.`);
    showToast(`Vòng quay: ${reward.label}`);
  });

  refs.craftPremiumFeedBtn.addEventListener('click', () => {
    const craftCost = getPremiumFeedCraftCost();
    if (state.eggStock < craftCost) {
      showToast(`Cần thêm ${craftCost - state.eggStock} trứng kho để chế biến`);
      return;
    }

    state.eggStock -= craftCost;
    state.premiumFeed.packs += 1;
    state.premiumFeed.crafted += 1;

    saveState();
    updateUI();
    addLog(`Chế biến 1 bao cám premium (-${craftCost} trứng kho).`);
    showToast('Đã chế biến 1 bao cám premium');
  });

  refs.usePremiumFeedBtn.addEventListener('click', () => {
    if (state.premiumFeed.packs <= 0) {
      showToast('Bạn chưa có bao cám premium nào');
      return;
    }

    const combo = registerComboAction('Dùng cám premium');
    const feedBonus = getPremiumFeedFeedBonus();
    const coinBonus = getPremiumFeedCoinBonus() + getFeverCoinBonus();

    state.premiumFeed.packs -= 1;
    state.premiumFeed.used += 1;
    state.feedCount += feedBonus;
    addCoins(coinBonus);

    saveState();
    updateUI();
    bounceChicken(1);
    bounceChicken(2);
    addLog(`Dùng cám premium: +${feedBonus} lượt cho ăn, +${coinBonus} xu.`);
    showToast(`Cám premium: +${feedBonus} cho ăn, +${coinBonus} xu • Combo x${combo.count}${combo.rewardText ? ` • ${combo.rewardText}` : ''}`);
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

  refs.buyAutoFeederBtn.addEventListener('click', () => {
    if (state.autoFeeder.level >= AUTO_FEEDER_MAX_LEVEL) {
      showToast('Trợ lý tự động đã đạt mức tối đa');
      return;
    }

    const cost = getAutoFeederUpgradeCost();
    if (!spendCoins(cost)) {
      showToast('Không đủ xu để nâng cấp trợ lý tự động');
      return;
    }

    state.autoFeeder.level += 1;
    state.autoFeeder.enabled = true;
    if (state.autoFeeder.lastFeedAt <= 0) {
      state.autoFeeder.lastFeedAt = Date.now();
    }

    saveState();
    updateUI();
    addLog(`Nâng trợ lý tự động lên Lv${state.autoFeeder.level} (-${cost} xu).`);
    showToast(`Trợ lý tự động Lv${state.autoFeeder.level} đã sẵn sàng`);
  });

  refs.toggleAutoFeederBtn.addEventListener('click', () => {
    if (state.autoFeeder.level <= 0) {
      showToast('Bạn cần thuê trợ lý trước');
      return;
    }

    state.autoFeeder.enabled = !state.autoFeeder.enabled;
    if (state.autoFeeder.enabled && state.autoFeeder.lastFeedAt <= 0) {
      state.autoFeeder.lastFeedAt = Date.now();
    }

    saveState();
    updateUI();
    addLog(state.autoFeeder.enabled ? 'Đã bật trợ lý tự động cho ăn.' : 'Đã tắt trợ lý tự động cho ăn.');
    showToast(state.autoFeeder.enabled ? 'Đã bật trợ lý tự động' : 'Đã tắt trợ lý tự động');
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
      autoEggEnabled: state.autoEggEnabled,
      streak: state.streak,
      lastVisitDate: state.lastVisitDate,
      dailyGift: state.dailyGift,
      luckySpin: state.luckySpin
    };

    Object.assign(state, normalizeState({ ...DEFAULT_STATE, ...keep }));
    ensureDailyQuest();
    ensureMarketOrder();
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

  refs.dockCluckBtn.addEventListener('click', () => {
    cluck(Math.random() < 0.5 ? 1 : 2);
  });

  refs.dockFeedBtn.addEventListener('click', () => {
    refs.feedBtn.click();
  });

  refs.dockEggBtn.addEventListener('click', () => {
    refs.spawnEggBtn.click();
  });

  refs.dockLabBtn.addEventListener('click', () => {
    const lab = document.getElementById('farm-lab');
    if (!lab) {
      return;
    }
    lab.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    } else if (key === 'p') {
      refs.autoEggToggleBtn.click();
    } else if (key === 'z') {
      refs.eggRushBtn.click();
    } else if (key === 'v') {
      refs.startFeverBtn.click();
    } else if (key === 't') {
      refs.themeToggleBtn.click();
    } else if (key === 'w') {
      refs.rerollWeatherBtn.click();
    } else if (key === 'q') {
      refs.claimQuestBtn.click();
    } else if (key === 'm') {
      refs.claimOrderBtn.click();
    } else if (key === 'b') {
      refs.quickSellAllBtn.click();
    } else if (key === 'a') {
      refs.toggleAutoFeederBtn.click();
    } else if (key === 'g') {
      refs.claimGiftBtn.click();
    } else if (key === 'l') {
      refs.luckySpinBtn.click();
    } else if (key === 'x') {
      refs.usePremiumFeedBtn.click();
    } else if (key === 'r') {
      refs.claimCoinMachineBtn.click();
    } else if (key === 'h') {
      refs.claimIncubatorBtn.click();
    }
  });

  const navLinks = Array.from(document.querySelectorAll('.nav-link'));

  function setActiveNav(id) {
    navLinks.forEach((link) => {
      const target = link.getAttribute('href');
      const isActive = target === `#${id}`;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
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
  ensureMarketOrder();
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
    renderCoinMachine();
    runEggRushTick();
    runFeverTick();
    runComboTick();
  }, 1000);

  if (autoFeederTickTimer) {
    clearInterval(autoFeederTickTimer);
  }

  autoFeederTickTimer = window.setInterval(() => {
    runAutoFeederTick();
    renderAutoFeeder();
  }, 1000);

  runFeverTick();
  runComboTick();
  updateUI();
  setActiveNav('home');
})();
