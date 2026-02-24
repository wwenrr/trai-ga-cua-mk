export const STORAGE_KEY = 'farmBState.v3';
export const MAX_UPGRADE_LEVEL = 8;
export const WEATHER_ROTATE_MS = 45000;
export const INCUBATOR_COST = 12;
export const INCUBATOR_DURATION_MS = 45000;
export const INCUBATOR_COIN_REWARD = 18;

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
  incubator: {
    active: false,
    startedAt: 0,
    durationMs: 0
  },
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
  { id: 'hatch_3', label: 'Lò ấp mát tay', desc: 'Ấp nở ít nhất 3 gà con', reward: 24, check: (s) => s.hatchCount >= 3 },
  { id: 'happy_80', label: 'Đàn gà cực vui', desc: 'Đạt mood từ 80%', reward: 25, check: (_, mood) => mood >= 80 },
  { id: 'legend_100', label: 'Huyền thoại trang trại', desc: 'Đạt mood 100%', reward: 35, check: (_, mood) => mood >= 100 }
];
