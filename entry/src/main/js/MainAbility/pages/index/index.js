/**
 * index.js - 主界面逻辑
 * - 大号数字时钟（每秒刷新）
 * - 输入文字（持久化 or_text）
 * - 跳转设置 / 开始启动
 */
import Net from '../../common/net';
import Cfg from '../../common/cfg';

// 默认配置快照由 common/cfg.js 统一维护（索引契约见该文件头注释）

// 方形屏检测统一走 common/cfg.js 的 isSquare（lite 不支持 CSS @media，
// 判据是 @system.device.getInfo() 的 screenShape，判定失败一律按圆屏）

// 路由跳转统一走 common/cfg.js 的 nav（liteWearable 的 @system.router 只有 replace）
var nav = Cfg.nav;

export default {
  data: {
    clock: '00:00',   // 大号时钟（仅时:分，无秒）
    text: '',            // 输入文字
    tiText: '请输入文字',  // 输入框展示内容（空=占位，非空=实际文字）
    tiColor: '#7A97A3',  // 展示颜色（占位灰 / 实值强调色）
    bgColor: '#EEF7FB',
    cardBg: '#FFFFFF',
    mainCol: '#0C6E80',  // 时间：深青（方案 C）
    brandCol: '#4E8794', // 小品牌字：弱化青灰
    // 浅色玻璃主题：文字/输入框/按钮配色
    txtCol: '#1F3A44',   // 输入框实值文字色
    tiPhCol: '#7A97A3',  // 输入框占位文字色
    tiBg: '#FFFFFF',     // 保留字段（当前由 PNG 背景承载）
    tiBd: '#FFFFFF',
    btnBg: '#FFFFFF',
    btnTxt: '#1F3A44',   // 次按钮文字
    pBtnBg: '#17B6D6',   // 主按钮（PNG 已烘焙，此值仅兼容旧逻辑）
    pBtnTxt: '#FFFFFF',  // 主按钮文字
    // 按下缩放：图片宽高逐帧插值（Lite 无 transform scale）
    fw: '356px', fh: '88px',
    sw: '190px', sh: '80px',
    pw: '190px', ph: '84px',
    ffs: '16px', sfs: '17px', pfs: '17px',
    textMain: '#333333',
    clockSize: '46px',   // 大时间字号（方形屏 50px，applyShape 覆盖）
    clockMB: '12px'      // 时间下间距（方形屏 16px，applyShape 覆盖）
  },
  onInit: function () {
    var m = Cfg.mods();
    this.sA = m.sA; this.rA = m.rA; this.fA = m.fA;

    var that = this;
    that.dark = false;
    // 从螃蟹键盘页（keyboard_circle / keyboard_rect）返回：接收已编辑文字
    // 契约：确定 → 回填内容；取消 → 回填空串（此时保留原文字，不清空）
    if (typeof this.inputWords === 'string' && this.inputWords !== '') {
      this.text = this.inputWords;
      that.saveText(this.inputWords);
    }
    // 旧自绘输入页返回参数（已停用，保留兼容）
    if (typeof this.t === 'string' && this.t !== '') {
      this.text = this.t;
      that.saveText(this.t);
    }
    this.syncText();
    // 方形屏检测（异步，结果到达后应用方形专用样式；同时记录屏型供键盘选择）
    Cfg.isSquare(function (sq) { that.isSq = sq; that.applyShape(sq); });
    this.loadLocal();
    this.startClock();
  },
  // 读本地存储：storage + 文件双通道，配置按写入序号（索引 13）取新的一份。
  // 与设置页共用 common/cfg.js 的读逻辑，避免两边读到不同值。
  loadLocal: function () {
    var that = this;
    Cfg.readText(this.sA, this.fA, function (v) {
      if (v !== '') { that.text = v; that.syncText(); }
    });
    Cfg.readCfg(this.sA, this.fA, function (c) {
      that.cfg = c;          // 启动跑马灯时把显示参数一并传给跑马灯页
      that.applyTheme(0);    // 深色模式已移除，主题恒浅色
    });
  },
  applyTheme: function (m) {
    // 方案 C 固定浅色玻璃主题；m 参数保留兼容旧配置
    this.dark = false;
    this.bgColor = '#EEF7FB';
    this.cardBg = '#FFFFFF';
    this.mainCol = '#0C6E80';
    this.txtCol = '#1F3A44';
    this.tiPhCol = '#7A97A3';
    this.tiBg = '#FFFFFF';
    this.tiBd = '#FFFFFF';
    this.btnBg = '#FFFFFF';
    this.btnTxt = '#1F3A44';
    this.syncText();        // 重算输入框文字色（占位/实值跟随主题）
  },
  // ── 方形屏专用样式（FIT 408x480 等机型应用）────────────
  // 方形屏垂直空间更充裕：时钟加大、间距拉开，内容更透气。
  applyShape: function (sq) {
    if (sq) {
      this.clockSize = '50px';
      this.clockMB = '16px';
    } else {
      this.clockSize = '46px';
      this.clockMB = '12px';
    }
  },
  // 文字持久化：storage + 文件双写，storage 不可用时仍写文件（见 common/cfg.js）
  saveText: function (v) {
    Cfg.saveText(this.sA, this.fA, v);
  },
  onShow: function () {},
  syncText: function () {
    var v = this.text || '';
    if (v === '') {
      this.tiText = '请输入文字';
      this.tiColor = this.tiPhCol;   // 占位色跟随主题
    } else {
      this.tiText = v;
      this.tiColor = this.txtCol;    // 实值文字色跟随主题
    }
  },
  // 点击输入框 → 打开螃蟹键盘（crabKeyboard，MIT）
  // 圆表 → pages/keyboard_circle（466 布局）；方表 → pages/keyboard_rect（408 布局），两套独立界面
  openInput: function () {
    var that = this;
    var go = function (rect) {
      nav(that.rA, rect ? 'pages/keyboard_rect/keyboard' : 'pages/keyboard_circle/keyboard', {
        targetPage: '/pages/index/index',   // 完成/取消后回到本页
        backPage: '/pages/index/index',
        targetKey: 'inputWords',            // 回填字段（与本页 data 同名）
        prompt: '请输入文字',
        maxLen: 0,
        forbidden: '',
        allowNewline: false,
        keyType: 0,
        initial: this.text || ''    // 编辑已有文字：带入上次保存的内容
      });
    };
    if (typeof this.isSq === 'boolean') { go(this.isSq); return; }   // onInit 已检测过屏型
    Cfg.isSquare(function (sq) { that.isSq = sq; go(sq); });             // 未就绪则即时检测
  },
  startClock: function () {
    var that = this;
    this.pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    this.tick();
    if (this.clockTimer) return;
    this.clockTimer = setInterval(function () { that.tick(); }, 1000);
  },
  tick: function () {
    var now = new Date();
    this.clock = this.pad(now.getHours()) + ':' + this.pad(now.getMinutes());   // 仅到分钟，不显示秒
  },
  // 输入变化：由自绘输入页完成（openInput -> input/cand 页），此处仅回写
  goSettings: function () {
    nav(this.rA, 'pages/settings/settings', {});
  },
  goStart: function () {
    var t = (this.text || '').trim();
    if (t === '') {
      t = 'maodou';      // 空文本回退默认
      this.text = t;
      this.saveText(t);
    }
    // 显示参数（颜色/字号/速度/播放次数/背景等）一次性随路由传给跑马灯页：
    // 该页在 onInit 内同步定型，挂载后不再改 marquee——滚动中被改样式/文本会让引擎停住不再滚。
    nav(this.rA, 'pages/run/run', this.flowParams(t));
  },
  // ── 按下缩放：33ms 逐帧插值宽高（Lite 不能用 transform scale）──
  // SZ 为各按钮的基准尺寸；按下缩到 94%，松手弹回，ease-out cubic。
  tweenSize: function (k, target, dur) {
    var SZ = { f: [356, 88, 16], s: [190, 80, 17], p: [190, 84, 17] };
    var base = SZ[k];
    if (!this.sz) this.sz = { f: 1, s: 1, p: 1 };
    if (!this.tm) this.tm = {};
    if (this.tm[k]) { clearInterval(this.tm[k]); this.tm[k] = null; }
    var from = this.sz[k];
    var that = this;
    var t0 = Date.now();
    this.tm[k] = setInterval(function () {
      var t = Math.min((Date.now() - t0) / dur, 1);
      var e = 1 - Math.pow(1 - t, 3);
      var sc = from + (target - from) * e;
      that.sz[k] = sc;
      var w = Math.round(base[0] * sc);
      var h = Math.round(base[1] * sc);
      var fs = Math.round(base[2] * sc);
      if (k === 'f') { that.fw = w + 'px'; that.fh = h + 'px'; that.ffs = fs + 'px'; }
      else if (k === 's') { that.sw = w + 'px'; that.sh = h + 'px'; that.sfs = fs + 'px'; }
      else { that.pw = w + 'px'; that.ph = h + 'px'; that.pfs = fs + 'px'; }
      if (t >= 1) { clearInterval(that.tm[k]); that.tm[k] = null; }
    }, 33);
  },
  pressField: function () { this.tweenSize('f', 0.94, 90); },
  releaseField: function () { this.tweenSize('f', 1, 140); },
  pressSet: function () { this.tweenSize('s', 0.94, 90); },
  releaseSet: function () { this.tweenSize('s', 1, 140); },
  pressStart: function () { this.tweenSize('p', 0.94, 90); },
  releaseStart: function () { this.tweenSize('p', 1, 140); },
  // 右滑返回表盘（首页是 FA 根页，router.back() 即结束应用回到表盘）
  onSwipe: function (e) {
    var dir = (e && e.direction) ? e.direction : (e && e.type);
    if (dir === 'right' && this.rA) {
      try { this.rA.back(); } catch (e2) { try { this.rA.clear(); } catch (e3) {} }
    }
  },
  flowParams: function (t) {
    var c = this.cfg || Cfg.cfgArr('');
    var at = function (i) { var v = parseInt(c[i], 10); return isNaN(v) ? 0 : v; };
    return {
      t: t,
      colIdx: String(c[1]),      // 字体颜色（预设索引 '0'~'23' 或自定义 '#RRGGBB'）
      mult: String(c[2]),       // 字号倍数
      speed: at(3),             // 速度档 1~10
      dirIdx: at(4),
      keepIdx: at(7),           // 屏幕常亮
      trackPx: at(10),          // 字间距
      mirrorIdx: at(15),
      bgIdx: String(c[17]),     // 背景色（预设索引或自定义 '#RRGGBB'）
      sq: this.isSq ? 1 : 0     // 屏型（方形屏尺寸单独适配）
    };
  },
  // ── 局域网同步（预留接口，配套安卓端内网 HTTP 服务）────────────────
  // 约定：GET <url> 返回 JSON { text, cfg? }；成功后回填文字（可选整串配置）
  // 目前无 UI 入口，供后续「从我手机获取」按钮或定时同步调用。
  pullFromLan: function (url, onDone) {
    var that = this;
    Net.getJson(url, function (res) {
      var d = res && res.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      if (res && res.ok && d) {
        if (typeof d.text === 'string' && d.text !== '') {
          that.text = d.text;
          that.syncText();
          that.saveText(d.text);
        }
        if (typeof d.cfg === 'string' && d.cfg !== '') {
          that.cfg = Cfg.trim(Cfg.cfgArr(d.cfg));
          that.applyTheme(0);
        }
      }
      if (onDone) onDone(res || { ok: false });
    });
  },
  onDestroy: function () {
    if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; }
    if (this.tm) {
      for (var k in this.tm) { if (this.tm[k]) clearInterval(this.tm[k]); }
      this.tm = null;
    }
  }
};