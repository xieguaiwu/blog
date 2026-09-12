# 背景素材来源与制作说明

本目录（`source/img/bg/art/`）的图像由**公有领域（public domain）西方绘画**合成，
仅用于本站背景。原画版权不归本项目所有，本目录的合成结果按 CC BY-NC-SA 4.0 释出。

## 文件命名

| 后缀 | 含义 |
| :--- | :--- |
| `A1 … A4` | 单幅满铺（2560×1440） |
| `B1 … B4` | 主画 + 细节拼贴 |
| `C1 … C4` | 三联祭坛画 |
| `D1 … D4` | 层叠蒙太奇 |
| `*-m` | 同一套的竖版变体（1200×1800），窄屏自动切换 |
| `cover/` | 文章卡片封面（从上述各套裁切，800×500） |

每套同时提供 `.avif`（首选）与 `.jpg`（兜底）。

## 取材清单

| 作品 | 作者 | 年份 |
| :--- | :--- | :--- |
| 死之岛（各版本） | Arnold Böcklin | 1880–1886 |
| 农神吞噬其子、女巫的安息日、疯人院 | Francisco de Goya | 1794–1823 |
| 萨丹纳帕路斯之死 | Eugène Delacroix | 1827 |
| 路西法、莎乐美 | Franz von Stuck | 1890–1906 |
| 显现、赫西俄德与缪斯 | Gustave Moreau | 1876–1891 |
| 死之花园、晚钟、受伤的天使 | Hugo Simberg | 1897–1903 |
| 骷髅争尸、阴谋、1889 年基督进入布鲁塞尔 | James Ensor | 1889–1891 |
| 堕落天使、克娄巴特拉 | Alexandre Cabanel | 1863–1887 |
| 哀悼的老人 | Vincent van Gogh | 1890 |
| 风中新娘、受难、父亲 | Oskar Kokoschka | 1913–1922 |
| 人间乐园（含外板与地狱细节） | Hieronymus Bosch | 1490–1510 |
| 班卓琴课 | Henry Ossawa Tanner | 1893 |
| 回声与那喀索斯 | John William Waterhouse | 1903 |
| 菲莱神庙岛 | David Roberts | 1838 |
| 疗养院空厅（黑白） | 私人收藏（魔山主题） | — |

## 制作管线

生成脚本在仓库外的工作目录 `~/Desktop/blog-work/gen_backgrounds.py`（Pillow + NumPy）：

1. **画板归一**：统一 sRGB，按需长边缩到 3200px；
2. **构图**：按 A/B/C/D 四种样式合成，横构图素材在窄面板里改用「装裱留白（contain）」；
3. **统一处理**：降饱和 → 压暗 → 暗角 → 上下渐变遮罩 → 胶片颗粒；
4. **导出**：AVIF（保证体积）+ JPG（兜底），并另出竖版与卡片封面。

重新生成：

```bash
cd ~/Desktop/blog-work
python3 gen_backgrounds.py          # 全部 16 套（桌面 + 竖版）
python3 gen_backgrounds.py --only A1,C2
python3 export_web.py               # 导出到 source/img/bg/art/
```
