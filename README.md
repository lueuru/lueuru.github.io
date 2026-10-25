# 新笔文学社 · 基础版本 v0.2

岳阳县第二中学「新笔文学社」官网的基础版本。**自包含、零外部依赖**：不接 CDN，作品数据优先拉取社团 Supabase（只读，失败自动回退本地示例数据），双击 `index.html` 即可打开。

## 快速开始

- 直接双击 `index.html` 在浏览器打开；或
- 在本目录起一个本地服务（体验更完整，Service Worker 需要 http 环境）：

```bash
cd xinbi-basic
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

## 文件结构

```
xinbi-basic/
├── index.html            # 单页站点：幕头/关于/作品/活动/社员/投稿/门户/联系
├── work.html             # 作品详情页（独立路由 work.html?id=）
├── journal.html          # 社刊《年轻的心》往期回顾
├── login.html            # 本地演示登录页（不连接真实后台）
├── 404.html              # 404 页
├── manifest.json         # PWA 清单（可添加到主屏幕）
├── sw.js                 # Service Worker（离线缓存，同源资源 cache-first）
├── robots.txt / sitemap.xml
├── assets/
│   ├── css/style.css     # 全站样式（宣纸 + 朱砂 + 鎏金，含深色模式）
│   ├── icons/icon.svg    # 应用图标
│   └── js/
│       ├── data.js       # 站点静态数据：社团信息/示例作品/活动/社员/门户/社刊
│       ├── config.js     # 远端数据配置（Supabase 地址与 anon key、开关）
│       └── app.js        # 交互逻辑 + 数据层（远端优先，失败回退本地）
└── README.md
```

## 已实现的功能

- **作品数据层**：打开首页时自动拉取社团 Supabase `works` 表（只读，7 秒超时）；成功则展示真实作品并在作品区显示「数据来源：社团作品库（实时）」，失败或为空时回退本地示例数据并显示「本地示例数据」。拉取期间有骨架屏动画。
- **作品展示**：分类筛选（散文/诗歌/小说/随笔）、关键词搜索下拉（高亮匹配）、SVG 自动生成书封、加载更多、弹窗预览（点赞/收藏/评论，localStorage 持久化）、跳转独立详情页。
- **作品详情页**（work.html）：舒适排版长文阅读、点赞/收藏/评论、上一篇/下一篇、相关作品推荐。
- **社刊《年轻的心》**（journal.html）：刊物介绍 + 往期期号/主题/精选篇目。
- **近期活动**：日期按打开时间自动排期，倒计时实时刷新。
- **社员风采 / 文学网站入口 / 联系我们**：数据驱动渲染；投稿与加入申请表单本地演示提交。
- **全局**：深色模式、阅读进度条、回到顶部、滚动揭示动画、移动端汉堡菜单、响应式（最窄 360px）。
- **PWA**：manifest + Service Worker，离线可访问已缓存页面。
- **SEO**：OG/Twitter 卡片、JSON-LD 结构化数据、canonical、robots.txt、sitemap.xml。

## 与原站的关系

- 原站源码备份在同级目录 `Xinbi/`（动态版，Supabase 后台 + admin.html）与 `xinbi-literature.github.io/`（静态部署版）。
- `assets/js/config.js` 中的 Supabase 地址与 anon key 来自原站源码，是社团自己的项目；将 `enableRemote` 改为 `false` 即可完全离线使用本地示例数据。

## 后续可做（TODO）

1. **写入能力**：投稿表单、点赞/收藏/评论目前是本地演示，可参照 `Xinbi/index.html` 中的 REST 写法接入 Supabase（需带用户登录态）。
2. **真实登录**：login.html 目前是本地演示，可接入 Supabase Auth（原站用 sessionStorage 存 token）。
3. **社刊 PDF**：journal.html 的下载按钮为演示占位，可接存储桶真实文件。
4. **后台管理**：需要后台时可参考备份目录 `Xinbi/admin.html`。
5. **部署**：推到 GitHub Pages 后，请把 index.html 的 canonical、sitemap.xml、robots.txt 中的 `https://lueuru.github.io/xinbi-basic/` 替换为实际域名。

## 设计说明

- 配色取自原站：宣纸底 `#faf7f0`、朱砂红 `#8b3a3a`、鎏金 `#b8964a`、黛绿 `#5b7a6a`。
- 字体栈：`Noto Serif SC / Songti SC / STSong / SimSun`，无需联网加载。
- 图标为内联 SVG（feather 风格），书封由 SVG 按分类色自动生成，无外链图片依赖。

## 版本记录

- **v0.3（2026-10-25）**：真实浏览器全链路测试（无头 Chrome + CDP）并修复 3 个只有跑起来才会暴露的 bug：① 首页 `data-page` 值不匹配导致整页无渲染；② “加载更多”不翻页；③ 作品页/弹窗动作区 SVG 图标无尺寸规则（按 300px 默认值撑爆布局）。新增：系统深色偏好（首次访问跟随系统）、作品分享按钮（Web Share/复制链接）、作品页 CreativeWork 结构化数据、登录后回跳原页面、跳转链接/键盘焦点/aria-current 等可访问性项、正文对比度提升、Supabase 预连接、远端正文按单换行分段的兜底解析、作品页打印样式。Service Worker 升级：导航请求改网络优先（内容更新即时可见），缓存版本 v2。
- **v0.2（2026-10-25）**：Supabase 真实作品数据层（只读+回退）、作品详情页、社刊往期页、404 页、骨架屏、PWA（manifest + SW）、SEO 结构化数据、点赞收藏评论全局统一。
- **v0.1（2026-10-24）**：首个基础版本：单页 + 本地示例数据 + 演示登录。
