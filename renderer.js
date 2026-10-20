'use strict';

(() => {
  const api = window.petAPI;
  const mask = window.PET_ALPHA_MASK || null;

  const $ = (sel) => document.querySelector(sel);
  const pet = $('#pet');
  const bubble = $('#bubble');
  const speechText = $('#speech-text');
  const moodEl = $('#mood');
  const sleepy = $('#sleepy');
  const menu = $('#menu');
  const about = $('#about');
  const dock = $('#dock');
  const scaleLabel = $('#scale-label');
  const fx = $('#fx');
  const toastEl = $('#toast');
  const toggleTop = $('#toggle-top');
  const toggleSound = $('#toggle-sound');
  const toggleAutostart = $('#toggle-autostart');

  const state = {
    scale: 1,
    sound: true,
    alwaysOnTop: true,
    autoStart: false,
    sleeping: false,
    menuOpen: false,
    aboutOpen: false,
    dragging: false,
    dragMoved: false,
    pointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    lastPointerX: -1,
    lastPointerY: -1,
    interactive: false,
    hoverOffTimer: null,
    bubbleTimer: null,
    typeTimer: null,
    bubbleToken: 0,
    idleTimer: null,
    toastTimer: null,
    lastInteract: Date.now(),
    lastLine: '',
    clickCount: 0,
    feedCount: Number(localStorage.getItem('mingyue.feedCount') || 0),
    wheelAccum: 0,
    wheelTimer: null,
    winShownAt: Date.now(),
    isSmoke: false
  };

  const LINES = {
    greeting: [
      '鱼片，你来啦。才、才不是在等你。',
      '唔，你来啦。白饭准备好了吗？',
      '欢迎回来。今天也一起摸鱼……不是，一起加油。',
      '我刚好有点无聊。就一点点。'
    ],
    morning: [
      '早上好，鱼片。先吃白饭还是先干活？',
      '早。哈欠……鲸鱼也是需要赖床的。',
      '一日之计在于晨，一晨之计在于白饭。'
    ],
    noon: [
      '午饭时间。白饭，分我一半。',
      '鱼片，你吃了吗？没吃的话……我也没有多余的。',
      '中午了。我才没有在等你的投喂。'
    ],
    evening: [
      '晚上好。今天也辛苦啦，鱼片。',
      '天色暗了。要、要一起看会儿屏幕吗？',
      '这个点还不下班，是想变成咸鱼片吗？'
    ],
    night: [
      '这么晚还不睡……鱼片想变成夜宵吗？',
      '熬夜会变瘦的。变瘦就不好吃了。……我是说，不健康。',
      'Zzz……啊，我没睡。我在思考。'
    ],
    poke: [
      '呀！别突然戳我……尾巴会自己动的。',
      '鱼片，你干嘛？再戳要收费了，用白饭付。',
      '哼，又戳。你是不是觉得我很好欺负？',
      '我可是鲸鱼，不是戳戳乐。',
      '再戳一下，我就把你的白饭吃掉。',
      '唔……有事说事，别戳脸。'
    ],
    pat: [
      '唔……摸头的话，可以哦。就一下。',
      '才、才没有很开心。尾巴只是自己摇的。',
      '哼，手法还不错。继续也不是不行。',
      '鱼片的手，暖暖的。……我什么都没说。',
      '摸头可以，但是不许说我胖。'
    ],
    feed: [
      '白饭！……我是说，刚好有点饿。',
      '啊——不对，我自己会吃。',
      '再来一碗。就一碗，真的。',
      '这就是传说中的人间美味吗……再来点。',
      '我、我不是因为好吃才吃这么快的。',
      '碗见底了。鱼片，你懂我的意思吧。'
    ],
    feedMilestone: [
      '第 {n} 碗了……才没有胖！这叫鲸鱼的储备浮力。',
      '已经第 {n} 碗了。你是不是想把我喂成球？……可以。',
      '第 {n} 碗。DeepSeek 的服务器都没你能喂。'
    ],
    talk: [
      '想聊什么？我先说好，我不擅长安慰人……但可以听。',
      '今天的鱼片看起来有点累。要不要休息一下？',
      '我可以陪你一会儿。就一会儿，别误会。',
      '有什么想说的就说吧。我尾巴在听。',
      '如果不知道说什么，那就一起发呆。也算陪伴。'
    ],
    drag: [
      '放我下来啦——',
      '等等，尾巴要打结了！',
      '你要把我搬到哪里去？白饭也一起搬吗？'
    ],
    dragEnd: [
      '呼……晕乎乎的。下次轻一点。',
      '这里视野不错。就勉强住下吧。',
      '搬家可以，白饭要跟上。'
    ],
    wake: [
      '唔……我没睡！只是闭目养神。',
      '啊，白饭呢？……原来是你。',
      '别、别看我。鲸鱼睡觉也是工作的一部分。'
    ],
    idle: [
      '鱼片，记得喝水。',
      '盯——你已经在屏幕前坐很久了。',
      '我在想一个很严肃的问题：下一碗白饭什么时候来。',
      '代码会有的，bug 也会有的。先吃饭吧。',
      '尾巴自己动的，不关我的事。',
      '今天也辛苦了。……这句是替白饭说的。',
      '如果累了，可以靠一会儿。我不收钱。',
      '别看我了，快去干活。……偶尔看看也可以。',
      '服务器在思考，我在摸鱼。很合理。'
    ],
    overclick: [
      '鱼片，你是不是太闲了？',
      '再点，我就要启动鲸鱼防御模式了。',
      '我都快被你戳出残影了。'
    ],
    resize: [
      '这个大小……还可以。',
      '变大也不能说我胖。',
      '缩这么小，是想让我坐你口袋吗？'
    ]
  };

  const MOODS = {
    default: '在线',
    pat: '有点开心',
    feed: '嚼嚼中',
    poke: '傲娇中',
    talk: '在听',
    sleep: '打盹中',
    wake: '刚睡醒',
    drag: '晕乎乎',
    idle: '发呆中',
    about: '认真营业'
  };

  function pickExcept(list) {
    if (!list.length) return '';
    let line = list[Math.floor(Math.random() * list.length)];
    if (line === state.lastLine && list.length > 1) {
      line = list[(list.indexOf(line) + 1) % list.length];
    }
    state.lastLine = line;
    return line;
  }

  function setMood(text) {
    if (moodEl) moodEl.textContent = text || MOODS.default;
  }

  function applyScale(scale) {
    state.scale = Math.max(0.8, Math.min(1.25, Number(scale) || 1));
    document.documentElement.style.setProperty('--s', String(state.scale));
    if (scaleLabel) scaleLabel.textContent = `${Math.round(state.scale * 100)}%`;
    scheduleUiReport();
  }

  function updateToggles(config) {
    state.alwaysOnTop = Boolean(config.alwaysOnTop);
    state.sound = Boolean(config.sound);
    state.autoStart = Boolean(config.autoStart);
    toggleTop.checked = state.alwaysOnTop;
    toggleSound.checked = state.sound;
    toggleAutostart.checked = state.autoStart;
  }

  /* ------------------------------------------------------------------ audio */
  let audioCtx = null;
  function audio() {
    if (!state.sound) return null;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch {
      return null;
    }
  }

  function tone(freq, duration = 0.08, type = 'sine', volume = 0.025, delay = 0) {
    const ctx = audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function sfx(kind) {
    if (!state.sound) return;
    if (kind === 'poke') {
      tone(720, 0.07, 'sine', 0.022);
      tone(920, 0.08, 'sine', 0.016, 0.055);
    } else if (kind === 'pat') {
      tone(523, 0.12, 'sine', 0.022);
      tone(659, 0.14, 'sine', 0.02, 0.1);
      tone(784, 0.18, 'sine', 0.015, 0.2);
    } else if (kind === 'feed') {
      tone(240, 0.1, 'triangle', 0.03);
      tone(480, 0.12, 'sine', 0.022, 0.08);
      tone(660, 0.12, 'sine', 0.014, 0.16);
    } else if (kind === 'wake') {
      tone(440, 0.1, 'sine', 0.02);
      tone(660, 0.15, 'sine', 0.016, 0.09);
    } else if (kind === 'error') {
      tone(180, 0.18, 'triangle', 0.018);
    } else {
      tone(640, 0.08, 'sine', 0.018);
    }
  }

  /* --------------------------------------------------------------- effects */
  function burst(kind, count = 6) {
    const rect = pet.getBoundingClientRect();
    const cx = rect.left + rect.width * (0.28 + Math.random() * 0.44);
    const cy = rect.top + rect.height * (kind === 'heart' ? 0.2 : kind === 'rice' ? 0.5 : 0.62);
    const chars = kind === 'heart' ? ['♥', '♡', '✦'] : kind === 'rice' ? ['🍚', '✦', '·'] : kind === 'note' ? ['♪', '♫', '✦'] : ['✦', '✧', '·'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      const char = chars[Math.floor(Math.random() * chars.length)];
      el.className = `fx-item fx-${kind}`;
      el.textContent = char;
      const x = cx + (Math.random() - 0.5) * rect.width * 0.55;
      const y = cy + (Math.random() - 0.5) * rect.height * 0.16;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.setProperty('--dx', `${(Math.random() - 0.5) * 96}px`);
      el.style.setProperty('--dy', `${-48 - Math.random() * 100}px`);
      el.style.setProperty('--rot', `${(Math.random() - 0.5) * 50}deg`);
      el.style.animationDelay = `${i * 0.035 + Math.random() * 0.08}s`;
      el.style.animationDuration = `${1.15 + Math.random() * 0.65}s`;
      fx.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }
  }

  function animate(name, hold = 900) {
    pet.classList.remove('happy', 'shake', 'eating', 'wave');
    void pet.offsetWidth;
    pet.classList.add(name);
    setTimeout(() => pet.classList.remove(name), hold);
  }

  function toast(text, ms = 1900) {
    clearTimeout(state.toastTimer);
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    state.toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
  }

  /* ---------------------------------------------------------- window regions */
  let uiReportTimer = null;

  function rectOf(element) {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  function reportUiNow() {
    const bubbleVisible = !bubble.classList.contains('hidden');
    const dockVisible =
      document.body.classList.contains('controls-visible') &&
      !state.menuOpen &&
      !state.aboutOpen &&
      !state.isSmoke;
    api.reportUi({
      bubble: bubbleVisible ? rectOf(bubble) : null,
      dock: dockVisible ? rectOf(dock) : null,
      modal: state.menuOpen || state.aboutOpen
    });
  }

  function scheduleUiReport() {
    clearTimeout(uiReportTimer);
    uiReportTimer = setTimeout(reportUiNow, 35);
  }

  /* ---------------------------------------------------------------- speech */
  function scheduleHide(ms) {
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(() => hideSpeech(), Math.max(1800, ms));
  }

  function showSpeech(text, options = {}) {
    if (!text) return;
    state.bubbleToken += 1;
    const token = state.bubbleToken;
    clearTimeout(state.typeTimer);
    clearTimeout(state.bubbleTimer);
    setMood(options.mood || MOODS.default);

    bubble.classList.remove('hidden');
    bubble.classList.remove('done');
    scheduleUiReport();
    speechText.textContent = '';
    speechText.style.minHeight = '';
    // Restart the entrance animation on consecutive lines.
    bubble.style.animation = 'none';
    void bubble.offsetWidth;
    bubble.style.animation = '';

    const chars = Array.from(text);
    let index = 0;
    const speed = options.fast ? 16 : 27;

    const step = () => {
      if (token !== state.bubbleToken) return;
      if (index < chars.length) {
        const ch = chars[index];
        speechText.textContent += ch;
        index += 1;
        const pause = /[，。！？…]/.test(ch) ? 85 : speed;
        state.typeTimer = setTimeout(step, pause);
      } else {
        bubble.classList.add('done');
        scheduleUiReport();
        scheduleHide(options.duration || 4300 + chars.length * 38);
      }
    };
    step();
  }

  function hideSpeech() {
    clearTimeout(state.bubbleTimer);
    clearTimeout(state.typeTimer);
    state.bubbleToken += 1;
    bubble.classList.add('hidden');
    bubble.classList.remove('done');
    scheduleUiReport();
    setMood(MOODS.default);
    setTimeout(() => {
      if (bubble.classList.contains('hidden')) speechText.textContent = '';
    }, 240);
  }

  /* --------------------------------------------------------------- sleeping */
  function setSleeping(sleeping, options = {}) {
    if (state.sleeping === sleeping) return;
    state.sleeping = sleeping;
    document.body.classList.toggle('sleeping', sleeping);
    sleepy.classList.toggle('hidden', !sleeping);
    if (sleeping) {
      setMood(MOODS.sleep);
      if (!options.silent) {
        showSpeech('Zzz… 白饭…再来一碗…', { mood: MOODS.sleep, duration: 3800, fast: true });
      }
    } else {
      setMood(MOODS.wake);
      if (!options.silent) {
        showSpeech(pickExcept(LINES.wake), { mood: MOODS.wake, duration: 3600 });
        animate('shake', 700);
        sfx('wake');
      }
    }
  }

  function wakeUp() {
    if (state.sleeping) setSleeping(false);
  }

  function touch() {
    state.lastInteract = Date.now();
    if (state.sleeping) wakeUp();
  }

  /* ------------------------------------------------------------- interaction */
  function handlePoke() {
    touch();
    animate(Math.random() < 0.45 ? 'shake' : 'happy', 700);
    burst('spark', 4);
    sfx('poke');
    state.clickCount += 1;
    const line = state.clickCount > 14 && state.clickCount % 7 === 0 ? pickExcept(LINES.overclick) : pickExcept(LINES.poke);
    showSpeech(line, { mood: MOODS.poke, duration: 3900 });
  }

  function handlePat(extra = '') {
    touch();
    animate('happy', 720);
    burst('heart', 7);
    sfx('pat');
    showSpeech(extra || pickExcept(LINES.pat), { mood: MOODS.pat, duration: 4100 });
  }

  function handleFeed() {
    touch();
    state.feedCount += 1;
    localStorage.setItem('mingyue.feedCount', String(state.feedCount));
    animate('eating', 1300);
    burst('rice', 9);
    sfx('feed');
    let line;
    if (state.feedCount > 0 && state.feedCount % 5 === 0) {
      line = pickExcept(LINES.feedMilestone).replace('{n}', String(state.feedCount));
    } else {
      line = pickExcept(LINES.feed);
    }
    showSpeech(line, { mood: MOODS.feed, duration: 5400 });
  }

  function handleTalk() {
    touch();
    animate('wave', 900);
    burst('note', 5);
    sfx('talk');
    showSpeech(pickExcept(LINES.talk), { mood: MOODS.talk, duration: 6500 });
  }

  function handleClickAt(x, y) {
    touch();
    const rect = pet.getBoundingClientRect();
    const relativeY = rect.height ? (y - rect.top) / rect.height : 0.5;
    if (relativeY < 0.33) {
      handlePat();
    } else {
      handlePoke();
    }
  }

  function doAction(action) {
    if (action === 'pat') handlePat();
    else if (action === 'feed') handleFeed();
    else if (action === 'talk') handleTalk();
    else if (action === 'menu') openMenu();
    else if (action === 'about') openAbout();
  }

  /* ------------------------------------------------------------ click-through */
  function overPetAlpha(x, y) {
    const rect = pet.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
    if (!mask || !mask.data) return true;
    const mx = Math.min(mask.w - 1, Math.max(0, Math.floor(((x - rect.left) / rect.width) * mask.w)));
    const my = Math.min(mask.h - 1, Math.max(0, Math.floor(((y - rect.top) / rect.height) * mask.h)));
    return mask.data[my * mask.w + mx] === '1';
  }

  function isInteractiveAt(x, y) {
    if (state.aboutOpen) return true;
    const target = document.elementFromPoint(x, y);
    if (!target) return false;
    if (target.closest('.speech, .dock, .menu, .about, .toast')) return true;
    if (target.id === 'pet') return overPetAlpha(x, y);
    return false;
  }

  function setInteractive(next) {
    state.interactive = next;
  }

  function refreshInteractiveAt(x, y) {
    if (state.isSmoke) return;
    if (x == null || y == null) return;
    state.lastPointerX = x;
    state.lastPointerY = y;
    const hit = isInteractiveAt(x, y);
    if (hit) {
      clearTimeout(state.hoverOffTimer);
      setInteractive(true);
      document.body.classList.add('controls-visible');
      scheduleUiReport();
      if (state.sleeping && !state.aboutOpen && !state.menuOpen) wakeUp();
    } else if (!state.menuOpen && !state.aboutOpen) {
      document.body.classList.remove('controls-visible');
      scheduleUiReport();
      clearTimeout(state.hoverOffTimer);
      state.hoverOffTimer = setTimeout(() => setInteractive(false), 90);
    }
  }

  document.addEventListener('mousemove', (e) => {
    refreshInteractiveAt(e.clientX, e.clientY);
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    if (state.menuOpen || state.aboutOpen || state.dragging) return;
    document.body.classList.remove('controls-visible');
    clearTimeout(state.hoverOffTimer);
    setInteractive(false);
  });

  window.addEventListener('blur', () => {
    if (!state.menuOpen && !state.aboutOpen && !state.dragging) setInteractive(false);
  });

  /* ------------------------------------------------------------------- drag */
  pet.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || state.aboutOpen) return;
    e.preventDefault();
    closeMenu({ refocus: false });
    state.dragging = true;
    state.dragMoved = false;
    state.pointerId = e.pointerId;
    state.dragStartX = e.screenX;
    state.dragStartY = e.screenY;
    state.lastInteract = Date.now();
    try { pet.setPointerCapture(e.pointerId); } catch {}
    document.body.classList.add('dragging');
    api.dragStart();
  });

  pet.addEventListener('pointermove', (e) => {
    if (!state.dragging || e.pointerId !== state.pointerId) return;
    const dx = e.screenX - state.dragStartX;
    const dy = e.screenY - state.dragStartY;
    if (Math.hypot(dx, dy) > 5) state.dragMoved = true;
    api.dragMove();
  });

  async function finishDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    state.pointerId = null;
    document.body.classList.remove('dragging');
    const wasMoved = state.dragMoved;
    try {
      const result = await api.dragEnd();
      if (result && result.moved) state.dragMoved = true;
    } catch {}
    if (wasMoved || state.dragMoved) {
      touch();
      burst('spark', 3);
      showSpeech(pickExcept(LINES.dragEnd), { mood: MOODS.drag, duration: 3300 });
      sfx('talk');
    } else {
      const rect = pet.getBoundingClientRect();
      handleClickAt(rect.left + rect.width / 2, rect.top + rect.height * 0.55);
    }
    state.dragMoved = false;
  }

  pet.addEventListener('pointerup', (e) => {
    if (!state.dragging || e.pointerId !== state.pointerId) return;
    e.preventDefault();
    try { pet.releasePointerCapture(e.pointerId); } catch {}
    finishDrag();
  });

  pet.addEventListener('pointercancel', () => finishDrag());
  pet.addEventListener('lostpointercapture', () => {
    if (state.dragging) finishDrag();
  });

  pet.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideSpeech();
    openMenu(e.clientX, e.clientY);
  });

  pet.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.wheelAccum += e.deltaY;
    clearTimeout(state.wheelTimer);
    state.wheelTimer = setTimeout(() => {
      const direction = state.wheelAccum < 0 ? 1 : -1;
      state.wheelAccum = 0;
      if (direction > 0) stepScale(0.05);
      else stepScale(-0.05);
    }, 120);
  }, { passive: false });

  /* ------------------------------------------------------------------- menu */
  function openMenu(x, y) {
    if (state.aboutOpen) return;
    hideSpeech();
    state.menuOpen = true;
    document.body.classList.add('menu-open');
    document.body.classList.add('controls-visible');
    setInteractive(true);
    menu.classList.remove('hidden');
    menu.style.visibility = 'hidden';
    menu.style.right = 'auto';
    menu.style.left = '0px';
    menu.style.top = '0px';

    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    const px = Number.isFinite(x) ? x : window.innerWidth - w - 14;
    const py = Number.isFinite(y) ? y : 90;
    const left = Math.max(8, Math.min(px + 4, window.innerWidth - w - 8));
    const top = Math.max(8, Math.min(py - 12, window.innerHeight - h - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = '';
    scheduleUiReport();
  }

  function closeMenu(options = {}) {
    if (!state.menuOpen) return;
    state.menuOpen = false;
    document.body.classList.remove('menu-open');
    menu.classList.add('hidden');
    scheduleUiReport();
    if (options.refocus !== false) {
      refreshInteractiveAt(state.lastPointerX, state.lastPointerY);
    }
  }

  function menuAction(action) {
    if (!action) return;
    if (action === 'pat' || action === 'feed' || action === 'talk') {
      closeMenu();
      doAction(action);
      return;
    }
    if (action === 'about') {
      closeMenu({ refocus: false });
      openAbout();
      return;
    }
    if (action === 'smaller') {
      stepScale(-0.05);
      closeMenu();
      return;
    }
    if (action === 'bigger') {
      stepScale(0.05);
      closeMenu();
      return;
    }
    if (action === 'return') {
      api.resetPosition();
      closeMenu();
      showSpeech('回到右下角啦。这里视野不错。', { mood: MOODS.default, duration: 3200 });
      return;
    }
    if (action === 'hide') {
      closeMenu();
      setTimeout(() => api.hidePet(), 120);
      return;
    }
    if (action === 'quit') {
      api.quitApp();
    }
  }

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    menuAction(btn.dataset.action);
  });

  toggleTop.addEventListener('change', () => {
    state.alwaysOnTop = toggleTop.checked;
    api.setAlwaysOnTop(state.alwaysOnTop);
    toast(state.alwaysOnTop ? '已开启始终置顶' : '已取消始终置顶');
  });

  toggleSound.addEventListener('change', () => {
    state.sound = toggleSound.checked;
    api.saveConfig({ sound: state.sound });
    if (state.sound) sfx('talk');
    toast(state.sound ? '桌宠音效已开启' : '桌宠音效已关闭');
  });

  toggleAutostart.addEventListener('change', () => {
    state.autoStart = toggleAutostart.checked;
    api.setAutoStart(state.autoStart);
    toast(state.autoStart ? '下次开机会自动来找你' : '已取消开机自启');
  });

  /* ------------------------------------------------------------------ about */
  function openAbout() {
    hideSpeech();
    closeMenu({ refocus: false });
    state.aboutOpen = true;
    document.body.classList.add('about-open');
    about.classList.remove('hidden');
    setInteractive(true);
    setMood(MOODS.about);
    scheduleUiReport();
  }

  function closeAbout() {
    if (!state.aboutOpen) return;
    state.aboutOpen = false;
    document.body.classList.remove('about-open');
    about.classList.add('hidden');
    setMood(MOODS.default);
    scheduleUiReport();
    refreshInteractiveAt(state.lastPointerX, state.lastPointerY);
  }

  about.addEventListener('pointerdown', (e) => {
    if (e.target === about) closeAbout();
  });

  const aboutClose = $('#about-close');
  if (aboutClose) aboutClose.addEventListener('click', closeAbout);

  document.querySelectorAll('[data-action="close-about"]').forEach((btn) => {
    btn.addEventListener('click', closeAbout);
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-external]');
    if (link) {
      e.preventDefault();
      api.openExternal(link.dataset.external);
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!state.menuOpen) return;
    if (menu.contains(e.target)) return;
    closeMenu();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.aboutOpen) closeAbout();
      else if (state.menuOpen) closeMenu();
      else if (!bubble.classList.contains('hidden')) hideSpeech();
    }
  });

  /* ------------------------------------------------------------------- scale */
  let scaleToastTimer = null;
  function stepScale(delta) {
    const next = Math.max(0.8, Math.min(1.25, Math.round((state.scale + delta) * 100) / 100));
    if (Math.abs(next - state.scale) < 0.001) {
      toast(next >= 1.25 ? '已经最大啦' : '已经最小啦');
      return;
    }
    applyScale(next);
    api.setScale(next);
    clearTimeout(scaleToastTimer);
    scaleToastTimer = setTimeout(() => {
      toast(`溟月大小 ${Math.round(next * 100)}%`);
      if (next >= 1.15 || next <= 0.85) {
        setTimeout(() => showSpeech(pickExcept(LINES.resize), { mood: MOODS.default, duration: 3000 }), 260);
      }
    }, 260);
  }

  /* ------------------------------------------------------------------- dock */
  document.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.quick;
      if (action === 'menu') openMenu();
      else {
        touch();
        doAction(action);
      }
    });
  });

  $('#bubble-close').addEventListener('click', (e) => {
    e.stopPropagation();
    hideSpeech();
  });

  bubble.addEventListener('mouseenter', () => clearTimeout(state.bubbleTimer));
  bubble.addEventListener('mouseleave', () => {
    if (!bubble.classList.contains('hidden') && bubble.classList.contains('done')) scheduleHide(2800);
  });

  /* ------------------------------------------------------------------ greeting */
  function greetingForHour(hour) {
    if (hour < 5) return pickExcept(LINES.night);
    if (hour < 11) return pickExcept(LINES.morning);
    if (hour < 14) return pickExcept(LINES.noon);
    if (hour < 19) return pickExcept(LINES.evening);
    if (hour < 23) return pickExcept(LINES.evening);
    return pickExcept(LINES.night);
  }

  function greet() {
    const now = new Date();
    const hour = now.getHours();
    const first = state.feedCount === 0;
    let text = first ? pickExcept(LINES.greeting) : greetingForHour(hour);
    if (hour >= 0 && hour < 5 && first) text = pickExcept(LINES.night);
    showSpeech(text, { mood: MOODS.default, duration: 4800 });
    if (first) setTimeout(() => burst('spark', 4), 700);
  }

  /* -------------------------------------------------------------------- idle */
  function scheduleIdle() {
    clearTimeout(state.idleTimer);
    const delay = 19000 + Math.random() * 17000;
    state.idleTimer = setTimeout(() => {
      const idleFor = Date.now() - state.lastInteract;
      if (!state.menuOpen && !state.aboutOpen && !document.hidden) {
        if (idleFor > 180000) {
          setSleeping(true);
        } else if (idleFor > 15000 && bubble.classList.contains('hidden')) {
          showSpeech(pickExcept(LINES.idle), { mood: MOODS.idle, duration: 4300 });
          if (Math.random() < 0.35) burst(Math.random() < 0.5 ? 'spark' : 'note', 3);
        }
      }
      scheduleIdle();
    }, delay);
  }

  /* ---------------------------------------------------------------- main IPC */
  api.onConfig((config) => {
    if (!config) return;
    state.isSmoke = Boolean(config.isSmoke);
    if (state.isSmoke) document.body.classList.add('smoke');
    applyScale(config.scale);
    updateToggles(config);
  });

  api.onAction((action) => {
    if (action === 'pat') handlePat();
    else if (action === 'feed') handleFeed();
    else if (action === 'about') openAbout();
    else if (action === 'returned') showSpeech('回到右下角啦。这里视野不错。', { mood: MOODS.default, duration: 3000 });
    else if (action === 'resized') {
      closeMenu();
      toast(`溟月大小 ${Math.round(state.scale * 100)}%`);
    }
  });

  api.onHover((hover) => {
    if (hover && hover.interactive) return;
    if (state.menuOpen || state.aboutOpen || state.dragging) return;
    document.body.classList.remove('controls-visible');
    scheduleUiReport();
  });

  api.getConfig().then((config) => {
    if (!config) return;
    state.isSmoke = Boolean(config.isSmoke);
    if (state.isSmoke) document.body.classList.add('smoke');
    applyScale(config.scale);
    updateToggles(config);
  }).catch(() => {});

  pet.addEventListener('load', () => {
    // Let the first paint settle before greeting.
  });

  pet.addEventListener('error', () => {
    showSpeech('呜……角色立绘加载失败了。鱼片，检查一下 assets/pet.png。', { mood: '出错啦', duration: 8000 });
  });

  /* ------------------------------------------------------------- test helpers */
  window.__petDemo = (mode) => {
    if (mode === 'feed') {
      state.feedCount = 4;
      handleFeed();
    } else if (mode === 'menu') {
      openMenu(window.innerWidth - 60, 130);
    } else if (mode === 'about') {
      openAbout();
    } else if (mode === 'pat') {
      handlePat();
    } else if (mode === 'talk') {
      handleTalk();
    }
  };

  /* ------------------------------------------------------------------- boot */
  applyScale(1);
  scheduleIdle();
  setTimeout(greet, 850);
  setTimeout(reportUiNow, 120);
  setTimeout(() => {
    if (state.scale === 1 && !state.menuOpen) setMood(MOODS.default);
  }, 6000);
})();
