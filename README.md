# 开源跑马灯 (Open Light)

一款运行在华为轻智能手表（liteWearable）上的跑马灯应用：把你想展示的任意文字变成循环滚动的字幕，戴在手腕上就能亮出来。

## 功能

- 自定义文字内容，循环滚动播放（中英文、符号均支持）
- 圆屏 / 方屏双适配（liteWearable 圆屏与方屏各有独立布局）
- 字号、速度、方向、字间距、字体颜色、背景色可调
- 屏幕常亮开关
- 内置中文拼音键盘（圆屏 / 方屏两套界面，支持候选词、剪贴板、符号输入）
- 主界面右滑返回表盘，跑马灯页左/右滑退出

## 构建

使用 DevEco Studio 打开工程（API 16 / HarmonyOS FA 模式，liteWearable 设备），或命令行：

```
hvigorw.bat assembleHap --mode module -p product=default -p buildMode=debug
```

签名请在 `build-profile.json5` 中配置自己的 `signingConfigs`（工程内不含签名材料）。

生成 .app 应用包（工程级任务）：

```
hvigorw.bat assembleApp -m project -p product=default -p buildMode=debug
```

产物位于 `build/outputs/default/OR_light-default-unsigned.app`。

## 应用包

[release/open-light-V3.0-unsigned.app](release/open-light-V3.0-unsigned.app) 为 V3.0 未签名应用包（内含圆屏与方屏两个 HAP），安装前需用你自己的证书签名。

## 工程结构

```
entry/src/main/js/MainAbility/pages/
├── index/            主界面（时钟 + 输入 + 设置 + 启动）
├── run/              跑马灯运行页
├── settings/         设置页 1（颜色/字号/速度等）
├── settings2/        设置页 2（背景色/版本号）
├── keyboard_circle/  拼音键盘（圆屏）
└── keyboard_rect/    拼音键盘（方屏）
```

## 致谢

- 输入法部分基于 [crabPangXie/crabKeyboard](https://github.com/crabPangXie/crabKeyboard)（MIT License）适配移植。

## 许可证

[MIT License](LICENSE)
