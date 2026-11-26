'use strict';
(() => {
  // ---------- sabitler ----------
  const W = 540, H = 960;
  const PLAY_TOP = 130, PLAY_BOTTOM = 805;
  const CARD_Y = 832, CARD_H = 108, CARD_W = 118, CARD_GAP = 10;
  const CARD_X0 = (W - (4 * CARD_W + 3 * CARD_GAP)) / 2;
  const PX = 455, PY = 560;             // açılış animasyonundaki çöp adamın yeri
  const INK = '#1f1d1b', NEG_INK = '#1d3d7a', RED = '#d43a2f', PAPER = '#f3efe6', MARK = '#c2620a';
  const NUM_FONT = '"Permanent Marker", "Comic Sans MS", cursive';
  const UI_FONT = '"Gochi Hand", "Comic Sans MS", cursive';
  const SHOT_SPEED = 980;
  const FIRE_CD = 0.16;
  const MINUS = '−';
  const MOVE_SPEED = 230;
  const PLAYER_MAX_HP = 100;
  const HIT_IFRAMES = 0.9;
  const MAX_WLV = 30;
  const AMMO_CAP = 5, AMMO_REGEN = 20;  // ÷ ve ×: kapasite ve kaç saniyede 1 mermi
  const MARK_TIME = 6;                  // × işaretinin süresi
  const P_MIN_X = 40, P_MAX_X = W - 30, P_MIN_Y = PLAY_TOP + 80, P_MAX_Y = PLAY_BOTTOM - 55;
  const IS_TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('wrap');
  const $ = id => document.getElementById(id);

  const fmt = v => (v < 0 ? MINUS + (-v) : String(v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const noise = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
  const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; };
  const radiusFor = v => 18 + fmt(v).length * 10;

  // ---------- silahlar ----------
  // 0: −, 1: +, 2: ÷, 3: ×. Seviye 1'de −1, +1, ÷2, ×2; her geliştirme 1 artırır (en fazla 30 seviye).
  const WEAPONS = [
    { sym: MINUS, name: 'Çıkarma', limited: false },
    { sym: '+', name: 'Toplama', limited: false },
    { sym: '÷', name: 'Bölme', limited: true },
    { sym: '×', name: 'Çarpan', limited: true },
  ];
  const wPow = (i, lv) => (i < 2 ? lv : lv + 1);
  const wLabel = (i, lv) => WEAPONS[i].sym + wPow(i, lv);
  const WEAPON_DESC = [
    'Pozitif sayıyı sıfıra yaklaştırır',
    'Negatif sayıyı sıfıra yaklaştırır',
    'Sayıyı böler (kalan atılır)',
    'İşaretler: + ve − vuruşları katlanır',
  ];

  // ---------- XP ----------
  const xpNeed = lv => Math.round(8 + lv * 6 + lv * lv * 0.6);
  const xpFor = v0 => 2 + Math.round(Math.sqrt(Math.abs(v0)) * 1.5);

  const WAVE_HINTS = {
    1: IS_TOUCH ? 'Sol yarı: yürü · Sağ yarı: ateş' : 'Yön tuşları / WASD ile yürü',
    2: 'Pozitife −, negatife + vur',
    3: '× ile işaretle, vuruşlar katlansın',
  };

  // ---------- bölümler ----------
  const STAGES = 20, WAVES = 10;
  const isBossWave = w => w === 5 || w === 10;
  // Zorluk eğrisi: 1–16 yumuşak artar, 17–20 sert sıçrar.
  function stageCfg(s) {
    const hard = Math.max(0, s - 16);                     // 0..4
    const hardMul = 1 + hard * 0.45;
    return {
      mult: (1 + (s - 1) * 0.12) * hardMul,              // sayıların büyüklüğü
      spd: 1 + (s - 1) * 0.02 + hard * 0.14,             // düşman hızı
      extra: Math.floor(s / 4) + hard * 3,               // dalgaya eklenen düşman
      dmg: 1 + (s - 1) * 0.03 + hard * 0.3,              // temas hasarı çarpanı
      gap: Math.max(0.45, 1.9 - s * 0.035 - hard * 0.12), // doğma aralığı
      hardMul,
    };
  }
  const stageMoney = s => 20 + s * 15;
  const quizTime = s => Math.max(5, 11 - s * 0.3);

  // ---------- silgi bossları ----------
  // body/sleeve: silginin pembe gövdesi ve kağıt kılıfı
  const BOSS_TYPES = {
    sisko:    { name: 'Şişko Silgi', spd: 16, size: 1.35, wide: 1.3, hp: 1.6, dmg: 1.8, body: '#f2a7b5', sleeve: '#3a6fd1' },
    sapkali:  { name: 'Şapkalı Silgi', spd: 22, size: 1.15, hp: 1.0, dmg: 1.2, body: '#f2a7b5', sleeve: '#2f9a6a', summon: 5.5 },
    kosucu:   { name: 'Koşucu Silgi', spd: 40, size: 1.05, hp: 0.8, dmg: 1.3, body: '#f5b98d', sleeve: '#d64b3b', dash: 3.4 },
    ogretmen: { name: 'Öğretmen Silgi', spd: 18, size: 1.2, hp: 1.0, dmg: 1.2, body: '#f2a7b5', sleeve: '#6c4bb5', quiz: 12 },
    zombi:    { name: 'Zombi Silgi', spd: 15, size: 1.2, hp: 1.1, dmg: 1.4, body: '#a9c79a', sleeve: '#5b6b4a', regen: 0.035 },
    ninja:    { name: 'Ninja Silgi', spd: 30, size: 1.05, hp: 0.9, dmg: 1.2, body: '#6b6b72', sleeve: '#1f1d1b', blink: 4.2, throw: 2.4 },
    hayalet:  { name: 'Hayalet Silgi', spd: 26, size: 1.15, hp: 0.9, dmg: 1.2, body: '#f4f1ec', sleeve: '#9aa7b8', ghost: true },
    ikiz:     { name: 'İkiz Silgiler', spd: 26, size: 1.0, hp: 0.6, dmg: 1.1, body: '#f2a7b5', sleeve: '#e0407a', twins: true },
    kral:     { name: 'Kral Silgi', spd: 20, size: 1.3, hp: 1.3, dmg: 1.5, body: '#f2c46d', sleeve: '#7a2e8f', summon: 6.5, dash: 5 },
    dev:      { name: 'Dev Silgi', spd: 16, size: 1.7, hp: 2.4, dmg: 2.0, body: '#e98b9c', sleeve: '#1f1d1b', summon: 7, dash: 6, quiz: 16, throw: 3.2 },
  };
  const BOSS_ROTATION = ['sisko', 'sapkali', 'kosucu', 'ogretmen', 'zombi', 'ninja', 'hayalet', 'ikiz', 'kral'];
  function bossFor(s, w) {
    if (s === STAGES && w === WAVES) return 'dev';
    return BOSS_ROTATION[(2 * (s - 1) + (w === WAVES ? 1 : 0)) % BOSS_ROTATION.length];
  }

  // ---------- kayıt ----------
  const SAVE_KEY = 'sm_save_v1';
  const defaultSave = () => ({ unlocked: 1, cleared: [], sp: 0, money: 0 });
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.unlocked) return Object.assign(defaultSave(), s);
    } catch (e) { /* bozuk kayıt: sıfırdan başla */ }
    return defaultSave();
  }
  let save = loadSave();
  function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* depolama kapalı */ } }

  // ---------- ses ----------
  const Snd = {
    ac: null, noiseBuf: null,
    muted: localStorage.getItem('sm_muted') === '1',
    init() {
      if (!this.ac) {
        try {
          this.ac = new (window.AudioContext || window.webkitAudioContext)();
          const len = this.ac.sampleRate * 0.3;
          this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { this.ac = null; }
      }
      if (this.ac && this.ac.state === 'suspended') this.ac.resume();
    },
    tone(freq, dur, type = 'triangle', vol = 0.06, slide = 0, delay = 0) {
      if (this.muted || !this.ac) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ac.destination);
      o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol = 0.05, freq = 1200) {
      if (this.muted || !this.ac) return;
      const t = this.ac.currentTime;
      const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
      s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(this.ac.destination);
      s.start(t); s.stop(t + dur + 0.02);
    },
    shoot() { this.tone(820 + Math.random() * 120, 0.06, 'triangle', 0.035, -380); this.noise(0.04, 0.02, 3000); },
    hit(v) { this.tone(clamp(260 + Math.abs(v) * 6, 260, 700), 0.07, 'square', 0.03, 60); this.noise(0.05, 0.035, 900); },
    kill() { this.tone(520, 0.09, 'triangle', 0.07, 300); this.tone(780, 0.12, 'triangle', 0.05, 400, 0.05); this.noise(0.12, 0.05, 2200); },
    mark() { this.tone(440, 0.08, 'sine', 0.05, 220); },
    xp() { this.tone(900 + Math.random() * 200, 0.04, 'sine', 0.025); },
    levelUp() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.06, 0, i * 0.07)); },
    ammo() { this.tone(700, 0.06, 'sine', 0.04, 200); },
    hurt() { this.tone(140, 0.3, 'sawtooth', 0.08, -80); this.noise(0.25, 0.08, 400); },
    empty() { this.tone(140, 0.07, 'square', 0.035); },
    select() { this.tone(660, 0.04, 'sine', 0.03); },
    wave() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.05, 0, i * 0.08)); },
    boss() { [196, 185, 175, 147].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.06, 0, i * 0.16)); },
    bossKill() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.07, 0, i * 0.08)); this.noise(0.4, 0.08, 1500); },
    quiz() { this.tone(880, 0.08, 'square', 0.05); this.tone(1175, 0.12, 'square', 0.05, 0, 0.09); },
    right() { [659, 880, 1175].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.06, 0, i * 0.06)); },
    wrong() { this.tone(220, 0.35, 'sawtooth', 0.07, -100); },
    dash() { this.noise(0.25, 0.06, 600); this.tone(300, 0.2, 'sawtooth', 0.04, 300); },
    poof() { this.noise(0.2, 0.05, 2500); },
    win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.07, 0, i * 0.11)); },
  };

  // ---------- durum ----------
  let S;
  function newState() {
    return {
      mode: 'menu',
      enemies: [], shots: [], parts: [], popups: [], orbs: [],
      rp: 0, rpShown: 0, rpPop: 0,
      hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, hpShown: PLAYER_MAX_HP, iframes: 0,
      xp: 0, xpShown: 0, level: 1, pendingLevels: 0,
      wlv: [1, 1, 1, 1],
      ammo: [Infinity, Infinity, AMMO_CAP, AMMO_CAP], ammoCap: AMMO_CAP, ammoT: [0, 0, 0, 0],
      stage: 1, cfg: stageCfg(1), bullets: [], quiz: null,
      wave: 0, waveTotal: 0, resolved: 0,
      spawnQueue: [], spawnT: 0, waveActive: false, nextWaveT: 0, bossPending: null,
      banner: null,
      sel: 0, cardShake: [0, 0, 0, 0],
      px: W / 2, py: P_MAX_Y - 60, pvx: 0, pvy: 0, walk: 0,
      aim: -Math.PI / 2, recoil: 0, hurt: 0, shake: 0,
      pointer: { x: W / 2, y: 400, down: false, mouse: !IS_TOUCH, inPlay: false },
      keys: {}, keyFire: false,
      stick: null,     // telefon: sol yarı joystick {id, ox, oy, x, y}
      aimTouch: null,  // telefon: sağ yarı nişan {id, ox, oy, x, y}
      fireCD: 0, nextId: 1,
    };
  }
  S = newState();
  let clock = 0;
  const shoulder = () => ({ x: S.px - 2, y: S.py - 36 });

  // ---------- boyutlandırma ----------
  let dpr = 1;
  const bg = document.createElement('canvas');
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const scale = Math.max(0.1, Math.min(window.innerWidth / W, window.innerHeight / H));
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    wrap.style.setProperty('--s', scale);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    renderBackground();
  }

  function renderBackground() {
    bg.width = canvas.width; bg.height = canvas.height;
    const b = bg.getContext('2d');
    b.setTransform(bg.width / W, 0, 0, bg.height / H, 0, 0);
    b.fillStyle = PAPER; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 300; i++) {
      b.fillStyle = `rgba(120,100,70,${Math.random() * 0.07})`;
      b.fillRect(Math.random() * W, Math.random() * H, rand(1, 3), rand(1, 3));
    }
    b.strokeStyle = 'rgba(110,150,205,0.35)'; b.lineWidth = 1.2;
    for (let y = 150; y < PLAY_BOTTOM; y += 34) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
    b.strokeStyle = 'rgba(220,90,90,0.45)'; b.lineWidth = 1.6;
    b.beginPath(); b.moveTo(58, 0); b.lineTo(58, PLAY_BOTTOM + 10); b.stroke();
    for (const y of [240, 490, 740]) {
      b.fillStyle = '#d8d1c3'; b.beginPath(); b.arc(26, y, 11, 0, Math.PI * 2); b.fill();
      b.fillStyle = 'rgba(0,0,0,0.08)'; b.beginPath(); b.arc(27, y + 2, 9, 0, Math.PI * 2); b.fill();
    }
    b.fillStyle = '#e4dccb'; b.fillRect(0, PLAY_BOTTOM + 10, W, H - PLAY_BOTTOM - 10);
    b.strokeStyle = 'rgba(0,0,0,0.15)'; b.lineWidth = 2;
    b.beginPath(); b.moveTo(0, PLAY_BOTTOM + 10); b.lineTo(W, PLAY_BOTTOM + 10); b.stroke();
  }

  // ---------- dalgalar ----------
  function genWave(w) {
    const c = S.cfg;
    const n = Math.min(4 + w + c.extra, 26);
    const maxV = Math.max(4, Math.round((4 + w * 2.5) * c.mult));
    const out = [];
    for (let i = 0; i < n; i++) {
      const sg = Math.random() < 0.6 ? 1 : -1;
      const big = Math.random() < 0.25;
      const lo = big ? Math.ceil(maxV / 2) : 1, hi = big ? maxV : Math.max(3, Math.ceil(maxV / 2));
      out.push(sg * randi(lo, hi));
    }
    return out;
  }

  function startWave() {
    S.wave++;
    S.resolved = 0;
    S.waveActive = true;
    if (isBossWave(S.wave)) {
      const type = bossFor(S.stage, S.wave);
      S.spawnQueue = [];
      S.bossPending = type;
      S.waveTotal = BOSS_TYPES[type].twins ? 2 : 1;
      S.spawnT = 2.2;
      S.banner = { text: 'BOSS!', sub: BOSS_TYPES[type].name, t: 0, life: 2.4, boss: true };
      Snd.boss();
    } else {
      S.spawnQueue = genWave(S.wave);
      S.waveTotal = S.spawnQueue.length;
      S.spawnT = 1.5;
      const hint = S.stage === 1 ? WAVE_HINTS[S.wave] : '';
      S.banner = { text: `Dalga ${S.wave}/${WAVES}`, sub: hint || '', t: 0, life: 2.0 };
      Snd.wave();
    }
  }

  function spawnPos(minDist) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 30; tries++) {
      x = rand(80, W - 50); y = rand(PLAY_TOP + 60, PLAY_BOTTOM - 60);
      if (Math.hypot(x - S.px, y - S.py) > minDist && S.enemies.every(e => Math.hypot(e.x - x, e.y - y) > 80)) break;
    }
    return { x, y };
  }

  function spawnEnemy(v, at, extra) {
    const { x, y } = at || spawnPos(260);
    const spd = Math.min(70, (22 + S.wave * 2 + rand(0, 10)) * S.cfg.spd);
    const e = {
      id: S.nextId++, value: v, prev: v, v0: v, x, y, vx: 0, vy: 0, r: radiusFor(v),
      pop: 0, change: 0, flash: 0, write: 0, spd, wob: Math.random() * 6.28, dead: false,
      markMul: 1, markT: 0,
    };
    S.enemies.push(Object.assign(e, extra));
    for (let i = 0; i < 6; i++) addPart('line', x + rand(-20, 20), y + rand(-20, 20), rand(-60, 60), rand(-60, 60), 0.35, INK, 2);
    return e;
  }

  function bossHp(s, w, B) {
    const base = w === WAVES ? 80 + s * 25 : 40 + s * 12;
    return Math.max(10, Math.round(base * stageCfg(s).hardMul * B.hp));
  }

  function spawnBoss(type) {
    const B = BOSS_TYPES[type];
    const n = B.twins ? 2 : 1;
    const sign0 = Math.random() < 0.5 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const hp = bossHp(S.stage, S.wave, B);
      const v = (B.twins ? (k === 0 ? 1 : -1) : sign0) * hp;
      const at = spawnPos(300);
      const e = spawnEnemy(v, at, {
        boss: type, size: B.size, r: 46 * B.size * (B.wide || 1),
        spd: B.spd * S.cfg.spd, t: rand(0, 1), lastHit: 0, regenAcc: 0,
        dashState: 0, dashT: B.dash ? B.dash * 0.6 : 0, dashDir: 0,
        sumT: B.summon ? 2.5 : 0, thrT: B.throw ? 1.5 : 0, blkT: B.blink ? 3 : 0, qT: B.quiz ? 4.5 : 0,
        ghostA: 1,
      });
      burst(e.x, e.y, 24, '#e0407a');
    }
    S.shake = 12;
  }

  // ---------- efekt yardımcıları ----------
  function addPart(type, x, y, vx, vy, life, color, size, extra) {
    if (S.parts.length > 450) S.parts.shift();
    S.parts.push(Object.assign({ type, x, y, vx, vy, life, max: life, color, size, rot: Math.random() * 6.28 }, extra));
  }
  function splat(x, y, dir, n, color = INK) {
    for (let i = 0; i < n; i++) {
      const a = dir + Math.PI + rand(-1.1, 1.1), sp = rand(80, 260);
      addPart('dot', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.25, 0.5), color, rand(1.5, 3.5));
    }
  }
  function burst(x, y, n, color = INK) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(90, 340);
      addPart(i % 3 ? 'line' : 'dot', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.35, 0.7), color, rand(2, 4));
    }
    for (let i = 0; i < n / 2; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(60, 200);
      addPart('crumb', x, y, Math.cos(a) * sp, Math.sin(a) * sp - 120, rand(0.5, 0.9), '#e8a7b5', rand(3, 6));
    }
    addPart('ring', x, y, 0, 0, 0.4, color, 10);
  }
  function addLabel(x, y, text, color, size) {
    addPart('label', x, y, rand(-20, 20), -70, 0.6, color, size, { text });
  }
  function popup(x, y, lines, life = 1.5) {
    x = clamp(x, 120, W - 120);
    y = clamp(y, PLAY_TOP + 100, PLAY_BOTTOM - 40);
    for (const p of S.popups) if (Math.abs(p.y - y) < 70 && Math.abs(p.x - x) < 200 && p.t < 0.5) y = Math.max(PLAY_TOP + 100, y - 80);
    S.popups.push({ x, y, lines, t: 0, life });
  }

  // ---------- oyun olayları ----------
  function killEnemy(e) {
    e.dead = true;
    if (!e.minion) S.resolved++;
    burst(e.x, e.y, e.boss ? 50 : 18, e.boss ? '#e0407a' : INK);
    addPart('ghost', e.x, e.y, 0, 0, e.boss ? 0.9 : 0.45, INK, e.boss ? 110 : 46, { text: '0' });
    S.shake = Math.max(S.shake, e.boss ? 18 : 5);
    S.rp += Math.abs(e.v0); S.rpPop = 1;
    if (e.boss) {
      Snd.bossKill();
      popup(e.x, e.y - 60, [{ text: `${BOSS_TYPES[e.boss].name} silindi!`, color: '#e0407a', size: 32, font: NUM_FONT }], 1.8);
    }
    // XP mürekkep damlaları: önce saçılır, sonra oyuncuya uçar
    const total = xpFor(e.v0) * (e.boss ? 3 : 1) * (e.minion ? 0.5 : 1), n = Math.min(e.boss ? 14 : 6, Math.ceil(total / 3));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(80, 200);
      S.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, val: total / n, age: 0 });
    }
    Snd.kill();
  }

  function hitEnemy(e, s) {
    const i = s.op, p = s.pow;
    const dir = Math.atan2(s.vy, s.vx);
    e.vx += Math.cos(dir) * 90; e.vy += Math.sin(dir) * 90;
    if (i === 3) {
      // × : sayıyı değiştirmez, işaretler
      e.markMul = Math.max(p, e.markT > 0 ? e.markMul : 1); e.markT = MARK_TIME; e.pop = 0.6;
      splat(s.x, s.y, dir, 6, MARK);
      addLabel(s.x, s.y - 14, '×' + p, MARK, 24);
      Snd.mark();
      return;
    }
    const v = e.value;
    let nv, label;
    if (i < 2) {
      const step = p * (e.markT > 0 ? e.markMul : 1);
      nv = i === 0 ? v - step : v + step;
      // doğru yöne vuruş sıfırı geçmez: sıfırda durur
      if ((v > 0 && nv < 0) || (v < 0 && nv > 0)) nv = 0;
      label = (i === 0 ? MINUS : '+') + step;
    } else {
      nv = Math.trunc(v / p);
      label = '÷' + p;
      // bossların ÷ zırhı: tek vuruşta başlangıç değerinin en fazla %12'si gider
      if (e.boss) {
        const cap = Math.max(1, Math.round(Math.abs(e.v0) * 0.12));
        if (Math.abs(v - nv) > cap) { nv = v - Math.sign(v) * cap; label = `÷${p} (zırh)`; }
      }
    }
    nv = clamp(nv, -99999, 99999);
    if (e.boss) { e.lastHit = e.t; e.prev = v; e.value = nv; e.change = 1; e.pop = 0.6; e.flash = 1; }
    else { e.prev = v; e.value = nv; e.change = 1; e.pop = 1; e.flash = 1; e.r = radiusFor(nv); }
    splat(s.x, s.y, dir, 7);
    addLabel(s.x, s.y - 14, label, RED, 22);
    Snd.hit(nv);
    if (nv === 0) killEnemy(e);
  }

  function contactDamage(e) {
    if (e.boss) return Math.round((10 + S.stage * 0.8) * BOSS_TYPES[e.boss].dmg * S.cfg.dmg);
    return Math.round(clamp(6 + Math.abs(e.value) * 0.15, 6, 20) * S.cfg.dmg);
  }

  function hurtPlayer(e) {
    if (S.iframes > 0) return;
    const cx = S.px, cy = S.py - 20;
    const a = Math.atan2(e.y - cy, e.x - cx);
    if (e.boss) { if (e.dashState === 2) { e.dashState = 0; e.dashT = BOSS_TYPES[e.boss].dash; } }
    else { e.vx = Math.cos(a) * 280; e.vy = Math.sin(a) * 280; }
    S.pvx -= Math.cos(a) * 300; S.pvy -= Math.sin(a) * 300;
    damagePlayer(contactDamage(e));
  }

  function damagePlayer(dmg) {
    if (S.iframes > 0 || S.mode !== 'play') return;
    const cx = S.px, cy = S.py - 20;
    S.hp = Math.max(0, S.hp - dmg);
    S.iframes = HIT_IFRAMES;
    S.hurt = 1; S.shake = 14;
    burst(cx, cy, 12, RED);
    addLabel(cx, cy - 60, MINUS + dmg, RED, 28);
    Snd.hurt();
    if (S.hp <= 0) gameOver();
  }

  function gainXP(n) {
    S.xp += n;
    while (S.xp >= xpNeed(S.level)) {
      S.xp -= xpNeed(S.level);
      S.level++;
      S.pendingLevels++;
    }
    if (S.pendingLevels > 0 && S.mode === 'play') openLevelUp();
  }

  // Nişan: fare/klavyede imleç; telefonda sağ yarıdaki sürükleme yönü ya da en yakın düşman.
  function aimInfo() {
    const sh = shoulder();
    if (S.aimTouch) {
      const dx = S.aimTouch.x - S.aimTouch.ox, dy = S.aimTouch.y - S.aimTouch.oy, l = Math.hypot(dx, dy);
      if (l > 14) {
        const dir = Math.atan2(dy, dx);
        const t = coneTarget(sh, dir, 0.45);
        return t ? { x: t.x, y: t.y, target: t } : { x: sh.x + Math.cos(dir) * 400, y: sh.y + Math.sin(dir) * 400, target: null };
      }
      const t = nearestEnemy(sh);
      return t ? { x: t.x, y: t.y, target: t } : { x: sh.x, y: sh.y - 300, target: null };
    }
    const p = S.pointer;
    const t = findTarget(p.x, p.y);
    return t ? { x: t.x, y: t.y, target: t } : { x: p.x, y: p.y, target: null };
  }

  function fire() {
    const i = S.sel;
    if (WEAPONS[i].limited && S.ammo[i] <= 0) { S.cardShake[i] = 1; Snd.empty(); S.fireCD = 0.25; return; }
    if (WEAPONS[i].limited) S.ammo[i]--;
    const sh = shoulder(), aim = aimInfo();
    const ang = Math.atan2(aim.y - sh.y, aim.x - sh.x);
    S.aim = ang;
    const hx = sh.x + Math.cos(ang) * 50, hy = sh.y + Math.sin(ang) * 50;
    S.shots.push({
      x: hx, y: hy, vx: Math.cos(ang) * SHOT_SPEED, vy: Math.sin(ang) * SHOT_SPEED,
      op: i, pow: wPow(i, S.wlv[i]), label: wLabel(i, S.wlv[i]),
      target: aim.target, age: 0, trail: [], spin: rand(-0.6, 0.6), dead: false,
    });
    S.recoil = 1;
    for (let k = 0; k < 4; k++) {
      const a = ang + rand(-0.5, 0.5), sp = rand(60, 160);
      addPart('dot', hx, hy, Math.cos(a) * sp, Math.sin(a) * sp, 0.2, RED, rand(1.5, 2.5));
    }
    Snd.shoot();
    S.fireCD = FIRE_CD;
  }

  function findTarget(x, y) {
    let target = null, best = Infinity;
    for (const e of S.enemies) {
      if (e.dead || e.write < 1 || e.ghostA < 0.5) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < 55 && d < best) { best = d; target = e; }
    }
    return target;
  }
  function nearestEnemy(from) {
    let target = null, best = Infinity;
    for (const e of S.enemies) {
      if (e.dead || e.write < 1 || e.ghostA < 0.5) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < best) { best = d; target = e; }
    }
    return target;
  }
  function coneTarget(from, dir, cone) {
    let target = null, best = Infinity;
    for (const e of S.enemies) {
      if (e.dead || e.write < 1 || e.ghostA < 0.5) continue;
      const a = Math.atan2(e.y - from.y, e.x - from.x);
      const da = Math.abs(((a - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da > cone) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y) * (1 + da);
      if (d < best) { best = d; target = e; }
    }
    return target;
  }

  // ---------- boss davranışları ----------
  function updateBoss(e, dt) {
    const B = BOSS_TYPES[e.boss];
    const cx = S.px, cy = S.py - 20;
    e.t += dt;
    if (B.ghost) e.ghostA = (e.t % 5) < 3 ? 1 : 0.12;   // 3 sn görünür, 2 sn neredeyse görünmez
    if (B.regen && e.t - e.lastHit > 2 && Math.abs(e.value) < Math.abs(e.v0)) {
      e.regenAcc += Math.abs(e.v0) * B.regen * dt;
      while (e.regenAcc >= 1 && Math.abs(e.value) < Math.abs(e.v0)) { e.regenAcc -= 1; e.value += Math.sign(e.v0); }
    }
    if (B.dash) {
      e.dashT -= dt;
      if (e.dashState === 0 && e.dashT <= 0) { e.dashState = 1; e.dashT = 0.65; e.dashDir = Math.atan2(cy - e.y, cx - e.x); }
      else if (e.dashState === 1 && e.dashT <= 0) { e.dashState = 2; e.dashT = 0.55; Snd.dash(); }
      else if (e.dashState === 2 && e.dashT <= 0) { e.dashState = 0; e.dashT = B.dash; }
    }
    if (B.summon) { e.sumT -= dt; if (e.sumT <= 0) { e.sumT = B.summon; summonMinions(e); } }
    if (B.throw) { e.thrT -= dt; if (e.thrT <= 0) { e.thrT = B.throw; throwCrumbs(e, e.boss === 'dev' ? 5 : 3); } }
    if (B.blink) { e.blkT -= dt; if (e.blkT <= 0) { e.blkT = B.blink; blinkBoss(e); } }
    if (B.quiz) { e.qT -= dt; if (e.qT <= 0) { e.qT = B.quiz; openQuiz(e); } }
  }

  function summonMinions(e) {
    const n = e.boss === 'dev' ? 4 : 3;
    const maxV = Math.max(3, Math.round(4 * S.cfg.mult));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      const at = { x: clamp(e.x + Math.cos(a) * (e.r + 40), 70, W - 50), y: clamp(e.y + Math.sin(a) * (e.r + 40), PLAY_TOP + 50, PLAY_BOTTOM - 50) };
      spawnEnemy((Math.random() < 0.5 ? -1 : 1) * randi(1, maxV), at, { minion: true });
    }
    addLabel(e.x, e.y - e.r - 20, 'Gelin!', '#2f9a6a', 26);
  }

  function throwCrumbs(e, n) {
    const a0 = Math.atan2(S.py - 20 - e.y, S.px - e.x);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.22;
      S.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 4, rot: rand(0, 6) });
    }
    Snd.poof();
  }

  function blinkBoss(e) {
    burst(e.x, e.y, 14, '#6b6b72');
    const p = spawnPos(220);
    e.x = p.x; e.y = p.y; e.vx = 0; e.vy = 0;
    burst(e.x, e.y, 14, '#6b6b72');
    Snd.poof();
  }

  function updateBullets(dt) {
    const cx = S.px, cy = S.py - 20;
    for (const b of S.bullets) {
      b.life -= dt; b.rot += dt * 8;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.hypot(b.x - cx, b.y - cy) < 26) { b.life = 0; damagePlayer(Math.round(8 * S.cfg.dmg)); if (S.mode !== 'play') break; }
      if (b.x < -20 || b.x > W + 20 || b.y < PLAY_TOP - 20 || b.y > PLAY_BOTTOM + 20) b.life = 0;
    }
    S.bullets = S.bullets.filter(b => b.life > 0);
  }

  // ---------- öğretmen silgi: hesap makinesi sorusu ----------
  function makeQuestion(s) {
    const r = Math.random();
    let a, b, c, text, ans;
    if (s <= 4) {
      a = randi(2, 9 + s * 2); b = randi(1, 9);
      if (r < 0.5) { text = `${a} + ${b}`; ans = a + b; } else { if (b > a) [a, b] = [b, a]; text = `${a} ${MINUS} ${b}`; ans = a - b; }
    } else if (s <= 9) {
      if (r < 0.55) { a = randi(2, 9); b = randi(2, 9); text = `${a} × ${b}`; ans = a * b; }
      else { a = randi(11, 60); b = randi(5, 39); if (r < 0.8) { text = `${a} + ${b}`; ans = a + b; } else { if (b > a) [a, b] = [b, a]; text = `${a} ${MINUS} ${b}`; ans = a - b; } }
    } else if (s <= 14) {
      if (r < 0.4) { a = randi(3, 12); b = randi(3, 12); text = `${a} × ${b}`; ans = a * b; }
      else if (r < 0.7) { b = randi(2, 9); ans = randi(2, 12); a = b * ans; text = `${a} ÷ ${b}`; }
      else { a = randi(20, 99); b = randi(20, 99); text = `${a} ${MINUS} ${b}`; ans = a - b; }
    } else {
      if (r < 0.35) { a = randi(3, 12); b = randi(3, 12); c = randi(2, 30); text = `${a} × ${b} ${MINUS} ${c}`; ans = a * b - c; }
      else if (r < 0.65) { a = randi(-20, 20); b = randi(-20, 20); text = `${fmt(a)} + (${fmt(b)})`; ans = a + b; }
      else { b = randi(3, 12); ans = randi(-12, 12); a = b * ans; text = `${fmt(a)} ÷ ${b}`; }
    }
    return { text, ans };
  }

  function openQuiz(e) {
    if (S.mode !== 'play') return;
    const q = makeQuestion(S.stage);
    const time = quizTime(S.stage);
    S.quiz = { q, boss: e, time, left: time, input: '' };
    setMode('quiz');
    S.pointer.down = false; S.keyFire = false; S.keys = {}; S.stick = null; S.aimTouch = null;
    $('qText').textContent = `${q.text} =`;
    $('qInput').textContent = '';
    $('qBar').style.width = '100%';
    showOverlay('quiz');
    Snd.quiz();
  }

  function quizKey(k) {
    const Q = S.quiz;
    if (!Q || S.mode !== 'quiz') return;
    if (k === 'ok') { if (Q.input !== '' && Q.input !== MINUS) resolveQuiz(+Q.input.replace(MINUS, '-') === Q.q.ans); return; }
    if (k === 'back') Q.input = Q.input.slice(0, -1);
    else if (k === '-') Q.input = Q.input.startsWith(MINUS) ? Q.input.slice(1) : MINUS + Q.input;
    else if (/^[0-9]$/.test(k) && Q.input.replace(MINUS, '').length < 5) Q.input += k;
    $('qInput').textContent = Q.input;
  }

  function updateQuiz(dt) {
    const Q = S.quiz;
    if (!Q) return;
    Q.left -= dt;
    $('qBar').style.width = `${Math.max(0, Q.left / Q.time) * 100}%`;
    if (Q.left <= 0) resolveQuiz(false, true);
  }

  function resolveQuiz(ok, timeout) {
    const Q = S.quiz;
    if (!Q) return;
    S.quiz = null;
    showOverlay(null);
    setMode('play');
    const e = Q.boss;
    if (ok) {
      Snd.right();
      if (!e.dead) {
        const cut = Math.max(1, Math.round(Math.abs(e.v0) * 0.1));
        const nv = Math.abs(e.value) <= cut ? 0 : e.value - Math.sign(e.value) * cut;
        e.prev = e.value; e.value = nv; e.change = 1; e.pop = 1; e.flash = 1;
        if (nv === 0) killEnemy(e);
      }
      popup(S.px, S.py - 110, [{ text: 'DOĞRU!', color: '#2f9a6a', size: 40, font: NUM_FONT }, { text: `${Q.q.text} = ${fmt(Q.q.ans)}`, color: INK, size: 22, font: NUM_FONT }], 1.4);
    } else {
      Snd.wrong();
      if (!e.dead) { const heal = Math.round(Math.abs(e.v0) * 0.1); e.value += Math.sign(e.value || e.v0) * heal; e.pop = 1; }
      popup(S.px, S.py - 110, [{ text: timeout ? 'SÜRE BİTTİ!' : 'YANLIŞ!', color: RED, size: 40, font: NUM_FONT }, { text: `${Q.q.text} = ${fmt(Q.q.ans)}`, color: INK, size: 22, font: NUM_FONT }], 1.6);
      S.iframes = 0;
      damagePlayer(Math.round(15 * S.cfg.dmg));
    }
    S.iframes = Math.max(S.iframes, 1.0);
  }

  // ---------- bölüm akışı ----------
  function startStage(s) {
    Snd.init();
    const pointer = S.pointer;
    S = newState();
    S.pointer = pointer; S.pointer.down = false;
    S.stage = s; S.cfg = stageCfg(s);
    setMode('play');
    showOverlay(null);
    startWave();
  }

  function stageClear() {
    setMode('clear');
    S.pointer.down = false; S.stick = null; S.aimTouch = null;
    const s = S.stage, first = !save.cleared.includes(s);
    const money = stageMoney(s);
    if (first) { save.cleared.push(s); save.sp += 1; }
    save.unlocked = Math.max(save.unlocked, Math.min(STAGES, s + 1));
    save.money += money;
    writeSave();
    $('clTitle').textContent = s === STAGES ? 'Bütün bölümler bitti!' : `Bölüm ${s} tamamlandı!`;
    $('clReward').innerHTML = `+${money} para${first ? '<br>+1 yetenek puanı' : ''}`;
    $('clTotals').textContent = `Toplam: ${save.money} para · ${save.sp} yetenek puanı`;
    $('btnNext').style.display = s < STAGES ? '' : 'none';
    Snd.win();
    burst(S.px, S.py - 40, 40, '#d6a400');
    setTimeout(() => { if (S.mode === 'clear') showOverlay('clear'); }, 1200);
  }

  // ---------- seviye atlama ----------
  function openLevelUp() {
    const open = [0, 1, 2, 3].filter(i => S.wlv[i] < MAX_WLV);
    if (!open.length) { S.pendingLevels = 0; return; }
    setMode('levelup');
    S.pointer.down = false; S.keyFire = false; S.stick = null; S.aimTouch = null;
    $('luTitle').textContent = `Seviye ${S.level - S.pendingLevels + 1}!`;
    const box = $('luChoices');
    box.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const lv = S.wlv[i], maxed = lv >= MAX_WLV;
      const b = document.createElement('button');
      b.className = 'choice';
      b.disabled = maxed;
      b.innerHTML = `<span class="k">${i + 1}</span><span class="big">${maxed ? wLabel(i, lv) : `${wLabel(i, lv)} → ${wLabel(i, lv + 1)}`}</span>` +
        `<span class="small">${WEAPONS[i].name} · Sv ${maxed ? 'MAX' : `${lv + 1}/${MAX_WLV}`}</span><span class="small dim">${WEAPON_DESC[i]}</span>`;
      b.addEventListener('click', () => chooseUpgrade(i));
      box.appendChild(b);
    }
    showOverlay('levelup');
    Snd.levelUp();
    burst(S.px, S.py - 40, 20, '#d6a400');
  }

  function chooseUpgrade(i) {
    if (S.mode !== 'levelup' || S.wlv[i] >= MAX_WLV) return;
    S.wlv[i]++;
    S.pendingLevels--;
    S.hp = Math.min(S.maxHp, S.hp + 10);
    showOverlay(null);
    setMode('play');
    popup(S.px, S.py - 110, [
      { text: `${WEAPONS[i].name} güçlendi!`, color: '#7a4bd8', size: 26, font: NUM_FONT },
      { text: wLabel(i, S.wlv[i]), color: RED, size: 34, font: NUM_FONT },
    ], 1.2);
    if (S.pendingLevels > 0) setTimeout(() => { if (S.mode === 'play' && S.pendingLevels > 0) openLevelUp(); }, 250);
  }

  // ---------- mod geçişleri ----------
  function setMode(m) { S.mode = m; wrap.dataset.mode = m; }
  function showOverlay(id) {
    for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
  }
  function startGame() { Snd.init(); showStages(); }

  function showStages() {
    const p = S.pointer; S = newState(); S.pointer = p;
    setMode('stages');
    $('stTotals').textContent = `${save.money} para · ${save.sp} yetenek puanı`;
    const grid = $('stGrid');
    grid.innerHTML = '';
    for (let s = 1; s <= STAGES; s++) {
      const b = document.createElement('button');
      const locked = s > save.unlocked, done = save.cleared.includes(s);
      b.className = 'stage' + (done ? ' done' : '') + (s >= 17 ? ' hard' : '');
      b.disabled = locked;
      b.innerHTML = `<span class="n">${s}</span><span class="st">${locked ? 'kilitli' : done ? '✓ geçildi' : s >= 17 ? 'çok zor' : 'oyna'}</span>`;
      if (!locked) b.addEventListener('click', () => startStage(s));
      grid.appendChild(b);
    }
    showOverlay('stages');
  }
  function pauseGame() { if (S.mode !== 'play') return; setMode('pause'); S.pointer.down = false; S.keyFire = false; S.keys = {}; S.stick = null; S.aimTouch = null; showOverlay('pause'); }
  function resumeGame() { if (S.mode !== 'pause') return; Snd.init(); setMode('play'); showOverlay(null); }
  function toMenu() {
    const p = S.pointer; S = newState(); S.pointer = p; setMode('menu');
    $('menuTotals').textContent = `${save.money} para · ${save.sp} yetenek puanı · ${save.cleared.length}/${STAGES} bölüm`;
    showOverlay('menu');
  }
  function gameOver() {
    setMode('over');
    S.pointer.down = false; S.stick = null; S.aimTouch = null; S.quiz = null;
    // bölüm ilerlemesine göre para: geçilen dalga oranında
    const cleared = Math.max(0, S.wave - 1);
    const money = Math.floor(stageMoney(S.stage) * cleared / WAVES);
    save.money += money;
    writeSave();
    $('ovStage').textContent = S.stage;
    $('ovWave').textContent = S.wave;
    $('ovLevel').textContent = S.level;
    $('ovRp').textContent = `+${money}`;
    $('ovBest').textContent = `Toplam: ${save.money} para`;
    setTimeout(() => { if (S.mode === 'over') showOverlay('over'); }, 900);
  }

  // ---------- güncelleme ----------
  function update(dt) {
    if (S.mode !== 'play') return;
    updatePlayer(dt);

    S.fireCD -= dt;
    const firing = (S.pointer.down && S.pointer.mouse) || S.keyFire || !!S.aimTouch;
    if (firing && S.fireCD <= 0) fire();
    if (S.fireCD < -0.15) {
      const sh = shoulder();
      let a = null;
      if (S.pointer.mouse && S.pointer.inPlay) a = Math.atan2(S.pointer.y - sh.y, S.pointer.x - sh.x);
      else if (IS_TOUCH || !S.pointer.mouse) { const t = nearestEnemy(sh); if (t) a = Math.atan2(t.y - sh.y, t.x - sh.x); }
      if (a !== null) S.aim = lerpAngle(S.aim, a, Math.min(1, dt * 10));
    }

    // ÷ ve × mermileri kendiliğinden dolar
    for (let i = 2; i < 4; i++) {
      if (S.ammo[i] < S.ammoCap) {
        S.ammoT[i] += dt;
        if (S.ammoT[i] >= AMMO_REGEN) { S.ammoT[i] = 0; S.ammo[i]++; S.cardShake[i] = 0.6; Snd.ammo(); }
      } else S.ammoT[i] = 0;
    }
    S.iframes = Math.max(0, S.iframes - dt);

    // dalga akışı
    if (S.waveActive) {
      if (S.bossPending) {
        S.spawnT -= dt;
        if (S.spawnT <= 0) { spawnBoss(S.bossPending); S.bossPending = null; }
      } else if (S.spawnQueue.length) {
        S.spawnT -= dt;
        if (S.spawnT <= 0) {
          spawnEnemy(S.spawnQueue.shift());
          S.spawnT = S.cfg.gap * Math.max(0.6, 1.15 - S.wave * 0.05);
        }
      } else if (S.enemies.length === 0) {
        S.waveActive = false;
        S.bullets.length = 0;
        if (S.wave >= WAVES) { stageClear(); return; }
        S.nextWaveT = 2.2;
        const bonus = S.wave * 10, heal = Math.min(isBossWave(S.wave) ? 30 : 10, S.maxHp - S.hp);
        S.rp += bonus; S.rpPop = 1;
        S.hp += heal;
        S.banner = { text: isBossWave(S.wave) ? 'Boss silindi!' : 'Dalga temiz!', sub: `+${bonus} RP${heal > 0 ? ` · +${heal} can` : ''}`, t: 0, life: 2.0 };
        Snd.wave();
      }
    } else if (S.nextWaveT > 0) {
      S.nextWaveT -= dt;
      if (S.nextWaveT <= 0) startWave();
    }

    updateShots(dt);
    updateEnemies(dt);
    if (S.mode !== 'play') return;
    updateBullets(dt);
    updateOrbs(dt);
  }

  function updatePlayer(dt) {
    let mx = 0, my = 0;
    const k = S.keys;
    if (k.left) mx -= 1;
    if (k.right) mx += 1;
    if (k.up) my -= 1;
    if (k.down) my += 1;
    if (S.stick) {
      const dx = S.stick.x - S.stick.ox, dy = S.stick.y - S.stick.oy, l = Math.hypot(dx, dy);
      if (l > 6) { const m = Math.min(1, l / 60); mx += dx / l * m; my += dy / l * m; }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const r = Math.min(1, dt * 14);
    S.pvx += (mx * MOVE_SPEED - S.pvx) * r;
    S.pvy += (my * MOVE_SPEED - S.pvy) * r;
    S.px = clamp(S.px + S.pvx * dt, P_MIN_X, P_MAX_X);
    S.py = clamp(S.py + S.pvy * dt, P_MIN_Y, P_MAX_Y);
    S.walk += Math.hypot(S.pvx, S.pvy) * dt * 0.06;
  }

  function updateShots(dt) {
    for (const s of S.shots) {
      s.age += dt;
      if (s.target && !s.target.dead) {
        const cur = Math.atan2(s.vy, s.vx);
        const want = Math.atan2(s.target.y - s.y, s.target.x - s.x);
        const d = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const a = cur + clamp(d, -10 * dt, 10 * dt);
        s.vx = Math.cos(a) * SHOT_SPEED; s.vy = Math.sin(a) * SHOT_SPEED;
      }
      s.trail.push(s.x, s.y);
      if (s.trail.length > 16) s.trail.splice(0, 2);
      s.x += s.vx * dt; s.y += s.vy * dt;
      for (const e of S.enemies) {
        if (e.dead || e.write < 1) continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 12) { hitEnemy(e, s); s.dead = true; break; }
      }
      if (s.x < -60 || s.x > W + 60 || s.y < -60 || s.y > H + 60) s.dead = true;
    }
    S.shots = S.shots.filter(s => !s.dead);
  }

  function updateEnemies(dt) {
    const es = S.enemies;
    const cx = S.px, cy = S.py - 20;
    for (const e of es) {
      e.pop = Math.max(0, e.pop - dt * 4.5);
      e.change = Math.max(0, e.change - dt * 3.2);
      e.flash = Math.max(0, e.flash - dt * 5);
      if (e.markT > 0) { e.markT -= dt; if (e.markT <= 0) { e.markT = 0; e.markMul = 1; } }
      if (e.write < 1) { e.write = Math.min(1, e.write + dt * 2.2); continue; }
      if (e.boss) {
        updateBoss(e, dt);
        if (S.mode !== 'play') return;
        if (e.dashState === 1) { e.vx *= 0.8; e.vy *= 0.8; continue; }       // atılmadan önce titrer
        if (e.dashState === 2) { e.vx = Math.cos(e.dashDir) * 430; e.vy = Math.sin(e.dashDir) * 430; continue; }
      }
      const dx = cx - e.x, dy = cy - e.y, d = Math.hypot(dx, dy) || 1;
      e.wob += dt * 2.2;
      const nx = -dy / d, ny = dx / d, w = Math.sin(e.wob) * 0.45;
      const tx = (dx / d + nx * w) * e.spd, ty = (dy / d + ny * w) * e.spd;
      const k = Math.min(1, dt * 2);
      e.vx += (tx - e.vx) * k; e.vy += (ty - e.vy) * k;
    }
    // sayılar üst üste binmesin
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead || a.write < 1) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead || b.write < 1) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const min = a.r + b.r + 8;
        if (d < min) {
          // bosslar ağırdır: küçük sayıları iter ama kendisi pek kımıldamaz
          const wa = a.boss && !b.boss ? 0.1 : (b.boss && !a.boss ? 0.9 : 0.5);
          const push = min - d;
          a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
          b.x += dx / d * push * (1 - wa); b.y += dy / d * push * (1 - wa);
        }
      }
    }
    for (const e of es) {
      if (e.dead || e.write < 1) continue;
      e.x += e.vx * dt; e.y += e.vy * dt;
      const mx = e.boss ? e.r * 0.8 : 0;
      e.x = clamp(e.x, 40 + mx, W - 20 - mx);
      e.y = clamp(e.y, PLAY_TOP + 20 + mx * 0.6, PLAY_BOTTOM - 35 - mx * 0.6);
      if (Math.hypot(cx - e.x, cy - e.y) < (e.boss ? e.r * 0.85 : e.r) + 26) hurtPlayer(e);
      if (S.mode !== 'play') break;
    }
    S.enemies = S.enemies.filter(e => !e.dead);
  }

  function updateOrbs(dt) {
    const cx = S.px, cy = S.py - 20;
    for (const o of S.orbs) {
      o.age += dt;
      const dx = cx - o.x, dy = cy - o.y, d = Math.hypot(dx, dy) || 1;
      if (o.age > 0.35 || d < 140) {
        const pull = 900 + o.age * 1200;
        o.vx += dx / d * pull * dt; o.vy += dy / d * pull * dt;
        o.vx *= Math.pow(0.15, dt); o.vy *= Math.pow(0.15, dt);
      } else { o.vx *= Math.pow(0.02, dt); o.vy *= Math.pow(0.02, dt); }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (d < 24) { o.dead = true; Snd.xp(); gainXP(o.val); if (S.mode !== 'play') break; }
    }
    S.orbs = S.orbs.filter(o => !o.dead);
  }

  function updateFx(dt) {
    for (const p of S.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'crumb') { p.vy += 600 * dt; p.vx *= 0.98; }
      else if (p.type !== 'label') { p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); }
      p.rot += dt * 6;
    }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const p of S.popups) p.t += dt;
    S.popups = S.popups.filter(p => p.t < p.life);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.life) S.banner = null; }
    S.recoil = Math.max(0, S.recoil - dt * 9);
    S.hurt = Math.max(0, S.hurt - dt * 2);
    S.shake = Math.max(0, S.shake - dt * 45);
    S.rpPop = Math.max(0, S.rpPop - dt * 4);
    for (let i = 0; i < S.cardShake.length; i++) S.cardShake[i] = Math.max(0, S.cardShake[i] - dt * 4);
    S.rpShown += (S.rp - S.rpShown) * Math.min(1, dt * 10);
    if (Math.abs(S.rp - S.rpShown) < 0.5) S.rpShown = S.rp;
    S.hpShown += (S.hp - S.hpShown) * Math.min(1, dt * 6);
    const xpFrac = S.xp / xpNeed(S.level);
    S.xpShown += (xpFrac - S.xpShown) * Math.min(1, dt * 8);
    if (xpFrac < S.xpShown - 0.5) S.xpShown = xpFrac;
  }

  // ---------- çizim ----------
  function drawText(text, x, y, size, color, font, seed, alpha = 1) {
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillText(text, x + noise(seed) * 1.8, y + noise(seed + 3) * 1.8);
    ctx.globalAlpha = alpha;
    ctx.fillText(text, x + noise(seed + 7) * 0.6, y + noise(seed + 9) * 0.6);
    ctx.globalAlpha = 1;
  }

  function drawEnemies(boil) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const e of S.enemies) {
      if (e.boss) { drawBoss(e, boil); continue; }
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.beginPath(); ctx.ellipse(4, e.r * 0.75, e.r * 0.8, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(noise(e.id * 13 + boil) * 0.04 + Math.sin(e.wob) * 0.07);
      let sc = 1 + e.pop * 0.45;
      if (e.write < 1) sc *= Math.max(0.01, easeOutBack(e.write));
      ctx.scale(sc, sc);
      if (e.change > 0) {
        const k = 1 - e.change;
        drawText(fmt(e.prev), k * 18, -k * 34, 46 * (1 - k * 0.4), '#8a8580', NUM_FONT, e.id + boil, e.change * 0.55);
      }
      const color = e.flash > 0.45 ? RED : (e.value < 0 ? NEG_INK : INK);
      drawText(fmt(e.value), 0, 0, 46, color, NUM_FONT, e.id * 7 + boil);
      if (e.markT > 0) {
        // × işareti: turuncu rozet + kalan süre halkası
        const bx = e.r * 0.85, by = -26;
        const blink = e.markT < 1.5 && Math.floor(clock * 8) % 2 === 0;
        if (!blink) {
          ctx.fillStyle = PAPER; ctx.strokeStyle = MARK; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(bx, by, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(bx, by, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.markT / MARK_TIME)); ctx.stroke();
          ctx.font = `16px ${NUM_FONT}`; ctx.fillStyle = MARK;
          ctx.fillText('×' + e.markMul, bx, by + 1);
        }
      }
      ctx.restore();
    }
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // Silgi boss: pembe gövde + kağıt kılıf; sayı kılıfın üstünde yazar. Aksesuar tipe göre.
  function drawBoss(e, boil) {
    const B = BOSS_TYPES[e.boss], sz = e.size;
    const w = 118 * sz * (B.wide || 1), h = 72 * sz;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.ellipse(6, h * 0.62, w * 0.5, 10 * sz, 0, 0, Math.PI * 2); ctx.fill();
    if (e.dashState === 1) ctx.translate(rand(-3, 3), rand(-3, 3));
    if (e.write < 1) { const k = Math.max(0.01, easeOutBack(e.write)); ctx.scale(k, k); }
    ctx.globalAlpha = e.ghostA;
    ctx.rotate(Math.sin(e.t * 5) * 0.035 + (e.dashState === 2 ? Math.cos(e.dashDir) * 0.15 : 0));
    const sc = 1 + e.pop * 0.12; ctx.scale(sc, sc);
    const flash = e.flash > 0.5;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // gövde
    rrect(-w / 2, -h / 2, w, h, 16 * sz);
    ctx.fillStyle = flash ? '#ff8f8f' : B.body; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
    if (e.boss === 'hayalet') {
      ctx.fillStyle = B.body;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-w / 2 + w * (k + 0.5) / 4, h / 2, w / 9, 0, Math.PI); ctx.fill(); ctx.stroke(); }
    }
    // kağıt kılıf (sağda)
    const sx0 = -w * 0.08, sw = w / 2 - sx0 + 5;
    ctx.fillStyle = B.sleeve;
    ctx.fillRect(sx0, -h / 2 - 5, sw, h + 10);
    ctx.strokeRect(sx0, -h / 2 - 5, sw, h + 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx0 + 6, -h / 2 + 2); ctx.lineTo(sx0 + sw - 6, -h / 2 + 2); ctx.stroke();
    if (e.boss === 'zombi') {
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) { const yy = -h * 0.3 + k * h * 0.3; ctx.beginPath(); ctx.moveTo(sx0 - 8, yy - 5); ctx.lineTo(sx0 + 8, yy + 5); ctx.moveTo(sx0 - 8, yy + 5); ctx.lineTo(sx0 + 8, yy - 5); ctx.stroke(); }
    }
    // sayı (kılıfa sığacak boyutta)
    const txt = fmt(e.value);
    const fs = Math.min(36 * sz, (sw - 12) * 1.75 / Math.max(2, txt.length));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${fs}px ${NUM_FONT}`;
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(txt, sx0 + sw / 2, 2);
    ctx.fillStyle = flash ? '#ffd633' : '#fff'; ctx.fillText(txt, sx0 + sw / 2, 2);
    // yüz (pembe kısımda)
    const fx = (-w / 2 + sx0) / 2, look = Math.atan2(S.py - 40 - e.y, S.px - e.x);
    const lx = Math.cos(look) * 3, ly = Math.sin(look) * 3;
    const eyeR = 8 * sz;
    for (const o of [-1, 1]) {
      const ex = fx + o * 11 * sz, ey = -h * 0.12;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (e.boss === 'zombi' && o === 1) {
        ctx.beginPath(); ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4); ctx.stroke();
      } else {
        ctx.fillStyle = e.boss === 'dev' ? RED : INK;
        ctx.beginPath(); ctx.arc(ex + lx, ey + ly, eyeR * 0.45, 0, Math.PI * 2); ctx.fill();
      }
      // kızgın kaşlar
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ex - o * eyeR * 0.7, ey - eyeR + 1); ctx.lineTo(ex + o * eyeR, ey - eyeR - 7); ctx.stroke();
    }
    // ağız
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    const my = h * 0.22;
    if (e.flash > 0.3) { ctx.ellipse(fx, my, 7 * sz, 6 * sz, 0, 0, Math.PI * 2); }
    else { ctx.moveTo(fx - 12 * sz, my); for (let k = 1; k <= 4; k++) ctx.lineTo(fx - 12 * sz + k * 6 * sz, my + (k % 2 ? -4 : 0) * sz); }
    ctx.stroke();
    if (e.boss === 'sisko') {
      ctx.fillStyle = 'rgba(224,64,122,0.35)';
      for (const o of [-1, 1]) { ctx.beginPath(); ctx.arc(fx + o * 22 * sz, h * 0.08, 7 * sz, 0, Math.PI * 2); ctx.fill(); }
    }
    // aksesuarlar
    const top = -h / 2;
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    if (e.boss === 'sapkali') {
      ctx.fillStyle = '#1f1d1b';
      ctx.fillRect(fx - 26 * sz, top - 6, 52 * sz, 8);
      ctx.fillRect(fx - 17 * sz, top - 46 * sz, 34 * sz, 42 * sz);
      ctx.fillStyle = '#e0407a'; ctx.fillRect(fx - 17 * sz, top - 16 * sz, 34 * sz, 7 * sz);
    } else if (e.boss === 'ogretmen') {
      for (const o of [-1, 1]) { ctx.beginPath(); ctx.arc(fx + o * 11 * sz, -h * 0.12, eyeR + 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(fx - 3, -h * 0.12); ctx.lineTo(fx + 3, -h * 0.12); ctx.stroke();
      ctx.fillStyle = '#8a8580'; ctx.beginPath(); ctx.arc(fx, top - 12 * sz, 13 * sz, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (e.boss === 'ninja') {
      ctx.fillStyle = RED; ctx.fillRect(-w / 2 + 2, -h * 0.34, sx0 + w / 2 - 2, 9 * sz);
      ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.3); ctx.lineTo(-w / 2 - 26, -h * 0.42 + Math.sin(e.t * 9) * 6); ctx.lineTo(-w / 2 - 22, -h * 0.2 + Math.sin(e.t * 9 + 1) * 6); ctx.closePath(); ctx.fill();
    } else if (e.boss === 'kosucu') {
      ctx.fillStyle = '#ffd633'; ctx.fillRect(-w / 2 + 2, -h * 0.4, sx0 + w / 2 - 2, 8 * sz);
      if (Math.hypot(e.vx, e.vy) > 60) {
        ctx.strokeStyle = 'rgba(31,29,27,0.4)';
        const a = Math.atan2(e.vy, e.vx);
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-Math.cos(a) * w * 0.6 + k * 12, -Math.sin(a) * w * 0.6 + k * 14); ctx.lineTo(-Math.cos(a) * w * 0.95 + k * 12, -Math.sin(a) * w * 0.95 + k * 14); ctx.stroke(); }
      }
    } else if (e.boss === 'kral' || e.boss === 'dev') {
      ctx.fillStyle = '#f2c230';
      const cw = 46 * sz, cx0 = fx - cw / 2, cy0 = top - 4;
      ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0, cy0 - 22 * sz);
      for (let k = 1; k <= 4; k++) ctx.lineTo(cx0 + cw * k / 4 - cw / 8, cy0 - (k % 2 ? 10 : 24) * sz), ctx.lineTo(cx0 + cw * k / 4, cy0 - 22 * sz);
      ctx.lineTo(cx0 + cw, cy0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (e.boss === 'ikiz') {
      ctx.fillStyle = e.v0 > 0 ? '#e0407a' : '#3a6fd1';
      for (const o of [-1, 1]) { ctx.beginPath(); ctx.moveTo(fx, top - 4); ctx.lineTo(fx + o * 18, top - 16); ctx.lineTo(fx + o * 18, top + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
    // atılma uyarısı: kırmızı kesik çizgi
    if (e.dashState === 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(212,58,47,0.6)'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.dashDir) * 260, e.y + Math.sin(e.dashDir) * 260); ctx.stroke();
      ctx.restore();
    }
    if (e.markT > 0) {
      ctx.save(); ctx.translate(e.x + w * 0.45, e.y - h * 0.6);
      ctx.fillStyle = PAPER; ctx.strokeStyle = MARK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.markT / MARK_TIME)); ctx.stroke();
      ctx.font = `17px ${NUM_FONT}`; ctx.fillStyle = MARK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('×' + e.markMul, 0, 1);
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of S.bullets) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.fillStyle = '#e8a7b5'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillRect(-8, -6, 16, 12); ctx.strokeRect(-8, -6, 16, 12);
      ctx.restore();
    }
  }

  function drawBossBar() {
    const bosses = S.enemies.filter(e => e.boss);
    if (!bosses.length) return;
    const cur = bosses.reduce((a, e) => a + Math.abs(e.value), 0), max = bosses.reduce((a, e) => a + Math.abs(e.v0), 0);
    const x = 70, y = 142, w = W - 140;
    drawBar(x, y, w, 16, cur / max, '#e0407a');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `18px ${NUM_FONT}`; ctx.lineWidth = 5; ctx.strokeStyle = PAPER; ctx.lineJoin = 'round';
    const label = `${BOSS_TYPES[bosses[0].boss].name} · ${cur}`;
    ctx.strokeText(label, W / 2, y + 9); ctx.fillStyle = INK; ctx.fillText(label, W / 2, y + 9);
  }

  function drawOrbs() {
    for (const o of S.orbs) {
      const s = 4 + Math.min(4, o.val * 0.6);
      ctx.fillStyle = '#7a4bd8';
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(o.x, o.y, s * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(o.x, o.y, s, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Telefon kontrolleri: sol joystick ve sağ nişan halkası
  function drawTouchControls() {
    if (S.mode !== 'play') return;
    ctx.lineWidth = 3;
    if (S.stick) {
      const st = S.stick, dx = st.x - st.ox, dy = st.y - st.oy, l = Math.hypot(dx, dy), m = Math.min(l, 60);
      const kx = st.ox + (l ? dx / l * m : 0), ky = st.oy + (l ? dy / l * m : 0);
      ctx.fillStyle = 'rgba(31,29,27,0.07)'; ctx.strokeStyle = 'rgba(31,29,27,0.3)';
      ctx.beginPath(); ctx.arc(st.ox, st.oy, 62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(31,29,27,0.35)';
      ctx.beginPath(); ctx.arc(kx, ky, 24, 0, Math.PI * 2); ctx.fill();
    }
    if (S.aimTouch) {
      const at = S.aimTouch;
      ctx.strokeStyle = 'rgba(212,58,47,0.45)';
      ctx.beginPath(); ctx.arc(at.ox, at.oy, 40, 0, Math.PI * 2); ctx.stroke();
      const dx = at.x - at.ox, dy = at.y - at.oy, l = Math.hypot(dx, dy);
      if (l > 14) {
        const m = Math.min(l, 40);
        ctx.fillStyle = 'rgba(212,58,47,0.5)';
        ctx.beginPath(); ctx.arc(at.ox + dx / l * m, at.oy + dy / l * m, 14, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawShots() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of S.shots) {
      const t = s.trail;
      if (t.length >= 4) {
        for (let i = 2; i < t.length; i += 2) {
          const k = i / t.length;
          ctx.strokeStyle = `rgba(212,58,47,${0.28 * k})`;
          ctx.lineWidth = 3 + 9 * k;
          ctx.beginPath(); ctx.moveTo(t[i - 2], t[i - 1]); ctx.lineTo(i + 2 < t.length ? t[i + 2] : s.x, i + 2 < t.length ? t[i + 3] : s.y); ctx.stroke();
        }
      }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin * 0.3 + Math.sin(s.age * 18) * 0.08);
      const sc = Math.min(1, 0.5 + s.age * 8);
      ctx.scale(sc, sc);
      ctx.lineWidth = 5; ctx.strokeStyle = PAPER;
      ctx.font = `30px ${NUM_FONT}`;
      ctx.strokeText(s.label, 0, 0);
      ctx.fillStyle = s.op === 3 ? MARK : RED;
      ctx.fillText(s.label, 0, 0);
      ctx.restore();
    }
  }

  function drawPlayer(boil) {
    // dokunulmazlık süresinde yanıp söner
    if (S.iframes > 0 && Math.floor(clock * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    drawStick(S.px, S.py, S.aim, S.recoil, S.hurt, boil, S.walk, Math.hypot(S.pvx, S.pvy) > 20);
    ctx.globalAlpha = 1;
  }

  // Çöp adam: (bx, by) gövde merkezi; aim = kalemin yönü; recoil/hurt 0..1; walk = adım fazı.
  function drawStick(bx, by, aim, recoil, hurtT, boil, walk = 0, moving = false) {
    const bob = Math.sin(clock * 3) * 2;
    const rec = recoil * 7;
    const x = bx + Math.cos(aim) * -rec * 0.4, y = by + bob;
    const hurt = hurtT > 0 && Math.floor(clock * 20) % 2 === 0;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = hurt ? RED : INK; ctx.lineWidth = 4;
    const L = (x1, y1, x2, y2, s) => {
      ctx.beginPath();
      ctx.moveTo(x1 + noise(s + boil) * 0.9, y1 + noise(s + boil + 1) * 0.9);
      ctx.lineTo(x2 + noise(s + boil + 2) * 0.9, y2 + noise(s + boil + 3) * 0.9);
      ctx.stroke();
    };
    // gölge
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.ellipse(x + 2, by + 52, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
    // bacaklar, gövde, arka kol
    const sw = moving ? Math.sin(walk) * 12 : 0, lift = moving ? Math.abs(Math.cos(walk)) * 5 : 0;
    L(x + 2, y + 8, x - 14 + sw, by + 50 - (sw > 0 ? lift : 0), 21);
    L(x + 2, y + 8, x + 18 - sw, by + 50 - (sw < 0 ? lift : 0), 31);
    L(x, y - 48, x + 2, y + 8, 11);
    L(x, y - 34, x + 20, y - 8, 41);
    // kafa
    const hx = x, hy = y - 66;
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.ellipse(hx + noise(boil) * 0.6, hy, 18, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const ex = Math.cos(aim) * 4, ey = Math.sin(aim) * 3;
    ctx.lineWidth = 3;
    if (hurtT > 0.5) {
      for (const o of [-7, 4]) { L(hx + o - 3 + ex, hy - 5 + ey, hx + o + 3 + ex, hy + 1 + ey, 61); L(hx + o + 3 + ex, hy - 5 + ey, hx + o - 3 + ex, hy + 1 + ey, 63); }
    } else {
      ctx.fillStyle = INK;
      for (const o of [-7, 4]) { ctx.beginPath(); ctx.arc(hx + o + ex, hy - 1 + ey, 2.6, 0, Math.PI * 2); ctx.fill(); }
      L(hx - 12 + ex, hy - 10 + ey, hx - 3 + ex, hy - 6 + ey, 71);
      L(hx + 1 + ex, hy - 6 + ey, hx + 9 + ex, hy - 10 + ey, 73);
    }
    // nişan kolu + kırmızı kalem
    ctx.lineWidth = 4;
    const a = aim, ca = Math.cos(a), sa = Math.sin(a);
    const sx = x - 2, sy = y - 36;
    const reach = 30 - rec;
    const hx2 = sx + ca * reach, hy2 = sy + sa * reach;
    const elx = sx + ca * reach * 0.5 - sa * 5, ely = sy + sa * reach * 0.5 + ca * 5;
    L(sx, sy, elx, ely, 51); L(elx, ely, hx2, hy2, 53);
    ctx.save();
    ctx.translate(hx2, hy2); ctx.rotate(a);
    ctx.fillStyle = '#e04b3f'; ctx.fillRect(-10, -4, 30, 8);
    ctx.fillStyle = '#f0a0b0'; ctx.fillRect(-15, -4, 5, 8);
    ctx.fillStyle = '#f1d2a6';
    ctx.beginPath(); ctx.moveTo(20, -4); ctx.lineTo(31, 0); ctx.lineTo(20, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(27, -1.4); ctx.lineTo(31, 0); ctx.lineTo(27, 1.4); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeRect(-15, -4, 35, 8);
    ctx.restore();
    ctx.restore();
  }

  function drawParts() {
    ctx.lineCap = 'round';
    for (const p of S.parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (p.type === 'dot') {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'line') {
        const a = Math.atan2(p.vy, p.vx), l = 6 + p.size * 2;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * l, p.y - Math.sin(a) * l); ctx.stroke();
      } else if (p.type === 'crumb') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3 * k;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20 + (1 - k) * 60, 0, Math.PI * 2); ctx.stroke();
      } else if (p.type === 'ghost') {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = k * 0.8;
        ctx.font = `${p.size * (1 + (1 - k) * 0.9)}px ${NUM_FONT}`;
        ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'label') {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `${p.size}px ${NUM_FONT}`;
        ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const p of S.popups) {
      const k = p.t / p.life;
      const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const s = k < 0.12 ? easeOutBack(k / 0.12) : 1;
      ctx.save();
      ctx.translate(p.x, p.y - p.t * 22);
      ctx.rotate(-0.05);
      ctx.scale(s, s);
      ctx.globalAlpha = alpha;
      const gap = (i) => (p.lines[i].size + p.lines[i + 1].size) / 2 + 6;
      let yy = 0;
      for (let i = 0; i < p.lines.length - 1; i++) yy -= gap(i);
      for (let i = 0; i < p.lines.length; i++) {
        const l = p.lines[i];
        ctx.font = `${l.size}px ${l.font}`;
        ctx.lineWidth = 6; ctx.strokeStyle = PAPER;
        ctx.strokeText(l.text, 0, yy);
        ctx.fillStyle = l.color; ctx.fillText(l.text, 0, yy);
        if (i < p.lines.length - 1) yy += gap(i);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // El çizimi görünümlü bar: kağıt zemin, dolgu, mürekkep çerçeve
  function drawBar(x, y, w, h, frac, color, back = 'rgba(31,29,27,0.08)') {
    ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 1, y + noise(x) * 0.8); ctx.lineTo(x + w + 1, y + noise(x + 1) * 0.8);
    ctx.lineTo(x + w + noise(y) * 0.8, y + h); ctx.lineTo(x - 1, y + h + noise(w) * 0.8); ctx.closePath();
    ctx.stroke();
  }

  function drawHUD(boil) {
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    // RP
    ctx.save();
    ctx.translate(24, 46);
    const rs = 1 + S.rpPop * 0.2; ctx.scale(rs, rs);
    drawText(`${Math.round(S.rpShown)} RP`, 0, 0, 30, INK, UI_FONT, boil);
    ctx.restore();
    // can barı
    const hpFrac = S.hpShown / S.maxHp;
    drawBar(24, 60, 190, 18, hpFrac, hpFrac < 0.3 ? '#e0453a' : '#e86b5c');
    ctx.font = `17px ${UI_FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(S.hp)} / ${S.maxHp}`, 24 + 95, 75);
    // bölüm + dalga
    ctx.textAlign = 'right';
    drawText(`Bölüm ${S.stage}`, W - 24, 46, 30, S.stage >= 17 ? RED : INK, UI_FONT, boil + 9);
    const left = Math.max(0, S.waveTotal - S.resolved);
    const boss = isBossWave(S.wave);
    ctx.font = `20px ${UI_FONT}`; ctx.fillStyle = boss ? '#e0407a' : INK;
    ctx.fillText(`Dalga ${Math.max(1, S.wave)}/${WAVES}${boss ? ' · BOSS' : ` · ${left} kaldı`}`, W - 24, 76);
    // seviye + XP barı
    ctx.textAlign = 'left';
    drawText(`Sv ${S.level}`, 24, 111, 26, '#7a4bd8', NUM_FONT, boil + 3);
    drawBar(96, 98, W - 120, 12, S.xpShown, '#9b78e6');
    ctx.font = `15px ${UI_FONT}`; ctx.fillStyle = 'rgba(31,29,27,0.65)'; ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(S.xp)} / ${xpNeed(S.level)} XP`, W - 26, 126);
  }

  function drawCards(boil) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const wpn = WEAPONS[i], selected = S.sel === i, empty = wpn.limited && S.ammo[i] <= 0;
      const x = CARD_X0 + i * (CARD_W + CARD_GAP) + CARD_W / 2 + Math.sin(S.cardShake[i] * 30) * 6 * S.cardShake[i];
      const y = CARD_Y + CARD_H / 2 + (selected ? -10 : 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(noise(i * 5) * 0.03);
      ctx.globalAlpha = empty ? 0.5 : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-CARD_W / 2 + 3, -CARD_H / 2 + 5, CARD_W, CARD_H);
      ctx.fillStyle = '#fbf8f1'; ctx.fillRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
      if (selected) {
        ctx.fillStyle = 'rgba(255,214,51,0.6)';
        ctx.beginPath();
        ctx.moveTo(-CARD_W / 2 + 4, -CARD_H / 2 + 8); ctx.lineTo(CARD_W / 2 - 2, -CARD_H / 2 + 4);
        ctx.lineTo(CARD_W / 2 - 5, CARD_H / 2 - 6); ctx.lineTo(-CARD_W / 2 + 2, CARD_H / 2 - 3);
        ctx.fill();
      }
      ctx.strokeStyle = selected ? INK : 'rgba(31,29,27,0.35)'; ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.strokeRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
      ctx.save(); ctx.rotate(-0.08);
      ctx.fillStyle = 'rgba(205,200,180,0.65)'; ctx.fillRect(-18, -CARD_H / 2 - 8, 36, 14);
      ctx.restore();
      // tuş numarası ve silah seviyesi
      ctx.textAlign = 'left';
      ctx.font = `16px ${UI_FONT}`; ctx.fillStyle = 'rgba(31,29,27,0.5)';
      ctx.fillText(String(i + 1), -CARD_W / 2 + 7, -CARD_H / 2 + 14);
      ctx.textAlign = 'right'; ctx.fillStyle = '#7a4bd8';
      ctx.fillText(`Sv ${S.wlv[i]}`, CARD_W / 2 - 7, -CARD_H / 2 + 14);
      ctx.textAlign = 'center';
      const col = empty ? '#999' : (selected ? (i === 3 ? MARK : RED) : INK);
      drawText(wLabel(i, S.wlv[i]), 0, -6, 38, col, NUM_FONT, i * 11 + (selected ? boil : 0));
      ctx.font = `19px ${UI_FONT}`; ctx.fillStyle = INK;
      if (!wpn.limited) ctx.fillText('∞', 0, CARD_H / 2 - 20);
      else {
        ctx.fillText(`${S.ammo[i]}/${S.ammoCap}`, 0, CARD_H / 2 - 24);
        // bir sonraki mermiye kalan süre
        const k = S.ammo[i] < S.ammoCap ? S.ammoT[i] / AMMO_REGEN : 1;
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(31,29,27,0.12)'; ctx.fillRect(-36, CARD_H / 2 - 12, 72, 5);
        ctx.fillStyle = i === 3 ? MARK : '#0f7f8f'; ctx.fillRect(-36, CARD_H / 2 - 12, 72 * k, 5);
      }
      ctx.restore();
    }
  }

  function drawBanner() {
    const b = S.banner;
    if (!b) return;
    const k = b.t / b.life;
    const s = k < 0.15 ? easeOutBack(k / 0.15) : 1;
    const a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2 - 20, 320);
    ctx.rotate(-0.04);
    ctx.scale(s, s);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `58px ${NUM_FONT}`;
    const tw = ctx.measureText(b.text).width;
    ctx.fillStyle = b.boss ? 'rgba(224,64,122,0.45)' : 'rgba(255,214,51,0.55)';
    ctx.fillRect(-tw / 2 - 16, -6, tw + 32, 32);
    ctx.fillStyle = INK; ctx.fillText(b.text, 0, 0);
    if (b.sub) {
      ctx.font = `30px ${UI_FONT}`;
      ctx.lineWidth = 6; ctx.strokeStyle = PAPER; ctx.lineJoin = 'round';
      ctx.strokeText(b.sub, 0, 52);
      ctx.fillStyle = '#c0392b'; ctx.fillText(b.sub, 0, 52);
    }
    ctx.restore();
  }

  function drawAim() {
    const p = S.pointer;
    if (S.mode !== 'play') return;
    let t = null;
    if (S.aimTouch) t = aimInfo().target;
    else if (p.mouse && p.inPlay) t = findTarget(p.x, p.y);
    ctx.lineWidth = 2;
    if (t) {
      ctx.strokeStyle = 'rgba(212,58,47,0.7)';
      ctx.setLineDash([6, 6]); ctx.lineDashOffset = -clock * 30;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 10, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function render() {
    const boil = Math.floor(clock * 9);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    const sx = canvas.width / W, sy = canvas.height / H;
    const ox = S.shake > 0 ? rand(-1, 1) * S.shake : 0, oy = S.shake > 0 ? rand(-1, 1) * S.shake : 0;
    ctx.setTransform(sx, 0, 0, sy, ox * sx, oy * sy);
    drawAim();
    drawOrbs();
    drawEnemies(boil);
    if (S.mode !== 'menu' && S.mode !== 'stages') drawPlayer(boil);
    drawShots();
    drawBullets();
    drawParts();
    drawPopups();
    drawBanner();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    drawTouchControls();
    if (S.mode !== 'menu' && S.mode !== 'stages') { drawHUD(boil); drawBossBar(); }
    drawCards(boil);
    if (S.hurt > 0) {
      ctx.fillStyle = `rgba(212,58,47,${S.hurt * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- açılış animasyonu ----------
  // 3 kısa "oyun videosu" film karesi içinde döner, sonra çöp adam
  // "DORUKPLAYS SUNAR" yazısını harfleri kalemle fırlatarak yazar.
  const CLIP_LEN = 2.5, CLIPS = 3, LOGO_AT = CLIP_LEN * CLIPS;
  const CLIP_CAPTIONS = ['Sayıları sıfıra indir!', '÷ ile böl, parçala!', 'Seviye atla, güçlen!'];
  const LOGO_LINES = [
    { text: 'DORUKPLAYS', y: 330, size: 64, color: INK },
    { text: 'SUNAR', y: 425, size: 58, color: RED },
  ];
  const LOGO_SHOT = 0.26, LOGO_GAP = 0.12, LOGO_FIRST = 0.4;
  const LOGO_DONE = LOGO_FIRST + (LOGO_LINES[0].text.length + LOGO_LINES[1].text.length - 1) * LOGO_GAP + LOGO_SHOT;
  const INTRO_LEN = LOGO_AT + LOGO_DONE + 2.0;
  const lerp = (a, b, k) => a + (b - a) * k;
  let introT = 0, logoLetters = null;

  function startIntro() { introT = 0; setMode('intro'); showOverlay(null); }
  function endIntro() { if (S.mode === 'intro') toMenu(); }

  function vShot(x0, y0, x1, y1, tf, dur, t, label, size = 24) {
    if (t < tf || t > tf + dur) return;
    const k = (t - tf) / dur, kb = Math.max(0, k - 0.35);
    const x = lerp(x0, x1, k), y = lerp(y0, y1, k);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(212,58,47,0.3)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(lerp(x0, x1, kb), lerp(y0, y1, kb)); ctx.lineTo(x, y); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${size}px ${NUM_FONT}`;
    ctx.lineWidth = 4; ctx.strokeStyle = PAPER; ctx.strokeText(label, x, y);
    ctx.fillStyle = RED; ctx.fillText(label, x, y);
  }

  function vBurst(x, y, age, color, seed) {
    if (age < 0 || age > 0.6) return;
    const k = age / 0.6;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = 3;
    for (let j = 0; j < 12; j++) {
      const a = j / 12 * Math.PI * 2 + noise(seed + j) * 0.3, r0 = 14 + k * 46, r1 = r0 + 10 + noise(seed + j + 40) * 4;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 16 + k * 52, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${46 * (1 + k)}px ${NUM_FONT}`; ctx.fillStyle = color; ctx.fillText('0', x, y);
    ctx.globalAlpha = 1;
  }

  function vPop(x, y, text, color, size, age) {
    if (age < 0 || age > 1.0) return;
    const a = age < 0.75 ? 1 : 1 - (age - 0.75) / 0.25;
    const s = age < 0.12 ? easeOutBack(age / 0.12) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y - age * 20); ctx.rotate(-0.06); ctx.scale(s, s);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `${size}px ${NUM_FONT}`;
    ctx.lineWidth = 6; ctx.strokeStyle = PAPER; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color; ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function vNum(v, x, y, popAge, seed) {
    const pop = popAge >= 0 && popAge < 0.25 ? 1 - popAge / 0.25 : 0;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1 + pop * 0.45, 1 + pop * 0.45);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    drawText(fmt(v), 0, 0, 46, pop > 0.5 ? RED : (v < 0 ? NEG_INK : INK), NUM_FONT, seed);
    ctx.restore();
  }

  // Videolardaki küçük çöp adam (0.75 ölçek). Kalemin ucunu döndürür.
  function vStick(x, y, aim, rec, boil) {
    ctx.save(); ctx.translate(x, y); ctx.scale(0.75, 0.75);
    drawStick(0, 0, aim, rec, 0, boil);
    ctx.restore();
    return { x: x - 1.5 + Math.cos(aim) * 40, y: y - 27 + Math.sin(aim) * 40 };
  }
  const recoilAt = (fires, t) => { let r = 0; for (const f of fires) if (t >= f && t < f + 0.12) r = 1 - (t - f) / 0.12; return r; };

  function vPaper(w, h) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(110,150,205,0.35)'; ctx.lineWidth = 1;
    for (let y = 22; y < h; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,90,90,0.45)';
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(30, h); ctx.stroke();
  }

  function vClipZero(t, boil) {
    const nx = 95, ny = 115, fires = [0.45, 0.85, 1.25], dur = 0.3;
    let hits = 0, last = -9;
    for (const f of fires) if (t >= f + dur) { hits++; last = f + dur; }
    const v = 3 - hits;
    const aim = Math.atan2(ny - 148, nx - 328);
    const hand = vStick(330, 175, aim, recoilAt(fires, t), boil);
    if (v > 0) vNum(v, nx, ny + Math.sin(t * 2) * 4, t - last, boil);
    else vBurst(nx, ny, t - last, INK, 7);
    for (const f of fires) vShot(hand.x, hand.y, nx, ny, f, dur, t, MINUS + '1');
    if (v === 0) vPop(nx + 90, ny - 50, 'SIFIR!', '#2a6fdb', 34, t - last);
  }

  function vClipDivide(t, boil) {
    const nx = 95, ny = 115, dur = 0.28;
    const seq = [
      { f: 0.2, label: '÷2', v: 12 },
      { f: 0.55, label: '÷2', v: 6 },
      { f: 0.9, label: '÷2', v: 3 },
      { f: 1.3, label: MINUS + '3', v: 0 },
    ];
    let v = 24, last = -9;
    for (const s of seq) if (t >= s.f + dur) { v = s.v; last = s.f + dur; }
    const aim = Math.atan2(ny - 148, nx - 328);
    const hand = vStick(330, 175, aim, recoilAt(seq.map(s => s.f), t), boil);
    if (v !== 0) vNum(v, nx, ny, t - last, boil);
    else vBurst(nx, ny, t - last, '#0f7f8f', 23);
    for (const s of seq) vShot(hand.x, hand.y, nx, ny, s.f, dur, t, s.label);
    if (v === 0) vPop(nx + 100, ny - 50, 'PARÇALANDI!', '#0f7f8f', 28, t - last);
  }

  function vClipLevel(t, boil) {
    const sx = 330, sy = 175;
    // XP bar (videonun üstünde)
    const fill = clamp(t / 0.9, 0, 1);
    ctx.fillStyle = 'rgba(31,29,27,0.08)'; ctx.fillRect(60, 40, 280, 12);
    ctx.fillStyle = fill >= 1 && Math.floor(t * 10) % 2 === 0 ? '#ffd633' : '#9b78e6'; ctx.fillRect(60, 40, 280 * fill, 12);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(60, 40, 280, 12);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `16px ${NUM_FONT}`; ctx.fillStyle = '#7a4bd8';
    ctx.fillText(t < 0.9 ? 'Sv 1' : 'Sv 2', 18, 46);
    // mor XP damlaları oyuncuya akar
    for (let k = 0; k < 6; k++) {
      const t0 = 0.05 + k * 0.1, kk = clamp((t - t0) / 0.4, 0, 1);
      if (kk <= 0 || kk >= 1) continue;
      const ox = 80 + noise(k) * 30, oy = 120 + noise(k + 9) * 40;
      const e = kk * kk;
      ctx.fillStyle = '#7a4bd8';
      ctx.beginPath(); ctx.arc(lerp(ox, sx, e), lerp(oy, sy - 20, e), 6, 0, Math.PI * 2); ctx.fill();
    }
    const nx = 95, ny = 160, fireAt = 1.3, dur = 0.28;
    const aim = t > 1.1 ? Math.atan2(ny - 148, nx - 328) : -1.2;
    const jump = t > 0.9 && t < 1.25 ? Math.abs(Math.sin((t - 0.9) * 9)) * 14 : 0;
    const hand = vStick(sx, sy - jump, aim, recoilAt([fireAt], t), boil);
    if (t > 0.9) vPop(200, 82, 'SEVİYE 2!', '#7a4bd8', 30, Math.min(t - 0.9, 0.5));
    if (t > 1.0) vNum(2, nx, ny, t < fireAt + dur ? -1 : t - (fireAt + dur), boil);
    if (t >= fireAt + dur) vBurst(nx, ny, t - (fireAt + dur), INK, 5);
    if (t > 1.05 && t < fireAt + dur) {
      ctx.save(); ctx.globalAlpha = clamp((t - 1.05) / 0.15, 0, 1);
      ctx.textAlign = 'center'; ctx.font = `22px ${NUM_FONT}`; ctx.fillStyle = RED;
      ctx.fillText(`${MINUS}1 → ${MINUS}2`, 200, 112);
      ctx.restore();
    }
    vShot(hand.x, hand.y, nx, ny, fireAt, dur, t, MINUS + '2');
  }

  const CLIP_FNS = [vClipZero, vClipDivide, vClipLevel];

  function drawClip(i, lt, boil) {
    const FW = 460, FH = 360, VW = 400, VH = 260, VY = -VH / 2 - 14;
    const inT = clamp(lt / 0.4, 0, 1), outT = clamp((lt - (CLIP_LEN - 0.3)) / 0.3, 0, 1);
    const tilt = [-0.05, 0.045, -0.035][i];
    const ein = easeOutBack(inT);
    let x = lerp(W + 330, W / 2, ein), rot = lerp(0.5, tilt, ein), sc = 1;
    if (outT > 0) { const eo = outT * outT; x = lerp(W / 2, -360, eo); rot = lerp(tilt, -0.7, eo); sc = lerp(1, 0.8, eo); }
    ctx.save();
    ctx.translate(x, 500); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-FW / 2 + 10, -FH / 2 + 14, FW, FH);
    ctx.fillStyle = '#16130f'; ctx.fillRect(-FW / 2, -FH / 2, FW, FH);
    ctx.fillStyle = '#e9e2d2';
    for (let k = 0; k < 11; k++) {
      const hx = -FW / 2 + 14 + k * 41;
      ctx.fillRect(hx, -FH / 2 + 8, 18, 12);
      ctx.fillRect(hx, FH / 2 - 20, 18, 12);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(-VW / 2, VY, VW, VH); ctx.clip();
    ctx.translate(-VW / 2, VY);
    vPaper(VW, VH);
    CLIP_FNS[i](lt, boil);
    ctx.restore();
    if (Math.floor(lt * 2.5) % 2 === 0) {
      ctx.fillStyle = '#e23b3b';
      ctx.beginPath(); ctx.arc(-VW / 2 + 18, VY + 18, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `18px ${UI_FONT}`; ctx.fillStyle = 'rgba(31,29,27,0.7)';
    ctx.fillText(`OYUN · ${i + 1}/3`, -VW / 2 + 30, VY + 19);
    ctx.textAlign = 'center';
    ctx.font = `30px ${UI_FONT}`; ctx.fillStyle = '#ffe066';
    ctx.fillText(CLIP_CAPTIONS[i], 0, VY + VH + 22);
    ctx.restore();
  }

  function layoutLogo() {
    logoLetters = [];
    let i = 0;
    for (const line of LOGO_LINES) {
      ctx.font = `${line.size}px ${NUM_FONT}`;
      const chars = [...line.text];
      const widths = chars.map(c => ctx.measureText(c).width + 3);
      let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
      chars.forEach((ch, k) => {
        logoLetters.push({ ch, x: x + widths[k] / 2, y: line.y, size: line.size, color: line.color, fire: LOGO_FIRST + i * LOGO_GAP, line: line === LOGO_LINES[0] ? 0 : 1 });
        x += widths[k]; i++;
      });
    }
  }

  function drawLogo(t, boil) {
    if (!logoLetters) layoutLogo();
    const sx0 = PX - 2, sy0 = PY - 36;
    const next = logoLetters.find(L => t < L.fire + LOGO_SHOT * 0.6) || logoLetters[logoLetters.length - 1];
    const party = t > LOGO_DONE + 0.1;
    const aim = party ? -1.25 : Math.atan2(next.y - sy0, next.x - sx0);
    const rec = recoilAt(logoLetters.map(L => L.fire), t);
    // fosforlu kalem çizgisi
    if (party) {
      const line0 = logoLetters.filter(L => L.line === 0);
      const x0 = line0[0].x - 34, x1 = line0[line0.length - 1].x + 34;
      const k = clamp((t - LOGO_DONE - 0.1) / 0.35, 0, 1);
      ctx.fillStyle = 'rgba(255,214,51,0.6)';
      ctx.beginPath();
      ctx.moveTo(x0, 342); ctx.lineTo(lerp(x0, x1, k), 338); ctx.lineTo(lerp(x0, x1, k), 366); ctx.lineTo(x0, 370);
      ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const L of logoLetters) {
      const age = t - (L.fire + LOGO_SHOT);
      if (age < 0) continue;
      const pop = age < 0.22 ? 1 - age / 0.22 : 0;
      const wig = party ? Math.sin(t * 9 + L.x * 0.05) * 6 : 0;
      ctx.save();
      ctx.translate(L.x, L.y + wig);
      ctx.rotate(noise(L.x + boil) * 0.05);
      ctx.scale(1 + pop * 0.6, 1 + pop * 0.6);
      drawText(L.ch, 0, 0, L.size, pop > 0.5 ? RED : L.color, NUM_FONT, L.x + boil);
      ctx.restore();
      if (age < 0.35) {
        ctx.globalAlpha = 1 - age / 0.35; ctx.fillStyle = INK;
        for (let j = 0; j < 7; j++) {
          const a = noise(L.x + j * 3) * Math.PI, r = 22 + age * 130 + noise(j + L.y) * 6;
          ctx.beginPath(); ctx.arc(L.x + Math.cos(a) * r, L.y - Math.abs(Math.sin(a)) * r * 0.6 + 10, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    for (const L of logoLetters) {
      const a = Math.atan2(L.y - sy0, L.x - sx0);
      vShot(sx0 + Math.cos(a) * 50, sy0 + Math.sin(a) * 50, L.x, L.y, L.fire, LOGO_SHOT, t, L.ch, L.size * 0.6);
    }
    const jump = party ? Math.abs(Math.sin((t - LOGO_DONE) * 7)) * 20 : 0;
    drawStick(PX, PY - jump, aim, rec, 0, boil);
    if (t > LOGO_DONE + 0.5) {
      const k = clamp((t - LOGO_DONE - 0.5) / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(200, 540); ctx.rotate(-0.06); ctx.scale(0.6 + 0.4 * easeOutBack(k), 0.6 + 0.4 * easeOutBack(k));
      drawText('Sticky Math', 0, 0, 52, '#7a4bd8', NUM_FONT, boil);
      ctx.restore();
    }
  }

  function renderIntro() {
    const boil = Math.floor(clock * 9);
    const sx = canvas.width / W, sy = canvas.height / H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    if (introT < LOGO_AT) {
      ctx.fillStyle = 'rgba(46,40,36,0.9)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.translate(W / 2, 150); ctx.rotate(-0.04);
      drawText('STICKY MATH', 0, 0, 58, '#ffe066', NUM_FONT, boil);
      ctx.restore();
      const i = clamp(Math.floor(introT / CLIP_LEN), 0, CLIPS - 1);
      drawClip(i, introT - i * CLIP_LEN, boil);
      for (let k = 0; k < CLIPS; k++) {
        ctx.fillStyle = k === i ? '#ffe066' : 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(W / 2 + (k - 1) * 24, 790, 6, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const lt = introT - LOGO_AT;
      drawLogo(lt, boil);
      if (lt < 0.35) { ctx.fillStyle = `rgba(46,40,36,${0.9 * (1 - lt / 0.35)})`; ctx.fillRect(0, 0, W, H); }
    }
    const fadeIn = clamp(1 - introT / 0.4, 0, 1), fadeOut = clamp((introT - (INTRO_LEN - 0.4)) / 0.4, 0, 1);
    const f = Math.max(fadeIn, fadeOut);
    if (f > 0) { ctx.fillStyle = `rgba(243,239,230,${f})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- döngü ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    // rAF zaman damgası ilk karede performance.now()'dan geride olabilir: dt asla negatif olmasın.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (S.mode === 'intro') {
      clock += dt;
      introT += dt;
      if (introT >= INTRO_LEN) endIntro();
    } else if (S.mode === 'quiz') {
      clock += dt;
      updateQuiz(dt);
    } else if (S.mode !== 'pause') {
      clock += dt;
      if (S.mode === 'play' && !window.__smFreeze) update(dt);
      updateFx(dt);
    }
    if (canvas.width < 2 || canvas.height < 2) { resize(); return; }
    try {
      if (S.mode === 'intro') renderIntro(); else render();
    } catch (err) {
      // Yarım kalan save()/clip() bir sonraki kareleri bozmasın; boş yığında restore() zararsızdır.
      for (let k = 0; k < 64; k++) ctx.restore();
      ctx.globalAlpha = 1;
      if (S.mode === 'intro') endIntro();
      console.error(err);
    }
  }

  // ---------- girdi ----------
  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function cardAt(x, y) {
    if (y < CARD_Y - 14 || y > CARD_Y + CARD_H + 6) return -1;
    for (let i = 0; i < 4; i++) {
      const cx = CARD_X0 + i * (CARD_W + CARD_GAP);
      if (x >= cx - CARD_GAP / 2 && x <= cx + CARD_W + CARD_GAP / 2) return i;
    }
    return -1;
  }
  function select(i) {
    if (i < 0 || i >= 4 || S.sel === i) return;
    S.sel = i;
    Snd.select();
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    Snd.init();
    const p = toGame(e);
    const mouse = e.pointerType === 'mouse';
    S.pointer.mouse = mouse;
    if (S.mode !== 'play') return;
    const c = cardAt(p.x, p.y);
    if (c >= 0) { select(c); return; }
    if (p.y > PLAY_BOTTOM + 10) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* yakalanamayan işaretçi: yok say */ }
    if (mouse) {
      S.pointer.x = p.x; S.pointer.y = p.y; S.pointer.down = true; S.pointer.inPlay = true;
      if (S.fireCD <= 0) fire();
      return;
    }
    // dokunmatik: sol yarı yürür, sağ yarı nişan alıp ateş eder
    if (p.x < W / 2) { if (!S.stick) S.stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }; }
    else if (!S.aimTouch) {
      S.aimTouch = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      if (S.fireCD <= 0) fire();
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = toGame(e);
    if (S.stick && S.stick.id === e.pointerId) { S.stick.x = p.x; S.stick.y = p.y; return; }
    if (S.aimTouch && S.aimTouch.id === e.pointerId) { S.aimTouch.x = p.x; S.aimTouch.y = p.y; return; }
    if (e.pointerType === 'mouse') {
      S.pointer.mouse = true;
      S.pointer.x = p.x; S.pointer.y = p.y;
      S.pointer.inPlay = p.y < PLAY_BOTTOM;
    }
  });
  const release = e => {
    if (S.stick && S.stick.id === e.pointerId) S.stick = null;
    if (S.aimTouch && S.aimTouch.id === e.pointerId) S.aimTouch = null;
    if (e.pointerType === 'mouse') S.pointer.down = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') S.pointer.inPlay = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    if (S.mode !== 'play') return;
    e.preventDefault();
    select((S.sel + (e.deltaY > 0 ? 1 : 3)) % 4);
  }, { passive: false });

  const MOVE_KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  };
  window.addEventListener('keydown', e => {
    if (MOVE_KEYS[e.code]) { S.keys[MOVE_KEYS[e.code]] = true; if (S.mode === 'play') e.preventDefault(); }
    if (e.repeat && e.code !== 'Space') return;
    if (S.mode === 'intro') {
      if (e.key === 'Escape' || e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); endIntro(); }
      return;
    }
    if (S.mode === 'quiz') {
      if (/^[0-9]$/.test(e.key)) quizKey(e.key);
      else if (e.key === 'Backspace') quizKey('back');
      else if (e.key === '-' || e.code === 'NumpadSubtract') quizKey('-');
      else if (e.key === 'Enter' || e.code === 'NumpadEnter') quizKey('ok');
      e.preventDefault();
      return;
    }
    if (S.mode === 'levelup') {
      if (e.key >= '1' && e.key <= '4') chooseUpgrade(+e.key - 1);
      return;
    }
    if (S.mode === 'play') {
      if (e.key >= '1' && e.key <= '4') select(+e.key - 1);
      else if (e.code === 'KeyQ') select((S.sel + 3) % 4);
      else if (e.code === 'KeyE') select((S.sel + 1) % 4);
      else if (e.code === 'Space') { S.keyFire = true; e.preventDefault(); }
      else if (e.key === 'Escape' || e.code === 'KeyP') pauseGame();
    } else if (S.mode === 'pause' && (e.key === 'Escape' || e.code === 'KeyP')) resumeGame();
    else if (S.mode === 'menu' && (e.key === 'Enter' || e.code === 'Space')) { e.preventDefault(); startGame(); }
    else if (S.mode === 'over' && $('over').classList.contains('show') && (e.key === 'Enter' || e.code === 'Space')) { e.preventDefault(); startStage(S.stage); }
  });
  window.addEventListener('keyup', e => {
    if (MOVE_KEYS[e.code]) S.keys[MOVE_KEYS[e.code]] = false;
    if (e.code === 'Space') S.keyFire = false;
  });
  window.addEventListener('blur', () => { S.pointer.down = false; S.keyFire = false; S.keys = {}; pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('resize', resize);

  const btnMute = $('btnMute');
  const syncMute = () => btnMute.classList.toggle('off', Snd.muted);
  btnMute.addEventListener('click', () => { Snd.muted = !Snd.muted; localStorage.setItem('sm_muted', Snd.muted ? '1' : '0'); syncMute(); });
  $('btnPause').addEventListener('click', pauseGame);
  $('btnStart').addEventListener('click', startGame);
  $('btnRetry').addEventListener('click', () => startStage(S.stage));
  $('btnOverStages').addEventListener('click', startGame);
  $('btnNext').addEventListener('click', () => startStage(Math.min(STAGES, S.stage + 1)));
  $('btnClearStages').addEventListener('click', startGame);
  $('btnStagesBack').addEventListener('click', toMenu);
  for (const b of document.querySelectorAll('#quiz [data-k]')) b.addEventListener('click', () => quizKey(b.dataset.k));
  $('btnResume').addEventListener('click', resumeGame);
  $('btnQuit').addEventListener('click', toMenu);
  $('btnMenu').addEventListener('click', toMenu);
  $('btnSkip').addEventListener('click', endIntro);

  // ---------- başlat ----------
  if (/[?&]debug\b/.test(location.search)) {
    window.__sm = {
      get S() { return S; }, get save() { return save; }, render, update, updateFx, spawnEnemy, spawnBoss, startGame, startStage, showStages, fire, gainXP, chooseUpgrade, openQuiz, quizKey, resolveQuiz, makeQuestion, stageCfg, bossHp, BOSS_TYPES, bossFor, wPow, xpNeed,
      seekIntro(t) { if (S.mode !== 'intro') startIntro(); introT = t; }, INTRO_LEN,
    };
  }
  syncMute();
  resize();
  if (/[?&](nointro|debug)\b/.test(location.search)) toMenu(); else startIntro();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(`40px ${NUM_FONT}`), document.fonts.load(`30px ${UI_FONT}`)])
      .catch(() => {}).then(() => renderBackground());
  }
})();
