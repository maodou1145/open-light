# 开源跑马灯 (Open Light)

一款运行在华为轻智能手表（liteWearable）上的跑马灯应用：把你想展示的任意文字变成循环滚动的字幕，戴在手腕上就能亮出来。

## 功能

- 欢迎页：背景淡入 + 光环漂浮 + 标题上浮，轻触「开始」或 3 秒自动进入（仅首次启动播放，之后自动跳过）
- 界面为毛玻璃浅色方案：玻璃胶囊与柔和阴影预烘焙成 PNG（Lite 不支持 blur / box-shadow）
- 自定义文字内容，循环滚动播放（中英文、符号均支持）
- Canvas 动画实现（替代 marquee）：横向左/右滚动；上/下为横屏模式（整块画布旋转 90°，把表横过来即可正常阅读），约 30fps
- 圆屏 / 方屏双适配（liteWearable 圆屏与方屏各有独立布局）
- 字号、速度、方向、字间距、字体颜色、背景色可调
- 文字与背景各内置 24 色调色盘，设置按「文字 / 背景 / 效果」分类
  （选中态是色块外一圈强调青光环，深浅色块都能看清；40px 点击热区）
- 色轮取色器：除预设 24 色外，还可在 HSV 色轮上手指滑动直接吸色（`#RRGGBB` 自定义色，
  与预设索引双格式兼容，老配置无需迁移；色轮为预烘焙 PNG，Lite 无渐变 API）
- 屏幕常亮开关
- 内置中文拼音键盘（圆屏 / 方屏两套界面，支持候选词、剪贴板、符号输入）
- 主界面右滑返回表盘，跑马灯页左/右滑退出
- 预留局域网接口（`@system.fetch`），为后续安卓端内网下发文字/配置做准备

## 构建

### 云端一键构建（推荐，无需本地环境）

仓库内置 GitHub Actions 流水线，**push 即自动构建**，产物在 Actions → Artifacts 下载
（`open-light-<run>`：未签名 `.app`，放入 `certs/app.p7b` 后额外产出签名 `.hap`）：

```
actions/checkout → setup-ohos（CLT 6.1.1.280）→ ohpm install --all
→ hvigorw assembleApp --mode project -p product=default -p buildMode=debug
→ scripts/clean_config_in_app.py（Lite schema 清洗）
→ tools/sign/sign-app-to-hap.js（FORCE_P7B_BUNDLE=1，需 certs/app.p7b）
```

方案移植自 [lantianhcgp/lite-watch-starter](https://github.com/lantianhcgp/lite-watch-starter)（MIT）。
换证书 = 替换 `certs/app.p7b` 后 push，详见 `certs/README.md`。

### 本地构建（DevEco Studio）

用 DevEco Studio 打开工程（**API 10** / HarmonyOS FA 模式，liteWearable 设备）直接构建即可。

> 仓库**不附带 hvigorw wrapper**（根目录没有 `hvigorw` / `hvigor/hvigor-wrapper.js`），
> 所以 `hvigorw.bat assembleHap` 这类命令在 clone 下来后是跑不起来的。
> 命令行构建请直接调用 DevEco Studio 自带的 hvigor（路径按自己的安装位置替换）：

```bash
env -u NODE_OPTIONS -u PYTHONPATH \
  DEVECO_SDK_HOME="D:/Devceo Studio 6.1.1/DevEco Studio/sdk" \
  "D:/Devceo Studio 6.1.1/DevEco Studio/tools/node/node.exe" \
  "D:/Devceo Studio 6.1.1/DevEco Studio/tools/hvigor/bin/hvigorw.js" \
  --no-daemon assembleHap
```

`NODE_OPTIONS` 要清空：某些注入式 node shim 会劫持 `fs.unlink`，让 hvigor 卡在
`safe-delete ... ETIMEDOUT`。生成 `.app` 应用包把任务换成 `assembleApp` 即可。

签名请在 `build-profile.json5` 中配置自己的 `signingConfigs`（工程内不含签名材料）。

产物位于 `entry/build/default/outputs/default/`：

- `entry-default-lite-unsigned.hap` —— liteWearable（轻智能手表）
- `entry-default-unsigned.hap` —— wearable（完整版手表）

## 应用包

[Releases](https://github.com/maodou1145/open-light/releases) 提供已构建的未签名应用包
（V3.0 起为 `.app.zip`，GitHub Release 不允许 `.app` 扩展名的资产，下载后解压即可），
安装前需用你自己的证书签名。历史版本见 [release/](release/) 目录。

## 工程结构

```
entry/src/main/js/MainAbility/pages/
├── welcome/          欢迎页（启动页：背景淡入 + 光环动画）
├── index/            主界面（时钟 + 输入 + 设置 + 启动）
├── run/              跑马灯运行页
├── settings/         设置主页（文字 / 背景 / 效果 分类入口）
├── settings_font/    文字设置（24 色调色盘 + 取色入口 + 字号）
├── settings_bg/      背景设置（24 色调色盘 + 取色入口 + 版本号）
├── settings_effect/  效果设置（速度 / 方向 / 镜像 / 屏幕常亮）
├── colorpicker/      色轮取色器（触摸坐标 → HSV → #RRGGBB，圆/方双布局）
├── keyboard_circle/  拼音键盘（圆屏）
└── keyboard_rect/    拼音键盘（方屏）

common/
├── cfg.js            配置索引 / 双通道读写（storage + 文件备份）/ 24 色表 /
│                     标记与任意键值读写 / 颜色解析（各页唯一来源）
├── net.js            局域网 HTTP 客户端（预留）
├── bg/               背景图、图标（旧版）
├── ui/               浅色背景图 + 玻璃胶囊/按钮 PNG + 色轮图（tools/make_hue_wheel.py 生成）
└── keyboard/         拼音键盘输入法（crabKeyboard 移植）+ 词库读取
```

## 局域网接口（预留）

手表端只做 HTTP **客户端**（`@system.fetch`，已声明 `ohos.permission.INTERNET`），
安卓手机端起本地 HTTP 服务；接口封装见 `entry/src/main/js/MainAbility/common/net.js`。

约定（v1）：

```
GET  http://<手机IP>:<端口>/openlight/pull?device=open-light
     200 application/json
     {
       "text": "要显示的文字",
       "colIdx": 0,      // 0~23 文字颜色
       "bgIdx": 0,       // 0~23 背景色
       "speed": 5,       // 1~10
       "dirIdx": 0,      // 0=左 1=右 2=上 3=下
       "cfg": "..."      // 可选：完整 cfg 串，优先级最高
     }

POST http://<手机IP>:<端口>/openlight/ack
     { "ok": true, "applied": true }       // 可选回执
```

手表侧调用入口：`index.js` 的 `pullFromLan(url, onDone)`（目前无 UI 按钮，留作后续接入）。

## 致谢

- 输入法部分基于 [crabPangXie/crabKeyboard](https://github.com/crabPangXie/crabKeyboard)（MIT License）适配移植。

## 许可证

[MIT License](LICENSE)
