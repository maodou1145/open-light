/**
 * net.js - 局域网传输预留接口（配套安卓端内网传输）
 *
 * 定位：手表端只做 HTTP 客户端（@system.fetch），安卓手机端起本地 HTTP 服务。
 * 依据：@system.fetch 属 SystemCapability.Communication.NetStack（API 3+）；
 *       Lite 端调用前用 canIUse 探测，取不到模块时回退为「不可用」，不影响本地功能。
 * 权限：config.json 已声明 ohos.permission.INTERNET。
 *
 * 接口约定（v1，供后续安卓端实现参考）：
 *   GET  http://<手机IP>:<端口>/openlight/pull?device=open-light
 *        200 application/json
 *        { "text": "要显示的文字",
 *          "colIdx": 0,     // 0~23，文字颜色索引
 *          "bgIdx": 0,      // 0~23，背景色索引
 *          "speed": 5,      // 1~10
 *          "dirIdx": 0,     // 0=左 1=右 2=上 3=下
 *          "cfg": "..." }   // 可选：完整 cfg 串（优先生效）
 *   POST http://<手机IP>:<端口>/openlight/ack
 *        { "ok": true, "applied": true }    // 可选回执
 */

function available() {
  try {
    if (typeof canIUse === 'function') return canIUse('SystemCapability.Communication.NetStack');
  } catch (e) {}
  return true;   // 探测不到时按可用处理，真正失败再回报
}

// 取 fetch 函数：不同固件下 require('@system.fetch') 可能是类/实例/带 default 的对象
function getFetch() {
  try {
    var f = require('@system.fetch');
    if (f && typeof f.fetch === 'function') return f;
    if (f && f.default && typeof f.default.fetch === 'function') return f.default;
  } catch (e) {}
  return null;
}

/**
 * 通用请求
 * @param {object} opt  { url, method?, data?, header?, timeout? }
 * @param {function} cb cb({ ok, code, text, error })
 */
function request(opt, cb) {
  var done = false;
  var finish = function (res) { if (done) return; done = true; if (cb) cb(res); };
  var f = getFetch();
  if (!f) { finish({ ok: false, code: -1, error: 'fetch unavailable' }); return; }

  var opt2 = opt || {};
  var timeout = parseInt(opt2.timeout, 10);
  if (isNaN(timeout) || timeout <= 0) timeout = 5000;
  var timer = setTimeout(function () { finish({ ok: false, code: -2, error: 'timeout' }); }, timeout);

  try {
    f.fetch({
      url: opt2.url,
      method: opt2.method || 'GET',
      data: opt2.data,
      header: opt2.header || { 'Content-Type': 'application/json' },
      responseType: 'text',
      success: function (r) {
        clearTimeout(timer);
        var body = (r && (r.data !== undefined ? r.data : r.text)) || '';
        finish({ ok: true, code: (r && r.code) || 200, text: body });
      },
      fail: function (d, code) {
        clearTimeout(timer);
        finish({ ok: false, code: code || -3, error: d || 'request failed' });
      }
    });
  } catch (e) {
    clearTimeout(timer);
    finish({ ok: false, code: -4, error: e });
  }
}

// GET 文本
function get(url, cb, timeout) {
  request({ url: url, method: 'GET', timeout: timeout }, cb);
}

// GET 并解析 JSON：cb({ ok, code, data, error })
function getJson(url, cb, timeout) {
  get(url, function (res) {
    if (!res || !res.ok) { if (cb) cb(res || { ok: false }); return; }
    var d = res.text;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { d = null; }
    }
    if (cb) cb({ ok: true, code: res.code, data: d });
  }, timeout);
}

// POST JSON
function post(url, body, cb, timeout) {
  var data = body;
  if (data && typeof data === 'object') { try { data = JSON.stringify(data); } catch (e) {} }
  request({ url: url, method: 'POST', data: data, timeout: timeout }, cb);
}

export default {
  available: available,
  request: request,
  get: get,
  getJson: getJson,
  post: post
};
