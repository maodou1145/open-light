// colorpicker.js - 取色器（色轮直接吸色）
//
// 为什么能取色：ACE Engine Lite 的 EventUtil::CreateEvent 会给**所有**事件对象
// （click / longpress / swipe / touch）都写入 globalX / globalY 屏幕坐标，
// 所以 touchstart / touchmove 回调里能拿到手指的屏幕位置（源码：
// openharmony/arkui_ace_engine_lite frameworks/src/core/base/event_util.cpp）。
//
// 色轮与取色数学必须和 tools/make_hue_wheel.py 完全一致：
//   r  = 距圆心距离 / 半径          -> S = (r - 0.10) / 0.90，中心 10% 是白
//   θ  = atan2(dy, dx)              -> H = (θ + 360) % 360
//   V  = 1
//
// ⚠ 待真机校准：DY 是"页面原点 vs 屏幕原点"的垂直偏移。
// 若真机上取到的颜色明显偏上/偏下，把 DY 调成实测差值即可（页面上有实时坐标显示）。
import Cfg from '../../common/cfg';

var PICK_FROM = 'or_pick_from';     // 中转：发起取色的页面 URI（确定后返回它）
var PICK_TARGET = 'or_pick_target'; // 中转：要改的配置索引（1=文字色 17=背景色）

// 几何常量：与 hue_wheel_c.png / hue_wheel_r.png 的画布尺寸对应
var GEO = {
  circle: { cx: 233, cy: 233, r: 130, h: 466, panelTop: 362 },   // 圆屏 466x466
  rect:   { cx: 204, cy: 240, r: 130, h: 480, panelTop: 382 }    // 方屏 408x480
};
var DY = 0;      // 真机校准用的垂直偏移（屏幕坐标 = 页面坐标 + DY）

function hsv2hex(h, s, v) {
  var i = Math.floor(h / 60.0) % 6;
  var f = h / 60.0 - Math.floor(h / 60.0);
  var p = v * (1 - s);
  var q = v * (1 - f * s);
  var t = v * (1 - (1 - f) * s);
  var r = 0, g = 0, b = 0;
  if (i === 0) { r = v; g = t; b = p; }
  else if (i === 1) { r = q; g = v; b = p; }
  else if (i === 2) { r = p; g = v; b = t; }
  else if (i === 3) { r = p; g = q; b = v; }
  else if (i === 4) { r = t; g = p; b = v; }
  else { r = v; g = p; b = q; }
  var to2 = function (x) {
    var s2 = Math.round(x * 255).toString(16);
    return s2.length < 2 ? '0' + s2 : s2;
  };
  return ('#' + to2(r) + to2(g) + to2(b)).toUpperCase();
}

export default {
  data: {
    isSq: false,
    notSq: true,
    panelTop: '362px',
    curHex: '#0A6CFF',
    hexTxt: '#0A6CFF',
    dbg: '',
    btnBg: '#FFFFFF', btnTxt: '#1F3A44', bizCol: '#0E93B0'
  },
  onInit: function () {
    var m = Cfg.mods();
    this.sA = m.sA; this.rA = m.rA; this.fA = m.fA;
    this.done = false;
    this.cx = GEO.circle.cx;
    this.cy = GEO.circle.cy;
    this.R = GEO.circle.r;
    this.backUri = 'pages/settings/settings';
    this.target = 1;
    var that = this;
    // 判屏型：圆屏/方屏用不同的整屏色轮 PNG 与圆心坐标
    Cfg.isSquare(function (sq) {
      var g = sq ? GEO.rect : GEO.circle;
      that.isSq = sq;
      that.notSq = !sq;
      that.cx = g.cx;
      that.cy = g.cy;
      that.R = g.R || g.r;
      that.panelTop = g.panelTop + 'px';
    });
    // 读中转信息：确定后回到发起页，并改对应的颜色位
    Cfg.readVal(this.sA, this.fA, PICK_FROM, function (uri) {
      if (uri) that.backUri = uri;
    });
    Cfg.readVal(this.sA, this.fA, PICK_TARGET, function (t) {
      var n = parseInt(t, 10);
      if (!isNaN(n) && (n === 1 || n === 17)) {
        that.target = n;
        // 初始色对齐当前配置中的颜色
        Cfg.readCfg(that.sA, that.fA, function (cfg) {
          var c = cfg[n];
          var pal = (n === 17 ? Cfg.BGPAL : Cfg.PAL);
          var hex = Cfg.resolveColor(c, pal);
          if (hex) {
            that.curHex = hex;
            that.hexTxt = hex;
          }
        });
      }
    });
  },
  onReady: function () { },
  onShow: function () { },
  // 触摸取色：touchstart / touchmove 共用
  onTouch: function (e) {
    var ev = e || {};
    var gx = ev.globalX, gy = ev.globalY;
    if (typeof gx !== 'number' || typeof gy !== 'number') return;
    this.dbg = 'g(' + gx + ',' + gy + ')';
    var cx = this.cx, cy = this.cy + DY;
    var dx = gx - cx;
    var dy = gy - cy;
    var r = Math.sqrt(dx * dx + dy * dy);
    if (r > this.R) return;                    // 点在轮外，忽略
    var rn = r / this.R;
    var s = (rn - 0.10) / 0.90;                // 与 PNG 的白色中心洞一致
    if (s < 0) s = 0;
    if (s > 1) s = 1;
    var h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    var hex = hsv2hex(h, s, 1.0);
    this.curHex = hex;
    this.hexTxt = hex;
  },
  ok: function () {
    if (this.done) return;
    this.done = true;
    var that = this;
    // 把吸到的颜色写进配置串（对应索引），再存盘
    Cfg.readCfg(this.sA, this.fA, function (cfg) {
      cfg[that.target] = that.curHex;
      Cfg.saveCfg(that.sA, that.fA, cfg);
      Cfg.nav(that.rA, that.backUri, {});
    });
  },
  cancel: function () {
    if (this.done) return;
    this.done = true;
    Cfg.nav(this.rA, this.backUri, {});
  }
};
