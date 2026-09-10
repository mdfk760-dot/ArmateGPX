// GPX 產生、種花/收果展開與下載檔案處理

function escapeXml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}


const FRUIT_OFFSETS = [
  [0.000000, -0.000045],
  [0.000000,  0.000000],
  [0.000000,  0.000045],
];

function generateFruitPoints(pts){
  const out = [];
  pts.forEach(p => {
    FRUIT_OFFSETS.forEach(offset => out.push(offsetPoint(p, offset)));
  });
  return out;
}

function buildFruitGPX(pts){
  const fruitPts = generateFruitPoints(pts);
  const positionLabels = ['L', 'M', 'R'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="XiaoXiao">
${fruitPts.map((p,i) => {
  const sourceIndex = Math.floor(i / 3) + 1;
  const positionLabel = positionLabels[i % 3];
  return `  <wpt lat="${escapeXml(p.lat.toFixed(6))}" lon="${escapeXml(p.lon.toFixed(6))}"><name>P${sourceIndex}-${positionLabel}</name></wpt>`;
}).join('\n')}
</gpx>`;
}


// 共用經緯度偏移函式：收果版與其他固定偏移功能都會使用。
function offsetPoint(p, offset){
  return {
    lat: p.lat + offset[0],
    lon: p.lon + offset[1],
    orig: p.orig,
    num: p.num
  };
}

// 種花模式共用設定：導航 APP 每個點位停留 3 秒。
const FLOWER_RING_RADIUS_DEGREES = 0.000270;
const FLOWER_INNER_RADIUS_DEGREES = 0.000135;
const FLOWER_RING_POINT_COUNT = 12;
const FLOWER_SMART15_POINT_COUNT = 15;

// 33 點北向圓形模式：中心、北約 10 公尺、北約 20 公尺、圓形 30 點。
const FLOWER_NORTH10_DEGREES = 0.000090;
const FLOWER_NORTH20_DEGREES = 0.000180;
const FLOWER_NORTH33_RING_POINT_COUNT = 30;
const FLOWER_NORTH33_POINT_COUNT = 33;

function getFlowerMode(){
  return document.querySelector('input[name="flowerMode"]:checked')?.value || 'smart15';
}

function getFlowerPointsPerSource(){
  return getFlowerMode() === 'north33' ? FLOWER_NORTH33_POINT_COUNT : FLOWER_SMART15_POINT_COUNT;
}

function normalizeAngle(angle){
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

// 方位角：正北為 0，正東為 π/2。
function bearingAngle(from, to){
  return Math.atan2(to.lon - from.lon, to.lat - from.lat);
}

function circularAverage(a, b){
  const x = Math.cos(a) + Math.cos(b);
  const y = Math.sin(a) + Math.sin(b);
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) return normalizeAngle(a);
  return normalizeAngle(Math.atan2(y, x));
}

// 15 點模式：第一個外圈點朝向前一株，最後一個內點盡量朝向下一株。
function getFlowerRotation(pts, index){
  const n = pts.length;
  if (n <= 1) return 0;

  const current = pts[index];
  const previous = pts[(index - 1 + n) % n];
  const next = pts[(index + 1) % n];
  const entryTarget = bearingAngle(current, previous);
  const exitTargetAsEntryAxis = normalizeAngle(bearingAngle(current, next) + Math.PI);
  return circularAverage(entryTarget, exitTargetAsEntryAxis);
}

function rotatedOffset(radius, angle){
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function generateSmart15Pattern(p, rotationAngle = 0){
  const pattern = [];

  // 外圈 12 點，不重複第一點。
  for (let i = 0; i < FLOWER_RING_POINT_COUNT; i++) {
    const angle = rotationAngle + 2 * Math.PI * i / FLOWER_RING_POINT_COUNT;
    pattern.push(offsetPoint(p, rotatedOffset(FLOWER_RING_RADIUS_DEGREES, angle)));
  }

  // 入口側內點 → 中心 → 相反方向出口內點。
  pattern.push(offsetPoint(p, rotatedOffset(FLOWER_INNER_RADIUS_DEGREES, rotationAngle)));
  pattern.push({...p});
  pattern.push(offsetPoint(p, rotatedOffset(FLOWER_INNER_RADIUS_DEGREES, rotationAngle + Math.PI)));
  return pattern;
}

function generateNorth33Pattern(p){
  const pattern = [];

  // 中心 → 北約 10 公尺 → 北約 20 公尺。
  pattern.push({...p});
  pattern.push(offsetPoint(p, [FLOWER_NORTH10_DEGREES, 0]));
  pattern.push(offsetPoint(p, [FLOWER_NORTH20_DEGREES, 0]));

  // 30 點單圈：第 1 點位於正北約 30 公尺，第 30 點與第 1 點重疊。
  // 因首尾都需保留，所以用 29 個等分區段產生 30 個點。
  for (let i = 0; i < FLOWER_NORTH33_RING_POINT_COUNT; i++) {
    const angle = 2 * Math.PI * i / (FLOWER_NORTH33_RING_POINT_COUNT - 1);
    pattern.push(offsetPoint(p, rotatedOffset(FLOWER_RING_RADIUS_DEGREES, angle)));
  }
  return pattern;
}

function generateFlowerPoints(pts){
  const out = [];
  const mode = getFlowerMode();

  pts.forEach((p, index) => {
    if (mode === 'north33') {
      out.push(...generateNorth33Pattern(p));
    } else {
      const rotation = getFlowerRotation(pts, index);
      out.push(...generateSmart15Pattern(p, rotation));
    }
  });
  return out;
}

function getFlowerPointName(index){
  const mode = getFlowerMode();
  const pointsPerSource = getFlowerPointsPerSource();
  const sourceIndex = Math.floor(index / pointsPerSource) + 1;
  const positionIndex = index % pointsPerSource;

  if (mode === 'north33') {
    if (positionIndex === 0) return `F${sourceIndex}-C`;
    if (positionIndex === 1) return `F${sourceIndex}-N1`;
    if (positionIndex === 2) return `F${sourceIndex}-N2`;
    return `F${sourceIndex}-R${String(positionIndex - 2).padStart(2, '0')}`;
  }

  if (positionIndex < FLOWER_RING_POINT_COUNT) {
    return `F${sourceIndex}-R${String(positionIndex + 1).padStart(2, '0')}`;
  }
  if (positionIndex === 12) return `F${sourceIndex}-N`;
  if (positionIndex === 13) return `F${sourceIndex}-C`;
  return `F${sourceIndex}-S`;
}

function buildFlowerGPX(pts){
  const flowerPts = generateFlowerPoints(pts);
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="XiaoXiao">
${flowerPts.map((p,i)=>`  <wpt lat="${escapeXml(p.lat.toFixed(6))}" lon="${escapeXml(p.lon.toFixed(6))}"><name>${getFlowerPointName(i)}</name></wpt>`).join('\n')}
</gpx>`;
}

function buildCoordGPX(pts){
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="XiaoXiao">
${pts.map((p,i)=>`  <wpt lat="${escapeXml(p.lat.toFixed(6))}" lon="${escapeXml(p.lon.toFixed(6))}"><name>C${i+1}</name></wpt>`).join('\n')}
</gpx>`;
}

function floor2(n){
  return Math.floor(n * 100) / 100;
}

function getBaseFileName(){
  return ($('fileNameInput')?.value || '我的路線').trim() || '我的路線';
}

function sanitizeFileName(name){
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim() || '我的路線';
}

function generateFileName(){
  return `${sanitizeFileName(getBaseFileName())}.gpx`;
}

function downloadTextFile(text, filename, mimeType, msg){
  if (!text) return;
  const blob = new Blob([text], {type: mimeType});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = sanitizeFileName(filename);
  a.click();
  URL.revokeObjectURL(a.href);
  if ($('msg')) $('msg').textContent = msg;
}

function downloadGenerated(type, direction){
  if (!currentPoints.length) analyze();
  if (!currentPoints.length) return;

  const isReverse = direction === 'reverse';
  const pts = isReverse ? reversed(currentPoints) : currentPoints;
  const dirName = isReverse ? '反' : '正';
  const base = sanitizeFileName(getBaseFileName());
  let text = '';
  let label = '';
  let ext = 'gpx';
  let mime = 'application/gpx+xml;charset=utf-8';

  if (type === 'fruit') {
    label = '收果';
    text = buildFruitGPX(pts);
  } else if (type === 'flower') {
    label = '種花';
    text = buildFlowerGPX(pts);
  } else if (type === 'coordGpx') {
    label = '純座標GPX';
    text = buildCoordGPX(pts);
  } else if (type === 'coord') {
    label = '純座標';
    text = buildCoords(pts);
    ext = 'txt';
    mime = 'text/plain;charset=utf-8';
  } else if (type === 'offsetGpx') {
    label = '偏移座標GPX';
    text = buildCoordGPX(getOffsetPoints(pts));
  } else if (type === 'offset') {
    label = '偏移座標';
    text = buildCoords(getOffsetPoints(pts));
    ext = 'txt';
    mime = 'text/plain;charset=utf-8';
  }

  downloadTextFile(text, `${base}_${label}_${dirName}.${ext}`, mime, `已下載${label}（${dirName}）。`);
}
