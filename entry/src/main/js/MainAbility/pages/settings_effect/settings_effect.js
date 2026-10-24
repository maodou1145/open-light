// settings_effect.js - 效果设置（速度 / 方向 / 镜像 / 屏幕常亮）
// 配置索引：3=速度 4=方向 7=常亮 15=镜像；读写统一走 common/cfg.js。
// 方向 0=左滚 1=右滚 2=上滚 3=下滚；上/下 = 横屏模式（画布旋转 90°，横着拿表阅读）。
import Cfg from '../../common/cfg';

var TG = { blue: '#0E93B0', white: '#FFFFFF' };
// run.js 每帧步进 = 速度档 × 1.2px，帧间隔 33ms（约 30.3 帧/秒）
// → 真实速度 ≈ 速度档 × 36 px/秒，界面按这个换算显示，不再用"档位数字当 px/秒"糊弄。
var PX_PER_SEC_PER_GEAR = 36;

export default {
  data: {
    bgColor: '#EEF7FB', titleCol: '#1F3A44', bizCol: '#0E93B0',
    btnBg: '#FFFFFF', btnTxt: '#1F3A44', sldCol: '#DCE6EA', sldSel: '#0E93B0',
    speedVal: 5, vSpeed: '180px/秒', spdFill: '48px',
    dir0: '', dir1: '', dir2: '', dir3: '',
    dirT0: '', dirT1: '', dirT2: '', dirT3: '',
    mir0: '', mir1: '', mirT0: '', mirT1: '',
    keep0: '', keep1: '', keepT0: '', keepT1: ''
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
  // 二选一按钮的高亮：选中项蓝底白字（字段名 p+'0'/p+'1'，文字色 p+'T0'/p+'T1'）
  seg2: function (active, p) {
    this[p + '0'] = (active === 0) ? TG.blue : this.btnBg;
    this[p + 'T0'] = (active === 0) ? TG.white : this.btnTxt;
    this[p + '1'] = (active === 1) ? TG.blue : this.btnBg;
    this[p + 'T1'] = (active === 1) ? TG.white : this.btnTxt;
  },
  // 四选一（滚动方向）：0 左 1 右 2 上 3 下
  seg4: function (active, p) {
    for (var i = 0; i < 4; i++) {
      this[p + i] = (i === active) ? TG.blue : this.btnBg;
      this[p + 'T' + i] = (i === active) ? TG.white : this.btnTxt;
    }
  },
  refresh: function () {
    Cfg.trim(this.cfg);
    var c = this.cfg;
    var at = function (i) { var v = parseInt(c[i], 10); return isNaN(v) ? 0 : v; };
    this.speedVal = Math.max(1, Math.min(10, at(3)));
    this.vSpeed = Math.round(this.speedVal * PX_PER_SEC_PER_GEAR) + 'px/秒';
    var t = (this.speedVal - 1) / 9;
    this.spdFill = Math.round(t * 140) + 'px';
    this.seg4(Math.max(0, Math.min(3, at(4))), 'dir');
    this.seg2(at(15) === 1 ? 1 : 0, 'mir');
    this.seg2(at(7) === 1 ? 1 : 0, 'keep');
  },
  persist: function () {
    this._touched = true;
    Cfg.saveCfg(this.sA, this.fA, this.cfg);
  },
  onSpeed: function (e) { this.cfg[3] = String(e.value); this.refresh(); this.persist(); },
  decSpeed: function () { this.onSpeed({ value: Math.max(1, this.speedVal - 1) }); },
  incSpeed: function () { this.onSpeed({ value: Math.min(10, this.speedVal + 1) }); },
  setDir: function (v) {
    var n = parseInt(v, 10); if (isNaN(n)) n = 0;
    this.cfg[4] = String(Math.max(0, Math.min(3, n)));
    this.refresh(); this.persist();
  },
  setMirror: function (v) { this.cfg[15] = String(v); this.refresh(); this.persist(); },
  setKeep: function (v) { this.cfg[7] = String(v); this.refresh(); this.persist(); },
  goBack: function () {
    var that = this;
    this.persist();
    setTimeout(function () { Cfg.nav(that.rA, 'pages/settings/settings', {}); }, 300);
  }
};
