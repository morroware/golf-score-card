// app.js - Royal Mini Golf Quest v1.1
// Designed and implemented by Seth Morrow for The Castle Fun Center
// Modern JavaScript for mobile-first, medieval mini golf experience
'use strict';

////////////////////////////////////////////////////////////////////////////////
// INI Parser: Load hole narratives from configuration file
////////////////////////////////////////////////////////////////////////////////
function parseINI(text) {
  const lines = text.split(/[\r\n]+/);
  const data = {};
  let section = null;

  lines.forEach(lineRaw => {
    const line = lineRaw.trim();
    if (!line || line.startsWith(';')) return;

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1);
      data[section] = {};
    } else if (section) {
      const parts = line.split('=');
      if (parts.length < 2) {
        console.warn(`Skipping malformed INI line: "${line}"`);
        return;
      }
      const key = parts.shift().trim();
      const value = parts.join('=').trim();
      data[section][key] = value;
    }
  });

  return data;
}

////////////////////////////////////////////////////////////////////////////////
// Load hole stories via Fetch API
////////////////////////////////////////////////////////////////////////////////
let holeStories = {};
fetch('holes.ini')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  })
  .then(txt => { holeStories = parseINI(txt); })
  .catch(err => {
    console.error('Failed to load hole stories:', err);
    holeStories = {};
  });

////////////////////////////////////////////////////////////////////////////////
// Core Data Definitions
////////////////////////////////////////////////////////////////////////////////
// Course hole titles
const courses = {
  dragon: Array.from({ length: 18 }, (_, i) => `Dragon Slayer Hole ${i + 1}`),
  knight: Array.from({ length: 18 }, (_, i) => `Knight Hole ${i + 1}`)
};

// Course display names
const courseNames = {
  dragon: '🐉 Dragon Slayer',
  knight: '⚔️ Knight’s Challenge'
};

////////////////////////////////////////////////////////////////////////////////
// Par Values for Each Course (Total Par: 45)
////////////////////////////////////////////////////////////////////////////////
const coursePars = {
  dragon: [2,3,2,3,2,3,2,3,2,3,2,3,2,3,2,3,2,4],
  knight: [2,3,2,3,2,3,2,3,2,3,2,3,2,3,2,3,2,4]
};

////////////////////////////////////////////////////////////////////////////////
// Score Options with Achievements
////////////////////////////////////////////////////////////////////////////////
const scoreOptions = [
  { value: 1, label: "1 - Hole in One! ⭐", achievement: "Hole in One" },
  { value: 2, label: "2",            achievement: null },
  { value: 3, label: "3",            achievement: null },
  { value: 4, label: "4",            achievement: null },
  { value: 5, label: "5",            achievement: null },
  { value: 6, label: "6",            achievement: null },
  { value: 7, label: "7",            achievement: null },
  { value: 8, label: "8",            achievement: null },
  { value: 9, label: "9",            achievement: null },
  { value: 10, label: "10",          achievement: "Double Digits" },
  { value: 11, label: "11+",         achievement: "Keep Trying!" }
];

////////////////////////////////////////////////////////////////////////////////
// Game State Variables
////////////////////////////////////////////////////////////////////////////////
let currentCourse = 'dragon',
    players       = [],
    currentHole   = 0,
    gameStarted   = false;

////////////////////////////////////////////////////////////////////////////////
// Mobile Button Bar Management
////////////////////////////////////////////////////////////////////////////////
function updateMobileButtons() {
  const buttonBar = document.getElementById('mobileButtonBar');
  const buttonGrid = document.getElementById('buttonGrid');
  const container  = document.querySelector('.container');

  if (!gameStarted) {
    buttonBar.classList.remove('active');
    container.classList.remove('gameplay');
    return;
  }

  buttonBar.classList.add('active');
  container.classList.add('gameplay');
  buttonGrid.innerHTML = '';
  buttonGrid.className = 'button-grid';

  const isFirstHole    = currentHole === 0;
  const isLastHole     = currentHole === 17;
  const allScoresEntered = players.every(p => p.scores[currentHole] !== null);

  // Previous/Quit button
  const prevButton = `
    <button class="mobile-btn ${isFirstHole ? 'danger' : 'nav'}"
            onclick="${isFirstHole ? 'confirmQuitGame()' : 'previousHole()'}">
      <span class="icon">${isFirstHole ? '🚪' : '⬅️'}</span>
      <span>${isFirstHole ? 'Quit' : 'Previous'}</span>
    </button>`;

  // Scorecards button
  const scorecardsButton = `
    <button class="mobile-btn secondary" onclick="showScorecards()">
      <span class="icon">📊</span>
      <span>Scores</span>
    </button>`;

  // Next/Finish button
  const nextButton = `
    <button class="mobile-btn primary" onclick="nextHole()" ${!allScoresEntered ? 'disabled' : ''}>
      <span class="icon">${isLastHole ? '🏆' : '➡️'}</span>
      <span>${isLastHole ? 'Finish' : 'Next'}</span>
    </button>`;

  buttonGrid.innerHTML = prevButton + scorecardsButton + nextButton;
}

////////////////////////////////////////////////////////////////////////////////
// Quit Game Functionality
////////////////////////////////////////////////////////////////////////////////
function confirmQuitGame() {
  const confirmed = confirm(
    "🚪 Quit Current Quest?\n\n" +
    "Are you sure you want to return to the main menu?\n" +
    "All progress will be lost."
  );
  if (confirmed) quitGame();
}

function quitGame() {
  localStorage.removeItem(STORAGE_KEY);
  currentCourse = 'dragon';
  currentHole   = 0;
  players       = [];
  gameStarted   = false;

  document.querySelector('.container').classList.remove('gameplay');
  document.getElementById('mobileButtonBar').classList.remove('active');

  showCourseSelection();
  document.getElementById('playerSetup').classList.remove('hidden');
  document.getElementById('holePlay').classList.remove('active');
  document.getElementById('summarySection').classList.remove('active');

  const list = document.getElementById('playerInputs');
  list.innerHTML = `
    <div class="player-input">
      <input type="text" placeholder="Knight 1 Name" aria-label="Name of Knight 1" maxlength="20">
      <button type="button" onclick="removePlayer(this)" aria-label="Remove Knight 1">–</button>
    </div>
    <div class="player-input">
      <input type="text" placeholder="Knight 2 Name" aria-label="Name of Knight 2" maxlength="20">
      <button type="button" onclick="removePlayer(this)" aria-label="Remove Knight 2">–</button>
    </div>`;
}

////////////////////////////////////////////////////////////////////////////////
// Scoring Helpers
////////////////////////////////////////////////////////////////////////////////
function getScoreDescription(strokes, par) {
  const diff = strokes - par;
  if (strokes === 1)           return { text: "Hole in One! ⭐", class: "hole-in-one" };
  if (diff <= -2)              return { text: `Eagle! (${diff}) 🦅`, class: "eagle" };
  if (diff === -1)             return { text: "Birdie! (-1) 🐦", class: "birdie" };
  if (diff === 0)              return { text: "Par ✓",         class: "par" };
  if (diff === 1)              return { text: "Bogey (+1)",    class: "bogey" };
  if (diff === 2)              return { text: "Double Bogey (+2)", class: "double-bogey" };
  if (diff >= 3)               return { text: `+${diff} 😅`,  class: "high-score" };
  return { text: "", class: "" };
}

function getParTotal(player) {
  let totalPar    = 0;
  let scoredHoles = 0;

  for (let i = 0; i <= Math.min(currentHole, 17); i++) {
    if (player.scores[i] !== null) {
      totalPar += coursePars[currentCourse][i];
      scoredHoles++;
    }
  }

  if (scoredHoles === 0) return "E";
  const diff = player.total - totalPar;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

////////////////////////////////////////////////////////////////////////////////
// Course Selection UI
////////////////////////////////////////////////////////////////////////////////
function attachCourseListeners() {
  document.querySelectorAll('.courses .btn').forEach(button => {
    button.addEventListener('click', () => {
      if (gameStarted) return;
      document.querySelectorAll('.courses .btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML = b.innerHTML.replace(' ✓', '');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      button.innerHTML += ' ✓';
      currentCourse = button.dataset.course;
      saveState();
    });
  });
}

function showCourseSelection() {
  const sec = document.querySelector('.courses');
  sec.innerHTML = '';
  Object.keys(courses).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (key === currentCourse ? ' active' : '');
    btn.dataset.course = key;
    btn.setAttribute('aria-pressed', key === currentCourse);
    btn.innerHTML = `${courseNames[key]}${key === currentCourse ? ' ✓' : ''}`;
    sec.appendChild(btn);
  });
  attachCourseListeners();
}

function showCourseDisplay() {
  document.querySelector('.courses').innerHTML =
    `<div class="course-display">${courseNames[currentCourse]}</div>`;
}

////////////////////////////////////////////////////////////////////////////////
// Player Setup Functions
////////////////////////////////////////////////////////////////////////////////
function addPlayer() {
  const list = document.getElementById('playerInputs');
  if (list.children.length >= 6) return alert('Max 6 knights!');
  const n = list.children.length + 1;
  const div = document.createElement('div');
  div.className = 'player-input';
  div.innerHTML = `
    <input type="text" placeholder="Knight ${n} Name" aria-label="Name of Knight ${n}" maxlength="20">
    <button type="button" onclick="removePlayer(this)" aria-label="Remove Knight ${n}">–</button>`;
  list.appendChild(div);
}

function removePlayer(btn) {
  const list = document.getElementById('playerInputs');
  if (list.children.length <= 1) return;
  btn.parentElement.remove();
}

////////////////////////////////////////////////////////////////////////////////
// Game Start & Rendering
////////////////////////////////////////////////////////////////////////////////
function startGame() {
  const inputs = document.querySelectorAll('#playerInputs input');
  players = Array.from(inputs).map(i => ({
    name:  i.value.trim() || 'Anonymous Knight',
    scores: Array(18).fill(null),
    total:  0
  }));
  if (!players.length) return alert('Add at least one knight!');

  gameStarted = true;
  showCourseDisplay();
  document.getElementById('playerSetup').classList.add('hidden');
  document.getElementById('holePlay').classList.add('active');
  renderHole();
  updateMobileButtons();
  saveState();
}

function renderHole() {
  document.getElementById('holeNumber').textContent = `Hole ${currentHole + 1}`;
  const story = (holeStories[currentCourse] || {})[String(currentHole + 1)]
                || 'Your quest continues…';
  document.getElementById('holeStory').textContent = story;

  const par = coursePars[currentCourse][currentHole];
  document.getElementById('holeProgress').textContent =
    `${courses[currentCourse][currentHole]} (Par ${par})`;

  document.getElementById('progressFill').style.width =
    `${Math.round(((currentHole + 1) / 18) * 100)}%`;

  const grid = document.getElementById('playersGrid');
  grid.innerHTML = '';
  players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-card';

    const options = scoreOptions.map(opt => {
      const sel = p.scores[currentHole] === opt.value ? 'selected' : '';
      return `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
    }).join('');

    let descHtml = '';
    if (p.scores[currentHole] !== null) {
      const sd = getScoreDescription(p.scores[currentHole], par);
      if (sd.text) descHtml = `<div class="score-description ${sd.class}">${sd.text}</div>`;
    }

    card.innerHTML = `
      <label>${p.name}</label>
      <select onchange="updateScore(${i}, this.value)"
              aria-label="Strokes for ${p.name} on hole ${currentHole + 1}">
        <option value="">Select Strokes</option>
        ${options}
      </select>
      ${descHtml}
      <div class="player-total">
        <span>Total: ${p.total}</span>
        <span class="par-info">(${getParTotal(p)})</span>
      </div>`;
    grid.appendChild(card);
  });

  document.getElementById('prevBtn').disabled = (currentHole === 0);
  document.getElementById('nextBtn').textContent =
    (currentHole === 17 ? 'Finish Quest' : 'Next Hole');

  updateMobileButtons();
}

////////////////////////////////////////////////////////////////////////////////
// Score Update & Modal Functions
////////////////////////////////////////////////////////////////////////////////
function updateScore(idx, val) {
  const s = parseInt(val, 10);
  if (isNaN(s)) return;
  players[idx].scores[currentHole] = s;
  players[idx].total = players[idx].scores
    .filter(x => x != null).reduce((a, b) => a + b, 0);
  renderHole();
  saveState();
}

function showScorecards() {
  const modal   = document.getElementById('scorecardModal');
  const content = document.getElementById('scorecardModalContent');
  content.innerHTML = '';

  const sortedPlayers = [...players].sort((a, b) => a.total - b.total);

  players.forEach(player => {
    const idx = sortedPlayers.findIndex(p => p.name === player.name) + 1;
    let parPlayed = 0;
    for (let i = 0; i <= currentHole; i++) {
      if (player.scores[i] !== null) parPlayed += coursePars[currentCourse][i];
    }

    const card = document.createElement('div');
    card.className = 'modal-scorecard';
    card.innerHTML = `
      <h3>#${idx} — ${player.name}</h3>
      <table class="scorecard">
        <thead>
          <tr><th>Hole</th><th>Par</th><th>Score</th><th>+/-</th></tr>
        </thead>
        <tbody>
          ${player.scores.map((score, hi) => {
            const par = coursePars[currentCourse][hi];
            const isCurrent = hi === currentHole;
            const diff = score !== null ? score - par : null;
            const diffText = diff === 0 ? 'E' :
                             diff > 0   ? `+${diff}` :
                                        `${diff}`;
            return `<tr class="${isCurrent ? 'current-hole-row' : ''}">
              <td>${hi+1}${isCurrent ? ' 📍' : ''}</td>
              <td>${par}</td>
              <td>${score===null?'–':score}</td>
              <td>${score===null?'–':diffText}</td>
            </tr>`;
          }).join('')}
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td><strong>${parPlayed}</strong></td>
            <td><strong>${player.total}</strong></td>
            <td><strong>${getParTotal(player)}</strong></td>
          </tr>
        </tbody>
      </table>`;
    content.appendChild(card);
  });

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'scorecards' }, '', '#scorecards');
}

function hideScorecards() {
  const modal = document.getElementById('scorecardModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
  if (window.location.hash === '#scorecards') history.back();
}

window.addEventListener('popstate', () => {
  const modal = document.getElementById('scorecardModal');
  if (modal.classList.contains('active')) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
});

////////////////////////////////////////////////////////////////////////////////
// Navigation & Game Flow
////////////////////////////////////////////////////////////////////////////////
function previousHole() {
  if (currentHole > 0) {
    currentHole--;
    renderHole();
    saveState();
  }
}

function nextHole() {
  if (players.some(p => p.scores[currentHole] === null)) {
    return alert('Enter strokes for all knights!');
  }
  if (currentHole < 17) {
    currentHole++;
    renderHole();
    saveState();
  } else {
    endGame();
  }
}

function endGame() {
  document.getElementById('holePlay').classList.remove('active');
  document.getElementById('summarySection').classList.add('active');
  document.getElementById('mobileButtonBar').classList.remove('active');
  document.querySelector('.container').classList.remove('gameplay');
  buildLeaderboard();
  localStorage.removeItem(STORAGE_KEY);
}

function buildLeaderboard() {
  const cont     = document.getElementById('leaderboardContent');
  const sorted   = [...players].sort((a,b) => a.total - b.total);
  const totalPar = coursePars[currentCourse].reduce((a,b) => a + b, 0);
  const winner   = sorted[0];
  const diff     = winner.total - totalPar;
  const parText  = diff === 0 ? "at par" :
                   diff > 0   ? `${diff} over par` :
                               `${Math.abs(diff)} under par`;

  document.getElementById('winnerAnnouncement').innerHTML = `
    🏆 <strong>Champion: ${winner.name}</strong><br>
    ${winner.total} strokes (${parText})
  `;

  cont.innerHTML = '';
  sorted.forEach((p,i) => {
    const card = document.createElement('div');
    card.className = 'leaderboard-card';
    const trophy = document.createElement('div');
    trophy.className = 'trophy';
    trophy.textContent = i===0?'🏆':i===1?'🥈':i===2?'🥉':''; card.appendChild(trophy);

    const title = document.createElement('h3');
    title.textContent = `#${i+1} — ${p.name}`; card.appendChild(title);

    const parDiff   = p.total - totalPar;
    const displayPD = parDiff === 0 ? "Even Par" :
                      parDiff > 0   ? `+${parDiff}` :
                                     `${parDiff}`;

    const table = document.createElement('table');
    table.className = 'scorecard';
    table.innerHTML = `
      <thead>
        <tr><th>Hole</th><th>Par</th><th>Score</th><th>+/-</th></tr>
      </thead>
      <tbody>
        ${p.scores.map((s,idx) => {
          const pr = coursePars[currentCourse][idx];
          const d  = s !== null ? s - pr : null;
          const dt = d === null ? '–' :
                     d === 0    ? 'E' :
                     d > 0      ? `+${d}` :
                                  `${d}`;
          return `<tr>
            <td>${idx+1}</td>
            <td>${pr}</td>
            <td>${s===null?'–':s}</td>
            <td>${dt}</td>
          </tr>`;
        }).join('')}
        <tr class="total-row">
          <td><strong>Total</strong></td>
          <td><strong>${totalPar}</strong></td>
          <td><strong>${p.total}</strong></td>
          <td><strong>${displayPD}</strong></td>
        </tr>
      </tbody>`;
    card.appendChild(table);

    const achievements = [];
    p.scores.forEach((sc, hi) => {
      if (sc === 1) achievements.push('⭐ Hole in One');
      const pr = coursePars[currentCourse][hi];
      if (sc != null && sc - pr <= -2) achievements.push('🦅 Eagle');
      if (sc != null && sc >= 10) achievements.push('🎯 Persistence');
    });
    if (achievements.length) {
      const div = document.createElement('div');
      div.className = 'achievements';
      div.innerHTML = `<strong>Achievements:</strong> ${achievements.join(', ')}`;
      card.appendChild(div);
    }

    cont.appendChild(card);
  });
}

////////////////////////////////////////////////////////////////////////////////
// Persistence: Save & Load State
////////////////////////////////////////////////////////////////////////////////
const STORAGE_KEY = 'royalMiniGolfState';

function saveState() {
  const state = {
    course: currentCourse,
    hole:   currentHole,
    players: players.map(p => ({ name: p.name, scores: p.scores })),
    gameStarted
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const { course, hole, players: ps, gameStarted: gs } = JSON.parse(raw);
    currentCourse = course;
    gameStarted    = gs;
    if (gameStarted) showCourseDisplay();
    else showCourseSelection();

    players = ps.map(p => ({
      name: p.name,
      scores: p.scores,
      total: p.scores.filter(s => s != null).reduce((a,b) => a + b, 0)
    }));

    document.getElementById('playerSetup').classList.add('hidden');
    document.getElementById('holePlay').classList.add('active');
    currentHole = hole;
    renderHole();
    updateMobileButtons();
    return true;
  } catch (e) {
    console.error('Failed to load state', e);
    return false;
  }
}

////////////////////////////////////////////////////////////////////////////////
// New Quest / Reset Game
////////////////////////////////////////////////////////////////////////////////
function newGame() {
  localStorage.removeItem(STORAGE_KEY);
  currentCourse = 'dragon';
  currentHole   = 0;
  players       = [];
  gameStarted   = false;

  document.getElementById('mobileButtonBar').classList.remove('active');
  document.querySelector('.container').classList.remove('gameplay');
  showCourseSelection();
  document.getElementById('playerSetup').classList.remove('hidden');
  document.getElementById('holePlay').classList.remove('active');
  document.getElementById('summarySection').classList.remove('active');

  const list = document.getElementById('playerInputs');
  list.innerHTML = `
    <div class="player-input">
      <input type="text" placeholder="Knight 1 Name" aria-label="Name of Knight 1" maxlength="20">
      <button type="button" onclick="removePlayer(this)" aria-label="Remove Knight 1">–</button>
    </div>
    <div class="player-input">
      <input type="text" placeholder="Knight 2 Name" aria-label="Name of Knight 2" maxlength="20">
      <button type="button" onclick="removePlayer(this)" aria-label="Remove Knight 2">–</button>
    </div>`;
}

////////////////////////////////////////////////////////////////////////////////
// Responsive & Accessibility Enhancements
////////////////////////////////////////////////////////////////////////////////
window.addEventListener('orientationchange', () => setTimeout(updateMobileButtons, 100));
window.addEventListener('resize', updateMobileButtons);

document.addEventListener('DOMContentLoaded', () => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
  }
  attachCourseListeners();
  if (!loadState()) {
    console.log('No saved game, starting fresh.');
    showCourseSelection();
  }
  updateMobileButtons();
});

document.addEventListener('touchstart', () => {}, { passive: true });

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    previousHole();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    const allEntered = players.every(p => p.scores[currentHole] !== null);
    if (allEntered) nextHole();
  } else if (e.key === 'Escape') {
    const modal = document.getElementById('scorecardModal');
    if (modal.classList.contains('active')) hideScorecards();
  } else if (e.key.toLowerCase() === 's') {
    e.preventDefault();
    showScorecards();
  }
});
