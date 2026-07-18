// One entry per day, rotating. `brainrot` is optional per episode.
const EPISODE_SCHEDULE = [
  { classic: "blockbuster-2000", brainrot: "blockbuster-2000-brainrot" },
  { classic: "apple-1997" },
  { classic: "kodak-1975" },
  { classic: "netflix-2011" },
];
const LAUNCH_DATE = "2026-07-18"; // day 1
const STORAGE_KEY = "founderMode";

function daysSinceLaunch() {
  const msPerDay = 86400000;
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = LAUNCH_DATE.split("-").map(Number);
  const launchUTC = Date.UTC(y, m - 1, d);
  return Math.max(0, Math.round((todayUTC - launchUTC) / msPerDay));
}

// Which day is being played; null = today. Archive playback sets this.
let playingDay = null;

function effectiveDay() {
  return playingDay === null ? daysSinceLaunch() : playingDay;
}

function entryForDay(day) {
  return EPISODE_SCHEDULE[day % EPISODE_SCHEDULE.length];
}

function todaysEpisodeEntry() {
  return entryForDay(effectiveDay());
}

function episodeNumber() {
  return effectiveDay() + 1;
}

function shuffled(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const app = document.getElementById("app");

const state = {
  episode: null,
  variant: "classic",
  screen: "title",
  decisionIndex: 0,
  lastChoice: null,
  results: [], // { matchesHistory, works }
  valuationB: 0, // running theoretical valuation, in billions
  valuationHistory: [], // your valuation entering each decision, index-aligned with decisions
};

function formatValuationB(billions) {
  if (billions >= 1) return `$${billions.toFixed(1)}B`;
  if (billions >= 0.01) return `$${Math.round(billions * 1000)}M`;
  return "$0";
}

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { streak: 0, lastPlayed: null, history: [] };
  } catch {
    return { streak: 0, lastPlayed: null, history: [] };
  }
}

function saveStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function recordCompletion() {
  const data = loadStorage();
  const today = todayStr();
  if (data.lastPlayed !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    data.streak = data.lastPlayed === yesterday ? data.streak + 1 : 1;
    data.lastPlayed = today;
  }
  saveStorage(data);
  return data.streak;
}

async function loadEpisode(variant) {
  const entry = todaysEpisodeEntry();
  const id = entry[variant] || entry.classic;
  const res = await fetch(`episodes/${id}.json`);
  return res.json();
}

function setAccent(hex) {
  document.documentElement.style.setProperty("--accent", hex);
}

function render() {
  app.innerHTML = "";
  if (state.screen === "title") renderTitle();
  else if (state.screen === "intro") renderIntro();
  else if (state.screen === "decision") renderDecision();
  else if (state.screen === "reveal") renderReveal();
  else if (state.screen === "ending") renderEnding();
  else if (state.screen === "archive") renderArchive();
}

function renderTitle() {
  playingDay = null; // title screen always means "today"
  const data = loadStorage();
  const el = document.createElement("div");
  el.className = "screen title-screen";
  const hasBrainrot = Boolean(todaysEpisodeEntry().brainrot);
  el.innerHTML = `
    <h1 class="logo">FOUNDER<br/><span>MODE</span></h1>
    <div class="streak">🔥 ${data.streak || 0} day streak</div>
    <div class="episode-teaser">Episode ${episodeNumber()} — ${state.episode.company}, ${state.episode.year}</div>
    ${hasBrainrot ? `
    <div class="variant-toggle">
      <button class="toggle-btn ${state.variant === "classic" ? "active" : ""}" data-variant="classic">Classic</button>
      <button class="toggle-btn ${state.variant === "brainrot" ? "active" : ""}" data-variant="brainrot">Brainrot 💀</button>
    </div>` : ""}
    <button class="btn btn-primary" id="play-btn">Play today's episode</button>
  `;
  app.appendChild(el);

  el.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.onclick = async () => {
      const variant = btn.dataset.variant;
      if (variant === state.variant) return;
      state.variant = variant;
      state.episode = await loadEpisode(variant);
      setAccent(state.episode.accent);
      render();
    };
  });

  document.getElementById("play-btn").onclick = () => {
    state.screen = "intro";
    render();
  };
}

function renderIntro() {
  const el = document.createElement("div");
  el.className = "screen intro-screen";
  el.innerHTML = `
    <div class="intro-year">${state.episode.year} &middot; ${state.episode.company}</div>
    <div class="intro-text" id="typewriter"></div>
    <button class="btn btn-primary" id="chair-btn" style="visibility:hidden">Take the chair.</button>
  `;
  app.appendChild(el);

  const target = document.getElementById("typewriter");
  const btn = document.getElementById("chair-btn");
  const text = state.episode.intro;
  let i = 0;
  const speed = 18;
  function type() {
    if (i <= text.length) {
      target.innerHTML = text.slice(0, i) + '<span class="cursor">&nbsp;</span>';
      i++;
      setTimeout(type, speed);
    } else {
      target.innerHTML = text;
      btn.style.visibility = "visible";
    }
  }
  type();

  btn.onclick = () => {
    state.screen = "decision";
    state.decisionIndex = 0;
    state.results = [];
    state.valuationB = state.episode.startValuationB;
    state.valuationHistory = [state.episode.startValuationB];
    render();
  };
}

function buildChartSVG(years, realSeries, yourSeries, accent) {
  const width = 400;
  const height = 110;
  const padTop = 10;
  const padBottom = 22;
  const padX = 8;
  const maxVal = Math.max(...realSeries, ...yourSeries, 1) * 1.15;
  const n = years.length;
  const xFor = (i) => (n <= 1 ? width / 2 : padX + (i / (n - 1)) * (width - padX * 2));
  const yFor = (v) => height - padBottom - (v / maxVal) * (height - padTop - padBottom);

  const toPoints = (series) => series.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const toCircles = (series, cls, style) =>
    series.map((v, i) => `<circle cx="${xFor(i)}" cy="${yFor(v)}" r="3.5" class="${cls}" style="${style || ""}"></circle>`).join("");
  const toLabels = () =>
    years.map((y, i) => `<text x="${xFor(i)}" y="${height - 4}" class="chart-year" text-anchor="middle">${y}</text>`).join("");

  return `
    <svg class="valuation-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <polyline points="${toPoints(realSeries)}" class="chart-line-real"></polyline>
      <polyline points="${toPoints(yourSeries)}" class="chart-line-you" style="stroke:${accent}"></polyline>
      ${toCircles(realSeries, "chart-dot-real")}
      ${toCircles(yourSeries, "chart-dot-you", `fill:${accent}`)}
      ${toLabels()}
    </svg>
  `;
}

function renderDecision() {
  const decision = state.episode.decisions[state.decisionIndex];
  const total = state.episode.decisions.length;
  const el = document.createElement("div");
  el.className = "screen decision-screen";

  const dots = Array.from({ length: total }, (_, i) => {
    let cls = "dot";
    if (i < state.decisionIndex) cls += " filled";
    else if (i === state.decisionIndex) cls += " current";
    return `<div class="${cls}"></div>`;
  }).join("");

  const seenDecisions = state.episode.decisions.slice(0, state.decisionIndex + 1);
  const years = seenDecisions.map((d) => d.year);
  const realSeries = seenDecisions.map((d) => d.realValuationB);
  const yourSeries = state.valuationHistory.slice(0, state.decisionIndex + 1);

  el.innerHTML = `
    <div class="progress-dots">${dots}</div>
    <div class="scenario-text">${decision.scenario}</div>
    <div class="chart-card">
      ${buildChartSVG(years, realSeries, yourSeries, state.episode.accent)}
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot real"></span>Real</span>
        <span class="legend-item"><span class="legend-dot you" style="background:${state.episode.accent}"></span>You</span>
      </div>
    </div>
    <div class="valuation-tracker">
      <div class="valuation-tile">
        <div class="valuation-tile-num real">${formatValuationB(decision.realValuationB)}</div>
        <div class="valuation-tile-label">Real ${state.episode.company}, right now</div>
      </div>
      <div class="valuation-tile">
        <div class="valuation-tile-num">${formatValuationB(state.valuationB)}</div>
        <div class="valuation-tile-label">Your ${state.episode.company}, right now</div>
      </div>
    </div>
    <div class="choices">
      ${shuffled(decision.choices.map((_, i) => i))
        .map((i) => `<button class="choice-btn" data-idx="${i}">${decision.choices[i].text}</button>`)
        .join("")}
    </div>
  `;
  app.appendChild(el);

  el.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      state.lastChoice = decision.choices[idx];
      state.results.push({
        matchesHistory: state.lastChoice.matchesHistory,
        works: state.lastChoice.works,
      });
      state.valuationB *= state.lastChoice.multiplier;
      state.valuationHistory.push(state.valuationB);
      state.screen = "reveal";
      render();
    };
  });
}

function renderReveal() {
  const choice = state.lastChoice;
  const isLast = state.decisionIndex === state.episode.decisions.length - 1;
  const isCounterfactual = !choice.matchesHistory;

  const el = document.createElement("div");
  el.className = "screen reveal-screen";
  el.innerHTML = `
    <div class="badges">
      <span class="badge ${choice.matchesHistory ? "yes" : "no"}">MATCHED HISTORY ${choice.matchesHistory ? "✓" : "✗"}</span>
      <span class="badge ${choice.works ? "yes" : "no"}">IT WORKED ${choice.works ? "✓" : "✗"}</span>
    </div>
    <div class="reveal-card ${isCounterfactual ? "counterfactual" : ""}">
      <div class="reveal-label">${isCounterfactual ? "Alternate Timeline" : "What Actually Happened"}</div>
      <div class="reveal-text">${choice.reveal}</div>
    </div>
    <div class="valuation-update">Your ${state.episode.company} is now worth <strong>${formatValuationB(state.valuationB)}</strong></div>
    <button class="btn btn-primary" id="next-btn" style="margin-top:auto">${isLast ? "See the ending" : "Next decision"}</button>
  `;
  app.appendChild(el);

  if (choice.works) {
    burstConfetti();
  } else {
    el.querySelector(".reveal-card").classList.add("shake");
  }

  document.getElementById("next-btn").onclick = () => {
    if (isLast) {
      state.screen = "ending";
    } else {
      state.decisionIndex++;
      state.screen = "decision";
    }
    render();
  };
}

function burstConfetti() {
  const colors = [getComputedStyle(document.documentElement).getPropertyValue("--accent"), "#22c55e", "#f4f2ee"];
  const container = document.createElement("div");
  container.className = "confetti-burst";
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.2 + "s";
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 1400);
}

function computeEnding() {
  const workedCount = state.results.filter((r) => r.works).length;
  const matchedCount = state.results.filter((r) => r.matchesHistory).length;
  const total = state.results.length;

  const bands = state.episode.endings.bands.slice().sort((a, b) => b.minWorked - a.minWorked);
  const band = bands.find((b) => workedCount >= b.minWorked) || bands[bands.length - 1];

  const matchedPct = Math.round((matchedCount / total) * 100);
  const identity = state.episode.identity;
  const identityLine = `You're ${matchedPct}% ${identity.historic}, ${100 - matchedPct}% ${identity.foil}`;

  return { workedCount, matchedCount, total, band, identityLine };
}

function emojiGrid() {
  return state.results.map((r) => (r.works ? "🟩" : "🟥")).join("");
}

function renderEnding() {
  const { workedCount, band, identityLine } = computeEnding();
  const percentile = Math.min(97, 30 + workedCount * 14);
  const yourValuation = formatValuationB(state.valuationB);

  const decisions = state.episode.decisions;
  const years = decisions.map((d) => d.year).concat(decisions[decisions.length - 1].year);
  const realSeries = decisions.map((d) => d.realValuationB).concat(state.episode.finalRealValuationB);
  const yourSeries = state.valuationHistory;

  const el = document.createElement("div");
  el.className = "screen ending-screen";
  el.innerHTML = `
    <div class="ending-label">Episode ${episodeNumber()} &middot; ${state.episode.company} ${state.episode.year}</div>
    <div class="chart-card">
      ${buildChartSVG(years, realSeries, yourSeries, state.episode.accent)}
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot real"></span>Real</span>
        <span class="legend-item"><span class="legend-dot you" style="background:${state.episode.accent}"></span>You</span>
      </div>
    </div>
    <div class="ending-card">
      <div class="valuation-row">
        <div class="valuation-col">
          <div class="valuation-num" id="your-val">$0</div>
          <div class="valuation-caption">Under you</div>
        </div>
        <div class="valuation-col">
          <div class="valuation-num real">${state.episode.realOutcome.valuation}</div>
          <div class="valuation-caption">Reality</div>
        </div>
      </div>
      <div class="ending-line">${band.line}</div>
      <div class="identity-line">${identityLine}</div>
      <div class="percentile-line">Better than ${percentile}% of players today</div>
    </div>
    <div class="emoji-grid" id="emoji-grid">${emojiGrid()}</div>
    <div class="btn-row">
      <button class="btn btn-primary" id="share-btn">Share result</button>
      <button class="btn btn-secondary" id="archive-btn">📼 Archive — past episodes</button>
      <div class="cta-card">
        <span class="cta-ticker">${state.episode.endings.ctaTicker}</span>${state.episode.endings.ctaLine}
      </div>
    </div>
  `;
  app.appendChild(el);

  countUp(document.getElementById("your-val"), yourValuation);

  document.getElementById("share-btn").onclick = () => shareResult(yourValuation);
  document.getElementById("archive-btn").onclick = () => {
    state.screen = "archive";
    render();
  };

  recordCompletion();
  render.calledEnding = true;
}

async function renderArchive() {
  const el = document.createElement("div");
  el.className = "screen archive-screen";
  el.innerHTML = `
    <div class="archive-title">📼 Episode Archive</div>
    <div class="archive-list" id="archive-list"><div class="archive-loading">Loading…</div></div>
  `;
  app.appendChild(el);

  const today = daysSinceLaunch();
  const rows = await Promise.all(
    Array.from({ length: today + 1 }, async (_, day) => {
      const res = await fetch(`episodes/${entryForDay(day).classic}.json`);
      const ep = await res.json();
      return { day, ep };
    })
  );
  rows.reverse(); // newest first

  const list = document.getElementById("archive-list");
  if (!list) return; // user navigated away while loading
  list.innerHTML = rows
    .map(
      ({ day, ep }) => `
      <button class="choice-btn archive-row" data-day="${day}">
        <span class="archive-ep">Episode ${day + 1}${day === today ? " — Today" : ""}</span>
        <span class="archive-meta">${ep.company}, ${ep.year} &middot; ${ep.mode === "villain" ? "Villain 😈" : "Legend 👑"}</span>
      </button>`
    )
    .join("");

  list.querySelectorAll(".archive-row").forEach((btn) => {
    btn.onclick = async () => {
      playingDay = Number(btn.dataset.day);
      state.variant = "classic";
      state.episode = await loadEpisode("classic");
      setAccent(state.episode.accent);
      state.screen = "intro";
      render();
    };
  });
}

function countUp(node, targetStr) {
  const match = targetStr.match(/[\d.]+/);
  if (!match) {
    node.textContent = targetStr;
    return;
  }
  const targetNum = parseFloat(match[0]);
  const suffix = targetStr.slice(match.index + match[0].length);
  const prefix = targetStr.slice(0, match.index);
  const duration = 700;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const val = (targetNum * p).toFixed(targetNum < 10 ? 1 : 0);
    node.textContent = `${prefix}${val}${suffix}`;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function shareResult(yourValuation) {
  const grid = emojiGrid();
  const text = `FOUNDER MODE #${episodeNumber()} — my ${state.episode.company}: ${yourValuation} / real: ${state.episode.realOutcome.valuation} 💀\n${grid}`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(showToast);
  }
}

function showToast() {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = "Copied to clipboard";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

async function init() {
  state.episode = await loadEpisode(state.variant);
  setAccent(state.episode.accent);
  render();
}

init();
