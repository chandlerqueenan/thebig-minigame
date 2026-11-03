/*
 * The Big Minigame — 8-bit host avatars.
 * Builds a 16x16 pixel sprite from simple features and returns an SVG string.
 */
(function () {
  'use strict';
  var W = 16;

  // Base head & shirt. S skin, s skin shadow, B brow (hair colour), W eye white,
  // E pupil, M mouth, T shirt, t shirt shadow.
  var BASE = [
    '................',
    '................',
    '....SSSSSSSS....',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '..sSBBSSSSBBSs..',
    '..sSWESSSSEWSs..',
    '...SSSSSSSSSS...',
    '...SSSSssSSSS...',
    '...SSSMMMMSSS...',
    '....SSSSSSSS....',
    '......SSSS......',
    '...TTTTttTTTT...',
    '..TTTTTttTTTTT..',
    '..TTTTTTTTTTTT..'
  ];

  // Overlays: any letter replaces the base pixel, '.' leaves it, 'x' clears it.
  var HAIR = {
    short: ['................', '....HHHHHHHH....', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...H........H...', '...H........H...'],
    buzz:  ['................', '................', '....hhhhhhhh....', '...hhhhhhhhhh...', '...h........h...'],
    long:  ['................', '....HHHHHHHH....', '...HHHHHHHHHH...', '..HHHHHHHHHHHH..', '..HH........HH..',
            '..H..........H..', '..H..........H..', '..H..........H..', '..H..........H..', '..H..........H..',
            '..HH........HH..', '..HH........HH..'],
    curly: ['.....H.HH.H.....', '...HHHHHHHHHH...', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HH.H....H.HH..', '..H..........H..'],
    wavy:  ['....H.HH.HH.H...', '...HHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHhHHHHhHHH..', '..HHH.HH..HHHH..', '..HH.........H..', '...H............'],
    swoop: ['................', '....HHHHHHHHH...', '...HHHHHHHHHHH..', '...HHHHHHHHHHH..', '...HHHHH.....H..', '...H.........H..'],
    messy: ['.....H..H.H.....', '....HHHHHHHHH...', '...HHHHHHHHHHH..', '...HHHHHHHHHHH..', '...HH.HH...HH...', '...H........H...'],
    spiky: ['....H..H..H.....', '....HH.HH.HH....', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...H........H...'],
    capped:['................', '................', '................', '................', '...H........H...', '...H........H...'],
    bald:  ['................', '................', '................', '................']
  };

  // Facial hair uses F (beard colour) and f (lighter, for stubble).
  var FACE = {
    none: [],
    fullbeard:['', '', '', '', '', '', '', '', '...F........F...', '...FFFFssFFFF...', '...FFF....FFF...', '...FFFFFFFFFF...', '....FFFFFFFF....', '......FFFF......'],
    beard:    ['', '', '', '', '', '', '', '', '...F........F...', '...FF......FF...', '...FFF....FFF...', '....FFFFFFFF....', '......FFFF......'],
    stubble:  ['', '', '', '', '', '', '', '', '', '...f........f...', '...fff....fff...', '....ffffffff....'],
    mustache: ['', '', '', '', '', '', '', '', '', '.....FF..FF.....', '.....F....F.....'],
    goatee:   ['', '', '', '', '', '', '', '', '', '', '.....FMMMMF.....', '......FFFF......']
  };

  var GLASSES = {
    clear:    ['', '', '', '', '', '', '', '...G..GGGG..G...', '...GGGG..GGGG...'],
    shades:   ['', '', '', '', '', '', '', '..GLLLLGGLLLLG..', '...LLLL..LLLL...'],
    aviators: ['', '', '', '', '', '', '..GGGGG..GGGGG..', '..GLLLLGGLLLLG..', '...LLLL..LLLL...', '....LL....LL....']
  };

  var HATS = {
    none: [],
    cap:     ['....CCCCCCCC....', '...CCCCCCCCCC...', '...CCCCCCCCCCCCC'],
    trucker: ['....CCCCCCCC....', '...CCCppppCCC...', '...CCCppppCCC...', '..bbbbbbbbbbbb..'],
    beanie:  ['......C.........', '....CCCCCCCC....', '...CCCCCCCCCC...', '...cccccccccc...'],
    santa:   ['.....RRRRRRR.WW.', '....RRRRRRRRRWW.', '...WWWWWWWWWW...'],
    party:   ['.......Y........', '......YPY.......', '.....YPYPY......']
  };

  // Jackets / sweaters: Q collar, U undershirt showing at the neck.
  var COLLAR = ['', '', '', '', '', '', '', '', '', '', '', '', '', '...TQQUUUUQQT...', '..TTTQUUUUQTTT..', '..TTTTUUUUTTTT..'];
  var CREW   = ['', '', '', '', '', '', '', '', '', '', '', '', '', '...TTTQQQQTTT...'];

  function shade(hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
    var n = parseInt(c, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))); }
    return '#' + [f(r), f(g), f(b)].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function overlay(grid, rows) {
    rows.forEach(function (row, y) {
      if (!row) return;
      for (var x = 0; x < W; x++) {
        var ch = row[x];
        if (ch === '.' || ch === undefined) continue;
        grid[y][x] = ch === 'x' ? '.' : ch;
      }
    });
  }

  /**
   * @param {object} a  avatar features (see config.js)
   * @param {object} opts { seasonalHat: 'santa' | 'party' | null, size: px, title: string }
   */
  function avatarSVG(a, opts) {
    opts = opts || {};
    var grid = BASE.map(function (r) { return r.split(''); });
    var style = a.hairStyle || 'short';
    var hatId = opts.seasonalHat || a.hat || 'none';
    overlay(grid, HAIR[style] || HAIR.short);
    [].concat(a.face || []).forEach(function (f) { overlay(grid, FACE[f] || []); });
    if (a.neck === 'collar') overlay(grid, COLLAR);
    if (a.neck === 'crew') overlay(grid, CREW);
    if (a.glasses) overlay(grid, GLASSES[a.glasses === true ? 'clear' : a.glasses] || GLASSES.clear);
    overlay(grid, HATS[hatId] || []);

    var hatColor = a.hatColor || '#e53935';
    var palette = {
      S: a.skin, s: shade(a.skin, -0.18), B: shade(a.brows || a.hair, -0.1), W: '#ffffff', E: a.eyes || '#1b1b2f', M: a.mouth || '#a8444b',
      T: a.shirt, t: shade(a.shirt, -0.25), H: a.hair, h: shade(a.hair, 0.22),
      F: a.beard || a.hair, f: shade(a.beard || a.hair, 0.35),
      G: a.frame || '#1b1b2f', L: a.lens || '#14141c',
      Q: a.collar || shade(a.shirt, -0.3), U: a.undershirt || '#f2f2f2',
      C: hatColor, c: shade(hatColor, -0.25), p: a.hatPatch || '#24324f', b: a.hatBrim || shade(hatColor, -0.4),
      R: '#e53935', Y: '#ffd54f', P: '#ff5d8f'
    };
    if (opts.seasonalHat === 'santa') palette.W = '#ffffff';

    var pad = 1, size = W + pad * 2, rects = [];
    var filled = function (x, y) { return y >= 0 && y < W && x >= 0 && x < W && grid[y][x] !== '.'; };
    // outline pass: a dark pixel around every filled pixel (classic sprite look)
    for (var y = -1; y <= W; y++) {
      for (var x = -1; x <= W; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          rects.push('<rect x="' + (x + pad) + '" y="' + (y + pad) + '" width="1" height="1" fill="#0d0b1a"/>');
        }
      }
    }
    for (y = 0; y < W; y++) {
      for (x = 0; x < W; x++) {
        var ch = grid[y][x];
        if (ch === '.') continue;
        var fill = palette[ch] || '#ff00ff';
        rects.push('<rect x="' + (x + pad) + '" y="' + (y + pad) + '" width="1" height="1" fill="' + fill + '"/>');
      }
    }
    var px = opts.size || 48;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + px + '" height="' + px +
      '" shape-rendering="crispEdges" role="img" aria-label="' + (opts.title || 'avatar') + '">' + rects.join('') + '</svg>';
  }

  window.BMG = window.BMG || {};
  window.BMG.avatarSVG = avatarSVG;
})();
