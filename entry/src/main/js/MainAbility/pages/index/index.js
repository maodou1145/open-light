/**
 * index.js - 主界面逻辑
 * - 大号数字时钟（每秒刷新）
 * - 输入文字（持久化 or_text）
 * - 跳转设置 / 开始启动
 */

// 默认配置快照（索引与设置页完全一致；末位为跑马灯背景色）
var DEF_CFG = '1,0,1.5,5,0,1,0,1,0,1,0,100,1,0,0,0,0,0';   // 默认横屏(索引0=1)

// 解析配置串 -> 数组（缺省兜底）
function cfgArr(s) {
  var d = DEF_CFG.split(',');
  if (typeof s === 'string' && s !== '') {
    var a = s.split(',');
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== '') d[i] = a[i];
    }
  }
  return d;
}

// @system.* 返回值可能带 {value} 包装，统一解包
function normData(d) {
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    if (typeof d.value === 'string') return d.value;
    if (typeof d.data === 'string') return d.data;
    return '';
  }
  return '';
}

// ── 方形屏检测（FIT/Band 系列 408x480 等）──────────────────────────────
// lite 不支持 CSS @media；优先用 @system.device.getInfo() 的 screenShape（与已验证的
// LiteTranslate 键盘工程同一判据），拿不到再回退 model 关键字。判定失败一律按圆屏（圆屏布局在两屏都安全）。
function isSquare(cb) {
  try {
    var dv = require('@system.device');
    if (!dv || !dv.getInfo) { cb(false); return; }
    dv.getInfo({
      success: function (info) {
        var shape = (info && info.screenShape) ? String(info.screenShape) : '';
        if (shape !== '') { cb(shape === 'rect'); return; }
        var m = ('' + ((info && info.model) || '')).toLowerCase();
        cb(m.indexOf('fit') >= 0 || m.indexOf('band') >= 0);
      },
      fail: function () { cb(false); }
    });
  } catch (e) { cb(false); }
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
    clock: '00:00',   // 大号时钟（仅时:分，无秒）
    text: '',            // 输入文字
    tiText: '请输入文字',  // 输入框展示内容（空=占位，非空=实际文字）
    tiColor: '#B0B0B0',  // 展示颜色（占位灰 / 实值主题色）
    bgColor: '#E8F2FC',
    cardBg: '#F0F1F3',
    mainCol: '#0A6CFF',  // 时钟颜色（深色模式亮蓝）
    // 主题联动：输入框/按钮/文字颜色（深色模式由 applyTheme 覆盖）
    txtCol: '#333333',   // 输入框实值文字色
    tiPhCol: '#B0B0B0',  // 输入框占位文字色
    tiBg: '#FFFFFF',     // 输入框背景
    tiBd: '#E0E0E0',     // 输入框边框
    btnBg: '#E8EAED',    // 设置按钮背景
    btnTxt: '#424242',   // 设置按钮文字
    pBtnBg: '#0A6CFF',   // 开始按钮背景（两主题通用）
    pBtnTxt: '#FFFFFF',  // 开始按钮文字
    textMain: '#333333',
    clockSize: '30px',   // 时钟字号（方形屏 34px，applyShape 覆盖）
    clockMB: '20px'      // 时钟下间距（方形屏 30px，applyShape 覆盖）
  },
  onInit: function () {
    this.sA = null; this.rA = null; this.fA = null;
    try { this.sA = require('@system.storage'); } catch (e) { this.sA = null; }
    try { this.rA = require('@system.router'); } catch (e) { this.rA = null; }
    try { this.fA = require('@system.file'); } catch (e) { this.fA = null; }

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
    isSquare(function (sq) { that.isSq = sq; that.applyShape(sq); });
    this.loadLocal();
    this.startClock();
  },
  // 读本地存储（storage 主；缺失/失败回退文件备份通道）
  // @system.storage 在本模拟器（新管道）裸调用会抛断言崩溃，
  // 统一 try/catch；任何失败都回退文件备份（与 WatchRun_TRAE 同款防御）。
  loadLocal: function () {
    var that = this;
    var loadText = function (v) { if (v !== '') { that.text = v; that.syncText(); } };
    var loadCfg = function (v) {
      if (v === '') return;
      var c = cfgArr(v);
      c[16] = '0';
      that.cfg = c;          // 启动跑马灯时把显示参数一并传给跑马灯页
      that.applyTheme(0);    // 深色模式已移除，主题恒浅色
    };
    var fileRead = function (uri, cb) {
      try {
        if (that.fA) { that.fA.readText({ uri: uri, success: function (r) { cb((r && (r.text || r.data)) || ''); }, fail: function () {} }); return; }
      } catch (e) {}
    };
    try {
      if (this.sA) {
        this.sA.get({ key: 'or_text', default: '',
          success: function (d) { loadText(normData(d)); },
          fail: function () { fileRead('internal://app/or_text.txt', loadText); } });
        this.sA.get({ key: 'or_cfg', default: '',
          success: function (d) { loadCfg(normData(d)); },
          fail: function () { fileRead('internal://app/or_cfg.txt', loadCfg); } });
        return;
      }
    } catch (e) {}
    fileRead('internal://app/or_text.txt', loadText);
    fileRead('internal://app/or_cfg.txt', loadCfg);
  },
  applyTheme: function (m) {
    if (m === 1) {          // 深色
      this.dark = true;
      this.bgColor = '#121212';
      this.cardBg = '#1E1E1E';
      this.mainCol = '#6FA8DC';
      this.txtCol = '#EEEEEE';
      this.tiPhCol = '#8A8A8A';
      this.tiBg = '#2A2A2A';
      this.tiBd = '#3A3A3A';
      this.btnBg = '#2A2A2A';
      this.btnTxt = '#EEEEEE';
    } else {                // 浅色 / 跟随系统（缺省按浅色）
      this.dark = false;
      this.bgColor = '#E8F2FC';
      this.cardBg = '#F0F1F3';
      this.mainCol = '#0A6CFF';
      this.txtCol = '#333333';
      this.tiPhCol = '#B0B0B0';
      this.tiBg = '#FFFFFF';
      this.tiBd = '#E0E0E0';
      this.btnBg = '#E8EAED';
      this.btnTxt = '#424242';
    }
    this.syncText();        // 重算输入框文字色（占位/实值跟随主题）
  },
  // ── 方形屏专用样式（FIT 408x480 等机型应用）────────────
  // 方形屏垂直空间更充裕：时钟加大、间距拉开，内容更透气。
  applyShape: function (sq) {
    if (sq) {
      this.clockSize = '34px';
      this.clockMB = '30px';
    } else {
      this.clockSize = '30px';
      this.clockMB = '20px';
    }
  },
  // 带写后校验的存储写入 + 文件备份双写（lite 裸 set 静默失败）
  saveText: function (v) {
    var that = this;
    if (!this.sA) return;
    var attempt = 0;
    var doSet = function () {
      if (!that.sA) return;
      try { that.sA.set({ key: 'or_text', value: v }); } catch (e) {}
      try { if (that.fA) { that.fA.writeText({ uri: 'internal://app/or_text.txt', text: v }); } } catch (e) {}
      setTimeout(function () {
        try {
          that.sA.get({ key: 'or_text', default: '',
            success: function (d) {
              if (normData(d) !== v && attempt < 3) { attempt++; doSet(); }
            },
            fail: function () { if (attempt < 3) { attempt++; doSet(); } } });
        } catch (e) {}
      }, 300);
    };
    doSet();
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
    isSquare(function (sq) { that.isSq = sq; go(sq); });             // 未就绪则即时检测
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
      t = 'Oride';       // 空文本回退默认
      this.text = t;
      this.saveText(t);
    }
    // 显示参数（颜色/字号/速度/播放次数/背景等）一次性随路由传给跑马灯页：
    // 该页在 onInit 内同步定型，挂载后不再改 marquee——滚动中被改样式/文本会让引擎停住不再滚。
    nav(this.rA, 'pages/run/run', this.flowParams(t));
  },
  // 右滑返回表盘（首页是 FA 根页，router.back() 即结束应用回到表盘）
  onSwipe: function (e) {
    var dir = (e && e.direction) ? e.direction : (e && e.type);
    if (dir === 'right' && this.rA) {
      try { this.rA.back(); } catch (e2) { try { this.rA.clear(); } catch (e3) {} }
    }
  },
  flowParams: function (t) {
    var c = this.cfg || cfgArr('');
    var at = function (i) { var v = parseInt(c[i], 10); return isNaN(v) ? 0 : v; };
    return {
      t: t,
      colIdx: at(1),            // 字体颜色
      mult: String(c[2]),       // 字号倍数
      speed: at(3),             // 速度档 1~10
      dirIdx: at(4),
      boldIdx: at(5),
      keepIdx: at(7),           // 屏幕常亮
      trackPx: at(10),          // 字间距
      mirrorIdx: at(15),
      bgIdx: at(17),            // 背景色
      sq: this.isSq ? 1 : 0     // 屏型（方形屏尺寸单独适配）
    };
  },
  onDestroy: function () {
    if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; }
  }
};