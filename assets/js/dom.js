export function getRefs() {
  return {
    body: document.body,
    cluckCount: document.getElementById('cluckCount'),
    feedCount: document.getElementById('feedCount'),
    eggCount: document.getElementById('eggCount'),
    hatchCount: document.getElementById('hatchCount'),
    coinCount: document.getElementById('coinCount'),
    streakCount: document.getElementById('streakCount'),
    moodCount: document.getElementById('moodCount'),
    bestMood: document.getElementById('bestMood'),
    welcomeMessage: document.getElementById('welcomeMessage'),

    visitorName: document.getElementById('visitorName'),
    saveNameBtn: document.getElementById('saveNameBtn'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    exportStateBtn: document.getElementById('exportStateBtn'),
    importStateBtn: document.getElementById('importStateBtn'),

    feedBtn: document.getElementById('feedBtn'),
    factBtn: document.getElementById('factBtn'),
    spawnEggBtn: document.getElementById('spawnEggBtn'),
    resetBtn: document.getElementById('resetBtn'),
    factText: document.getElementById('factText'),

    eggField: document.getElementById('eggField'),
    achievementList: document.getElementById('achievementList'),

    coinBalance: document.getElementById('coinBalance'),
    feedUpgradeLevel: document.getElementById('feedUpgradeLevel'),
    eggUpgradeLevel: document.getElementById('eggUpgradeLevel'),
    buyFeedUpgradeBtn: document.getElementById('buyFeedUpgradeBtn'),
    buyEggUpgradeBtn: document.getElementById('buyEggUpgradeBtn'),

    questTitle: document.getElementById('questTitle'),
    questDesc: document.getElementById('questDesc'),
    questProgressText: document.getElementById('questProgressText'),
    questProgressBar: document.getElementById('questProgressBar'),
    claimQuestBtn: document.getElementById('claimQuestBtn'),

    weatherLabel: document.getElementById('weatherLabel'),
    weatherEffect: document.getElementById('weatherEffect'),
    rerollWeatherBtn: document.getElementById('rerollWeatherBtn'),
    incubatorStatus: document.getElementById('incubatorStatus'),
    incubatorProgressBar: document.getElementById('incubatorProgressBar'),
    startIncubatorBtn: document.getElementById('startIncubatorBtn'),
    claimIncubatorBtn: document.getElementById('claimIncubatorBtn'),

    actionLog: document.getElementById('actionLog'),

    toast: document.getElementById('toast'),
    toTop: document.getElementById('toTop'),
    sun: document.getElementById('sun'),
    sunRays: document.getElementById('sunRays')
  };
}
