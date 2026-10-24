/**
 * run.js - 全屏跑马灯（Canvas 动画）
 *
 * 依据官方 Lite 文档实现：
 *   - canvas 组件自 API 5 支持，getContext 仅支持 "2d"
 *   - CanvasRenderingContext2D（Lite）只提供有限方法：fillRect / fillStyle / strokeRect /
 *     fillText / font / textAlign / lineWidth / strokeStyle / stroke / beginPath /
 *     moveTo / lineTo / closePath / arc / rect
 *     注意：**没有 clearRect、没有 measureText、没有 translate/rotate/save/restore**
 *   - 因此：每帧用 fillRect 刷满背景色代替清屏；文字宽度按字符类型自行估算
 *   - font 仅保证 sans-serif / serif / monospace，默认 30px HYQiHei-65S
 *
 * 方向（cfg[4]）：0=左滚 1=右滚 2=上滚 3=下滚
 *   上/下 = 横屏模式：整块画布用 @keyframes 旋转 90°，把表横过来看即为正常横向文字。
 *   注意：Lite 文档限定 rotate 只能写在 @keyframes 且「仅原尺寸 image 可旋转」，
 *   对 div/canvas 属平台边界试验；若真机上不旋转，上/下会表现为横向滚动。
 * 参数全部由 index 页经路由一次性传入，onInit 内同步定型；canvas 在 onReady/onShow 内取上下文并重试。
 * 若取不到 2D 上下文（极老固件），回退到原 marquee 实现，避免白屏。
 */

import Cfg from '../../common/cfg';

// 颜色表与设置页共用 common/cfg.js，避免两处各存一份 24 色导致索引错位
var COLS = Cfg.PAL;
var BGCOLS = Cfg.BGPAL;
var BASE_FONT = 36;
var DEF_TEXT = '铁头耄耋';
var FRAME_MS = 33;        // 约 30fps：lite 软件绘制，帧率不宜过高

function clampInt(v, min, max) {
  var n = parseInt(v, 10);
  if (isNaN(n)) n = min;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

// 路由跳转（liteWearable 的 @system.router 只有 replace）
function nav(rA, uri, params) {
  try {
    if (!rA) return;
    if (typeof rA.replace === 'function') { rA.replace({ uri: uri, params: params }); return; }
    if (typeof rA.replaceUrl === 'function') { rA.replaceUrl({ uri: uri, params: params }); }
  } catch (e) {}
}

// 单字符宽度估算（Lite 无 measureText）：CJK/全角按 1em，ASCII 约 0.58em
function charW(ch, fs) {
  var c = ch.charCodeAt(0);
  if (c > 0x2E7F) return fs;            // CJK、全角标点
  if (c === 32) return fs * 0.35;       // 空格
  if (c < 0x80) {
    if ('ilj.,;:!|\'`'.indexOf(ch) >= 0) return fs * 0.3;
    if ('mwMW@%'.indexOf(ch) >= 0) return fs * 0.85;
    return fs * 0.58;
  }
  return fs * 0.7;                      // 其他半角扩展字符
}
function textWidth(s, fs) {
  var w = 0;
  for (var i = 0; i < s.length; i++) w += charW(s.charAt(i), fs);
  return w;
}

export default {
  data: {
    // ── 路由参数（与 index.js goStart 传参同名）──
    t: '',
    colIdx: 0,      // 字体颜色索引（0~23）
    mult: '1.5',    // 字号倍数
    speed: 5,       // 速度档 1~10
    dirIdx: 0,      // 0=左滚 1=右滚 2=上滚 3=下滚
    keepIdx: 1,
    trackPx: 0,
    mirrorIdx: 0,
    bgIdx: 0,
    sq: 0,

    // ── 显示 ──
    mainCol: '#0A6CFF', bgColor: '#FFFFFF',
    cvW: '454px', cvH: '454px',
    rotShow: false,        // 横屏模式（上/下）：旋转容器的显示开关
    flatShow: true,        // 普通横向容器的显示开关

    // ── 兜底 marquee（仅当 canvas 取不到 2D 上下文时显示）──
    mqShow: false,
    mqLoop: -1,
    windowText: '跑马灯 跑马灯 跑马灯 跑马灯 ',
    mqW: '454px', mqH: '108px', mqFs: '54px',
    mqAmt: 10, mqDir: 'left', mqTrack: '0px'
  },
  onInit: function () {
    this.done = false;
    this.dead = false;       // 页面销毁标记：阻止销毁后的 canvas 重试回调继续跑
    this.ctx = null;
    this.timer = null;
    this.retryTimer = null;
    this.retry = 0;
    this.pos = 0;            // 滚动相位（首帧前先归零，避免 NaN 相位）
    this.bA = null; this.rA = null;
    try { this.bA = require('@system.brightness'); } catch (e) { this.bA = null; }
    try { this.rA = require('@system.router'); } catch (e) { this.rA = null; }
    this.build();
  },
  // 同步定型：尺寸/颜色/文本/相位周期一次算好
  build: function () {
    try {
      var sq = clampInt(this.sq, 0, 1) === 1;
      var spd = clampInt(this.speed, 1, 10);
      var mult = parseFloat(this.mult);
      if (isNaN(mult)) mult = 1.5;
      mult = Math.max(0.5, Math.min(3, mult));

      this.bgColor = Cfg.resolveColor(this.bgIdx, Cfg.BGPAL);
      this.mainCol = Cfg.resolveColor(this.colIdx, Cfg.PAL);
      this.dir = clampInt(this.dirIdx, 0, 3);
      // 上/下 = 横屏模式：整块画布旋转 90°，用户把表横过来即可正常阅读。
      // Lite 的 rotate 只能在 @keyframes 中声明（不能动态绑定、官方仅保证 image 生效），
      // 这里用「静态 class + 一次性动画 + forwards」挂到画布外层，属平台边界试验。
      this.rot = (this.dir === 2 || this.dir === 3);
      var side = sq ? 408 : 454;
      this.W = side;                                  // 旋转后画布取正方形，避免被屏幕裁切
      this.H = this.rot ? side : (sq ? 480 : 454);
      this.cvW = this.W + 'px';
      this.cvH = this.H + 'px';
      this.rotShow = this.rot;
      this.flatShow = !this.rot;
      this.sign = (this.dir === 0 || this.dir === 2) ? -1 : 1;   // 横屏时：内部左移 = 屏上往上

      var f = Math.round(BASE_FONT * mult);
      if (!sq) { f = Math.round(f * 0.9); }   // 圆屏等比例缩至 90%
      this.fs = f;
      this.track = clampInt(this.trackPx, 0, 200);

      var base = (typeof this.t === 'string' && this.t !== '') ? this.t : DEF_TEXT;
      if (clampInt(this.mirrorIdx, 0, 1) === 1) {
        var rev = '';
        for (var i = base.length - 1; i >= 0; i--) rev += base.charAt(i);
        base = rev;
      }

      // 横向：把文本重复到至少 1.2 屏，作为「一个周期」整体滚动，避免大量副本逐帧绘制
      var unit = base, period = textWidth(unit, f);
      var guard = 0;
      while (period < this.W * 1.2 && guard < 60) {
        unit += ' ' + base;
        period = textWidth(unit, f);
        guard++;
      }
      this.unit = unit;
      this.period = Math.max(period + f * 0.6, 10);   // 周期末尾留一点空隙
      this.baseY = Math.round(this.H / 2 + f * 0.35); // 滚动基线（垂直居中）

      // 步进：档位 1~10 → 每帧 1.2~12px（30fps 下约 36~360px/秒）
      this.step = spd * 1.2;

      // 兜底 marquee 参数（横向；横屏模式回退时同样横向，不旋转）
      var full = '';
      for (var k = 0; k < 6; k++) full += base + ' ';
      this.windowText = full;
      this.mqFs = f + 'px';
      this.mqW = this.W + 'px';
      this.mqH = (f * 2) + 'px';
      this.mqAmt = spd * 2;
      this.mqDir = (this.dir === 1) ? 'right' : 'left';
      this.mqTrack = this.track + 'px';

      if (clampInt(this.keepIdx, 0, 1) === 1 && this.bA) {
        try { this.bA.setKeepScreenOn({ keepScreenOn: true }); } catch (e) {}
      }
    } catch (e) {
      // 兜底：保持长内容（绝不设短文本）
      var b = (typeof this.t === 'string' && this.t !== '') ? this.t : 'Open Light';
      var s = '';
      for (var m = 0; m < 6; m++) s += b + ' ';
      this.windowText = s;
      this.W = 454; this.H = 454; this.fs = 54; this.period = 500; this.unit = b;
      this.baseY = 250;
      this.step = 6; this.sign = -1; this.dir = 0; this.rot = false;
      this.rotShow = false; this.flatShow = true;
    }
  },
  onReady: function () { this.initCanvas(); },
  onShow: function () { this.initCanvas(); },
  onHide: function () { this.stopLoop(); this.stopRetry(); },
  onDestroy: function () {
    this.dead = true;
    this.stopLoop();
    this.stopRetry();
    if (this.bA) { try { this.bA.setKeepScreenOn({ keepScreenOn: false }); } catch (e) {} }
  },
  // 重试链的计时器必须能被取消，否则页面销毁后回调还会去碰已失效的 $refs
  stopRetry: function () {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  },
  // 取 2D 上下文：refs 可能尚未就绪，失败重试；全部失败则回退 marquee
  initCanvas: function () {
    if (this.dead) return;
    if (this.ctx) { this.startLoop(); return; }
    var el = null;
    if (this.$refs) { el = this.rot ? this.$refs.cvRot : this.$refs.cv; }
    if (el && typeof el.getContext === 'function') {
      try { this.ctx = el.getContext('2d'); } catch (e) { this.ctx = null; }
    }
    if (this.ctx) {
      this.pos = 0;
      this.paint();
      this.startLoop();
      return;
    }
    this.retry++;
    if (this.retry < 20) {
      var that = this;
      this.stopRetry();
      this.retryTimer = setTimeout(function () { that.retryTimer = null; that.initCanvas(); }, 100);
    } else {
      this.useFallback();   // 老固件无 canvas 2D：回退 marquee
    }
  },
  useFallback: function () {
    this.rotShow = false;
    this.flatShow = false;
    this.mqShow = true;
    if (this.bA && clampInt(this.keepIdx, 0, 1) === 1) {
      try { this.bA.setKeepScreenOn({ keepScreenOn: true }); } catch (e) {}
    }
  },
  startLoop: function () {
    if (this.timer) return;
    var that = this;
    this.timer = setInterval(function () { that.tick(); }, FRAME_MS);
  },
  stopLoop: function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },
  tick: function () {
    this.pos += this.sign * this.step;
    this.paint();
  },
  // 每帧：实底刷背景（Lite 无 clearRect）+ 按相位绘制文本副本
  paint: function () {
    var ctx = this.ctx;
    if (!ctx) return;
    if (typeof this.pos !== 'number' || !isFinite(this.pos)) this.pos = 0;
    try {
      ctx.fillStyle = this.bgColor;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.fillStyle = this.mainCol;
      ctx.font = this.fs + 'px sans-serif';
      ctx.textAlign = 'left';

      var px = this.period;
      var phase = ((this.pos % px) + px) % px;
      var x0 = phase - px;
      var n = Math.ceil(this.W / px) + 2;
      for (var i = 0; i < n; i++) {
        this.drawLine(this.unit, Math.round(x0 + i * px), this.baseY);
      }
    } catch (e) {}
  },
  // 绘制一行；track>0 时逐字绘制以模拟字间距（Lite 无 letterSpacing）
  drawLine: function (s, x, y) {
    var ctx = this.ctx;
    if (!ctx) return;
    if (this.track <= 0) { ctx.fillText(s, x, y); return; }
    var cx = x;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      ctx.fillText(ch, Math.round(cx), y);
      cx += charW(ch, this.fs) + this.track;
    }
  },
  onSwipe: function (e) {
    // 左滑 / 右滑均可退出
    var dir = (e && e.direction) ? e.direction : (e && e.type);
    if (dir === 'right' || dir === 'left') this.goBack();
  },
  goBack: function () {
    if (this.done) return;
    this.done = true;
    this.stopLoop();
    if (this.bA) { try { this.bA.setKeepScreenOn({ keepScreenOn: false }); } catch (e) {} }
    nav(this.rA, 'pages/index/index', {});
  }
};
