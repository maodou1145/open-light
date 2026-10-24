// settings.js - 设置主页（分类入口：文字 / 背景 / 效果）
// 只负责汇总展示与跳转；配置由各子页维护，颜色表与默认值统一来自 common/cfg.js。
import Cfg from '../../common/cfg';

var PAL = Cfg.PAL;
var BGPAL = Cfg.BGPAL;
var DIRN = ['左滚', '右滚', '上滚', '下滚'];
// 与 settings_effect.js / run.js 保持同一换算：速度档 × 36 ≈ px/秒（30fps × 1.2px/帧）
var PX_PER_SEC_PER_GEAR = 36;

export default {
  data: {
    bgColor: '#EEF7FB', titleCol: '#1F3A44', bizCol: '#0E93B0',
    miBg: '#FFFFFF', miTx: '#1F3A44', miVal: '#6B7F87', miArrow: '#9BB0B8',
    btnBg: '#FFFFFF', btnTxt: '#1F3A44',
    fontVal: '蓝 · 1.5x', bgVal: '白', effVal: '180px/秒 · 左滚'
  },
  onInit: function () {
    var m = Cfg.mods();
    this.sA = m.sA; this.rA = m.rA; this.fA = m.fA;
    this.cfg = Cfg.cfgArr('');
    this.refresh();
    var that = this;
    // 只读展示：不改配置、不回写（避免在入口页误改用户的序号/配置）
    Cfg.readCfg(this.sA, this.fA, function (c) { that.refresh(c); });
  },
  refresh: function (c) {
    var cc = Cfg.trim(c || this.cfg);
    var at = function (i) { var v = parseInt(cc[i], 10); return isNaN(v) ? 0 : v; };
    var sz = parseFloat(cc[2]); if (isNaN(sz)) sz = 1.5;
    var sp = Math.max(1, Math.min(10, at(3)));
    this.fontVal = Cfg.colorName(cc[1], PAL) + ' · ' + sz + 'x';
    this.bgVal = Cfg.colorName(cc[17], BGPAL);
    this.effVal = Math.round(sp * PX_PER_SEC_PER_GEAR) + 'px/秒 · ' + DIRN[Math.max(0, Math.min(3, at(4)))];
  },
  goFont: function () { Cfg.nav(this.rA, 'pages/settings_font/settings_font', {}); },
  goBg: function () { Cfg.nav(this.rA, 'pages/settings_bg/settings_bg', {}); },
  goEffect: function () { Cfg.nav(this.rA, 'pages/settings_effect/settings_effect', {}); },
  goBack: function () { Cfg.nav(this.rA, 'pages/index/index', {}); }
};
