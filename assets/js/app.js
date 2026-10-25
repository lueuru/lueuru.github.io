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

  /* 演示登录状态 / 云端会话（云端优先） */
  var CLOUD_USER = null;
  function curUser() { return CLOUD_USER || LS.get("user", null); }
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
    if (DATA.source === "cloud") {
      b.textContent = "数据来源：社团云端作品库（实时）";
      b.className = "src-badge src-on";
    } else if (DATA.source === "remote") {
      b.textContent = "数据来源：旧站 Supabase（实时）";
      b.className = "src-badge src-on";
    } else if (DATA.source === "local-managed") {
      b.textContent = "数据来源：本地管理（后台编辑）";
      b.className = "src-badge src-managed";
    } else {
      b.textContent = "数据来源：本地示例数据（云端未连通）";
      b.className = "src-badge";
    }
  }

  /* ============================================================
   * 云端数据加载（WorkBuddy Cloud）
   * ============================================================ */
  function applyCloudData(cloud) {
    var corpus = {};
    D.works.forEach(function (w) { corpus[w.title] = w; });
    if (cloud.works && cloud.works.length) {
      DATA.works = cloud.works.map(function (row) {
        var local = corpus[row.slug] || corpus[row.title];
        var content = (row.content && row.content.length) ? row.content : (local ? local.content : null);
        return {
          id: row.id,
          title: row.title,
          author: row.author,
          grade: row.grade || "",
          class_name: row.class_name || "",
          category: row.category || "essay",
          excerpt: row.excerpt || (local ? local.excerpt : ""),
          content: content && content.length ? content : ["（正文待补充）"],
          likes: row.likes || 0,
          bookmarks: row.bookmarks || 0,
          slug: row.slug || row.title,
          cloud: true
        };
      });
    }
    if (cloud.events && cloud.events.length) {
      D.events = cloud.events.map(function (r) {
        var b = r.body || {};
        return { title: r.title || b.title || "活动", days: b.days || 14, time: b.time || "18:00-20:00", loc: b.loc || "待定", desc: b.desc || "" };
      });
    }
    if (cloud.members && cloud.members.length) {
      D.members = cloud.members.map(function (r) {
        var b = r.body || {};
        return { name: r.title || b.name || "社员", role: b.role || "社员", quote: b.quote || "", bio: b.bio || "", hue: b.hue || "#8b3a3a" };
      });
    }
    if (cloud.issues && cloud.issues.length) {
      D.journal.issues = cloud.issues.map(function (r) { return r.body || {}; });
    }
  }

  function loadCloudData() {
    if (!window.XB_CLOUD) return Promise.resolve(null);
    return XB_CLOUD.load().then(function (ok) {
      if (!ok) return null;
      return Promise.all([
        XB_CLOUD.fetchWorks(),
        XB_CLOUD.fetchContent("event"),
        XB_CLOUD.fetchContent("member"),
        XB_CLOUD.fetchContent("issue")
      ]).then(function (res) {
        var cloud = { works: res[0], events: res[1], members: res[2], issues: res[3] };
        if (!cloud.works && !cloud.events && !cloud.members && !cloud.issues) return null;
        applyCloudData(cloud);
        DATA.source = "cloud";
        return cloud;
      });
    }).catch(function () { return null; });
  }

  /* 旧站 Supabase（项目已下线，默认关闭；如恢复可在 config.js 打开） */
  function loadRemoteWorks() {
    if (DATA.remoteTried) return Promise.resolve(DATA.source === "remote");
    DATA.remoteTried = true;
    var legacy = (window.XB_CONFIG || {}).legacySupabase || {};
    if (!legacy.enableRemote || !legacy.supabaseUrl || !legacy.anonKey) return Promise.resolve(false);
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, legacy.timeoutMs || 7000);
    var url = legacy.supabaseUrl + "/rest/v1/works?select=id,title,author,grade,class_name,category,excerpt,likes,bookmarks,created_at,content&order=created_at.desc&limit=100";
    return fetch(url, { headers: { apikey: legacy.anonKey }, signal: ctrl ? ctrl.signal : undefined })
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
        return DATA.source === "remote";
      })
      .catch(function () {
        clearTimeout(timer);
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
      '<h3 class="bc-title">' + esc(w.title) + "</h3>" +
      '<div class="wcm">' + esc(w.grade) + (w.class_name ? esc(w.class_name) + "班 · " : " · ") +
      '<a href="authors.html?name=' + encodeURIComponent(w.author) + '">' + esc(w.author) + "</a></div>" +
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
    if (window.XB_CLOUD && XB_CLOUD.isReady() && CLOUD_USER) {
      XB_CLOUD.markInteraction(id, "like", i === -1).catch(function () {});
    }
  }

  function toggleBookmark(id) {
    var b = bookmarks();
    var i = b.indexOf(id);
    if (i > -1) b.splice(i, 1); else b.push(id);
    LS.set("bookmarks", b);
    updateWorkUI(id);
    toast(i > -1 ? "已取消收藏" : "已加入收藏");
    if (window.XB_CLOUD && XB_CLOUD.isReady() && CLOUD_USER) {
      XB_CLOUD.markInteraction(id, "bookmark", i === -1).catch(function () {});
    }
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
   * 评论（本地 + 云端合并，两级盖楼）
   * ============================================================ */
  var replyTarget = null;

  function ckey(c) {
    return c.cloud ? ("C:" + c.id) : ("L:" + (c.time || "") + "|" + (c.content || ""));
  }

  function fmtCloudTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* 把评论整理成「顶层 + 其后代（拍平）」 */
  function commentTree(list) {
    list.forEach(function (c) { c._key = ckey(c); });
    var byKey = {};
    list.forEach(function (c) { byKey[c._key] = c; });
    var tops = list.filter(function (c) { return !c.parentKey || !byKey[c.parentKey]; });
    function desc(rootKey) {
      var out = [], queue = [rootKey], guard = 0;
      while (queue.length && guard++ < 200) {
        var k = queue.shift();
        list.forEach(function (c) {
          if (c.parentKey === k && out.indexOf(c) < 0) { out.push(c); queue.push(c._key); }
        });
      }
      return out;
    }
    return { tops: tops, desc: desc, byKey: byKey };
  }

  function commentHtml(c, parentName, u) {
    var replyBtn = u ? '<button type="button" class="cmt-reply-btn" data-reply="' + esc(c._key) + '">回复</button>' : "";
    return '<div class="comment-item">' +
      "<div><strong>" + esc(c.name) + "</strong>" +
      '<span class="cmt-time">' + esc(c.time) + (c.cloud ? " · 云端" : "") + "</span>" + replyBtn + "</div>" +
      (parentName ? '<div class="cmt-content" style="font-size:.8rem;color:var(--ink-3);margin-bottom:2px">回复 @' + esc(parentName) + "</div>" : "") +
      '<div class="cmt-content">' + esc(c.content) + "</div></div>";
  }

  function commentsHtml(list, u) {
    var tree = commentTree(list);
    var html = "<h4>评论 (" + list.length + ")</h4>";
    if (tree.tops.length) {
      html += '<div class="cmt-list">';
      tree.tops.forEach(function (c) {
        html += commentHtml(c, null, u);
        var kids = tree.desc(c._key);
        if (kids.length) {
          html += '<div class="cmt-replies">' + kids.map(function (k) {
            var p = tree.byKey[k.parentKey];
            return commentHtml(k, p ? p.name : null, u);
          }).join("") + "</div>";
        }
      });
      html += "</div>";
    } else {
      html += '<p class="cmt-empty">还没有评论，来发表第一条吧。</p>';
    }
    if (u) {
      html += '<div class="cmt-box"><div class="cmt-target' + (replyTarget ? " on" : "") + '" id="cmtTarget">' +
        (replyTarget ? "正在回复 <b>@" + esc(replyTarget.name) + '</b> <button type="button" id="cmtCancel">×</button>' : "") +
        '</div><div class="cmt-input-row"><input id="cmtInput" placeholder="' + (replyTarget ? "回复 @" + esc(replyTarget.name) + "…" : "写下你的评论…") + '" maxlength="200"><button type="button" class="btn btn-d" id="cmtPostBtn">发表</button></div></div>';
    } else {
      html += '<p class="cmt-login-hint">登录后即可评论 → <a href="' + loginUrl() + '">去登录</a></p>';
    }
    return html;
  }

  function bindCommentUI(id) {
    on("#cmtPostBtn", "click", function () { postComment(id); });
    on("#cmtInput", "keydown", function (e) { if (e.key === "Enter") postComment(id); });
    on("#cmtCancel", "click", function () { replyTarget = null; renderComments(id); });
    $$("#comments-section [data-reply]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-reply");
        var found = null;
        commentsCache.forEach(function (c) { if (ckey(c) === key) found = c; });
        if (!found) return;
        replyTarget = { key: key, name: found.name, cloud: !!found.cloud, id: found.id };
        renderComments(id);
        var inp = $("#cmtInput");
        if (inp) inp.focus();
      });
    });
  }

  var commentsCache = [];

  function renderComments(id) {
    var section = $("#comments-section");
    if (!section) return;
    var u = curUser();
    var local = commentsOf(id).map(function (c) {
      return { name: c.name, content: c.content, time: c.time, parentKey: c.parentKey || null, cloud: false };
    });
    commentsCache = local.slice();
    section.innerHTML = commentsHtml(local, u);
    bindCommentUI(id);

    if (window.XB_CLOUD && XB_CLOUD.isReady()) {
      XB_CLOUD.fetchComments(id).then(function (rows) {
        var cloudList = (rows || []).map(function (r) {
          return {
            id: r.id,
            name: r.author_name || "社员",
            content: r.content || "",
            time: fmtCloudTime(r.created_at),
            cloud: true,
            parentKey: r.parent_id ? ("C:" + r.parent_id) : null
          };
        });
        /* 云端评论在前（较新），本地里与云端内容重复的不再显示 */
        var seen = {};
        cloudList.forEach(function (c) { seen[c.name + "|" + c.content] = true; });
        var localOnly = local.filter(function (c) { return !seen[c.name + "|" + c.content]; });
        commentsCache = cloudList.concat(localOnly);
        section.innerHTML = commentsHtml(commentsCache, curUser());
        bindCommentUI(id);
      }).catch(function () {});
    }
  }

  function postComment(workId) {
    var inp = $("#cmtInput");
    if (!inp || !inp.value.trim()) { toast("请先输入评论内容", "err"); return; }
    var u = curUser();
    if (!u) { toast("请先登录", "err"); return; }
    var wid = workId || (curWork ? curWork.id : null);
    if (!wid) { toast("评论失败：未选择作品", "err"); return; }
    var text = inp.value.trim();
    var target = replyTarget;

    /* 已登录云端 → 直接写库（保留盖楼关系），随后重拉 */
    if (window.XB_CLOUD && XB_CLOUD.isReady() && u.cloud) {
      XB_CLOUD.markInteraction(wid, "comment", true, {
        content: text,
        author_name: u.name,
        parent_id: target && target.cloud ? target.id : null
      }).then(function (r) {
        if (r && r.error) { toast("评论失败：" + ((r.error && r.error.message) || "云端不可用"), "err"); return; }
        replyTarget = null;
        toast(target ? "回复已发表" : "评论已发表");
        renderComments(wid);
      }).catch(function () { toast("评论失败：网络异常", "err"); });
      return;
    }

    /* 本地评论 */
    var all = LS.get("comments", {});
    var key = String(wid);
    if (!all[key]) all[key] = [];
    all[key].unshift({
      name: u.name,
      content: text,
      time: new Date().toLocaleString("zh-CN", { hour12: false }),
      parentKey: target ? target.key : null
    });
    LS.set("comments", all);
    replyTarget = null;
    renderComments(wid);
    toast("评论已发表（本机保存，登录云端账号可同步）");
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
  function bindForm(formSel, okSel, key, okMsg, btnLabel, toCloud) {
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
        /* 同步到社团云端作品库 */
        if (toCloud && window.XB_CLOUD && XB_CLOUD.isReady()) {
          var rec = toCloudRecord(key, data);
          XB_CLOUD.submit(rec).then(function (r) {
            if (r && r.error) toast("云端提交失败，记录已存在本机", "err");
            else toast("已提交到社团云端作品库");
          }).catch(function () { toast("云端提交失败，记录已存在本机", "err"); });
        }
      }, 350);
    });
  }

  function toCloudRecord(key, d) {
    if (key === "submissions") {
      return {
        title: d.sTitle || "无题",
        author: d.sName || "匿名社员",
        grade: d.sGrade || "",
        category: d.sType || "prose",
        content: d.sContent || "",
        contact: [d.sEmail || "", d.sPhone || ""].filter(Boolean).join(" / ")
      };
    }
    return {
      title: "加入申请 · " + (d.mName || "社员"),
      author: d.mName || "社员",
      grade: d.mGrade || "",
      category: "application",
      content: [d.mInterest ? "兴趣：" + d.mInterest : "", d.mMsg || ""].filter(Boolean).join("\n"),
      contact: [d.mEmail || "", d.mPhone || ""].filter(Boolean).join(" / ")
    };
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
        '<a class="btn btn-l sm jdl" href="issue.html?no=' + is.no + '">在线阅读本期 →</a>' +
        "</div></div>";
    }).join("");
    $$(".jdl").forEach(function (b) {
      b.addEventListener("click", function (e) {
        if (b.tagName !== "A") { e.preventDefault(); toast("演示版本：社刊 PDF 尚未接入", "err"); }
      });
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
   * v0.6 扩充区块渲染（首页 / 作品库 / 指南 / 关于）
   * ============================================================ */
  function renderIndexSections() {
    var st = $("#statsStrip");
    if (st) st.innerHTML = (D.site.stats || []).map(function (s) {
      return "<div class='stat'><b>" + esc(s.num) + "</b><span>" + esc(s.label) + "</span></div>";
    }).join("");

    var nb = $("#noticeList");
    if (nb) nb.innerHTML = (D.site.notices || []).map(function (n) {
      return "<li><time>" + esc(n.date) + "</time><span>" + esc(n.text) + "</span></li>";
    }).join("");

    var pre = $("#prefaceBox");
    if (pre && D.site.preface) {
      pre.innerHTML = "<span class='preface-tag'>卷首语 · PREFACE</span><h2>" + esc(D.site.preface.title) + "</h2>" +
        D.site.preface.paragraphs.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
        "<div class='preface-sign'>—— " + esc(D.site.preface.author) + "</div>";
    }

    var cg = $("#columnGrid");
    if (cg) cg.innerHTML = (D.site.columns || []).map(function (c) {
      return "<div class='column-item'><h3>" + esc(c.name) + "</h3><p>" + esc(c.desc) + "</p></div>";
    }).join("");

    var tl = $("#timelineBox");
    if (tl) tl.innerHTML = (D.site.timeline || []).map(function (t) {
      return "<div class='tl-item'><div class='tl-year'>" + esc(t.year) + "</div><div class='tl-title'>" + esc(t.title) + "</div><div class='tl-desc'>" + esc(t.desc) + "</div></div>";
    }).join("");

    var hg = $("#honorGrid");
    if (hg) hg.innerHTML = (D.site.honors || []).map(function (h) {
      return "<div class='honor-item'><span class='honor-year'>" + esc(h.year) + "</span><div><div class='honor-title'>" + esc(h.title) + "</div><div class='honor-org'>" + esc(h.org) + "</div></div></div>";
    }).join("");

    var qs = $("#quoteStrip");
    if (qs) qs.innerHTML = (D.site.quotes || []).map(function (q) {
      return "<div class='quote-card'><p>" + esc(q.text) + "</p><cite>—— " + esc(q.from) + "</cite></div>";
    }).join("");

    var pl = $("#pastList");
    if (pl) pl.innerHTML = (D.pastEvents || []).map(function (p) {
      return "<div class='past-item'><div class='past-date'>" + esc(p.date) + "</div><div><h3>" + esc(p.title) + "</h3><p>" + esc(p.desc) + "</p></div></div>";
    }).join("");

    renderDaily();
    observeReveals();
  }

  /* 作品库（works.html）：筛选 + 排序 + 搜索 + 加载更多 */
  function initWorksPage() {
    var grid = $("#wlibGrid");
    if (!grid) return;
    var st = { cat: "all", sort: "new", q: "", shown: 12 };

    function list() {
      var arr = DATA.works.slice();
      if (st.cat !== "all") arr = arr.filter(function (w) { return w.category === st.cat; });
      if (st.q) {
        var q = st.q.toLowerCase();
        arr = arr.filter(function (w) {
          return ((w.title || "") + (w.author || "") + (w.excerpt || "") + (w.grade || "")).toLowerCase().indexOf(q) > -1;
        });
      }
      if (st.sort === "hot") arr.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
      else if (st.sort === "rating") arr.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
      else arr.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
      return arr;
    }

    function paint() {
      var arr = list();
      grid.innerHTML = arr.slice(0, st.shown).map(workCard).join("") || "<p class='empty-grid'>没有找到匹配的作品，换个关键词试试。</p>";
      var more = $("#wlibMore");
      if (more) {
        if (arr.length > st.shown) {
          more.innerHTML = "<button type='button' class='btn btn-l' id='wlibMoreBtn'>加载更多（还有 " + (arr.length - st.shown) + " 篇）</button>";
          on("#wlibMoreBtn", "click", function () { st.shown += 12; paint(); });
        } else {
          more.innerHTML = arr.length ? "<p class='works-all'>共 " + arr.length + " 篇作品</p>" : "";
        }
      }
      var c = $("#wlibCount");
      if (c) c.textContent = "共 " + arr.length + " 篇";
      observeReveals();
    }

    $$("#wlibFilters button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#wlibFilters button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        st.cat = b.dataset.cat;
        st.shown = 12;
        paint();
      });
    });
    on("#wlibSort", "change", function () { st.sort = this.value; paint(); });
    on("#wlibSearch", "input", function () {
      var v = this.value.trim();
      clearTimeout(st._t);
      st._t = setTimeout(function () { st.q = v; st.shown = 12; paint(); }, 200);
    });

    if (DATA.works.length) paint();
    loadCloudData().then(function (cloud) {
      if (cloud) toast("已同步云端作品库");
      paint();
    });
  }

  /* 投稿指南（guide.html） */
  function initGuidePage() {
    var g = D.site.guide;
    if (!g) return;
    var intro = $("#guideIntro");
    if (intro) intro.textContent = g.intro;
    var rules = $("#guideRules");
    if (rules) rules.innerHTML = g.rules.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    var flow = $("#guideFlow");
    if (flow) flow.innerHTML = g.flow.map(function (f, i) {
      return "<div class='guide-step'><b>" + (i + 1) + "</b><div><h3>" + esc(f.step) + "</h3><p>" + esc(f.desc) + "</p></div></div>";
    }).join("");
    var rw = $("#guideRewards");
    if (rw) rw.textContent = g.rewards;
    var faq = $("#guideFaq");
    if (faq) {
      faq.innerHTML = g.faq.map(function (f, i) {
        return "<div class='faq-item' data-i='" + i + "'><button type='button' class='faq-q'>" + esc(f.q) + "</button><div class='faq-a'>" + esc(f.a) + "</div></div>";
      }).join("");
      $$("#guideFaq .faq-q").forEach(function (b) {
        b.addEventListener("click", function () {
          b.parentElement.classList.toggle("open");
        });
      });
    }
    var cols = $("#guideColumns");
    if (cols) cols.innerHTML = (D.site.columns || []).map(function (c) {
      return "<div class='column-item'><h3>" + esc(c.name) + "</h3><p>" + esc(c.desc) + "</p></div>";
    }).join("");
  }

  /* 关于（about.html） */
  function initAboutPage() {
    var lead = $("#aboutLead");
    if (lead) lead.textContent = D.site.intro;
    renderIndexSections();
  }

  /* 今日诗签 + 今日推荐（按日期轮换） */
  function renderDaily() {
    var daily = $("#dailyStrip");
    if (!daily) return;
    var seed = Math.floor(Date.now() / 86400000);
    var qs = D.site.quotes || [];
    var q = qs.length ? qs[seed % qs.length] : null;
    var ws = DATA.works || [];
    var w = ws.length ? ws[seed % ws.length] : null;
    daily.innerHTML = (q ? "<span class='daily-tag'>今日诗签</span><p class='daily-q'>" + esc(q.text) + "<cite>—— " + esc(q.from) + "</cite></p>" : "") +
      (w ? "<a class='daily-work' href='work.html?id=" + w.id + "'>今日推荐：《" + esc(w.title) + "》→</a>" : "");
  }

  /* 作者名录 / 作者主页 */
  var HUES = ["#8b3a3a", "#b8964a", "#5b7a6a", "#9c6b3f", "#33506b", "#6e2f2a"];

  function authorIndex() {
    var by = {};
    DATA.works.forEach(function (w) {
      var k = w.author || "佚名";
      if (!by[k]) by[k] = { name: k, works: [], likes: 0 };
      by[k].works.push(w);
      by[k].likes += (w.likes || 0);
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.works.length - a.works.length || b.likes - a.likes; });
  }

  function initAuthorsPage() {
    var grid = $("#authorGrid");
    if (!grid) return;

    function paint() {
      var list = authorIndex();
      var name = new URLSearchParams(location.search).get("name");
      var one = name ? list.filter(function (a) { return a.name === name; })[0] : null;
      if (one) { renderAuthor(one); return; }

      var wrap = $("#authorWorks");
      if (wrap) wrap.style.display = "none";
      var old = $("#authorHead");
      if (old) old.parentNode.removeChild(old);
      grid.style.display = "grid";
      $("#authorHero").querySelector("h1").textContent = "作者名录";
      $("#authorSub").innerHTML = "为本刊写过字的人 · " + list.length + " 位作者 · " + DATA.works.length + " 篇作品";
      grid.innerHTML = list.map(function (a, i) {
        var g = a.works[0] || {};
        return "<a class='author-card' href='authors.html?name=" + encodeURIComponent(a.name) + "'>" +
          "<span class='avatar' style='background:" + HUES[i % HUES.length] + "'>" + esc((a.name || "?").slice(0, 1)) + "</span>" +
          "<span><span class='author-name'>" + esc(a.name) + "</span>" +
          "<span class='author-meta'>" + esc((g.grade || "") + (g.class_name ? g.class_name + "班" : "")) + " · " + a.works.length + " 篇 · " + a.likes + " 喜欢</span></span></a>";
      }).join("");
    }

    function renderAuthor(a) {
      grid.style.display = "none";
      var wrap = $("#authorWorks");
      if (!wrap) return;
      wrap.style.display = "block";
      var g = a.works[0] || {};
      var member = (D.members || []).filter(function (m) { return m.name === a.name; })[0];
      var cats = {};
      a.works.forEach(function (w) { cats[w.category] = (cats[w.category] || 0) + 1; });
      var old = $("#authorHead");
      if (old) old.parentNode.removeChild(old);
      var head = document.createElement("div");
      head.className = "author-head rv on";
      head.id = "authorHead";
      head.innerHTML = "<span class='avatar' style='background:" + (member ? member.hue : "#8b3a3a") + "'>" + esc((a.name || "?").slice(0, 1)) + "</span>" +
        "<div><h2>" + esc(a.name) + "</h2><p>" + esc((g.grade || "") + (g.class_name ? g.class_name + "班" : "")) + (member ? " · " + esc(member.role) : "") + "</p>" +
        (member ? "<p style='color:var(--ink-2);margin-top:8px;font-family:var(--kai)'>“" + esc(member.quote) + "”</p>" : "") +
        "<div class='author-stats'><span><b>" + a.works.length + "</b>篇作品</span><span><b>" + a.likes + "</b>获喜欢</span><span><b>" + Object.keys(cats).length + "</b>种文体</span></div></div>";
      wrap.insertBefore(head, wrap.firstChild);
      $("#authorHero").querySelector("h1").textContent = a.name;
      $("#authorSub").innerHTML = "作者主页 · 新笔文学社";
      $("#awTitle").textContent = "全部作品";
      $("#awGrid").innerHTML = a.works.map(workCard).join("");
      document.title = a.name + " - 新笔文学社";
      observeReveals();
    }

    paint();
    loadCloudData().then(function () { paint(); });
  }

  /* 社刊期号页 */
  function initIssuePage() {
    var no = parseInt(new URLSearchParams(location.search).get("no"), 10);
    var idx = 0;
    (D.journal.issues || []).forEach(function (is, i) { if (is.no === no) idx = i; });

    function paint() {
      var list = D.journal.issues || [];
      var is = list[idx] || list[0];
      if (!is) return;
      $("#issueTitle").textContent = "第" + is.no + "期 · " + is.theme;
      $("#issueMeta").textContent = "《年轻的心》 · " + is.date + " · " + is.term + "季刊";
      document.title = "第" + is.no + "期 " + is.theme + " - 新笔文学社";

      var pieces = is.pieces || [];
      $("#issueToc").innerHTML = pieces.map(function (p) {
        var w = DATA.works.filter(function (x) { return x.title === p.title; })[0];
        var title = w
          ? "<a href='work.html?id=" + w.id + "'><span class='t'>" + esc(p.title) + "</span></a>"
          : "<span class='t'>" + esc(p.title) + "</span>";
        return "<div class='toc-row'><div>" + title + "<span class='toc-type'>" + esc(p.type) + "</span></div><div class='a'>" + esc(p.author) + "</div><div class='p'>" + esc(p.page) + "</div></div>";
      }).join("") || "<p class='ad-empty'>本期目录整理中</p>";

      var pw = $("#issuePrefaceWrap");
      if (idx === 0 && D.site.preface) {
        pw.style.display = "block";
        $("#issuePreface").innerHTML = D.site.preface.paragraphs.map(function (t) {
          return "<p style='text-indent:2em;line-height:2;color:var(--ink-2);margin-bottom:.8em'>" + esc(t) + "</p>";
        }).join("") + "<p style='text-align:right;color:var(--ink-3);font-size:.85rem'>—— " + esc(D.site.preface.author) + "</p>";
      } else {
        pw.style.display = "none";
      }

      var works = pieces.map(function (p) {
        return DATA.works.filter(function (x) { return x.title === p.title; })[0];
      }).filter(Boolean);
      var ww = $("#issueWorksWrap");
      if (works.length) {
        ww.style.display = "block";
        $("#issueWorks").innerHTML = works.map(workCard).join("");
      } else {
        ww.style.display = "none";
      }

      var prev = list[idx + 1], next = list[idx - 1];
      $("#issueNav").innerHTML =
        (next ? "<a class='btn btn-l sm' href='issue.html?no=" + next.no + "'>← 第" + next.no + "期</a>" : "<span></span>") +
        "<a class='btn btn-l sm' href='journal.html'>全部往期</a>" +
        (prev ? "<a class='btn btn-l sm' href='issue.html?no=" + prev.no + "'>第" + prev.no + "期 →</a>" : "<span></span>");
      observeReveals();
    }

    paint();
    loadCloudData().then(function () { paint(); });
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

    /* 云端会话检查（登录态） */
    if (window.XB_CLOUD) {
      XB_CLOUD.load()
        .then(function () { return XB_CLOUD.session(); })
        .then(function (s) {
          if (s && s.user) {
            CLOUD_USER = { name: s.user.email || s.user.name || "社员", email: s.user.email || "", cloud: true };
            renderUserUI();
          }
        })
        .catch(function () {});
    }

    if (page === "index") {
      renderTexts();
      renderIndexSections();
      renderEvents();
      renderMembers();
      renderPortals();
      bindSearch();
      bindWorksEvents();
      bindForm("#subForm", "#subOk", "submissions", "投稿已提交，我们将尽快审核", "提交投稿", true);
      bindForm("#memForm", "#memOk", "applications", "申请已提交，我们将尽快与您联系", "提交申请", true);
      if (DATA.source === "local-managed") {
        setSourceBadge();
        renderWorks(true);
      } else {
        var badge = $("#srcBadge");
        if (badge) { badge.textContent = "正在连接社团云端作品库…"; badge.className = "src-badge src-loading"; }
        showSkeleton();
        loadCloudData().then(function (cloud) {
          if (cloud) {
            renderWorks(true);
            renderEvents();
            renderMembers();
            setSourceBadge();
            toast("已连接社团云端作品库");
            return;
          }
          /* 云端不可达 → 尝试旧站 Supabase → 都没有则用本地示例 */
          loadRemoteWorks().then(function (remote) {
            renderWorks(true);
            setSourceBadge();
            if (!remote) {
              var b = $("#srcBadge");
              if (b) b.textContent = "数据来源：本地示例数据（云端未连通）";
            }
          });
        });
      }
    }
    if (page === "work") renderWorkPage();
    if (page === "journal") renderJournal();
    if (page === "works") initWorksPage();
    if (page === "authors") initAuthorsPage();
    if (page === "issue") initIssuePage();
    if (page === "guide") initGuidePage();
    if (page === "about") initAboutPage();
    if (page === "journal") {
      loadCloudData().then(function (cloud) { if (cloud) { renderJournal(); } });
    }

    if (page === "index" || page === "work" || page === "journal" || page === "works" || page === "guide" || page === "about" || page === "authors" || page === "issue") {
      var y = $("#year");
      if (y) y.textContent = new Date().getFullYear();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
