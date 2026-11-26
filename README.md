# 抓喵大作战 · CatchCat Studio (Web App)

零构建纯静态 PWA / H5 + 桌面全功能宠物闪卡制作工坊，打开网页即可使用：

- **抓拍抓猫**：支持浏览器实时取景（HTTPS 环境）与手机系统相机调用，内置 8 款猫狗零食投喂特效及 `HP / ex` 实时属性加成、收集等级 `Lv.X`、`云端 / 本地` 一键切换识宠。
- **端侧智能抠图**：零外部依赖的四周边缘采样显著性 + `O(N)` 积分图导向滤波发丝分离，附带擦除/恢复画笔手工微调与整图铺满兜底。
- **制卡工坊**：5 维全定制混搭（7 款金属边框、8 种场景背景、8 种避让脸部的自适应特效与箔强调节、10 枚矢量能量徽章与卡面文案、宠位 X/Y/缩放），支持 4K 满版无边距圆角透明 PNG（`2934×4104`）导出。
- **3D · 4K 展厅**：内置 Three.js r160 PBR 渲染与可开关透明亚克力评级卡砖，`1× ~ 4.5×` 微距检视及棚拍/暖金/极光布光（无 WebGL 环境自动平滑降级为 2.5D 交互预览）。
- **主子卡册**：`IndexedDB` 本机持久化收藏与 JSON 备份导出/恢复。

## 部署上线（零构建步骤）

- **GitHub Pages**：`Settings -> Pages -> Deploy from branch (main / root)`，开启即可获得 `HTTPS` 链接（手机 Safari/Chrome 实时相机 `getUserMedia` 依赖 HTTPS）。
- **Netlify / Cloudflare Pages / Vercel**：直接关联本仓库，Publish directory 设为 `.`，无需 Build command；仓库已包含 [netlify.toml](netlify.toml)。

## 本地调试

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```
