// settings_font.js - 文字设置（24 色调色盘 + 字号）
// 配置索引：1=文字色 2=字号；读写统一走 common/cfg.js。
import Cfg from '../../common/cfg';

var PAL = Cfg.PAL;
var ACCENT = '#0E93B0';          // 选中光环色（浅底高对比）
var OFF = '#E4EBEF';            // 未选中：浅灰底盘（白/浅色块也能看清边界，且不依赖 border-style）

export default {
  data: {
    bgColor: '#EEF7FB', titleCol: '#1F3A44', bizCol: '#0E93B0',
    btnBg: '#FFFFFF', btnTxt: '#1F3A44', sldCol: '#DCE6EA', sldSel: '#0E93B0',
    curName: '蓝',
    curHex: '#0A6CFF',        // 当前色小色点
    pR0: OFF, pR1: OFF, pR2: OFF, pR3: OFF, pR4: OFF, pR5: OFF,
    pR6: OFF, pR7: OFF, pR8: OFF, pR9: OFF, pR10: OFF, pR11: OFF,
    pR12: OFF, pR13: OFF, pR14: OFF, pR15: OFF, pR16: OFF, pR17: OFF,
    pR18: OFF, pR19: OFF, pR20: OFF, pR21: OFF, pR22: OFF, pR23: OFF,
    sizeVal: 1.5, vSize: '1.5', sizeFill: '48px'
  },
  onInit: function () {
    var m = Cfg.mods();
    this.sA = m.sA; this.rA = m.rA; this.fA = m.fA;
    this.cfg = Cfg.cfgArr('');
    this._touched = false;
    this.refresh();
    var that = this;
    // 异步读到真配置后刷新；用户已操作过则不覆盖（避免把刚点的颜色弹回去）
    Cfg.readCfg(this.sA, this.fA, function (c) {
      if (!that._touched) { that.cfg = c; that.refresh(); }
    });
  },
  refresh: function () {
    Cfg.trim(this.cfg);
    var c = this.cfg;
    var at = function (i) { var v = parseInt(c[i], 10); return isNaN(v) ? 0 : v; };
    var ci = Math.max(0, Math.min(23, at(1)));
    // 颜色位既可能是旧格式的预设索引，也可能是取色器存的 '#RRGGBB'
    this.curHex = Cfg.resolveColor(c[1], PAL);
    this.curName = Cfg.colorName(c[1], PAL);
    // 选中态 = 色块外一圈强调色光环（对黑/白/彩色块一律可见）
    for (var k = 0; k < 24; k++) { this['pR' + k] = (k === ci) ? ACCENT : OFF; }

    this.sizeVal = parseFloat(c[2]);
    if (isNaN(this.sizeVal)) this.sizeVal = 1.5;
    this.vSize = '' + this.sizeVal;
    var t = (this.sizeVal - 0.5) / 2.5;
    if (t < 0) t = 0; if (t > 1) t = 1;
    this.sizeFill = Math.round(t * 140) + 'px';
  },
  persist: function () {
    this._touched = true;
    Cfg.saveCfg(this.sA, this.fA, this.cfg);
  },
  // 去取色器吸一个任意颜色（中转键：来源页 + 目标配置索引）
  pickColor: function () {
    Cfg.saveVal(this.sA, this.fA, 'or_pick_from', 'pages/settings_font/settings_font');
    Cfg.saveVal(this.sA, this.fA, 'or_pick_target', '1');
    Cfg.nav(this.rA, 'pages/colorpicker/colorpicker', {});
  },
  onShow: function () {
    // 从取色器返回时配置已被改写，重新读一次显示最新值
    var that = this;
    Cfg.readCfg(this.sA, this.fA, function (c) { that.cfg = c; that.refresh(); });
  },
  onColor: function (v) {
    var n = parseInt(v, 10); if (isNaN(n)) n = 0;
    this.cfg[1] = String(Math.max(0, Math.min(23, n)));
    this.refresh(); this.persist();
  },
  onSize: function (e) { this.cfg[2] = String(e.value); this.refresh(); this.persist(); },
  decSize: function () { this.onSize({ value: Math.max(0.5, Math.round((this.sizeVal - 0.1) * 10) / 10) }); },
  incSize: function () { this.onSize({ value: Math.min(3, Math.round((this.sizeVal + 0.1) * 10) / 10) }); },
  goBack: function () {
    var that = this;
    this.persist();
    setTimeout(function () { Cfg.nav(that.rA, 'pages/settings/settings', {}); }, 300);
  }
};
