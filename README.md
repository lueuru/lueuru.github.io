# 新笔文学社 · 基础版本 v0.4

岳阳县第二中学「新笔文学社」官网的基础版本。**自包含、零外部依赖**：不接 CDN，作品数据优先拉取社团 Supabase（只读，失败自动回退本地示例数据），双击 `index.html` 即可打开。

**线上地址**：https://lueuru.github.io/xinbi-basic/ （GitHub Pages，仓库 `lueuru/xinbi-basic`，独立于原站仓库）

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
├── admin.html            # 内容管理后台（本地演示，登录后访问）
├── login.html            # 本地演示登录页（不连接真实后台）
├── 404.html              # 404 页
├── manifest.json         # PWA 清单（可添加到主屏幕）
├── sw.js                 # Service Worker（导航网络优先 / 静态资源缓存优先）
├── robots.txt / sitemap.xml
├── assets/
│   ├── css/style.css     # 全站样式（宣纸 + 朱砂 + 鎏金，含深色模式）
│   ├── icons/icon.svg    # 应用图标
│   └── js/
│       ├── data.js       # 站点静态数据：社团信息/示例作品/活动/社员/门户/社刊
│       ├── config.js     # 远端数据配置（Supabase 地址与 anon key、开关）
│       ├── app.js        # 前台交互 + 数据层（远端优先，失败回退本地）
│       └── admin.js      # 后台交互（覆盖层 CRUD、导入导出、模式切换）
└── README.md
```

## 已实现的功能

- **作品数据层**：打开首页时自动拉取社团 Supabase `works` 表（只读，7 秒超时）；成功则展示真实作品并显示「数据来源：社团作品库（实时）」，失败或为空时回退本地示例数据；拉取期间有骨架屏动画。
- **作品展示**：分类筛选、关键词搜索下拉（高亮匹配）、SVG 自动生成书封、加载更多、弹窗预览（点赞/收藏/评论）、跳转独立详情页。
- **作品详情页**（work.html）：舒适排版长文、点赞/收藏/评论、上一篇/下一篇、相关作品、分享按钮、打印样式。
- **社刊《年轻的心》**（journal.html）：刊物介绍 + 往期期号/主题/精选篇目。
- **内容管理后台**（admin.html）：
  - 作品：新增 / 编辑 / 删除，侧滑式编辑器（标题、作者、年级班级、分类、摘要、正文分段）
  - 活动 / 社员 / 社刊：分区编辑、保存、增删
  - 数据：导出 JSON、导入 JSON、恢复默认、查看本地投稿与申请记录、清空互动数据
  - 两种模式：远端优先（默认）/ 本地管理（编辑优先生效，可一键切换）
  - 编辑结果写入本机 localStorage 覆盖层，**全站页面即时生效**，作品区徽标显示「本地管理（后台编辑）」
- **近期活动**：日期按打开时间自动排期，倒计时实时刷新。
- **全局**：深色模式（首次访问跟随系统设置）、阅读进度条、回到顶部、滚动揭示动画、移动端汉堡菜单、响应式（最窄 360px）、PWA 离线、SEO（OG/JSON-LD/canonical/sitemap）。

## 内容管理后台怎么用

1. 打开 `admin.html` → 未登录会提示，登录后进入（演示登录任意邮箱即可）。
2. 「作品」页签 →「＋ 新增作品」→ 填表保存 → 回首页即可看到新作品（作品区徽标变为「本地管理」）。
3. 「数据」页签 →「导出 JSON」可把当前全部内容存成文件交接；「恢复默认」清空所有本地编辑。
4. 想要回到「拉取社团作品库真实数据」，点右上角「切换回远端优先」。

> 后台数据保存在**访问者本机浏览器**，不会写回服务器。要让所有人看到，需接真实后台（见下方 TODO）。

## 部署

已部署在 GitHub Pages：仓库 `lueuru/xinbi-basic` → 分支 `main` 根目录。

```bash
cd xinbi-basic
git add -A && git commit -m "update"
git push https://<token>@github.com/lueuru/xinbi-basic.git main
```

部署到新域名时，记得替换 `index.html` 的 canonical、`sitemap.xml` 与 `robots.txt` 中的域名。

## 与原站的关系

- 原站源码备份在同级目录 `Xinbi/`（动态版，Supabase 后台 + admin.html + login.html）与 `xinbi-literature.github.io/`（静态部署版）。**本基础版本是另建的独立仓库，不影响原站**。
- `assets/js/config.js` 中的 Supabase 地址与 anon key 来自原站源码，是社团自己的项目；将 `enableRemote` 改为 `false` 即可完全离线使用本地示例数据。

## 后续可做（TODO）

1. **接入真实后台**：把 admin.html 的保存动作从 localStorage 改为写 Supabase（works / events / profiles 等表，参照 `Xinbi/index.html` 的 REST 写法），需先接 Supabase Auth 拿到用户 token。
2. **投稿入库**：`submissions` / `member_applications` 表写入（当前是本地演示）。
3. **真实评论与点赞**：目前存 localStorage，接 Auth 后可落库并跨设备同步。
4. **社刊 PDF**：journal.html 的下载按钮为演示占位，可接存储桶真实文件。
5. **图片资源**：当前书封用 SVG 按分类色生成；若社员有配图，可启用 Supabase Storage 并在 coverArt 中回退到真实图片。

## 设计说明

- 配色取自原站：宣纸底 `#faf7f0`、朱砂红 `#8b3a3a`、鎏金 `#b8964a`、黛绿 `#5b7a6a`。
- 字体栈：`Noto Serif SC / Songti SC / STSong / SimSun`，无需联网加载。
- 图标为内联 SVG（feather 风格），书封由 SVG 按分类色自动生成，无外链图片依赖。

## 版本记录

- **v0.4（2026-10-25）**：上线 GitHub Pages（`lueuru/xinbi-basic`）；新增内容管理后台 admin.html（作品/活动/社员/社刊 CRUD + 导入导出 + 远端/本地双模式），编辑通过 localStorage 覆盖层全站生效；修复后台 `$$` 作用域丢失导致分区编辑串行、新增作品缺 `_new` 标记不显示两个 bug；SW 缓存版本升至 v3。
- **v0.3（2026-10-25）**：真实浏览器全链路测试（无头 Chrome + CDP）并修复 3 个只有跑起来才会暴露的 bug：① 首页 `data-page` 值不匹配导致整页无渲染；② “加载更多”不翻页；③ 作品页/弹窗动作区 SVG 图标无尺寸规则（按 300px 默认值撑爆布局）。新增：系统深色偏好、分享按钮、作品页 CreativeWork 结构化数据、登录后回跳原页面、可访问性项、对比度提升、Supabase 预连接、打印样式。Service Worker 导航请求改网络优先。
- **v0.2（2026-10-25）**：Supabase 真实作品数据层（只读+回退）、作品详情页、社刊往期页、404 页、骨架屏、PWA、SEO 结构化数据。
- **v0.1（2026-10-24）**：首个基础版本：单页 + 本地示例数据 + 演示登录。
