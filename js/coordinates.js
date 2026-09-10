// 座標解析、排序、去重與偏移座標

function makePoint(lat, lon, i){
  return { lat: Number(lat), lon: Number(lon), orig: i + 1 };
}

function stripXmlTags(text){
  return String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePoints(text){
  const pts = [];
  let m;

  // 1. XML / GPX 標籤：支援 wpt / trkpt / rtept，lat/lon 順序可顛倒
  const tag = /<(?:wpt|trkpt|rtept)\b[^>]*>/gi;
  while ((m = tag.exec(text)) !== null) {
    const s = m[0];
    const lat = s.match(/\blat=["']([^"']+)["']/i);
    const lon = s.match(/\blon=["']([^"']+)["']/i);
    if (lat && lon) {
      const a = Number(lat[1]);
      const b = Number(lon[1]);
      if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
        pts.push(makePoint(a, b, pts.length));
      }
    }
  }
  if (pts.length) return pts;

  // 2. 逐行解析：純座標 / 名稱+座標
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  for (const line of lines) {
    const clean = stripXmlTags(line);
    const cm = clean.match(/(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)/);
    if (cm) {
      const a = Number(cm[1]);
      const b = Number(cm[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
        pts.push(makePoint(a, b, pts.length));
      }
    }
  }
  if (pts.length) return pts;

  // 3. 全文備援掃描
  const re = /(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)/g;
  while ((m = re.exec(text)) !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      pts.push(makePoint(a, b, pts.length));
    }
  }
  return pts;
}

function rad(v){ return v * Math.PI / 180; }

function dist(a, b){
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const la1 = rad(a.lat);
  const la2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function total(pts, closeLoop = false){
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += dist(pts[i], pts[i + 1]);
  if (closeLoop && pts.length > 1) s += dist(pts[pts.length - 1], pts[0]);
  return s;
}

// 從指定起點開始，以最近鄰方式建立初始路徑。
function nearestSortFromStart(pts, startIndex){
  if (pts.length < 3) return pts.slice();
  const rem = pts.slice();
  const route = [rem.splice(startIndex, 1)[0]];
  while (rem.length) {
    let bi = 0;
    let bd = Infinity;
    const last = route[route.length - 1];
    rem.forEach((p, i) => {
      const d = dist(last, p);
      if (d < bd) { bd = d; bi = i; }
    });
    route.push(rem.splice(bi, 1)[0]);
  }
  return route;
}

function angleSort(pts){
  if (pts.length < 3) return pts.slice();
  const c = {
    lat: pts.reduce((s,p)=>s+p.lat,0) / pts.length,
    lon: pts.reduce((s,p)=>s+p.lon,0) / pts.length
  };
  return pts.slice().sort((a,b) =>
    Math.atan2(a.lat - c.lat, a.lon - c.lon) -
    Math.atan2(b.lat - c.lat, b.lon - c.lon)
  );
}

// 封閉迴圈 2-opt：包含「最後一點 → 第一點」這條邊一起最佳化。
function twoOptClosed(path){
  let best = path.slice();
  const n = best.length;
  if (n < 4) return best;

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        // 相鄰邊無須交換；第一邊與最後一邊也是相鄰邊。
        if (k === i + 1 || (i === 0 && k === n - 1)) continue;

        const a = best[i];
        const b = best[(i + 1) % n];
        const c = best[k];
        const d = best[(k + 1) % n];
        const current = dist(a, b) + dist(c, d);
        const swapped = dist(a, c) + dist(b, d);

        if (swapped + 1e-9 < current) {
          const reversedPart = best.slice(i + 1, k + 1).reverse();
          best.splice(i + 1, k - i, ...reversedPart);
          changed = true;
        }
      }
    }
  }
  return best;
}

// 自動嘗試每一個原始點作為起點，挑選封閉總距離最短的結果。
function shortestClosedRoute(pts){
  if (pts.length < 3) return pts.slice();

  let bestRoute = null;
  let bestDistance = Infinity;

  for (let startIndex = 0; startIndex < pts.length; startIndex++) {
    const initial = nearestSortFromStart(pts, startIndex);
    const improved = twoOptClosed(initial);
    const loopDistance = total(improved, true);

    if (loopDistance + 1e-9 < bestDistance) {
      bestDistance = loopDistance;
      bestRoute = improved;
    }
  }

  return bestRoute || pts.slice();
}

function getRouteMode(){
  return document.querySelector('input[name="routeMode"]:checked')?.value || 'paste';
}

// 分析排序前移除重複座標：以網站統一輸出的 6 位小數作為判定基準，保留第一次出現的座標。
function removeDuplicatePoints(pts){
  const seen = new Set();
  return pts.filter(p => {
    const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function orderPoints(pts){
  let out = pts.slice();

  if (getRouteMode() === 'shortest') {
    out = shortestClosedRoute(out);
  }

  return out.map((p, i) => ({...p, num: i + 1}));
}

function bounds(pts){
  return {
    minLat: Math.min(...pts.map(p=>p.lat)),
    maxLat: Math.max(...pts.map(p=>p.lat)),
    minLon: Math.min(...pts.map(p=>p.lon)),
    maxLon: Math.max(...pts.map(p=>p.lon))
  };
}

function fmtCoord(p){
  return `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`;
}

// 收果跳點邏輯：每個原始點產生 3 個橫向小偏移點。

function reversed(pts){
  return pts.slice().reverse();
}

function buildCoords(pts){
  return pts.map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('\n');
}

// 偏移座標：參考「每日強開管理／討論串偏移座標」
// 每點採 0–360° 隨機方向、45–60 公尺隨機距離。
const OFFSET_LAT_M_PER_DEG = 111132;
const offsetPointMap = new Map();

function pointKey(p){
  return `${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`;
}

function makeOffsetPoint(p){
  const lat = Number(p.lat), lon = Number(p.lon);
  const angle = Math.random() * Math.PI * 2;
  const dist = 45 + (Math.random() * 15);
  const oLat = (dist * Math.cos(angle)) / OFFSET_LAT_M_PER_DEG;
  const cosLat = Math.cos(lat * Math.PI / 180);
  const oLon = (dist * Math.sin(angle)) / (OFFSET_LAT_M_PER_DEG * cosLat);
  return {lat: lat + oLat, lon: lon + oLon};
}

function getOffsetPoints(pts){
  return pts.map(p => {
    const key = pointKey(p);
    if (!offsetPointMap.has(key)) offsetPointMap.set(key, makeOffsetPoint(p));
    return offsetPointMap.get(key);
  });
}

function syncOffsetPointMap(pts){
  const keep = new Set(pts.map(pointKey));
  for (const key of offsetPointMap.keys()) {
    if (!keep.has(key)) offsetPointMap.delete(key);
  }
  getOffsetPoints(pts);
}

function buildReverseCoords(pts){
  return pts.slice().reverse().map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('\n');
}
