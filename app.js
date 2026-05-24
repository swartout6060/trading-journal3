const STORAGE_KEY = "tradevue-journal-trades-v2";
const OLD_STORAGE_KEY = "tradevue-journal-trades-v1";
const SETTINGS_KEY = "tradevue-journal-settings-v1";
const MIGRATION_KEY_PREFIX = "svj-firestore-migration-v1";

let firebaseApp = null;
let appAuth = null;
let appDb = null;
let currentUser = null;
let authMode = "login";
let cloudReady = false;
let suppressCloudSave = false;
let authStateResolved = false;
let authTimeoutId = null;

const defaultSettings = {
  startingBalance: 10000,
  paperStartingBalance: 10000,
  dailyLossLimit: 500,
  darkBackground: false,
  propFirmPassed: false,
  getPayout: false,
  liveAccount: false,
  getMaxAllocationFunded: false,
  copyTrade5Accounts: false,
  copyTrade20Accounts: false,
  consistentPayouts: false,
  quitJob: false,
  corvette: false,
  buyDadCar: false,
  penthouse: false,
  svjGt3: false,
  generationalWealth: false,
  retireParents: false,
  consistencyLog: {},
  consistencyCashTotal: 0,
  consistencyFreshStartVersion: 2,
  customStructures: []
};

const consistencyMilestones = [
  { id: "prepared", label: "Were you prepared?" },
  { id: "backtest", label: "Did you backtest today?" },
  { id: "gym", label: "Did You Hit The Gym?" }
];

const dailyVersePrompts = [
  { ref: "Psalm 46:10 KJV", text: "Be still, and know that I am God." },
  { ref: "James 1:19 KJV", text: "Let every man be swift to hear, slow to speak, slow to wrath." },
  { ref: "Proverbs 16:32 KJV", text: "He that is slow to anger is better than the mighty." },
  { ref: "2 Timothy 1:7 KJV", text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
  { ref: "Proverbs 3:5 KJV", text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding." },
  { ref: "Psalm 37:7 KJV", text: "Rest in the Lord, and wait patiently for him." },
  { ref: "Proverbs 14:29 KJV", text: "He that is slow to wrath is of great understanding." }
];

const baseStructures = ["IFVG", "Fair Value Gap", "Breaker Block", "Liquidity Sweep", "Other"];

const rawSample = [
  ["2026-04-13", "NASDAQ", "Breakout retest", "Long", "13:00", "13:15", 212.29, 211.55, 25, 0.36, 210.12, 2, true, false, false, "Paper Trading", "Entered a little early; risk was controlled."],
  ["2026-04-14", "NASDAQ", "Pullback to support", "Long", "10:30", "11:10", 205.6, 212.32, 100, 1.2, 202.73, 1, true, false, false, "Paper Trading", "Good entry after confirmation; managed risk well."],
  ["2026-04-15", "S&P 500", "VWAP bounce", "Long", "13:00", "14:30", 117.54, 116.32, 40, 0.92, 114.94, 4, true, false, false, "Demo Trading", "Market reversed after entry; followed stop."],
  ["2026-04-16", "NASDAQ", "Breakout retest", "Long", "11:05", "11:45", 191.25, 187.7, 30, 0.82, 186.52, 2, true, false, false, "Paper Trading", "Entered a little early; risk was controlled."],
  ["2026-04-17", "S&P 500", "Opening range breakout", "Long", "11:00", "11:25", 157.94, 158.01, 25, 0.95, 156.5, 2, true, false, false, "Demo Trading", "Exited flat when setup lost momentum."],
  ["2026-04-20", "NASDAQ", "Pullback to support", "Long", "10:05", "12:05", 257.24, 255.85, 40, 0.43, 254.66, 4, false, false, true, "Paper Trading", "Should have waited for stronger confirmation."],
  ["2026-04-21", "S&P 500", "Pullback to support", "Short", "13:45", "14:00", 279.3, 275.71, 20, 1.03, 283.68, 4, true, false, true, "Demo Trading", "Kept stop tight and let winner work."],
  ["2026-04-22", "S&P 500", "Breakout retest", "Short", "13:05", "14:05", 196.23, 189.24, 15, 0.39, 199.95, 3, true, false, false, "Paper Trading", "Patient setup; exited cleanly when momentum slowed."],
  ["2026-04-23", "NASDAQ", "Trend continuation", "Long", "14:00", "15:30", 238.52, 235.92, 100, 1.22, 234.33, 2, false, true, true, "Live Trading", "Should have waited for stronger confirmation."],
  ["2026-04-24", "NASDAQ", "Trend continuation", "Short", "14:05", "14:30", 80.74, 77.87, 25, 0.34, 82.57, 4, true, false, true, "Paper Trading", "Good entry after confirmation; managed risk well."],
  ["2026-04-27", "NASDAQ", "Pullback to support", "Short", "13:00", "13:25", 261.38, 265.21, 25, 1.37, 266.49, 4, false, true, true, "Demo Trading", "Stopped out; setup did not continue."],
  ["2026-04-28", "NASDAQ", "Pullback to support", "Long", "13:05", "14:35", 19.88, 19.67, 10, 0.55, 19.67, 3, false, false, true, "Paper Trading", "Should have waited for stronger confirmation."],
  ["2026-04-29", "S&P 500", "Pullback to support", "Short", "09:00", "10:00", 42.71, 43.26, 50, 1.07, 43.25, 3, false, false, true, "Paper Trading", "Stopped out; setup did not continue."],
  ["2026-04-30", "NASDAQ", "Resistance rejection", "Long", "14:00", "14:15", 54.73, 54.74, 20, 1.33, 54.11, 4, true, false, false, "Demo Trading", "Small scratch trade; no clear follow-through."],
  ["2026-05-01", "NASDAQ", "Moving average bounce", "Long", "13:15", "14:15", 145.24, 147.2, 25, 0.74, 141.98, 2, true, false, true, "Paper Trading", "Good entry after confirmation; managed risk well."],
  ["2026-05-04", "NASDAQ", "Breakout retest", "Long", "14:05", "14:20", 169.75, 171.64, 100, 1.4, 168.53, 1, true, false, false, "Paper Trading", "Good entry after confirmation; managed risk well."],
  ["2026-05-05", "NASDAQ", "Pullback to support", "Long", "11:15", "11:40", 123.79, 127.8, 25, 0.96, 121.69, 4, true, false, false, "Demo Trading", "Good entry after confirmation; managed risk well."],
  ["2026-05-06", "S&P 500", "Trend continuation", "Long", "14:15", "14:40", 137.79, 136.97, 15, 0.92, 136.94, 3, false, false, true, "Paper Trading", "Stopped out; setup did not continue."],
  ["2026-05-07", "S&P 500", "Opening range breakout", "Short", "14:15", "16:15", 132.8, 132.67, 100, 0.26, 135.37, 4, true, false, false, "Demo Trading", "Small scratch trade; no clear follow-through."],
  ["2026-05-08", "NASDAQ", "Opening range breakout", "Long", "09:00", "11:00", 89.36, 87.89, 25, 0.86, 87.61, 2, false, false, true, "Live Trading", "Market reversed after entry; followed stop."],
  ["2026-05-11", "S&P 500", "Opening range breakout", "Short", "10:45", "11:00", 184.92, 185.93, 30, 0.39, 186.6, 2, false, false, true, "Paper Trading", "Entered a little early; risk was controlled."],
  ["2026-05-12", "NASDAQ", "Trend continuation", "Long", "13:45", "15:45", 113.54, 115.66, 10, 1.23, 110.92, 4, true, false, false, "Demo Trading", "Good entry after confirmation; managed risk well."],
  ["2026-05-13", "NASDAQ", "Moving average bounce", "Long", "10:00", "11:00", 24.49, 24.26, 40, 0.56, 23.98, 3, false, false, true, "Paper Trading", "Should have waited for stronger confirmation."],
  ["2026-05-14", "NASDAQ", "Failed breakdown reversal", "Short", "11:15", "13:15", 97.96, 96.8, 25, 0.34, 98.96, 1, true, false, true, "Demo Trading", "Patient setup; exited cleanly when momentum slowed."],
  ["2026-05-15", "NASDAQ", "Opening range breakout", "Short", "14:00", "15:00", 170.11, 167.64, 30, 0.8, 171.25, 1, true, false, false, "Paper Trading", "Patient setup; exited cleanly when momentum slowed."],
  ["2026-05-18", "NASDAQ", "Breakout retest", "Short", "11:45", "12:25", 154.22, 156.84, 100, 0.79, 157.16, 4, true, false, false, "Live Trading", "Market reversed after entry; followed stop."],
  ["2026-05-19", "NASDAQ", "Failed breakdown reversal", "Short", "10:45", "12:15", 123.43, 124.96, 30, 1.19, 125.47, 4, false, false, true, "Paper Trading", "Should have waited for stronger confirmation."],
  ["2026-05-20", "S&P 500", "Trend continuation", "Short", "10:00", "10:40", 73.07, 71.4, 40, 1.38, 74.15, 4, true, false, false, "Demo Trading", "Followed plan and took profit near target."],
  ["2026-05-21", "NASDAQ", "Pullback to support", "Short", "13:45", "14:10", 229.32, 225.92, 20, 0.34, 230.8, 2, true, false, true, "Paper Trading", "Kept stop tight and let winner work."],
  ["2026-05-22", "NASDAQ", "Breakout retest", "Long", "14:05", "17:05", 251.88, 249.31, 15, 0.83, 246.64, 3, false, false, true, "Paper Trading", "Should have waited for stronger confirmation."]
];

const sampleTrades = rawSample.map((row) => normalizeTrade({
  date: row[0],
  symbol: row[1],
  setup: row[2],
  side: row[3],
  entryTime: row[4],
  entry: row[6],
  exit: row[7],
  qty: row[8],
  fees: row[9],
  stop: row[10],
  emotionLevel: row[11],
  followedPlan: row[12],
  overtraded: row[13],
  tradeType: row[15],
  notes: row[16]
}));

let state = {
  trades: loadTrades(),
  settings: loadSettings(),
  range: "30",
  recentAsc: false,
  historyFilter: "all",
  pendingScreenshots: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTrade(trade) {
  const entry = Number(trade.entry) || 0;
  const exit = Number(trade.exit) || 0;
  const qty = Number(trade.qty) || 0;
  const fees = Number(trade.fees) || 0;
  const stop = Number(trade.stop) || 0;
  const side = trade.side || "Long";
  const multiplier = side === "Short" ? -1 : 1;
  const gross = (exit - entry) * qty * multiplier;
  const cloudPnl = trade.pnl ?? trade.profitLoss;
  const net = Number.isFinite(Number(trade.netPnl ?? cloudPnl)) ? Number(trade.netPnl ?? cloudPnl) : gross - fees;
  const risk = stop ? Math.abs(entry - stop) * qty : 0;
  const oldEmotion = trade.emotionLevel ?? trade.emotion ?? 3;
  const emotionBefore = normalizeEmotionValue(trade.emotionBefore ?? trade.beforeEmotion ?? oldEmotion);
  const emotionDuring = normalizeEmotionValue(trade.emotionDuring ?? trade.duringEmotion ?? oldEmotion);
  const emotionAfter = normalizeEmotionValue(trade.emotionAfter ?? trade.afterEmotion ?? oldEmotion);
  const emotionLevel = Math.round((emotionScore(emotionBefore) + emotionScore(emotionDuring) + emotionScore(emotionAfter)) / 3);
  return {
    id: trade.id || uid(),
    date: trade.date || isoDate(new Date()),
    symbol: normalizeSymbol(trade.symbol),
    tradeType: trade.tradeType || "Paper Trading",
    setup: trade.setup || trade.tradeStrategy || trade.tradeStructure || "Unlabeled setup",
    tradeStructure: trade.tradeStructure || trade.tradeStrategy || trade.setup || "Other",
    customStructure: trade.customStructure || "",
    side,
    entryTime: trade.entryTime || "",
    entry,
    emotionBefore,
    emotionDuring,
    emotionAfter,
    emotionLevel,
    followedPlan: boolValue(trade.followedPlan, true),
    overtraded: boolValue(trade.overtraded, false),
    notes: trade.notes || "",
    screenshots: normalizeScreenshots(trade),
    netPnl: net,
    net,
    risk,
    r: risk ? net / risk : 0
  };
}

function normalizeSymbol(symbol) {
  const raw = String(symbol || "NASDAQ").toUpperCase();
  if (raw.includes("S&P") || raw.includes("SPY") || raw.includes("ES")) return "S&P 500";
  return "NASDAQ";
}

function normalizeScreenshots(trade) {
  const fallback = trade.screenshotUrl ? [{
    screenshotName: trade.screenshotName || "screenshot.png",
    screenshotNote: "Cloud screenshot from older Storage setup",
    uploadedAt: trade.uploadedAt || ""
  }] : (trade.screenshot ? [trade.screenshot] : []);
  const list = Array.isArray(trade.screenshots) ? trade.screenshots : fallback;
  return list.map((shot, index) => normalizeScreenshot(shot, index)).filter(Boolean);
}

function normalizeScreenshot(shot, index = 0) {
  if (!shot) return null;
  if (typeof shot === "string") {
    return {
      screenshotName: `screenshot-${index + 1}.png`,
      screenshotNote: shot.startsWith("data:") ? "Local-only screenshot from old browser save" : shot,
      uploadedAt: ""
    };
  }
  return {
    screenshotName: shot.screenshotName || shot.name || shot.fileName || `screenshot-${index + 1}.png`,
    screenshotNote: shot.screenshotNote || shot.note || "",
    uploadedAt: shot.uploadedAt || "",
    file: shot.file || null,
    previewUrl: shot.previewUrl || ""
  };
}

function screenshotSrc(shot) {
  return shot?.previewUrl || "";
}

function cleanScreenshotMeta(shot) {
  return {
    screenshotName: shot.screenshotName || "screenshot.png",
    screenshotNote: shot.screenshotNote || "Screenshot selected locally; cloud image storage is disabled.",
    uploadedAt: shot.uploadedAt || new Date().toISOString()
  };
}

function boolValue(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "Yes" || value === "yes") return true;
  if (value === "false" || value === "No" || value === "no") return false;
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value || min));
}

function normalizeEmotionValue(value) {
  if (value === "Anxious" || value === "Being A Pussy") return value;
  return String(clamp(Number(value), 1, 5));
}

function loadTrades() {
  const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  if (!saved) return sampleTrades;
  try {
    return JSON.parse(saved).map(normalizeTrade);
  } catch {
    return sampleTrades;
  }
}

function loadSettings() {
  try {
    const settings = { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    if (settings.consistencyFreshStartVersion !== defaultSettings.consistencyFreshStartVersion) {
      return {
        ...settings,
        consistencyLog: {},
        consistencyCashTotal: 0,
        consistencyFreshStartVersion: defaultSettings.consistencyFreshStartVersion
      };
    }
    return settings;
  } catch {
    return { ...defaultSettings };
  }
}

function saveTrades() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trades));
  saveCloudData();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  saveCloudData();
}

function firebaseIsConfigured() {
  return Boolean(window.firebase && firebase.apps && firebase.apps.length);
}

function initFirebase() {
  setAuthStep("Loading Firebase scripts");
  try {
    if (!window.firebase) {
      throw new Error("Firebase scripts did not load. Check your script tags or internet connection.");
    }
    if (!firebaseIsConfigured()) {
      showAuthSetup("Firebase is not initialized. Check firebase-config.js.");
      return;
    }
    firebaseApp = firebase.app();
    appAuth = typeof auth !== "undefined" ? auth : firebase.auth();
    appDb = typeof db !== "undefined" ? db : firebase.firestore();
    setAuthStep("Firebase initialized");
    authStateResolved = false;
    clearTimeout(authTimeoutId);
    authTimeoutId = setTimeout(() => {
      if (authStateResolved) return;
      const message = "Firebase could not connect. Check Firebase config, authorized domains, and Authentication setup.";
      console.error(message);
      showFirebaseError(message);
    }, 5000);
    setAuthStep("Checking auth state");
    appAuth.onAuthStateChanged(handleAuthState, (error) => {
      authStateResolved = true;
      clearTimeout(authTimeoutId);
      console.error("Firebase auth state error:", error);
      showFirebaseError(error);
    });
  } catch (error) {
    console.error("Firebase startup failed:", error);
    showFirebaseError(error);
  }
}

function setAuthStep(step) {
  const loading = $("#authLoading");
  if (loading) loading.textContent = step;
}

function showAuthSetup(message = "Paste your Firebase web config into firebase-config.js, then refresh this page.") {
  $("#authLoading").classList.add("hidden");
  $("#authForm").classList.add("hidden");
  $("#firebaseSetupNotice").classList.remove("hidden");
  $("#firebaseSetupNotice p").textContent = message;
  $(".app-shell").classList.add("hidden");
}

function showFirebaseError(error) {
  const message = typeof error === "string" ? error : authErrorMessage(error);
  $("#authShell").classList.remove("hidden");
  $(".app-shell").classList.add("hidden");
  $("#authLoading").classList.add("hidden");
  $("#authForm").classList.remove("hidden");
  $("#firebaseSetupNotice").classList.add("hidden");
  $("#authError").textContent = message;
  document.body.classList.remove("dark-background", "mobile-nav-open");
}

function showAuthScreen(loading = false) {
  $("#authShell").classList.remove("hidden");
  $(".app-shell").classList.add("hidden");
  $("#authLoading").classList.toggle("hidden", !loading);
  $("#authForm").classList.toggle("hidden", loading);
  $("#firebaseSetupNotice").classList.add("hidden");
  document.body.classList.remove("dark-background", "mobile-nav-open");
}

function showAppScreen() {
  $("#authShell").classList.add("hidden");
  $(".app-shell").classList.remove("hidden");
}

async function handleAuthState(user) {
  authStateResolved = true;
  clearTimeout(authTimeoutId);
  setAuthStep("Auth state received");
  currentUser = user;
  if (!user) {
    cloudReady = false;
    state.trades = [];
    state.settings = { ...defaultSettings };
    state.pendingScreenshots = [];
    setAuthStep("Showing login");
    showAuthScreen(false);
    return;
  }

  setAuthStep("Loading user data");
  showAuthScreen(true);
  try {
    await upsertProfile(user);
    await offerLocalMigration(user.uid);
    await loadCloudData(user.uid);
    $("#accountEmail").textContent = user.email || "Signed in";
    cloudReady = true;
    setAuthStep("Showing dashboard");
    showAppScreen();
    renderTimeDropdowns();
    renderStructureDropdown("IFVG");
    clearForm();
    render();
  } catch (error) {
    console.error("Firestore user data load failed:", error);
    showAuthScreen(false);
    showAuthError(error);
  }
}

async function upsertProfile(user) {
  const userRef = appDb.collection("users").doc(user.uid);
  const profile = {
    email: user.email || "",
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  };
  const snap = await userRef.get();
  if (snap.exists) {
    await userRef.set({ profile }, { merge: true });
  } else {
    await userRef.set({
      profile: {
        ...profile,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
  }
}

function hasLocalDataToMigrate() {
  const trades = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  const settings = localStorage.getItem(SETTINGS_KEY);
  if (!trades && !settings) return false;
  try {
    const parsed = trades ? JSON.parse(trades) : [];
    return Boolean(settings || parsed.length);
  } catch {
    return true;
  }
}

async function offerLocalMigration(uidValue) {
  const key = `${MIGRATION_KEY_PREFIX}-${uidValue}`;
  if (localStorage.getItem(key) || !hasLocalDataToMigrate()) return;
  const importData = confirm("I found old data saved in this browser. Import it into this Firebase account?");
  localStorage.setItem(key, importData ? "imported" : "skipped");
  if (!importData) return;
  const localTrades = loadTrades().map(normalizeTrade);
  const localSettings = loadSettings();
  await writeCloudSnapshot(uidValue, localTrades, localSettings);
}

async function loadCloudData(uidValue) {
  suppressCloudSave = true;
  try {
    const [tradeSnap, backtestSnap, settingsSnap, consistencySnap] = await Promise.all([
      appDb.collection("users").doc(uidValue).collection("trades").get(),
      appDb.collection("users").doc(uidValue).collection("backtestRecords").get(),
      appDb.collection("users").doc(uidValue).collection("settings").doc("main").get(),
      appDb.collection("users").doc(uidValue).collection("consistency").doc("main").get()
    ]);
    const cloudTrades = [
      ...tradeSnap.docs.map((doc) => normalizeTrade({ id: doc.id, ...doc.data() })),
      ...backtestSnap.docs.map((doc) => normalizeTrade({ id: doc.id, ...doc.data(), tradeType: "Backtest Record" }))
    ];
    const cloudSettings = settingsSnap.exists ? sanitizeCloudSettings(settingsSnap.data()) : { ...defaultSettings };
    const consistency = consistencySnap.exists ? consistencySnap.data() : {};
    state.trades = cloudTrades.sort(byDate);
    state.settings = {
      ...defaultSettings,
      ...cloudSettings,
      consistencyCashTotal: Number(consistency.cashScore ?? cloudSettings.consistencyCashTotal ?? 0),
      consistencyLog: consistency.completedToday || cloudSettings.consistencyLog || {},
      lastResetDate: consistency.lastResetDate || cloudSettings.lastResetDate || ""
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trades));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } finally {
    suppressCloudSave = false;
  }
}

function sanitizeCloudSettings(settings = {}) {
  const { createdAt, updatedAt, ...rest } = settings;
  return rest;
}

function tradeDocData(trade) {
  return {
    date: trade.date,
    symbol: trade.symbol,
    tradeType: trade.tradeType,
    tradeStrategy: trade.setup,
    tradeStructure: trade.tradeStructure,
    setup: trade.setup,
    customStructure: trade.customStructure || "",
    side: trade.side,
    entryTime: trade.entryTime,
    pnl: Number(trade.net),
    netPnl: Number(trade.net),
    followedPlan: Boolean(trade.followedPlan),
    overtraded: Boolean(trade.overtraded),
    beforeEmotion: trade.emotionBefore,
    duringEmotion: trade.emotionDuring,
    afterEmotion: trade.emotionAfter,
    emotionBefore: trade.emotionBefore,
    emotionDuring: trade.emotionDuring,
    emotionAfter: trade.emotionAfter,
    screenshots: (trade.screenshots || []).map(cleanScreenshotMeta),
    screenshotName: trade.screenshots?.[0]?.screenshotName || "",
    screenshotNote: trade.screenshots?.[0]?.screenshotNote || "",
    uploadedAt: trade.screenshots?.[0]?.uploadedAt || "",
    notes: trade.notes || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function settingsDocData(settings) {
  const manualChecks = Object.fromEntries(manualMilestones().map((item) => [item.id, Boolean(settings[item.id])]));
  return {
    ...settings,
    darkMode: Boolean(settings.darkBackground),
    milestoneChecks: manualChecks,
    otherSettings: {
      customStructures: settings.customStructures || []
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function consistencyDocData(settings) {
  return {
    cashScore: consistencyScore(),
    lastResetDate: consistencyDayKey(),
    completedToday: settings.consistencyLog || {},
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function dashboardStatsDocData() {
  const real = scoringTrades(state.trades);
  const paper = paperTrades(state.trades);
  const realMetrics = metrics(real);
  const paperMetrics = metrics(paper);
  const realSeries = equitySeries(real, state.settings.startingBalance);
  const paperSeries = equitySeries(paper, state.settings.paperStartingBalance);
  return {
    main: {
      startingBalance: state.settings.startingBalance,
      currentBalance: realSeries.at(-1)?.balance ?? state.settings.startingBalance,
      totalPnl: realMetrics.net,
      winRate: realMetrics.winRate,
      totalTrades: real.length,
      maxDrawdown: maxDrawdown(realSeries, state.settings.startingBalance)
    },
    paper: {
      startingBalance: state.settings.paperStartingBalance,
      currentBalance: paperSeries.at(-1)?.balance ?? state.settings.paperStartingBalance,
      totalPnl: paperMetrics.net,
      winRate: paperMetrics.winRate,
      totalTrades: paper.length,
      maxDrawdown: maxDrawdown(paperSeries, state.settings.paperStartingBalance)
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

async function saveCloudData() {
  if (!cloudReady || suppressCloudSave || !currentUser || !appDb) return;
  try {
    const savedTrades = await writeCloudSnapshot(currentUser.uid, state.trades, state.settings);
    if (savedTrades) {
      suppressCloudSave = true;
      state.trades = savedTrades;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trades));
      suppressCloudSave = false;
    }
  } catch (error) {
    console.error(error);
    toast("Cloud save failed. Check Firebase setup or internet.");
  }
}

async function writeCloudSnapshot(uidValue, trades, settings) {
  const userRef = appDb.collection("users").doc(uidValue);
  const batch = appDb.batch();
  const existingTrades = await userRef.collection("trades").get();
  const existingBacktests = await userRef.collection("backtestRecords").get();
  const normalizedTrades = [];
  for (const trade of trades.map(normalizeTrade)) {
    trade.screenshots = (trade.screenshots || []).map(cleanScreenshotMeta);
    normalizedTrades.push(trade);
  }
  const tradeIds = new Set(normalizedTrades.filter((trade) => trade.tradeType !== "Backtest Record").map((trade) => trade.id));
  const backtestIds = new Set(normalizedTrades.filter((trade) => trade.tradeType === "Backtest Record").map((trade) => trade.id));
  existingTrades.docs.forEach((doc) => {
    if (!tradeIds.has(doc.id)) batch.delete(doc.ref);
  });
  existingBacktests.docs.forEach((doc) => {
    if (!backtestIds.has(doc.id)) batch.delete(doc.ref);
  });
  normalizedTrades.forEach((trade) => {
    const collection = trade.tradeType === "Backtest Record" ? "backtestRecords" : "trades";
    batch.set(userRef.collection(collection).doc(trade.id), tradeDocData(trade));
  });
  batch.set(userRef.collection("settings").doc("main"), settingsDocData(settings), { merge: true });
  batch.set(userRef.collection("consistency").doc("main"), consistencyDocData(settings), { merge: true });
  batch.set(userRef.collection("dashboardStats").doc("main"), dashboardStatsDocData(), { merge: true });
  rankedMilestones().forEach((milestone) => {
    batch.set(userRef.collection("milestones").doc(milestone.id), {
      name: milestone.label,
      diamonds: milestone.diamonds,
      completed: Boolean(milestone.done),
      completedAt: milestone.done ? firebase.firestore.FieldValue.serverTimestamp() : null,
      type: milestone.type,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
  return normalizedTrades;
}

function filteredTrades() {
  const sorted = [...state.trades].sort(byDate);
  if (state.range === "all") return sorted;
  const latest = new Date(sorted.at(-1)?.date || Date.now());
  const cutoff = new Date(latest);
  cutoff.setDate(cutoff.getDate() - Number(state.range) + 1);
  return sorted.filter((trade) => new Date(`${trade.date}T00:00`) >= cutoff);
}

function scoringTrades(trades = filteredTrades()) {
  return trades.filter((trade) => trade.tradeType !== "Paper Trading" && trade.tradeType !== "Backtest Record");
}

function paperTrades(trades = filteredTrades()) {
  return trades.filter((trade) => trade.tradeType === "Paper Trading");
}

function backtestTrades(trades = filteredTrades()) {
  return trades.filter((trade) => trade.tradeType === "Backtest Record");
}

function byDate(a, b) {
  return new Date(`${a.date}T${a.entryTime || "00:00"}`) - new Date(`${b.date}T${b.entryTime || "00:00"}`);
}

function money(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactMoney(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function groupBy(rows, keyFn) {
  return rows.reduce((groups, row) => {
    const key = keyFn(row);
    groups[key] ||= [];
    groups[key].push(row);
    return groups;
  }, {});
}

function metrics(trades = filteredTrades()) {
  const wins = trades.filter((trade) => trade.net > 0);
  const losses = trades.filter((trade) => trade.net < 0);
  const grossProfit = sum(wins, "net");
  const grossLoss = Math.abs(sum(losses, "net"));
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  return {
    trades,
    net: sum(trades, "net"),
    wins,
    losses,
    winRate: trades.length ? wins.length / trades.length : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? 99 : 0,
    avgWin,
    avgLoss,
    avgRr: avgLoss ? avgWin / avgLoss : 0,
    expectancy: trades.length ? sum(trades, "net") / trades.length : 0,
    disciplineScore: disciplineScore(trades)
  };
}

function disciplineScore(trades) {
  if (!trades.length) return 0;
  const total = trades.reduce((score, trade) => {
    let points = 0;
    if (trade.followedPlan) points += 55;
    if (!trade.overtraded) points += 15;
    points += 20;
    points += Math.max(0, 10 - (averageEmotion(trade) - 1) * 2.5);
    return score + points;
  }, 0);
  return Math.round(total / trades.length);
}

function averageEmotion(trade) {
  return (emotionScore(trade.emotionBefore) + emotionScore(trade.emotionDuring) + emotionScore(trade.emotionAfter)) / 3;
}

function emotionScore(value) {
  if (value === "Being A Pussy") return 5;
  if (value === "Anxious") return 4;
  return clamp(Number(value), 1, 5);
}

function emotionLabel(value) {
  if (value === "Anxious" || value === "Being A Pussy") return value;
  return `${value}/5`;
}

function dailySeries(trades = filteredTrades()) {
  const byDay = groupBy(trades, (trade) => trade.date);
  return Object.keys(byDay).sort().map((date) => ({
    date,
    trades: byDay[date],
    pnl: sum(byDay[date], "net")
  }));
}

function equitySeries(trades = filteredTrades(), startingBalance = state.settings.startingBalance) {
  let balance = startingBalance;
  return dailySeries(trades).map((day) => {
    balance += day.pnl;
    return { ...day, balance };
  });
}

function maxDrawdown(series, startingBalance = state.settings.startingBalance) {
  let peak = startingBalance;
  let drawdown = 0;
  series.forEach((point) => {
    peak = Math.max(peak, point.balance);
    drawdown = Math.min(drawdown, point.balance - peak);
  });
  return drawdown;
}

function render() {
  renderDashboard();
  renderPaperDashboard();
  renderCalendar();
  renderTrades();
  renderHistory();
  renderReports();
  renderMilestones();
  renderCoach();
  renderSettings();
}

function timeOptions() {
  const options = [];
  for (let minutes = 9 * 60; minutes <= 14 * 60 + 30; minutes += 5) {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = ((hour24 + 11) % 12) + 1;
    const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const label = `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
    options.push({ value, label });
  }
  return options;
}

function renderTimeDropdowns() {
  const html = `<option value="">Select time</option>${timeOptions().map((time) => `<option value="${time.value}">${time.label}</option>`).join("")}`;
  $("#tradeForm [name=entryTime]").innerHTML = html;
}

function structures() {
  return [...new Set([...baseStructures.filter((item) => item !== "Other"), ...(state.settings.customStructures || []), "Other"])];
}

function renderStructureDropdown(selected = "") {
  const select = $("#tradeForm [name=tradeStructure]");
  select.innerHTML = structures().map((item) => `<option value="${escapeAttr(item)}">${item}</option>`).join("");
  select.value = selected && structures().includes(selected) ? selected : select.value || "IFVG";
  toggleCustomStructure();
}

function toggleCustomStructure() {
  const isOther = $("#tradeForm [name=tradeStructure]").value === "Other";
  document.querySelector(".custom-structure-field").classList.toggle("hidden", !isOther);
}

function renderScreenshotPreview() {
  $("#screenshotPreview").innerHTML = state.pendingScreenshots.length ? state.pendingScreenshots.map((shot, index) => `
    <div class="preview-shot">
      <img src="${screenshotSrc(shot)}" alt="Selected trade screenshot ${index + 1}" />
      <span>${escapeHtml(shot.screenshotName || `Screenshot ${index + 1}`)}</span>
      <button class="tiny-button" type="button" data-remove-shot="${index}">Remove</button>
    </div>
  `).join("") : "";
}

function renderDashboard() {
  const allTrades = filteredTrades();
  const trades = scoringTrades(allTrades);
  const m = metrics(trades);
  const series = equitySeries(trades, state.settings.startingBalance);
  const currentBalance = series.at(-1)?.balance ?? state.settings.startingBalance;
  const best = [...trades].sort((a, b) => b.net - a.net)[0];
  const worst = [...trades].sort((a, b) => a.net - b.net)[0];
  const today = series.at(-1);
  const usedToday = today ? Math.max(0, -today.pnl) : 0;
  const remaining = state.settings.dailyLossLimit - usedToday;
  const lossPct = Math.min(100, usedToday / state.settings.dailyLossLimit * 100);

  $("#startingBalance").textContent = money(state.settings.startingBalance);
  $("#currentBalance").textContent = money(currentBalance);
  $("#totalPnl").textContent = money(m.net);
  $("#totalPnl").className = pnlClass(m.net);
  $("#winRateCard").textContent = percent(m.winRate);
  $("#winRateDetail").textContent = `${trades.length} trades, ${m.wins.length} wins, ${m.losses.length} losses`;
  $("#avgRrCard").textContent = `1 : ${m.avgRr.toFixed(1)}`;
  $("#maxDrawdownCard").textContent = money(maxDrawdown(series, state.settings.startingBalance));
  $("#maxDrawdownCard").className = "negative";
  $("#disciplineScoreCard").textContent = `${m.disciplineScore}%`;
  $("#disciplineDetail").textContent = `${trades.filter((t) => t.followedPlan).length}/${trades.length} followed plan`;
  $("#bestTradeCard").textContent = best ? compactMoney(best.net) : "$0";
  $("#bestTradeCard").className = "positive";
  $("#bestTradeDetail").textContent = best ? `${best.symbol} - ${best.setup}` : "No trades yet.";
  $("#worstTradeCard").textContent = worst ? compactMoney(worst.net) : "$0";
  $("#worstTradeCard").className = "negative";
  $("#worstTradeDetail").textContent = worst ? `${worst.symbol} - ${worst.setup}` : "No trades yet.";
  $("#lossLimitLabel").textContent = money(state.settings.dailyLossLimit);
  $("#usedToday").textContent = money(usedToday);
  $("#remainingToday").textContent = money(Math.max(0, remaining));
  $("#lossLimitBar").style.width = `${lossPct}%`;
  $("#lossLimitBar").className = lossPct >= 100 ? "danger" : lossPct >= 70 ? "warn" : "safe";
  $("#lossLimitStatus").textContent = lossPct >= 100 ? "Limit hit. Stop trading." : lossPct >= 70 ? "Close to limit. Reduce size or stop." : "Safe.";
  renderDailyVerse();

  renderEquityChart(series, "#equityChart", state.settings.startingBalance);
  renderHourly(trades, "#hourlyList");
  renderCalendarInto("#dashboardCalendarBoard", trades);
}

function renderDailyVerse() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((new Date() - start) / 86400000);
  const verse = dailyVersePrompts[day % dailyVersePrompts.length];
  $("#dailyVerseRef").textContent = verse.ref;
  $("#dailyVerseText").textContent = verse.text;
}

function renderPaperDashboard() {
  const trades = paperTrades(filteredTrades());
  const m = metrics(trades);
  const series = equitySeries(trades, state.settings.paperStartingBalance);
  const currentBalance = series.at(-1)?.balance ?? state.settings.paperStartingBalance;
  const best = [...trades].sort((a, b) => b.net - a.net)[0];
  const worst = [...trades].sort((a, b) => a.net - b.net)[0];

  $("#paperStartingBalance").textContent = money(state.settings.paperStartingBalance);
  $("#paperCurrentBalance").textContent = money(currentBalance);
  $("#paperTotalPnl").textContent = money(m.net);
  $("#paperTotalPnl").className = pnlClass(m.net);
  $("#paperTotalTrades").textContent = trades.length;
  $("#paperWins").textContent = m.wins.length;
  $("#paperLosses").textContent = m.losses.length;
  $("#paperWinRateCard").textContent = percent(m.winRate);
  $("#paperWinRateDetail").textContent = `${trades.length} paper trades, ${m.wins.length} wins, ${m.losses.length} losses`;
  $("#paperAvgRrCard").textContent = `1 : ${m.avgRr.toFixed(1)}`;
  $("#paperMaxDrawdownCard").textContent = money(maxDrawdown(series, state.settings.paperStartingBalance));
  $("#paperMaxDrawdownCard").className = "negative";
  $("#paperDisciplineScoreCard").textContent = `${m.disciplineScore}%`;
  $("#paperDisciplineDetail").textContent = `${trades.filter((trade) => trade.followedPlan).length}/${trades.length} followed plan`;
  $("#paperBestTradeCard").textContent = best ? compactMoney(best.net) : "$0";
  $("#paperBestTradeCard").className = "positive";
  $("#paperBestTradeDetail").textContent = best ? `${best.symbol} - ${best.setup}` : "No paper trades yet.";
  $("#paperWorstTradeCard").textContent = worst ? compactMoney(worst.net) : "$0";
  $("#paperWorstTradeCard").className = "negative";
  $("#paperWorstTradeDetail").textContent = worst ? `${worst.symbol} - ${worst.setup}` : "No paper trades yet.";

  renderEquityChart(series, "#paperEquityChart", state.settings.paperStartingBalance);
  renderRecentTrades(trades, "#paperRecentTrades");
  renderHourly(trades, "#paperHourlyList");
  renderCalendarInto("#paperCalendarBoard", trades);
}

function renderEquityChart(series, targetSelector = "#equityChart", startingBalance = state.settings.startingBalance) {
  const svg = $(targetSelector);
  const width = 900;
  const height = 260;
  const pad = 28;
  if (!series.length) {
    svg.innerHTML = `<text x="450" y="130" text-anchor="middle">No equity data yet</text>`;
    return;
  }
  const balances = [startingBalance, ...series.map((p) => p.balance)];
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = max - min || 1;
  const points = series.map((point, i) => {
    const x = pad + (i / Math.max(series.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((point.balance - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const zeroY = height - pad - ((startingBalance - min) / span) * (height - pad * 2);
  svg.innerHTML = `
    <line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" class="chart-zero"></line>
    <polyline points="${points}" class="chart-line"></polyline>
    ${series.map((point, i) => {
      const [x, y] = points.split(" ")[i].split(",");
      return `<circle cx="${x}" cy="${y}" r="4" class="${point.pnl >= 0 ? "dot-win" : "dot-loss"}"></circle>`;
    }).join("")}
    <text x="${pad}" y="18" class="chart-label">${money(max)}</text>
    <text x="${pad}" y="${height - 6}" class="chart-label">${money(min)}</text>
  `;
}

function renderRecentTrades(trades, targetSelector = "#recentTrades") {
  const rows = [...trades].sort((a, b) => state.recentAsc ? byDate(a, b) : byDate(b, a)).slice(0, 3);
  $(targetSelector).innerHTML = rows.map((trade) => `
    <article class="recent-card">
      <time>${formatDateTime(trade)}</time>
      <div class="recent-bottom">
        <div><strong>${trade.symbol}</strong><span>${trade.tradeType}</span></div>
        <div class="${pnlClass(trade.net)}">${money(trade.net)}</div>
      </div>
      <p>${trade.setup}</p>
    </article>
  `).join("");
}

function renderHourly(trades, targetSelector = "#hourlyList") {
  const groups = tradingWindows().map((window) => {
    const rows = trades.filter((trade) => {
      const minutes = timeToMinutes(trade.entryTime);
      return minutes >= window.start && minutes < window.end;
    });
    return {
      label: window.label,
      pnl: sum(rows, "net"),
      count: rows.length
    };
  });
  const max = Math.max(...groups.map((g) => Math.abs(g.pnl)), 1);
  $(targetSelector).innerHTML = groups.map((group) => `
    <div class="hour-row">
      <span>${group.label}</span>
      <span class="bar"><span style="--w:${Math.abs(group.pnl) / max * 100}%;--c:${group.pnl >= 0 ? "var(--green)" : "var(--red)"}"></span></span>
      <strong class="${pnlClass(group.pnl)}">${money(group.pnl)}</strong>
    </div>
  `).join("");
}

function tradingWindows() {
  const windows = [];
  for (let start = 9 * 60 + 30; start <= 11 * 60 + 30; start += 30) {
    windows.push({
      start,
      end: start + 30,
      label: formatMinutes(start)
    });
  }
  return windows;
}

function timeToMinutes(value) {
  if (!value) return -1;
  const [hourText, minuteText] = value.split(":");
  return Number(hourText) * 60 + Number(minuteText || 0);
}

function formatMinutes(minutes) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function renderCalendar() {
  renderCalendarInto("#calendarBoard", filteredTrades());
}

function renderCalendarInto(targetSelector, trades) {
  const days = dailySeries(trades);
  const byDay = Object.fromEntries(days.map((day) => [day.date, day]));
  const latest = new Date(`${trades.at(-1)?.date || isoDate(new Date())}T00:00`);
  const start = new Date(latest.getFullYear(), latest.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  const maxWin = Math.max(...days.filter((day) => day.pnl > 0).map((day) => day.pnl), 1);
  const maxLoss = Math.max(...days.filter((day) => day.pnl < 0).map((day) => Math.abs(day.pnl)), 1);
  if (targetSelector === "#calendarBoard") {
    $("#calendarSummary").textContent = `${trades.length} trades, ${money(sum(trades, "net"))} net`;
  }
  $(targetSelector).innerHTML = Array.from({ length: 35 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = isoDate(date);
    const day = byDay[key];
    const isWin = day && day.pnl > 0;
    const isLoss = day && day.pnl < 0;
    const intensity = isWin ? 0.1 + Math.min(0.38, day.pnl / maxWin * 0.38) : isLoss ? 0.1 + Math.min(0.38, Math.abs(day.pnl) / maxLoss * 0.38) : 0;
    const cls = isWin ? "heat-win" : isLoss ? "heat-loss" : "heat-empty";
    return `<article class="calendar-cell ${cls}" style="--heat:${intensity}">
      <strong>${date.getDate()}</strong>
      <span>${day ? money(day.pnl) : "$0"}</span>
      <small>${day ? `${day.trades.length} trades` : "No trades"}</small>
    </article>`;
  }).join("");
}

function renderTrades() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const rows = filteredTrades().filter((trade) => `${trade.symbol} ${trade.setup} ${trade.tradeType} ${trade.notes}`.toLowerCase().includes(query)).sort((a, b) => byDate(b, a));
  $("#tradeRows").innerHTML = rows.map((trade) => `
    <tr>
      <td>${trade.date}</td>
      <td><strong>${trade.symbol}</strong></td>
      <td><span class="trade-type ${tradeTypeClass(trade.tradeType)}">${trade.tradeType}</span></td>
      <td>${trade.setup}</td>
      <td>${trade.side}</td>
      <td class="${pnlClass(trade.net)}">${money(trade.net)}</td>
      <td>${trade.followedPlan ? "Yes" : "No"}</td>
      <td class="row-actions"><button class="tiny-button" type="button" data-edit="${trade.id}">Edit</button><button class="delete-button" type="button" data-delete="${trade.id}">Delete</button></td>
    </tr>
  `).join("");
}

function renderHistory() {
  const source = state.historyFilter === "backtest" ? backtestTrades(filteredTrades()) : filteredTrades().filter((trade) => trade.tradeType !== "Backtest Record");
  const rows = source.sort((a, b) => byDate(b, a));
  $$("[data-history-filter]").forEach((button) => button.classList.toggle("active", button.dataset.historyFilter === state.historyFilter));
  $("#historyList").innerHTML = rows.length ? rows.map((trade) => `
    <article class="history-card">
      <div class="history-main">
        <div class="history-top">
          <strong>${trade.date} - ${trade.symbol}</strong>
          <span class="${pnlClass(trade.net)}">${money(trade.net)}</span>
        </div>
        <div class="history-session-line">
          <span>Start: ${formatTradeTime(trade.entryTime)}</span>
          <strong class="${pnlClass(trade.net)}">P/L: ${money(trade.net)}</strong>
        </div>
        <div class="history-meta">
          <span>${trade.tradeType}</span>
          <span>${trade.setup}</span>
          <span>Plan: ${trade.followedPlan ? "Yes" : "No"}</span>
          <span>Before Emotion: ${emotionLabel(trade.emotionBefore)}</span>
          <span>During Emotion: ${emotionLabel(trade.emotionDuring)}</span>
          <span>After Emotion: ${emotionLabel(trade.emotionAfter)}</span>
        </div>
        <label class="history-notes-label">Journal Notes
          <textarea class="history-note-editor" data-note-editor="${trade.id}" rows="4">${escapeHtml(trade.notes || "")}</textarea>
        </label>
        <button class="tiny-button" type="button" data-save-note="${trade.id}">Update notes</button>
      </div>
      <div class="history-shots">
        ${trade.screenshots.length ? trade.screenshots.map((shot) => `<div class="shot-file-name"><strong>${escapeHtml(shot.screenshotName || "Screenshot")}</strong><span>${escapeHtml(shot.screenshotNote || "Image preview is local only. Cloud image storage is disabled.")}</span></div>`).join("") : `<div class="empty-shot">No screenshot</div>`}
      </div>
    </article>
  `).join("") : `<div class="empty-state">${state.historyFilter === "backtest" ? "No backtest records yet." : "No journal entries yet."}</div>`;
}

function renderReports() {
  const trades = scoringTrades(filteredTrades());
  const m = metrics(trades);
  $("#reportMetrics").innerHTML = [
    ["Net P/L", money(m.net), pnlClass(m.net)],
    ["Trades", trades.length, ""],
    ["Win Rate", percent(m.winRate), ""],
    ["Profit Factor", m.profitFactor.toFixed(2), ""],
    ["Expectancy", money(m.expectancy), pnlClass(m.expectancy)],
    ["Discipline", `${m.disciplineScore}%`, ""]
  ].map(([label, value, cls]) => `<div class="report-tile"><span>${label}</span><strong class="${cls}">${value}</strong></div>`).join("");

  const setupRows = Object.entries(groupBy(trades, (trade) => trade.setup)).map(([setup, rows]) => {
    const wins = rows.filter((row) => row.net > 0);
    const losses = rows.filter((row) => row.net < 0);
    return {
      setup,
      trades: rows.length,
      winRate: rows.length ? wins.length / rows.length : 0,
      avgWin: wins.length ? sum(wins, "net") / wins.length : 0,
      avgLoss: losses.length ? Math.abs(sum(losses, "net")) / losses.length : 0,
      pnl: sum(rows, "net")
    };
  }).sort((a, b) => b.pnl - a.pnl);
  $("#setupBreakdown").innerHTML = setupRows.map((row) => `
    <tr><td>${row.setup}</td><td>${row.trades}</td><td>${percent(row.winRate)}</td><td>${money(row.avgWin)}</td><td>${money(row.avgLoss)}</td><td class="${pnlClass(row.pnl)}">${money(row.pnl)}</td></tr>
  `).join("");

  const watch = [
    ["Plan breaks", trades.filter((trade) => !trade.followedPlan)],
    ["Overtrading", trades.filter((trade) => trade.overtraded)],
    ["High emotion", trades.filter((trade) => averageEmotion(trade) >= 4)]
  ];
  $("#watchList").innerHTML = watch.map(([label, rows]) => `<div class="watch-item"><strong>${label}</strong><span>${rows.length} trades</span><div class="${pnlClass(sum(rows, "net"))}">${money(sum(rows, "net"))}</div></div>`).join("");
}

function monthProfit(trades) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return sum(trades.filter((trade) => {
    const date = new Date(`${trade.date}T00:00`);
    return date.getMonth() === month && date.getFullYear() === year;
  }), "net");
}

function milestoneDefinitions() {
  const monthlyProfit = monthProfit(scoringTrades(state.trades));
  return [
    { id: "propFirmPassed", label: "Pass Challenge", diamonds: 1, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "getPayout", label: "Payout", diamonds: 1, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "getMaxAllocationFunded", label: "Max Allocation", diamonds: 2, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "copyTrade5Accounts", label: "Copy Trade 5", diamonds: 2, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "copyTrade20Accounts", label: "Copy Trade 20", diamonds: 3, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "consistentPayouts", label: "3 Month Consistent Payout", diamonds: 3, type: "manual", detail: "At least 1 payout per month for 3 months in a row." },
    { id: "month10k", label: "10k/M", diamonds: 4, type: "auto", done: monthlyProfit >= 10000, detail: `This month: ${money(monthlyProfit)} from Demo and Live trades.` },
    { id: "quitJob", label: "Quit Job", diamonds: 6, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "corvette", label: "Buy A Corvette", diamonds: 6, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "month25k", label: "25k/M", diamonds: 7, type: "auto", done: monthlyProfit >= 25000, detail: `This month: ${money(monthlyProfit)} from Demo and Live trades.` },
    { id: "buyDadCar", label: "Buy Dad A Car", diamonds: 7, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "month100k", label: "100k/M", diamonds: 10, type: "auto", done: monthlyProfit >= 100000, detail: `This month: ${money(monthlyProfit)} from Demo and Live trades.` },
    { id: "svjGt3", label: "Get SVJ", diamonds: 10, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "penthouse", label: "Get Penthouse", diamonds: 10, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "generationalWealth", label: "Generational Wealth", diamonds: 15, type: "manual", detail: "Manual checkbox in Settings." },
    { id: "retireParents", label: "Retire Parents", diamonds: 15, type: "manual", detail: "Manual checkbox in Settings." }
  ];
}

function manualMilestones() {
  return milestoneDefinitions().filter((item) => item.type === "manual");
}

function rankedMilestones() {
  return milestoneDefinitions().map((item) => ({
    ...item,
    done: item.type === "auto" ? item.done : Boolean(state.settings[item.id])
  }));
}

function diamondText(count) {
  return "💎".repeat(count);
}

function consistencyScore() {
  if (state.settings.consistencyCashTotal !== null && state.settings.consistencyCashTotal !== undefined && Number.isFinite(Number(state.settings.consistencyCashTotal))) {
    return Number(state.settings.consistencyCashTotal);
  }
  const log = state.settings.consistencyLog || {};
  return Object.values(log).reduce((total, day) => total + Object.values(day || {}).filter(Boolean).length, 0);
}

function consistencyDayKey(date = new Date()) {
  const reset = new Date(date);
  reset.setHours(9, 30, 0, 0);
  const tradingDay = date < reset ? new Date(date.getTime() - 24 * 60 * 60 * 1000) : date;
  return localDateKey(tradingDay);
}

function renderMilestones() {
  const items = rankedMilestones();
  const earnedDiamonds = items.filter((item) => item.done).reduce((total, item) => total + item.diamonds, 0);
  const today = consistencyDayKey();
  const todayLog = state.settings.consistencyLog?.[today] || {};
  $("#diamondCounter").textContent = `${earnedDiamonds} 💎`;
  $("#cashCounter").textContent = `${consistencyScore()} 💵`;
  $("#consistencyActions").innerHTML = consistencyMilestones.map((item) => {
    const done = Boolean(todayLog[item.id]);
    return `<button class="consistency-button ${done ? "done" : ""}" type="button" data-consistency="${item.id}" ${done ? "disabled" : ""}>
      <span>${item.label}</span>
      <strong>${done ? "Banked 💵" : "+1 💵"}</strong>
    </button>`;
  }).join("");
  const html = items.map((item) => `
    <article class="milestone-card ${item.done ? "done" : ""}">
      <div>
        <strong>${item.label}</strong>
        <p>${item.detail}</p>
      </div>
      <div class="milestone-status">
        <span class="diamond-rank">${diamondText(item.diamonds)} ${item.diamonds}</span>
        <span>${item.done ? "Complete" : "Incomplete"}</span>
      </div>
    </article>
  `).join("");
  $("#milestoneGrid").innerHTML = html;
  $("#sidebarMilestones").innerHTML = items.map((item) => `<div class="mini-milestone ${item.done ? "done" : ""}"><span></span><strong>${diamondText(item.diamonds)}</strong> ${item.label}</div>`).join("");
}

function bestDayText(days, target) {
  const best = [...days].sort((a, b) => b.pnl - a.pnl)[0];
  if (!best) return `Target: ${money(target)}`;
  return `Best day: ${money(best.pnl)} on ${best.date}`;
}

function renderCoach() {
  const trades = scoringTrades(filteredTrades());
  const m = metrics(trades);
  const badDiscipline = trades.filter((trade) => !trade.followedPlan || trade.overtraded);
  const biggestLoss = [...trades].sort((a, b) => a.net - b.net)[0];
  const notes = [
    ["Discipline", `${m.disciplineScore}% score. ${badDiscipline.length} trades need review for plan breaks or overtrading.`],
    ["Risk", `Max drawdown is ${money(maxDrawdown(equitySeries(trades, state.settings.startingBalance), state.settings.startingBalance))}. Keep the daily stop visible before each session.`],
    ["Review", biggestLoss ? `Worst trade: ${biggestLoss.symbol} ${money(biggestLoss.net)}. Review its note and screenshot before the next session.` : "Add trades to see review prompts."]
  ];
  $("#coachNotes").innerHTML = notes.map(([title, body]) => `<div class="coach-note"><strong>${title}</strong><p>${body}</p></div>`).join("");
}

function renderSettings() {
  document.body.classList.toggle("dark-background", Boolean(state.settings.darkBackground));
  $("#settingsForm [name=startingBalance]").value = state.settings.startingBalance;
  $("#settingsForm [name=paperStartingBalance]").value = state.settings.paperStartingBalance;
  $("#settingsForm [name=darkBackground]").checked = Boolean(state.settings.darkBackground);
  $("#settingsMilestones").innerHTML = rankedMilestones().map((item) => `
    <label class="check-row milestone-check ${item.type === "auto" ? "auto" : ""}">
      ${item.type === "auto" ? `<input type="checkbox" ${item.done ? "checked" : ""} disabled />` : `<input name="${item.id}" type="checkbox" ${state.settings[item.id] ? "checked" : ""} />`}
      <span>${item.label}</span>
      <strong>${diamondText(item.diamonds)} ${item.diamonds}</strong>
    </label>
  `).join("");
}

function switchView(view) {
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === `${view}View`));
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.body.classList.remove("mobile-nav-open");
  const titles = {
    dashboard: ["Dashboard", "Performance, risk, and discipline at a glance."],
    calendar: ["Calendar", "Daily P/L heatmap and trade count."],
    trades: ["Trades", "Search, edit, export, or delete records."],
    journal: ["Journal", "Create or edit a trade entry."],
    history: ["Journal History", "Look back at notes, screenshots, and plan discipline."],
    reports: ["Reports", "Setup performance and rule-break analysis."],
    milestones: ["Milestones", "Progress toward trading goals."],
    settings: ["Settings", "Track manual milestone completion."],
    paper: ["Paper Dashboard", "Practice results only. Paper trades do not affect the main dashboard."]
  };
  $("#viewTitle").textContent = titles[view][0];
  $("#viewSubtitle").textContent = titles[view][1];
}

function clearForm() {
  $("#tradeForm").reset();
  $("#tradeForm [name=id]").value = "";
  $("#tradeForm [name=date]").value = isoDate(new Date());
  $("#journalHeading").textContent = "New trade";
  state.pendingScreenshots = [];
  $("#screenshotPreview").innerHTML = "";
  renderStructureDropdown("IFVG");
}

function fillForm(trade) {
  const form = $("#tradeForm");
  renderStructureDropdown(trade.tradeStructure);
  for (const key of ["id", "date", "symbol", "tradeType", "side", "entryTime", "netPnl", "emotionBefore", "emotionDuring", "emotionAfter", "notes", "customStructure"]) {
    if (form.elements[key]) form.elements[key].value = trade[key] ?? "";
  }
  if (form.elements.netPnl) form.elements.netPnl.value = trade.net;
  if (structures().includes(trade.tradeStructure)) {
    form.elements.tradeStructure.value = trade.tradeStructure;
  } else {
    form.elements.tradeStructure.value = "Other";
    form.elements.customStructure.value = trade.tradeStructure;
  }
  toggleCustomStructure();
  form.elements.followedPlan.value = String(trade.followedPlan);
  form.elements.overtraded.value = String(trade.overtraded);
  state.pendingScreenshots = [...trade.screenshots].map(normalizeScreenshot).filter(Boolean);
  renderScreenshotPreview();
  $("#journalHeading").textContent = "Edit trade";
  switchView("journal");
}

async function screenshotsFromInput(input) {
  const files = [...(input.files || [])];
  if (!files.length) return [...state.pendingScreenshots];
  const loaded = files.map((file, index) => ({
    screenshotName: file.name || `screenshot-${index + 1}.png`,
    screenshotUrl: "",
    uploadedAt: "",
    file,
    previewUrl: URL.createObjectURL(file)
  }));
  return [...state.pendingScreenshots, ...loaded];
}

function formTradePayload(form, screenshots) {
  const structureValue = form.get("tradeStructure");
  const custom = String(form.get("customStructure") || "").trim();
  const resolvedStructure = structureValue === "Other" && custom ? custom : structureValue;
  if (custom && !state.settings.customStructures.includes(custom)) {
    state.settings.customStructures.push(custom);
    saveSettings();
  }
  return normalizeTrade({
    id: form.get("id") || undefined,
    date: form.get("date"),
    symbol: form.get("symbol"),
    tradeType: form.get("tradeType"),
    setup: resolvedStructure,
    tradeStructure: resolvedStructure,
    customStructure: structureValue === "Other" ? custom : "",
    side: form.get("side"),
    entryTime: form.get("entryTime"),
    netPnl: form.get("netPnl"),
    emotionBefore: form.get("emotionBefore"),
    emotionDuring: form.get("emotionDuring"),
    emotionAfter: form.get("emotionAfter"),
    followedPlan: form.get("followedPlan"),
    overtraded: form.get("overtraded"),
    notes: form.get("notes"),
    screenshots
  });
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).map(splitCsvLine);
  const headers = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.map((row) => {
    const item = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    return normalizeTrade({
      date: item.date,
      symbol: item.symbol,
      tradeType: item.tradetype || item["trade type"],
      setup: item.structure || item.tradestructure || item["trade structure"] || item.setup || item.strategy || item["strategy / setup"],
      tradeStructure: item.structure || item.tradestructure || item["trade structure"] || item.setup || item.strategy || item["strategy / setup"],
      side: item.side || item.direction,
      entryTime: item.entrytime || item["entry time"],
      entry: item.entry || item["entry price"],
      netPnl: item.netpnl || item["net p/l"] || item.pnl || item["p/l"],
      exit: item.exit || item["exit price"],
      qty: item.qty || item.shares || item.quantity,
      fees: item.fees,
      stop: item.stop || item["stop loss"] || item["stop loss price"],
      emotionBefore: item.emotionbefore || item["emotion before"] || item["before emotion"] || item.emotionlevel || item["emotion level"],
      emotionDuring: item.emotionduring || item["emotion during"] || item["during emotion"] || item.emotionlevel || item["emotion level"],
      emotionAfter: item.emotionafter || item["emotion after"] || item["after emotion"] || item.emotionlevel || item["emotion level"],
      followedPlan: item.followedplan || item["followed plan"],
      overtraded: item.overtraded,
      notes: item.notes || item["journal notes"]
    });
  }).filter((trade) => trade.date && trade.symbol);
}

function splitCsvLine(line) {
  const out = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  out.push(cell);
  return out;
}

function exportCsv() {
  const headers = ["date", "symbol", "tradeType", "tradeStructure", "setup", "side", "entryTime", "netPnl", "emotionBefore", "emotionDuring", "emotionAfter", "followedPlan", "overtraded", "notes"];
  const lines = [headers.join(",")].concat(state.trades.map((trade) => headers.map((header) => csvValue(trade[header])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trades.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function exportAiReportFile() {
  const all = [...state.trades].sort(byDate);
  const real = scoringTrades(all);
  const m = metrics(real);
  const series = equitySeries(real, state.settings.startingBalance);
  const currentBalance = series.at(-1)?.balance ?? state.settings.startingBalance;
  const best = [...real].sort((a, b) => b.net - a.net)[0];
  const worst = [...real].sort((a, b) => a.net - b.net)[0];
  const strategyRows = strategyReportRows(real);
  const disciplined = real.filter((trade) => trade.followedPlan && !trade.overtraded);
  const undisciplined = real.filter((trade) => !trade.followedPlan || trade.overtraded);
  const highEmotionTrades = real.filter((trade) => averageEmotion(trade) >= 4);
  const monthly = currentMonthReport(real);
  const timeRows = tradingWindows().map((window) => {
    const rows = real.filter((trade) => {
      const minutes = timeToMinutes(trade.entryTime);
      return minutes >= window.start && minutes < window.end;
    });
    return { label: window.label, trades: rows.length, pnl: sum(rows, "net") };
  });
  const bestTimes = [...timeRows].filter((row) => row.trades).sort((a, b) => b.pnl - a.pnl).slice(0, 3);
  const worstTimes = [...timeRows].filter((row) => row.trades).sort((a, b) => a.pnl - b.pnl).slice(0, 3);
  const lines = [
    "# Trading Journal AI Analysis Report",
    "",
    "Use this clean trading report to analyze performance, discipline, strategy quality, emotional patterns, timing, and improvement priorities.",
    "",
    "Scope: Account summary and dashboard-style stats use Demo + Live trades only. Trade Data includes Paper, Demo, and Live trades so practice behavior can still be reviewed separately.",
    "",
    "## Account Summary",
    "",
    `- Starting balance: ${money(state.settings.startingBalance)}`,
    `- Current balance: ${money(currentBalance)}`,
    `- Total P&L: ${money(m.net)}`,
    `- Win rate: ${percent(m.winRate)}`,
    `- Total trades: ${real.length}`,
    `- Average R:R: 1 : ${m.avgRr.toFixed(1)}`,
    `- Max drawdown: ${money(maxDrawdown(series, state.settings.startingBalance))}`,
    `- Best trade: ${best ? `${best.date} ${best.symbol} ${best.setup} ${money(best.net)}` : "None"}`,
    `- Worst trade: ${worst ? `${worst.date} ${worst.symbol} ${worst.setup} ${money(worst.net)}` : "None"}`,
    "",
    "## Trade Data",
    "",
    "| # | Date | Symbol | Trade Type | Trade Strategy | Side | Entry Time | P&L | Followed Plan | Overtraded | Before Emotion LVL | During Emotion LVL | After Emotion LVL | Journal Notes |",
    "|---:|---|---|---|---|---|---|---:|---|---|---|---|---|---|",
    ...all.map((trade, index) => [
      index + 1,
      trade.date,
      trade.symbol,
      trade.tradeType,
      trade.setup,
      trade.side,
      trade.entryTime || "",
      money(trade.net),
      trade.followedPlan ? "Yes" : "No",
      trade.overtraded ? "Yes" : "No",
      emotionLabel(trade.emotionBefore),
      emotionLabel(trade.emotionDuring),
      emotionLabel(trade.emotionAfter),
      (trade.notes || "").replace(/\n/g, " ")
    ].map(markdownCell).join("|").replace(/^/, "|").replace(/$/, "|")),
    "",
    "## Strategy Breakdown",
    "",
    "| Strategy | Trades | Win Rate | Total P&L | Average Win | Average Loss |",
    "|---|---:|---:|---:|---:|---:|",
    ...strategyRows.map((row) => [row.setup, row.trades, percent(row.winRate), money(row.pnl), money(row.avgWin), money(row.avgLoss)].map(markdownCell).join("|").replace(/^/, "|").replace(/$/, "|")),
    "",
    `- Strategies working best: ${strategyRows.filter((row) => row.pnl > 0).slice(0, 3).map((row) => `${row.setup} (${money(row.pnl)})`).join(", ") || "None yet"}`,
    `- Strategies losing money: ${strategyRows.filter((row) => row.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 3).map((row) => `${row.setup} (${money(row.pnl)})`).join(", ") || "None yet"}`,
    "",
    "## Discipline Review",
    "",
    `- Trades where I followed my plan: ${real.filter((trade) => trade.followedPlan).length}`,
    `- Trades where I did not follow my plan: ${real.filter((trade) => !trade.followedPlan).length}`,
    `- Number of overtrades: ${real.filter((trade) => trade.overtraded).length}`,
    `- P&L from disciplined trades: ${money(sum(disciplined, "net"))}`,
    `- P&L from undisciplined trades: ${money(sum(undisciplined, "net"))}`,
    "",
    "## Emotion Review",
    "",
    `- Average before-trade emotion level: ${averageEmotionField(real, "emotionBefore").toFixed(2)}`,
    `- Average during-trade emotion level: ${averageEmotionField(real, "emotionDuring").toFixed(2)}`,
    `- Average after-trade emotion level: ${averageEmotionField(real, "emotionAfter").toFixed(2)}`,
    `- P&L from high-emotion trades: ${money(sum(highEmotionTrades, "net"))}`,
    `- High-emotion losing trades: ${highEmotionTrades.filter((trade) => trade.net < 0).length}`,
    `- High-emotion winning trades: ${highEmotionTrades.filter((trade) => trade.net > 0).length}`,
    "",
    "## Time Performance",
    "",
    `- Best trading times based on P&L: ${bestTimes.map((row) => `${row.label} (${money(row.pnl)})`).join(", ") || "None yet"}`,
    `- Worst trading times based on P&L: ${worstTimes.map((row) => `${row.label} (${money(row.pnl)})`).join(", ") || "None yet"}`,
    "",
    "| 30-Minute Window | Trades | P&L |",
    "|---|---:|---:|",
    ...timeRows.map((row) => [row.label, row.trades, money(row.pnl)].map(markdownCell).join("|").replace(/^/, "|").replace(/$/, "|")),
    "",
    "## Monthly Performance",
    "",
    `- Total P&L for the month: ${money(monthly.pnl)}`,
    `- Best day of the month: ${monthly.bestDay ? `${monthly.bestDay.date} ${money(monthly.bestDay.pnl)}` : "None"}`,
    `- Worst day of the month: ${monthly.worstDay ? `${monthly.worstDay.date} ${money(monthly.worstDay.pnl)}` : "None"}`,
    `- Number of green days: ${monthly.greenDays}`,
    `- Number of red days: ${monthly.redDays}`,
    "",
    "## AI Summary Section",
    "",
    "Please analyze the report above and answer these:",
    "",
    "1. Main strengths",
    "2. Main weaknesses",
    "3. Biggest mistakes",
    "4. Best setups",
    "5. Worst setups",
    "6. What I should focus on improving next"
  ];
  downloadTextFile("trading_journal_ai_report.md", lines.join("\n"), "text/markdown");
}

function markdownCell(value) {
  return ` ${String(value ?? "").replaceAll("|", "/")} `;
}

function strategyReportRows(trades) {
  return Object.entries(groupBy(trades, (trade) => trade.setup)).map(([setup, rows]) => {
    const wins = rows.filter((trade) => trade.net > 0);
    const losses = rows.filter((trade) => trade.net < 0);
    return {
      setup,
      trades: rows.length,
      winRate: rows.length ? wins.length / rows.length : 0,
      pnl: sum(rows, "net"),
      avgWin: wins.length ? sum(wins, "net") / wins.length : 0,
      avgLoss: losses.length ? Math.abs(sum(losses, "net")) / losses.length : 0
    };
  }).sort((a, b) => b.pnl - a.pnl);
}

function averageEmotionField(trades, key) {
  if (!trades.length) return 0;
  return trades.reduce((total, trade) => total + emotionScore(trade[key]), 0) / trades.length;
}

function currentMonthReport(trades) {
  const now = new Date();
  const monthTrades = trades.filter((trade) => {
    const date = new Date(`${trade.date}T00:00`);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const days = dailySeries(monthTrades);
  return {
    pnl: sum(monthTrades, "net"),
    bestDay: [...days].sort((a, b) => b.pnl - a.pnl)[0],
    worstDay: [...days].sort((a, b) => a.pnl - b.pnl)[0],
    greenDays: days.filter((day) => day.pnl > 0).length,
    redDays: days.filter((day) => day.pnl < 0).length
  };
}

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pnlClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function tradeTypeClass(type) {
  if (type === "Demo Trading") return "demo";
  if (type === "Live Trading") return "live";
  if (type === "Backtest Record") return "backtest";
  return "paper";
}

function formatDateTime(trade) {
  const date = new Date(`${trade.date}T${trade.entryTime || "00:00"}`);
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}${trade.entryTime ? ` ${trade.entryTime}` : ""}`;
}

function formatTradeTime(value) {
  if (!value) return "Not set";
  const [hourText, minuteText] = value.split(":");
  const hour24 = Number(hourText);
  const minute = Number(minuteText || 0);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showAuthError(error) {
  const message = authErrorMessage(error);
  $("#authError").textContent = message;
}

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("auth/email-already-in-use")) return "That email already has an account. Try logging in.";
  if (code.includes("auth/invalid-email")) return "Enter a valid email address.";
  if (code.includes("auth/weak-password")) return "Password is too weak. Use at least 6 characters.";
  if (code.includes("auth/wrong-password") || code.includes("auth/invalid-credential")) return "Wrong email or password.";
  if (code.includes("auth/user-not-found")) return "No account found with that email.";
  if (code.includes("permission-denied")) return "Firebase blocked this read/write. Check your Firestore security rules.";
  return error?.message || "Something went wrong. Try again.";
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = authMode === "signup";
  $("#authTitle").textContent = isSignup ? "Create account" : "Log in";
  $("#authSubtitle").textContent = isSignup ? "Create an account so your trading journal saves across devices." : "Sign in to load your trades, milestones, settings, and scores from the cloud.";
  $("#authSubmit").textContent = isSignup ? "Sign up" : "Log in";
  $("#authModeToggle").textContent = isSignup ? "Already have an account? Log in" : "Need an account? Sign up";
  $("#authForm [name=password]").autocomplete = isSignup ? "new-password" : "current-password";
  $("#authError").textContent = "";
}

function toast(message) {
  const old = $(".toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2400);
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) switchView(viewButton.dataset.view);

  const rangeButton = event.target.closest("[data-range]");
  if (rangeButton) {
    state.range = rangeButton.dataset.range;
    $("[data-range].active")?.classList.remove("active");
    rangeButton.classList.add("active");
    render();
  }

  const historyFilter = event.target.closest("[data-history-filter]")?.dataset.historyFilter;
  if (historyFilter) {
    state.historyFilter = historyFilter;
    renderHistory();
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "import") $("#csvFile").click();
  if (action === "toggle-mobile-menu") document.body.classList.toggle("mobile-nav-open");
  if (action === "sort-recent") {
    state.recentAsc = !state.recentAsc;
    renderRecentTrades(paperTrades(filteredTrades()), "#paperRecentTrades");
  }
  if (action === "export") exportCsv();
  if (action === "export-ai") exportAiReportFile();
  if (action === "save-all") {
    saveTrades();
    saveSettings();
    toast("Saved");
  }
  if (action === "logout" && appAuth) {
    state.trades = [];
    state.settings = { ...defaultSettings };
    state.pendingScreenshots = [];
    cloudReady = false;
    appAuth.signOut();
  }
  if (action === "clear-form") clearForm();
  if (action === "close-lightbox") {
    $("#imageLightbox").classList.add("hidden");
    $("#lightboxImage").src = "";
  }

  const consistencyId = event.target.closest("[data-consistency]")?.dataset.consistency;
  if (consistencyId) {
    const today = consistencyDayKey();
    state.settings.consistencyLog ||= {};
    state.settings.consistencyLog[today] ||= {};
    if (!state.settings.consistencyLog[today][consistencyId]) {
      state.settings.consistencyLog[today][consistencyId] = true;
      state.settings.consistencyCashTotal = consistencyScore() + 1;
      saveSettings();
      render();
      toast("Consistency cash banked");
    }
  }

  const removeShot = event.target.closest("[data-remove-shot]")?.dataset.removeShot;
  if (removeShot !== undefined) {
    state.pendingScreenshots.splice(Number(removeShot), 1);
    renderScreenshotPreview();
  }

  const editId = event.target.closest("[data-edit]")?.dataset.edit;
  if (editId) fillForm(state.trades.find((trade) => trade.id === editId));

  const noteId = event.target.closest("[data-save-note]")?.dataset.saveNote;
  if (noteId) {
    const editor = document.querySelector(`[data-note-editor="${noteId}"]`);
    const trade = state.trades.find((item) => item.id === noteId);
    if (trade && editor) {
      trade.notes = editor.value;
      saveTrades();
      render();
      toast("Journal notes updated");
    }
  }

  const zoomId = event.target.closest("[data-zoom]")?.dataset.zoom;
  if (zoomId) {
    toast("Cloud screenshot viewing is disabled for now.");
  }

  const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
  if (deleteId) {
    state.trades = state.trades.filter((trade) => trade.id !== deleteId);
    saveTrades();
    render();
    toast("Trade deleted");
  }
});

$("#searchInput").addEventListener("input", () => {
  renderTrades();
  renderHistory();
});

$("#csvFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const imported = parseCsv(await file.text());
  state.trades = [...state.trades, ...imported];
  saveTrades();
  render();
  toast(`${imported.length} trades imported`);
  event.target.value = "";
});

$("#tradeForm [name=tradeStructure]").addEventListener("change", toggleCustomStructure);

$("#settingsForm [name=darkBackground]").addEventListener("change", (event) => {
  state.settings.darkBackground = event.target.checked;
  saveSettings();
  renderSettings();
  toast(event.target.checked ? "Dark background on" : "Dark background off");
});

$("#tradeForm [name=screenshot]").addEventListener("change", async (event) => {
  state.pendingScreenshots = await screenshotsFromInput(event.target);
  renderScreenshotPreview();
  event.target.value = "";
});

$("#tradeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const screenshots = await screenshotsFromInput(event.currentTarget.elements.screenshot);
  const trade = formTradePayload(formData, screenshots);
  trade.screenshots = trade.screenshots.map(cleanScreenshotMeta);
  const existingIndex = state.trades.findIndex((item) => item.id === trade.id);
  if (existingIndex >= 0) {
    state.trades[existingIndex] = trade;
    toast("Trade updated");
  } else {
    state.trades.push(trade);
    toast("Trade saved");
  }
  saveTrades();
  clearForm();
  render();
  state.historyFilter = trade.tradeType === "Backtest Record" ? "backtest" : "all";
  switchView("history");
  renderHistory();
});

$("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const manualValues = Object.fromEntries(manualMilestones().map((item) => [item.id, form.get(item.id) === "on"]));
  const mainStartingBalance = Number(form.get("startingBalance"));
  const paperStartingBalance = Number(form.get("paperStartingBalance"));
  state.settings = {
    ...state.settings,
    startingBalance: Number.isFinite(mainStartingBalance) ? Math.max(0, mainStartingBalance) : defaultSettings.startingBalance,
    paperStartingBalance: Number.isFinite(paperStartingBalance) ? Math.max(0, paperStartingBalance) : defaultSettings.paperStartingBalance,
    darkBackground: form.get("darkBackground") === "on",
    ...manualValues
  };
  saveSettings();
  render();
  toast("Settings saved");
});

$("#authModeToggle").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!appAuth) return;
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  $("#authError").textContent = "";
  $("#authSubmit").disabled = true;
  try {
    if (authMode === "signup") {
      await appAuth.createUserWithEmailAndPassword(email, password);
    } else {
      await appAuth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    showAuthError(error);
  } finally {
    $("#authSubmit").disabled = false;
  }
});

setAuthMode("login");
showAuthScreen(true);
initFirebase();
setInterval(renderMilestones, 60 * 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
