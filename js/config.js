/*
 * The Big Minigame — game settings.
 * Everything a non-programmer is likely to tweak lives here.
 */
window.BMG = window.BMG || {};
window.BMG.config = {
  name: 'The Big Minigame',
  player: 'Jacob',

  // Day 1 of the daily schedule. Before this date the game shows a countdown
  // (add ?preview to the URL to play early, or ?day=5 to jump to a day).
  launchDate: '2026-12-10',

  // Preview mode is for testing only: every puzzle (including ones still in
  // review) is unlocked, the launch countdown is skipped, and a preview bar
  // with a reset button shows at the top. Must be false for the real launch.
  preview: false,
  allowPreviewParam: false,
  puzzleFile: 'data/puzzles.dat',

  dailyQuestionCount: 6,

  // Category "credits". Each category guess uses one, and so does each
  // "check my answers" after the category is confirmed. 0 = unlimited.
  categoryAttempts: 3,

  scoring: {
    perCorrectAnswer: 10,              // up to 60 for six answers
    categoryBonusByAttempt: [40, 25, 10], // bonus if the category was found on try 1, 2, 3
    assistedMultiplier: 0.5            // score is halved if credits run out and the solution is shown
  },

  // Host order = question order on screen.
  // Avatar options (all colours are CSS hex):
  //   skin, hair, beard, brows, eyes, shirt, collar, undershirt
  //   hairStyle: short | buzz | long | curly | wavy | swoop | messy | spiky | capped | bald
  //   face: none | stubble | mustache | beard | fullbeard | goatee  (or a list, e.g. ['mustache', 'stubble'])
  //   glasses: false | 'clear' | 'shades' | 'aviators'   frame, lens: colours
  //   hat: none | cap | trucker | beanie   hatColor, hatPatch, hatBrim
  //   neck: none | crew | collar
  // Avatars are drawn from photos Chandler shared (Nov 2026).
  hosts: [
    { id: 'chandler', lines: ["Ketchup on Lobster?!"], name: 'Chandler', domain: 'Sports', color: '#ff5d5d',
      avatar: { skin: '#efc4a4', hair: '#2e2119', eyes: '#7a6b3e', hairStyle: 'wavy', face: 'none', mouth: '#f6f1e6',
        shirt: '#f2f0ea', neck: 'crew', collar: '#d4d1c8' } },
    { id: 'noah', lines: ["FUCK YOUUUU"], name: 'Noah', domain: 'Pop Culture', color: '#ffc93c',
      avatar: { skin: '#f2c9a8', hair: '#5a3a24', hairStyle: 'swoop', face: 'none', shirt: '#7a5232', neck: 'crew', collar: '#5e3e24' } },
    { id: 'zach', lines: ["BRUH", "ESACK", "WET WILLZY"], name: 'Zach', domain: 'Music', color: '#b388ff',
      avatar: { skin: '#f4c4a6', hair: '#8e5f3e', beard: '#9b7155', hairStyle: 'messy', face: 'stubble', shirt: '#8a8f96', neck: 'crew', collar: '#767b82' } },
    { id: 'brady', lines: ["You wanna call garbage?"], name: 'Brady', domain: 'History, Politics & Geography', color: '#4fc3f7',
      avatar: { skin: '#e8b994', hair: '#3b2517', beard: '#4a2c1a', hairStyle: 'capped', face: 'fullbeard', mouth: '#f3eee2',
        hat: 'trucker', hatColor: '#f1ecdf', hatPatch: '#22314f', hatBrim: '#1e1e26',
        shirt: '#4d6f9e', neck: 'collar', collar: '#c8a36a', undershirt: '#55524d' } },
    { id: 'mp', lines: ["Oh Chandlerrr"], name: 'MP', domain: 'Movies & TV', color: '#ff9f43',
      avatar: { skin: '#efc0a0', hair: '#6a4a30', beard: '#9a6238', hairStyle: 'short', face: 'beard', mouth: '#f3eee2',
        shirt: '#6c6a4a', neck: 'crew', collar: '#5a5838' } },
    { id: 'willzy', lines: ["She a Wild One"], name: 'Willzy', domain: 'STEM', color: '#5ee08c',
      avatar: { skin: '#f3cdb2', hair: '#6a3b22', beard: '#8a5a3c', eyes: '#3d6f9e', hairStyle: 'swoop', face: 'none', shirt: '#202024', neck: 'crew', collar: '#2c2c31' } }
  ],

  // Jacob's line, shown when he solves a puzzle.
  winLine: "It's so Wavy",

  // The player, shown on the intro screen.
  playerAvatar: { skin: '#f0c4a2', hair: '#6b4528', hairStyle: 'curly', face: 'none', shirt: '#e6dfcf', neck: 'collar', collar: '#1f2a4a', undershirt: '#f4f1ea' },

  // Set to a fixed theme id (e.g. 'holiday') to override the calendar. null = automatic.
  forceTheme: null
};
