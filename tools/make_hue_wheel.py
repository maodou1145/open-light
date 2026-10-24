#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成「整屏色轮」PNG，供 Lite Wearable 取色器使用。

为什么不预烘焙而不是运行时用 canvas 画：
  ArkUI.Lite 的 CanvasRenderingContext2D 没有 createRadialGradient / createLinearGradient，
  只能用 fillRect 一条条拼，代码量大且效果粗糙；预烘焙 PNG 是本工程既有做法
  （毛玻璃胶囊、背景图都是烘焙的），渲染零开销、画质最好。

为什么是整屏尺寸：
  取色要把触摸点的屏幕坐标(globalX/globalY)换算成色相，需要色轮圆心的精确坐标。
  把 PNG 做成与页面同尺寸、圆心落在几何中心，image 用 100%x100% 铺满页面，
  圆心就等于屏幕几何中心 —— 不受页面里标题/按钮等元素高度影响。

色轮数学（取色时必须与本文件一致）：
  r  = 距圆心像素距离 / 半径        -> 饱和度 S = r
  θ  = atan2(dy, dx)                -> 色相   H = (θ + 360) % 360
  V  = 1（亮度固定为满）
  中心留白（S=0，即白色）

用法：
  python tools/make_hue_wheel.py            # 生成圆屏 + 方屏两张
"""
import colorsys
import math
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.normpath(os.path.join(
    HERE, "..", "entry", "src", "main", "js", "MainAbility", "common", "ui"))

WHITE_HOLE = 0.10      # 中心 10% 半径内为白（无饱和度）
EDGE_RING = 0.985      # 最外 1.5% 画浅灰描边


def build(w: int, h: int, cx: float, cy: float, r_out: float) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    x0, x1 = int(cx - r_out - 2), int(cx + r_out + 2)
    y0, y1 = int(cy - r_out - 2), int(cy + r_out + 2)
    for y in range(max(0, y0), min(h, y1 + 1)):
        dy = y - cy
        for x in range(max(0, x0), min(w, x1 + 1)):
            dx = x - cx
            r = math.sqrt(dx * dx + dy * dy) / r_out
            if r > 1.0:
                continue
            if r >= EDGE_RING:
                px[x, y] = (201, 210, 216, 255)
                continue
            if r <= WHITE_HOLE:
                px[x, y] = (255, 255, 255, 255)
                continue
            s = min(1.0, max(0.0, (r - WHITE_HOLE) / (1.0 - WHITE_HOLE)))
            hdeg = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
            rr, gg, bb = colorsys.hsv_to_rgb(hdeg / 360.0, s, 1.0)
            px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), 255)
    return img


def main() -> None:
    os.makedirs(UI_DIR, exist_ok=True)
    jobs = [
        # 文件名,          宽,  高,  圆心x, 圆心y, 半径
        ("hue_wheel_c.png", 466, 466, 233.0, 233.0, 130.0),   # 圆屏 466x466
        ("hue_wheel_r.png", 408, 480, 204.0, 240.0, 130.0),   # 方屏 408x480
    ]
    for name, w, h, cx, cy, r in jobs:
        path = os.path.join(UI_DIR, name)
        build(w, h, cx, cy, r).save(path, "PNG")
        print("saved", path, "%dx%d" % (w, h), "center=(%g,%g)" % (cx, cy), "r=%g" % r)


if __name__ == "__main__":
    main()
