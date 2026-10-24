// welcome.js - 欢迎页（应用入口页）
//
// 为什么每次冷启动都会经过这里：config.json 的 js[].pages 第一项就是入口页，
// 这个定义写死、不随"上次从哪退出"变化。所以真正的开关放在这里：
//   - 首次启动（or_flag_welcome 未置位）→ 完整播 3 秒动画
//   - 之后启动（已置位）→ 首帧就 Cfg.nav 到主界面，不播动画
// 注意：入口页无法完全不渲染，标记又是异步读的，所以老用户会看到极短一帧（几十 ms）。
//
// Lite 的 opacity 只能通过数据绑定逐帧更新（@keyframes 不支持 opacity），
// 这里用 33ms 时间轴驱动 opacity，ease-out cubic。
import Cfg from '../../common/cfg';

var TOTAL_MS = 3000;   // 首次启动的自动进入时间
var FLAG_KEY = 'welcome';

function ease(t) {
  if (t < 0) t = 0; if (t > 1) t = 1;
  return 1 - Math.pow(1 - t, 3);
}

export default {
  data: {
    bgOp: 0,
    titleOp: 0,
    btnOp: 0,
    hintOp: 0,
    ww: '260px',
    wh: '96px',
    wfs: '25px'
  },
  onInit: function () {
    this.done = false;
    this.timer = null;
    var m = Cfg.mods();
    this.sA = m.sA; this.rA = m.rA; this.fA = m.fA;
  },
  onShow: function () {
    var that = this;
    // 先查"是否看过"：看过则静默跳过，不播动画
    Cfg.readFlag(this.sA, this.fA, FLAG_KEY, function (seen) {
      if (that.done) return;
      if (seen) { that.enter(); return; }
      that.start();
    });
  },
  onHide: function () { this.stop(); },
  onDestroy: function () { this.stop(); },
  start: function () {
    if (this.timer) return;
    var that = this;
    this.t0 = Date.now();
    this.tick();
    this.timer = setInterval(function () { that.tick(); }, 33);
  },
  stop: function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.wtm) { clearInterval(this.wtm); this.wtm = null; }
  },
  // 按下缩放：33ms 逐帧插值宽高（Lite 无 transform scale）
  tweenW: function (target, dur) {
    var that = this;
    if (this.wtm) { clearInterval(this.wtm); this.wtm = null; }
    if (typeof this.wsc !== 'number') this.wsc = 1;
    var from = this.wsc;
    var t0 = Date.now();
    this.wtm = setInterval(function () {
      var t = Math.min((Date.now() - t0) / dur, 1);
      var e = 1 - Math.pow(1 - t, 3);
      var sc = from + (target - from) * e;
      that.wsc = sc;
      that.ww = Math.round(260 * sc) + 'px';
      that.wh = Math.round(96 * sc) + 'px';
      that.wfs = Math.round(25 * sc) + 'px';
      if (t >= 1) { clearInterval(that.wtm); that.wtm = null; }
    }, 33);
  },
  pressStart: function () { this.tweenW(0.94, 90); },
  releaseStart: function () { this.tweenW(1, 140); },
  tick: function () {
    var e = Date.now() - this.t0;
    this.bgOp = ease(e / 650);
    this.titleOp = ease((e - 150) / 700);
    this.btnOp = ease((e - 900) / 450);
    this.hintOp = ease((e - 1200) / 400) * 0.75;
    if (e >= TOTAL_MS) this.enter();
  },
  enter: function () {
    if (this.done) return;
    this.done = true;
    this.stop();
    // 置位"已看过"：写失败（storage/file 都不可用）时下次仍会播动画，属可接受降级
    Cfg.saveFlag(this.sA, this.fA, FLAG_KEY, '1');
    Cfg.nav(this.rA, 'pages/index/index', {});
  },
  onSwipe: function (e) {
    // 右滑：直接退到表盘（欢迎页是根页，back 即结束应用）
    var dir = (e && e.direction) ? e.direction : (e && e.type);
    if (dir === 'right' && this.rA) {
      try { this.rA.back(); } catch (e2) { try { this.rA.clear(); } catch (e3) {} }
    }
  }
};
