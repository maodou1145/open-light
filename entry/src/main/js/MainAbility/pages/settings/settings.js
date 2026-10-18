// settings.js - 设置主页（字体颜色/大小/滚动速度/屏幕常亮）
// 持久化 or_cfg（逗号分隔，键位与其他页/run 一致）。
var COLS = [
  ['#0A6CFF','蓝'],['#00BCD4','青'],['#4CAF50','绿'],['#FFEB3B','黄'],
  ['#FF9800','橙'],['#F44336','红'],['#9C27B0','紫'],['#000000','黑'],['#FFFFFF','白']
];
var DEF_CFG = '1,0,1.5,5,0,1,0,1,0,1,0,100,1,0,0,0,0,0';
var TG = { blue: '#0A6CFF', white: '#FFFFFF', ring: '#F0F1F3' };
var FILE_CFG = 'internal://app/or_cfg.txt';

function cfgArr(s) {
  var d = DEF_CFG.split(',');
  if (typeof s === 'string' && s !== '') {
    var a = s.split(',');
    for (var i = 0; i < a.length; i++) { if (a[i] !== '') d[i] = a[i]; }
  }
  return d;
}
function normData(d) {
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    if (typeof d.value === 'string') return d.value;
    if (typeof d.data === 'string') return d.data;
  }
  return '';
}
function nav(rA, uri, params) {
  try {
    if (!rA) return;
    if (typeof rA.replace === 'function') { rA.replace({ uri: uri, params: params }); return; }
    if (typeof rA.replaceUrl === 'function') { rA.replaceUrl({ uri: uri, params: params }); }
  } catch (e) {}
}

// 配置双通道读取：storage 与文件备份都读，按写入序号（索引 13）取新值。
// 真机上 @system.storage.set 可能静默失败，只信 storage 会读到旧配置（改了颜色/背景却不生效）。
function loadCfgBoth(sA, fA, cb) {
  var sv = null, fv = null, n = 0, done = false;
  var fin = function () {
    if (done) return; done = true;
    var seq = function (a) { return a ? (parseInt(a[13], 10) || 0) : -1; };
    if (sv && fv) { cb(seq(fv) > seq(sv) ? fv : sv); }
    else { cb(fv || sv || cfgArr('')); }
  };
  var tick = function () { n++; if (n >= 2) fin(); };
  try {
    if (sA) {
      sA.get({ key: 'or_cfg', default: '',
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
  setTimeout(fin, 800);   // 任一通道挂起兜底
}

export default {
  data: {
    bgColor: '#E8F2FC', lblCol: '#333333', titleCol: '#333333', bizCol: '#0A6CFF',
    segBg: '#E8EAED', segSub: '#616161', btnBg: '#E8EAED', btnTxt: '#424242',
    valCol: '#333333', sldCol: '#D8DBDE', sldSel: '#0A6CFF',
    curCol: '#0A6CFF', curColName: '蓝',
    cdC0: '#0A6CFF', cdC1: '#00BCD4', cdC2: '#4CAF50', cdC3: '#FFEB3B', cdC4: '#FF9800',
    cdC5: '#F44336', cdC6: '#9C27B0', cdC7: '#000000', cdC8: '#FFFFFF',
    cdR0: '#F0F1F3', cdR1: '#F0F1F3', cdR2: '#F0F1F3', cdR3: '#F0F1F3', cdR4: '#F0F1F3',
    cdR5: '#F0F1F3', cdR6: '#F0F1F3', cdR7: '#F0F1F3', cdR8: '#F0F1F3',
    sizeVal: 1.5, vSize: '1.5', sizeFill: '48px',
    speedVal: 5, vSpeed: '5px/秒', spdFill: '48px',
    keep0: '', keep1: '', keepT0: '', keepT1: ''
  },
  onInit: function () {
    this.sA = null; this.rA = null;
    try { this.sA = require('@system.storage'); } catch (e) { this.sA = null; }
    try { this.rA = require('@system.router'); } catch (e) { this.rA = null; }
    this.fA = null;
    try { this.fA = require('@system.file'); } catch (e) { this.fA = null; }
    this.cfg = cfgArr('');
    this._touched = false;
    this.refresh();
    var that = this;
    // 双通道读取（按写入序号取新）：避免读到 storage 里被静默失败拖住的旧配置，再被后续保存覆盖
    loadCfgBoth(this.sA, this.fA, function (c) { if (!that._touched) { that.cfg = c; that.refresh(); } });
  },
  seg: function (active, names) {
    for (var i = 0; i < names.length; i++) {
      var sel = (i === active);
      this[names[i]] = sel ? TG.blue : this.segBg;
      this['T' + names[i]] = sel ? TG.white : this.segSub;
    }
  },
  refresh: function () {
    var c = this.cfg;
    var at = function (i) { var v = parseInt(c[i], 10); return isNaN(v) ? 0 : v; };
    this.cfg[16] = '0';
    var ci = Math.max(0, Math.min(8, at(1)));
    this.curCol = COLS[ci][0]; this.curColName = COLS[ci][1];
    for (var k = 0; k < 9; k++) { this['cdC' + k] = COLS[k][0]; this['cdR' + k] = (k === ci) ? TG.blue : TG.ring; }
    this.sizeVal = parseFloat(c[2]); this.vSize = '' + this.sizeVal;
    this.speedVal = at(3); this.vSpeed = this.speedVal + 'px/秒';
    var fill = function (v, mn, mx) {
      var t = (v - mn) / (mx - mn);
      if (t < 0) t = 0; if (t > 1) t = 1;
      return Math.round(t * 140) + 'px';   // 140 = 轨道 .sltrack 宽度，满档填满
    };
    this.sizeFill = fill(this.sizeVal, 0.5, 3);
    this.spdFill = fill(this.speedVal, 1, 10);
    this.seg(at(7), ['keep0', 'keep1']);
  },
  persist: function () {
    var that = this;
    if (!this.sA) return;
    this._touched = true;
    this.cfg[16] = '0';
    this.cfg[13] = String((parseInt(this.cfg[13], 10) || 0) + 1);   // 写入序号 +1：run 页按序号取新通道
    var val = this.cfg.join(',');
    var attempt = 0;
    // 写后校验：storage.set 真机上可能静默失败，读回不一致则重试（最多 3 次）；文件通道同步写
    var doSet = function () {
      if (!that.sA) return;
      try { that.sA.set({ key: 'or_cfg', value: val }); } catch (e) {}
      try { if (that.fA) { that.fA.writeText({ uri: FILE_CFG, text: val }); } } catch (e) {}
      setTimeout(function () {
        try {
          that.sA.get({ key: 'or_cfg', default: '',
            success: function (d) { if (normData(d) !== val && attempt < 3) { attempt++; doSet(); } },
            fail: function () { if (attempt < 3) { attempt++; doSet(); } } });
        } catch (e) {}
      }, 300);
    };
    doSet();
  },
  onColor: function (v) {
    var n = parseInt(v, 10); if (isNaN(n)) n = 0;
    this.cfg[1] = String(Math.max(0, Math.min(8, n)));   // 越界保护：颜色索引必须落在 COLS 范围内
    this.refresh(); this.persist();
  },
  onSize: function (e) { this.cfg[2] = String(e.value); this.refresh(); this.persist(); },
  onSpeed: function (e) { this.cfg[3] = String(e.value); this.refresh(); this.persist(); },
  setKeep: function (v) { this.cfg[7] = String(v); this.refresh(); this.persist(); },
  decSize: function () { this.onSize({ value: Math.max(0.5, Math.round((this.sizeVal - 0.1) * 10) / 10) }); },
  incSize: function () { this.onSize({ value: Math.min(3, Math.round((this.sizeVal + 0.1) * 10) / 10) }); },
  decSpeed: function () { this.onSpeed({ value: Math.max(1, this.speedVal - 1) }); },
  incSpeed: function () { this.onSpeed({ value: Math.min(10, this.speedVal + 1) }); },
  goNext: function () { nav(this.rA, 'pages/settings2/settings2', {}); },
  goBack: function () {
    var that = this;
    this.persist();
    setTimeout(function () { nav(that.rA, 'pages/index/index', {}); }, 300);
  }
};