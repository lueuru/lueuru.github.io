/* ============================================================
 * 新笔文学社 · 基础版本 —— 内容管理后台（admin.html）
 * 本地演示级后台：所有编辑保存在本机 localStorage 覆盖层中，
 * 全站页面读取同一覆盖层生效；可导出 JSON 交接、可恢复默认。
 * ============================================================ */
window.XB_ADMIN = (function () {
  "use strict";

  var D = window.XB_DATA;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem("xb_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem("xb_" + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem("xb_" + k); } catch (e) {} }
  };

  var CATS = ["prose", "poetry", "fiction", "essay"];
  var HUES = ["#8b3a3a", "#b8964a", "#5b7a6a", "#9c6b3f", "#33506b", "#6e2f2a"];
  var editingWorkId = null;

  function overlay() {
    var ov = LS.get("overlay", null);
    if (!ov) ov = { useLocal: false, works: {}, deletedWorks: [], events: null, members: null, journal: null };
    return ov;
  }
  function saveOverlay(ov) { LS.set("overlay", ov); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(m, t) {
    var e = $("#toastEl");
    if (!e) return;
    e.textContent = m;
    e.className = "toast toast-" + (t || "ok") + " show";
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.classList.remove("show"); }, 2200);
  }

  /* 合并后的当前数据集（与前台一致） */
  function currentWorks() {
    var ov = overlay();
    if (!ov.useLocal) return D.works.slice();
    var del = ov.deletedWorks || [];
    var list = D.works.filter(function (w) { return del.indexOf(w.id) < 0; }).map(function (w) {
      return (ov.works && ov.works[w.id]) || w;
    });
    if (ov.works) Object.keys(ov.works).forEach(function (k) { if (ov.works[k]._new) list.push(ov.works[k]); });
    return list;
  }
  function currentEvents() { var ov = overlay(); return ov.events || D.events; }
  function currentMembers() { var ov = overlay(); return ov.members || D.members; }
  function currentJournal() { var ov = overlay(); return ov.journal || D.journal.issues; }

  /* ============================================================
   * 作品管理
   * ============================================================ */
  function renderWorks() {
    var list = currentWorks();
    $("#wkCount").textContent = "共 " + list.length + " 篇";
    var html = "";
    list.forEach(function (w, i) {
      html += "<tr>" +
        "<td>" + (i + 1) + "</td>" +
        "<td><strong>" + esc(w.title) + "</strong></td>" +
        "<td>" + esc(w.author) + "</td>" +
        "<td>" + esc(w.grade || "") + (w.class_name ? esc(w.class_name) + "班" : "") + "</td>" +
        "<td>" + esc(D.categories[w.category] || w.category) + "</td>" +
        "<td>" + (w.remote ? "远端" : "本地") + "</td>" +
        "<td class='ad-ops'>" +
        "<button class='ad-mini' data-edit='" + w.id + "'>编辑</button>" +
        "<button class='ad-mini danger' data-del='" + w.id + "'>删除</button>" +
        "</td></tr>";
    });
    $("#wkRows").innerHTML = html || "<tr><td colspan='7' class='ad-empty'>暂无作品，点击“新增作品”开始</td></tr>";
    $$("#wkRows [data-edit]").forEach(function (b) {
      b.addEventListener("click", function () { openWorkEditor(parseInt(b.dataset.edit, 10)); });
    });
    $$("#wkRows [data-del]").forEach(function (b) {
      b.addEventListener("click", function () { deleteWork(parseInt(b.dataset.del, 10)); });
    });
  }

  function openWorkEditor(id) {
    editingWorkId = id || null;
    var w = id ? currentWorks().filter(function (x) { return x.id === id; })[0] : null;
    $("#weTitle").value = w ? w.title : "";
    $("#weAuthor").value = w ? w.author : "";
    $("#weGrade").value = w ? (w.grade || "") : "";
    $("#weClass").value = w ? (w.class_name || "") : "";
    $("#weCat").value = w ? w.category : "prose";
    $("#weExcerpt").value = w ? (w.excerpt || "") : "";
    $("#weContent").value = w ? (w.content || []).join("\n\n") : "";
    $("#weIdLabel").textContent = w ? ("正在编辑：《" + w.title + "》") : "新增作品";
    $("#workEditor").classList.add("open");
  }

  function saveWorkEditor() {
    var title = $("#weTitle").value.trim();
    var author = $("#weAuthor").value.trim();
    if (!title || !author) { toast("标题和作者不能为空", "err"); return; }
    var ov = overlay();
    ov.useLocal = true;
    var content = $("#weContent").value.split(/\r?\n\s*\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var work = {
      id: editingWorkId || Date.now(),
      title: title,
      author: author,
      grade: $("#weGrade").value.trim(),
      class_name: $("#weClass").value.trim(),
      category: $("#weCat").value,
      tags: [],
      rating: 0,
      excerpt: $("#weExcerpt").value.trim() || (content[0] || "").slice(0, 80),
      content: content.length ? content : ["（正文待补充）"],
      likes: 0,
      bookmarks: 0,
      created_at: new Date().toISOString(),
      remote: false
    };
    if (!ov.works) ov.works = {};
    if (!editingWorkId) work._new = true;
    ov.works[work.id] = work;
    saveOverlay(ov);
    $("#workEditor").classList.remove("open");
    renderWorks();
    updateModeLabel();
    toast(editingWorkId ? "作品已更新" : "作品已新增，去首页看看效果");
  }

  function deleteWork(id) {
    if (!confirm("确定删除这篇作品吗？（可在“数据”页恢复默认）")) return;
    var ov = overlay();
    ov.useLocal = true;
    if (ov.works && ov.works[id]) delete ov.works[id];
    if (ov.deletedWorks.indexOf(id) < 0) ov.deletedWorks.push(id);
    saveOverlay(ov);
    renderWorks();
    updateModeLabel();
    toast("作品已删除");
  }

  /* ============================================================
   * 活动 / 社员 / 社刊（分区保存）
   * ============================================================ */
  function renderEvents() {
    var list = currentEvents();
    $("#evCount").textContent = "共 " + list.length + " 项";
    $("#evRows").innerHTML = list.map(function (ev, i) {
      return "<div class='ad-item' data-i='" + i + "'>" +
        "<div class='ad-item-head'><strong>" + esc(ev.title) + "</strong><button class='ad-mini danger' data-evdel='" + i + "'>删除</button></div>" +
        "<div class='ad-grid2'>" +
        "<label>名称<input data-ev='title' value='" + esc(ev.title) + "'></label>" +
        "<label>距今天数<input data-ev='days' type='number' value='" + ev.days + "'></label>" +
        "<label>时间<input data-ev='time' value='" + esc(ev.time) + "'></label>" +
        "<label>地点<input data-ev='loc' value='" + esc(ev.loc) + "'></label>" +
        "</div>" +
        "<label>简介<textarea data-ev='desc' rows='2'>" + esc(ev.desc) + "</textarea></label>" +
        "</div>";
    }).join("");
    bindSection("ev");
  }

  function renderMembers() {
    var list = currentMembers();
    $("#mbCount").textContent = "共 " + list.length + " 人";
    $("#mbRows").innerHTML = list.map(function (m, i) {
      return "<div class='ad-item' data-i='" + i + "'>" +
        "<div class='ad-item-head'><strong>" + esc(m.name) + "</strong><button class='ad-mini danger' data-mbdel='" + i + "'>删除</button></div>" +
        "<div class='ad-grid2'>" +
        "<label>姓名<input data-mb='name' value='" + esc(m.name) + "'></label>" +
        "<label>职务<input data-mb='role' value='" + esc(m.role) + "'></label>" +
        "<label>寄语<input data-mb='quote' value='" + esc(m.quote) + "'></label>" +
        "<label>简介<input data-mb='bio' value='" + esc(m.bio) + "'></label>" +
        "<label>主题色<input data-mb='hue' type='color' value='" + (m.hue || "#8b3a3a") + "'></label>" +
        "</div></div>";
    }).join("");
    bindSection("mb");
  }

  function renderJournal() {
    var list = currentJournal();
    $("#jrCount").textContent = "共 " + list.length + " 期";
    $("#jrRows").innerHTML = list.map(function (is, i) {
      var pieces = (is.pieces || []).map(function (p) {
        return [p.title, p.author, p.type, p.page].join("|");
      }).join("\n");
      return "<div class='ad-item' data-i='" + i + "'>" +
        "<div class='ad-item-head'><strong>第" + is.no + "期 · " + esc(is.theme) + "</strong><button class='ad-mini danger' data-jrdel='" + i + "'>删除</button></div>" +
        "<div class='ad-grid2'>" +
        "<label>期号<input data-jr='no' type='number' value='" + is.no + "'></label>" +
        "<label>年份<input data-jr='year' type='number' value='" + is.year + "'></label>" +
        "<label>季节<input data-jr='term' value='" + esc(is.term) + "'></label>" +
        "<label>主题<input data-jr='theme' value='" + esc(is.theme) + "'></label>" +
        "<label>日期<input data-jr='date' value='" + esc(is.date) + "'></label>" +
        "</div>" +
        "<label>篇目（每行一条：标题|作者|类型|页码）<textarea data-jr='pieces' rows='3'>" + esc(pieces) + "</textarea></label>" +
        "</div>";
    }).join("");
    bindSection("jr");
  }

  /* 分区通用：读取表单 → 写覆盖层 */
  var dirtyKeys = {};
  function markDirty(key) {
    if (dirtyKeys[key]) return;
    dirtyKeys[key] = true;
    var b = $("#" + key + "Save");
    if (b) b.textContent = b.textContent.replace("保存", "保存 ●");
  }
  function clearDirty(key) {
    delete dirtyKeys[key];
    var b = $("#" + key + "Save");
    if (b) b.textContent = b.textContent.replace(" ●", "");
  }

  function bindSection(key) {
    var sel = "[data-" + key + "]";
    $$("#" + key + "Rows " + sel).forEach(function (el) {
      el.addEventListener("input", function () { markDirty(key); });
    });
    $$("#" + key + "Rows [data-" + key + "del]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.dataset[key + "del"], 10);
        var list = currentList(key).filter(function (_, idx) { return idx !== i; });
        writeSection(key, list);
        renderSection(key);
        toast("已删除");
      });
    });
  }

  function currentList(key) {
    if (key === "ev") return currentEvents().slice();
    if (key === "mb") return currentMembers().slice();
    return currentJournal().slice();
  }
  function renderSection(key) {
    if (key === "ev") renderEvents();
    else if (key === "mb") renderMembers();
    else renderJournal();
    updateModeLabel();
  }
  function writeSection(key, list) {
    var ov = overlay();
    ov.useLocal = true;
    if (key === "ev") ov.events = list;
    else if (key === "mb") ov.members = list;
    else ov.journal = list;
    saveOverlay(ov);
  }

  function saveSection(key) {
    var items = currentList(key);
    $$("#" + key + "Rows .ad-item").forEach(function (box) {
      var i = parseInt(box.dataset.i, 10);
      var it = items[i];
      if (!it) return;
      $$("[data-" + key + "]", box).forEach(function (el) {
        var f = el.dataset[key];
        if (f === "pieces") {
          it.pieces = el.value.split("\n").map(function (line) {
            var p = line.split("|");
            return { title: (p[0] || "").trim(), author: (p[1] || "").trim(), type: (p[2] || "").trim(), page: (p[3] || "").trim() };
          }).filter(function (p) { return p.title; });
        } else if (f === "no" || f === "year" || f === "days") {
          it[f] = parseInt(el.value, 10) || 0;
        } else {
          it[f] = el.value;
        }
      });
    });
    writeSection(key, items);
    renderSection(key);
    clearDirty(key);
    toast("已保存，前台即时生效");
  }

  function addSectionItem(key) {
    var list = currentList(key);
    if (key === "ev") list.push({ title: "新活动", days: 14, time: "18:00-20:00", loc: "待定", desc: "活动简介" });
    else if (key === "mb") list.push({ name: "新社员", role: "社员", quote: "一句话寄语", bio: "简介", hue: HUES[list.length % HUES.length] });
    else list.push({ no: (list.length ? list[0].no + 1 : 48), year: new Date().getFullYear(), term: "春", theme: "新一期", date: new Date().getFullYear() + "年4月", pieces: [] });
    writeSection(key, list);
    renderSection(key);
    toast("已添加，向下滚动填写内容");
  }

  /* ============================================================
   * 数据：导出 / 导入 / 恢复 / 记录
   * ============================================================ */
  function exportJSON() {
    var data = {
      _meta: { app: "xinbi-basic", exportedAt: new Date().toISOString() },
      overlay: overlay(),
      works: currentWorks(),
      events: currentEvents(),
      members: currentMembers(),
      journal: currentJournal()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "xinbi-content-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已导出 JSON");
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var ov = data.overlay || data;
        if (!ov || typeof ov !== "object") throw new Error("bad format");
        ov.useLocal = true;
        if (!ov.works) ov.works = {};
        if (!ov.deletedWorks) ov.deletedWorks = [];
        saveOverlay(ov);
        renderAll();
        updateModeLabel();
        toast("导入成功，前台已生效");
      } catch (e) {
        toast("导入失败：文件格式不正确", "err");
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm("恢复默认将清空所有本地编辑（作品/活动/社员/社刊），确定吗？")) return;
    LS.del("overlay");
    renderAll();
    updateModeLabel();
    toast("已恢复默认数据");
  }

  function renderRecords() {
    var subs = LS.get("submissions", []);
    var apps = LS.get("applications", []);
    var html = "<h4>本地投稿记录（" + subs.length + "）</h4>";
    html += subs.length ? subs.map(function (s) {
      return "<div class='ad-rec'><strong>" + esc(s.sTitle || "无题") + "</strong> · " + esc(s.sName || "") + " · " + esc(s._time || "") + "</div>";
    }).join("") : "<p class='ad-empty'>暂无</p>";
    html += "<h4 style='margin-top:16px'>加入申请记录（" + apps.length + "）</h4>";
    html += apps.length ? apps.map(function (a) {
      return "<div class='ad-rec'><strong>" + esc(a.mName || "") + "</strong> · " + esc(a.mGrade || "") + " · " + esc(a._time || "") + "</div>";
    }).join("") : "<p class='ad-empty'>暂无</p>";
    $("#adRecords").innerHTML = html;
  }

  /* ============================================================
   * 模式与初始化
   * ============================================================ */
  function updateModeLabel() {
    var ov = overlay();
    var el = $("#adMode");
    if (!el) return;
    el.textContent = ov.useLocal ? "本地管理（编辑优先生效）" : "远端优先（拉取社团作品库，失败回退示例）";
    var btn = $("#adModeToggle");
    if (btn) btn.textContent = ov.useLocal ? "切换回远端优先" : "切换到本地管理";
  }

  function renderAll() {
    renderWorks();
    renderEvents();
    renderMembers();
    renderJournal();
    renderRecords();
  }

  function init() {
    /* 登录门禁（演示登录） */
    var user = LS.get("user", null);
    if (!user) {
      $("#adGate").style.display = "grid";
      $("#adApp").style.display = "none";
      return;
    }
    $("#adGate").style.display = "none";
    $("#adApp").style.display = "block";
    $("#adUserName").textContent = user.name || user.email || "管理员";

    updateModeLabel();
    renderAll();

    /* 标签页 */
    $$(".ad-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".ad-tabs button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        $$(".ad-panel").forEach(function (p) { p.classList.remove("on"); });
        $("#tab-" + b.dataset.tab).classList.add("on");
      });
    });

    /* 作品编辑器 */
    $("#weNew").addEventListener("click", function () { openWorkEditor(null); });
    $("#weSave").addEventListener("click", saveWorkEditor);
    $("#weCancel").addEventListener("click", function () { $("#workEditor").classList.remove("open"); });

    /* 分区按钮 */
    [["ev", "保存活动"], ["mb", "保存社员"], ["jr", "保存社刊"]].forEach(function (pair) {
      on("#" + pair[0] + "Save", "click", function () { saveSection(pair[0]); });
      on("#" + pair[0] + "Add", "click", function () { addSectionItem(pair[0]); });
    });

    /* 数据按钮 */
    on("#adExport", "click", exportJSON);
    on("#adImportBtn", "click", function () { $("#adImportFile").click(); });
    on("#adImportFile", "change", function () { if (this.files[0]) importJSON(this.files[0]); this.value = ""; });
    on("#adReset", "click", resetAll);
    on("#adModeToggle", "click", function () {
      var ov = overlay();
      ov.useLocal = !ov.useLocal;
      saveOverlay(ov);
      updateModeLabel();
      toast(ov.useLocal ? "已切换到本地管理模式" : "已切换回远端优先模式");
    });
    on("#adClearInteractions", "click", function () {
      if (!confirm("清空本机的点赞/收藏/评论记录吗？")) return;
      LS.del("likes"); LS.del("bookmarks"); LS.del("comments");
      toast("互动数据已清空");
    });
    on("#adLogout", "click", function () {
      LS.del("user");
      location.href = "login.html?next=admin.html";
    });
  }

  function on(sel, ev, fn) { var el = $(sel); if (el) el.addEventListener(ev, fn); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
