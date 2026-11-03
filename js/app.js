/*
 * The Big Minigame — UI controller.
 */
(function () {
  'use strict';
  var BMG = window.BMG, E = BMG.engine, CFG = BMG.config;
  var STORE_KEY = 'bmg:v1';
  var $app = document.getElementById('app');
  var params = new URLSearchParams(location.search);

  var THEME_EMOJI = { holiday: '🎄', newyear: '🎉', winter: '❄️', valentine: '💘', stpatricks: '🍀', spring: '🌷',
    summer: '☀️', july4: '🎆', fall: '🍂', halloween: '🎃', thanksgiving: '🦃' };

  // ---------- storage (always fails soft) ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode etc. */ }
  }
  if (params.has('reset')) { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }
  var store = load();
  // NOTE: `store` is reassigned on reset
  store.attempts = store.attempts || {};
  store.history = store.history || {};

  // ---------- state ----------
  var S = {
    puzzles: [], schedule: [], today: 0, day: 0, puzzle: null, attempt: null,
    theme: null, themeId: null, editing: {}, drafts: {}, guessDraft: '', lastFeedback: null, preview: (CFG.allowPreviewParam !== false && params.has('preview')) || !!CFG.preview
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function host(id) { return CFG.hosts.filter(function (h) { return h.id === id; })[0] || { id: id, name: id, domain: '', color: '#888', avatar: {} }; }
  function avatar(h, size) {
    return BMG.avatarSVG(h.avatar || {}, { size: size, seasonalHat: S.theme && S.theme.hat, title: h.name });
  }
  function fmtDate(iso) {
    var p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  }

  // ---------- boot ----------
  // The public site ships puzzles scrambled (base64 + XOR) so a peek at the file doesn't spoil answers.
  // This is not security, just a spoiler guard.
  function unscramble(txt) {
    var key = 'its-so-wavy', bin = atob(txt.trim()), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function boot() {
    var themeId = params.get('theme') || CFG.forceTheme || BMG.themes.themeForDate(new Date());
    S.themeId = themeId;
    S.theme = BMG.themes.applyTheme(themeId);

    var file = CFG.puzzleFile || 'data/puzzles.json';
    fetch(file, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return /\.dat$/.test(file) ? r.text().then(unscramble) : r.json(); })
      .then(function (data) {
        S.puzzles = data.puzzles || [];
        route();
      })
      .catch(function (err) {
        $app.innerHTML = '<div class="splash"><p class="press">CONNECTION LOST</p><p>Couldn\'t load today\'s puzzle (' + esc(err.message) + '). Try refreshing.</p></div>';
      });
  }

  function route() {
    var todayIso = E.localISODate(new Date());
    var realToday = E.dayNumber(CFG.launchDate, todayIso);
    if (S.preview) {
      // every puzzle in the bank is unlocked; "today" is the last one
      S.schedule = E.buildSchedule(S.puzzles, CFG.launchDate, 9999, true);
      S.today = Math.max(1, S.schedule.length);
    } else {
      S.today = realToday;
      if (S.today < 1) return renderCountdown();
      S.schedule = E.buildSchedule(S.puzzles, CFG.launchDate, S.today, false);
    }
    if (!store.introSeen) return renderIntro();

    var hashDay = /day-?=?(\d+)/.exec(location.hash || '');
    var want = parseInt(hashDay ? hashDay[1] : params.get('day'), 10);
    var day = isFinite(want) && want >= 1 ? want : (S.preview ? 1 : S.today);
    if (day > S.today) day = S.today; // no peeking ahead
    S.day = day;
    S.puzzle = S.schedule[day - 1] || null;
    if (!S.puzzle) return renderEmpty();

    var id = S.puzzle.id;
    if (!store.attempts[id] || store.attempts[id].submittedAnswers.length !== S.puzzle.questions.length) {
      store.attempts[id] = E.newAttempt(S.puzzle);
    }
    S.attempt = store.attempts[id];
    S.editing = {}; S.drafts = {};
    if (S.draftFor !== id) { S.guessDraft = ''; S.draftFor = id; }
    S.lastFeedback = null;
    render();
  }

  // ---------- pre-launch & intro ----------
  // A host's catchphrase. Hosts with several lines rotate by day.
  function hostLine(h) {
    var L = h.lines || [];
    if (!L.length) return '';
    return L[((S.day || 1) - 1) % L.length];
  }

  function lineup() {
    return '<div class="lineup">' + CFG.hosts.map(function (h) {
      return '<figure>' + avatar(h, 72) + '<figcaption>' + esc(h.name.toUpperCase()) + '<small>' + esc(h.domain) + '</small></figcaption></figure>';
    }).join('') + '</div>';
  }

  function renderCountdown() {
    function tick() {
      var p = CFG.launchDate.split('-').map(Number);
      var ms = new Date(p[0], p[1] - 1, p[2]).getTime() - Date.now();
      if (ms <= 0) { location.reload(); return; }
      var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      var el = document.getElementById('clock');
      if (el) el.textContent = d + 'D ' + pad(h) + ':' + pad(m) + ':' + pad(s);
    }
    $app.innerHTML =
      '<div class="splash">' + logoHTML() +
      '<p class="gift">INSERT COIN…<br>THE WARCHEST OPENS IN</p>' +
      '<div class="clock" id="clock">--</div>' + playerCard() +
      '<p class="sub" style="margin:22px 0 4px;color:var(--muted)">YOUR HOSTS</p>' + lineup() +
      '<p class="press">' + esc(fmtLaunch()) + '</p></div>';
    tick(); setInterval(tick, 1000);
  }
  function fmtLaunch() {
    var p = CFG.launchDate.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function playerCard(noSub) {
    if (!CFG.playerAvatar) return '';
    return '<div class="player-card">' + BMG.avatarSVG(CFG.playerAvatar, { size: 112, seasonalHat: S.theme && S.theme.hat, title: CFG.player }) +
      '<span class="banner" style="animation:none">PLAYER 1: ' + esc(CFG.player.toUpperCase()) + '</span>' +
      (noSub ? '' : '<p class="player-sub">Six friends. Six questions a day. One hidden category.<br>Only ' + esc(CFG.player) + ' can crack it.</p>') + '</div>';
  }

  function renderIntro() {
    $app.innerHTML =
      '<div class="splash">' + logoHTML() +
      '<p class="gift">A GIFT FROM YOUR<br>SECRET SANTA</p>' +
      playerCard(true) +
      '<p>' + esc(CFG.player) + ', your six friends are writing you a new puzzle every day.</p>' +
      lineup() +
      '<div class="px" style="padding:14px;text-align:left;margin:0 0 20px">' + rulesHTML() + '</div>' +
      '<button class="btn wide" type="button" data-action="start">PRESS START</button></div>';
  }

  function rulesHTML() {
    var n = CFG.categoryAttempts;
    return '<ol>' +
      '<li>Answer all six questions. You won\'t be told if you\'re right.</li>' +
      '<li>All six answers fit one <b>hidden category</b>. Once every question has an answer, guess what it is in plain words.</li>' +
      '<li><b>Wrong category?</b> You only hear that it\'s wrong.</li>' +
      '<li><b>Right category?</b> It locks in, and you learn <i>how many</i> of your answers are wrong, but not which ones.</li>' +
      '<li>Fix your answers and check again. You win when the category and all six answers are right.</li>' +
      '</ol>' +
      (n ? '<p class="hint">You get ' + n + ' credits a day. Each category guess or answer check uses one. Run out and the solution is revealed.</p>' : '');
  }

  function renderEmpty() {
    $app.innerHTML = topBar() + logoHTML() +
      '<div class="px console"><h2>NO PUZZLE TODAY</h2><p class="sub">The six hosts are still writing. Check back tomorrow!</p></div>';
  }

  // ---------- main game ----------
  function logoHTML() {
    return '<div class="logo"><h1><small>THE</small>BIG MINIGAME</h1></div>';
  }
  function topBar() {
    var bar = S.preview ? '<div class="preview-bar">PREVIEW · ' + S.schedule.length + ' PUZZLES · <a href="#" data-action="archive">PICK DAY</a> · <a href="#" data-action="reset">RESET</a></div>' : '';
    return bar + '<div class="top">' +
      '<button class="icon-btn" type="button" data-action="help" aria-label="How to play">?</button>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="icon-btn" type="button" data-action="archive" aria-label="Past puzzles">◷</button>' +
      '<button class="icon-btn" type="button" data-action="stats" aria-label="Stats">▤</button></div></div>';
  }

  function render() {
    var P = S.puzzle, A = S.attempt;
    var ph = E.phase(P, A, CFG);
    var filled = A.submittedAnswers.filter(function (a) { return a && a.trim(); }).length;
    var total = P.questions.length;
    var isToday = S.day === S.today;
    var dateIso = E.isoForDay(CFG.launchDate, S.day);

    var html = topBar() + logoHTML() +
      '<div class="meta">#' + S.day + ' · ' + esc(fmtDate(dateIso)) + (isToday || S.preview ? '' : ' · ARCHIVE') + '</div>' +
      '<div class="banner-wrap"><span class="banner">' + esc(S.theme.banner) + '</span></div>';

    if (A.completed) html += resultsHTML();

    html += '<div class="strip" aria-hidden="true">' + P.questions.map(function (q, i) {
      var h = host(q.hostId), on = !!(A.submittedAnswers[i] && A.submittedAnswers[i].trim());
      return '<div class="slot' + (on ? ' on' : '') + '">' + avatar(h, 40) + '<div class="lamp"></div></div>';
    }).join('') + '</div>';
    if (!A.completed) {
      html += '<p class="progress-text">' + (filled < total
        ? filled + ' OF ' + total + ' LOCKED IN · ' + (total - filled) + ' TO GO'
        : 'ALL SIX LOCKED IN · CATEGORY UNLOCKED ↓') + '</p>';
    }

    var results = A.completed ? E.revealResults(P, A) : null;
    P.questions.forEach(function (q, i) { html += questionHTML(q, i, results && results[i]); });

    if (!A.completed) html += consoleHTML(ph, filled, total);
    html += '<p class="footer">Made with love for ' + esc(CFG.player) + ' · <a href="#" data-action="help">How to play</a></p>';

    var focusId = document.activeElement && document.activeElement.id;
    $app.innerHTML = html;
    if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus();
  }

  function questionHTML(q, i, res) {
    var h = host(q.hostId), A = S.attempt;
    var val = A.submittedAnswers[i] || '';
    var submitted = !!val.trim();
    var editing = !A.completed && (!submitted || S.editing[i]);
    var shown = editing && S.drafts[i] != null ? S.drafts[i] : val;
    var cls = 'q px' + (A.completed ? ' done ' + (res.correct ? 'right' : 'wrong') : '');
    var out = '<article class="' + cls + '" id="q' + i + '" style="--host:' + esc(h.color) + '">' +
      '<div class="q-head"><div class="q-avatar">' + avatar(h, 48) + '</div>' +
      '<div class="who"><div class="name">' + esc(h.name.toUpperCase()) + '</div><span class="domain">' + esc(h.domain) + '</span>' +
        (S.bubble && S.bubble.i === i && Date.now() < S.bubble.until && hostLine(h) ? '<div class="bubble pop-in" id="bubble' + i + '">' + esc(hostLine(h)) + '</div>' : '') + '</div>' +
      '<div class="q-num">Q' + (i + 1) + '</div></div>' +
      '<p class="q-prompt">' + esc(q.prompt) + '</p>';
    if (editing) {
      out += '<form class="answer-row" data-form="answer" data-i="' + i + '">' +
        '<label class="sr" for="a' + i + '">Answer to question ' + (i + 1) + '</label>' +
        '<input id="a' + i + '" name="a" autocomplete="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="done" maxlength="80" placeholder="Your answer" value="' + esc(shown) + '">' +
        '<button class="btn" type="submit">LOCK IN</button></form>';
    } else {
      out += '<div class="locked-answer"><div class="chip">' + esc(val) + '</div>' +
        (A.completed ? '' : '<button class="btn ghost" type="button" data-action="edit" data-i="' + i + '">EDIT</button>') + '</div>';
    }
    if (A.completed) {
      out += '<div class="reveal">' + (res.correct
        ? '<span class="mark good">✓ RIGHT</span>'
        : '<span class="mark bad">✗</span> Answer: <b>' + esc(q.canonicalAnswer) + '</b>') + '</div>';
      if (q.explanation) out += '<p class="hint">' + esc(q.explanation) + '</p>';
    }
    return out + '</article>';
  }

  function coins() {
    var n = CFG.categoryAttempts;
    if (!n) return '';
    var used = E.attemptsUsed(S.attempt), out = '<div class="credits">CREDITS ';
    for (var i = 0; i < n; i++) out += '<span class="coin' + (i < used ? ' spent' : '') + '"></span>';
    return out + '</div>';
  }

  function consoleHTML(ph, filled, total) {
    var A = S.attempt, P = S.puzzle;
    var out = '<section class="console px" id="console"><h2>THE MYSTERY CATEGORY</h2>';
    if (filled < total) {
      return out + '<div class="lock">' + lockIcon() + '<div>ANSWER ALL SIX TO UNLOCK<br>' + (total - filled) + ' TO GO</div></div></section>';
    }
    out += '<p class="sub">Here are your six answers. What connects them?</p><div class="board">' +
      P.questions.map(function (q, i) {
        return '<button type="button" data-action="jump" data-i="' + i + '" aria-label="Edit answer ' + (i + 1) + '">' + avatar(host(q.hostId), 32) +
          '<span>' + esc(A.submittedAnswers[i]) + '</span></button>';
      }).join('') + '</div>';
    out += coins();

    var fb = S.lastFeedback;
    if (A.categoryConfirmed) {
      var last = A.categoryAttempts[A.categoryAttempts.length - 1];
      var confirmedGuess = A.categoryAttempts.filter(function (x) { return x.categoryCorrect && x.guess; })[0];
      var unchanged = last && sameAnswers(last.answersSnapshot, A.submittedAnswers);
      out += '<div class="confirmed"><span class="big">✓ CATEGORY CONFIRMED</span><q>' + esc(confirmedGuess ? confirmedGuess.guess : '') + '</q></div>';
      out += '<div class="feedback bad' + (fb && fb.fresh ? ' pop' : '') + '"><span class="big">' + wrongText(last.wrongAnswerCount) + '</span>' +
        (last.wrongAnswerCount === 1 ? 'One of your answers doesn\'t fit.' : 'Some of your answers don\'t fit.') + ' Tap an answer above to change it, then check again.</div>';
      out += '<div style="margin-top:14px"><button class="btn alt wide" type="button" data-action="check"' + (unchanged ? ' disabled' : '') + '>' +
        (unchanged ? 'CHANGE AN ANSWER TO CHECK' : 'CHECK ANSWERS · 1 CREDIT') + '</button></div>';
    } else {
      out += '<form class="guess-row" data-form="guess"><label class="sr" for="guess">Category guess</label>' +
        '<input id="guess" name="g" autocomplete="off" autocapitalize="sentences" spellcheck="true" enterkeyhint="go" maxlength="120" placeholder="e.g. Things that are…" value="' + esc(S.guessDraft) + '">' +
        '<button class="btn red" type="submit">GUESS</button></form>';
      if (ph === 'category_incorrect') {
        out += '<div class="feedback bad' + (fb && fb.fresh ? ' shake' : '') + '"><span class="big">✗ CATEGORY INCORRECT</span>' +
          'That\'s not the connection. Rethink it, and feel free to change answers.</div>';
      }
      var wrongs = A.categoryAttempts.filter(function (x) { return !x.categoryCorrect; });
      if (wrongs.length) out += '<p class="tried">Tried: ' + wrongs.map(function (x) { return '<s>' + esc(x.guess) + '</s>'; }).join(', ') + '</p>';
    }
    if (fb) fb.fresh = false;
    return out + '</section>';
  }

  function wrongText(n) { return n === 1 ? '1 ANSWER IS WRONG' : n + ' ANSWERS ARE WRONG'; }
  function sameAnswers(a, b) {
    if (!a) return false;
    for (var i = 0; i < b.length; i++) if (E.normalize(a[i]) !== E.normalize(b[i])) return false;
    return true;
  }
  function lockIcon() {
    var g = ['..XXXX..', '.X....X.', '.X....X.', 'YYYYYYYY', 'YYYZZYYY', 'YYYZZYYY', 'YYYYYYYY', 'YYYYYYYY'];
    var r = '';
    g.forEach(function (row, y) { row.split('').forEach(function (c, x) {
      if (c === '.') return;
      r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + (c === 'X' ? 'var(--muted)' : c === 'Z' ? 'var(--line)' : 'var(--glow)') + '"/>';
    }); });
    return '<svg viewBox="0 0 8 8" width="48" height="48" shape-rendering="crispEdges" aria-hidden="true">' + r + '</svg>';
  }

  // ---------- results ----------
  function resultsHTML() {
    var P = S.puzzle, A = S.attempt, sc = A.score || E.score(P, A, CFG);
    var st = stats();
    var out = '<section class="results px pop" id="results">' +
      '<div class="stamp' + (A.assisted ? ' assisted' : '') + '">' + (A.assisted ? 'GAME OVER<br>SOLUTION REVEALED' : 'SOLVED!' + (CFG.winLine ? '<small class="win-line">' + (CFG.playerAvatar ? avatar({ name: CFG.player, avatar: CFG.playerAvatar }, 40) : '') + '<span>&ldquo;' + esc(CFG.winLine) + '&rdquo;</span></small>' : '')) + '</div>' +
      '<p class="sub" style="margin:0 0 6px;color:var(--muted)">THE CATEGORY</p>' +
      '<p class="cat-title">' + esc(P.category.title) + '</p>' +
      (P.category.explanation ? '<p class="explain">' + esc(P.category.explanation) + '</p>' : '') +
      '<div class="score-grid">' +
      '<div><b>' + sc.total + '</b><span>points</span></div>' +
      '<div><b>' + sc.correctAnswers + '/6</b><span>answers</span></div>' +
      '<div><b>' + st.currentStreak + '</b><span>day streak</span></div></div>' +
      '<div class="btn-row"><button class="btn" type="button" data-action="share">SHARE</button>' +
      '<button class="btn ghost" type="button" data-action="stats">STATS</button></div>';
    if (S.day === S.today) out += '<p class="next">NEXT PUZZLE IN <span id="next">' + untilMidnight() + '</span></p>';
    else out += '<p class="next"><a href="#day-' + S.today + '" data-action="goto" data-day="' + S.today + '" style="color:var(--glow)">' + (S.preview ? 'NEXT: PICK ANOTHER DAY' : 'BACK TO TODAY\'S PUZZLE') + '</a></p>';
    return out + '</section>';
  }
  function untilMidnight() {
    var n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    var ms = m - n, h = Math.floor(ms / 36e5), mi = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    return pad(h) + ':' + pad(mi) + ':' + pad(s);
  }
  setInterval(function () {
    var el = document.getElementById('next');
    if (el) el.textContent = untilMidnight();
  }, 1000);

  function shareText() {
    var A = S.attempt, sc = A.score;
    var trail = A.categoryAttempts.map(function (x) { return !x.categoryCorrect ? '❌' : x.wrongAnswerCount ? '🟨' : '✅'; }).join('');
    if (A.assisted) trail += '💀';
    var lines = [
      'THE BIG MINIGAME #' + S.day + ' ' + (THEME_EMOJI[S.themeId] || '🕹️'),
      '🔍 ' + trail,
      '🎯 ' + sc.correctAnswers + '/6 answers' + (A.answerEdits ? ' · ' + A.answerEdits + (A.answerEdits === 1 ? ' fix' : ' fixes') : ''),
      '⭐ ' + sc.total + ' pts' + (stats().currentStreak > 1 ? ' · 🔥 ' + stats().currentStreak : '')
    ];
    return lines.join('\n') + '\n' + location.origin + location.pathname;
  }

  // ---------- stats ----------
  function stats() {
    var onTime = {}, all = {};
    Object.keys(store.history).forEach(function (d) {
      all[d] = store.history[d];
      if (store.history[d].onTime) onTime[d] = store.history[d];
    });
    var a = E.computeStats(all, S.today), b = E.computeStats(onTime, S.today);
    a.currentStreak = b.currentStreak; a.maxStreak = b.maxStreak;
    return a;
  }

  function recordFinish() {
    var A = S.attempt;
    store.history[S.day] = {
      puzzleId: S.puzzle.id, completed: true, assisted: A.assisted, score: A.score,
      firstTryCategory: !!(A.categoryAttempts[0] && A.categoryAttempts[0].categoryCorrect),
      onTime: S.day === S.today, edits: A.answerEdits, attempts: A.categoryAttempts.length,
      seconds: Math.round((A.completedAt - A.startedAt) / 1000)
    };
  }

  // ---------- modals ----------
  function openModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal').hidden = false;
  }
  function closeModal() { document.getElementById('modal').hidden = true; }

  function statsModal() {
    var st = stats();
    var played = st.played || 0;
    openModal('<h2 id="modal-title">STATS</h2><div class="stats">' +
      '<div><b>' + played + '</b><span>played</span></div>' +
      '<div><b>' + st.solved + '</b><span>solved</span></div>' +
      '<div><b>' + st.assisted + '</b><span>assisted</span></div>' +
      '<div><b>' + st.currentStreak + '</b><span>streak</span></div>' +
      '<div><b>' + st.maxStreak + '</b><span>best streak</span></div>' +
      '<div><b>' + st.averageScore + '</b><span>avg score</span></div></div>' +
      '<p class="hint">Category on the first try: ' + st.firstTryCategory + ' of ' + played + '. Streaks count puzzles solved on their own day without running out of credits.</p>');
  }

  function archiveModal() {
    var items = [];
    var order = [];
    for (var k = S.today; k >= 1; k--) order.push(k);
    if (S.preview) order.reverse();
    order.forEach(function (d) {
      if (!S.schedule[d - 1]) return;
      var h = store.history[d], tag = d === S.today ? '<span class="tag today">TODAY</span>' : '';
      if (h) tag += h.assisted ? '<span class="tag assisted">ASSISTED</span>' : '<span class="tag solved">' + (h.score ? h.score.total : '') + ' PTS</span>';
      else if (store.attempts[S.schedule[d - 1].id]) tag += '<span class="tag">IN PROGRESS</span>';
      else if (d !== S.today) tag += '<span class="tag">PLAY</span>';
      var label = S.preview ? esc(S.schedule[d - 1].category.title) : esc(fmtDate(E.isoForDay(CFG.launchDate, d)));
      if (S.preview && d === S.day) tag = '<span class="tag today">PLAYING</span>' + (h ? '' : '');
      items.push('<li><a href="#day-' + d + '" data-action="goto" data-day="' + d + '"><span>#' + d + ' · ' + (S.preview && !h ? fmtDate(E.isoForDay(CFG.launchDate, d)) : label) + '</span>' + tag + '</a></li>');
    });
    var intro = S.preview ? 'Preview only: every puzzle in the bank, by launch date. Titles show after you finish one.' : 'Missed a day? Play it here. Late plays count toward your stats but not your streak.';
    openModal('<h2 id="modal-title">' + (S.preview ? 'ALL PUZZLES' : 'PAST PUZZLES') + '</h2><p class="hint" style="margin-top:0">' + intro + '</p><ul class="archive">' + items.join('') + '</ul>');
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function capFirst(v) { return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; }

  // ---------- events ----------
  document.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-form');
    if (!kind) return;
    e.preventDefault();
    if (kind === 'answer') {
      var i = +f.getAttribute('data-i'), v = capFirst(f.querySelector('input').value.trim());
      if (!v) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); return; }
      var before = E.allSubmitted(S.attempt);
      E.setAnswer(S.attempt, i, v);
      delete S.editing[i]; delete S.drafts[i];
      S.bubble = { i: i, until: Date.now() + 3000 };
      clearTimeout(S.bubbleTimer);
      S.bubbleTimer = setTimeout(function () { var b = document.getElementById('bubble' + i); if (b) b.remove(); S.bubble = null; }, 3000);
      save();
      if (document.activeElement) document.activeElement.blur();
      render();
      // move to the next empty question, or to the category console once all six are in
      var next = S.attempt.submittedAnswers.findIndex(function (a) { return !a || !a.trim(); });
      if (next >= 0) focusQ(next);
      else if (!before) { var c = document.getElementById('console'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } else if (kind === 'guess') {
      var g = capFirst(f.querySelector('input').value.trim());
      if (!g) return;
      var repeat = S.attempt.categoryAttempts.some(function (x) { return x.guess && E.normalize(x.guess) === E.normalize(g) && sameAnswers(x.answersSnapshot, S.attempt.submittedAnswers); });
      if (repeat) { toast('YOU ALREADY TRIED THAT ONE'); return; }
      doGuess(g);
    }
  });

  function doGuess(g) {
    var res = E.submitGuess(S.puzzle, S.attempt, g, CFG);
    if (res.result === 'locked') return;
    S.lastFeedback = { result: res.result, fresh: true };
    if (res.result === 'category_incorrect') S.guessDraft = '';
    if (S.attempt.completed) recordFinish();
    save();
    if (document.activeElement) document.activeElement.blur();
    render();
    var target = S.attempt.completed ? document.getElementById('results') : document.getElementById('console');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (res.result === 'solved') toast((CFG.winLine ? CFG.winLine.toUpperCase() + '! ' : 'PERFECT! ') + '+' + S.attempt.score.total + ' PTS');
  }

  // Keep the whole question card (host, prompt and answer box) on screen, even after the
  // phone keyboard opens and shrinks the visible area.
  var activeQ = null;
  function showCard(i, smooth) {
    var card = document.getElementById('q' + i);
    if (!card) return;
    var vv = window.visualViewport, viewH = vv ? vv.height : window.innerHeight;
    var r = card.getBoundingClientRect(), top = window.scrollY + r.top;
    // center the card in the visible area; if it is taller than that, pin its top
    var y = r.height < viewH - 24 ? top - (viewH - r.height) / 2 : top - 12;
    window.scrollTo({ top: Math.max(0, y), left: 0, behavior: smooth ? 'smooth' : 'auto' });
  }
  function focusQ(i) {
    var el = document.getElementById('a' + i);
    if (!el) return;
    activeQ = i;
    el.focus({ preventScroll: true });
    showCard(i, true);
    setTimeout(function () { if (activeQ === i) showCard(i, false); }, 350);
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function () {
    if (activeQ != null && document.activeElement && document.activeElement.id === 'a' + activeQ) showCard(activeQ, false);
  });
  document.addEventListener('focusin', function (e) {
    var m = /^a(\d+)$/.exec(e.target.id || '');
    activeQ = m ? +m[1] : null;
  });

  document.addEventListener('input', function (e) {
    // capitalize the first letter live, as you type
    var t = e.target;
    if (t.tagName === 'INPUT' && (t.id === 'guess' || /^a\d+$/.test(t.id)) && t.value && t.value.charAt(0) !== t.value.charAt(0).toUpperCase()) {
      var pos = t.selectionStart, end = t.selectionEnd;
      t.value = t.value.charAt(0).toUpperCase() + t.value.slice(1);
      try { t.setSelectionRange(pos, end); } catch (err) {}
    }
    if (e.target.id === 'guess') S.guessDraft = e.target.value;
    var m = /^a(\d+)$/.exec(e.target.id || '');
    if (m) S.drafts[+m[1]] = e.target.value;
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) { if (e.target.id === 'modal') closeModal(); return; }
    var a = t.getAttribute('data-action');
    if (a === 'start') { store.introSeen = true; save(); route(); window.scrollTo(0, 0); }
    else if (a === 'help') { e.preventDefault(); openModal('<h2 id="modal-title">HOW TO PLAY</h2>' + rulesHTML() + '<h2 style="margin-top:18px">YOUR HOSTS</h2>' + lineup()); }
    else if (a === 'stats') statsModal();
    else if (a === 'archive') { e.preventDefault(); if (S.schedule.length) archiveModal(); }
    else if (a === 'close-modal') closeModal();
    else if (a === 'edit' || a === 'jump') {
      var i = +t.getAttribute('data-i');
      S.editing[i] = true; render(); focusQ(i);
      var inp = document.getElementById('a' + i); if (inp) inp.select();
    }
    else if (a === 'check') doGuess(null);
    else if (a === 'goto') {
      e.preventDefault(); closeModal();
      if (S.preview && t.getAttribute('data-day') == S.today && S.day === S.today) { archiveModal(); return; }
      try { history.replaceState(null, '', '#day-' + t.getAttribute('data-day')); } catch (err) {}
      route(); window.scrollTo(0, 0);
    }
    else if (a === 'reset') {
      e.preventDefault();
      if (!t.hasAttribute('data-armed')) { t.setAttribute('data-armed', ''); t.textContent = 'TAP AGAIN TO ERASE'; return; }
      try { localStorage.removeItem(STORE_KEY); } catch (err) {}
      store = { attempts: {}, history: {} }; BMG.app.store = store;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (err) {}
      toast('PROGRESS ERASED'); route(); window.scrollTo(0, 0);
    }
    else if (a === 'share') share();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function share() {
    var text = shareText();
    function manual() {
      openModal('<h2 id="modal-title">SHARE YOUR RESULT</h2><p class="hint" style="margin-top:0">Copy this into the group chat:</p>' +
        '<textarea id="share-text" class="share-box" readonly>' + esc(text) + '</textarea>');
      var ta = document.getElementById('share-text'); if (ta) { ta.focus(); ta.select(); }
    }
    function copy() {
      if (!navigator.clipboard) return manual();
      navigator.clipboard.writeText(text).then(function () { toast('COPIED! PASTE IT IN THE GROUP CHAT'); }, manual);
    }
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && touch) {
      navigator.share({ text: text }).catch(function (err) { if (!err || err.name !== 'AbortError') manual(); });
    } else copy();
  }

  // expose for debugging / tests
  window.addEventListener('hashchange', function () { if (S.puzzles.length) { route(); window.scrollTo(0, 0); } });
  BMG.app = { state: S, store: store, shareText: shareText };
  boot();
})();
