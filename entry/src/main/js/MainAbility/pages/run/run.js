/**
 * run.js - 全屏跑马灯（持续循环滚动）
 *
 * 修复「运行中有概率卡死、文字停在屏幕中央不再滚动」：
 *  - 显示参数全部由 index 页经路由参数一次性传入，onInit 内**同步**算好 → 首帧即定型；
 *    不再在挂载后异步（定时器/屏型回调）改写 marquee 的文本与尺寸——滚动中被改样式/文本，引擎会停住不再滚。
 *  - 内容长度按「约 3 屏」计算：既保证一定滚得起来（短于容器 marquee 不滚，就是卡死的样子），又避免超长文本排版卡顿。
 *  - 异常兜底绝不把文本设成短串。
 *  - 只做循环滚动（原「单次」选项已移除，那会让文字静止在屏上、容易被当成卡死）。
 */

var COLS = [
  ['#0A6CFF','蓝'],['#00BCD4','青'],['#4CAF50','绿'],['#FFEB3B','黄'],
  ['#FF9800','橙'],['#F44336','红'],['#9C27B0','紫'],['#000000','黑'],['#FFFFFF','白']
];
var BGCOLS = [
  ['#FFFFFF','白'],['#121212','黑'],['#1E1E1E','深灰'],['#F5F6F8','浅灰'],
  ['#0A6CFF','蓝'],['#00BCD4','青'],['#9C27B0','紫'],['#F44336','红'],['#4CAF50','绿']
];
var BASE_FONT = 36;
var DEF_TEXT = '铁头耄耋';

function clampInt(v, min, max) {
  var n = parseInt(v, 10);
  if (isNaN(n)) n = min;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

// 路由跳转（liteWearable 的 @system.router 只有 replace，无 replaceUrl/push）
function nav(rA, uri, params) {
  try {
    if (!rA) return;
    if (typeof rA.replace === 'function') { rA.replace({ uri: uri, params: params }); return; }
    if (typeof rA.replaceUrl === 'function') { rA.replaceUrl({ uri: uri, params: params }); }
  } catch (e) {}
}

export default {
  data: {
    // ── 路由参数（与 index.js goStart 传参同名）──
    t: '',
    colIdx: 0,      // 字体颜色索引
    mult: '1.5',    // 字号倍数
    speed: 5,       // 速度档 1~10
    dirIdx: 0,      // 0=左滚 1=右滚
    boldIdx: 1,     // 1=加粗
    keepIdx: 1,     // 1=屏幕常亮
    trackPx: 0,     // 字间距(px)
    mirrorIdx: 0,   // 1=镜像文字
    bgIdx: 0,       // 背景色索引
    sq: 0,          // 1=方屏

    // ── 显示（onInit 内同步定型后不再改动）──
    // 初值故意给长串：即使首帧早于 onInit，marquee 也是"长内容"起手，不会建成静止态
    windowText: '跑马灯 跑马灯 跑马灯 跑马灯 跑马灯 ',
    mqW: '454px', mqH: '108px', mqFs: '54px',
    amt: 5, dir: 'left', lp: -1,
    track: '0px', fw: 'bold',
    mainCol: '#0A6CFF', bgColor: '#FFFFFF'
  },
  onInit: function () {
    this.done = false;
    this.bA = null; this.rA = null;
    try { this.bA = require('@system.brightness'); } catch (e) { this.bA = null; }
    try { this.rA = require('@system.router'); } catch (e) { this.rA = null; }
    this.build();
  },
  // 同步定型：尺寸/颜色/内容一次算好（挂载后不再改 marquee，避免引擎停滚）
  build: function () {
    try {
      var sq = clampInt(this.sq, 0, 1) === 1;
      var spd = clampInt(this.speed, 1, 10);
      var mult = parseFloat(this.mult);
      if (isNaN(mult)) mult = 1.5;
      mult = Math.max(0.5, Math.min(3, mult));

      this.bgColor = BGCOLS[clampInt(this.bgIdx, 0, 8)][0];
      this.mainCol = COLS[clampInt(this.colIdx, 0, 8)][0];
      this.dir = clampInt(this.dirIdx, 0, 1) === 1 ? 'right' : 'left';
      this.fw = clampInt(this.boldIdx, 0, 1) === 1 ? 'bold' : 'normal';
      // 速度加倍（档位 1~10 → scrollamount 2~20）：整体滚得更快，两遍之间的空档也随之减半
      this.amt = spd * 2;

      var f = Math.round(BASE_FONT * mult);
      if (!sq) { f = Math.round(f * 0.9); }   // 圆屏：等比例缩至 90%（方屏不缩）
      var cw = sq ? 408 : 454;
      this.mqFs = f + 'px';
      this.mqW = cw + 'px';
      this.mqH = Math.round(f * 2) + 'px';
      this.track = clampInt(this.trackPx, 0, 9999) + 'px';

      var base = (typeof this.t === 'string' && this.t !== '') ? this.t : DEF_TEXT;
      if (clampInt(this.mirrorIdx, 0, 1) === 1) {
        var rev = '';
        for (var i = base.length - 1; i >= 0; i--) rev += base[i];
        base = rev;
      }
      this.baseText = base;

      // 内容 = 约 3 屏（宽于容器才滚得起来；份数上限防超长文本卡顿）
      var oneW = Math.max(f, base.length * f) + f;
      var cnt = Math.ceil((cw * 3) / oneW);
      if (cnt < 3) cnt = 3;
      if (cnt > 30) cnt = 30;
      var full = '';
      for (var k = 0; k < cnt; k++) full += base + ' ';
      this.windowText = full;

      if (clampInt(this.keepIdx, 0, 1) === 1 && this.bA) {
        try { this.bA.setKeepScreenOn({ keepScreenOn: true }); } catch (e) {}
      }
    } catch (e) {
      // 兜底：保持长内容（绝不设短文本——短文本 marquee 不滚，会被当成卡死）
      var b = (typeof this.t === 'string' && this.t !== '') ? this.t : 'Oride';
      var s = '';
      for (var m = 0; m < 6; m++) s += b + ' ';
      this.windowText = s;
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
    if (this.bA) { try { this.bA.setKeepScreenOn({ keepScreenOn: false }); } catch (e) {} }
    nav(this.rA, 'pages/index/index', {});
  }
};
