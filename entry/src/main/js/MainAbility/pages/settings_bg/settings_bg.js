// settings_bg.js - 背景设置（24 色调色盘 + 版本号）
// 配置索引 17 = 背景色；颜色表与 run.js 共用 common/cfg.js 的 BGPAL，顺序严格一致。
import Cfg from '../../common/cfg';

var BGPAL = Cfg.BGPAL;
var ACCENT = '#0E93B0';          // 选中光环色（浅底高对比）
var OFF = '#E4EBEF';            // 未选中：浅灰底盘（白/浅色块也能看清边界，且不依赖 border-style）

export default {
  data: {
    bgColor: '#EEF7FB', titleCol: '#1F3A44', bizCol: '#0E93B0',
    btnBg: '#FFFFFF', btnTxt: '#1F3A44',
    bgCurName: '白',
    curHex: '#FFFFFF',
    pR0: OFF, pR1: OFF, pR2: OFF, pR3: OFF, pR4: OFF, pR5: OFF,
    pR6: OFF, pR7: OFF, pR8: OFF, pR9: OFF, pR10: OFF, pR11: OFF,
    pR12: OFF, pR13: OFF, pR14: OFF, pR15: OFF, pR16: OFF, pR17: OFF,
    pR18: OFF, pR19: OFF, pR20: OFF, pR21: OFF, pR22: OFF, pR23: OFF
  },
  onInit: function () {
    var m = Cfg.mods();
    this.sA = m.sA; this.rA = m.rA; this.fA = m.fA;
    this.cfg = Cfg.cfgArr('');
    this._touched = false;
    this.refresh();
    var that = this;
    Cfg.readCfg(this.sA, this.fA, function (c) {
      if (!that._touched) { that.cfg = c; that.refresh(); }
    });
  },
  refresh: function () {
    Cfg.trim(this.cfg);
    var c = this.cfg;
    var at = function (i) { var v = parseInt(c[i], 10); return isNaN(v) ? 0 : v; };
    var bi = Math.max(0, Math.min(23, at(17)));
    // 颜色位既可能是旧格式的预设索引，也可能是取色器存的 '#RRGGBB'
    this.curHex = Cfg.resolveColor(c[17], BGPAL);
    this.bgCurName = Cfg.colorName(c[17], BGPAL);
    for (var k = 0; k < 24; k++) { this['pR' + k] = (k === bi) ? ACCENT : OFF; }
  },
  persist: function () {
    this._touched = true;
    Cfg.saveCfg(this.sA, this.fA, this.cfg);
  },
  // 去取色器吸一个任意背景色（中转键：来源页 + 目标配置索引）
  pickColor: function () {
    Cfg.saveVal(this.sA, this.fA, 'or_pick_from', 'pages/settings_bg/settings_bg');
    Cfg.saveVal(this.sA, this.fA, 'or_pick_target', '17');
    Cfg.nav(this.rA, 'pages/colorpicker/colorpicker', {});
  },
  onShow: function () {
    // 从取色器返回时配置已被改写，重新读一次显示最新值
    var that = this;
    Cfg.readCfg(this.sA, this.fA, function (c) { that.cfg = c; that.refresh(); });
  },
  onBg: function (v) {
    var n = parseInt(v, 10); if (isNaN(n)) n = 0;
    this.cfg[17] = String(Math.max(0, Math.min(23, n)));
    this.refresh(); this.persist();
  },
  goBack: function () {
    var that = this;
    this.persist();
    setTimeout(function () { Cfg.nav(that.rA, 'pages/settings/settings', {}); }, 300);
  }
};
