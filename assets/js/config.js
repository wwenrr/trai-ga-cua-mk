export const STORAGE_KEY = 'farmBState.v3';
export const MAX_UPGRADE_LEVEL = 8;
export const WEATHER_ROTATE_MS = 45000;
export const INCUBATOR_COST = 12;
export const INCUBATOR_DURATION_MS = 45000;
export const INCUBATOR_COIN_REWARD = 18;
export const COIN_MACHINE_DURATION_MS = 38000;
export const COIN_MACHINE_BASE_COST = 35;
export const MARKET_ORDER_MIN_EGGS = 4;
export const MARKET_ORDER_MAX_EGGS = 12;
export const AUTO_FEEDER_MAX_LEVEL = 6;
export const AUTO_FEEDER_BASE_INTERVAL_MS = 22000;
export const AUTO_FEEDER_MIN_INTERVAL_MS = 7000;
export const AUTO_SELL_MIN_THRESHOLD = 8;
export const AUTO_SELL_MAX_THRESHOLD = 60;
export const AUTO_SELL_DEFAULT_THRESHOLD = 18;
export const AUTO_SELL_BATCH_SIZE = 3;
export const SANITATION_DECAY_INTERVAL_MS = 18000;
export const SANITATION_DECAY_STEP = 1;
export const SANITATION_MANUAL_CLEAN_COST = 3;
export const SANITATION_CLEAN_GAIN = 16;
export const SANITATION_BOT_COST = 95;
export const SANITATION_BOT_INTERVAL_MS = 26000;
export const SANITATION_LOW_THRESHOLD = 38;
export const SANITATION_DANGER_THRESHOLD = 20;
export const SANITATION_MOOD_PENALTY_MAX = 16;
export const SANITATION_EGG_INTERVAL_PENALTY_MS = 1100;
export const VET_CLINIC_COST = 54;
export const VET_CLINIC_DURATION_MS = 32000;
export const VET_CLINIC_COOLDOWN_MS = 70000;
export const VET_CLINIC_MOOD_BONUS = 10;
export const VET_CLINIC_EGG_INTERVAL_BOOST_MS = 500;
export const MARKETING_COST = 46;
export const MARKETING_DURATION_MS = 30000;
export const MARKETING_COOLDOWN_MS = 68000;
export const MARKETING_SELL_BONUS_PER_EGG = 2;
export const PRICE_LOCK_COST = 32;
export const PRICE_LOCK_DURATION_MS = 38000;
export const PRICE_LOCK_COOLDOWN_MS = 76000;
export const EGG_RUSH_COST = 42;
export const EGG_RUSH_DURATION_MS = 30000;
export const EGG_RUSH_INTERVAL_FACTOR = 0.58;
export const EGG_RUSH_COIN_BONUS = 2;
export const DECOR_ITEMS = [
  {
    id: 'lantern',
    label: 'Đèn lồng sân trại',
    cost: 55,
    effect: '+1 xu khi gọi gà, cho ăn và nhặt trứng.'
  },
  {
    id: 'windmill',
    label: 'Cối xay gió mini',
    cost: 85,
    effect: 'Tăng tốc trứng rơi thêm 12% mọi lúc.'
  },
  {
    id: 'musicBox',
    label: 'Hộp nhạc đồng quê',
    cost: 70,
    effect: 'Tăng mood thụ động +8%.'
  }
];
export const COMBO_WINDOW_MS = 6500;
export const COMBO_REWARDS = [
  {
    target: 5,
    coins: 18,
    eggStock: 1,
    premiumFeed: 0
  },
  {
    target: 10,
    coins: 34,
    eggStock: 1,
    premiumFeed: 1
  },
  {
    target: 16,
    coins: 60,
    eggStock: 2,
    premiumFeed: 1
  }
];
export const FEVER_COST_COINS = 48;
export const FEVER_COST_EGGS = 2;
export const FEVER_DURATION_MS = 28000;
export const FEVER_COIN_BONUS = 2;
export const FEVER_COMBO_WINDOW_FACTOR = 1.4;
export const WHOLESALE_EGG_BATCH = 10;
export const WHOLESALE_COOLDOWN_MS = 25000;
export const WHOLESALE_BASE_BONUS = 10;
export const WHOLESALE_FEVER_BONUS = 12;
export const WEATHER_SHIELD_COST = 34;
export const WEATHER_SHIELD_DURATION_MS = 36000;
export const WEATHER_SHIELD_MIN_MOOD_FACTOR = 1;
export const WEATHER_SHIELD_MAX_INTERVAL_MS = 4300;
export const WEATHER_SHIELD_COIN_BONUS = 1;
export const FLASH_ORDER_COOLDOWN_MS = 45000;
export const FLASH_ORDER_DURATION_MS = 30000;
export const FLASH_ORDER_MIN_EGGS = 5;
export const FLASH_ORDER_MAX_EGGS = 12;
export const FLASH_ORDER_BASE_REWARD = 24;
export const FLASH_ORDER_REWARD_PER_EGG = 11;
export const FLASH_ORDER_FEVER_REWARD_BONUS = 14;
export const VIP_VISIT_COOLDOWN_MS = 55000;
export const VIP_VISIT_DURATION_MS = 35000;
export const VIP_VISIT_TARGET_MIN = 4;
export const VIP_VISIT_TARGET_MAX = 10;
export const VIP_VISIT_BASE_REWARD = 26;
export const VIP_VISIT_REWARD_PER_STEP = 10;
export const VIP_VISIT_FEVER_REWARD_BONUS = 12;
export const VIP_VISIT_EGG_BONUS_THRESHOLD = 8;
export const TRADER_COOLDOWN_MS = 65000;
export const TRADER_DURATION_MS = 32000;
export const TRADER_MIN_PAY_COINS = 22;
export const TRADER_MAX_PAY_COINS = 78;
export const TRADER_MIN_PAY_EGGS = 4;
export const TRADER_MAX_PAY_EGGS = 12;
export const TRADER_PREMIUM_MIN_COINS = 58;
export const TRADER_PREMIUM_MAX_COINS = 96;
export const PREMIUM_FEED_CRAFT_EGGS = 3;
export const PREMIUM_FEED_FEED_BONUS = 8;
export const PREMIUM_FEED_COIN_BONUS = 6;
export const LUCKY_SPIN_REWARDS = [
  { id: 'spin_coin_20', label: '+20 xu', type: 'coins', amount: 20, weight: 30 },
  { id: 'spin_coin_45', label: '+45 xu', type: 'coins', amount: 45, weight: 20 },
  { id: 'spin_coin_90', label: '+90 xu', type: 'coins', amount: 90, weight: 8 },
  { id: 'spin_egg_3', label: '+3 trứng kho', type: 'eggStock', amount: 3, weight: 16 },
  { id: 'spin_egg_6', label: '+6 trứng kho', type: 'eggStock', amount: 6, weight: 8 },
  { id: 'spin_feed_4', label: '+4 lượt cho ăn', type: 'feedCount', amount: 4, weight: 12 },
  { id: 'spin_feed_8', label: '+8 lượt cho ăn', type: 'feedCount', amount: 8, weight: 6 }
];

export const WEATHER_CONFIG = {
  sunny: {
    label: 'Nắng đẹp ☀️',
    effect: 'Mood +5%, trứng rơi nhanh hơn.',
    eggInterval: 3600,
    moodFactor: 1.05,
    eggBonus: 0
  },
  windy: {
    label: 'Gió mát 🍃',
    effect: 'Trạng thái cân bằng, nhịp game bình thường.',
    eggInterval: 4300,
    moodFactor: 1,
    eggBonus: 0
  },
  rainy: {
    label: 'Mưa nhẹ 🌧️',
    effect: 'Mood -6%, nhưng nhặt trứng được thêm xu.',
    eggInterval: 5200,
    moodFactor: 0.94,
    eggBonus: 1
  },
  festival: {
    label: 'Lễ hội 🎉',
    effect: 'Mood +10%, trứng xuất hiện dày và thưởng cao.',
    eggInterval: 3000,
    moodFactor: 1.1,
    eggBonus: 2
  }
};

export const QUEST_METRICS = {
  cluckCount: {
    icon: '📣',
    label: 'Gọi gà',
    unit: 'lần',
    min: 6,
    max: 15,
    rewardBase: 18
  },
  feedCount: {
    icon: '🌽',
    label: 'Cho ăn',
    unit: 'lượt',
    min: 4,
    max: 10,
    rewardBase: 24
  },
  eggCount: {
    icon: '🥚',
    label: 'Nhặt trứng',
    unit: 'quả',
    min: 3,
    max: 8,
    rewardBase: 30
  }
};

export const DEFAULT_STATE = {
  visitorName: '',
  cluckCount: 0,
  feedCount: 0,
  eggCount: 0,
  eggStock: 0,
  soldEggCount: 0,
  hatchCount: 0,
  coins: 0,
  streak: 0,
  lastVisitDate: '',
  bestMood: 0,
  soundEnabled: true,
  theme: 'day',
  factIndex: -1,
  weather: 'sunny',
  upgrades: {
    feedLevel: 0,
    eggLevel: 0
  },
  autoFeeder: {
    level: 0,
    enabled: false,
    lastFeedAt: 0
  },
  autoSeller: {
    enabled: false,
    threshold: AUTO_SELL_DEFAULT_THRESHOLD,
    totalEggsSold: 0,
    totalCoinsEarned: 0
  },
  sanitation: {
    cleanliness: 100,
    totalManualCleans: 0,
    totalAutoCleans: 0,
    lastDecayAt: 0,
    botPurchased: false,
    botEnabled: false,
    lastBotCleanAt: 0
  },
  vetClinic: {
    active: false,
    startedAt: 0,
    durationMs: 0,
    lastUsedAt: 0,
    used: 0
  },
  marketing: {
    active: false,
    startedAt: 0,
    durationMs: 0,
    lastUsedAt: 0,
    used: 0,
    totalBonusCoins: 0
  },
  priceLock: {
    active: false,
    startedAt: 0,
    durationMs: 0,
    lastUsedAt: 0,
    used: 0,
    lockedUnitPrice: 0,
    totalProtectedSales: 0
  },
  autoEggEnabled: true,
  eggRush: {
    active: false,
    startedAt: 0,
    durationMs: 0,
    used: 0
  },
  decorations: {
    lantern: false,
    windmill: false,
    musicBox: false
  },
  combo: {
    count: 0,
    best: 0,
    lastActionAt: 0,
    claimedTargets: []
  },
  fever: {
    active: false,
    startedAt: 0,
    durationMs: 0,
    used: 0
  },
  wholesale: {
    lastTradeAt: 0,
    totalTrades: 0,
    totalEggs: 0
  },
  weatherShield: {
    active: false,
    startedAt: 0,
    durationMs: 0,
    used: 0
  },
  flashOrder: {
    active: false,
    target: 0,
    reward: 0,
    startedAt: 0,
    durationMs: 0,
    lastGeneratedAt: 0,
    completed: 0,
    expired: 0
  },
  vipVisit: {
    active: false,
    metric: 'cluckCount',
    target: 0,
    rewardCoins: 0,
    rewardEggStock: 0,
    startedAt: 0,
    durationMs: 0,
    startCounts: {
      cluckCount: 0,
      feedCount: 0,
      eggCount: 0
    },
    lastVisitAt: 0,
    completed: 0,
    failed: 0
  },
  mobileTrader: {
    active: false,
    kind: '',
    payAmount: 0,
    receiveAmount: 0,
    startedAt: 0,
    durationMs: 0,
    lastOfferAt: 0,
    completed: 0,
    expired: 0
  },
  dailyGift: {
    lastClaimDate: '',
    totalClaimed: 0
  },
  luckySpin: {
    lastSpinDate: '',
    totalSpins: 0,
    lastRewardId: ''
  },
  premiumFeed: {
    packs: 0,
    crafted: 0,
    used: 0
  },
  coinMachine: {
    active: false,
    startedAt: 0,
    durationMs: 0,
    payout: 0
  },
  incubator: {
    active: false,
    startedAt: 0,
    durationMs: 0
  },
  marketOrder: null,
  dailyQuest: null,
  achievementRewards: [],
  logs: []
};

export const FACTS = [
  'Gà có thể nhận ra hơn 100 khuôn mặt khác nhau, cả người và gà.',
  'Một chú gà khỏe có thể chạy hơn 14 km/h trong quãng ngắn.',
  'Gà thích ngủ khi trời tối và dậy rất sớm khi có ánh sáng.',
  'Mỗi lần bạn cho ăn, mood đàn gà sẽ tăng rõ rệt.',
  'Nhặt trứng đều tay giúp đàn gà "hạnh phúc" nhanh hơn.'
];

export const ACHIEVEMENTS = [
  { id: 'cluck_5', label: 'Ca sĩ sân vườn', desc: 'Cục tác ít nhất 5 lần', reward: 16, check: (s) => s.cluckCount >= 5 },
  { id: 'feed_5', label: 'Bếp trưởng', desc: 'Cho ăn ít nhất 5 lần', reward: 18, check: (s) => s.feedCount >= 5 },
  { id: 'egg_3', label: 'Thợ săn trứng', desc: 'Nhặt ít nhất 3 trứng', reward: 20, check: (s) => s.eggCount >= 3 },
  { id: 'trade_20', label: 'Thương lái mát tay', desc: 'Bán ít nhất 20 trứng tồn kho', reward: 26, check: (s) => s.soldEggCount >= 20 },
  { id: 'spin_10', label: 'Vua vòng quay', desc: 'Quay may mắn ít nhất 10 lần', reward: 28, check: (s) => s.luckySpin && s.luckySpin.totalSpins >= 10 },
  { id: 'premium_5', label: 'Đầu bếp trang trại', desc: 'Dùng cám premium ít nhất 5 lần', reward: 30, check: (s) => s.premiumFeed && s.premiumFeed.used >= 5 },
  { id: 'hatch_3', label: 'Lò ấp mát tay', desc: 'Ấp nở ít nhất 3 gà con', reward: 24, check: (s) => s.hatchCount >= 3 },
  { id: 'happy_80', label: 'Đàn gà cực vui', desc: 'Đạt mood từ 80%', reward: 25, check: (_, mood) => mood >= 80 },
  { id: 'legend_100', label: 'Huyền thoại trang trại', desc: 'Đạt mood 100%', reward: 35, check: (_, mood) => mood >= 100 }
];
