
    let isEditMode = true;

    const defaultGodsDatabase = [
      {
        id: 'god_izanami',
        name: 'IZANAMI',
        title: 'MATRON OF THE DEAD',
        pantheon: 'Japonês',
        pantheonImg: 'https://images.unsplash.com/photo-1528164344705-47542687990d?q=80&w=100&auto=format&fit=crop',
        type: 'Físico',
        typeImg: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?q=80&w=100&auto=format&fit=crop',
        class: 'Caçador',
        classImg: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=100&auto=format&fit=crop',
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
    let vgsDatabase = [
      {
        boxTitle: 'VV - Other',
        rows: [
          { code: 'G', result: 'General', isCategory: true, audioUrl: '' },
          { code: 'V', result: 'Position', isCategory: true, audioUrl: '' },
          { code: 'A', result: '"Ok!"', isCategory: false, audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
          { code: 'B', result: '"Be right back!"', isCategory: false, audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
          { code: 'C', result: '"Completed!"', isCategory: false, audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' }
        ]
      }
    ];

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
    let activePlayButtonElement = null;

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

    function loadStorageData() {
      const savedGods = localStorage.getItem('smite_gods_db');
      if (savedGods) {
        try {
          const parsed = JSON.parse(savedGods);
          if (Array.isArray(parsed) && parsed.length > 0) godsDatabase = parsed;
          else godsDatabase = defaultGodsDatabase;
        } catch(e) { godsDatabase = defaultGodsDatabase; }
      } else {
        godsDatabase = defaultGodsDatabase;
      }

      const savedVgs = localStorage.getItem('smite_vgs_db');
      if (savedVgs) {
        try {
          const parsedVgs = JSON.parse(savedVgs);
          if (Array.isArray(parsedVgs) && parsedVgs.length > 0) vgsDatabase = parsedVgs;
        } catch(e) {}
      }

      const mainBg = localStorage.getItem('smite_main_bg');
      if (mainBg) {
        document.getElementById('screenMain').style.backgroundImage = `linear-gradient(rgba(4,6,8,0.7), rgba(4,6,8,0.85)), url('${mainBg}')`;
      }
    }

    function saveStorageData() {
      localStorage.setItem('smite_gods_db', JSON.stringify(godsDatabase));
      localStorage.setItem('smite_vgs_db', JSON.stringify(vgsDatabase));
    }

    function bootSmiteWiki() {
      loadStorageData();
    }
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', bootSmiteWiki);
    } else {
      bootSmiteWiki();
    }

    function uploadMainBg(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          const url = ev.target.result;
          document.getElementById('screenMain').style.backgroundImage = `linear-gradient(rgba(4,6,8,0.7), rgba(4,6,8,0.85)), url('${url}')`;
          localStorage.setItem('smite_main_bg', url);
        };
        reader.readAsDataURL(file);
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

    function handleBack() {
      if (historyStack.length > 1) {
        historyStack.pop();
        const last = historyStack[historyStack.length - 1];
        hideAll();
        if (last === 'main') {
          document.getElementById('smite-app').classList.add('on-screen-main');
          document.getElementById('screenMain').style.display = 'flex';
          document.getElementById('backBtn').style.display = 'none';
        } else if (last === 'roster') {
          document.getElementById('smite-app').classList.remove('on-screen-main');
          document.getElementById('screenRoster').style.display = 'flex';
          document.getElementById('backBtn').style.display = 'flex';
        }
      }
    }

    function renderRoster() {
      const grid = document.getElementById('rosterGrid');
      grid.innerHTML = '';
      const filter = document.getElementById('rosterSearch').value.toLowerCase();

      godsDatabase.forEach((god, idx) => {
        if (filter && !god.name.toLowerCase().includes(filter)) return;

        const container = document.createElement('div');
        container.className = 'god-card-container';
        container.innerHTML = `
          <button class="card-edit-btn edit-only" onclick="openGodModal(event, ${idx})">✏️</button>
          <div class="smite-god-select-card" style="--card-bg-url: url('${god.img}'); background-image: linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(5,8,15,0.85) 100%), url('${god.img}');" onclick="selectGod(${idx})">
            <div class="god-select-card-name">${god.name}</div>
          </div>
        `;
        grid.appendChild(container);
      });
    }

    function selectGod(idx) {
      selectedGodIdx = idx;
      selectedSkinIdx = 0;
      hideAll();
      document.getElementById('smite-app').classList.remove('on-screen-main');

      if (currentMode === 'gods') {
        document.getElementById('screenGodView').style.display = 'grid';
        renderGodView();
        historyStack.push('godView');
      } else {
        document.getElementById('screenVoicebankView').style.display = 'block';
        renderVoicebankView();
        switchVPMode('god');
        historyStack.push('voicebankView');
      }
    }

    function goToVoicebankFromGod() {
      hideAll();
      document.getElementById('screenVoicebankView').style.display = 'block';
      renderVoicebankView();
      switchVPMode('god');
      historyStack.push('voicebankView');
    }

    function renderGodView() {
      const god = godsDatabase[selectedGodIdx];
      document.getElementById('extGodName').innerText = god.name;
      document.getElementById('extGodTitle').innerText = god.title;
      document.getElementById('godLoreText').innerText = god.lore || '';
      document.getElementById('godMiniQuote').innerText = god.miniQuote || '';
      document.getElementById('godDifficulty').innerText = 'DIFICULDADE - ' + (god.difficulty || 'Média');
      
      document.getElementById('pantheonName').innerText = god.pantheon || 'Japonês';
      document.getElementById('typeName').innerText = god.type || 'Físico';
      document.getElementById('className').innerText = god.class || 'Caçador';

      if (god.pantheonImg) document.getElementById('pantheonImg').src = god.pantheonImg;
      if (god.typeImg) document.getElementById('typeImg').src = god.typeImg;
      if (god.classImg) document.getElementById('classImg').src = god.classImg;

      document.getElementById('godStage').style.backgroundImage = `linear-gradient(rgba(2,4,6,0.65), rgba(2,4,6,0.92)), url('${god.img}')`;
      renderSkinsTab();
      switchGodTab('about');
    }

    function switchGodTab(tab) {
      const god = godsDatabase[selectedGodIdx];

      document.getElementById('tabBtnAbout').classList.remove('active');
      document.getElementById('tabBtnSkins').classList.remove('active');
      document.getElementById('tabBtnLore').classList.remove('active');

      document.getElementById('godTabAbout').style.display = 'none';
      document.getElementById('godTabSkins').style.display = 'none';
      document.getElementById('godTabLore').style.display = 'none';

      if (tab === 'about') {
        document.getElementById('tabBtnAbout').classList.add('active');
        document.getElementById('godTabAbout').style.display = 'flex';
        document.getElementById('godStage').style.backgroundImage = `linear-gradient(rgba(2,4,6,0.65), rgba(2,4,6,0.92)), url('${god.img}')`;
      } else if (tab === 'skins') {
        document.getElementById('tabBtnSkins').classList.add('active');
        document.getElementById('godTabSkins').style.display = 'flex';
        const currentSkin = (god.skins && god.skins[selectedSkinIdx]) ? god.skins[selectedSkinIdx] : god;
        document.getElementById('godStage').style.backgroundImage = `linear-gradient(rgba(2,4,6,0.65), rgba(2,4,6,0.92)), url('${currentSkin.img}')`;
      } else if (tab === 'lore') {
        document.getElementById('tabBtnLore').classList.add('active');
        document.getElementById('godTabLore').style.display = 'flex';
        document.getElementById('godStage').style.backgroundImage = `linear-gradient(rgba(2,4,6,0.65), rgba(2,4,6,0.92)), url('${god.img}')`;
      }
    }

    function renderSkinsTab() {
      const grid = document.getElementById('godSkinsGrid');
      grid.innerHTML = '';
      const god = godsDatabase[selectedGodIdx];

      if(god.skins) {
        god.skins.forEach((skin, idx) => {
          const isPadrao = !skin.tier || skin.tier.toUpperCase() === 'PADRÃO';
          const cssClass = getTierCssClass(skin.tier);

          const wrapper = document.createElement('div');
          wrapper.className = 'god-card-container';
          wrapper.innerHTML = `
            <button class="card-edit-btn edit-only" onclick="openSkinModal(event, ${idx})">✏️</button>
            <div class="smite-skin-card-wrapper">
              <div class="smite-skin-card" style="--skin-bg-url: url('${skin.img}'); background-image: linear-gradient(180deg, rgba(0,0,0,0.15) 30%, rgba(5,8,15,0.9) 100%), url('${skin.img}');" onclick="applySkinBackground(${idx})">
                ${!isPadrao ? `<div class="skin-card-banner ${cssClass}"><span>${skin.tier.toUpperCase()}</span></div>` : '<div></div>'}
              </div>
              <div class="skin-card-bottom-title">${skin.name}</div>
            </div>
          `;
          grid.appendChild(wrapper);
        });
      }
    }

    function applySkinBackground(idx) {
      selectedSkinIdx = idx;
      const skin = godsDatabase[selectedGodIdx].skins[idx];
      document.getElementById('godStage').style.backgroundImage = `linear-gradient(rgba(2,4,6,0.65), rgba(2,4,6,0.92)), url('${skin.img}')`;
    }

    function renderVoicebankView() {
      const god = godsDatabase[selectedGodIdx];
      const currentSkin = (god.skins && god.skins[selectedSkinIdx]) ? god.skins[selectedSkinIdx] : null;

      document.getElementById('vpTitle').innerText = currentSkin && currentSkin.name.toUpperCase() !== 'PADRÃO' ? `${currentSkin.name}` : `${god.name}`;
      document.getElementById('vpImage').src = currentSkin ? currentSkin.img : god.img;

      document.getElementById('vpDubber').innerText = currentSkin ? (currentSkin.dubber || 'Lisa Ortiz') : (god.dubber || 'Lisa Ortiz');
      document.getElementById('vpReleaseDate').innerText = currentSkin ? (currentSkin.releaseDate || '15/09/2016') : (god.releaseDate || '15/09/2016');
    }

    function openVpHeaderModal() {
      const god = godsDatabase[selectedGodIdx];
      const currentSkin = (god.skins && god.skins[selectedSkinIdx]) ? god.skins[selectedSkinIdx] : null;

      document.getElementById('modalVpDubber').value = currentSkin ? (currentSkin.dubber || '') : (god.dubber || '');
      document.getElementById('modalVpReleaseDate').value = currentSkin ? (currentSkin.releaseDate || '') : (god.releaseDate || '');
      document.getElementById('vpHeaderModal').style.display = 'flex';
    }

    function saveVpHeaderModal() {
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

      saveStorageData();
      renderVoicebankView();
      closeModal('vpHeaderModal');
    }

    function switchVPMode(mode) {
      currentVPMode = mode;
      document.querySelectorAll('.wiki-btn-menu').forEach(b => b.classList.remove('active'));
      
      const god = godsDatabase[selectedGodIdx];
      const hasSkinSelected = (selectedSkinIdx > 0 && god.skins && god.skins[selectedSkinIdx]);
      const btnGodElem = document.getElementById('btnVpGod');
      if (btnGodElem) {
        btnGodElem.innerText = hasSkinSelected ? 'VOZ DA APARÊNCIA' : 'VOZ DO DEUS';
      }

      const btnMap = { 'god': 'btnVpGod', 'skin': 'btnVpSkin', 'announcer': 'btnVpAnnouncer', 'vgs': 'btnVpVGS' };
      if (btnMap[mode]) document.getElementById(btnMap[mode]).classList.add('active');

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
      const hasSkinSelected = (selectedSkinIdx > 0 && god.skins && god.skins[selectedSkinIdx]);
      const currentSkin = hasSkinSelected ? god.skins[selectedSkinIdx] : null;
      const targetName = currentSkin ? currentSkin.name.toUpperCase() : god.name;

      const container = document.getElementById('voiceTreeContainer');
      container.innerHTML = '';

      if (currentVPMode === 'god') {
        document.getElementById('vpSectionTitle').innerText = hasSkinSelected ? `FALAS DE ${targetName} (APARÊNCIA)` : `FALAS DE ${targetName}`;
        const tree = getActiveTree();
        renderTreeNodes(tree, container);
      } else if (currentVPMode === 'announcer') {
        document.getElementById('vpSectionTitle').innerText = `PACOTE DE LOCUTOR DE ${targetName}`;
        const tree = getActiveTree();
        renderTreeNodes(tree, container);
      }
    }

    function renderTreeNodes(nodes, containerElement) {
      nodes.forEach(node => {
        if (node.type === 'category') {
          const catBox = document.createElement('div');
          catBox.className = 'tree-category-box';
          catBox.innerHTML = `
            <div class="tree-category-title">
              <span>${node.title}</span>
              <button class="smite-btn-sm edit-only" onclick="openTreeModalForEdit('${node.id}')">✏️</button>
            </div>
            <div class="category-children-container" id="container_${node.id}"></div>
          `;
          containerElement.appendChild(catBox);
          if (node.children) renderTreeNodes(node.children, catBox.querySelector(`#container_${node.id}`));
        } else if (node.type === 'subcategory') {
          const subBox = document.createElement('div');
          subBox.className = 'tree-subcategory-box';
          subBox.innerHTML = `
            <div class="tree-subcategory-title">
              <span>${node.title}</span>
              <button class="smite-btn-sm edit-only" onclick="openTreeModalForEdit('${node.id}')">✏️</button>
            </div>
            <div class="subcategory-children-container" id="container_${node.id}"></div>
          `;
          containerElement.appendChild(subBox);
          if (node.children) renderTreeNodes(node.children, subBox.querySelector(`#container_${node.id}`));
        } else if (node.type === 'line') {
          if (!node.text && (!node.title || node.title.trim() === '')) return;

          const lineCard = document.createElement('div');
          lineCard.className = 'voice-line-item';
          const hasTitle = node.title && node.title.trim() !== '' && node.title.toLowerCase() !== 'sem título';
          lineCard.innerHTML = `
            <div>
              ${hasTitle ? `<div style="color:var(--wiki-gold-title); font-size:0.88rem;">${node.title}</div>` : ''}
              <div style="font-size:0.85rem; color:#cbd5e1;">"${node.text}"</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              ${node.audioUrl ? `<button class="vgs-play-double-btn" onclick="togglePlayAudio('${node.audioUrl}', '${hasTitle ? node.title : node.text}', this)">▶️</button>` : ''}
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
      grid.innerHTML = '';

      if (god.skins) {
        god.skins.forEach((skin, idx) => {
          const isPadrao = !skin.tier || skin.tier.toUpperCase() === 'PADRÃO';
          const cssClass = getTierCssClass(skin.tier);

          const wrapper = document.createElement('div');
          wrapper.className = 'god-card-container';
          wrapper.innerHTML = `
            <button class="card-edit-btn edit-only" onclick="openSkinModal(event, ${idx})">✏️</button>
            <div class="smite-skin-card-wrapper">
              <div class="smite-skin-card" style="--skin-bg-url: url('${skin.img}'); background-image: linear-gradient(180deg, rgba(0,0,0,0.15) 30%, rgba(5,8,15,0.9) 100%), url('${skin.img}');" onclick="selectVpSkinCard(${idx})">
                ${!isPadrao ? `<div class="skin-card-banner ${cssClass}"><span>${skin.tier.toUpperCase()}</span></div>` : '<div></div>'}
              </div>
              <div class="skin-card-bottom-title">${skin.name}</div>
            </div>
          `;
          grid.appendChild(wrapper);
        });
      }
    }

    function selectVpSkinCard(idx) {
      selectedSkinIdx = idx;
      renderVoicebankView();
      switchVPMode('god');
    }

    function renderVgsWikiTables() {
      const container = document.getElementById('vgsTablesList');
      container.innerHTML = '';

      getActiveVgs().forEach((box, boxIdx) => {
        const wikiBox = document.createElement('div');

        const hasAnyAudio = box.rows && box.rows.some(r => r.audioUrl && r.audioUrl.trim() !== '');

        let rowsHtml = '';
        if (box.rows && box.rows.length > 0) {
          box.rows.forEach((row, rowIdx) => {
            const codeClass = row.isCategory ? "vgs-code-cell is-cat-code" : "vgs-code-cell";
            const resultCellClass = row.isCategory ? "vgs-outcome-cell is-category-result" : "vgs-outcome-cell";
            const resultCell = row.isCategory
              ? `<span class="vgs-category-highlight">${row.result}</span>`
              : `<span>${row.result}</span>`;

            let thirdColumnHtml = '';
            if (hasAnyAudio) {
              const audioCellContent = (row.audioUrl && row.audioUrl.trim() !== '')
                ? `<button class="vgs-play-double-btn" onclick="togglePlayAudio('${row.audioUrl}', '${row.result}', this)">▶️</button>` 
                : ``;
              thirdColumnHtml = `<td style="width: 50px; text-align:center;">${audioCellContent}</td>`;
            }

            rowsHtml += `
              <tr>
                <td class="${codeClass}">${row.code}</td>
                <td class="${resultCellClass}" ${hasAnyAudio ? '' : 'colspan="2"'}>${resultCell}</td>
                ${thirdColumnHtml}
                <td class="edit-only" style="width: 35px; text-align:center;">
                  <button style="background:none; border:none; color:var(--wiki-blue-text); cursor:pointer;" onclick="openVgsModalForEdit(${boxIdx}, ${rowIdx})">✏️</button>
                </td>
              </tr>
            `;
          });
        } else {
          rowsHtml = `
            <tr>
              <td colspan="4" style="text-align:center; color:#8392A5; padding: 15px;">Nenhum comando adicionado. Clique no lápis do cabeçalho para adicionar.</td>
            </tr>
          `;
        }

        let thThirdColumn = hasAnyAudio ? `<th style="width: 50px; text-align:center;"></th>` : '';

        wikiBox.innerHTML = `
          <div class="vgs-outside-title">
            <span>${box.boxTitle || 'VGS'} <button style="background:none; border:none; color:var(--wiki-blue-text); font-size:0.9rem; cursor:pointer;" onclick="openVgsModalForEdit(${boxIdx}, null)" class="edit-only">✏️</button></span>
          </div>
          <div class="vgs-wiki-box">
            <table class="vgs-wiki-table">
              <thead>
                <tr>
                  <th style="width: 90px; text-align:left;">VGS</th>
                  <th style="text-align:left;" ${hasAnyAudio ? '' : 'colspan="2"'}>Outcome</th>
                  ${thThirdColumn}
                  <th class="edit-only" style="width: 35px; text-align:center;">
                    <button style="background:none; border:none; color:var(--wiki-blue-text); font-size:0.9rem; cursor:pointer;" onclick="openVgsModalForEdit(${boxIdx}, null)" title="Adicionar Linha">+</button>
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

    function openVgsModalForEdit(boxIdx, rowIdx) {
      const vgsList = getActiveVgs();
      if (boxIdx !== null && boxIdx >= vgsList.length) {
        vgsList.push({ boxTitle: 'NOVA CAIXA VGS', rows: [] });
      }
      if (boxIdx === null || boxIdx >= vgsList.length) boxIdx = 0;

      editingVgsBoxIdx = boxIdx;
      editingVgsRowIdx = rowIdx;
      
      const targetBox = vgsList[boxIdx];
      document.getElementById('modalVgsBoxTitle').value = targetBox.boxTitle || 'VGS';
      document.getElementById('btnDeleteEntireVgsBox').style.display = 'inline-flex';

      if (rowIdx !== null && rowIdx !== undefined && targetBox.rows && targetBox.rows[rowIdx]) {
        const row = targetBox.rows[rowIdx];
        document.getElementById('modalVgsCode').value = row.code;
        document.getElementById('modalVgsResult').value = row.result;
        document.getElementById('modalVgsIsCat').value = row.isCategory ? "true" : "false";
        document.getElementById('btnDeleteVgsRow').style.display = 'inline-flex';
        
        if (row.audioUrl && row.audioUrl.trim() !== '') {
          document.getElementById('btnRemoveAudioFile').style.display = 'inline-flex';
        } else {
          document.getElementById('btnRemoveAudioFile').style.display = 'none';
        }
      } else {
        document.getElementById('modalVgsCode').value = '';
        document.getElementById('modalVgsResult').value = '';
        document.getElementById('modalVgsIsCat').value = "false";
        document.getElementById('btnDeleteVgsRow').style.display = 'none';
        document.getElementById('btnRemoveAudioFile').style.display = 'none';
      }
      document.getElementById('editVgsModal').style.display = 'flex';
    }

    function deleteEntireVgsBox() {
      const vgsList = getActiveVgs();
      if (editingVgsBoxIdx !== null && editingVgsBoxIdx < vgsList.length) {
        vgsList.splice(editingVgsBoxIdx, 1);
        saveStorageData();
        renderVgsWikiTables();
        closeModal('editVgsModal');
      }
    }

    function removeAudioFromVgsRow() {
      const vgsList = getActiveVgs();
      if (editingVgsBoxIdx !== null && editingVgsRowIdx !== null && vgsList[editingVgsBoxIdx]) {
        if (vgsList[editingVgsBoxIdx].rows[editingVgsRowIdx]) {
          vgsList[editingVgsBoxIdx].rows[editingVgsRowIdx].audioUrl = '';
          saveStorageData();
          renderVgsWikiTables();
          document.getElementById('btnRemoveAudioFile').style.display = 'none';
          document.getElementById('modalVgsAudioFile').value = '';
        }
      }
    }

    function saveVgsModal() {
      const vgsList = getActiveVgs();
      const titleInput = document.getElementById('modalVgsBoxTitle').value.trim() || 'VGS';
      const code = document.getElementById('modalVgsCode').value.trim().toUpperCase();
      const result = document.getElementById('modalVgsResult').value.trim();
      const isCat = document.getElementById('modalVgsIsCat').value === "true";
      const file = document.getElementById('modalVgsAudioFile').files[0];

      let targetBox;
      if (editingVgsBoxIdx !== null && editingVgsBoxIdx < vgsList.length) {
        targetBox = vgsList[editingVgsBoxIdx];
        targetBox.boxTitle = titleInput;
      } else {
        targetBox = { boxTitle: titleInput, rows: [] };
        vgsList.push(targetBox);
        editingVgsBoxIdx = vgsList.length - 1;
      }

      if (code && result) {
        if (!targetBox.rows) targetBox.rows = [];
        if (editingVgsRowIdx !== null && editingVgsRowIdx !== undefined && targetBox.rows[editingVgsRowIdx]) {
          const row = targetBox.rows[editingVgsRowIdx];
          row.code = code;
          row.result = result;
          row.isCategory = isCat;
          if (file) {
            const r = new FileReader();
            r.onload = e => {
              row.audioUrl = e.target.result;
              saveStorageData();
              renderVgsWikiTables();
              closeModal('editVgsModal');
            };
            r.readAsDataURL(file);
            return;
          }
        } else {
          const newRow = { code: code, result: result, isCategory: isCat, audioUrl: '' };
          if (file) {
            const r = new FileReader();
            r.onload = e => {
              newRow.audioUrl = e.target.result;
              targetBox.rows.push(newRow);
              saveStorageData();
              renderVgsWikiTables();
              closeModal('editVgsModal');
            };
            r.readAsDataURL(file);
            return;
          } else {
            targetBox.rows.push(newRow);
          }
        }
      }

      saveStorageData();
      renderVgsWikiTables();
      closeModal('editVgsModal');
    }

    function deleteVgsRow() {
      const vgsList = getActiveVgs();
      if (editingVgsBoxIdx !== null && editingVgsRowIdx !== null && vgsList[editingVgsBoxIdx]) {
        vgsList[editingVgsBoxIdx].rows.splice(editingVgsRowIdx, 1);
        saveStorageData();
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
      document.getElementById('modalTreeType').value = 'line';
      document.getElementById('modalTreeTitle').value = '';
      document.getElementById('modalTreeText').value = '';
      document.getElementById('btnDeleteTreeItem').style.display = 'none';
      populateParentDropdown();
      toggleTreeModalFields();
      document.getElementById('voiceCategoryLineModal').style.display = 'flex';
    }

    function openTreeModalForEdit(nodeId) {
      const tree = getActiveTree();
      const node = findNodeInTree(tree, nodeId);
      if (!node) return;

      editingTreeTarget = node;
      document.getElementById('modalTreeType').value = node.type;
      document.getElementById('modalTreeTitle').value = node.title || '';
      document.getElementById('modalTreeText').value = node.text || '';
      document.getElementById('btnDeleteTreeItem').style.display = 'inline-flex';
      populateParentDropdown(nodeId);
      toggleTreeModalFields();
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

    function populateParentDropdown(excludeId = null) {
      const select = document.getElementById('modalTreeParentSelect');
      select.innerHTML = '<option value="root">-- Raiz (Sem Pai) --</option>';
      const tree = getActiveTree();

      function walk(nodes, depth = 0) {
        nodes.forEach(n => {
          if (n.id === excludeId) return;
          if (n.type === 'category' || n.type === 'subcategory') {
            const prefix = '--'.repeat(depth);
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.innerText = `${prefix} ${n.title} (${n.type})`;
            select.appendChild(opt);
            if (n.children) walk(n.children, depth + 1);
          }
        });
      }
      walk(tree);

      if (editingTreeTarget) {
        const parent = findParentNodeInTree(tree, editingTreeTarget.id);
        if (parent) select.value = parent.id;
      }
    }

    function saveTreeModal() {
      const tree = getActiveTree();
      const type = document.getElementById('modalTreeType').value;
      const title = document.getElementById('modalTreeTitle').value.trim();
      const text = document.getElementById('modalTreeText').value.trim();
      const parentId = document.getElementById('modalTreeParentSelect').value;
      const file = document.getElementById('modalTreeAudioFile').files[0];

      if (type === 'line' && !text) {
        alert('Por favor, insira o texto da fala.');
        return;
      }
      if ((type === 'category' || type === 'subcategory') && !title) {
        alert('Por favor, insira o título.');
        return;
      }

      if (editingTreeTarget) {
        removeNodeFromTree(tree, editingTreeTarget.id);
        editingTreeTarget.type = type;
        editingTreeTarget.title = title;
        editingTreeTarget.text = text;

        if (parentId !== 'root') {
          const pNode = findNodeInTree(tree, parentId);
          if (!pNode.children) pNode.children = [];
          pNode.children.push(editingTreeTarget);
        } else {
          tree.push(editingTreeTarget);
        }

        if (file) {
          const r = new FileReader();
          r.onload = e => {
            editingTreeTarget.audioUrl = e.target.result;
            saveStorageData();
            renderVoiceTreePanel();
            closeModal('voiceCategoryLineModal');
          };
          r.readAsDataURL(file);
          return;
        }
      } else {
        const newNode = { id: 'node_' + Date.now(), type: type, title: title, text: text, children: [], audioUrl: '' };
        if (parentId === 'root') {
          tree.push(newNode);
        } else {
          const pNode = findNodeInTree(tree, parentId);
          if (pNode) {
            if (!pNode.children) pNode.children = [];
            pNode.children.push(newNode);
          } else {
            tree.push(newNode);
          }
        }

        if (file) {
          const r = new FileReader();
          r.onload = e => {
            newNode.audioUrl = e.target.result;
            saveStorageData();
            renderVoiceTreePanel();
            closeModal('voiceCategoryLineModal');
          };
          r.readAsDataURL(file);
          return;
        }
      }

      saveStorageData();
      renderVoiceTreePanel();
      closeModal('voiceCategoryLineModal');
    }

    function deleteTreeItem() {
      if (editingTreeTarget) {
        const tree = getActiveTree();
        removeNodeFromTree(tree, editingTreeTarget.id);
        saveStorageData();
        renderVoiceTreePanel();
        closeModal('voiceCategoryLineModal');
      }
    }

    function findNodeInTree(nodes, id) {
      for (let n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          let found = findNodeInTree(n.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    function findParentNodeInTree(nodes, id) {
      for (let n of nodes) {
        if (n.children && n.children.some(c => c.id === id)) return n;
        if (n.children) {
          let found = findParentNodeInTree(n.children, id);
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
          let removed = removeNodeFromTree(nodes[i].children, id);
          if (removed) return true;
        }
      }
      return false;
    }

    function openGodModal(event, idx) {
      if (event) event.stopPropagation();
      editingGodIndex = idx;
      if (idx !== null && idx !== undefined) {
        const god = godsDatabase[idx];
        document.getElementById('godModalTitle').innerText = 'EDITAR DEUS';
        document.getElementById('modalGodName').value = god.name;
        document.getElementById('modalGodTitle').value = god.title;
        document.getElementById('btnDeleteGod').style.display = 'inline-flex';
      } else {
        document.getElementById('godModalTitle').innerText = 'NOVO DEUS';
        document.getElementById('modalGodName').value = '';
        document.getElementById('modalGodTitle').value = '';
        document.getElementById('btnDeleteGod').style.display = 'none';
      }
      document.getElementById('godModal').style.display = 'flex';
    }

    function saveGodModal() {
      const name = document.getElementById('modalGodName').value || 'NOVO DEUS';
      const title = document.getElementById('modalGodTitle').value || 'TÍTULO';
      const fileInput = document.getElementById('modalGodImgFile');

      if (editingGodIndex !== null && editingGodIndex !== undefined) {
        const god = godsDatabase[editingGodIndex];
        god.name = name;
        god.title = title;
        if (fileInput.files[0]) {
          const r = new FileReader();
          r.onload = e => {
            god.img = e.target.result;
            saveStorageData();
            renderRoster();
            closeModal('godModal');
          };
          r.readAsDataURL(fileInput.files[0]);
          return;
        }
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
          dubber: 'Lisa Ortiz',
          releaseDate: '15/09/2016',
          img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&auto=format&fit=crop',
          skins: [],
          voiceTree: []
        };
        if (fileInput.files[0]) {
          const r = new FileReader();
          r.onload = e => {
            newGod.img = e.target.result;
            godsDatabase.push(newGod);
            saveStorageData();
            renderRoster();
            closeModal('godModal');
          };
          r.readAsDataURL(fileInput.files[0]);
          return;
        } else {
          godsDatabase.push(newGod);
        }
      }

      saveStorageData();
      renderRoster();
      closeModal('godModal');
    }

    function deleteCurrentGod() {
      if (editingGodIndex !== null && editingGodIndex !== undefined) {
        godsDatabase.splice(editingGodIndex, 1);
        saveStorageData();
        renderRoster();
        closeModal('godModal');
      }
    }

    function openAboutModal() {
      const god = godsDatabase[selectedGodIdx];
      document.getElementById('aboutPantheonName').value = god.pantheon || '';
      document.getElementById('aboutTypeName').value = god.type || '';
      document.getElementById('aboutClassName').value = god.class || '';
      document.getElementById('aboutQuote').value = god.miniQuote || '';
      document.getElementById('aboutDifficulty').value = god.difficulty || '';
      document.getElementById('aboutModal').style.display = 'flex';
    }

    function saveAboutModal() {
      const god = godsDatabase[selectedGodIdx];
      god.pantheon = document.getElementById('aboutPantheonName').value;
      god.type = document.getElementById('aboutTypeName').value;
      god.class = document.getElementById('aboutClassName').value;
      god.miniQuote = document.getElementById('aboutQuote').value;
      god.difficulty = document.getElementById('aboutDifficulty').value;

      const pFile = document.getElementById('aboutPantheonImgFile').files[0];
      const tFile = document.getElementById('aboutTypeImgFile').files[0];
      const cFile = document.getElementById('aboutClassImgFile').files[0];

      let pending = 0;
      const checkDone = () => {
        pending--;
        if (pending <= 0) {
          saveStorageData();
          renderGodView();
          closeModal('aboutModal');
        }
      };

      if (pFile) {
        pending++;
        const r = new FileReader();
        r.onload = e => { god.pantheonImg = e.target.result; checkDone(); };
        r.readAsDataURL(pFile);
      }
      if (tFile) {
        pending++;
        const r = new FileReader();
        r.onload = e => { god.typeImg = e.target.result; checkDone(); };
        r.readAsDataURL(tFile);
      }
      if (cFile) {
        pending++;
        const r = new FileReader();
        r.onload = e => { god.classImg = e.target.result; checkDone(); };
        r.readAsDataURL(cFile);
      }

      if (pending === 0) {
        saveStorageData();
        renderGodView();
        closeModal('aboutModal');
      }
    }

    function openLoreModal() {
      document.getElementById('loreTextarea').value = godsDatabase[selectedGodIdx].lore || '';
      document.getElementById('loreModal').style.display = 'flex';
    }

    function saveLoreModal() {
      godsDatabase[selectedGodIdx].lore = document.getElementById('loreTextarea').value;
      saveStorageData();
      renderGodView();
      closeModal('loreModal');
    }

    function openSkinModal(event, idx) {
      if(event) event.stopPropagation();
      editingSkinIndex = idx;
      if (idx !== null && idx !== undefined) {
        const skin = godsDatabase[selectedGodIdx].skins[idx];
        document.getElementById('modalSkinName').value = skin.name;
        document.getElementById('modalSkinTier').value = (skin.tier || 'PADRÃO').toUpperCase();
        document.getElementById('btnDeleteSkinCard').style.display = 'inline-flex';
      } else {
        document.getElementById('modalSkinName').value = 'Nova Skin';
        document.getElementById('modalSkinTier').value = 'EXCLUSIVO';
        document.getElementById('btnDeleteSkinCard').style.display = 'none';
      }
      document.getElementById('editSkinModal').style.display = 'flex';
    }

    function saveSkinModal() {
      const god = godsDatabase[selectedGodIdx];
      if(!god.skins) god.skins = [];
      const name = document.getElementById('modalSkinName').value;
      const tier = document.getElementById('modalSkinTier').value;
      const fileInput = document.getElementById('modalSkinImgFile');

      if (editingSkinIndex !== null && editingSkinIndex !== undefined) {
        const skin = god.skins[editingSkinIndex];
        skin.name = name;
        skin.tier = tier;
        if (fileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = e => {
            skin.img = e.target.result;
            saveStorageData();
            renderSkinsTab();
            renderVpSkinCardsPanel();
            closeModal('editSkinModal');
          };
          reader.readAsDataURL(fileInput.files[0]);
          return;
        }
      } else {
        const newSkin = { id: 'skin_' + Date.now(), name: name, tier: tier, img: god.img };
        if (fileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = e => {
            newSkin.img = e.target.result;
            god.skins.push(newSkin);
            saveStorageData();
            renderSkinsTab();
            renderVpSkinCardsPanel();
            closeModal('editSkinModal');
          };
          reader.readAsDataURL(fileInput.files[0]);
          return;
        } else {
          god.skins.push(newSkin);
        }
      }

      saveStorageData();
      renderSkinsTab();
      renderVpSkinCardsPanel();
      closeModal('editSkinModal');
    }

    function deleteCurrentSkinCard() {
      if (editingSkinIndex !== null && editingSkinIndex !== undefined) {
        godsDatabase[selectedGodIdx].skins.splice(editingSkinIndex, 1);
        saveStorageData();
        renderSkinsTab();
        renderVpSkinCardsPanel();
        closeModal('editSkinModal');
      }
    }

    function openSettingsModal() {
      document.getElementById('settingsModal').style.display = 'flex';
    }

    function closeModal(id) {
      document.getElementById(id).style.display = 'none';
    }

    function toggleEditModeSimple() {
      isEditMode = !isEditMode;
      const btn = document.getElementById('editToggleBtn');
      if (isEditMode) {
        document.getElementById('smite-app').classList.remove('edit-mode-off');
        btn.innerText = 'ON';
      } else {
        document.getElementById('smite-app').classList.add('edit-mode-off');
        btn.innerText = 'OFF';
      }
    }

    let audioVolume = 1.0;

    function updateAudioVolume(val) {
      audioVolume = val / 100;
      document.getElementById('volumeValText').innerText = val + '%';
      if (activeAudioInstance) {
        activeAudioInstance.volume = audioVolume;
      }
      localStorage.setItem('smite_audio_volume', audioVolume);
    }

    function getActiveVgs() {
      const god = godsDatabase[selectedGodIdx];
      const hasSkinSelected = (selectedSkinIdx > 0 && god.skins && god.skins[selectedSkinIdx]);
      const targetObj = hasSkinSelected ? god.skins[selectedSkinIdx] : god;
      if (!targetObj.vgsDatabase) {
        targetObj.vgsDatabase = [
          {
            boxTitle: 'VV - Other',
            rows: [
              { code: 'G', result: 'General', isCategory: true, audioUrl: '' },
              { code: 'V', result: 'Position', isCategory: true, audioUrl: '' },
              { code: 'A', result: '"Ok!"', isCategory: false, audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
              { code: 'B', result: '"Be right back!"', isCategory: false, audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' }
            ]
          }
        ];
      }
      return targetObj.vgsDatabase;
    }

    function togglePlayAudio(url, titleText, btnElement) {
      if (!url) return;

      if (activeAudioInstance) {
        if (activePlayButtonElement === btnElement) {
          if (!activeAudioInstance.paused) {
            activeAudioInstance.pause();
            btnElement.classList.remove('playing');
            btnElement.innerText = '▶️';
            document.getElementById('statusAudio').innerText = "De [PLAY] para escutar.";
            return;
          } else {
            activeAudioInstance.play().then(() => {
              btnElement.classList.add('playing');
              btnElement.innerText = '⏸️';
              document.getElementById('statusAudio').innerText = `REPRODUZINDO: ${titleText}`;
            }).catch(e => console.log(e));
            return;
          }
        } else {
          activeAudioInstance.pause();
          activeAudioInstance.currentTime = 0;
          if (activePlayButtonElement) {
            activePlayButtonElement.classList.remove('playing');
            activePlayButtonElement.innerText = '▶️';
          }
        }
      }

      const audio = new Audio(url);
      audio.volume = audioVolume;
      activeAudioInstance = audio;
      activePlayButtonElement = btnElement;

      btnElement.classList.add('playing');
      btnElement.innerText = '⏸️';
      document.getElementById('statusAudio').innerText = `REPRODUZINDO: ${titleText}`;

      audio.play().catch(e => {
        console.log(e);
        btnElement.classList.remove('playing');
        btnElement.innerText = '▶️';
      });

      audio.onended = () => {
        btnElement.classList.remove('playing');
        btnElement.innerText = '▶️';
        document.getElementById('statusAudio').innerText = "De [PLAY] para escutar.";
        activeAudioInstance = null;
        activePlayButtonElement = null;
      };
    }
  