'use strict';
(() => {
  // ---------- sabitler ----------
  const W = 540, H = 960;
  const PLAY_TOP = 130, PLAY_BOTTOM = 805;
  const CARD_Y = 832, CARD_H = 108, CARD_W = 94, CARD_GAP = 9;
  const CARD_X0 = (W - (5 * CARD_W + 4 * CARD_GAP)) / 2;
  const PX = 455, PY = 560;             // oyuncunun ayak/gövde merkezi
  const SHOULDER = { x: PX - 2, y: PY - 36 };
  const INK = '#1f1d1b', NEG_INK = '#1d3d7a', RED = '#d43a2f', PAPER = '#f3efe6';
  const NUM_FONT = '"Permanent Marker", "Comic Sans MS", cursive';
  const UI_FONT = '"Gochi Hand", "Comic Sans MS", cursive';
  const SHOT_SPEED = 980;
  const FIRE_CD = 0.13;
  const COMBO_TIME = 3.5;
  const MAX_HEARTS = 5;
  const MINUS = '−';

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

  // ---------- işlemler (silahlar) ----------
  const OPS = [
    { label: MINUS + '1', max: Infinity, apply: v => ({ v: v - 1, eq: `${fmt(v)} ${MINUS} 1` }) },
    { label: '+1', max: Infinity, apply: v => ({ v: v + 1, eq: `${fmt(v)} + 1` }) },
    { label: '÷2', max: 12, apply: v => { const r = Math.trunc(v / 2); return { v: r, kind: 'split', clean: v % 2 === 0, eq: `${fmt(v)} ÷ 2` }; } },
    { label: '√', max: 6, apply: v => { const a = Math.abs(v), r = Math.floor(Math.sqrt(a)), s = Math.sign(v); return { v: s * r, kind: 'root', clean: r * r === a && a >= 4, eq: `${s < 0 ? MINUS : ''}√${a}` }; } },
    { label: '±', max: 6, apply: v => ({ v: -v, eq: `${MINUS}(${fmt(v)})` }) },
  ];

  const CLEAN = {
    zero:  { text: 'SIFIR!', color: '#2a6fdb', base: 5 },
    split: { text: 'TAM BÖLME!', color: '#0f9b9b', base: 4 },
    root:  { text: 'TAM KÖK!', color: '#7a4bd8', base: 6 },
    merge: { text: 'SIFIRA BİRLEŞTİ!', color: '#e0407a', base: 10 },
  };

  const WAVE_HINTS = {
    1: 'Pozitife −1, negatife +1',
    2: 'Zıt sayıları çarpıştır!',
    3: '√ ve ÷2 ile temiz hamle',
  };

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
    combo(n) { const b = 523 * Math.pow(2, Math.min(n, 12) / 12); this.tone(b, 0.1, 'sine', 0.06); this.tone(b * 1.25, 0.1, 'sine', 0.05, 0, 0.06); this.tone(b * 1.5, 0.16, 'sine', 0.05, 0, 0.12); },
    messy() { this.tone(220, 0.12, 'sawtooth', 0.025, -60); },
    merge() { this.tone(330, 0.12, 'triangle', 0.05, 120); },
    hurt() { this.tone(140, 0.3, 'sawtooth', 0.08, -80); this.noise(0.25, 0.08, 400); },
    empty() { this.tone(140, 0.07, 'square', 0.035); },
    select() { this.tone(660, 0.04, 'sine', 0.03); },
    wave() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.05, 0, i * 0.08)); },
  };

  // ---------- durum ----------
  let S;
  function newState() {
    return {
      mode: 'menu',
      enemies: [], shots: [], parts: [], popups: [],
      rp: 0, rpShown: 0, rpPop: 0,
      hearts: 3, wave: 0, waveTotal: 0, resolved: 0,
      spawnQueue: [], spawnT: 0, waveActive: false, nextWaveT: 0,
      banner: null,
      combo: 0, comboT: 0,
      sel: 0, ammo: OPS.map(o => o.max), cardShake: OPS.map(() => 0),
      aim: Math.PI, recoil: 0, hurt: 0, shake: 0,
      pointer: { x: 250, y: 450, down: false, mouse: false, inPlay: false },
      keyFire: false, fireCD: 0, nextId: 1,
    };
  }
  S = newState();
  let best = +localStorage.getItem('sm_best') || 0;
  let clock = 0;

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
    if (w === 1) return [3, -2, 4, -3, 5];
    if (w === 2) return [6, -6, 4, 9, -5, 8, -8];
    const n = Math.min(5 + w * 2, 20);
    const maxV = Math.min(6 + w * 5, 99);
    const out = [];
    while (out.length < n) {
      const r = Math.random(), sg = Math.random() < 0.5 ? -1 : 1;
      if (r < 0.22 && out.length <= n - 2) { const v = randi(3, maxV); out.push(v, -v); }
      else if (r < 0.40) { const k = randi(2, Math.min(9, 2 + Math.ceil(w / 1.5))); out.push(sg * k * k); }
      else if (r < 0.58) out.push(sg * 2 * randi(2, Math.max(3, Math.floor(maxV / 2))));
      else out.push(sg * randi(1, Math.min(maxV, 4 + w * 2)));
    }
    return out;
  }

  function startWave() {
    S.wave++;
    S.spawnQueue = genWave(S.wave);
    S.waveTotal = S.spawnQueue.length;
    S.resolved = 0;
    S.ammo = OPS.map(o => o.max);
    S.spawnT = 1.5;
    S.waveActive = true;
    S.banner = { text: `Sayfa ${S.wave}`, sub: WAVE_HINTS[S.wave] || '', t: 0, life: 2.0 };
    Snd.wave();
  }

  function spawnEnemy(v) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 10; tries++) {
      if (Math.random() < 0.62) { x = rand(80, 160); y = rand(PLAY_TOP + 50, PLAY_BOTTOM - 70); }
      else { x = rand(90, 330); y = rand(PLAY_TOP + 30, PLAY_TOP + 100); }
      if (S.enemies.every(e => Math.hypot(e.x - x, e.y - y) > 90)) break;
    }
    const spd = Math.min(58, 20 + S.wave * 2.5 + rand(0, 10));
    S.enemies.push({
      id: S.nextId++, value: v, prev: v, x, y, vx: 0, vy: 0, r: radiusFor(v),
      pop: 0, change: 0, flash: 0, write: 0, spd, wob: Math.random() * 6.28, dead: false,
    });
    for (let i = 0; i < 6; i++) addPart('line', x + rand(-20, 20), y + rand(-20, 20), rand(-60, 60), rand(-60, 60), 0.35, INK, 2);
  }

  // ---------- efekt yardımcıları ----------
  function addPart(type, x, y, vx, vy, life, color, size, extra) {
    if (S.parts.length > 450) S.parts.shift();
    S.parts.push(Object.assign({ type, x, y, vx, vy, life, max: life, color, size, rot: Math.random() * 6.28 }, extra));
  }
  function splat(x, y, dir, n) {
    for (let i = 0; i < n; i++) {
      const a = dir + Math.PI + rand(-1.1, 1.1), sp = rand(80, 260);
      addPart('dot', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.25, 0.5), INK, rand(1.5, 3.5));
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
  function clean(kind, eq, x, y) {
    const c = CLEAN[kind];
    S.combo = S.comboT > 0 ? S.combo + 1 : 1;
    S.comboT = COMBO_TIME;
    const gain = c.base * S.combo;
    S.rp += gain; S.rpPop = 1;
    popup(x, y, [
      { text: `${eq} · temiz`, color: '#c0392b', size: 16, font: NUM_FONT },
      { text: c.text, color: c.color, size: 34, font: NUM_FONT },
      { text: S.combo > 1 ? `Kombo x${S.combo}! +${gain} RP` : `+${gain} RP`, color: S.combo > 1 ? '#d6249f' : '#555', size: 24, font: UI_FONT },
    ]);
    Snd.combo(S.combo);
  }

  function messy(eq, x, y) {
    S.combo = 0; S.comboT = 0;
    popup(x, y, [{ text: `${eq} · dağınık`, color: '#777', size: 18, font: NUM_FONT }], 1.0);
    Snd.messy();
  }

  function killEnemy(e, eq) {
    e.dead = true;
    S.resolved++;
    burst(e.x, e.y, 18);
    addPart('ghost', e.x, e.y, 0, 0, 0.45, INK, 46, { text: '0' });
    S.shake = Math.max(S.shake, 5);
    clean('zero', eq, e.x, e.y - e.r - 20);
    Snd.kill();
  }

  function hitEnemy(e, s) {
    const op = OPS[s.op];
    const res = op.apply(e.value);
    const nv = clamp(res.v, -999, 999);
    const dir = Math.atan2(s.vy, s.vx);
    e.vx += Math.cos(dir) * 90; e.vy += Math.sin(dir) * 90;
    e.prev = e.value; e.value = nv; e.change = 1; e.pop = 1; e.flash = 1; e.r = radiusFor(nv);
    splat(s.x, s.y, dir, 7);
    addLabel(s.x, s.y - 14, op.label, RED, 22);
    Snd.hit(nv);
    const eq = `${res.eq} = ${fmt(nv)}`;
    if (nv === 0) { killEnemy(e, eq); return; }
    if (res.kind) {
      if (res.clean) clean(res.kind, eq, e.x, e.y - e.r - 20);
      else messy(eq, e.x, e.y - e.r - 20);
    }
  }

  function mergeEnemies(a, b) {
    const sum = a.value + b.value;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const eq = `${fmt(a.value)} + ${a.value < 0 || b.value < 0 ? '(' + fmt(b.value) + ')' : fmt(b.value)} = ${fmt(sum)}`;
    if (sum === 0) {
      a.dead = b.dead = true;
      S.resolved += 2;
      burst(mx, my, 28, '#e0407a');
      addPart('ghost', mx, my, 0, 0, 0.55, '#e0407a', 60, { text: '0' });
      S.shake = Math.max(S.shake, 9);
      clean('merge', eq, mx, my - 60);
      Snd.kill();
      return;
    }
    const keep = Math.abs(a.value) >= Math.abs(b.value) ? a : b;
    const gone = keep === a ? b : a;
    gone.dead = true;
    S.resolved++;
    keep.prev = keep.value; keep.value = sum; keep.change = 1; keep.pop = 1; keep.r = radiusFor(sum);
    keep.x = mx; keep.y = my;
    burst(mx, my, 10);
    popup(mx, my - 55, [{ text: eq, color: '#555', size: 22, font: UI_FONT }], 1.0);
    Snd.merge();
  }

  function hurtPlayer(e) {
    e.dead = true;
    S.resolved++;
    S.hearts--;
    S.hurt = 1; S.shake = 16;
    S.combo = 0; S.comboT = 0;
    burst(e.x, e.y, 16, RED);
    Snd.hurt();
    if (S.hearts <= 0) gameOver();
  }

  function fire() {
    const i = S.sel, op = OPS[i];
    if (S.ammo[i] <= 0) { S.cardShake[i] = 1; Snd.empty(); S.fireCD = 0.25; return; }
    if (op.max !== Infinity) S.ammo[i]--;
    const p = S.pointer;
    const target = findTarget(p.x, p.y);
    const ax = target ? target.x : p.x, ay = target ? target.y : p.y;
    const ang = Math.atan2(ay - SHOULDER.y, ax - SHOULDER.x);
    S.aim = ang;
    const hx = SHOULDER.x + Math.cos(ang) * 50, hy = SHOULDER.y + Math.sin(ang) * 50;
    S.shots.push({
      x: hx, y: hy, vx: Math.cos(ang) * SHOT_SPEED, vy: Math.sin(ang) * SHOT_SPEED,
      op: i, target, age: 0, trail: [], spin: rand(-0.6, 0.6), dead: false,
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
      if (e.dead || e.write < 1) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < 55 && d < best) { best = d; target = e; }
    }
    return target;
  }

  // ---------- mod geçişleri ----------
  function setMode(m) { S.mode = m; wrap.dataset.mode = m; }
  function showOverlay(id) {
    for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
  }
  function startGame() {
    Snd.init();
    const pointer = S.pointer;
    S = newState();
    S.pointer = pointer; S.pointer.down = false;
    setMode('play');
    showOverlay(null);
    startWave();
  }
  function pauseGame() { if (S.mode !== 'play') return; setMode('pause'); S.pointer.down = false; S.keyFire = false; showOverlay('pause'); }
  function resumeGame() { if (S.mode !== 'pause') return; Snd.init(); setMode('play'); showOverlay(null); }
  function toMenu() { const p = S.pointer; S = newState(); S.pointer = p; setMode('menu'); $('bestMenu').textContent = best; showOverlay('menu'); }
  function gameOver() {
    setMode('over');
    S.pointer.down = false;
    const isBest = S.rp > best;
    if (isBest) { best = S.rp; localStorage.setItem('sm_best', String(best)); }
    $('ovWave').textContent = S.wave;
    $('ovRp').textContent = S.rp;
    $('ovBest').textContent = isBest ? 'Yeni rekor!' : `En iyi: ${best} RP`;
    setTimeout(() => { if (S.mode === 'over') showOverlay('over'); }, 900);
  }

  // ---------- güncelleme ----------
  function update(dt) {
    if (S.mode !== 'play') return;
    S.fireCD -= dt;
    if ((S.pointer.down || S.keyFire) && S.fireCD <= 0) fire();

    if (S.fireCD < -0.15) {
      const a = Math.atan2(S.pointer.y - SHOULDER.y, S.pointer.x - SHOULDER.x);
      S.aim = lerpAngle(S.aim, a, Math.min(1, dt * 10));
    }
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }

    // dalga akışı
    if (S.waveActive) {
      if (S.spawnQueue.length) {
        S.spawnT -= dt;
        if (S.spawnT <= 0) {
          spawnEnemy(S.spawnQueue.shift());
          S.spawnT = Math.max(0.75, 2.3 - S.wave * 0.12);
        }
      } else if (S.enemies.length === 0) {
        S.waveActive = false;
        S.nextWaveT = 2.0;
        const bonus = S.wave * 10;
        S.rp += bonus; S.rpPop = 1;
        const heal = S.hearts < MAX_HEARTS;
        if (heal) S.hearts++;
        S.banner = { text: 'Sayfa temiz!', sub: `+${bonus} RP${heal ? ' · +1 can' : ''}`, t: 0, life: 1.9 };
        Snd.wave();
      }
    } else if (S.nextWaveT > 0) {
      S.nextWaveT -= dt;
      if (S.nextWaveT <= 0) startWave();
    }

    updateShots(dt);
    updateEnemies(dt);
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
    for (const e of es) {
      e.pop = Math.max(0, e.pop - dt * 4.5);
      e.change = Math.max(0, e.change - dt * 3.2);
      e.flash = Math.max(0, e.flash - dt * 5);
      if (e.write < 1) { e.write = Math.min(1, e.write + dt * 2.2); continue; }
      const dx = PX - e.x, dy = (PY - 20) - e.y, d = Math.hypot(dx, dy) || 1;
      e.wob += dt * 2.2;
      const nx = -dy / d, ny = dx / d, w = Math.sin(e.wob) * 0.45;
      const tx = (dx / d + nx * w) * e.spd, ty = (dy / d + ny * w) * e.spd;
      const k = Math.min(1, dt * 2);
      e.vx += (tx - e.vx) * k; e.vy += (ty - e.vy) * k;
    }
    // çiftler: zıt işaretler çeker, aynılar iter
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead || a.write < 1) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead || b.write < 1) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        if (Math.sign(a.value) !== Math.sign(b.value)) {
          const exact = a.value === -b.value;
          const range = exact ? 420 : 170, power = exact ? 170 : 40;
          if (d < range) {
            const f = power * (1 - d / range) * dt;
            a.vx += dx / d * f; a.vy += dy / d * f;
            b.vx -= dx / d * f; b.vy -= dy / d * f;
          }
          if (d < (a.r + b.r) * 0.75) { mergeEnemies(a, b); if (a.dead) break; }
        } else {
          const min = a.r + b.r + 8;
          if (d < min) {
            const push = (min - d) * 0.5;
            a.x -= dx / d * push; a.y -= dy / d * push;
            b.x += dx / d * push; b.y += dy / d * push;
          }
        }
      }
    }
    for (const e of es) {
      if (e.dead || e.write < 1) continue;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.x = clamp(e.x, 40, W - 20);
      e.y = clamp(e.y, PLAY_TOP + 20, PLAY_BOTTOM - 35);
      if (Math.hypot(PX - e.x, PY - 25 - e.y) < e.r + 30) hurtPlayer(e);
      if (S.mode !== 'play') break;
    }
    S.enemies = S.enemies.filter(e => !e.dead);
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
      ctx.restore();
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
      ctx.strokeText(OPS[s.op].label, 0, 0);
      ctx.fillStyle = RED;
      ctx.fillText(OPS[s.op].label, 0, 0);
      ctx.restore();
    }
  }

  function drawPlayer(boil) {
    const bob = Math.sin(clock * 3) * 2;
    const rec = S.recoil * 7;
    const x = PX + Math.cos(S.aim) * -rec * 0.4, y = PY + bob;
    const hurt = S.hurt > 0 && Math.floor(clock * 20) % 2 === 0;
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
    ctx.beginPath(); ctx.ellipse(x + 2, PY + 52, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
    // bacaklar, gövde, arka kol
    L(x + 2, y + 8, x - 14, PY + 50, 21);
    L(x + 2, y + 8, x + 18, PY + 50, 31);
    L(x, y - 48, x + 2, y + 8, 11);
    L(x, y - 34, x + 20, y - 8, 41);
    // kafa
    const hx = x, hy = y - 66;
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.ellipse(hx + noise(boil) * 0.6, hy, 18, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const ex = Math.cos(S.aim) * 4, ey = Math.sin(S.aim) * 3;
    ctx.lineWidth = 3;
    if (S.hurt > 0.5) {
      for (const o of [-7, 4]) { L(hx + o - 3 + ex, hy - 5 + ey, hx + o + 3 + ex, hy + 1 + ey, 61); L(hx + o + 3 + ex, hy - 5 + ey, hx + o - 3 + ex, hy + 1 + ey, 63); }
    } else {
      ctx.fillStyle = INK;
      for (const o of [-7, 4]) { ctx.beginPath(); ctx.arc(hx + o + ex, hy - 1 + ey, 2.6, 0, Math.PI * 2); ctx.fill(); }
      L(hx - 12 + ex, hy - 10 + ey, hx - 3 + ex, hy - 6 + ey, 71);
      L(hx + 1 + ex, hy - 6 + ey, hx + 9 + ex, hy - 10 + ey, 73);
    }
    // nişan kolu + kırmızı kalem
    ctx.lineWidth = 4;
    const a = S.aim, ca = Math.cos(a), sa = Math.sin(a);
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

  function heartPath(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.6);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.1, x - s * 0.55, y - s * 0.95, x, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 0.95, x + s * 1.1, y - s * 0.1, x, y + s * 0.6);
  }

  function drawHUD(boil) {
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    // RP
    ctx.save();
    ctx.translate(24, 50);
    const rs = 1 + S.rpPop * 0.2; ctx.scale(rs, rs);
    drawText(`${Math.round(S.rpShown)} RP`, 0, 0, 34, INK, UI_FONT, boil);
    ctx.restore();
    // canlar
    const nh = Math.max(3, S.hearts);
    for (let i = 0; i < nh; i++) {
      heartPath(36 + i * 30, 80, 12);
      if (i < S.hearts) { ctx.fillStyle = RED; ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
    // kombo
    if (S.combo > 1 && S.comboT > 0) {
      drawText(`Kombo x${S.combo}`, 24, 122, 26, '#d6249f', UI_FONT, boil + 5);
      ctx.fillStyle = 'rgba(214,36,159,0.25)'; ctx.fillRect(130, 112, 90, 7);
      ctx.fillStyle = '#d6249f'; ctx.fillRect(130, 112, 90 * (S.comboT / COMBO_TIME), 7);
    }
    // sayfa + çetele
    ctx.textAlign = 'right';
    drawText(`Sayfa ${Math.max(1, S.wave)}`, W - 24, 48, 32, INK, UI_FONT, boil + 9);
    const total = S.waveTotal, groups = Math.ceil(total / 5);
    let gx = W - 24 - groups * 44 + 8;
    ctx.lineCap = 'round'; ctx.lineWidth = 2.5;
    for (let i = 0; i < total; i++) {
      const g = Math.floor(i / 5), k = i % 5, x0 = gx + g * 44;
      ctx.strokeStyle = i < S.resolved ? INK : 'rgba(31,29,27,0.2)';
      ctx.beginPath();
      if (k < 4) { ctx.moveTo(x0 + k * 7, 66); ctx.lineTo(x0 + k * 7 + noise(i) * 1.5, 90); }
      else { ctx.moveTo(x0 - 5, 86); ctx.lineTo(x0 + 27, 70); }
      ctx.stroke();
    }
  }

  function drawCards(boil) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < OPS.length; i++) {
      const op = OPS[i], selected = S.sel === i, empty = S.ammo[i] <= 0;
      const x = CARD_X0 + i * (CARD_W + CARD_GAP) + CARD_W / 2 + Math.sin(S.cardShake[i] * 30) * 6 * S.cardShake[i];
      const y = CARD_Y + CARD_H / 2 + (selected ? -10 : 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(noise(i * 5) * 0.035);
      ctx.globalAlpha = empty ? 0.45 : 1;
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
      ctx.textAlign = 'left';
      ctx.font = `16px ${UI_FONT}`; ctx.fillStyle = 'rgba(31,29,27,0.5)';
      ctx.fillText(String(i + 1), -CARD_W / 2 + 7, -CARD_H / 2 + 14);
      ctx.textAlign = 'center';
      drawText(op.label, 0, -8, 40, empty ? '#999' : (selected ? RED : INK), NUM_FONT, i * 11 + (selected ? boil : 0));
      ctx.font = `20px ${UI_FONT}`; ctx.fillStyle = INK;
      ctx.fillText(op.max === Infinity ? '∞' : `${S.ammo[i]}/${op.max}`, 0, CARD_H / 2 - 18);
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
    ctx.fillStyle = 'rgba(255,214,51,0.55)';
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
    if (S.mode !== 'play' || !p.inPlay) return;
    const t = findTarget(p.x, p.y);
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
    drawEnemies(boil);
    drawPlayer(boil);
    drawShots();
    drawParts();
    drawPopups();
    drawBanner();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    if (S.mode !== 'menu') drawHUD(boil);
    drawCards(boil);
    if (S.hurt > 0) {
      ctx.fillStyle = `rgba(212,58,47,${S.hurt * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- döngü ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (S.mode !== 'pause') {
      clock += dt;
      if (S.mode === 'play') update(dt);
      updateFx(dt);
    }
    if (canvas.width < 2 || canvas.height < 2) { resize(); return; }
    render();
  }

  // ---------- girdi ----------
  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function cardAt(x, y) {
    if (y < CARD_Y - 14 || y > CARD_Y + CARD_H + 6) return -1;
    for (let i = 0; i < OPS.length; i++) {
      const cx = CARD_X0 + i * (CARD_W + CARD_GAP);
      if (x >= cx - CARD_GAP / 2 && x <= cx + CARD_W + CARD_GAP / 2) return i;
    }
    return -1;
  }
  function select(i) {
    if (i < 0 || i >= OPS.length || S.sel === i) return;
    S.sel = i;
    Snd.select();
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    Snd.init();
    const p = toGame(e);
    S.pointer.x = p.x; S.pointer.y = p.y; S.pointer.mouse = e.pointerType === 'mouse';
    if (S.mode !== 'play') return;
    const c = cardAt(p.x, p.y);
    if (c >= 0) { select(c); return; }
    if (p.y > PLAY_BOTTOM + 10) return;
    S.pointer.down = true; S.pointer.inPlay = true;
    canvas.setPointerCapture(e.pointerId);
    if (S.fireCD <= 0) fire();
  });
  canvas.addEventListener('pointermove', e => {
    const p = toGame(e);
    S.pointer.x = p.x; S.pointer.y = p.y;
    S.pointer.inPlay = p.y < PLAY_BOTTOM && (e.pointerType === 'mouse' || S.pointer.down);
  });
  const release = () => { S.pointer.down = false; if (!S.pointer.mouse) S.pointer.inPlay = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { if (S.pointer.mouse) S.pointer.inPlay = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    if (S.mode !== 'play') return;
    e.preventDefault();
    select((S.sel + (e.deltaY > 0 ? 1 : OPS.length - 1)) % OPS.length);
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.repeat && e.code !== 'Space') return;
    if (S.mode === 'play') {
      if (e.key >= '1' && e.key <= '5') select(+e.key - 1);
      else if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') select((S.sel + OPS.length - 1) % OPS.length);
      else if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') select((S.sel + 1) % OPS.length);
      else if (e.code === 'Space') { S.keyFire = true; e.preventDefault(); }
      else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') pauseGame();
    } else if (S.mode === 'pause' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) resumeGame();
    else if ((S.mode === 'menu' || (S.mode === 'over' && $('over').classList.contains('show'))) && (e.key === 'Enter' || e.code === 'Space')) { e.preventDefault(); startGame(); }
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') S.keyFire = false; });
  window.addEventListener('blur', () => { S.pointer.down = false; S.keyFire = false; pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('resize', resize);

  const btnMute = $('btnMute');
  const syncMute = () => btnMute.classList.toggle('off', Snd.muted);
  btnMute.addEventListener('click', () => { Snd.muted = !Snd.muted; localStorage.setItem('sm_muted', Snd.muted ? '1' : '0'); syncMute(); });
  $('btnPause').addEventListener('click', pauseGame);
  $('btnStart').addEventListener('click', startGame);
  $('btnRetry').addEventListener('click', startGame);
  $('btnResume').addEventListener('click', resumeGame);
  $('btnQuit').addEventListener('click', toMenu);
  $('btnMenu').addEventListener('click', toMenu);

  // ---------- başlat ----------
  if (/[?&]debug\b/.test(location.search)) {
    window.__sm = { get S() { return S; }, render, update, updateFx, spawnEnemy, startGame, fire };
  }
  syncMute();
  $('bestMenu').textContent = best;
  resize();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(`40px ${NUM_FONT}`), document.fonts.load(`30px ${UI_FONT}`)])
      .catch(() => {}).then(() => renderBackground());
  }
})();
