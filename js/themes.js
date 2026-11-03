/*
 * The Big Minigame — seasonal themes. Picked automatically from the date.
 */
(function () {
  'use strict';
  // Each theme: palette tokens, a falling-pixel effect, a banner line and an optional avatar hat.
  var THEMES = {
    holiday:    { name: 'Holiday', banner: 'HAPPY HOLIDAYS', hat: 'santa', particles: 'snow',
                  bg: '#0f1a2e', bg2: '#16263f', panel: '#1c3150', ink: '#f4f7ff', muted: '#9fb3cf', accent: '#ff4d5e', accent2: '#3ddc84', glow: '#ffe28a',
                  particleColors: ['#ffffff', '#dce9ff'] },
    newyear:    { name: 'New Year', banner: 'HAPPY NEW YEAR', hat: 'party', particles: 'confetti',
                  bg: '#120f24', bg2: '#1c1736', panel: '#262046', ink: '#fffaf0', muted: '#b9b0d6', accent: '#ffcf4d', accent2: '#c78bff', glow: '#ffcf4d',
                  particleColors: ['#ffcf4d', '#c78bff', '#5be0ff', '#ff6fa8'] },
    winter:     { name: 'Winter', banner: 'STAY FROSTY', hat: null, particles: 'snow',
                  bg: '#0e1b26', bg2: '#132636', panel: '#1a3346', ink: '#eef8ff', muted: '#9cc0d6', accent: '#5bd1ff', accent2: '#b6f0ff', glow: '#b6f0ff',
                  particleColors: ['#ffffff', '#cdefff'] },
    valentine:  { name: 'Valentine', banner: 'BE MINE, PLAYER ONE', hat: null, particles: 'hearts',
                  bg: '#21101c', bg2: '#2f1629', panel: '#3d1d35', ink: '#fff0f6', muted: '#dba8c4', accent: '#ff5d8f', accent2: '#ffb3c9', glow: '#ff9ebd',
                  particleColors: ['#ff5d8f', '#ffb3c9'] },
    stpatricks: { name: "St. Patrick's", banner: 'FEELING LUCKY?', hat: null, particles: 'clovers',
                  bg: '#0c1d14', bg2: '#11281c', panel: '#173525', ink: '#f0fff4', muted: '#9fd1b2', accent: '#3ddc84', accent2: '#ffd54f', glow: '#ffd54f',
                  particleColors: ['#3ddc84', '#2bb36a'] },
    spring:     { name: 'Spring', banner: 'SPRING MODE', hat: null, particles: 'petals',
                  bg: '#141a26', bg2: '#1c2434', panel: '#253046', ink: '#fbfcff', muted: '#b4bed6', accent: '#ff9ecf', accent2: '#9be564', glow: '#ffd6ec',
                  particleColors: ['#ffc4e1', '#ffffff', '#ffe08a'] },
    summer:     { name: 'Summer', banner: 'SUMMER SESSION', hat: null, particles: 'sparkle',
                  bg: '#0b1f2a', bg2: '#0f2b3a', panel: '#15384b', ink: '#fffdf4', muted: '#a9cfdc', accent: '#ffb627', accent2: '#2ee6d6', glow: '#ffe066',
                  particleColors: ['#ffe066', '#ffffff'] },
    july4:      { name: 'Fourth of July', banner: 'STARS & STRIPES', hat: null, particles: 'confetti',
                  bg: '#0d1530', bg2: '#141f42', panel: '#1b2a56', ink: '#ffffff', muted: '#aab8e6', accent: '#ff4d5e', accent2: '#5b9dff', glow: '#ffffff',
                  particleColors: ['#ff4d5e', '#ffffff', '#5b9dff'] },
    fall:       { name: 'Fall', banner: 'SWEATER WEATHER', hat: null, particles: 'leaves',
                  bg: '#1d140d', bg2: '#291c12', panel: '#362518', ink: '#fff6ec', muted: '#d2b79a', accent: '#ff8a3d', accent2: '#ffd166', glow: '#ffd166',
                  particleColors: ['#ff8a3d', '#e2552b', '#ffd166'] },
    halloween:  { name: 'Halloween', banner: 'SPOOKY SEASON', hat: null, particles: 'bats',
                  bg: '#140d1d', bg2: '#1f1430', panel: '#2a1b40', ink: '#fff4e6', muted: '#c2a9d9', accent: '#ff7a1a', accent2: '#9d5cff', glow: '#ff9d4d',
                  particleColors: ['#05030a', '#2b1a3d'] },
    thanksgiving: { name: 'Thanksgiving', banner: 'GOBBLE GOBBLE', hat: null, particles: 'leaves',
                  bg: '#1c120b', bg2: '#281a10', panel: '#352416', ink: '#fff5ea', muted: '#d8bb9c', accent: '#e8833a', accent2: '#c9a227', glow: '#ffcf70',
                  particleColors: ['#e8833a', '#a0522d', '#c9a227'] }
  };

  // [month (1-12), day] inclusive start; first matching window wins.
  function themeForDate(d) {
    var m = d.getMonth() + 1, day = d.getDate(), md = m * 100 + day;
    if (md >= 1227 || md <= 106) return 'newyear';
    if (md >= 1201) return 'holiday';
    if (md >= 1101) return 'thanksgiving';
    if (md >= 1016) return 'halloween';
    if (md >= 915) return 'fall';
    if (md >= 701 && md <= 705) return 'july4';
    if (md >= 601) return 'summer';
    if (md >= 318) return 'spring';
    if (md >= 310) return 'stpatricks';
    if (md >= 208 && md <= 215) return 'valentine';
    return 'winter';
  }

  function applyTheme(id) {
    var t = THEMES[id] || THEMES.winter;
    var r = document.documentElement.style;
    ['bg', 'bg2', 'panel', 'ink', 'muted', 'accent', 'accent2', 'glow'].forEach(function (k) { r.setProperty('--' + k, t[k]); });
    document.documentElement.setAttribute('data-theme', id);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
    startParticles(t);
    return t;
  }

  // ---------- falling pixel particles ----------
  var SPRITES = {
    snow:    [[0, 0]],
    sparkle: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    hearts:  [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    clovers: [[1, 0], [0, 1], [2, 1], [1, 1], [1, 2]],
    petals:  [[0, 0], [1, 0], [1, 1]],
    leaves:  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]],
    confetti:[[0, 0], [1, 0]],
    bats:    [[0, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [3, 2]]
  };
  var raf = null;

  function startParticles(t) {
    var canvas = document.getElementById('fx');
    if (!canvas) return;
    if (raf) cancelAnimationFrame(raf);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = canvas.getContext('2d');
    var P = 4; // pixel size
    var parts = [], w = 0, h = 0;
    function resize() {
      w = canvas.width = Math.ceil(window.innerWidth / P);
      h = canvas.height = Math.ceil(window.innerHeight / P);
    }
    resize();
    window.addEventListener('resize', resize);
    var count = t.particles === 'snow' ? 70 : 32;
    for (var i = 0; i < count; i++) parts.push(spawn(true));
    function spawn(anywhere) {
      return { x: Math.random() * w, y: anywhere ? Math.random() * h : -4, v: 0.08 + Math.random() * 0.18,
        drift: (Math.random() - 0.5) * 0.12, c: t.particleColors[Math.floor(Math.random() * t.particleColors.length)], ph: Math.random() * 6 };
    }
    var sprite = SPRITES[t.particles] || SPRITES.snow;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!reduce) {
          p.y += p.v; p.ph += 0.02;
          p.x += p.drift + Math.sin(p.ph) * 0.05;
          if (p.y > h + 4) parts[i] = spawn(false);
        }
        ctx.fillStyle = p.c;
        ctx.globalAlpha = t.particles === 'bats' ? 0.55 : 0.7;
        for (var j = 0; j < sprite.length; j++) ctx.fillRect(Math.round(p.x) + sprite[j][0], Math.round(p.y) + sprite[j][1], 1, 1);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    draw();
  }

  window.BMG = window.BMG || {};
  window.BMG.themes = { THEMES: THEMES, themeForDate: themeForDate, applyTheme: applyTheme };
})();
