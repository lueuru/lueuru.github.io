/* ============================================================
 * 新笔文学社 · 基础版本 v0.2 —— 交互脚本
 * 纯前端、零框架；动态能力（点赞/收藏/评论/表单/登录）以
 * localStorage 本地演示，作品数据优先拉取社团 Supabase（只读），
 * 失败自动回退本地示例数据。详见 README。
 * ============================================================ */
(function () {
  "use strict";

  var D = window.XB_DATA;
  var CFG = window.XB_CONFIG || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* 运行时数据：works 可能是本地示例，也可能被远端真实数据替换 */
  var DATA = { works: [], source: "local", remoteTried: false };
  var PAGE_SIZE = 6;
  var wState = { filter: "all", shown: PAGE_SIZE };
  var curWork = null;

  /* ---------- 本地存储 ---------- */
  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem("xb_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem("xb_" + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem("xb_" + k); } catch (e) {} }
  };

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icon(name, filled) {
    return '<svg class="ic' + (filled ? " ic-f" : "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  function toast(m, t) {
    var e = $("#toastEl");
    if (!e) return;
    e.textContent = m;
    e.className = "toast toast-" + (t || "ok") + " show";
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.classList.remove("show"); }, 2200);
  }
  function hl(t, q) {
    var idx = String(t).toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return esc(t);
    return esc(t.slice(0, idx)) + '<span class="hl">' + esc(t.slice(idx, idx + q.length)) + "</span>" + esc(t.slice(idx + q.length));
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function curUser() { return LS.get("user", null); }
  function likes() { return LS.get("likes", []); }
  function bookmarks() { return LS.get("bookmarks", []); }
  function commentsOf(id) { return LS.get("comments", {})[String(id)] || []; }
  function workById(id) {
    for (var i = 0; i < DATA.works.length; i++) if (DATA.works[i].id === id) return DATA.works[i];
    return null;
  }

  /* ---------- 作品封面（SVG 生成，替代外链图） ---------- */
  var CAT_HUE = { prose: "#b8964a", poetry: "#8b3a3a", fiction: "#5b7a6a", essay: "#9c6b3f" };
  var CAT_CHAR = { prose: "散", poetry: "诗", fiction: "小", essay: "随" };

  function coverArt(w) {
    var hue = CAT_HUE[w.category] || "#8b3a3a";
    var cat = D.categories[w.category] || "作品";
    var chars = String(w.title || "").split("");
    var title = chars.map(function (c, i) {
      return '<text x="342" y="' + (58 + i * 36) + '" font-size="29" fill="' + hue + '" text-anchor="middle">' + esc(c) + "</text>";
    }).join("");
    return '<svg viewBox="0 0 400 300" role="img" aria-label="《' + esc(w.title) + "》封面\">" +
      '<rect width="400" height="300" fill="#f6efe0"/>' +
      '<rect x="10" y="10" width="380" height="280" fill="none" stroke="#dccfb0" stroke-width="1.5"/>' +
      '<text x="150" y="252" font-size="170" fill="' + hue + '" opacity="0.1" text-anchor="middle">' + esc(CAT_CHAR[w.category] || "文") + "</text>" +
      '<text x="26" y="48" font-size="13" fill="#8b7e6c" letter-spacing="2">新笔文学社 · 社员作品</text>' +
      '<rect x="26" y="212" width="42" height="42" rx="3" fill="#8b3a3a"/>' +
      '<text x="47" y="240" font-size="19" fill="#f6efe0" text-anchor="middle">' + esc(cat.charAt(0)) + "</text>" +
      '<text x="82" y="242" font-size="15" fill="#5c5040">' + esc(cat) + "</text>" +
      '<text x="26" y="280" font-size="13" fill="#8b7e6c">' + esc(w.author || "") + (w.grade ? " · " + esc(w.grade) + esc(w.class_name || "") + "班" : "") + "</text>" +
      title +
      "</svg>";
  }

  /* ============================================================
   * 远端数据（Supabase 只读）
   * ============================================================ */
  function normalizeRemoteWork(w) {
    var content = [];
    if (Array.isArray(w.content)) content = w.content;
    else if (typeof w.content === "string") {
      var raw = w.content.trim();
      content = raw.split(/\r?\n\s*\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      /* 只有一段且很长时，按单换行再切（兼容只用 \n 分段的正文） */
      if (content.length < 2 && raw.length > 400) {
        content = raw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      }
    }
    var cat = ["prose", "poetry", "fiction", "essay"].indexOf(w.category) > -1 ? w.category : "essay";
    return {
      id: w.id,
      title: w.title || "无题",
      author: w.author || "佚名",
      grade: w.grade || "",
      class_name: w.class_name || "",
      category: cat,
      tags: [],
      rating: 0,
      excerpt: w.excerpt || (content[0] || "").slice(0, 90),
      content: content.length ? content : ["（正文待补充）"],
      likes: w.likes || 0,
      bookmarks: w.bookmarks || 0,
      created_at: w.created_at || "",
      remote: true
    };
  }

  function setSourceBadge() {
    var b = $("#srcBadge");
    if (!b) return;
    if (DATA.source === "remote") {
      b.textContent = "数据来源：社团作品库（实时）";
      b.className = "src-badge src-on";
    } else if (DATA.source === "local-managed") {
      b.textContent = "数据来源：本地管理（后台编辑）";
      b.className = "src-badge src-managed";
    } else {
      b.textContent = "数据来源：本地示例数据";
      b.className = "src-badge";
    }
  }

  function loadRemoteWorks() {
    if (DATA.remoteTried) return Promise.resolve(DATA.source === "remote");
    DATA.remoteTried = true;
    if (!CFG.enableRemote || !CFG.supabaseUrl || !CFG.anonKey) {
      setSourceBadge();
      return Promise.resolve(false);
    }
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, CFG.timeoutMs || 7000);
    var url = CFG.supabaseUrl + "/rest/v1/works?select=id,title,author,grade,class_name,category,excerpt,image_url,likes,bookmarks,created_at,content&order=created_at.desc&limit=100";
    return fetch(url, { headers: { apikey: CFG.anonKey }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (list) {
        if (Array.isArray(list) && list.length) {
          DATA.works = list.map(normalizeRemoteWork);
          DATA.source = "remote";
        }
        setSourceBadge();
        return DATA.source === "remote";
      })
      .catch(function () {
        clearTimeout(timer);
        setSourceBadge();
        return false;
      });
  }

  function showSkeleton() {
    var grid = $("#worksGrid");
    if (!grid) return;
    var s = "";
    for (var i = 0; i < PAGE_SIZE; i++) {
      s += '<div class="sk-card"><div class="sk-art"></div><div class="sk-line"></div><div class="sk-line short"></div></div>';
    }
    grid.innerHTML = s;
    var wrap = $("#loadMoreWrap");
    if (wrap) wrap.innerHTML = "";
  }

  /* ============================================================
   * 作品列表
   * ============================================================ */
  function matchWorks() {
    return DATA.works.filter(function (w) {
      return wState.filter === "all" || w.category === wState.filter;
    });
  }

  function stars(r) {
    var full = Math.round(r / 2);
    var h = "";
    for (var i = 0; i < 5; i++) h += '<span class="star' + (i < full ? " on" : "") + '" aria-hidden="true">★</span>';
    return '<span class="stars" role="img" aria-label="评分 ' + r.toFixed(1) + ' 分">' + h + "</span>";
  }

  function workCard(w, i) {
    var liked = likes().indexOf(w.id) > -1;
    var bmed = bookmarks().indexOf(w.id) > -1;
    var metaLine = w.remote && !w.rating
      ? '<span class="wc-date">' + esc(fmtDate(w.created_at)) + "</span>"
      : (w.rating ? '<span class="rating-num">' + w.rating.toFixed(1) + "</span>" + stars(w.rating) : "");
    return '<div class="wc rv d' + ((i % 4) + 1) + '" data-id="' + w.id + '">' +
      '<div class="wci">' + coverArt(w) + '<span class="wcbadge">' + esc(D.categories[w.category] || "") + "</span></div>" +
      '<div class="wcb">' +
      "<h3>" + esc(w.title) + "</h3>" +
      '<div class="wcm">' + esc(w.grade) + (w.class_name ? esc(w.class_name) + "班 · " : " · ") + esc(w.author) + "</div>" +
      '<p class="wce">' + esc(w.excerpt) + "</p>" +
      '<div class="wcs">' + metaLine +
      '<button type="button" class="like-btn' + (liked ? " liked" : "") + '" data-id="' + w.id + '" aria-label="点赞">' + icon("heart", liked) + ' <span class="n">' + (w.likes + (liked ? 1 : 0)) + "</span></button>" +
      '<button type="button" class="bookmark-btn' + (bmed ? " liked" : "") + '" data-id="' + w.id + '" aria-label="收藏">' + icon("bookmark", bmed) + ' <span class="n">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span></button>" +
      "</div></div></div>";
  }

  function renderWorks(reset) {
    var list = matchWorks();
    if (reset) wState.shown = PAGE_SIZE;
    else wState.shown = Math.min(wState.shown + PAGE_SIZE, list.length);
    var grid = $("#worksGrid");
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '<p class="empty-grid">该分类下暂无作品，换个分类看看。</p>';
      var w0 = $("#loadMoreWrap");
      if (w0) w0.innerHTML = "";
      return;
    }
    grid.innerHTML = list.slice(0, wState.shown).map(workCard).join("");
    var wrap = $("#loadMoreWrap");
    if (list.length > wState.shown) {
      wrap.innerHTML = '<button type="button" class="btn btn-l" id="loadMoreBtn">加载更多作品（还有 ' + (list.length - wState.shown) + " 篇）</button>";
      on("#loadMoreBtn", "click", function () { renderWorks(false); observeReveals(); });
    } else {
      wrap.innerHTML = list.length > PAGE_SIZE ? '<p class="works-all">已展示全部 ' + list.length + " 篇作品</p>" : "";
    }
    observeReveals();
  }

  function updateWorkUI(id) {
    var w = workById(id);
    if (!w) return;
    var liked = likes().indexOf(id) > -1;
    var bmed = bookmarks().indexOf(id) > -1;
    $$(".like-btn[data-id=\"" + id + "\"]").forEach(function (b) {
      b.classList.toggle("liked", liked);
      b.innerHTML = icon("heart", liked) + ' <span class="n">' + (w.likes + (liked ? 1 : 0)) + "</span>";
    });
    $$(".bookmark-btn[data-id=\"" + id + "\"]").forEach(function (b) {
      b.classList.toggle("liked", bmed);
      b.innerHTML = icon("bookmark", bmed) + ' <span class="n">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span>";
    });
    var lb = $("#mLikeBtn");
    if (lb) {
      lb.classList.toggle("on", liked);
      lb.innerHTML = icon("heart", liked) + ' <span id="mLikes">' + (w.likes + (liked ? 1 : 0)) + "</span> 喜欢";
    }
    var bb = $("#mBookmarkBtn");
    if (bb) {
      bb.classList.toggle("on", bmed);
      bb.classList.toggle("gold", bmed);
      bb.innerHTML = icon("bookmark", bmed) + ' <span id="mBookmarkCount">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span> 收藏";
    }
  }

  function toggleLike(id) {
    var l = likes();
    var i = l.indexOf(id);
    if (i > -1) l.splice(i, 1); else l.push(id);
    LS.set("likes", l);
    updateWorkUI(id);
    toast(i > -1 ? "已取消点赞" : "点赞成功");
  }

  function toggleBookmark(id) {
    var b = bookmarks();
    var i = b.indexOf(id);
    if (i > -1) b.splice(i, 1); else b.push(id);
    LS.set("bookmarks", b);
    updateWorkUI(id);
    toast(i > -1 ? "已取消收藏" : "已加入收藏");
  }

  /* ============================================================
   * 作品弹窗（首页）
   * ============================================================ */
  function openWork(id) {
    var w = workById(id);
    if (!w) { toast("作品不存在或数据尚未加载", "err"); return; }
    curWork = w;
    var liked = likes().indexOf(id) > -1;
    var bmed = bookmarks().indexOf(id) > -1;
    $("#mTitle").textContent = w.title;
    $("#mMeta").textContent = (w.grade ? w.grade + (w.class_name ? w.class_name + "班" : "") + " · " : "") + w.author + " · " + (D.categories[w.category] || "") + (w.created_at ? " · " + fmtDate(w.created_at) : "");
    $("#mart").innerHTML = coverArt(w);
    $("#mBody").innerHTML = w.content.map(function (p) { return p ? "<p>" + esc(p) + "</p>" : ""; }).join("");
    $("#mLikeBtn").className = "mact" + (liked ? " on" : "");
    $("#mLikeBtn").innerHTML = icon("heart", liked) + ' <span id="mLikes">' + (w.likes + (liked ? 1 : 0)) + "</span> 喜欢";
    $("#mBookmarkBtn").className = "mact" + (bmed ? " on gold" : "");
    $("#mBookmarkBtn").innerHTML = icon("bookmark", bmed) + ' <span id="mBookmarkCount">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span> 收藏";
    renderComments(id);
    $("#articleModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    var m = $("#articleModal");
    if (m) m.classList.remove("open");
    document.body.style.overflow = "";
    curWork = null;
  }

  /* ============================================================
   * 评论（localStorage 演示）
   * ============================================================ */
  function renderComments(id) {
    var section = $("#comments-section");
    if (!section) return;
    var list = commentsOf(id);
    var u = curUser();
    var html = "<h4>评论 (" + list.length + ")</h4>";
    if (list.length) {
      html += list.map(function (c) {
        return '<div class="comment-item"><strong>' + esc(c.name) + '</strong><span class="cmt-time">' + esc(c.time) + '</span><div class="cmt-content">' + esc(c.content) + "</div></div>";
      }).join("");
    } else {
      html += '<p class="cmt-empty">还没有评论，来发表第一条吧。</p>';
    }
    if (u) {
      html += '<div class="cmt-input-row"><input id="cmtInput" placeholder="写下你的评论..." maxlength="200"><button type="button" class="btn btn-d" id="cmtPostBtn">发表</button></div>';
    } else {
      html += '<p class="cmt-login-hint">演示登录后即可评论 → <a href="' + loginUrl() + '">去登录</a></p>';
    }
    section.innerHTML = html;
    on("#cmtPostBtn", "click", postComment);
    on("#cmtInput", "keydown", function (e) { if (e.key === "Enter") postComment(); });
  }

  function postComment() {
    var inp = $("#cmtInput");
    if (!inp || !inp.value.trim()) { toast("请先输入评论内容", "err"); return; }
    var u = curUser();
    if (!u) { toast("请先登录", "err"); return; }
    if (!curWork) { toast("评论失败：未选择作品", "err"); return; }
    var all = LS.get("comments", {});
    var key = String(curWork.id);
    if (!all[key]) all[key] = [];
    all[key].unshift({ name: u.name, content: inp.value.trim(), time: new Date().toLocaleString("zh-CN", { hour12: false }) });
    LS.set("comments", all);
    renderComments(curWork.id);
    toast("评论已发表");
  }

  /* ============================================================
   * 个人主页（演示）
   * ============================================================ */
  function showProfile() {
    var u = curUser();
    if (!u) return;
    var d = $("#userDropdown");
    if (d) d.classList.remove("show");
    $("#mTitle").textContent = "我的主页";
    $("#mMeta").textContent = "演示账号 · 数据保存在本机浏览器";
    $("#mart").innerHTML = "";
    var l = likes().length, b = bookmarks().length;
    var cAll = LS.get("comments", {});
    var c = 0;
    Object.keys(cAll).forEach(function (k) { c += cAll[k].length; });
    $("#mBody").innerHTML =
      '<div class="pf-head">' +
      '<div class="pf-av">' + esc(u.name.charAt(0)) + "</div>" +
      "<h3>" + esc(u.name) + "</h3>" +
      '<p class="pf-mail">' + esc(u.email || "") + "</p></div>" +
      '<div class="pf-stats">' +
      "<div><strong>" + l + "</strong><br><small>点赞</small></div>" +
      "<div><strong>" + b + "</strong><br><small>收藏</small></div>" +
      "<div><strong>" + c + "</strong><br><small>评论</small></div></div>" +
      '<p class="pf-note">基础版本为本地演示：点赞、收藏、评论与投稿记录均保存在本机 localStorage，清除浏览器数据后重置。</p>';
    var cs = $("#articleModal #comments-section");
    if (cs) cs.innerHTML = "";
    var lb = $("#mLikeBtn");
    if (lb) { lb.className = "mact"; lb.innerHTML = ""; }
    var bb = $("#mBookmarkBtn");
    if (bb) { bb.className = "mact"; bb.innerHTML = ""; }
    $("#articleModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* ============================================================
   * 搜索下拉
   * ============================================================ */
  function bindSearch() {
    var inp = $("#searchInput"), res = $("#searchR");
    if (!inp || !res) return;
    var timer;
    inp.addEventListener("input", function () {
      var q = this.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { res.classList.remove("show"); res.innerHTML = ""; return; }
      res.innerHTML = '<div class="loading">搜索中...</div>';
      res.classList.add("show");
      timer = setTimeout(function () {
        var ql = q.toLowerCase();
        var list = DATA.works.filter(function (w) {
          var hay = (w.title + " " + w.author + " " + w.excerpt + " " + w.grade + " " + w.class_name + " " + (D.categories[w.category] || "")).toLowerCase();
          return hay.indexOf(ql) > -1;
        }).slice(0, 8);
        if (!list.length) { res.innerHTML = '<div class="hint">没有找到匹配的作品</div>'; return; }
        res.innerHTML = list.map(function (w) {
          return '<div class="item" data-id="' + w.id + '"><div class="tt">' + hl(w.title, q) + '</div><div class="mm">' + hl((w.grade || "") + (w.class_name ? w.class_name + "班" : "") + " · " + w.author, q) + "</div></div>";
        }).join("");
      }, 220);
    });
    res.addEventListener("click", function (e) {
      var item = e.target.closest(".item");
      if (!item) return;
      openWork(parseInt(item.dataset.id, 10));
      res.classList.remove("show");
      inp.value = "";
    });
    document.addEventListener("click", function (e) {
      if (!inp.contains(e.target) && !res.contains(e.target)) res.classList.remove("show");
    });
  }

  /* ============================================================
   * 近期活动（日期动态推算 + 倒计时）
   * ============================================================ */
  function renderEvents() {
    var box = $("#eventsList");
    if (!box) return;
    box.innerHTML = D.events.map(function (ev, i) {
      var d = new Date();
      d.setDate(d.getDate() + ev.days);
      var hh = parseInt((ev.time || "18:00").split(":")[0], 10);
      if (isNaN(hh)) hh = 18;
      var target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, 0, 0);
      return '<div class="ec rv d' + (i + 1) + '">' +
        '<div class="ed"><span class="day">' + d.getDate() + '</span><span class="mon">' + (d.getMonth() + 1) + "月</span></div>" +
        '<div class="eb"><h3>' + esc(ev.title) + "</h3>" +
        "<p><strong>时间：</strong>" + d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + esc(ev.time) + "</p>" +
        "<p><strong>地点：</strong>" + esc(ev.loc) + "</p>" +
        "<p>" + esc(ev.desc) + "</p>" +
        '<div class="cdw" data-td="' + target.getTime() + '">' +
        '<div><div class="val">--</div><div class="lbl">天</div></div>' +
        '<div><div class="val">--</div><div class="lbl">时</div></div>' +
        '<div><div class="val">--</div><div class="lbl">分</div></div>' +
        '<div><div class="val">--</div><div class="lbl">秒</div></div>' +
        "</div></div></div>";
    }).join("");
    tickCountdown();
    setInterval(tickCountdown, 1000);
    observeReveals();
  }

  function tickCountdown() {
    var now = Date.now();
    $$(".cdw").forEach(function (el) {
      var df = parseInt(el.dataset.td, 10) - now;
      var vals = el.querySelectorAll(".val");
      if (df <= 0) { vals.forEach(function (v) { v.textContent = "00"; }); return; }
      var d = Math.floor(df / 864e5);
      var h = Math.floor((df % 864e5) / 36e5);
      var m = Math.floor((df % 36e5) / 6e4);
      var s = Math.floor((df % 6e4) / 1e3);
      [d, h, m, s].forEach(function (v, i) { if (vals[i]) vals[i].textContent = String(v).padStart(2, "0"); });
    });
  }

  /* ============================================================
   * 社员 / 门户 / 文案 / 联系
   * ============================================================ */
  function renderMembers() {
    var box = $("#membersGrid");
    if (!box) return;
    box.innerHTML = D.members.map(function (m, i) {
      return '<div class="mc rv d' + (i + 1) + '">' +
        '<div class="mav" style="background:linear-gradient(135deg,' + m.hue + "," + m.hue + "cc)\">" + esc(m.name.charAt(0)) + "</div>" +
        "<h3>" + esc(m.name) + "</h3>" +
        '<div class="mrole">' + esc(m.role) + "</div>" +
        '<p class="mq">“' + esc(m.quote) + '”</p>' +
        '<div class="mbio">' + esc(m.bio) + "</div></div>";
    }).join("");
    observeReveals();
  }

  var PORTAL_ICON = { book: "book", pen: "pen", feather: "feather", globe: "globe", pencil: "pencil" };

  function renderPortals() {
    var box = $("#portalGrid");
    if (!box) return;
    box.innerHTML = D.portals.map(function (p, i) {
      return '<a class="pc rv d' + ((i % 4) + 1) + '" href="' + esc(p.url) + '" target="_blank" rel="noopener">' +
        '<div class="pico">' + icon(PORTAL_ICON[p.icon] || "book") + "</div>" +
        "<h3>" + esc(p.name) + "</h3><p>" + esc(p.desc) + '</p><span class="lt">访问网站 →</span></a>';
    }).join("");
    observeReveals();
  }

  function renderTexts() {
    var sub = $("#heroSub");
    if (sub) sub.textContent = D.site.intro;
    var at = $("#aboutText");
    if (at) {
      at.innerHTML = D.site.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
        '<a href="#contact" class="btn btn-d" style="margin-top:10px">了解更多</a>';
    }
    var c = D.contact;
    var set = function (id, v) { var el = $(id); if (el) el.textContent = v; };
    set("#cAddress", c.address);
    set("#cEmail", c.email);
    set("#cPhone", c.phone);
    set("#cHours", c.hours);
    set("#copyLine", D.site.copyright + " | 基础版本 v0.2 · 本地演示");
  }

  /* ============================================================
   * 表单（本地演示提交）
   * ============================================================ */
  function bindForm(formSel, okSel, key, okMsg, btnLabel) {
    var form = $(formSel);
    if (!form) return;
    var btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      $$("input, textarea, select", form).forEach(function (el) { if (el.id) data[el.id] = el.value.trim(); });
      if (btn) { btn.disabled = true; btn.textContent = "提交中..."; }
      setTimeout(function () {
        var arr = LS.get(key, []);
        data._time = new Date().toLocaleString("zh-CN", { hour12: false });
        arr.unshift(data);
        LS.set(key, arr);
        var ok = $(okSel);
        if (ok) {
          ok.style.display = "block";
          setTimeout(function () { ok.style.display = "none"; }, 4000);
        }
        form.reset();
        if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
        toast(okMsg);
      }, 350);
    });
  }

  /* ============================================================
   * 二维码弹窗
   * ============================================================ */
  function openQr(type) {
    var isWx = type === "wechat";
    var seed = isWx ? 7 : 13;
    var cells = "";
    for (var r = 0; r < 7; r++) {
      for (var c = 0; c < 7; c++) {
        var corner = (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2);
        var on = corner ? true : (r === 3 && c === 3) || (r * 3 + c * 5 + seed) % 3 === 0;
        cells += '<i class="' + (on ? "b" : "") + '"></i>';
      }
    }
    $("#qrContent").innerHTML =
      '<h3 class="qr-title">' + (isWx ? "关注微信公众号" : "加入QQ交流群") + "</h3>" +
      '<div class="qr-pattern">' + cells + "</div>" +
      '<p class="qr-desc">' + esc(isWx ? D.contact.wechat : D.contact.qq) + "</p>";
    $("#qrModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* ============================================================
   * 用户菜单
   * ============================================================ */
  function renderUserUI() {
    var u = curUser();
    var d = $("#userDropdown");
    var b = $("#userBtn");
    if (!d || !b) return;
    if (u) {
      b.textContent = u.name.charAt(0);
      b.title = u.name;
      d.innerHTML =
        '<a href="#" data-act="profile">' + icon("user") + " 我的主页</a>" +
        '<a href="#" data-act="logout">' + icon("arrow-right") + " 退出登录</a>";
    } else {
      b.innerHTML = icon("user");
      b.title = "登录 / 注册";
      d.innerHTML =
        '<a href="' + loginUrl() + '">' + icon("user") + " 登录</a>" +
        '<a href="' + loginUrl() + '">' + icon("feather") + " 注册</a>";
    }
    $$("a[data-act]", d).forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var act = a.dataset.act;
        if (act === "profile") showProfile();
        if (act === "logout") { LS.del("user"); renderUserUI(); toast("已退出登录"); }
      });
    });
  }

  /* ============================================================
   * 分享与登录回跳
   * ============================================================ */
  function shareWork(w) {
    var url = location.origin + location.pathname + "?id=" + w.id;
    if (navigator.share) {
      navigator.share({ title: w.title + " · 新笔文学社", text: w.excerpt || "", url: url }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("链接已复制，去粘贴给同学吧"); }, function () { toast("复制失败，请手动复制地址栏链接", "err"); });
    } else {
      toast("请手动复制地址栏链接", "err");
    }
  }

  function loginUrl() {
    return "login.html?next=" + encodeURIComponent(location.pathname + location.search);
  }

  /* 作品页结构化数据（CreativeWork） */
  function injectWorkLD(w) {
    var old = document.getElementById("ld-work");
    if (old) old.remove();
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "ld-work";
    var ld = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "name": w.title,
      "author": { "@type": "Person", "name": w.author || "佚名" },
      "genre": D.categories[w.category] || "",
      "publisher": { "@type": "Organization", "name": "新笔文学社" },
      "inLanguage": "zh-CN",
      "abstract": w.excerpt || ""
    };
    if (w.created_at) ld.datePublished = w.created_at;
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  /* ============================================================
   * 作品详情页（work.html）
   * ============================================================ */
  function renderWorkPage() {
    var id = parseInt(new URLSearchParams(location.search).get("id") || "0", 10);
    var wrap = $("#wkWrap");
    if (!wrap) return;

    function notFound() {
      var ld = $("#wkLoading");
      if (ld) ld.style.display = "none";
      wrap.innerHTML = '<p class="empty">未找到该作品，可能链接有误。返回 <a href="index.html#works">作品展示</a> 看看。</p>';
      wrap.style.display = "block";
    }

    function paint(w) {
      curWork = w;
      document.title = w.title + " · 新笔文学社";
      var liked = likes().indexOf(w.id) > -1;
      var bmed = bookmarks().indexOf(w.id) > -1;
      var idx = DATA.works.indexOf(w);
      var prev = idx > 0 ? DATA.works[idx - 1] : null;
      var next = idx > -1 && idx < DATA.works.length - 1 ? DATA.works[idx + 1] : null;

      $("#wkTitle").textContent = w.title;
      $("#wkMeta").textContent = (w.grade ? w.grade + (w.class_name ? w.class_name + "班" : "") + " · " : "") + w.author + " · " + (D.categories[w.category] || "") + (w.created_at ? " · " + fmtDate(w.created_at) : "");
      $("#wkArt").innerHTML = coverArt(w);
      $("#wkBody").innerHTML = w.content.map(function (p) { return p ? "<p>" + esc(p) + "</p>" : ""; }).join("");
      $("#wkActions").innerHTML =
        '<button type="button" class="like-btn' + (liked ? " liked" : "") + '" data-id="' + w.id + '">' + icon("heart", liked) + ' <span class="n">' + (w.likes + (liked ? 1 : 0)) + "</span> 喜欢</button>" +
        '<button type="button" class="bookmark-btn' + (bmed ? " liked" : "") + '" data-id="' + w.id + '">' + icon("bookmark", bmed) + ' <span class="n">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span> 收藏</button>" +
        '<button type="button" class="share-btn" id="wkShareBtn">' + icon("share") + " 分享</button>";
      on("#wkShareBtn", "click", function () { shareWork(w); });
      injectWorkLD(w);
      renderComments(w.id);

      var navHtml = "";
      navHtml += prev ? '<a class="btn btn-l sm" href="work.html?id=' + prev.id + '">← ' + esc(prev.title) + "</a>" : "<span></span>";
      navHtml += next ? '<a class="btn btn-l sm" href="work.html?id=' + next.id + '">' + esc(next.title) + " →</a>" : "<span></span>";
      $("#wkNav").innerHTML = navHtml;

      var rel = DATA.works.filter(function (x) { return x.id !== w.id && x.category === w.category; });
      if (rel.length < 2) {
        DATA.works.forEach(function (x) {
          if (x.id !== w.id && rel.indexOf(x) < 0 && rel.length < 3) rel.push(x);
        });
      }
      var relBox = $("#wkRelated");
      if (relBox) {
        relBox.innerHTML = rel.map(function (x) {
          return '<a class="spine" href="work.html?id=' + x.id + '" title="《' + esc(x.title) + '》"><div class="cover-wrap">' + coverArt(x) + "</div></a>";
        }).join("");
      }
      wrap.style.display = "block";
      var ld = $("#wkLoading");
      if (ld) ld.style.display = "none";
      observeReveals();
    }

    var w = workById(id);
    if (w) { paint(w); return; }
    if (DATA.remoteTried || !CFG.enableRemote) { notFound(); return; }
    loadRemoteWorks().then(function () {
      var w2 = workById(id);
      if (w2) paint(w2); else notFound();
    });
  }

  /* ============================================================
   * 社刊往期页（journal.html）
   * ============================================================ */
  function renderJournal() {
    var box = $("#journalList");
    if (!box) return;
    var j = D.journal;
    var intro = $("#journalIntro");
    if (intro) intro.textContent = j.intro;
    box.innerHTML = j.issues.map(function (is, i) {
      return '<div class="jissue rv d' + ((i % 4) + 1) + '">' +
        '<div class="jno"><span class="jno-n">第' + is.no + '期</span><span class="jno-d">' + esc(is.date) + " · " + esc(is.term) + "之卷</span></div>" +
        '<div class="jbody"><h3>' + esc(is.theme) + "</h3>" +
        '<ul class="jpieces">' + is.pieces.map(function (p) {
          return "<li><span class=\"jp-t\">" + esc(p.title) + '</span><span class="jp-m">' + esc(p.author) + " · " + esc(p.type) + '</span><span class="jp-p">' + esc(p.page) + "</span></li>";
        }).join("") + "</ul>" +
        '<span class="btn btn-l sm jdl">下载本期 PDF（演示）</span>' +
        "</div></div>";
    }).join("");
    $$(".jdl").forEach(function (b) {
      b.addEventListener("click", function () { toast("演示版本：社刊 PDF 尚未接入", "err"); });
    });
    observeReveals();
  }

  /* ============================================================
   * 滚动 / 导航 / 主题
   * ============================================================ */
  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

  function bindChrome() {
    var header = $("#header"), pbar = $("#pbar"), btop = $("#backTop");
    var links = $$(".nav-links a, .mnav a");
    var secs = $$("section[id]");

    function onScroll() {
      var y = window.scrollY || 0;
      if (header) header.classList.toggle("scrolled", y > 60);
      if (pbar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        pbar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
      }
      if (btop) btop.classList.toggle("show", y > 500);
      var cur = "";
      secs.forEach(function (s) {
        if (s.getBoundingClientRect().top <= 150) cur = s.id;
      });
      links.forEach(function (a) {
        var on2 = a.getAttribute("href") === "#" + cur;
        a.classList.toggle("active", on2);
        if (on2) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var mb = $("#menuBtn"), mn = $("#mobileNav");
    if (mb && mn) {
      var open = false;
      mb.addEventListener("click", function () {
        open = !open;
        mb.classList.toggle("active", open);
        mn.classList.toggle("open", open);
        document.body.style.overflow = open ? "hidden" : "";
      });
      $$("a", mn).forEach(function (a) {
        a.addEventListener("click", function () {
          open = false;
          mb.classList.remove("active");
          mn.classList.remove("open");
          document.body.style.overflow = "";
        });
      });
    }

    var ub = $("#userBtn"), ud = $("#userDropdown");
    if (ub && ud) {
      ub.addEventListener("click", function (e) { e.stopPropagation(); ud.classList.toggle("show"); });
      document.addEventListener("click", function (e) {
        if (!e.target.closest("#userBtn") && !e.target.closest("#userDropdown")) ud.classList.remove("show");
      });
    }

    on("#backTop", "click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

    var darkSaved = LS.get("dark", null);
    var darkOn = darkSaved === null
      ? !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
      : darkSaved === "1";
    var dk = $("#darkToggle");
    function applyDark() {
      document.body.classList.toggle("dark", darkOn);
      if (dk) dk.innerHTML = icon(darkOn ? "sun" : "moon");
      LS.set("dark", darkOn ? "1" : "0");
    }
    on("#darkToggle", "click", function () { darkOn = !darkOn; applyDark(); });
    applyDark();
  }

  /* ---------- 滚动揭示 ---------- */
  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("on"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
  }
  function observeReveals() {
    $$(".rv:not(.on),.rl:not(.on),.rr:not(.on),.rs:not(.on)").forEach(function (el) {
      if (io) io.observe(el);
      else {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add("on");
      }
    });
  }

  /* ---------- 幕头动效 ---------- */
  function bindHero() {
    var hp = $("#herop");
    if (hp) {
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        for (var i = 0; i < 30; i++) {
          var p = document.createElement("div");
          var s = Math.random() * 4 + 2;
          p.style.cssText = "width:" + s + "px;height:" + s + "px;left:" + Math.random() * 100 + "%;animation-delay:" + Math.random() * 10 + "s;animation-duration:" + (Math.random() * 8 + 6) + "s";
          hp.appendChild(p);
        }
      }
    }
    var el = $("#heroTitle");
    if (el && !el.dataset.done) {
      el.dataset.done = "1";
      var t = el.textContent;
      el.textContent = "";
      for (var i = 0; i < t.length; i++) {
        var sp = document.createElement("span");
        sp.className = "ch";
        sp.textContent = t[i];
        sp.style.animationDelay = (0.2 + i * 0.06) + "s";
        el.appendChild(sp);
      }
    }
  }

  /* ---------- 弹窗与全局委托 ---------- */
  function bindModals() {
    on("#modalClose", "click", closeModal);
    var am = $("#articleModal");
    if (am) am.addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    on("#qrClose", "click", function () {
      var q = $("#qrModal");
      if (q) q.classList.remove("open");
      document.body.style.overflow = "";
    });
    var qm = $("#qrModal");
    if (qm) qm.addEventListener("click", function (e) {
      if (e.target === this) { this.classList.remove("open"); document.body.style.overflow = ""; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal();
        var q = $("#qrModal");
        if (q) q.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
    on("#mLikeBtn", "click", function () { if (curWork) toggleLike(curWork.id); });
    on("#mBookmarkBtn", "click", function () { if (curWork) toggleBookmark(curWork.id); });
    on("#mCommentBtn", "click", function () {
      var inp = $("#cmtInput");
      if (inp) { inp.focus(); inp.scrollIntoView({ behavior: "smooth", block: "center" }); }
      else toast("请先登录后再评论", "err");
    });
    $$(".qr-link").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); openQr(a.dataset.type); });
    });
  }

  /* 点赞 / 收藏：全局委托（列表、弹窗、详情页共用） */
  function bindWorkActions() {
    document.addEventListener("click", function (e) {
      var lb = e.target.closest(".like-btn");
      if (lb && lb.dataset.id) { toggleLike(parseInt(lb.dataset.id, 10)); return; }
      var bb = e.target.closest(".bookmark-btn");
      if (bb && bb.dataset.id) { toggleBookmark(parseInt(bb.dataset.id, 10)); }
    });
  }

  function bindWorksEvents() {
    var grid = $("#worksGrid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var card = e.target.closest(".wc");
        if (card && !e.target.closest(".like-btn") && !e.target.closest(".bookmark-btn")) {
          openWork(parseInt(card.dataset.id, 10));
        }
      });
    }
    $$("#filtersB button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#filtersB button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        wState.filter = b.dataset.f;
        renderWorks(true);
      });
    });
  }

  /* ============================================================
   * 本地管理覆盖层（由 admin.html 维护，全站生效）
   * useLocal = true 时进入“本地管理模式”：作品/活动/社员/社刊
   * 以本地编辑为准，不再拉取远端。
   * ============================================================ */
  function applyOverlay() {
    var ov = LS.get("overlay", null);
    if (!ov) return;
    if (ov.useLocal) {
      var del = ov.deletedWorks || [];
      var list = D.works.filter(function (w) { return del.indexOf(w.id) < 0; }).map(function (w) {
        return (ov.works && ov.works[w.id]) || w;
      });
      if (ov.works) {
        Object.keys(ov.works).forEach(function (k) {
          if (ov.works[k]._new) list.push(ov.works[k]);
        });
      }
      DATA.works = list;
      DATA.source = "local-managed";
      DATA.remoteTried = true;
    }
    if (ov.events) D.events = ov.events;
    if (ov.members) D.members = ov.members;
    if (ov.journal) D.journal.issues = ov.journal;
  }

  /* ============================================================
   * 启动
   * ============================================================ */
  function init() {
    DATA.works = D.works.slice();
    applyOverlay();
    var page = document.body.getAttribute("data-page");

    renderUserUI();
    bindChrome();
    bindHero();
    bindWorkActions();
    bindModals();
    observeReveals();

    if (page === "index") {
      renderTexts();
      renderEvents();
      renderMembers();
      renderPortals();
      bindSearch();
      bindWorksEvents();
      bindForm("#subForm", "#subOk", "submissions", "投稿已提交，我们将尽快审核（本地演示）", "提交投稿");
      bindForm("#memForm", "#memOk", "applications", "申请已提交，我们将尽快与您联系（本地演示）", "提交申请");
      if (DATA.source === "local-managed") {
        setSourceBadge();
        renderWorks(true);
      } else {
        var badge = $("#srcBadge");
        if (badge) { badge.textContent = "正在连接社团作品库…"; badge.className = "src-badge src-loading"; }
        showSkeleton();
        loadRemoteWorks().then(function (remote) {
          renderWorks(true);
          if (remote) toast("已加载社团作品库真实数据");
        });
      }
    }
    if (page === "work") renderWorkPage();
    if (page === "journal") renderJournal();

    if (page === "index" || page === "work" || page === "journal") {
      var y = $("#year");
      if (y) y.textContent = new Date().getFullYear();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
