/**
 * common/cfg.js - 配置与持久化统一入口
 *
 * 为什么要有这个文件：
 *   配置串（or_cfg）原来在 index / settings / settings_font / settings_bg / settings_effect
 *   五个页面各复制一份 cfgArr/normData/nav/loadCfgBoth/persist，改协议要同步五处，
 *   而且 index 读配置不走序号比较，会和设置页读到不同值。现在统一到这里。
 *
 * 存储策略（lite 实测的坑）：
 *   - @system.storage 在部分固件/模拟器裸调用会抛断言 → 全程 try/catch
 *   - 单靠 storage 会静默写失败 → 双写 internal://app 文件做备份
 *   - 配置串末段带写入序号（索引 13）→ 读取时两路都读，取序号大的
 *   - **storage 不可用时仍必须写文件**（早期版本在这里 `if (!sA) return` 把文件通道
 *     一并堵死，等于完全没有持久化）
 *
 * 配置索引契约（改动必须全链同步，run.js / 各设置页依赖它）：
 *   0=横屏标记(废弃) 1=文字色 2=字号 3=速度 4=方向 5=粗体(废弃) 6=播放次数(废弃)
 *   7=屏幕常亮 10=字间距 13=写入序号 15=镜像 16=深色(废弃) 17=背景色
 */

var DEF_CFG = '1,0,1.5,5,0,1,0,1,0,1,0,100,1,0,0,0,0,0';
var KEY_CFG = 'or_cfg';
var KEY_TEXT = 'or_text';
var FILE_CFG = 'internal://app/or_cfg.txt';
var FILE_TEXT = 'internal://app/or_text.txt';

// 废弃位：统一归零，避免旧配置带着无意义的值继续传播
var DEAD_IDX = [0, 5, 6, 16];

// 文字色（24）—— run.js 的 Canvas 画字也用这张表，改色只改这里
var PAL = [
  ['#0A6CFF','蓝'],['#00BCD4','青'],['#4CAF50','绿'],['#FFEB3B','黄'],
  ['#FF9800','橙'],['#F44336','红'],['#9C27B0','紫'],['#000000','黑'],
  ['#FFFFFF','白'],['#2196F3','亮蓝'],['#03A9F4','天蓝'],['#00E5FF','荧光青'],
  ['#009688','蓝绿'],['#8BC34A','浅绿'],['#CDDC39','黄绿'],['#FFC107','琥珀'],
  ['#FF5722','橙红'],['#E91E63','玫红'],['#FF4081','粉'],['#673AB7','深紫'],
  ['#3F51B5','靛蓝'],['#795548','棕'],['#9E9E9E','灰'],['#607D8B','蓝灰']
];

// 背景色（24）—— run.js 的 Canvas 底色也用这张表
var BGPAL = [
  ['#FFFFFF','白'],['#121212','黑'],['#1E1E1E','深灰'],['#F5F6F8','浅灰'],
  ['#0A6CFF','蓝'],['#00BCD4','青'],['#9C27B0','紫'],['#F44336','红'],
  ['#4CAF50','绿'],['#FFF8E1','米黄'],['#E8F2FC','浅蓝'],['#E8F5E9','浅绿'],
  ['#FCE4EC','浅粉'],['#F3E5F5','浅紫'],['#FFF3E0','浅橙'],['#E0F7FA','浅青'],
  ['#263238','墨蓝'],['#37474F','蓝灰'],['#4E342E','深棕'],['#1A237E','深蓝'],
  ['#004D40','墨绿'],['#3E2723','深褐'],['#000000','纯黑'],['#FFEB3B','黄']
];

function cfgArr(s) {
  var d = DEF_CFG.split(',');
  if (typeof s === 'string' && s !== '') {
    var a = s.split(',');
    for (var i = 0; i < a.length && i < d.length; i++) {
      if (a[i] !== '') d[i] = a[i];
    }
  }
  return d;
}

// @system.* 返回值可能带 {value} / {data} 包装
function normData(d) {
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    if (typeof d.value === 'string') return d.value;
    if (typeof d.data === 'string') return d.data;
  }
  return '';
}

// 把废弃位清零（原地改并返回，方便链式）
function trim(cfg) {
  if (!cfg) return cfgArr('');
  for (var i = 0; i < DEAD_IDX.length; i++) cfg[DEAD_IDX[i]] = '0';
  return cfg;
}

function seqOf(cfg) {
  if (!cfg) return -1;
  var n = parseInt(cfg[13], 10);
  return isNaN(n) ? 0 : n;
}

// 路由跳转：liteWearable 的 @system.router 只有 replace
function nav(rA, uri, params) {
  try {
    if (!rA) return;
    if (typeof rA.replace === 'function') { rA.replace({ uri: uri, params: params }); return; }
    if (typeof rA.replaceUrl === 'function') { rA.replaceUrl({ uri: uri, params: params }); }
  } catch (e) {}
}

// 取系统模块（失败返回 null，调用方无需再包 try/catch）
function mods() {
  var m = { sA: null, rA: null, fA: null };
  try { m.sA = require('@system.storage'); } catch (e) { m.sA = null; }
  try { m.rA = require('@system.router'); } catch (e) { m.rA = null; }
  try { m.fA = require('@system.file'); } catch (e) { m.fA = null; }
  return m;
}

/**
 * 双通道读文本：storage 与文件都读，谁有值用谁（文本无序号，storage 优先）
 */
function readText(sA, fA, cb) {
  var done = false, sv = null, fv = null, n = 0, guard = null;
  var fin = function () {
    if (done) return; done = true;
    if (guard) { clearTimeout(guard); guard = null; }
    var v = (sv !== null && sv !== '') ? sv : (fv || '');
    if (cb) cb(v);
  };
  guard = setTimeout(fin, 800);   // 兜底：任一通道不回调时不至于永远等
  var tick = function () { n++; if (n >= 2) fin(); };
  try {
    if (sA) {
      sA.get({ key: KEY_TEXT, default: '',
        success: function (d) { sv = normData(d); tick(); },
        fail: tick });
    } else { tick(); }
  } catch (e) { tick(); }
  try {
    if (fA) {
      fA.readText({ uri: FILE_TEXT,
        success: function (r) { fv = (r && (r.text || r.data)) || ''; tick(); },
        fail: tick });
    } else { tick(); }
  } catch (e) { tick(); }
}

/**
 * 双通道读配置：两路都读，按索引 13 的写入序号取新的一份
 */
function readCfg(sA, fA, cb) {
  var done = false, sv = null, fv = null, n = 0;
  var fin = function () {
    if (done) return; done = true;
    if (guard) { clearTimeout(guard); guard = null; }
    var out;
    if (sv && fv) { out = (seqOf(fv) > seqOf(sv)) ? fv : sv; }
    else { out = fv || sv || cfgArr(''); }
    if (cb) cb(trim(out));
  };
  var tick = function () { n++; if (n >= 2) fin(); };
  var guard = setTimeout(fin, 800);
  try {
    if (sA) {
      sA.get({ key: KEY_CFG, default: '',
        success: function (d) { var v = normData(d); sv = (v !== '') ? cfgArr(v) : null; tick(); },
        fail: tick });
    } else { tick(); }
  } catch (e) { tick(); }
  try {
    if (fA) {
      fA.readText({ uri: FILE_CFG,
        success: function (r) { var v = (r && (r.text || r.data)) || ''; fv = (v !== '') ? cfgArr(v) : null; tick(); },
        fail: tick });
    } else { tick(); }
  } catch (e) { tick(); }
}

// ── 布尔标记（一次性事件用，例如"欢迎页已看过"）──────────────────────
// 每个标记独立 key + 独立文件（internal://app/or_flag_<key>.txt），互不覆盖。
// 标记类数据不参与序号比较：storage 命中即为快路径，立即回调，不等文件通道，
// 避免页面为了等标记而白屏。
var FLAG_PREFIX = 'or_flag_';

function flagFile(key) {
  return 'internal://app/' + FLAG_PREFIX + key + '.txt';
}

function readFlag(sA, fA, key, cb) {
  var done = false, guard = null;
  var fin = function (v) {
    if (done) return; done = true;
    if (guard) { clearTimeout(guard); guard = null; }
    if (cb) cb(!!v && v !== '0');
  };
  var viaFile = function () {
    try {
      if (fA) {
        fA.readText({ uri: flagFile(key),
          success: function (r) { fin((r && (r.text || r.data)) || ''); },
          fail: function () { fin(''); } });
        return;
      }
    } catch (e) {}
    fin('');
  };
  guard = setTimeout(function () { fin(''); }, 400);   // 兜底：读不到按"未发生"处理
  try {
    if (sA) {
      sA.get({ key: FLAG_PREFIX + key, default: '',
        success: function (d) {
          var v = normData(d);
          if (v !== '') { fin(v); return; }   // storage 有值 → 直接用，不等文件
          viaFile();
        },
        fail: viaFile });
      return;
    }
  } catch (e) {}
  viaFile();
}

function saveFlag(sA, fA, key, v) {
  var val = (v === true || v === 1 || v === '1') ? '1' : '0';
  if (!sA && !fA) return false;
  if (sA) { try { sA.set({ key: FLAG_PREFIX + key, value: val }); } catch (e) {} }
  if (fA) { try { fA.writeText({ uri: flagFile(key), text: val }); } catch (e) {} }
  return true;
}

/**
 * 颜色值解析：cfg 里颜色位可能是
 *   - 旧格式：'0'~'23' 预设色索引
 *   - 新格式：'#RRGGBB' 自定义色（取色器吸出来的任意颜色）
 * 两种都能解析成 '#RRGGBB'，老配置不用迁移。
 */
function resolveColor(v, pal) {
  var list = pal || PAL;
  if (typeof v === 'string') {
    var s = v.trim();
    if (s.charAt(0) === '#' && s.length >= 7) return s.toUpperCase();
    var n0 = parseInt(s, 10);
    if (!isNaN(n0) && n0 >= 0 && n0 < list.length) return list[n0][0];
    return list[0][0];
  }
  var n = parseInt(v, 10);
  if (!isNaN(n) && n >= 0 && n < list.length) return list[n][0];
  return list[0][0];
}

// 颜色显示名：预设用中文名，自定义用大写 hex
function colorName(v, pal) {
  var list = pal || PAL;
  if (typeof v === 'string') {
    var s = v.trim();
    if (s.charAt(0) === '#') return s.toUpperCase();
    var n0 = parseInt(s, 10);
    if (!isNaN(n0) && n0 >= 0 && n0 < list.length) return list[n0][1];
  }
  return '自定义';
}

// ── 任意键值读写（页面间中转用，例如取色器把颜色传给设置页）────────────
// storage key 与文件名一一对应：<key> ↔ internal://app/<key>.txt
function valFile(key) {
  return 'internal://app/' + key + '.txt';
}

function readVal(sA, fA, key, cb) {
  var done = false, guard = null;
  var fin = function (v) {
    if (done) return; done = true;
    if (guard) { clearTimeout(guard); guard = null; }
    if (cb) cb(v || '');
  };
  var viaFile = function () {
    try {
      if (fA) {
        fA.readText({ uri: valFile(key),
          success: function (r) { fin((r && (r.text || r.data)) || ''); },
          fail: function () { fin(''); } });
        return;
      }
    } catch (e) {}
    fin('');
  };
  guard = setTimeout(function () { fin(''); }, 400);
  try {
    if (sA) {
      sA.get({ key: key, default: '',
        success: function (d) {
          var v = normData(d);
          if (v !== '') { fin(v); return; }
          viaFile();
        },
        fail: viaFile });
      return;
    }
  } catch (e) {}
  viaFile();
}

function saveVal(sA, fA, key, v) {
  if (!sA && !fA) return false;
  if (sA) { try { sA.set({ key: key, value: v }); } catch (e) {} }
  if (fA) { try { fA.writeText({ uri: valFile(key), text: v }); } catch (e) {} }
  return true;
}

// ── 方形屏检测（FIT/Band 系列 408x480 等）────────────────────────────
// lite 不支持 CSS @media；用 @system.device.getInfo() 的 screenShape 判定，
// 拿不到再回退 model 关键字；判定失败一律按圆屏（圆屏布局在两屏都安全）。
function isSquare(cb) {
  var done = false;
  var fin = function (sq) { if (done) return; done = true; if (cb) cb(sq); };
  try {
    var dv = require('@system.device');
    if (!dv || !dv.getInfo) { fin(false); return; }
    dv.getInfo({
      success: function (info) {
        var shape = (info && info.screenShape) ? String(info.screenShape) : '';
        if (shape !== '') { fin(shape === 'rect'); return; }
        var m = ('' + ((info && info.model) || '')).toLowerCase();
        fin(m.indexOf('fit') >= 0 || m.indexOf('band') >= 0);
      },
      fail: function () { fin(false); }
    });
  } catch (e) { fin(false); }
}

/**
 * 写文本：storage 与文件**各自独立**尝试写，任一可用即持久化成功。
 * storage 可用时做写后回读校验，不一致最多重试 3 次（lite 裸 set 会静默失败）。
 * storage 不可用时**不早退**，照常写文件备份通道。
 */
function saveText(sA, fA, v) {
  if (!sA && !fA) return false;
  var attempt = 0;
  var doSet = function () {
    if (sA) {
      try { sA.set({ key: KEY_TEXT, value: v }); } catch (e) {}
    }
    if (fA) {
      try { fA.writeText({ uri: FILE_TEXT, text: v }); } catch (e) {}
    }
    if (!sA) return;   // storage 不可用：文件已写，无需回读校验
    setTimeout(function () {
      try {
        sA.get({ key: KEY_TEXT, default: '',
          success: function (d) { if (normData(d) !== v && attempt < 3) { attempt++; doSet(); } },
          fail: function () { if (attempt < 3) { attempt++; doSet(); } } });
      } catch (e) {}
    }, 300);
  };
  doSet();
  return true;
}

/**
 * 写配置：递增写入序号后双写。
 * - storage 可用时做写后回读校验，不一致最多重试 3 次（lite 裸 set 会静默失败）
 * - storage 不可用时**不早退**，照常写文件备份通道
 */
function saveCfg(sA, fA, cfg) {
  if (!cfg) return false;
  trim(cfg);
  var hasCh = !!(sA || fA);
  if (!hasCh) return false;

  // 每次写入前递增序号（一次写入只增一次，重试不会重复递增）
  cfg[13] = String(seqOf(cfg) + 1);
  var val = cfg.join(',');

  var attempt = 0;
  var doSet = function () {
    if (sA) {
      try { sA.set({ key: KEY_CFG, value: val }); } catch (e) {}
    }
    if (fA) {
      try { fA.writeText({ uri: FILE_CFG, text: val }); } catch (e) {}
    }
    if (!sA) return;   // storage 不可用：文件已写，无需回读校验
    setTimeout(function () {
      try {
        sA.get({ key: KEY_CFG, default: '',
          success: function (d) { if (normData(d) !== val && attempt < 3) { attempt++; doSet(); } },
          fail: function () { if (attempt < 3) { attempt++; doSet(); } } });
      } catch (e) {}
    }, 300);
  };

  doSet();
  return true;
}

// 选中环颜色：按亮度选深/浅描边（供浅底卡片上的高对比选中态使用）
function ringOf(c) {
  var r = parseInt(c.substr(1, 2), 16);
  var g = parseInt(c.substr(3, 2), 16);
  var b = parseInt(c.substr(5, 2), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#D5D9DE';
  return ((r * 299 + g * 587 + b * 114) / 1000 > 160) ? '#333333' : '#FFFFFF';
}

export default {
  DEF_CFG: DEF_CFG,
  KEY_CFG: KEY_CFG,
  KEY_TEXT: KEY_TEXT,
  FILE_CFG: FILE_CFG,
  FILE_TEXT: FILE_TEXT,
  PAL: PAL,
  BGPAL: BGPAL,
  cfgArr: cfgArr,
  normData: normData,
  trim: trim,
  seqOf: seqOf,
  nav: nav,
  mods: mods,
  readText: readText,
  readCfg: readCfg,
  readFlag: readFlag,
  saveFlag: saveFlag,
  readVal: readVal,
  saveVal: saveVal,
  resolveColor: resolveColor,
  colorName: colorName,
  isSquare: isSquare,
  saveText: saveText,
  saveCfg: saveCfg,
  ringOf: ringOf
};
