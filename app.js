// app.js - Royal Mini Golf Quest v2.0
// Complete Mobile-First Redesign
// Modern, Professional, Fun UX
'use strict';

////////////////////////////////////////////////////////////////////////////////
// Configuration
////////////////////////////////////////////////////////////////////////////////
const STORAGE_KEY = 'royalMiniGolfState';
const MAX_PLAYERS = 6;
const HOLES_COUNT = 18;

////////////////////////////////////////////////////////////////////////////////
// Course Data
////////////////////////////////////////////////////////////////////////////////
const courseNames = {
  dragon: '🐉 Dragon Slayer',
  knight: '⚔️ Knight\'s Challenge'
};

const coursePars = {
  dragon: [2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 4],
  knight: [2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 4]
};

const scoreOptions = [
  { value: 1, label: '1 – Hole in One! ⭐' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' },
  { value: 11, label: '11+' }
];

////////////////////////////////////////////////////////////////////////////////
// Game State
////////////////////////////////////////////////////////////////////////////////
let currentCourse = 'dragon';
let players = [];
let currentHole = 0;
let gameStarted = false;
let holeStories = {};

////////////////////////////////////////////////////////////////////////////////
// INI Parser & Loader
////////////////////////////////////////////////////////////////////////////////
function parseINI(text) {
  const lines = text.split(/[\r\n]+/);
  const data = {};
  let section = null;

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.startsWith(';')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1);
      data[section] = {};
    } else if (section) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        data[section][key] = value;
      }
    }
  }

  return data;
}

// Load hole stories
fetch('holes.ini')
  .then(res => res.ok ? res.text() : Promise.reject(res.status))
  .then(txt => { holeStories = parseINI(txt); })
  .catch(err => console.warn('Could not load hole stories:', err));

////////////////////////////////////////////////////////////////////////////////
// Scoring Helpers
////////////////////////////////////////////////////////////////////////////////
function getScoreDescription(strokes, par) {
  const diff = strokes - par;

  if (strokes === 1) return { text: 'Hole in One! ⭐', class: 'hole-in-one' };
  if (diff <= -2) return { text: `Eagle! (${diff}) 🦅`, class: 'eagle' };
  if (diff === -1) return { text: 'Birdie! (−1) 🐦', class: 'birdie' };
  if (diff === 0) return { text: 'Par ✓', class: 'par' };
  if (diff === 1) return { text: 'Bogey (+1)', class: 'bogey' };
  if (diff === 2) return { text: 'Double Bogey (+2)', class: 'double-bogey' };
  return { text: `+${diff}`, class: 'high-score' };
}

function getParDifferential(player) {
  let parTotal = 0;
  let holesPlayed = 0;

  for (let i = 0; i <= currentHole; i++) {
    if (player.scores[i] !== null) {
      parTotal += coursePars[currentCourse][i];
      holesPlayed++;
    }
  }

  if (holesPlayed === 0) return 'E';

  const diff = player.total - parTotal;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

////////////////////////////////////////////////////////////////////////////////
// Course Selection
////////////////////////////////////////////////////////////////////////////////
function attachCourseListeners() {
  document.querySelectorAll('.courses .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameStarted) return;

      document.querySelectorAll('.courses .btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentCourse = btn.dataset.course;
      saveState();
    });
  });
}

function showCourseSelection() {
  const container = document.querySelector('.courses');
  container.innerHTML = '';

  for (const key of Object.keys(courseNames)) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (key === currentCourse ? ' active' : '');
    btn.dataset.course = key;
    btn.setAttribute('aria-pressed', key === currentCourse);
    btn.textContent = courseNames[key];
    container.appendChild(btn);
  }

  attachCourseListeners();
}

function showCourseDisplay() {
  document.querySelector('.courses').innerHTML =
    `<div class="course-display">${courseNames[currentCourse]}</div>`;
}

////////////////////////////////////////////////////////////////////////////////
// Player Management
////////////////////////////////////////////////////////////////////////////////
function addPlayer() {
  const list = document.getElementById('playerInputs');
  if (list.children.length >= MAX_PLAYERS) {
    showToast(`Maximum ${MAX_PLAYERS} players allowed`);
    return;
  }

  const n = list.children.length + 1;
  const div = document.createElement('div');
  div.className = 'player-input';
  div.innerHTML = `
    <input type="text" placeholder="Player ${n} name" aria-label="Name of Player ${n}" maxlength="20" autocomplete="off" autocapitalize="words">
    <button type="button" onclick="removePlayer(this)" aria-label="Remove player">×</button>
  `;
  list.appendChild(div);

  // Focus the new input
  div.querySelector('input').focus();
}

function removePlayer(btn) {
  const list = document.getElementById('playerInputs');
  if (list.children.length <= 1) {
    showToast('At least one player required');
    return;
  }
  btn.closest('.player-input').remove();
  updatePlayerPlaceholders();
}

function updatePlayerPlaceholders() {
  const inputs = document.querySelectorAll('#playerInputs .player-input');
  inputs.forEach((div, i) => {
    const input = div.querySelector('input');
    input.placeholder = `Player ${i + 1} name`;
    input.setAttribute('aria-label', `Name of Player ${i + 1}`);
  });
}

////////////////////////////////////////////////////////////////////////////////
// Game Flow
////////////////////////////////////////////////////////////////////////////////
function startGame() {
  const inputs = document.querySelectorAll('#playerInputs input');

  players = Array.from(inputs).map((input, i) => ({
    name: input.value.trim() || `Player ${i + 1}`,
    scores: Array(HOLES_COUNT).fill(null),
    total: 0
  }));

  if (players.length === 0) {
    showToast('Add at least one player');
    return;
  }

  gameStarted = true;
  currentHole = 0;

  showCourseDisplay();
  document.getElementById('playerSetup').classList.add('hidden');
  document.getElementById('holePlay').classList.add('active');

  renderHole();
  updateMobileButtons();
  saveState();
}

function renderHole() {
  // Update hole number
  document.getElementById('holeNumber').textContent = `Hole ${currentHole + 1}`;

  // Update story
  const story = holeStories[currentCourse]?.[String(currentHole + 1)] || 'Your quest continues...';
  const storyEl = document.getElementById('holeStory');
  storyEl.textContent = story;
  storyEl.classList.remove('expanded');

  // Click to expand/collapse story
  storyEl.onclick = () => storyEl.classList.toggle('expanded');

  // Update progress info
  const par = coursePars[currentCourse][currentHole];
  document.getElementById('holeProgress').textContent =
    `${courseNames[currentCourse].replace(/[🐉⚔️]/g, '').trim()} – Hole ${currentHole + 1} (Par ${par})`;

  // Update progress bar
  const progress = ((currentHole + 1) / HOLES_COUNT) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;

  // Render player cards
  const grid = document.getElementById('playersGrid');
  grid.innerHTML = '';

  players.forEach((player, idx) => {
    const card = document.createElement('div');
    card.className = 'player-card';

    const options = scoreOptions.map(opt => {
      const selected = player.scores[currentHole] === opt.value ? 'selected' : '';
      return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    }).join('');

    let descHTML = '';
    if (player.scores[currentHole] !== null) {
      const desc = getScoreDescription(player.scores[currentHole], par);
      descHTML = `<div class="score-description ${desc.class}">${desc.text}</div>`;
    }

    card.innerHTML = `
      <label>${escapeHtml(player.name)}</label>
      <select onchange="updateScore(${idx}, this.value)" aria-label="Strokes for ${escapeHtml(player.name)}">
        <option value="">Select strokes</option>
        ${options}
      </select>
      ${descHTML}
      <div class="player-total">
        <span>Total: ${player.total}</span>
        <span class="par-info">${getParDifferential(player)}</span>
      </div>
    `;

    grid.appendChild(card);
  });

  updateMobileButtons();
}

function updateScore(playerIdx, value) {
  const strokes = parseInt(value, 10);
  if (isNaN(strokes)) return;

  players[playerIdx].scores[currentHole] = strokes;
  players[playerIdx].total = players[playerIdx].scores
    .filter(s => s !== null)
    .reduce((sum, s) => sum + s, 0);

  renderHole();
  saveState();

  // Check for special scores
  const par = coursePars[currentCourse][currentHole];
  if (strokes === 1) {
    celebrateScore('hole-in-one');
  } else if (strokes - par <= -2) {
    celebrateScore('eagle');
  }
}

function celebrateScore(type) {
  // Add haptic feedback if available
  if (navigator.vibrate) {
    navigator.vibrate(type === 'hole-in-one' ? [100, 50, 100, 50, 100] : [50, 30, 50]);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Navigation
////////////////////////////////////////////////////////////////////////////////
function previousHole() {
  if (currentHole > 0) {
    currentHole--;
    renderHole();
    saveState();
  }
}

function nextHole() {
  // Check all scores entered
  if (players.some(p => p.scores[currentHole] === null)) {
    showToast('Enter scores for all players');
    return;
  }

  if (currentHole < HOLES_COUNT - 1) {
    currentHole++;
    renderHole();
    saveState();
  } else {
    endGame();
  }
}

function endGame() {
  gameStarted = false;

  document.getElementById('holePlay').classList.remove('active');
  document.getElementById('summarySection').classList.add('active');
  document.getElementById('mobileButtonBar').classList.remove('active');
  document.querySelector('.container').classList.remove('gameplay');

  buildLeaderboard();
  localStorage.removeItem(STORAGE_KEY);
}

////////////////////////////////////////////////////////////////////////////////
// Leaderboard
////////////////////////////////////////////////////////////////////////////////
function buildLeaderboard() {
  const sorted = [...players].sort((a, b) => a.total - b.total);
  const totalPar = coursePars[currentCourse].reduce((a, b) => a + b, 0);
  const winner = sorted[0];
  const diff = winner.total - totalPar;

  const parText = diff === 0 ? 'at par' :
                  diff > 0 ? `${diff} over par` :
                  `${Math.abs(diff)} under par`;

  document.getElementById('winnerAnnouncement').innerHTML = `
    <strong>🏆 ${escapeHtml(winner.name)} Wins!</strong>
    ${winner.total} strokes (${parText})
  `;

  const container = document.getElementById('leaderboardContent');
  container.innerHTML = '';

  sorted.forEach((player, i) => {
    const card = document.createElement('div');
    card.className = 'leaderboard-card';

    const trophy = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    const parDiff = player.total - totalPar;
    const displayDiff = parDiff === 0 ? 'E' : parDiff > 0 ? `+${parDiff}` : `${parDiff}`;

    // Build scorecard rows
    const rows = player.scores.map((score, hi) => {
      const par = coursePars[currentCourse][hi];
      const d = score !== null ? score - par : null;
      const diffText = d === null ? '–' : d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`;
      return `
        <tr>
          <td>${hi + 1}</td>
          <td>${par}</td>
          <td>${score ?? '–'}</td>
          <td>${diffText}</td>
        </tr>
      `;
    }).join('');

    // Calculate achievements
    const achievements = [];
    player.scores.forEach((score, hi) => {
      if (score === 1) achievements.push('⭐ Hole in One');
      const par = coursePars[currentCourse][hi];
      if (score !== null && score - par <= -2) achievements.push('🦅 Eagle');
    });

    const achievementsHTML = achievements.length > 0 ?
      `<div class="achievements"><strong>Achievements:</strong> ${achievements.join(', ')}</div>` : '';

    card.innerHTML = `
      ${trophy ? `<div class="trophy">${trophy}</div>` : ''}
      <h3>#${i + 1} – ${escapeHtml(player.name)}</h3>
      <table class="scorecard">
        <thead>
          <tr><th>Hole</th><th>Par</th><th>Score</th><th>+/−</th></tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td><strong>${totalPar}</strong></td>
            <td><strong>${player.total}</strong></td>
            <td><strong>${displayDiff}</strong></td>
          </tr>
        </tbody>
      </table>
      ${achievementsHTML}
    `;

    container.appendChild(card);
  });
}

////////////////////////////////////////////////////////////////////////////////
// Mobile Button Bar
////////////////////////////////////////////////////////////////////////////////
function updateMobileButtons() {
  const bar = document.getElementById('mobileButtonBar');
  const grid = document.getElementById('buttonGrid');
  const container = document.querySelector('.container');

  if (!gameStarted) {
    bar.classList.remove('active');
    container.classList.remove('gameplay');
    return;
  }

  bar.classList.add('active');
  container.classList.add('gameplay');

  const isFirstHole = currentHole === 0;
  const isLastHole = currentHole === HOLES_COUNT - 1;
  const allScoresEntered = players.every(p => p.scores[currentHole] !== null);

  // Back button always navigates back - to previous hole or to setup on hole 1
  grid.innerHTML = `
    <button class="mobile-btn nav" onclick="${isFirstHole ? 'goBackToSetup()' : 'previousHole()'}">
      <span class="icon">←</span>
      <span>${isFirstHole ? 'Back' : 'Previous'}</span>
    </button>
    <button class="mobile-btn secondary" onclick="showScorecards()">
      <span class="icon">📊</span>
      <span>Scores</span>
    </button>
    <button class="mobile-btn primary" onclick="nextHole()" ${allScoresEntered ? '' : 'disabled'}>
      <span class="icon">${isLastHole ? '🏆' : '→'}</span>
      <span>${isLastHole ? 'Finish' : 'Next'}</span>
    </button>
  `;
}

// Go back to setup screen (preserves game state so user can resume)
function goBackToSetup() {
  gameStarted = false;

  document.querySelector('.container').classList.remove('gameplay');
  document.getElementById('mobileButtonBar').classList.remove('active');
  document.getElementById('holePlay').classList.remove('active');

  // Show setup with current players
  showCourseSelection();
  document.getElementById('playerSetup').classList.remove('hidden');

  // Restore player names in inputs
  const inputsContainer = document.getElementById('playerInputs');
  inputsContainer.innerHTML = players.map((p, i) => `
    <div class="player-input">
      <input type="text" placeholder="Player ${i + 1} name" aria-label="Name of Player ${i + 1}"
             maxlength="20" autocomplete="off" autocapitalize="words" value="${escapeHtml(p.name)}">
      <button type="button" onclick="removePlayer(this)" aria-label="Remove player">×</button>
    </div>
  `).join('');

  localStorage.removeItem(STORAGE_KEY);
}

////////////////////////////////////////////////////////////////////////////////
// Modal Functions
////////////////////////////////////////////////////////////////////////////////
function showScorecards() {
  const modal = document.getElementById('scorecardModal');
  const content = document.getElementById('scorecardModalContent');

  const sorted = [...players].sort((a, b) => a.total - b.total);

  content.innerHTML = players.map(player => {
    const rank = sorted.findIndex(p => p.name === player.name) + 1;
    let parPlayed = 0;

    for (let i = 0; i <= currentHole; i++) {
      if (player.scores[i] !== null) {
        parPlayed += coursePars[currentCourse][i];
      }
    }

    const rows = player.scores.map((score, hi) => {
      const par = coursePars[currentCourse][hi];
      const isCurrent = hi === currentHole;
      const d = score !== null ? score - par : null;
      const diffText = d === null ? '–' : d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`;

      return `
        <tr class="${isCurrent ? 'current-hole-row' : ''}">
          <td>${hi + 1}${isCurrent ? ' 📍' : ''}</td>
          <td>${par}</td>
          <td>${score ?? '–'}</td>
          <td>${diffText}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="modal-scorecard">
        <h3>#${rank} – ${escapeHtml(player.name)}</h3>
        <table class="scorecard">
          <thead>
            <tr><th>Hole</th><th>Par</th><th>Score</th><th>+/−</th></tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td><strong>Total</strong></td>
              <td><strong>${parPlayed}</strong></td>
              <td><strong>${player.total}</strong></td>
              <td><strong>${getParDifferential(player)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'scorecards' }, '', '#scorecards');
}

function hideScorecards() {
  const modal = document.getElementById('scorecardModal');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (window.location.hash === '#scorecards') {
    history.back();
  }
}

////////////////////////////////////////////////////////////////////////////////
// Quit Game
////////////////////////////////////////////////////////////////////////////////
function confirmQuit() {
  if (confirm('Quit current quest?\n\nAll progress will be lost.')) {
    quitGame();
  }
}

function quitGame() {
  localStorage.removeItem(STORAGE_KEY);
  resetGame();
}

function resetGame() {
  currentCourse = 'dragon';
  currentHole = 0;
  players = [];
  gameStarted = false;

  document.querySelector('.container').classList.remove('gameplay');
  document.getElementById('mobileButtonBar').classList.remove('active');

  showCourseSelection();
  document.getElementById('playerSetup').classList.remove('hidden');
  document.getElementById('holePlay').classList.remove('active');
  document.getElementById('summarySection').classList.remove('active');

  document.getElementById('playerInputs').innerHTML = `
    <div class="player-input">
      <input type="text" placeholder="Player 1 name" aria-label="Name of Player 1" maxlength="20" autocomplete="off" autocapitalize="words">
      <button type="button" onclick="removePlayer(this)" aria-label="Remove player">×</button>
    </div>
    <div class="player-input">
      <input type="text" placeholder="Player 2 name" aria-label="Name of Player 2" maxlength="20" autocomplete="off" autocapitalize="words">
      <button type="button" onclick="removePlayer(this)" aria-label="Remove player">×</button>
    </div>
  `;
}

function newGame() {
  localStorage.removeItem(STORAGE_KEY);
  resetGame();
}

////////////////////////////////////////////////////////////////////////////////
// State Persistence
////////////////////////////////////////////////////////////////////////////////
function saveState() {
  const state = {
    course: currentCourse,
    hole: currentHole,
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
    gameStarted = gs;

    if (gameStarted) {
      showCourseDisplay();
    } else {
      showCourseSelection();
    }

    players = ps.map(p => ({
      name: p.name,
      scores: p.scores,
      total: p.scores.filter(s => s !== null).reduce((a, b) => a + b, 0)
    }));

    document.getElementById('playerSetup').classList.add('hidden');
    document.getElementById('holePlay').classList.add('active');
    currentHole = hole;
    renderHole();
    updateMobileButtons();

    return true;
  } catch (e) {
    console.error('Failed to load saved state:', e);
    return false;
  }
}

////////////////////////////////////////////////////////////////////////////////
// Utilities
////////////////////////////////////////////////////////////////////////////////
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  // Simple alert for now - could be enhanced with a toast UI
  alert(message);
}

////////////////////////////////////////////////////////////////////////////////
// Event Listeners
////////////////////////////////////////////////////////////////////////////////
window.addEventListener('popstate', () => {
  const modal = document.getElementById('scorecardModal');
  if (modal.classList.contains('active')) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
});

window.addEventListener('resize', updateMobileButtons);
window.addEventListener('orientationchange', () => setTimeout(updateMobileButtons, 100));

document.addEventListener('keydown', (e) => {
  if (!gameStarted) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      previousHole();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (players.every(p => p.scores[currentHole] !== null)) {
        nextHole();
      }
      break;
    case 's':
    case 'S':
      e.preventDefault();
      showScorecards();
      break;
    case 'Escape':
      hideScorecards();
      break;
  }
});

// Passive touch listener for better scroll performance
document.addEventListener('touchstart', () => {}, { passive: true });

////////////////////////////////////////////////////////////////////////////////
// Initialize
////////////////////////////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', () => {
  attachCourseListeners();

  if (!loadState()) {
    showCourseSelection();
  }

  updateMobileButtons();
});
