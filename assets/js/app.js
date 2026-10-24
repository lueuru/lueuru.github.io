/* ============================================================
 * 新笔文学社 · 基础版本 v0.1 —— 交互脚本
 * 纯前端、零依赖；所有“动态”能力（点赞/收藏/评论/表单/登录）
 * 均以 localStorage 做本地演示，后续可平滑替换为真实接口。
 * ============================================================ */
(function () {
  "use strict";

  var D = window.XB_DATA;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

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

  /* 演示登录状态 */
  function curUser() { return LS.get("user", null); }
  function likes() { return LS.get("likes", []); }
  function bookmarks() { return LS.get("bookmarks", []); }
  function commentsOf(id) { return LS.get("comments", {})[String(id)] || []; }
  function workById(id) {
    for (var i = 0; i < D.works.length; i++) if (D.works[i].id === id) return D.works[i];
    return null;
  }

  /* ---------- 作品封面（SVG 生成，替代外链图） ---------- */
  var CAT_HUE = { prose: "#b8964a", poetry: "#8b3a3a", fiction: "#5b7a6a", essay: "#9c6b3f" };
  var CAT_CHAR = { prose: "散", poetry: "诗", fiction: "小", essay: "随" };

  function coverArt(w) {
    var hue = CAT_HUE[w.category] || "#8b3a3a";
    var cat = D.categories[w.category] || "作品";
    var chars = w.title.split("");
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
      '<text x="26" y="280" font-size="13" fill="#8b7e6c">' + esc(w.author) + " · " + esc(w.grade) + esc(w.class_name) + "班</text>" +
      title +
      "</svg>";
  }

  /* ---------- 作品列表 ---------- */
  var PAGE_SIZE = 6;
  var wState = { filter: "all", shown: PAGE_SIZE };

  function matchWorks() {
    return D.works.filter(function (w) {
      return wState.filter === "all" || w.category === wState.filter;
    });
  }

  function workCard(w, i) {
    var liked = likes().indexOf(w.id) > -1;
    var bmed = bookmarks().indexOf(w.id) > -1;
    return '<div class="wc rv d' + ((i % 4) + 1) + '" data-id="' + w.id + '">' +
      '<div class="wci">' + coverArt(w) + '<span class="wcbadge">' + esc(D.categories[w.category] || "") + "</span></div>" +
      '<div class="wcb">' +
      "<h3>" + esc(w.title) + "</h3>" +
      '<div class="wcm">' + esc(w.grade) + " · " + esc(w.class_name) + "班 · " + esc(w.author) + "</div>" +
      '<p class="wce">' + esc(w.excerpt) + "</p>" +
      '<div class="wcs">' +
      '<button type="button" class="like-btn' + (liked ? " liked" : "") + '" data-id="' + w.id + '" aria-label="点赞">' + icon("heart", liked) + ' <span class="n">' + (w.likes + (liked ? 1 : 0)) + "</span></button>" +
      '<button type="button" class="bookmark-btn' + (bmed ? " liked" : "") + '" data-id="' + w.id + '" aria-label="收藏">' + icon("bookmark", bmed) + ' <span class="n">' + (w.bookmarks + (bmed ? 1 : 0)) + "</span></button>" +
      "</div></div></div>";
  }

  function renderWorks(reset) {
    var list = matchWorks();
    if (reset) wState.shown = PAGE_SIZE;
    var grid = $("#worksGrid");
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '<p class="empty-grid">该分类下暂无作品，换个分类看看。</p>';
      $("#loadMoreWrap").innerHTML = "";
      return;
    }
    grid.innerHTML = list.slice(0, wState.shown).map(workCard).join("");
    var wrap = $("#loadMoreWrap");
    if (list.length > wState.shown) {
      wrap.innerHTML = '<button type="button" class="btn btn-l" id="loadMoreBtn">加载更多作品（还有 ' + (list.length - wState.shown) + " 篇）</button>";
      $("#loadMoreBtn").addEventListener("click", function () { renderWorks(false); observeReveals(); });
    } else {
      wrap.innerHTML = list.length > PAGE_SIZE ? '<p style="color:var(--ink-3);font-size:.85rem">已展示全部 ' + list.length + " 篇作品</p>" : "";
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

  /* ---------- 作品弹窗 ---------- */
  var curWork = null;

  function openWork(id) {
    var w = workById(id);
    if (!w) return;
    curWork = w;
    var liked = likes().indexOf(id) > -1;
    var bmed = bookmarks().indexOf(id) > -1;
    $("#mTitle").textContent = w.title;
    $("#mMeta").textContent = w.grade + " · " + w.class_name + "班 · " + w.author + " · " + (D.categories[w.category] || "");
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
    $("#articleModal").classList.remove("open");
    document.body.style.overflow = "";
    curWork = null;
  }

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
      html += '<p style="color:var(--ink-3);font-size:.85rem;padding:6px 0">还没有评论，来发表第一条吧。</p>';
    }
    if (u) {
      html += '<div class="cmt-input-row"><input id="cmtInput" placeholder="写下你的评论..." maxlength="200"><button type="button" class="btn btn-d" id="cmtPostBtn">发表</button></div>';
    } else {
      html += '<p class="cmt-login-hint">演示登录后即可评论 → <a href="login.html">去登录</a></p>';
    }
    section.innerHTML = html;
    var btn = $("#cmtPostBtn");
    if (btn) btn.addEventListener("click", postComment);
  }

  function postComment() {
    var inp = $("#cmtInput");
    if (!inp || !inp.value.trim()) { toast("请先输入评论内容", "err"); return; }
    var u = curUser();
    if (!u) { toast("请先登录", "err"); return; }
    var all = LS.get("comments", {});
    var key = String(curWork.id);
    if (!all[key]) all[key] = [];
    all[key].unshift({ name: u.name, content: inp.value.trim(), time: new Date().toLocaleString("zh-CN", { hour12: false }) });
    LS.set("comments", all);
    renderComments(curWork.id);
    toast("评论已发表");
  }

  /* ---------- 个人主页（演示） ---------- */
  function showProfile() {
    var u = curUser();
    if (!u) return;
    $("#userDropdown").classList.remove("show");
    $("#mTitle").textContent = "我的主页";
    $("#mMeta").textContent = "演示账号 · 数据保存在本机浏览器";
    $("#mart").innerHTML = "";
    var l = likes().length, b = bookmarks().length;
    var cAll = LS.get("comments", {});
    var c = 0;
    Object.keys(cAll).forEach(function (k) { c += cAll[k].length; });
    $("#mBody").innerHTML =
      '<div style="text-align:center;padding:18px 0">' +
      '<div style="width:76px;height:76px;border-radius:50%;background:var(--red);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;margin-bottom:12px">' + esc(u.name.charAt(0)) + "</div>" +
      "<h3>" + esc(u.name) + "</h3>" +
      '<p style="color:var(--ink-3);font-size:.85rem">' + esc(u.email || "") + "</p></div>" +
      '<div style="display:flex;gap:20px;justify-content:center;padding:14px 0;border-top:1px solid var(--line)">' +
      "<div><strong>" + l + "</strong><br><small>点赞</small></div>" +
      "<div><strong>" + b + "</strong><br><small>收藏</small></div>" +
      "<div><strong>" + c + "</strong><br><small>评论</small></div></div>" +
      '<p style="font-size:.78rem;color:var(--ink-3);margin-top:10px">基础版本为本地演示：点赞、收藏、评论与投稿记录均保存在本机 localStorage，清缓存或换设备后会重置。</p>';
    $("#comments-section").innerHTML = "";
    $("#mLikeBtn").className = "mact";
    $("#mLikeBtn").innerHTML = "";
    $("#mBookmarkBtn").className = "mact";
    $("#mBookmarkBtn").innerHTML = "";
    $("#articleModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* ---------- 搜索下拉 ---------- */
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
        var list = D.works.filter(function (w) {
          var hay = (w.title + " " + w.author + " " + w.excerpt + " " + w.grade + " " + w.class_name + " " + (D.categories[w.category] || "")).toLowerCase();
          return hay.indexOf(ql) > -1;
        }).slice(0, 8);
        if (!list.length) { res.innerHTML = '<div class="hint">没有找到匹配的作品</div>'; return; }
        res.innerHTML = list.map(function (w) {
          return '<div class="item" data-id="' + w.id + '"><div class="tt">' + hl(w.title, q) + '</div><div class="mm">' + hl(w.grade + " · " + w.class_name + "班 · " + w.author, q) + "</div></div>";
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

  /* ---------- 近期活动（日期动态推算 + 倒计时） ---------- */
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

  /* ---------- 社员 / 门户 / 联系 ---------- */
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

  /* ---------- 表单（本地演示提交） ---------- */
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

  /* ---------- 二维码弹窗 ---------- */
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
      "<h3 style=\"color:var(--red);margin-bottom:14px\">" + (isWx ? "关注微信公众号" : "加入QQ交流群") + "</h3>" +
      '<div class="qr-pattern">' + cells + "</div>" +
      '<p style="font-size:.85rem;color:var(--ink-2)">' + esc(isWx ? D.contact.wechat : D.contact.qq) + "</p>";
    $("#qrModal").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* ---------- 用户菜单 ---------- */
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
        '<a href="login.html">' + icon("user") + " 登录</a>" +
        '<a href="login.html">' + icon("feather") + " 注册</a>";
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

  /* ---------- 滚动 / 导航 / 主题 ---------- */
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
        a.classList.toggle("active", a.getAttribute("href") === "#" + cur);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* 移动端菜单 */
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

    /* 用户菜单 */
    var ub = $("#userBtn"), ud = $("#userDropdown");
    if (ub && ud) {
      ub.addEventListener("click", function (e) { e.stopPropagation(); ud.classList.toggle("show"); });
      document.addEventListener("click", function (e) {
        if (!e.target.closest("#userBtn") && !e.target.closest("#userDropdown")) ud.classList.remove("show");
      });
    }

    /* 回到顶部 */
    if (btop) btop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

    /* 深色模式 */
    var darkOn = LS.get("dark", "0") === "1";
    var dk = $("#darkToggle");
    function applyDark() {
      document.body.classList.toggle("dark", darkOn);
      if (dk) dk.innerHTML = icon(darkOn ? "sun" : "moon");
      LS.set("dark", darkOn ? "1" : "0");
    }
    if (dk) dk.addEventListener("click", function () { darkOn = !darkOn; applyDark(); });
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
    if (el) {
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

  /* ---------- 弹窗绑定 ---------- */
  function bindModals() {
    $("#modalClose").addEventListener("click", closeModal);
    $("#articleModal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    $("#qrClose").addEventListener("click", function () {
      $("#qrModal").classList.remove("open");
      document.body.style.overflow = "";
    });
    $("#qrModal").addEventListener("click", function (e) {
      if (e.target === this) { this.classList.remove("open"); document.body.style.overflow = ""; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal();
        $("#qrModal").classList.remove("open");
        document.body.style.overflow = "";
      }
    });
    $("#mLikeBtn").addEventListener("click", function () { if (curWork) toggleLike(curWork.id); });
    $("#mBookmarkBtn").addEventListener("click", function () { if (curWork) toggleBookmark(curWork.id); });
    $("#mCommentBtn").addEventListener("click", function () {
      var inp = $("#cmtInput");
      if (inp) { inp.focus(); inp.scrollIntoView({ behavior: "smooth", block: "center" }); }
      else toast("请先登录后再评论", "err");
    });
    $$(".qr-link").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); openQr(a.dataset.type); });
    });
  }

  /* ---------- 作品卡片事件（委托） ---------- */
  function bindWorksEvents() {
    var grid = $("#worksGrid");
    if (!grid) return;
    grid.addEventListener("click", function (e) {
      var lb = e.target.closest(".like-btn");
      if (lb) { e.stopPropagation(); toggleLike(parseInt(lb.dataset.id, 10)); return; }
      var bb = e.target.closest(".bookmark-btn");
      if (bb) { e.stopPropagation(); toggleBookmark(parseInt(bb.dataset.id, 10)); return; }
      var card = e.target.closest(".wc");
      if (card) openWork(parseInt(card.dataset.id, 10));
    });
    $$("#filtersB button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#filtersB button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        wState.filter = b.dataset.f;
        renderWorks(true);
      });
    });
  }

  /* ---------- 文案与联系信息 ---------- */
  function renderTexts() {
    var sub = $("#heroSub");
    if (sub) sub.textContent = D.site.intro;
    var at = $("#aboutText");
    if (at) {
      at.innerHTML = D.site.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
        '<a href="#contact" class="btn btn-d" style="margin-top:10px">了解更多</a>';
    }
    var c = D.contact;
    $("#cAddress").textContent = c.address;
    $("#cEmail").textContent = c.email;
    $("#cPhone").textContent = c.phone;
    $("#cHours").textContent = c.hours;
    $("#copyLine").textContent = D.site.copyright + " | 基础版本 v0.1 · 本地演示";
  }

  /* ---------- 启动 ---------- */
  function init() {
    renderTexts();
    renderUserUI();
    renderWorks(true);
    renderEvents();
    renderMembers();
    renderPortals();
    bindSearch();
    bindWorksEvents();
    bindModals();
    bindChrome();
    bindHero();
    bindForm("#subForm", "#subOk", "submissions", "投稿已提交，我们将尽快审核（本地演示）", "提交投稿");
    bindForm("#memForm", "#memOk", "applications", "申请已提交，我们将尽快与您联系（本地演示）", "提交申请");
    observeReveals();
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
