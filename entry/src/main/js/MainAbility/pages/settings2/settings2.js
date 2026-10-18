// settings2.js - 设置第 2 页（背景颜色 / 版本号）
var BGCOLS = [
  ['#FFFFFF','白'],['#121212','黑'],['#1E1E1E','深灰'],['#F5F6F8','浅灰'],
  ['#0A6CFF','蓝'],['#00BCD4','青'],['#9C27B0','紫'],['#F44336','红'],['#4CAF50','绿']
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
    btnBg: '#E8EAED', btnTxt: '#424242',
    bgCurName: '白',
    bgdC0: '#FFFFFF', bgdC1: '#121212', bgdC2: '#1E1E1E', bgdC3: '#F5F6F8', bgdC4: '#0A6CFF',
    bgdC5: '#00BCD4', bgdC6: '#9C27B0', bgdC7: '#F44336', bgdC8: '#4CAF50',
    bgdR0: '#F0F1F3', bgdR1: '#F0F1F3', bgdR2: '#F0F1F3', bgdR3: '#F0F1F3', bgdR4: '#F0F1F3',
    bgdR5: '#F0F1F3', bgdR6: '#F0F1F3', bgdR7: '#F0F1F3', bgdR8: '#F0F1F3'
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
  refresh: function () {
    var c = this.cfg;
    var at = function (i) { var v = parseInt(c[i], 10); return isNaN(v) ? 0 : v; };
    this.cfg[16] = '0';
    this.cfg[6] = '0';   // 播放次数已取消（恒为循环滚动），旧配置里的"单次"一并归一
    var bi = Math.max(0, Math.min(8, at(17)));
    this.bgCurName = BGCOLS[bi][1];
    for (var k = 0; k < 9; k++) { this['bgdC' + k] = BGCOLS[k][0]; this['bgdR' + k] = (k === bi) ? TG.blue : TG.ring; }
  },
  persist: function () {
    var that = this;
    if (!this.sA) return;
    this._touched = true;
    this.cfg[16] = '0';
    this.cfg[6] = '0';   // 播放次数已取消（恒为循环滚动）
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
  onBg: function (v) {
    var n = parseInt(v, 10); if (isNaN(n)) n = 0;
    this.cfg[17] = String(Math.max(0, Math.min(8, n)));   // 越界保护：背景索引必须落在 BGCOLS 范围内
    this.refresh(); this.persist();
  },
  goBack: function () {
    var that = this;
    this.persist();
    setTimeout(function () { nav(that.rA, 'pages/index/index', {}); }, 300);
  }
};