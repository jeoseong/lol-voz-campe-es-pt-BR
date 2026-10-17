
    let isEditMode = true;
    let currentGodTab = 'about';
    let vgsFocusBoxId = null;
    let pendingAudios = [];
    let audioBusy = false;
    let mainBgRef = '';
    let vgsRenderPending = false;
    let vgsSaveTimer = 0;
    let stageFadeSeq = 0;

    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    const CHAT_IDLE = 'De [PLAY] para escutar.';

    const defaultGodsDatabase = [
      {
        id: 'god_izanami',
        name: 'IZANAMI',
        title: 'MATRON OF THE DEAD',
        pantheon: 'Japonês',
        pantheonImg: '/smite-icons/NewUI_Pantheon_Japanese.webp',
        type: 'Físico',
        typeImg: '/smite-icons/NewUI_Type_Physical.png',
        class: 'Caçador',
        classImg: '/smite-icons/NewUI_Class_Hunter.webp',
        miniQuote: 'Devastem o campo de batalha com foices mortais.',
        difficulty: 'Média',
        lore: 'Izanami foi a deusa japonesa da criação e da morte.',
        dubber: 'Lisa Ortiz',
        releaseDate: '15/09/2016',
        img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&auto=format&fit=crop',
        voiceTree: [],
        announcerTree: [],
        skins: [
          {
            id: 'skin_default',
            name: 'Padrão',
            tier: 'PADRÃO',
            dubber: 'Lisa Ortiz',
            releaseDate: '15/09/2016',
            img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&auto=format&fit=crop'
          }
        ]
      }
    ];

    let godsDatabase = [];
    let vgsDatabase = [];

    let selectedGodIdx = 0;
    let selectedSkinIdx = 0;
    let currentMode = 'gods';
    let historyStack = ['main'];
    let currentVPMode = 'god';

    let editingGodIndex = null;
    let editingSkinIndex = null;
    let editingVgsBoxIdx = 0;
    let editingVgsRowIdx = null;
    let editingTreeTarget = null;

    let activeAudioInstance = null;
    let audioSwitchToken = 0;
    let activePlayButtonElement = null;
    let activeAudioLabel = '';
    let chatToken = 0;
    let chatClockTimer = null;
    let audioVolume = 1.0;

    const objectUrlCache = new Map();
    let dbPromise = null;

    function isUselessAudio(ref) {
      return !ref || ref === SILENT_WAV;
    }

    function escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;'
      }[c]));
    }

    function clockStamp() {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function speechLabel(text) {
      return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function openDb() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
          const req = indexedDB.open('smite_wiki_media', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
            if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }).catch((err) => {
          dbPromise = null;
          throw err;
        });
      }
      return dbPromise;
    }

    function idbPut(store, key, value) {
      return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('idb'));
        tx.onabort = () => reject(tx.error || new Error('idb abort'));
      }));
    }

    function idbGet(store, key) {
      return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }));
    }

    function compressImage(blob) {
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          const maxSize = 1600;
          let width = img.width;
          let height = img.height;
          const scale = Math.min(1, maxSize / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((out) => {
            URL.revokeObjectURL(url);
            resolve(out || blob);
          }, 'image/jpeg', 0.86);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(blob);
        };
        img.src = url;
      });
    }

    async function storeBlob(blob) {
      let toStore = blob;
      if (blob && blob.type && blob.type.startsWith('image/') && blob.size > 160000) {
        toStore = await compressImage(blob);
      }
      const key = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await idbPut('blobs', key, toStore);
      const ref = 'idb:' + key;
      objectUrlCache.set(ref, URL.createObjectURL(toStore));
      return ref;
    }

    function mediaSync(ref) {
      if (!ref || isUselessAudio(ref)) return '';
      if (objectUrlCache.has(ref)) return objectUrlCache.get(ref) || '';
      if (typeof ref === 'string' && !ref.startsWith('idb:')) return ref;
      return '';
    }

    async function ensureMedia(ref) {
      if (!ref || isUselessAudio(ref)) return '';
      if (objectUrlCache.has(ref)) return objectUrlCache.get(ref) || '';
      if (typeof ref === 'string' && ref.startsWith('idb:')) {
        const blob = await idbGet('blobs', ref.slice(4));
        if (!blob) {
          objectUrlCache.set(ref, '');
          return '';
        }
        const url = URL.createObjectURL(blob);
        objectUrlCache.set(ref, url);
        return url;
      }
      objectUrlCache.set(ref, ref);
      return ref;
    }

    function cssUrl(ref) {
      const url = mediaSync(ref);
      if (!url) return '';
      return 'url("' + String(url).replace(/"/g, '') + '")';
    }

    function collectRefs(node, acc) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach((n) => collectRefs(n, acc));
        return;
      }
      Object.keys(node).forEach((k) => {
        const v = node[k];
        if (typeof v === 'string' && v.startsWith('idb:')) acc.push(v);
        else if (v && typeof v === 'object') collectRefs(v, acc);
      });
    }

    async function migrateInPlace(node) {
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          if (typeof node[i] === 'string' && node[i].startsWith('data:')) {
            if (isUselessAudio(node[i])) node[i] = '';
            else {
              try { node[i] = await storeBlob(await (await fetch(node[i])).blob()); } catch (e) {}
            }
          } else if (node[i] && typeof node[i] === 'object') {
            await migrateInPlace(node[i]);
          }
        }
        return;
      }
      if (!node || typeof node !== 'object') return;
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = node[k];
        if (typeof v === 'string' && v.startsWith('data:')) {
          if (isUselessAudio(v)) node[k] = '';
          else {
            try { node[k] = await storeBlob(await (await fetch(v)).blob()); } catch (e) {}
          }
        } else if (v && typeof v === 'object') {
          await migrateInPlace(v);
        }
      }
    }

    function ensureBoxIds(list) {
      (list || []).forEach((box) => {
        if (!box.id) box.id = 'vgsbox_' + Math.random().toString(36).slice(2, 9);
        (box.rows || []).forEach((row) => normalizeAudioFields(row));
      });
    }

    function normalizeAudioFields(obj) {
      if (!obj) return;
      if (!Array.isArray(obj.audios)) obj.audios = [];
      if (obj.audioUrl && !isUselessAudio(obj.audioUrl) && obj.audios.indexOf(obj.audioUrl) === -1) {
        obj.audios.unshift(obj.audioUrl);
      }
      obj.audios = obj.audios.filter((a) => !isUselessAudio(a));
      obj.audioUrl = obj.audios[0] || '';
    }

    function normalizeTree(nodes) {
      (nodes || []).forEach((n) => {
        normalizeAudioFields(n);
        if (n.children) normalizeTree(n.children);
      });
    }

    function normalizeDatabases() {
      godsDatabase.forEach((g) => {
        ensureBoxIds(g.vgsDatabase);
        normalizeTree(g.voiceTree);
        normalizeTree(g.announcerTree);
        (g.skins || []).forEach((s) => {
          ensureBoxIds(s.vgsDatabase);
          normalizeTree(s.voiceTree);
          normalizeTree(s.announcerTree);
        });
      });
      ensureBoxIds(vgsDatabase);
    }

    function listAudios(obj) {
      if (!obj) return [];
      const raw = [];
      if (Array.isArray(obj.audios)) raw.push.apply(raw, obj.audios);
      if (obj.audioUrl) raw.push(obj.audioUrl);
      const out = [];
      raw.forEach((a) => {
        if (typeof a === 'string' && !isUselessAudio(a) && out.indexOf(a) === -1) out.push(a);
      });
      return out;
    }

    function getTierCssClass(tier) {
      const t = (tier || 'PADRÃO').toUpperCase();
      if (t === 'LIMITADO') return 'tier-limitado';
      if (t === 'UNLIMITED' || t === 'ILIMITADO') return 'tier-unlimited';
      if (t === 'CROSSOVER') return 'tier-crossover';
      if (t === 'CROSS-GEN') return 'tier-crossgen';
      if (t === 'PROMOCIONAL') return 'tier-promocional';
      if (t === 'EXCLUSIVO' || t === 'EXCLUSIVE') return 'tier-exclusivo';
      return 'tier-padrao';
    }

    async function loadStorageData() {
      let loaded = false;
      try {
        const state = await idbGet('meta', 'state');
        if (state && Array.isArray(state.godsDatabase) && state.godsDatabase.length) {
          godsDatabase = state.godsDatabase;
          vgsDatabase = Array.isArray(state.vgsDatabase) ? state.vgsDatabase : [];
          mainBgRef = state.mainBgRef || '';
          if (typeof state.audioVolume === 'number') audioVolume = state.audioVolume;
          loaded = true;
        }
      } catch (e) {}

      if (!loaded) {
        const savedGods = localStorage.getItem('smite_gods_db');
        if (savedGods) {
          try {
            const parsed = JSON.parse(savedGods);
            if (Array.isArray(parsed) && parsed.length > 0) godsDatabase = parsed;
            else godsDatabase = JSON.parse(JSON.stringify(defaultGodsDatabase));
          } catch (e) {
            godsDatabase = JSON.parse(JSON.stringify(defaultGodsDatabase));
          }
        } else {
          godsDatabase = JSON.parse(JSON.stringify(defaultGodsDatabase));
        }

        const savedVgs = localStorage.getItem('smite_vgs_db');
        if (savedVgs) {
          try {
            const parsedVgs = JSON.parse(savedVgs);
            if (Array.isArray(parsedVgs)) vgsDatabase = parsedVgs;
          } catch (e) {}
        }

        const legacyBg = localStorage.getItem('smite_main_bg');
        if (legacyBg && legacyBg.startsWith('data:')) mainBgRef = legacyBg;

        const vol = localStorage.getItem('smite_audio_volume');
        if (vol !== null && !isNaN(parseFloat(vol))) audioVolume = parseFloat(vol);

        try { await migrateInPlace(godsDatabase); } catch (e) {}
        try { await migrateInPlace(vgsDatabase); } catch (e) {}
        if (typeof mainBgRef === 'string' && mainBgRef.startsWith('data:')) {
          try { mainBgRef = await storeBlob(await (await fetch(mainBgRef)).blob()); } catch (e) { mainBgRef = ''; }
        }
      }

      normalizeDatabases();
      const refs = [];
      collectRefs(godsDatabase, refs);
      collectRefs(vgsDatabase, refs);
      if (mainBgRef) refs.push(mainBgRef);
      await Promise.all(refs.map((r) => ensureMedia(r).catch(() => '')));

      const savedVol = localStorage.getItem('smite_audio_volume');
      if (savedVol !== null && !isNaN(parseFloat(savedVol))) audioVolume = parseFloat(savedVol);

      if (!loaded) await saveStorageData();
      applyMainBg();
      applyVolumeUi();
    }

    async function saveStorageData() {
      normalizeDatabases();
      const state = {
        godsDatabase: godsDatabase,
        vgsDatabase: vgsDatabase,
        mainBgRef: mainBgRef || '',
        audioVolume: audioVolume
      };
      try {
        localStorage.setItem('smite_gods_db', JSON.stringify(godsDatabase));
        localStorage.setItem('smite_vgs_db', JSON.stringify(vgsDatabase));
        localStorage.setItem('smite_main_bg_ref', mainBgRef || '');
        localStorage.removeItem('smite_main_bg');
      } catch (e) {}
      try { await idbPut('meta', 'state', state); } catch (e) {}
    }

    function applyMainBg() {
      const el = document.getElementById('screenMain');
      if (!el) return;
      if (mainBgRef && mediaSync(mainBgRef)) {
        el.style.backgroundImage = 'linear-gradient(rgba(4,6,8,0.18), rgba(4,6,8,0.42)), ' + cssUrl(mainBgRef);
      } else {
        el.style.backgroundImage = '';
      }
    }

    function applyVolumeUi() {
      const slider = document.getElementById('audioVolumeSlider');
      const label = document.getElementById('volumeValText');
      const pct = Math.round(audioVolume * 100);
      if (slider) slider.value = String(pct);
      if (label) label.innerText = pct + '%';
    }

    async function uploadMainBg(e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        mainBgRef = await storeBlob(file);
        applyMainBg();
        await saveStorageData();
      } catch (err) {
        alert('Não foi possível salvar o fundo. Tente outra imagem.');
      }
    }

    function openSection(mode) {
      currentMode = mode;
      hideAll();
      document.getElementById('smite-app').classList.remove('on-screen-main');
      document.getElementById('screenRoster').style.display = 'flex';
      document.getElementById('backBtn').style.display = 'flex';
      renderRoster();
      historyStack.push('roster');
    }

    function hideAll() {
      document.getElementById('screenMain').style.display = 'none';
      document.getElementById('screenRoster').style.display = 'none';
      document.getElementById('screenGodView').style.display = 'none';
      document.getElementById('screenVoicebankView').style.display = 'none';
    }

    function showScreen(name) {
      hideAll();
      const app = document.getElementById('smite-app');
      const back = document.getElementById('backBtn');
      if (name === 'main') {
        app.classList.add('on-screen-main');
        document.getElementById('screenMain').style.display = 'flex';
        back.style.display = 'none';
        return;
      }
      app.classList.remove('on-screen-main');
      back.style.display = 'flex';
      if (name === 'roster') {
        document.getElementById('screenRoster').style.display = 'flex';
        renderRoster();
      } else if (name === 'godView') {
        document.getElementById('screenGodView').style.display = 'grid';
        renderGodView();
      } else if (name === 'voicebankView') {
        document.getElementById('screenVoicebankView').style.display = 'block';
        renderVoicebankView();
        switchVPMode(currentVPMode || 'god');
      } else {
        showScreen('main');
      }
    }

    function handleBack() {
      if (historyStack.length <= 1) return;
      historyStack.pop();
      const last = historyStack[historyStack.length - 1];
      showScreen(last);
    }

    function renderRoster() {
      const grid = document.getElementById('rosterGrid');
      if (!grid) return;
      grid.innerHTML = '';
      const searchEl = document.getElementById('rosterSearch');
      const filter = searchEl ? searchEl.value.toLowerCase() : '';

      godsDatabase.forEach((god, idx) => {
        if (filter && !(god.name || '').toLowerCase().includes(filter)) return;
        const img = mediaSync(god.img);
        const container = document.createElement('div');
        container.className = 'god-card-container';
        container.innerHTML = `
          <button class="card-edit-btn edit-only" onclick="openGodModal(event, ${idx})">✏️</button>
          <div class="smite-god-select-card" onclick="selectGod(${idx})">
            <div class="god-select-card-name">${escapeHtml(god.name)}</div>
          </div>
        `;
        const card = container.querySelector('.smite-god-select-card');
        if (img) {
          card.style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(5,8,15,0.85) 100%), ' + cssUrl(god.img);
        }
        grid.appendChild(container);
      });
    }

    function selectGod(idx) {
      selectedGodIdx = idx;
      selectedSkinIdx = 0;
      currentGodTab = 'about';
      vgsFocusBoxId = null;
      hideAll();
      document.getElementById('smite-app').classList.remove('on-screen-main');

      if (currentMode === 'gods') {
        document.getElementById('screenGodView').style.display = 'grid';
        document.getElementById('backBtn').style.display = 'flex';
        renderGodView();
        historyStack.push('godView');
      } else {
        document.getElementById('screenVoicebankView').style.display = 'block';
        document.getElementById('backBtn').style.display = 'flex';
        renderVoicebankView();
        switchVPMode('god');
        historyStack.push('voicebankView');
      }
    }

    function goToVoicebankFromGod() {
      hideAll();
      document.getElementById('smite-app').classList.remove('on-screen-main');
      document.getElementById('screenVoicebankView').style.display = 'block';
      document.getElementById('backBtn').style.display = 'flex';
      renderVoicebankView();
      if (currentGodTab === 'skins') switchVPMode('skin');
      else switchVPMode('god');
      historyStack.push('voicebankView');
    }

    function setStageBg(ref, opts) {
      const stage = document.getElementById('godStage');
      if (!stage) return;
      const fade = !!(opts && opts.fade) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const token = ++stageFadeSeq;

      const paintNow = (url) => {
        if (token !== stageFadeSeq) return;
        const next = url
          ? 'linear-gradient(rgba(2,4,6,0.65), rgba(2,4,6,0.92)), url("' + String(url).replace(/"/g, '') + '")'
          : 'linear-gradient(rgba(2,4,6,0.65), rgba(2,4,6,0.92))';
        if (!fade) {
          stage.style.backgroundImage = next;
          const layer = stage.querySelector('.god-stage-crossfade');
          if (layer) layer.remove();
          return;
        }
        if (!url) {
          stage.style.backgroundImage = next;
          return;
        }
        const img = new Image();
        let started = false;
        const startFade = () => {
          if (started || token !== stageFadeSeq) return;
          started = true;
          let layer = stage.querySelector('.god-stage-crossfade');
          if (!layer) {
            layer = document.createElement('div');
            layer.className = 'god-stage-crossfade';
            layer.setAttribute('aria-hidden', 'true');
            stage.insertBefore(layer, stage.firstChild);
          }
          layer.style.backgroundImage = next;
          layer.style.opacity = '0';
          requestAnimationFrame(() => {
            if (token !== stageFadeSeq) return;
            requestAnimationFrame(() => {
              if (token !== stageFadeSeq) return;
              layer.style.opacity = '1';
            });
          });
          let finished = false;
          const finish = () => {
            if (finished || token !== stageFadeSeq) return;
            finished = true;
            stage.style.backgroundImage = next;
            if (layer.parentNode) layer.remove();
          };
          layer.addEventListener('transitionend', (ev) => {
            if (ev.target === layer && ev.propertyName === 'opacity') finish();
          });
          setTimeout(finish, 520);
        };
        img.onload = startFade;
        img.onerror = () => {
          if (token === stageFadeSeq) stage.style.backgroundImage = next;
        };
        img.src = url;
        if (img.complete && img.naturalWidth) startFade();
      };

      const cached = mediaSync(ref);
      if (cached || !ref || (typeof ref === 'string' && !ref.startsWith('idb:'))) {
        paintNow(cached);
        return;
      }
      ensureMedia(ref).then((url) => paintNow(url || ''));
    }

    function renderGodView() {
      const god = godsDatabase[selectedGodIdx];
      if (!god) return;
      document.getElementById('extGodName').innerText = god.name || '';
      document.getElementById('extGodTitle').innerText = god.title || '';
      document.getElementById('godLoreText').innerText = god.lore || '';
      document.getElementById('godMiniQuote').innerText = god.miniQuote || '';
      document.getElementById('godDifficulty').innerText = 'DIFICULDADE - ' + (god.difficulty || 'Média');

      document.getElementById('pantheonName').innerText = god.pantheon || 'Japonês';
      document.getElementById('typeName').innerText = god.type || 'Físico';
      document.getElementById('className').innerText = god.class || 'Caçador';

      const pImg = document.getElementById('pantheonImg');
      const tImg = document.getElementById('typeImg');
      const cImg = document.getElementById('classImg');
      if (pImg) pImg.src = mediaSync(god.pantheonImg) || '';
      if (tImg) tImg.src = mediaSync(god.typeImg) || '';
      if (cImg) cImg.src = mediaSync(god.classImg) || '';

      renderSkinsTab();
      switchGodTab(currentGodTab || 'about');
    }

    function switchGodTab(tab) {
      const god = godsDatabase[selectedGodIdx];
      if (!god) return;
      currentGodTab = tab;

      document.getElementById('tabBtnAbout').classList.remove('active');
      document.getElementById('tabBtnSkins').classList.remove('active');
      document.getElementById('tabBtnLore').classList.remove('active');

      document.getElementById('godTabAbout').style.display = 'none';
      document.getElementById('godTabSkins').style.display = 'none';
      document.getElementById('godTabLore').style.display = 'none';

      if (tab === 'about') {
        document.getElementById('tabBtnAbout').classList.add('active');
        document.getElementById('godTabAbout').style.display = 'flex';
        setStageBg(god.img);
      } else if (tab === 'skins') {
        document.getElementById('tabBtnSkins').classList.add('active');
        document.getElementById('godTabSkins').style.display = 'flex';
        const currentSkin = (god.skins && god.skins[selectedSkinIdx]) ? god.skins[selectedSkinIdx] : god;
        setStageBg(currentSkin.img || god.img);
      } else if (tab === 'lore') {
        document.getElementById('tabBtnLore').classList.add('active');
        document.getElementById('godTabLore').style.display = 'flex';
        setStageBg(god.img);
      }
    }

    function skinCardHtml(skin, idx, clickFn) {
      const isPadrao = !skin.tier || skin.tier.toUpperCase() === 'PADRÃO';
      const cssClass = getTierCssClass(skin.tier);
      const selected = idx === selectedSkinIdx ? ' is-selected' : '';
      return `
        <button class="card-edit-btn edit-only" onclick="openSkinModal(event, ${idx})">✏️</button>
        <div class="smite-skin-card-wrapper">
          <div class="smite-skin-card${selected}" onclick="${clickFn}(${idx})">
            ${!isPadrao ? `<div class="skin-card-banner ${cssClass}"><span>${escapeHtml((skin.tier || '').toUpperCase())}</span></div>` : '<div></div>'}
          </div>
          <div class="skin-card-bottom-title">${escapeHtml(skin.name || '')}</div>
        </div>
      `;
    }

    function paintSkinCard(el, skin) {
      const card = el.querySelector('.smite-skin-card');
      if (!card) return;
      const url = cssUrl(skin.img);
      if (url) card.style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,0.15) 30%, rgba(5,8,15,0.9) 100%), ' + url;
    }

    function renderSkinsTab() {
      const grid = document.getElementById('godSkinsGrid');
      if (!grid) return;
      grid.innerHTML = '';
      const god = godsDatabase[selectedGodIdx];
      if (!god || !god.skins) return;
      god.skins.forEach((skin, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'god-card-container';
        wrapper.innerHTML = skinCardHtml(skin, idx, 'applySkinBackground');
        paintSkinCard(wrapper, skin);
        grid.appendChild(wrapper);
      });
    }

    function applySkinBackground(idx) {
      selectedSkinIdx = idx;
      const skin = godsDatabase[selectedGodIdx].skins[idx];
      if (skin) setStageBg(skin.img, { fade: true });
      renderSkinsTab();
    }

    function renderVoicebankView() {
      const god = godsDatabase[selectedGodIdx];
      if (!god) return;
      const currentSkin = (god.skins && god.skins[selectedSkinIdx]) ? god.skins[selectedSkinIdx] : null;
      const titleEl = document.getElementById('vpTitle');
      const imgEl = document.getElementById('vpImage');
      if (titleEl) {
        titleEl.innerText = currentSkin && (currentSkin.name || '').toUpperCase() !== 'PADRÃO' && (currentSkin.name || '').toUpperCase() !== 'PADRAO'
          ? currentSkin.name
          : god.name;
      }
      if (imgEl) imgEl.src = mediaSync(currentSkin ? currentSkin.img : god.img) || '';
      document.getElementById('vpDubber').innerText = currentSkin ? (currentSkin.dubber || god.dubber || '') : (god.dubber || '');
      document.getElementById('vpReleaseDate').innerText = currentSkin ? (currentSkin.releaseDate || god.releaseDate || '') : (god.releaseDate || '');
      refreshVpGodButtonLabel();
    }

    function refreshVpGodButtonLabel() {
      const god = godsDatabase[selectedGodIdx];
      const hasSkinSelected = god && selectedSkinIdx > 0 && god.skins && god.skins[selectedSkinIdx];
      const btnGodElem = document.getElementById('btnVpGod');
      if (btnGodElem) btnGodElem.innerText = hasSkinSelected ? 'VOZ DA APARÊNCIA' : 'VOZ DO DEUS';
    }

    function openVpHeaderModal() {
      const god = godsDatabase[selectedGodIdx];
      const currentSkin = (god.skins && god.skins[selectedSkinIdx]) ? god.skins[selectedSkinIdx] : null;
      document.getElementById('modalVpDubber').value = currentSkin ? (currentSkin.dubber || '') : (god.dubber || '');
      document.getElementById('modalVpReleaseDate').value = currentSkin ? (currentSkin.releaseDate || '') : (god.releaseDate || '');
      document.getElementById('vpHeaderModal').style.display = 'flex';
    }

    async function saveVpHeaderModal() {
      const god = godsDatabase[selectedGodIdx];
      const currentSkin = (god.skins && god.skins[selectedSkinIdx]) ? god.skins[selectedSkinIdx] : null;
      const dub = document.getElementById('modalVpDubber').value;
      const relDate = document.getElementById('modalVpReleaseDate').value;
      if (currentSkin) {
        currentSkin.dubber = dub;
        currentSkin.releaseDate = relDate;
      } else {
        god.dubber = dub;
        god.releaseDate = relDate;
      }
      await saveStorageData();
      renderVoicebankView();
      closeModal('vpHeaderModal');
    }

    function switchVPMode(mode) {
      currentVPMode = mode;
      document.querySelectorAll('.wiki-btn-menu').forEach((b) => b.classList.remove('active'));
      refreshVpGodButtonLabel();

      const btnMap = { god: 'btnVpGod', skin: 'btnVpSkin', announcer: 'btnVpAnnouncer', vgs: 'btnVpVGS' };
      if (btnMap[mode]) {
        const btn = document.getElementById(btnMap[mode]);
        if (btn) btn.classList.add('active');
      }

      const vgsGroup = document.getElementById('vgsContainerGroup');
      const panel = document.getElementById('vpDynamicPanel');
      const skinPanel = document.getElementById('vpSkinSelectionPanel');

      if (mode === 'vgs') {
        vgsGroup.style.display = 'flex';
        panel.style.display = 'none';
        skinPanel.style.display = 'none';
        renderVgsWikiTables();
        return;
      }

      if (mode === 'skin') {
        vgsGroup.style.display = 'none';
        panel.style.display = 'none';
        skinPanel.style.display = 'block';
        renderVpSkinCardsPanel();
        return;
      }

      vgsGroup.style.display = 'none';
      skinPanel.style.display = 'none';
      panel.style.display = 'block';
      renderVoiceTreePanel();
    }

    function renderVoiceTreePanel() {
      const god = godsDatabase[selectedGodIdx];
      if (!god) return;
      const hasSkinSelected = (selectedSkinIdx > 0 && god.skins && god.skins[selectedSkinIdx]);
      const currentSkin = hasSkinSelected ? god.skins[selectedSkinIdx] : null;
      const targetName = currentSkin ? currentSkin.name.toUpperCase() : god.name;
      const container = document.getElementById('voiceTreeContainer');
      if (!container) return;
      container.innerHTML = '';

      if (currentVPMode === 'god') {
        document.getElementById('vpSectionTitle').innerText = hasSkinSelected ? `FALAS DE ${targetName} (APARÊNCIA)` : `FALAS DE ${targetName}`;
        renderTreeNodes(getActiveTree(), container);
      } else if (currentVPMode === 'announcer') {
        document.getElementById('vpSectionTitle').innerText = `PACOTE DE LOCUTOR DE ${targetName}`;
        renderTreeNodes(getActiveTree(), container);
      }
    }

    function audioButtonsHtml(obj, label) {
      const audios = listAudios(obj);
      if (!audios.length) return '';
      return `<div class="vgs-audio-btns">${audios.map((ref, i) => {
        const lab = audios.length > 1 ? `${label} (${i + 1})` : label;
        return `<button type="button" class="vgs-play-double-btn" data-audio-ref="${escapeHtml(ref)}" data-audio-label="${escapeHtml(lab)}" title="Áudio ${i + 1}">▶️</button>`;
      }).join('')}</div>`;
    }

    function renderTreeNodes(nodes, containerElement) {
      (nodes || []).forEach((node) => {
        if (node.type === 'category') {
          const catBox = document.createElement('div');
          catBox.className = 'tree-category-box';
          catBox.innerHTML = `
            <div class="tree-category-title">
              <span>${escapeHtml(node.title || '')}</span>
              <button class="smite-btn-sm edit-only" onclick="openTreeModalForEdit('${node.id}')">✏️</button>
            </div>
            <div class="category-children-container" id="container_${node.id}"></div>
          `;
          containerElement.appendChild(catBox);
          if (node.children) renderTreeNodes(node.children, catBox.querySelector('#container_' + node.id));
        } else if (node.type === 'subcategory') {
          const subBox = document.createElement('div');
          subBox.className = 'tree-subcategory-box';
          subBox.innerHTML = `
            <div class="tree-subcategory-title">
              <span>${escapeHtml(node.title || '')}</span>
              <button class="smite-btn-sm edit-only" onclick="openTreeModalForEdit('${node.id}')">✏️</button>
            </div>
            <div class="subcategory-children-container" id="container_${node.id}"></div>
          `;
          containerElement.appendChild(subBox);
          if (node.children) renderTreeNodes(node.children, subBox.querySelector('#container_' + node.id));
        } else if (node.type === 'line') {
          if (!node.text && (!node.title || node.title.trim() === '')) return;
          const lineCard = document.createElement('div');
          lineCard.className = 'voice-line-item';
          const hasTitle = node.title && node.title.trim() !== '' && node.title.toLowerCase() !== 'sem título';
          const label = speechLabel(hasTitle ? node.title : node.text);
          lineCard.innerHTML = `
            <div>
              ${hasTitle ? `<div style="color:var(--wiki-gold-title); font-size:0.88rem;">${escapeHtml(node.title)}</div>` : ''}
              <div style="font-size:0.85rem; color:#cbd5e1; white-space:pre-wrap;">"${escapeHtml(node.text || '')}"</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              ${audioButtonsHtml(node, label)}
              <button class="smite-btn-sm edit-only" onclick="openTreeModalForEdit('${node.id}')">✏️</button>
            </div>
          `;
          containerElement.appendChild(lineCard);
        }
      });
    }

    function renderVpSkinCardsPanel() {
      const god = godsDatabase[selectedGodIdx];
      const grid = document.getElementById('vpSkinCardsGrid');
      if (!grid || !god) return;
      grid.innerHTML = '';
      (god.skins || []).forEach((skin, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'god-card-container';
        wrapper.innerHTML = skinCardHtml(skin, idx, 'selectVpSkinCard');
        paintSkinCard(wrapper, skin);
        grid.appendChild(wrapper);
      });
    }

    function selectVpSkinCard(idx) {
      selectedSkinIdx = idx;
      renderVoicebankView();
      renderVpSkinCardsPanel();
    }

    function getActiveVgs() {
      const god = godsDatabase[selectedGodIdx];
      if (!god) return [];
      const hasSkinSelected = (selectedSkinIdx > 0 && god.skins && god.skins[selectedSkinIdx]);
      const targetObj = hasSkinSelected ? god.skins[selectedSkinIdx] : god;
      if (!targetObj.vgsDatabase) {
        targetObj.vgsDatabase = [
          {
            id: 'vgsbox_default',
            boxTitle: 'VV - Other',
            rows: [
              { code: 'G', result: 'General', isCategory: true, audioUrl: '', audios: [], linkBoxId: '' },
              { code: 'V', result: 'Position', isCategory: true, audioUrl: '', audios: [], linkBoxId: '' },
              { code: 'A', result: '"Ok!"', isCategory: false, audioUrl: '', audios: [], linkBoxId: '' },
              { code: 'B', result: '"Be right back!"', isCategory: false, audioUrl: '', audios: [], linkBoxId: '' }
            ]
          }
        ];
      }
      ensureBoxIds(targetObj.vgsDatabase);
      return targetObj.vgsDatabase;
    }

    function renderVgsWikiTables() {
      const active = document.activeElement;
      if (active && active.classList && active.classList.contains('vgs-editable') && active.isContentEditable) {
        vgsRenderPending = true;
        return;
      }
      vgsRenderPending = false;
      const container = document.getElementById('vgsTablesList');
      if (!container) return;
      container.innerHTML = '';
      const all = getActiveVgs();

      if (vgsFocusBoxId && !all.some((b) => b.id === vgsFocusBoxId)) vgsFocusBoxId = null;

      if (vgsFocusBoxId) {
        const focused = all.find((b) => b.id === vgsFocusBoxId);
        const bar = document.createElement('div');
        bar.className = 'vgs-focus-bar';
        bar.innerHTML = `<button type="button" class="smite-btn-sm" onclick="clearVgsFocus()">◄ Voltar</button><span style="color:var(--wiki-gold-title);">${escapeHtml(focused ? focused.boxTitle : '')}</span>`;
        container.appendChild(bar);
      }

      all.forEach((box, boxIdx) => {
        if (vgsFocusBoxId && box.id !== vgsFocusBoxId) return;
        const wikiBox = document.createElement('div');
        const audiosPresent = (box.rows || []).some((r) => listAudios(r).length > 0);
        let rowsHtml = '';
        if (box.rows && box.rows.length > 0) {
          box.rows.forEach((row, rowIdx) => {
            const codeClass = row.isCategory ? 'vgs-code-cell is-cat-code' : 'vgs-code-cell';
            const resultCellClass = row.isCategory ? 'vgs-outcome-cell is-category-result' : 'vgs-outcome-cell';
            const editableCode = isEditMode ? 'true' : 'false';
            const linked = !!(row.isCategory && row.linkBoxId);
            const editableResult = isEditMode ? 'true' : 'false';
            const linkCls = linked ? ' is-link' : '';
            const linkAttr = row.linkBoxId ? ` data-link-box="${escapeHtml(row.linkBoxId)}"` : '';
            const linkTitle = row.linkBoxId ? ' title="Abre outra caixa de comandos"' : '';
            const play = audioButtonsHtml(row, speechLabel(row.result));
            const third = audiosPresent ? `<td style="width:70px; text-align:center;">${play}</td>` : '';
            rowsHtml += `
              <tr>
                <td class="${codeClass}">
                  <div class="vgs-editable" contenteditable="${editableCode}" data-box="${boxIdx}" data-row="${rowIdx}" data-field="code">${escapeHtml(row.code || '')}</div>
                </td>
                <td class="${resultCellClass}" ${audiosPresent ? '' : 'colspan="2"'}>
                  <div class="vgs-editable${linkCls}" contenteditable="${editableResult}" data-box="${boxIdx}" data-row="${rowIdx}" data-field="result"${linkAttr}${linkTitle}>${escapeHtml(row.result || '')}</div>
                </td>
                ${third}
                <td class="edit-only" style="width: 35px; text-align:center;">
                  <button type="button" style="background:none; border:none; color:var(--wiki-blue-text); cursor:pointer;" onclick="openVgsModalForEdit(${boxIdx}, ${rowIdx})">✏️</button>
                </td>
              </tr>
            `;
          });
        } else {
          rowsHtml = `<tr><td colspan="4" style="text-align:center; color:#8392A5; padding: 15px;">Nenhum comando adicionado. Clique no lápis do cabeçalho para adicionar.</td></tr>`;
        }

        const thThird = audiosPresent ? '<th style="width:70px; text-align:center;"></th>' : '';
        wikiBox.innerHTML = `
          <div class="vgs-outside-title">
            <span>${escapeHtml(box.boxTitle || 'VGS')} <button type="button" style="background:none; border:none; color:var(--wiki-blue-text); font-size:0.9rem; cursor:pointer;" onclick="openVgsModalForEdit(${boxIdx}, null)" class="edit-only">✏️</button></span>
          </div>
          <div class="vgs-wiki-box">
            <table class="vgs-wiki-table">
              <thead>
                <tr>
                  <th style="width: 90px; text-align:center;">VGS</th>
                  <th style="text-align:center;" ${audiosPresent ? '' : 'colspan="2"'}>Outcome</th>
                  ${thThird}
                  <th class="edit-only" style="width: 35px; text-align:center;">
                    <button type="button" style="background:none; border:none; color:var(--wiki-blue-text); font-size:0.9rem; cursor:pointer;" onclick="openVgsModalForEdit(${boxIdx}, null)" title="Adicionar Linha">+</button>
                  </th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
        container.appendChild(wikiBox);
      });
    }

    function readVgsEditable(el) {
      return (el.innerText || '').replace(/\u00a0/g, ' ');
    }

    function scheduleVgsSave() {
      clearTimeout(vgsSaveTimer);
      vgsSaveTimer = setTimeout(() => { saveStorageData(); }, 200);
    }

    function commitVgsCell(el) {
      const boxIdx = Number(el.dataset.box);
      const rowIdx = Number(el.dataset.row);
      const field = el.dataset.field;
      const list = getActiveVgs();
      const row = list[boxIdx] && list[boxIdx].rows && list[boxIdx].rows[rowIdx];
      if (!row || (field !== 'code' && field !== 'result')) return;
      let val = readVgsEditable(el);
      const focused = document.activeElement === el;
      if (field === 'code') {
        row.code = focused ? val : val.replace(/\s+/g, '').toUpperCase();
        if (!focused) {
          const shown = row.code;
          if (el.textContent !== shown) el.textContent = shown;
        }
      } else {
        row.result = val.replace(/\n+$/g, '');
      }
      if (focused) scheduleVgsSave();
      else {
        clearTimeout(vgsSaveTimer);
        saveStorageData();
      }
    }

    function flushPendingVgsRender() {
      if (!vgsRenderPending) return;
      const active = document.activeElement;
      if (active && active.classList && active.classList.contains('vgs-editable') && active.isContentEditable) return;
      renderVgsWikiTables();
    }

    function clearVgsFocus() {
      vgsFocusBoxId = null;
      renderVgsWikiTables();
    }

    function jumpToVgsBox(id) {
      if (!id) return;
      const all = getActiveVgs();
      if (!all.some((b) => b.id === id)) return;
      vgsFocusBoxId = id;
      renderVgsWikiTables();
      const el = document.getElementById('vgsTablesList');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleGlobalEditClick() {
      if (currentVPMode === 'vgs') {
        const vgsList = getActiveVgs();
        openVgsModalForEdit(vgsList.length, null);
      } else if (currentVPMode === 'god' || currentVPMode === 'announcer') {
        openTreeModalForAdd();
      } else if (currentVPMode === 'skin') {
        openSkinModal(null, null);
      }
    }

    function renderPendingAudios(containerId) {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (!pendingAudios.length) {
        el.innerHTML = '<div style="color:#8392A5;font-size:0.8rem;">Nenhum áudio ainda.</div>';
        return;
      }
      el.innerHTML = pendingAudios.map((ref, i) => `
        <div class="audio-chip">
          <button type="button" class="vgs-play-double-btn" data-audio-ref="${escapeHtml(ref)}" data-audio-label="${escapeHtml('Áudio ' + (i + 1))}">▶️</button>
          <span>Áudio ${i + 1}</span>
          <button type="button" class="smite-btn-danger" onclick="removePendingAudio(${i}, '${containerId}')" title="Remover áudio">🗑️</button>
        </div>
      `).join('');
    }

    function removePendingAudio(index, containerId) {
      pendingAudios.splice(index, 1);
      renderPendingAudios(containerId);
    }

    async function onVgsAudioPicked(e) {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      audioBusy = true;
      try {
        for (let i = 0; i < files.length; i++) pendingAudios.push(await storeBlob(files[i]));
        renderPendingAudios('vgsAudioList');
      } catch (err) {
        alert('Não foi possível adicionar o áudio.');
      } finally {
        audioBusy = false;
      }
    }

    async function onTreeAudioPicked(e) {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      audioBusy = true;
      try {
        for (let i = 0; i < files.length; i++) pendingAudios.push(await storeBlob(files[i]));
        renderPendingAudios('treeAudioList');
      } catch (err) {
        alert('Não foi possível adicionar o áudio.');
      } finally {
        audioBusy = false;
      }
    }

    function toggleVgsCategoryFields() {
      const isCat = document.getElementById('modalVgsIsCat').value === 'true';
      const group = document.getElementById('groupVgsLink');
      if (group) group.style.display = isCat ? 'flex' : 'none';
      if (isCat) populateVgsLinkSelect(document.getElementById('modalVgsLinkBox').value);
    }

    function populateVgsLinkSelect(selectedId) {
      const select = document.getElementById('modalVgsLinkBox');
      if (!select) return;
      const list = getActiveVgs();
      const current = list[editingVgsBoxIdx];
      const currentId = current && current.id;
      select.innerHTML = '<option value="">Não levar a nenhuma caixa</option>';
      list.forEach((box) => {
        if (!box.id || box.id === currentId) return;
        const opt = document.createElement('option');
        opt.value = box.id;
        opt.textContent = box.boxTitle || 'VGS';
        select.appendChild(opt);
      });
      const want = selectedId || '';
      select.value = Array.from(select.options).some((o) => o.value === want) ? want : '';
    }

    function openVgsModalForEdit(boxIdx, rowIdx) {
      const vgsList = getActiveVgs();
      const creatingBox = boxIdx !== null && boxIdx >= vgsList.length;
      if (!creatingBox && (boxIdx === null || boxIdx >= vgsList.length)) boxIdx = 0;
      editingVgsBoxIdx = creatingBox ? vgsList.length : boxIdx;
      editingVgsRowIdx = rowIdx;

      const targetBox = creatingBox ? { boxTitle: 'NOVA CAIXA VGS', rows: [] } : vgsList[boxIdx];
      document.getElementById('modalVgsBoxTitle').value = targetBox.boxTitle || 'VGS';
      document.getElementById('btnDeleteEntireVgsBox').style.display = creatingBox ? 'none' : 'inline-flex';
      const fileInput = document.getElementById('modalVgsAudioFile');
      if (fileInput) fileInput.value = '';

      if (!creatingBox && rowIdx !== null && rowIdx !== undefined && targetBox.rows && targetBox.rows[rowIdx]) {
        const row = targetBox.rows[rowIdx];
        document.getElementById('modalVgsCode').value = row.code || '';
        document.getElementById('modalVgsResult').value = row.result || '';
        document.getElementById('modalVgsIsCat').value = row.isCategory ? 'true' : 'false';
        document.getElementById('btnDeleteVgsRow').style.display = 'inline-flex';
        pendingAudios = listAudios(row).slice();
        populateVgsLinkSelect(row.linkBoxId || '');
      } else {
        document.getElementById('modalVgsCode').value = '';
        document.getElementById('modalVgsResult').value = '';
        document.getElementById('modalVgsIsCat').value = 'false';
        document.getElementById('btnDeleteVgsRow').style.display = 'none';
        pendingAudios = [];
        populateVgsLinkSelect('');
      }
      toggleVgsCategoryFields();
      renderPendingAudios('vgsAudioList');
      document.getElementById('editVgsModal').style.display = 'flex';
    }

    async function deleteEntireVgsBox() {
      const vgsList = getActiveVgs();
      if (editingVgsBoxIdx !== null && editingVgsBoxIdx < vgsList.length) {
        const removed = vgsList[editingVgsBoxIdx];
        vgsList.splice(editingVgsBoxIdx, 1);
        if (removed && removed.id === vgsFocusBoxId) vgsFocusBoxId = null;
        await saveStorageData();
        renderVgsWikiTables();
        closeModal('editVgsModal');
      }
    }

    async function saveVgsModal() {
      while (audioBusy) await new Promise((r) => setTimeout(r, 40));
      const vgsList = getActiveVgs();
      const titleInput = document.getElementById('modalVgsBoxTitle').value.trim() || 'VGS';
      const code = document.getElementById('modalVgsCode').value.trim().toUpperCase();
      const result = document.getElementById('modalVgsResult').value.replace(/\n+$/g, '');
      const isCat = document.getElementById('modalVgsIsCat').value === 'true';
      const linkBoxId = isCat ? (document.getElementById('modalVgsLinkBox').value || '') : '';

      let targetBox;
      if (editingVgsBoxIdx !== null && editingVgsBoxIdx < vgsList.length) {
        targetBox = vgsList[editingVgsBoxIdx];
        targetBox.boxTitle = titleInput;
      } else {
        targetBox = { id: 'vgsbox_' + Date.now().toString(36), boxTitle: titleInput, rows: [] };
        vgsList.push(targetBox);
        editingVgsBoxIdx = vgsList.length - 1;
      }
      if (!targetBox.id) targetBox.id = 'vgsbox_' + Date.now().toString(36);
      if (!targetBox.rows) targetBox.rows = [];

      const editingExisting = editingVgsRowIdx !== null && editingVgsRowIdx !== undefined && targetBox.rows[editingVgsRowIdx];
      if (editingExisting) {
        const row = targetBox.rows[editingVgsRowIdx];
        row.code = code;
        row.result = result;
        row.isCategory = isCat;
        row.linkBoxId = linkBoxId;
        row.audios = pendingAudios.slice();
        row.audioUrl = row.audios[0] || '';
      } else if (code || result || pendingAudios.length) {
        targetBox.rows.push({
          code: code,
          result: result,
          isCategory: isCat,
          linkBoxId: linkBoxId,
          audios: pendingAudios.slice(),
          audioUrl: pendingAudios[0] || ''
        });
      }

      await saveStorageData();
      renderVgsWikiTables();
      closeModal('editVgsModal');
    }

    async function deleteVgsRow() {
      const vgsList = getActiveVgs();
      if (editingVgsBoxIdx !== null && editingVgsRowIdx !== null && vgsList[editingVgsBoxIdx]) {
        vgsList[editingVgsBoxIdx].rows.splice(editingVgsRowIdx, 1);
        await saveStorageData();
        renderVgsWikiTables();
        closeModal('editVgsModal');
      }
    }

    function getActiveTree() {
      const god = godsDatabase[selectedGodIdx];
      const hasSkinSelected = (selectedSkinIdx > 0 && god.skins && god.skins[selectedSkinIdx]);
      const targetObj = hasSkinSelected ? god.skins[selectedSkinIdx] : god;
      if (currentVPMode === 'announcer') {
        if (!targetObj.announcerTree) targetObj.announcerTree = [];
        return targetObj.announcerTree;
      }
      if (!targetObj.voiceTree) targetObj.voiceTree = [];
      return targetObj.voiceTree;
    }

    function openTreeModalForAdd() {
      editingTreeTarget = null;
      pendingAudios = [];
      document.getElementById('modalTreeType').value = 'line';
      document.getElementById('modalTreeTitle').value = '';
      document.getElementById('modalTreeText').value = '';
      document.getElementById('btnDeleteTreeItem').style.display = 'none';
      const fileInput = document.getElementById('modalTreeAudioFile');
      if (fileInput) fileInput.value = '';
      populateParentDropdown();
      toggleTreeModalFields();
      renderPendingAudios('treeAudioList');
      document.getElementById('voiceCategoryLineModal').style.display = 'flex';
    }

    function openTreeModalForEdit(nodeId) {
      const tree = getActiveTree();
      const node = findNodeInTree(tree, nodeId);
      if (!node) return;
      editingTreeTarget = node;
      pendingAudios = listAudios(node).slice();
      document.getElementById('modalTreeType').value = node.type;
      document.getElementById('modalTreeTitle').value = node.title || '';
      document.getElementById('modalTreeText').value = node.text || '';
      document.getElementById('btnDeleteTreeItem').style.display = 'inline-flex';
      const fileInput = document.getElementById('modalTreeAudioFile');
      if (fileInput) fileInput.value = '';
      populateParentDropdown(nodeId);
      toggleTreeModalFields();
      renderPendingAudios('treeAudioList');
      document.getElementById('voiceCategoryLineModal').style.display = 'flex';
    }

    function toggleTreeModalFields() {
      const type = document.getElementById('modalTreeType').value;
      if (type === 'line') {
        document.getElementById('groupTreeTitle').style.display = 'flex';
        document.getElementById('labelTreeTitle').innerText = 'Título da Fala:';
        document.getElementById('groupTreeText').style.display = 'flex';
        document.getElementById('groupTreeParent').style.display = 'flex';
        document.getElementById('groupTreeAudio').style.display = 'flex';
      } else if (type === 'category') {
        document.getElementById('groupTreeTitle').style.display = 'flex';
        document.getElementById('labelTreeTitle').innerText = 'Nome da Categoria:';
        document.getElementById('groupTreeText').style.display = 'none';
        document.getElementById('groupTreeParent').style.display = 'none';
        document.getElementById('groupTreeAudio').style.display = 'none';
      } else if (type === 'subcategory') {
        document.getElementById('groupTreeTitle').style.display = 'flex';
        document.getElementById('labelTreeTitle').innerText = 'Nome da Subcategoria:';
        document.getElementById('groupTreeText').style.display = 'none';
        document.getElementById('groupTreeParent').style.display = 'flex';
        document.getElementById('groupTreeAudio').style.display = 'none';
      }
    }

    function populateParentDropdown(excludeId) {
      const select = document.getElementById('modalTreeParentSelect');
      select.innerHTML = '<option value="root">-- Raiz (Sem Pai) --</option>';
      const tree = getActiveTree();
      function walk(nodes, depth) {
        nodes.forEach((n) => {
          if (n.id === excludeId) return;
          if (n.type === 'category' || n.type === 'subcategory') {
            const prefix = '--'.repeat(depth || 0);
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.innerText = `${prefix} ${n.title} (${n.type})`;
            select.appendChild(opt);
            if (n.children) walk(n.children, (depth || 0) + 1);
          }
        });
      }
      walk(tree, 0);
      if (editingTreeTarget) {
        const parent = findParentNodeInTree(tree, editingTreeTarget.id);
        if (parent) select.value = parent.id;
      }
    }

    async function saveTreeModal() {
      while (audioBusy) await new Promise((r) => setTimeout(r, 40));
      const tree = getActiveTree();
      const type = document.getElementById('modalTreeType').value;
      const title = document.getElementById('modalTreeTitle').value.trim();
      const text = document.getElementById('modalTreeText').value.trim();
      const parentId = document.getElementById('modalTreeParentSelect').value;

      if (type === 'line' && !text) {
        alert('Por favor, insira o texto da fala.');
        return;
      }
      if ((type === 'category' || type === 'subcategory') && !title) {
        alert('Por favor, insira o título.');
        return;
      }

      const applyAudios = (node) => {
        if (type === 'line') {
          node.audios = pendingAudios.slice();
          node.audioUrl = node.audios[0] || '';
        }
      };

      if (editingTreeTarget) {
        removeNodeFromTree(tree, editingTreeTarget.id);
        editingTreeTarget.type = type;
        editingTreeTarget.title = title;
        editingTreeTarget.text = text;
        applyAudios(editingTreeTarget);
        if (parentId !== 'root') {
          const pNode = findNodeInTree(tree, parentId);
          if (pNode) {
            if (!pNode.children) pNode.children = [];
            pNode.children.push(editingTreeTarget);
          } else tree.push(editingTreeTarget);
        } else {
          tree.push(editingTreeTarget);
        }
      } else {
        const newNode = {
          id: 'node_' + Date.now(),
          type: type,
          title: title,
          text: text,
          children: [],
          audioUrl: '',
          audios: []
        };
        applyAudios(newNode);
        if (parentId === 'root') tree.push(newNode);
        else {
          const pNode = findNodeInTree(tree, parentId);
          if (pNode) {
            if (!pNode.children) pNode.children = [];
            pNode.children.push(newNode);
          } else tree.push(newNode);
        }
      }

      await saveStorageData();
      renderVoiceTreePanel();
      closeModal('voiceCategoryLineModal');
    }

    async function deleteTreeItem() {
      if (!editingTreeTarget) return;
      const tree = getActiveTree();
      removeNodeFromTree(tree, editingTreeTarget.id);
      await saveStorageData();
      renderVoiceTreePanel();
      closeModal('voiceCategoryLineModal');
    }

    function findNodeInTree(nodes, id) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.id === id) return n;
        if (n.children) {
          const found = findNodeInTree(n.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    function findParentNodeInTree(nodes, id) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.children && n.children.some((c) => c.id === id)) return n;
        if (n.children) {
          const found = findParentNodeInTree(n.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    function removeNodeFromTree(nodes, id) {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) {
          nodes.splice(i, 1);
          return true;
        }
        if (nodes[i].children) {
          const removed = removeNodeFromTree(nodes[i].children, id);
          if (removed) return true;
        }
      }
      return false;
    }

    function openGodModal(event, idx) {
      if (event && event.stopPropagation) event.stopPropagation();
      editingGodIndex = idx;
      const fileInput = document.getElementById('modalGodImgFile');
      if (fileInput) fileInput.value = '';
      if (idx !== null && idx !== undefined) {
        const god = godsDatabase[idx];
        document.getElementById('godModalTitle').innerText = 'EDITAR DEUS';
        document.getElementById('modalGodName').value = god.name || '';
        document.getElementById('modalGodTitle').value = god.title || '';
        document.getElementById('btnDeleteGod').style.display = 'inline-flex';
      } else {
        document.getElementById('godModalTitle').innerText = 'NOVO DEUS';
        document.getElementById('modalGodName').value = '';
        document.getElementById('modalGodTitle').value = '';
        document.getElementById('btnDeleteGod').style.display = 'none';
      }
      document.getElementById('godModal').style.display = 'flex';
    }

    async function saveGodModal() {
      const name = document.getElementById('modalGodName').value || 'NOVO DEUS';
      const title = document.getElementById('modalGodTitle').value || 'TÍTULO';
      const fileInput = document.getElementById('modalGodImgFile');
      const file = fileInput && fileInput.files[0];
      try {
        if (editingGodIndex !== null && editingGodIndex !== undefined) {
          const god = godsDatabase[editingGodIndex];
          god.name = name;
          god.title = title;
          if (file) god.img = await storeBlob(file);
        } else {
          const newGod = {
            id: 'god_' + Date.now(),
            name: name,
            title: title,
            pantheon: 'Japonês',
            type: 'Físico',
            class: 'Caçador',
            miniQuote: 'Frase curta...',
            difficulty: 'Média',
            lore: 'História do novo deus...',
            dubber: '',
            releaseDate: '',
            img: file ? await storeBlob(file) : defaultGodsDatabase[0].img,
            skins: [],
            voiceTree: [],
            announcerTree: []
          };
          godsDatabase.push(newGod);
        }
        await saveStorageData();
        renderRoster();
        closeModal('godModal');
      } catch (err) {
        alert('Não foi possível salvar o deus com essa imagem.');
      }
    }

    async function deleteCurrentGod() {
      if (editingGodIndex !== null && editingGodIndex !== undefined) {
        godsDatabase.splice(editingGodIndex, 1);
        await saveStorageData();
        renderRoster();
        closeModal('godModal');
      }
    }


    function normalizeAboutIconName(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('pt-BR');
    }

    function syncAboutIconBank(inputId, selectId, mapping) {
      const input = document.getElementById(inputId);
      const select = document.getElementById(selectId);
      if (!input || !select) return;

      const normalized = normalizeAboutIconName(input.value);
      const path = mapping[normalized];

      // Só altera a seleção quando existe correspondência válida.
      // Nomes desconhecidos não apagam a escolha já existente.
      if (path && [...select.options].some(o => o.value === path)) {
        select.value = path;
      }
    }

    function setupAboutIconAutoMapping() {
      const mappings = [
        ['aboutPantheonName', 'aboutPantheonBank', {
          'arthuriano': '/smite-icons/NewUI_Pantheon_Arthurian.png',
          'babilonico': '/smite-icons/NewUI_Pantheon_Babylonian.png',
          'celta': '/smite-icons/NewUI_Pantheon_Celtic.png',
          'chines': '/smite-icons/NewUI_Pantheon_Chinese.png',
          'egipcio': '/smite-icons/NewUI_Pantheon_Egyptian.png',
          'grandes antigos': '/smite-icons/NewUI_Pantheon_Great_Old_Ones.png',
          'os grandes antigos': '/smite-icons/NewUI_Pantheon_Great_Old_Ones.png',
          'grego': '/smite-icons/NewUI_Pantheon_Greek.png',
          'hindu': '/smite-icons/NewUI_Pantheon_Hindu.png',
          'japones': '/smite-icons/NewUI_Pantheon_Japanese.webp',
          'maia': '/smite-icons/NewUI_Pantheon_Maya.png',
          'nordico': '/smite-icons/NewUI_Pantheon_Norse.png',
          'polinesio': '/smite-icons/NewUI_Pantheon_Polynesian.png',
          'romano': '/smite-icons/NewUI_Pantheon_Roman.png',
          'eslavo': '/smite-icons/NewUI_Pantheon_Slavic.png',
          'vodu': '/smite-icons/NewUI_Pantheon_Voodoo.png',
          'ioruba': '/smite-icons/NewUI_Pantheon_Yoruba.png'
        }],
        ['aboutTypeName', 'aboutTypeBank', {
          'magico': '/smite-icons/NewUI_Type_Magical.png',
          'fisico': '/smite-icons/NewUI_Type_Physical.png'
        }],
        ['aboutClassName', 'aboutClassBank', {
          'guardiao': '/smite-icons/NewUI_Class_Guardian.png',
          'guerreiro': '/smite-icons/NewUI_Class_Warrior.png',
          'cacador': '/smite-icons/NewUI_Class_Hunter.webp',
          'mago': '/smite-icons/NewUI_Class_Mage.png',
          'assassino': '/smite-icons/NewUI_Class_Assassin.webp',
          'desconhecida': '/smite-icons/NewUI_Class_Unknown.png',
          'desconhecido': '/smite-icons/NewUI_Class_Unknown.png'
        }]
      ];

      for (const [inputId, selectId, mapping] of mappings) {
        const input = document.getElementById(inputId);
        if (!input || input.dataset.iconMappingReady === '1') continue;
        input.addEventListener('input', () => {
          syncAboutIconBank(inputId, selectId, mapping);
        });
        input.dataset.iconMappingReady = '1';
      }
    }

    function openAboutModal() {
      setupAboutIconAutoMapping();
      const god = godsDatabase[selectedGodIdx];
      document.getElementById('aboutPantheonName').value = god.pantheon || '';
      document.getElementById('aboutTypeName').value = god.type || '';
      document.getElementById('aboutClassName').value = god.class || '';
      document.getElementById('aboutQuote').value = god.miniQuote || '';
      document.getElementById('aboutDifficulty').value = god.difficulty || '';
      ['aboutPantheonImgFile', 'aboutTypeImgFile', 'aboutClassImgFile'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      [
        ['aboutPantheonBank', god.pantheonImg, 'aboutPantheonName', {
          'arthuriano': '/smite-icons/NewUI_Pantheon_Arthurian.png',
          'babilonico': '/smite-icons/NewUI_Pantheon_Babylonian.png',
          'celta': '/smite-icons/NewUI_Pantheon_Celtic.png',
          'chines': '/smite-icons/NewUI_Pantheon_Chinese.png',
          'egipcio': '/smite-icons/NewUI_Pantheon_Egyptian.png',
          'grandes antigos': '/smite-icons/NewUI_Pantheon_Great_Old_Ones.png',
          'os grandes antigos': '/smite-icons/NewUI_Pantheon_Great_Old_Ones.png',
          'grego': '/smite-icons/NewUI_Pantheon_Greek.png',
          'hindu': '/smite-icons/NewUI_Pantheon_Hindu.png',
          'japones': '/smite-icons/NewUI_Pantheon_Japanese.webp',
          'maia': '/smite-icons/NewUI_Pantheon_Maya.png',
          'nordico': '/smite-icons/NewUI_Pantheon_Norse.png',
          'polinesio': '/smite-icons/NewUI_Pantheon_Polynesian.png',
          'romano': '/smite-icons/NewUI_Pantheon_Roman.png',
          'eslavo': '/smite-icons/NewUI_Pantheon_Slavic.png',
          'vodu': '/smite-icons/NewUI_Pantheon_Voodoo.png',
          'ioruba': '/smite-icons/NewUI_Pantheon_Yoruba.png'
        }],
        ['aboutTypeBank', god.typeImg, 'aboutTypeName', {
          'magico': '/smite-icons/NewUI_Type_Magical.png',
          'fisico': '/smite-icons/NewUI_Type_Physical.png'
        }],
        ['aboutClassBank', god.classImg, 'aboutClassName', {
          'guardiao': '/smite-icons/NewUI_Class_Guardian.png',
          'guerreiro': '/smite-icons/NewUI_Class_Warrior.png',
          'cacador': '/smite-icons/NewUI_Class_Hunter.webp',
          'mago': '/smite-icons/NewUI_Class_Mage.png',
          'assassino': '/smite-icons/NewUI_Class_Assassin.webp',
          'desconhecida': '/smite-icons/NewUI_Class_Unknown.png',
          'desconhecido': '/smite-icons/NewUI_Class_Unknown.png'
        }]
      ].forEach(([id, current, inputId, mapping]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const knownCurrent = [...el.options].some(o => o.value === current);
        if (knownCurrent) {
          el.value = current;
        } else {
          const input = document.getElementById(inputId);
          const key = normalizeAboutIconName(input ? input.value : '');
          const mapped = mapping[key];
          // Não substitui imagem personalizada salva por uma imagem do banco.
          el.value = '';
          if (!current && mapped && [...el.options].some(o => o.value === mapped)) {
            el.value = mapped;
          }
        }
      });
      document.getElementById('aboutModal').style.display = 'flex';
    }

    async function saveAboutModal() {
      const god = godsDatabase[selectedGodIdx];
      god.pantheon = document.getElementById('aboutPantheonName').value;
      god.type = document.getElementById('aboutTypeName').value;
      god.class = document.getElementById('aboutClassName').value;
      god.miniQuote = document.getElementById('aboutQuote').value;
      god.difficulty = document.getElementById('aboutDifficulty').value;
      try {
        const pFile = document.getElementById('aboutPantheonImgFile').files[0];
        const tFile = document.getElementById('aboutTypeImgFile').files[0];
        const cFile = document.getElementById('aboutClassImgFile').files[0];
        const pBank = document.getElementById('aboutPantheonBank').value;
        const tBank = document.getElementById('aboutTypeBank').value;
        const cBank = document.getElementById('aboutClassBank').value;
        if (pFile) god.pantheonImg = await storeBlob(pFile);
        else if (pBank) god.pantheonImg = pBank;
        if (tFile) god.typeImg = await storeBlob(tFile);
        else if (tBank) god.typeImg = tBank;
        if (cFile) god.classImg = await storeBlob(cFile);
        else if (cBank) god.classImg = cBank;
        await saveStorageData();
        renderGodView();
        closeModal('aboutModal');
      } catch (err) {
        alert('Não foi possível salvar os ícones.');
      }
    }

    function openLoreModal() {
      document.getElementById('loreTextarea').value = godsDatabase[selectedGodIdx].lore || '';
      document.getElementById('loreModal').style.display = 'flex';
    }

    async function saveLoreModal() {
      godsDatabase[selectedGodIdx].lore = document.getElementById('loreTextarea').value;
      await saveStorageData();
      renderGodView();
      closeModal('loreModal');
    }

    function openSkinModal(event, idx) {
      if (event && event.stopPropagation) event.stopPropagation();
      editingSkinIndex = (idx === undefined ? null : idx);
      const fileInput = document.getElementById('modalSkinImgFile');
      if (fileInput) fileInput.value = '';
      if (idx !== null && idx !== undefined) {
        const skin = godsDatabase[selectedGodIdx].skins[idx];
        document.getElementById('modalSkinName').value = skin.name || '';
        document.getElementById('modalSkinTier').value = (skin.tier || 'PADRÃO').toUpperCase();
        document.getElementById('btnDeleteSkinCard').style.display = 'inline-flex';
      } else {
        document.getElementById('modalSkinName').value = 'Nova Skin';
        document.getElementById('modalSkinTier').value = 'EXCLUSIVO';
        document.getElementById('btnDeleteSkinCard').style.display = 'none';
      }
      document.getElementById('editSkinModal').style.display = 'flex';
    }

    let savingSkin = false;
    async function saveSkinModal() {
      if (savingSkin) return;
      savingSkin = true;
      const god = godsDatabase[selectedGodIdx];
      if (!god.skins) god.skins = [];
      const name = document.getElementById('modalSkinName').value || 'Nova Skin';
      const tier = document.getElementById('modalSkinTier').value;
      const fileInput = document.getElementById('modalSkinImgFile');
      const file = fileInput && fileInput.files[0];
      try {
        let imgRef = null;
        if (file) imgRef = await storeBlob(file);
        if (editingSkinIndex !== null && editingSkinIndex !== undefined) {
          const skin = god.skins[editingSkinIndex];
          skin.name = name;
          skin.tier = tier;
          if (imgRef) skin.img = imgRef;
        } else {
          god.skins.push({
            id: 'skin_' + Date.now(),
            name: name,
            tier: tier,
            img: imgRef || god.img,
            dubber: god.dubber || '',
            releaseDate: god.releaseDate || ''
          });
        }
        await saveStorageData();
        renderSkinsTab();
        if (document.getElementById('vpSkinCardsGrid')) renderVpSkinCardsPanel();
        if (currentGodTab === 'skins') {
          const shown = god.skins[selectedSkinIdx] || god;
          setStageBg(shown.img || god.img);
        }
        closeModal('editSkinModal');
      } catch (err) {
        alert('Não foi possível salvar a aparência com essa imagem. Tente de novo.');
      } finally {
        savingSkin = false;
      }
    }

    async function deleteCurrentSkinCard() {
      if (editingSkinIndex !== null && editingSkinIndex !== undefined) {
        godsDatabase[selectedGodIdx].skins.splice(editingSkinIndex, 1);
        if (selectedSkinIdx >= godsDatabase[selectedGodIdx].skins.length) selectedSkinIdx = 0;
        await saveStorageData();
        renderSkinsTab();
        if (document.getElementById('vpSkinCardsGrid')) renderVpSkinCardsPanel();
        closeModal('editSkinModal');
      }
    }

    function openSettingsModal() {
      applyVolumeUi();
      document.getElementById('settingsModal').style.display = 'flex';
    }

    function closeModal(id) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }

    function toggleEditModeSimple() {
      isEditMode = !isEditMode;
      const btn = document.getElementById('editToggleBtn');
      const app = document.getElementById('smite-app');
      if (isEditMode) {
        app.classList.remove('edit-mode-off');
        btn.innerText = 'ON';
      } else {
        app.classList.add('edit-mode-off');
        btn.innerText = 'OFF';
      }
      if (currentVPMode === 'vgs' && document.getElementById('screenVoicebankView').style.display !== 'none') {
        renderVgsWikiTables();
      }
    }

    function updateAudioVolume(val) {
      audioVolume = Number(val) / 100;
      const label = document.getElementById('volumeValText');
      if (label) label.innerText = val + '%';
      if (activeAudioInstance) {
        const gain = Number.isFinite(activeAudioInstance.__smiteGain)
          ? activeAudioInstance.__smiteGain : 1;
        activeAudioInstance.volume = audioVolume * gain;
      }
      try { localStorage.setItem('smite_audio_volume', String(audioVolume)); } catch (e) {}
    }

    function stopChatClock() {
      if (chatClockTimer) {
        clearInterval(chatClockTimer);
        chatClockTimer = null;
      }
    }

    function chatEl() {
      return document.getElementById('statusAudio');
    }

    function showWelcomeChat() {
      const el = chatEl();
      if (!el) return;
      stopChatClock();
      const token = ++chatToken;
      el.classList.remove('is-fading', 'is-playing');
      el.textContent = '[' + clockStamp() + ']: Bem vindo ao Smite!';
      setTimeout(() => {
        if (token !== chatToken) return;
        el.classList.add('is-fading');
        setTimeout(() => {
          if (token !== chatToken) return;
          el.classList.remove('is-fading');
          el.textContent = '[' + clockStamp() + ']: Olá! Digite um comando ou selecione um áudio para começar.';
          setTimeout(() => {
            if (token !== chatToken) return;
            el.classList.add('is-fading');
            setTimeout(() => {
              if (token !== chatToken) return;
              el.classList.remove('is-fading', 'is-playing');
              el.textContent = CHAT_IDLE;
            }, 560);
          }, 3400);
        }, 560);
      }, 2200);
    }

    function startPlayingChat(speech) {
      stopChatClock();
      chatToken++;
      const el = chatEl();
      if (!el) return;
      const render = () => {
        el.classList.remove('is-fading');
        el.classList.add('is-playing');
        el.textContent = '[' + clockStamp() + ']: Reproduzindo: ' + speech;
      };
      render();
      chatClockTimer = setInterval(render, 1000);
    }

    function fadeOutPlayingChat() {
      stopChatClock();
      const el = chatEl();
      if (!el) return;
      const token = ++chatToken;
      el.classList.add('is-fading');
      setTimeout(() => {
        if (token !== chatToken) return;
        el.classList.remove('is-playing', 'is-fading');
        el.textContent = CHAT_IDLE;
      }, 600);
    }

    function resetPlayButton(btn) {
      if (!btn) return;
      btn.classList.remove('playing');
      btn.textContent = '▶️';
    }

    function fadeAudioGain(audio, targetGain, duration = 32, onComplete) {
      if (!audio) {
        if (onComplete) onComplete();
        return;
      }

      const token = (audio.__smiteFadeToken || 0) + 1;
      audio.__smiteFadeToken = token;
      const startGain = Number.isFinite(audio.__smiteGain)
        ? audio.__smiteGain : 1;
      const startTime = performance.now();

      const step = (now) => {
        if (audio.__smiteFadeToken !== token) return;

        const progress = duration <= 0
          ? 1 : Math.min(1, (now - startTime) / duration);
        const gain = startGain + (targetGain - startGain) * progress;

        audio.__smiteGain = gain;
        audio.volume = Math.max(0, Math.min(1, audioVolume * gain));

        if (progress < 1) {
          audio.__smiteFadeFrame = requestAnimationFrame(step);
        } else {
          audio.__smiteFadeFrame = 0;
          if (onComplete) onComplete();
        }
      };

      if (audio.__smiteFadeFrame) {
        cancelAnimationFrame(audio.__smiteFadeFrame);
      }
      audio.__smiteFadeFrame = requestAnimationFrame(step);
    }

    function togglePlayAudio(ref, titleText, btnElement) {
      const url = mediaSync(ref);
      if (!url || !btnElement) return;

      const requestId = ++audioSwitchToken;
      const current = activeAudioInstance;
      const currentButton = activePlayButtonElement;

      const startRequestedAudio = () => {
        if (requestId !== audioSwitchToken) return;

        const audio = new Audio(url);
        audio.__smiteGain = 0;
        audio.volume = 0;

        activeAudioInstance = audio;
        activePlayButtonElement = btnElement;
        activeAudioLabel = titleText;

        btnElement.classList.add('playing');
        btnElement.textContent = '⏸️';
        startPlayingChat(titleText);

        audio.onended = () => {
          resetPlayButton(btnElement);
          if (activeAudioInstance === audio) {
            activeAudioInstance = null;
            activePlayButtonElement = null;
          }
          fadeOutPlayingChat();
        };

        audio.play().then(() => {
          if (activeAudioInstance === audio && requestId === audioSwitchToken) {
            fadeAudioGain(audio, 1, 32);
          }
        }).catch(() => {
          if (activeAudioInstance === audio) {
            activeAudioInstance = null;
            activePlayButtonElement = null;
          }
          audio.onended = null;
          audio.pause();
          audio.volume = 0;
          audio.__smiteGain = 0;
          resetPlayButton(btnElement);
          fadeOutPlayingChat();
        });
      };

      // Mesmo botão: pausar ou retomar a faixa atual.
      if (current && currentButton === btnElement) {
        if (!current.paused) {
          fadeAudioGain(current, 0, 32, () => {
            if (requestId !== audioSwitchToken) return;
            current.pause();
            current.volume = audioVolume;
            current.__smiteGain = 1;
            resetPlayButton(btnElement);
            fadeOutPlayingChat();
          });
          return;
        }

        current.__smiteGain = 0;
        current.volume = 0;
        current.play().then(() => {
          if (activeAudioInstance !== current || requestId !== audioSwitchToken) return;
          btnElement.classList.add('playing');
          btnElement.textContent = '⏸️';
          fadeAudioGain(current, 1, 32);
          startPlayingChat(titleText);
        }).catch(() => {
          if (activeAudioInstance === current) {
            resetPlayButton(btnElement);
            fadeOutPlayingChat();
          }
        });
        return;
      }

      // Faixa anterior: terminar o fade-out e pará-la antes da próxima.
      if (current) {
        current.onended = null;
        fadeAudioGain(current, 0, 32, () => {
          current.pause();
          try { current.currentTime = 0; } catch (e) {}
          current.volume = 0;
          current.__smiteGain = 0;
          resetPlayButton(currentButton);

          if (activeAudioInstance === current) {
            activeAudioInstance = null;
            activePlayButtonElement = null;
          }

          startRequestedAudio();
        });
        return;
      }

      startRequestedAudio();
    }

    function bindGlobalInteractions() {
      if (window.__smiteDelegated) return;
      window.__smiteDelegated = true;
      document.addEventListener('click', (e) => {
        const playBtn = e.target.closest && e.target.closest('.vgs-play-double-btn');
        if (playBtn && playBtn.dataset.audioRef) {
          e.preventDefault();
          e.stopPropagation();
          togglePlayAudio(playBtn.dataset.audioRef, playBtn.dataset.audioLabel || '', playBtn);
          return;
        }
        const link = e.target.closest && e.target.closest('.vgs-editable.is-link');
        if (link && link.dataset.linkBox && link.getAttribute('contenteditable') !== 'true') {
          e.preventDefault();
          jumpToVgsBox(link.dataset.linkBox);
        }
      });
      document.addEventListener('input', (e) => {
        const el = e.target && e.target.closest && e.target.closest('.vgs-editable');
        if (!el || !el.isContentEditable) return;
        commitVgsCell(el);
      });
      document.addEventListener('focusout', (e) => {
        const el = e.target && e.target.closest && e.target.closest('.vgs-editable');
        if (!el || el.getAttribute('contenteditable') !== 'true') return;
        if (el.contains(e.relatedTarget)) return;
        commitVgsCell(el);
        flushPendingVgsRender();
      });
      document.addEventListener('keydown', (e) => {
        const el = e.target && e.target.closest && e.target.closest('.vgs-editable');
        if (!el || !el.isContentEditable) return;
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        if (el.dataset.field === 'code') {
          e.preventDefault();
          el.blur();
          return;
        }
        if (el.dataset.field === 'result') {
          e.preventDefault();
          document.execCommand('insertLineBreak');
          commitVgsCell(el);
        }
      });
    }

    function initPencilDrag() {
      const btn = document.getElementById('globalPageEditBtn');
      if (!btn || btn.dataset.dragReady === '1') return;
      btn.dataset.dragReady = '1';
      let drag = null;
      const DRAG_THRESHOLD = 12;

      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const rect = btn.getBoundingClientRect();
        drag = {
          dx: e.clientX - rect.left,
          dy: e.clientY - rect.top,
          moved: false,
          sx: e.clientX,
          sy: e.clientY,
          pid: e.pointerId
        };
      });
      btn.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        if (!drag.moved) {
          if (Math.abs(e.clientX - drag.sx) < DRAG_THRESHOLD && Math.abs(e.clientY - drag.sy) < DRAG_THRESHOLD) return;
          drag.moved = true;
          btn.classList.add('is-dragging');
          try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        }
        const x = Math.max(4, Math.min(window.innerWidth - 50, e.clientX - drag.dx));
        const y = Math.max(4, Math.min(window.innerHeight - 50, e.clientY - drag.dy));
        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      });
      const endDrag = (e) => {
        if (!drag || (e && e.pointerId !== undefined && e.pointerId !== drag.pid)) return;
        const moved = drag.moved;
        drag = null;
        btn.classList.remove('is-dragging');
        if (!moved) return;
        btn.dataset.suppressClick = '1';
        const x = parseInt(btn.style.left, 10);
        const y = parseInt(btn.style.top, 10);
        try { localStorage.setItem('smite_pencil_pos', JSON.stringify({ x: x, y: y })); } catch (err) {}
      };
      btn.addEventListener('pointerup', endDrag);
      btn.addEventListener('pointercancel', (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        const moved = drag.moved;
        drag = null;
        btn.classList.remove('is-dragging');
        if (moved) btn.dataset.suppressClick = '1';
      });
      btn.addEventListener('click', (e) => {
        if (btn.dataset.suppressClick !== '1') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        btn.dataset.suppressClick = '';
      }, true);
    }

    async function bootSmiteWiki() {
      const app = document.getElementById('smite-app');
      if (!app || app.dataset.booted === '1') return;
      app.dataset.booted = '1';
      bindGlobalInteractions();
      initPencilDrag();
      try {
        await loadStorageData();
      } catch (e) {
        if (!godsDatabase.length) godsDatabase = JSON.parse(JSON.stringify(defaultGodsDatabase));
        applyMainBg();
      }
      showWelcomeChat();
    }

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', bootSmiteWiki);
    } else {
      bootSmiteWiki();
    }
    window.bootSmiteWiki = bootSmiteWiki;
