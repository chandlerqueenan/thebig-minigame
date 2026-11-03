/*
 * The Big Minigame — game engine.
 * Pure logic only: no DOM, no storage. Works in the browser (window.BMG) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BMG = Object.assign(root.BMG || {}, { engine: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- text normalisation & fuzzy matching ----------

  var NUMBER_WORDS = {
    zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
    eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
    fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20'
  };

  function normalize(s) {
    if (s == null) return '';
    s = String(s).toLowerCase();
    s = s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; // strip accents
    s = s.replace(/&/g, ' and ');
    s = s.replace(/['’`]/g, '');            // don't -> dont
    s = s.replace(/[^a-z0-9]+/g, ' ');       // punctuation -> space
    s = s.trim().split(/\s+/).map(function (w) { return NUMBER_WORDS[w] || w; }).join(' ');
    return s;
  }

  // For single answers we also drop leading articles: "The Beatles" == "Beatles".
  function normalizeAnswer(s) {
    return normalize(s).replace(/^(the|a|an) /, '');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1), cur = new Array(b.length + 1), i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }

  // Typo budget grows with word length. Short words and numbers must be exact.
  function typoBudget(len) {
    if (len <= 4) return 0;
    if (len <= 7) return 1;
    return 2;
  }

  function fuzzyEqual(a, b) {
    if (a === b) return true;
    if (/\d/.test(a) || /\d/.test(b)) return a.replace(/ /g, '') === b.replace(/ /g, '');
    var ca = a.replace(/ /g, ''), cb = b.replace(/ /g, '');
    if (ca === cb) return true; // "spider man" == "spiderman"
    return levenshtein(ca, cb) <= typoBudget(Math.min(ca.length, cb.length));
  }

  // ---------- answer judging ----------

  function answerVariants(q) {
    var list = [q.canonicalAnswer].concat(q.acceptedAnswers || []);
    var out = [];
    list.forEach(function (v) {
      var n = normalizeAnswer(v);
      if (n && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }

  function isAnswerCorrect(q, submitted) {
    var s = normalizeAnswer(submitted);
    if (!s) return false;
    var variants = answerVariants(q);
    for (var i = 0; i < variants.length; i++) {
      if (fuzzyEqual(s, variants[i])) return true;
    }
    // Allow a plural/singular slip on a whole answer ("bats" vs "bat").
    var sing = s.replace(/(es|s)$/, '');
    for (i = 0; i < variants.length; i++) {
      if (sing === variants[i].replace(/(es|s)$/, '')) return true;
    }
    return false;
  }

  // ---------- category judging ----------
  //
  // A category guess is correct if EITHER
  //   (a) it fuzzy-matches one of category.acceptedGuesses, OR
  //   (b) for every group in category.keywords, the guess contains at least one
  //       term from that group (each term may be a word or a phrase; words are
  //       matched with light typo tolerance and plural folding).
  // category.rejectKeywords (optional) lists terms that make a guess wrong
  // even if (b) passes, to stop over-broad guesses.

  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function wordMatches(guessWord, term) {
    var g = stem(guessWord), t = stem(term);
    if (g === t) return true;
    if (/\d/.test(g) || /\d/.test(t)) return false;
    // one typo allowed on longer keywords only, so 'sports' never matches 'spots'
    return t.length >= 6 && levenshtein(g, t) <= 1;
  }

  function containsTerm(guessWords, term) {
    var tWords = normalize(term).split(' ').filter(Boolean);
    if (!tWords.length) return false;
    for (var i = 0; i + tWords.length <= guessWords.length; i++) {
      var ok = true;
      for (var j = 0; j < tWords.length; j++) {
        if (!wordMatches(guessWords[i + j], tWords[j])) { ok = false; break; }
      }
      if (ok) return true;
    }
    // Also allow a term written as one word in the guess ("spiderman" for "spider man").
    if (tWords.length > 1) {
      var joined = tWords.join('');
      for (i = 0; i < guessWords.length; i++) if (wordMatches(guessWords[i], joined)) return true;
    }
    return false;
  }

  // Whole-guess comparison: stricter than answers, so short guesses must be exact.
  function guessEqual(a, b) {
    var ca = a.replace(/ /g, ''), cb = b.replace(/ /g, '');
    if (ca === cb) return true;
    var len = Math.min(ca.length, cb.length);
    return levenshtein(ca, cb) <= (len < 8 ? 0 : len < 16 ? 1 : 2);
  }

  var FILLER = /^(they are|theyre|these are|its|it is|all|all of them are|things that are|things|words that are|a list of|list of)\s+/;

  function isCategoryCorrect(category, guess) {
    var g = normalize(guess);
    if (!g) return false;
    var stripped = g;
    for (var k = 0; k < 3; k++) stripped = stripped.replace(FILLER, '');

    var accepted = [category.title].concat(category.acceptedGuesses || []);
    for (var i = 0; i < accepted.length; i++) {
      var a = normalize(accepted[i]);
      if (a && (guessEqual(g, a) || guessEqual(stripped, a))) return true;
    }

    var words = g.split(' ');
    if (category.rejectKeywords && category.rejectKeywords.some(function (t) { return containsTerm(words, t); })) {
      return false;
    }
    var groups = category.keywords || [];
    if (!groups.length) return false;
    return groups.every(function (group) {
      return group.some(function (term) { return containsTerm(words, term); });
    });
  }

  // ---------- daily schedule ----------

  function parseISODate(s) {
    var p = s.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }

  function localISODate(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1), day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  // Day 1 is the launch date. Returns <= 0 before launch.
  function dayNumber(launchDate, isoToday) {
    return Math.round((parseISODate(isoToday) - parseISODate(launchDate)) / 86400000) + 1;
  }

  function isoForDay(launchDate, n) {
    var t = parseISODate(launchDate) + (n - 1) * 86400000;
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  var PLAYABLE = ['approved', 'published'];

  function playablePuzzles(puzzles, includeDrafts) {
    return puzzles.filter(function (p) {
      return PLAYABLE.indexOf(p.status) >= 0 || (includeDrafts && p.status === 'review');
    });
  }

  // Puzzles with an explicit date are pinned to it. Everything else fills the
  // remaining days in bank order. The schedule never reshuffles past days as
  // long as new puzzles are appended to the end of the bank.
  function buildSchedule(puzzles, launchDate, days, includeDrafts) {
    var playable = playablePuzzles(puzzles, includeDrafts);
    var pinned = {}, floating = [];
    playable.forEach(function (p) {
      if (p.date) pinned[dayNumber(launchDate, p.date)] = p;
      else floating.push(p);
    });
    var schedule = [], fi = 0;
    for (var n = 1; n <= days; n++) {
      if (pinned[n]) schedule.push(pinned[n]);
      else if (fi < floating.length) schedule.push(floating[fi++]);
      else break;
    }
    return schedule;
  }

  // ---------- game state machine ----------

  function newAttempt(puzzle) {
    return {
      puzzleId: puzzle.id,
      submittedAnswers: puzzle.questions.map(function () { return ''; }),
      answerEdits: 0,
      categoryAttempts: [],
      categoryConfirmed: false,
      completed: false,
      assisted: false,
      startedAt: Date.now(),
      allSubmittedAt: null,
      completedAt: null,
      score: null
    };
  }

  function allSubmitted(attempt) {
    return attempt.submittedAnswers.every(function (a) { return normalize(a).length > 0; });
  }

  function attemptsUsed(attempt) { return attempt.categoryAttempts.length; }

  function attemptsLeft(attempt, config) {
    if (!config.categoryAttempts) return Infinity;
    return Math.max(0, config.categoryAttempts - attemptsUsed(attempt));
  }

  function wrongCount(puzzle, attempt) {
    var n = 0;
    puzzle.questions.forEach(function (q, i) { if (!isAnswerCorrect(q, attempt.submittedAnswers[i])) n++; });
    return n;
  }

  // Returns one of: unanswered | answering | ready | category_incorrect |
  // category_confirmed | completed | assisted
  function phase(puzzle, attempt, config) {
    if (attempt.completed) return attempt.assisted ? 'assisted' : 'completed';
    var filled = attempt.submittedAnswers.filter(function (a) { return normalize(a).length > 0; }).length;
    if (filled === 0) return 'unanswered';
    if (filled < puzzle.questions.length) return 'answering';
    if (attempt.categoryConfirmed) return 'category_confirmed';
    var last = attempt.categoryAttempts[attempt.categoryAttempts.length - 1];
    if (last && !last.categoryCorrect) return 'category_incorrect';
    return 'ready';
  }

  function setAnswer(attempt, index, value) {
    if (attempt.completed) return attempt;
    var prev = attempt.submittedAnswers[index];
    if (normalize(prev) && normalize(prev) !== normalize(value)) attempt.answerEdits++;
    attempt.submittedAnswers[index] = String(value || '').trim();
    if (!attempt.allSubmittedAt && allSubmitted(attempt)) attempt.allSubmittedAt = Date.now();
    return attempt;
  }

  /*
   * Submit a guess. Once the category is confirmed the player calls this with
   * no guess (a "check answers" action) and the confirmed category is reused.
   * Returns { result, wrongAnswerCount?, attemptsLeft, outOfAttempts }
   *   result: locked | category_incorrect | category_correct | solved | out_of_attempts
   */
  function submitGuess(puzzle, attempt, guess, config) {
    if (attempt.completed) return { result: attempt.assisted ? 'out_of_attempts' : 'solved', attemptsLeft: 0 };
    if (!allSubmitted(attempt)) return { result: 'locked', attemptsLeft: attemptsLeft(attempt, config) };
    if (attemptsLeft(attempt, config) <= 0) return revealAssisted(puzzle, attempt, config);

    var categoryCorrect = attempt.categoryConfirmed || isCategoryCorrect(puzzle.category, guess);
    var entry = {
      guess: attempt.categoryConfirmed ? null : String(guess || '').trim(),
      categoryCorrect: categoryCorrect,
      answersSnapshot: attempt.submittedAnswers.slice(),
      at: Date.now()
    };
    var out;
    if (!categoryCorrect) {
      out = { result: 'category_incorrect' };
    } else {
      attempt.categoryConfirmed = true;
      var wrong = wrongCount(puzzle, attempt);
      entry.wrongAnswerCount = wrong;
      if (wrong === 0) {
        attempt.completed = true;
        attempt.completedAt = Date.now();
        out = { result: 'solved' };
      } else {
        out = { result: 'category_correct', wrongAnswerCount: wrong };
      }
    }
    attempt.categoryAttempts.push(entry);
    out.attemptsLeft = attemptsLeft(attempt, config);
    if (attempt.completed) {
      attempt.score = score(puzzle, attempt, config);
    } else if (out.attemptsLeft <= 0) {
      out.outOfAttempts = true;
      revealAssisted(puzzle, attempt, config);
    }
    return out;
  }

  function revealAssisted(puzzle, attempt, config) {
    attempt.completed = true;
    attempt.assisted = true;
    attempt.completedAt = attempt.completedAt || Date.now();
    attempt.score = score(puzzle, attempt, config);
    return { result: 'out_of_attempts', attemptsLeft: 0 };
  }

  function score(puzzle, attempt, config) {
    var s = config.scoring || {};
    var perAnswer = s.perCorrectAnswer != null ? s.perCorrectAnswer : 10;
    var correct = puzzle.questions.length - wrongCount(puzzle, attempt);
    var answerPts = correct * perAnswer;
    var firstCorrect = -1;
    attempt.categoryAttempts.some(function (a, i) { if (a.categoryCorrect) { firstCorrect = i; return true; } return false; });
    var bonusTable = s.categoryBonusByAttempt || [40, 25, 10];
    var bonus = firstCorrect >= 0 ? (bonusTable[firstCorrect] != null ? bonusTable[firstCorrect] : 0) : 0;
    var total = answerPts + bonus;
    if (attempt.assisted) total = Math.round(total * (s.assistedMultiplier != null ? s.assistedMultiplier : 0.5));
    return { answers: answerPts, correctAnswers: correct, categoryBonus: bonus, total: total, max: puzzle.questions.length * perAnswer + (bonusTable[0] || 0) };
  }

  // Per-question correctness, ONLY for the post-game reveal.
  function revealResults(puzzle, attempt) {
    if (!attempt.completed) throw new Error('Results are hidden until the puzzle is finished.');
    return puzzle.questions.map(function (q, i) {
      return { submitted: attempt.submittedAnswers[i], correct: isAnswerCorrect(q, attempt.submittedAnswers[i]), answer: q.canonicalAnswer };
    });
  }

  // ---------- stats ----------

  function computeStats(history, todayDay) {
    // history: { [dayNumber]: { completed, assisted, score, firstTryCategory } } for daily (not archive) plays
    var days = Object.keys(history).map(Number).sort(function (a, b) { return a - b; });
    var played = 0, solved = 0, assisted = 0, totalScore = 0, firstTry = 0, maxStreak = 0, run = 0, prev = null;
    days.forEach(function (d) {
      var h = history[d];
      if (!h.completed) return;
      played++;
      totalScore += (h.score && h.score.total) || 0;
      if (h.assisted) assisted++; else solved++;
      if (h.firstTryCategory) firstTry++;
      if (!h.assisted && prev !== null && d === prev + 1) run++;
      else run = h.assisted ? 0 : 1;
      if (h.assisted) { prev = null; } else prev = d;
      maxStreak = Math.max(maxStreak, run);
    });
    // current streak counts back from today (or yesterday if today isn't done yet)
    var cur = 0, d = todayDay;
    if (!(history[d] && history[d].completed && !history[d].assisted)) d--;
    while (history[d] && history[d].completed && !history[d].assisted) { cur++; d--; }
    return { played: played, solved: solved, assisted: assisted, currentStreak: cur, maxStreak: maxStreak,
      averageScore: played ? Math.round(totalScore / played) : 0, firstTryCategory: firstTry };
  }

  return {
    normalize: normalize, normalizeAnswer: normalizeAnswer, levenshtein: levenshtein,
    isAnswerCorrect: isAnswerCorrect, isCategoryCorrect: isCategoryCorrect,
    dayNumber: dayNumber, isoForDay: isoForDay, localISODate: localISODate,
    playablePuzzles: playablePuzzles, buildSchedule: buildSchedule,
    newAttempt: newAttempt, allSubmitted: allSubmitted, attemptsLeft: attemptsLeft, attemptsUsed: attemptsUsed,
    phase: phase, setAnswer: setAnswer, submitGuess: submitGuess, score: score,
    revealResults: revealResults, computeStats: computeStats, wrongCount: wrongCount
  };
});
