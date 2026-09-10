// 網頁狀態、畫面更新、事件與版本檢查

const $ = id => document.getElementById(id);
let currentPoints = [];
let visualMode = 'coord';


function updateOutput(){
  if ($('fruitForwardOutput')) $('fruitForwardOutput').textContent = buildFruitGPX(currentPoints);
  if ($('fruitReverseOutput')) $('fruitReverseOutput').textContent = buildFruitGPX(reversed(currentPoints));
  if ($('flowerForwardOutput')) $('flowerForwardOutput').textContent = buildFlowerGPX(currentPoints);
  if ($('flowerReverseOutput')) $('flowerReverseOutput').textContent = buildFlowerGPX(reversed(currentPoints));
  if ($('coordGpxForwardOutput')) $('coordGpxForwardOutput').textContent = buildCoordGPX(currentPoints);
  if ($('coordGpxReverseOutput')) $('coordGpxReverseOutput').textContent = buildCoordGPX(reversed(currentPoints));
  if ($('coordForwardOutput')) $('coordForwardOutput').textContent = buildCoords(currentPoints);
  if ($('coordReverseOutput')) $('coordReverseOutput').textContent = buildCoords(reversed(currentPoints));
  const offsetPoints = getOffsetPoints(currentPoints);
  if ($('offsetGpxForwardOutput')) $('offsetGpxForwardOutput').textContent = buildCoordGPX(offsetPoints);
  if ($('offsetGpxReverseOutput')) $('offsetGpxReverseOutput').textContent = buildCoordGPX(reversed(offsetPoints));
  if ($('offsetForwardOutput')) $('offsetForwardOutput').textContent = buildCoords(offsetPoints);
  if ($('offsetReverseOutput')) $('offsetReverseOutput').textContent = buildCoords(reversed(offsetPoints));
  syncOutputViewer();
}

function getVisualPoints(){
  if (visualMode === 'fruit') return generateFruitPoints(currentPoints);
  if (visualMode === 'flower') return generateFlowerPoints(currentPoints);
  return currentPoints;
}

function getVisualPointLabel(index){
  if (visualMode === 'fruit') {
    const sourceIndex = Math.floor(index / 3) + 1;
    return `P${sourceIndex}-${['L','M','R'][index % 3]}`;
  }
  if (visualMode === 'flower') return getFlowerPointName(index);
  return String(index + 1);
}

function draw(){
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const visualPoints = getVisualPoints();

  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#222528';
  ctx.fillRect(0,0,w,h);

  if (!visualPoints.length) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('請先輸入座標並按「分析排序」', w/2, h/2);
    return;
  }

  const b = bounds(visualPoints);
  const pad = 70;
  const lonR = b.maxLon - b.minLon || 0.0001;
  const latR = b.maxLat - b.minLat || 0.0001;
  const scale = Math.min((w - pad * 2) / lonR, (h - pad * 2) / latR);
  const usedW = lonR * scale;
  const usedH = latR * scale;
  const ox = (w - usedW) / 2;
  const oy = (h - usedH) / 2;

  const xy = p => ({
    x: ox + (p.lon - b.minLon) * scale,
    y: oy + (b.maxLat - p.lat) * scale
  });

  ctx.strokeStyle = 'rgba(255,255,255,.09)';
  ctx.lineWidth = 1;
  for (let x = pad; x < w - pad; x += 45) {
    ctx.beginPath(); ctx.moveTo(x,pad); ctx.lineTo(x,h-pad); ctx.stroke();
  }
  for (let y = pad; y < h - pad; y += 45) {
    ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke();
  }

  const cx = w / 2, cy = h / 2;
  ctx.setLineDash([9,8]);
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, pad/2); ctx.lineTo(cx, h-pad/2);
  ctx.moveTo(pad/2, cy); ctx.lineTo(w-pad/2, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('緯度（北）↑', cx, 30);
  ctx.fillText('緯度（南）↓', cx, h - 25);
  ctx.textAlign = 'left';
  ctx.fillText('經度（西）←', 24, cy - 8);
  ctx.textAlign = 'right';
  ctx.fillText('經度（東）→', w - 24, cy - 8);

  ctx.setLineDash([8,8]);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#ffd84d';
  ctx.lineWidth = visualMode === 'coord' ? 4 : 2.5;
  ctx.beginPath();
  visualPoints.forEach((p,i)=>{
    const q = xy(p);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  if (getRouteMode() === 'shortest' && visualPoints.length > 1) {
    const first = xy(visualPoints[0]);
    ctx.lineTo(first.x, first.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const pointRadius = visualMode === 'coord' ? 12 : (visualMode === 'fruit' ? 7 : 5);
  visualPoints.forEach((p,i)=>{
    const q = xy(p);
    ctx.beginPath();
    ctx.arc(q.x, q.y, pointRadius, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#55d46b' : i === visualPoints.length - 1 ? '#ef594d' : '#6659de';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.stroke();

    if ((document.querySelector('input[name="labelMode"]:checked')?.value || 'show') === 'show') {
      ctx.fillStyle = '#fff';
      ctx.font = visualMode === 'coord' ? 'bold 19px sans-serif' : 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.lineWidth = visualMode === 'coord' ? 4 : 3;
      const label = getVisualPointLabel(i);
      const labelY = q.y - pointRadius - 7;
      ctx.strokeText(label, q.x, labelY);
      ctx.fillText(label, q.x, labelY);
    }
  });
}
function renderDragList(){
  const list = $('pointList');
  list.innerHTML = '';
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  currentPoints.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'dragItem';
    item.draggable = !isTouch;
    item.dataset.index = i;

    item.innerHTML = `
      <span class="dragHandle" title="拖曳排序" aria-label="拖曳第 ${i + 1} 筆">☰</span>
      <span class="dragNum">${String(i + 1).padStart(2, '0')}</span>
      <span class="dragCoord">${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</span>
      <span class="dragActions sortActions">
        <button class="moveBtn" type="button" data-action="first" title="移至頂端" aria-label="第 ${i + 1} 筆移至頂端" ${i === 0 ? 'disabled' : ''}>⤒</button>
        <button class="moveBtn" type="button" data-action="up" title="往上移動" aria-label="第 ${i + 1} 筆往上移動" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="moveBtn" type="button" data-action="down" title="往下移動" aria-label="第 ${i + 1} 筆往下移動" ${i === currentPoints.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="moveBtn" type="button" data-action="last" title="移至底端" aria-label="第 ${i + 1} 筆移至底端" ${i === currentPoints.length - 1 ? 'disabled' : ''}>⤓</button>
      </span>
      <span class="moveToRow">
        <span>移到第</span>
        <input class="moveToInput" type="number" min="1" max="${currentPoints.length}" value="${i + 1}" inputmode="numeric" aria-label="移到指定位置">
        <button class="moveBtn moveToConfirm" type="button">移動</button>
      </span>`;

    const handle = item.querySelector('.dragHandle');
    let dragArmed = false;
    handle?.addEventListener('mousedown', () => { dragArmed = true; });
    item.addEventListener('dragstart', e => {
      if (!dragArmed) {
        e.preventDefault();
        return;
      }
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      dragArmed = false;
      item.classList.remove('dragging');
      applyDragOrder();
    });

    item.querySelector('.dragCoord').addEventListener('click', () => {
      item.classList.toggle('selected');
    });

    item.querySelectorAll('.sortActions .moveBtn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        movePointByAction(i, btn.dataset.action);
      });
    });

    item.querySelector('.moveToConfirm').addEventListener('click', e => {
      e.stopPropagation();
      const input = item.querySelector('.moveToInput');
      movePointTo(i, Number(input.value) - 1);
    });

    list.appendChild(item);
  });
}


function commitManualOrder(next){
  currentPoints = next.map((p, i) => ({...p, num: i + 1}));
  updateAfterManualOrder();
}

function movePointTo(fromIndex, toIndex){
  const n = currentPoints.length;
  if (!n) return;
  const target = Math.max(0, Math.min(n - 1, Number.isFinite(toIndex) ? toIndex : fromIndex));
  if (target === fromIndex) return;
  const next = currentPoints.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(target, 0, moved);
  commitManualOrder(next);
}

function movePointByAction(index, action){
  if (action === 'first') return movePointTo(index, 0);
  if (action === 'up') return movePointTo(index, index - 1);
  if (action === 'down') return movePointTo(index, index + 1);
  if (action === 'last') return movePointTo(index, currentPoints.length - 1);
}

function getDragAfterElement(container, y){
  const draggableElements = [...container.querySelectorAll('.dragItem:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function applyDragOrder(){
  const items = [...$('pointList').querySelectorAll('.dragItem')];
  const next = items.map(item => currentPoints[Number(item.dataset.index)]);
  currentPoints = next.map((p, i) => ({...p, num: i + 1}));
  updateAfterManualOrder();
}

function updateAfterManualOrder(){
  renderDragList();
  updateStats();
  updateOutput();
  draw();
}


function formatCountBasedMinutes(pointCount, secondsPerPoint = 4){
  if (!Number.isFinite(pointCount) || pointCount <= 0) return '-';
  const totalSeconds = Math.round(pointCount * secondsPerPoint);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} 分 ${seconds} 秒`;
}

function updateStats(){
  if (!currentPoints.length) {
    $('sCount').textContent = '0 個';
    if ($('sFruitTime')) $('sFruitTime').textContent = '-';
    if ($('sFlowerTime')) $('sFlowerTime').textContent = '-';
    return;
  }

  const fruitCount = generateFruitPoints(currentPoints).length;
  const flowerCount = generateFlowerPoints(currentPoints).length;

  $('sCount').textContent = currentPoints.length + ' 個';
  if ($('sFruitTime')) $('sFruitTime').textContent = formatCountBasedMinutes(fruitCount, 4);
  if ($('sFlowerTime')) {
    const flowerSecondsPerPoint = getFlowerMode() === 'north33' ? 1 : 3;
    $('sFlowerTime').textContent = formatCountBasedMinutes(flowerCount, flowerSecondsPerPoint);
  }
}

function initDragList(){
  const list = $('pointList');
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(list, e.clientY);
    const dragging = document.querySelector('.dragging');
    if (!dragging) return;
    if (afterElement == null) list.appendChild(dragging);
    else list.insertBefore(dragging, afterElement);
  });
}

function analyze(){
  // Google Spreadsheet 複製座標時可能自動夾帶雙引號；分析前統一移除。
  const raw = $('input').value.replace(/[\"“”＂]/g, '').trim();
  $('input').value = raw;
  const parsedPoints = parsePoints(raw);
  const pts = removeDuplicatePoints(parsedPoints);
  const duplicateCount = parsedPoints.length - pts.length;

  if (!pts.length) {
    $('msg').textContent = '沒有找到可用座標。';
    currentPoints = [];
    $('pointList').innerHTML = '';
    ['fruitForwardOutput','fruitReverseOutput','flowerForwardOutput','flowerReverseOutput','coordGpxForwardOutput','coordGpxReverseOutput','coordForwardOutput','coordReverseOutput','offsetGpxForwardOutput','offsetGpxReverseOutput','offsetForwardOutput','offsetReverseOutput'].forEach(id => { if ($(id)) $(id).textContent = ''; });
    updateStats();
    draw();
    return;
  }

  currentPoints = orderPoints(pts);
  syncOffsetPointMap(currentPoints);
  renderDragList();
  updateStats();
  const flowerModeLabel = getFlowerMode() === 'north33' ? '33 點北向圓形' : '15 點自動旋轉';
  const duplicateMessage = duplicateCount > 0 ? '；已移除 ' + duplicateCount + ' 筆重複座標' : '';
  $('msg').textContent = '完成，共 ' + currentPoints.length + ' 個原始點位' + duplicateMessage + '；收果版會展開為 ' + generateFruitPoints(currentPoints).length + ' 個跳點；種花版目前使用「' + flowerModeLabel + '」，共展開為 ' + generateFlowerPoints(currentPoints).length + ' 個跳點。';
  updateOutput();
  draw();
}


function loadSortDemo(){
  $('input').value = `25.049805,121.295112
25.050127,121.294684
25.049566,121.294193
25.048997,121.294512
25.048721,121.295084
25.049218,121.295642`;
  if ($('autoRoute')) $('autoRoute').checked = false;
  const pastedMode = document.querySelector('input[name="routeMode"][value="paste"]');
  if (pastedMode) pastedMode.checked = true;
  analyze();
  $('msg').textContent = '已載入 6 筆排序示範座標，可直接測試上下移、最前、最後、指定位置與桌機拖曳。';
}

$('analyzeBtn').onclick = analyze;

function clearAll(){
  if ($('input')) $('input').value = '';
  currentPoints = [];
  offsetPointMap.clear();
  if ($('pointList')) $('pointList').innerHTML = '';
  ['fruitForwardOutput','fruitReverseOutput','flowerForwardOutput','flowerReverseOutput','coordGpxForwardOutput','coordGpxReverseOutput','coordForwardOutput','coordReverseOutput','offsetGpxForwardOutput','offsetGpxReverseOutput','offsetForwardOutput','offsetReverseOutput'].forEach(id => { if ($(id)) $(id).textContent = ''; });
  updateStats();
  if ($('msg')) $('msg').textContent = '已清空輸入內容。';
  draw();
}

if ($('clearBtn')) $('clearBtn').onclick = clearAll;

async function pasteFromClipboard(){
  const input = $('input');
  if (!input) return;

  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      $('msg').textContent = '剪貼簿目前沒有可貼上的文字內容。';
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    const isMobileInput = window.matchMedia('(max-width: 980px), (pointer: coarse)').matches;

    if (isMobileInput) {
      // 手機版貼上完成後移除焦點，讓螢幕鍵盤自動收起。
      input.setSelectionRange(pos, pos);
      input.blur();
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } else {
      // 桌機版保留游標位置，方便繼續編輯。
      input.focus();
      input.setSelectionRange(pos, pos);
    }

    $('msg').textContent = '已貼上剪貼簿內容。';
  } catch (err) {
    $('msg').textContent = '無法讀取剪貼簿。請確認瀏覽器權限，或改用 Ctrl+V 貼上。';
  }
}

if ($('pasteBtn')) $('pasteBtn').onclick = pasteFromClipboard;


$('copyFruitBtn').onclick = async () => {
  if (!currentPoints.length) analyze();
  const text = buildFruitGPX(currentPoints);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  $('msg').textContent = '已複製收果版。';
};

$('copyFlowerBtn').onclick = async () => {
  if (!currentPoints.length) analyze();
  const text = buildFlowerGPX(currentPoints);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  $('msg').textContent = '已複製種花版。';
};

if ($('copyFruitQuickReverseBtn')) $('copyFruitQuickReverseBtn').onclick = () => copyOut(buildFruitGPX(reversed(currentPoints)), '已複製收果版GPX格式（反向）。');
if ($('copyFlowerQuickReverseBtn')) $('copyFlowerQuickReverseBtn').onclick = () => copyOut(buildFlowerGPX(reversed(currentPoints)), '已複製種花版GPX格式（反向）。');
if ($('copyCoordGpxQuickForwardBtn')) $('copyCoordGpxQuickForwardBtn').onclick = () => copyOut(buildCoordGPX(currentPoints), '已複製純座標GPX格式（正向）。');
if ($('copyCoordGpxQuickReverseBtn')) $('copyCoordGpxQuickReverseBtn').onclick = () => copyOut(buildCoordGPX(reversed(currentPoints)), '已複製純座標GPX格式（反向）。');
if ($('copyCoordQuickForwardBtn')) $('copyCoordQuickForwardBtn').onclick = () => copyOut(buildCoords(currentPoints), '已複製純座標格式（正向）。');
if ($('copyCoordQuickReverseBtn')) $('copyCoordQuickReverseBtn').onclick = () => copyOut(buildCoords(reversed(currentPoints)), '已複製純座標格式（反向）。');
if ($('copyOffsetGpxForwardBtn')) $('copyOffsetGpxForwardBtn').onclick = () => copyOut(buildCoordGPX(getOffsetPoints(currentPoints)), '已複製偏移座標GPX格式（正向）。');
if ($('copyOffsetGpxReverseBtn')) $('copyOffsetGpxReverseBtn').onclick = () => copyOut(buildCoordGPX(reversed(getOffsetPoints(currentPoints))), '已複製偏移座標GPX格式（反向）。');
if ($('copyOffsetForwardBtn')) $('copyOffsetForwardBtn').onclick = () => copyOut(buildCoords(getOffsetPoints(currentPoints)), '已複製偏移座標格式（正向）。');
if ($('copyOffsetReverseBtn')) $('copyOffsetReverseBtn').onclick = () => copyOut(buildCoords(reversed(getOffsetPoints(currentPoints))), '已複製偏移座標格式（反向）。');

if ($('downloadBtn')) $('downloadBtn').onclick = () => {
  if (!currentPoints.length) analyze();
  if (!currentPoints.length) return;
  const blob = new Blob([buildFruitGPX(currentPoints)], {type:'application/gpx+xml;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = generateFileName();
  a.click();
  URL.revokeObjectURL(a.href);
};


if ($('downloadFruitForwardBtn')) $('downloadFruitForwardBtn').onclick = () => downloadGenerated('fruit', 'forward');
if ($('downloadFruitReverseBtn')) $('downloadFruitReverseBtn').onclick = () => downloadGenerated('fruit', 'reverse');
if ($('downloadFlowerForwardBtn')) $('downloadFlowerForwardBtn').onclick = () => downloadGenerated('flower', 'forward');
if ($('downloadFlowerReverseBtn')) $('downloadFlowerReverseBtn').onclick = () => downloadGenerated('flower', 'reverse');
if ($('downloadCoordGpxForwardBtn')) $('downloadCoordGpxForwardBtn').onclick = () => downloadGenerated('coordGpx', 'forward');
if ($('downloadCoordGpxReverseBtn')) $('downloadCoordGpxReverseBtn').onclick = () => downloadGenerated('coordGpx', 'reverse');
if ($('downloadCoordForwardBtn')) $('downloadCoordForwardBtn').onclick = () => downloadGenerated('coord', 'forward');
if ($('downloadCoordReverseBtn')) $('downloadCoordReverseBtn').onclick = () => downloadGenerated('coord', 'reverse');
if ($('downloadOffsetGpxForwardBtn')) $('downloadOffsetGpxForwardBtn').onclick = () => downloadGenerated('offsetGpx', 'forward');
if ($('downloadOffsetGpxReverseBtn')) $('downloadOffsetGpxReverseBtn').onclick = () => downloadGenerated('offsetGpx', 'reverse');
if ($('downloadOffsetForwardBtn')) $('downloadOffsetForwardBtn').onclick = () => downloadGenerated('offset', 'forward');
if ($('downloadOffsetReverseBtn')) $('downloadOffsetReverseBtn').onclick = () => downloadGenerated('offset', 'reverse');


document.querySelectorAll('.visualModeBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    visualMode = btn.dataset.visualMode || 'coord';
    document.querySelectorAll('.visualModeBtn').forEach(x => x.classList.toggle('active', x === btn));
    draw();
  });
});

$('pngBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = $('canvas').toDataURL('image/png');
  a.download = `GPX_route_preview_${visualMode}.png`;
  a.click();
};

function updateFlowerModeDescription(){
  const description = $('flowerModeDescription');
  if (!description) return;

  if (getFlowerMode() === 'north33') {
    description.innerHTML = '每個原始座標依序產生 33 個種花點：中心點 → 向北約 10 公尺 → 向北約 20 公尺 → 單圈 30 點。適合移動 CD 為每點 1 秒的程式；每株約 33 秒。';
  } else {
    description.innerHTML = '每個原始座標產生 15 個種花點：外圈 12 點 → 內側入口點 → 中心點 → 內側出口點。適合移動 CD 為每點 3 秒的程式；每株約 45 秒。';
  }
}

document.querySelectorAll('input[name="flowerMode"]').forEach(input => {
  input.addEventListener('change', () => {
    updateFlowerModeDescription();
    if (currentPoints.length || $('input').value.trim()) analyze();
    else {
      updateStats();
      updateOutput();
    }
  });
});

document.querySelectorAll('input[name="routeMode"]').forEach(input => {
  input.addEventListener('change', () => {
    if (currentPoints.length || $('input').value.trim()) analyze();
    else draw();
  });
});

document.querySelectorAll('input[name="labelMode"]').forEach(input => {
  input.addEventListener('change', () => {
    if (currentPoints.length || $('input').value.trim()) analyze();
    else draw();
  });
});



async function copyOut(text, msg){
  if (!currentPoints.length) analyze();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  $('msg').textContent = msg;
}

if ($('copyFruitForwardBtn')) $('copyFruitForwardBtn').onclick = () => copyOut(buildFruitGPX(currentPoints), '已複製收果版GPX格式（正向）。');
if ($('copyFruitReverseBtn')) $('copyFruitReverseBtn').onclick = () => copyOut(buildFruitGPX(reversed(currentPoints)), '已複製收果版GPX格式（反向）。');
if ($('copyFlowerForwardBtn')) $('copyFlowerForwardBtn').onclick = () => copyOut(buildFlowerGPX(currentPoints), '已複製種花版GPX格式（正向）。');
if ($('copyFlowerReverseBtn')) $('copyFlowerReverseBtn').onclick = () => copyOut(buildFlowerGPX(reversed(currentPoints)), '已複製種花版GPX格式（反向）。');
if ($('copyCoordGpxForwardBtn')) $('copyCoordGpxForwardBtn').onclick = () => copyOut(buildCoordGPX(currentPoints), '已複製純座標GPX格式（正向）。');
if ($('copyCoordGpxReverseBtn')) $('copyCoordGpxReverseBtn').onclick = () => copyOut(buildCoordGPX(reversed(currentPoints)), '已複製純座標GPX格式（反向）。');
if ($('copyCoordForwardBtn')) $('copyCoordForwardBtn').onclick = () => copyOut(buildCoords(currentPoints), '已複製純座標格式（正向）。');
if ($('copyCoordReverseBtn')) $('copyCoordReverseBtn').onclick = () => copyOut(buildCoords(reversed(currentPoints)), '已複製純座標格式（反向）。');


function bindCollapseToggle(headerId, buttonId, contentId, sectionName){
  const header = $(headerId);
  const btn = $(buttonId);
  const content = $(contentId);
  if (!header || !btn || !content) return;

  const syncState = () => {
    const collapsed = content.classList.contains('collapsed');
    btn.textContent = collapsed ? '▼' : '▲';
    header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-label', collapsed ? `展開${sectionName}` : `收縮${sectionName}`);
  };

  const toggle = () => {
    content.classList.toggle('collapsed');
    syncState();
  };

  header.addEventListener('click', toggle);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  syncState();
}

bindCollapseToggle('paramHeader', 'toggleParamBtn', 'paramContent', '參數設定');
bindCollapseToggle('inputHeader', 'toggleInputBtn', 'inputContent', '輸入內容');
bindCollapseToggle('copyHeader', 'toggleCopyBtn', 'copyContent', '座標複製區');
bindCollapseToggle('downloadHeader', 'toggleDownloadBtn', 'downloadContent', '座標下載區');
bindCollapseToggle('visualHeader', 'toggleVisualBtn', 'visualContent', '路徑視覺化');
bindCollapseToggle('outputHeader', 'toggleOutputBtn', 'outputContent', '轉換輸出');


let selectedOutputType = 'fruit';
let selectedOutputDirection = 'forward';
const OUTPUT_VIEW_MAP = {
  fruit:{label:'收果版',forward:'fruitForwardOutput',reverse:'fruitReverseOutput'},
  flower:{label:'種花版',forward:'flowerForwardOutput',reverse:'flowerReverseOutput'},
  coordGpx:{label:'純座標 GPX',forward:'coordGpxForwardOutput',reverse:'coordGpxReverseOutput'},
  coord:{label:'純座標',forward:'coordForwardOutput',reverse:'coordReverseOutput'},
  offsetGpx:{label:'偏移座標 GPX',forward:'offsetGpxForwardOutput',reverse:'offsetGpxReverseOutput'},
  offset:{label:'偏移座標',forward:'offsetForwardOutput',reverse:'offsetReverseOutput'}
};
function syncOutputViewer(){
  const config = OUTPUT_VIEW_MAP[selectedOutputType];
  if (!config) return;
  const source = $(config[selectedOutputDirection]);
  if ($('outputViewerBox')) $('outputViewerBox').textContent = source ? source.textContent : '';
  if ($('outputViewerTitle')) $('outputViewerTitle').textContent = `${config.label}（${selectedOutputDirection === 'forward' ? '正向' : '反向'}）`;
  document.querySelectorAll('[data-output-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputType === selectedOutputType));
  document.querySelectorAll('[data-output-direction]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputDirection === selectedOutputDirection));
}
document.querySelectorAll('[data-output-type]').forEach(btn => btn.addEventListener('click', () => {selectedOutputType = btn.dataset.outputType; syncOutputViewer();}));
document.querySelectorAll('[data-output-direction]').forEach(btn => btn.addEventListener('click', () => {selectedOutputDirection = btn.dataset.outputDirection; syncOutputViewer();}));




// ===== GitHub Pages 網站版本檢查 =====
// 參考「妖妖開花公告」：比較目前發布 HTML 的內容指紋，不需要另外維護版本號。
// 此工具頁更新頻率較低，因此僅在前景每 15 分鐘檢查一次；切回分頁時也會立即檢查一次。
const SITE_UPDATE_CHECK_INTERVAL = 15 * 60 * 1000;
let publishedPageFingerprint = null;
let siteUpdateTimer = null;
let siteUpdateDetected = false;
let siteUpdateChecking = false;

function hashText(text){
  let hash = 2166136261;
  for(let i=0;i<text.length;i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash,16777619);
  }
  return (hash >>> 0).toString(16);
}

async function getPublishedPageFingerprint(){
  if(!/^https?:$/.test(window.location.protocol)) return null;
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('_updateCheck', Date.now());
  const response = await fetch(url.toString(), {method:'GET',cache:'no-store'});
  if(!response.ok) throw new Error(`版本檢查 HTTP ${response.status}`);
  return hashText(await response.text());
}

function showSiteUpdateBanner(){
  if(siteUpdateDetected) return;
  siteUpdateDetected = true;
  const banner = $('siteUpdateBanner');
  if(banner) banner.classList.add('active');
  stopSiteUpdateTimer();
}

async function checkForSiteUpdate({initialize=false}={}){
  if(siteUpdateDetected || siteUpdateChecking) return;
  if(!initialize && document.visibilityState !== 'visible') return;
  siteUpdateChecking = true;
  try{
    const fingerprint = await getPublishedPageFingerprint();
    if(!fingerprint) return;
    if(!publishedPageFingerprint || initialize){
      publishedPageFingerprint = fingerprint;
      return;
    }
    if(fingerprint === publishedPageFingerprint) return;

    // GitHub Pages / CDN 剛發布時可能短暫不一致，再確認一次避免誤判。
    await new Promise(resolve => setTimeout(resolve,3000));
    if(document.visibilityState !== 'visible' || siteUpdateDetected) return;
    const confirmFingerprint = await getPublishedPageFingerprint();
    if(confirmFingerprint === fingerprint && confirmFingerprint !== publishedPageFingerprint){
      showSiteUpdateBanner();
    }
  }catch(error){
    console.debug('網站版本檢查失敗',error);
  }finally{
    siteUpdateChecking = false;
  }
}

function stopSiteUpdateTimer(){
  if(siteUpdateTimer !== null){clearInterval(siteUpdateTimer);siteUpdateTimer=null;}
}

function startSiteUpdateTimer(){
  stopSiteUpdateTimer();
  if(document.visibilityState !== 'visible' || siteUpdateDetected) return;
  siteUpdateTimer = setInterval(() => checkForSiteUpdate(), SITE_UPDATE_CHECK_INTERVAL);
}

if($('reloadLatestBtn')) $('reloadLatestBtn').addEventListener('click',()=>{
  const url = new URL(window.location.href);
  url.searchParams.set('_latest',Date.now());
  window.location.replace(url.toString());
});

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState === 'visible'){
    checkForSiteUpdate();
    startSiteUpdateTimer();
  }else{
    stopSiteUpdateTimer();
  }
});

if ($('backToTopBtn')) $('backToTopBtn').onclick = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

initDragList();
updateFlowerModeDescription();
syncOutputViewer();
draw();
checkForSiteUpdate({initialize:true}).finally(startSiteUpdateTimer);
