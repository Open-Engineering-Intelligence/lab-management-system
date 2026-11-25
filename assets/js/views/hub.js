/* 信息广场：跨项目的讨论、资料与动态汇总；发言使用登录账号的实名身份 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function postCard(post) {
    var info = L.auth.display(post);
    var project = L.store.find('projects', post.projectId);
    var canManage = L.auth.canManage(post);
    return '<div class="post" data-post="' + post.id + '"><div class="post-head">' + L.ui.avatar(info.name, post.authorAccountId || post.authorId) + '<div><span class="author">' + L.ui.esc(info.name) + '</span>' +
      (info.verified ? ' <span class="badge teal dot">实名</span>' : '') +
      '<span class="time"> · ' + L.ui.timeAgo(post.createdAt) + '</span> ' + (post.pinned ? L.ui.badge('置顶', 'amber') : '') +
      (project ? ' <a class="small" data-nav="#/projects/' + project.id + '">#' + L.ui.esc(project.name) + '</a>' : '') + '</div></div>' +
      '<div class="post-body">' + L.ui.esc(post.content) + '</div><div class="post-actions">' +
      (L.auth.isAdmin() ? '<button class="btn ghost sm" data-action="toggle-pin" data-id="' + post.id + '">' + (post.pinned ? '取消置顶' : '置顶') + '</button>' : '') +
      (canManage ? '<button class="btn ghost sm" data-action="edit" data-entity="posts" data-id="' + post.id + '">编辑</button>' +
        '<button class="btn ghost sm" data-action="delete" data-entity="posts" data-id="' + post.id + '">删除</button>' : '') + '</div></div>';
  }

  L.views.hub = {
    title: '信息广场',
    tab: 'posts',
    projectFilter: '',
    composeProject: '',

    render: function () {
      var self = this;
      var tabs = [['posts', '讨论'], ['notices', '公告'], ['resources', '共享资料'], ['activity', '动态']];
      var projects = L.store.all('projects');
      var opts = '<option value="">全部项目</option>' + projects.map(function (p) { return '<option value="' + p.id + '"' + (self.projectFilter === p.id ? ' selected' : '') + '>' + L.ui.esc(p.name) + '</option>'; }).join('');
      var composeOpts = '<option value="">不关联项目（面向全体）</option>' + projects.map(function (p) { return '<option value="' + p.id + '"' + (self.composeProject === p.id ? ' selected' : '') + '>' + L.ui.esc(p.name) + '</option>'; }).join('');
      var body = '';

      if (self.tab === 'posts') {
        var posts = L.store.all('posts').filter(function (x) { return !self.projectFilter || x.projectId === self.projectFilter; }).sort(function (a, b) {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return String(b.createdAt).localeCompare(a.createdAt);
        });
        var composer;
        if (L.auth.canPost()) {
          var a = L.auth.current();
          composer = '<div class="card card-pad" style="box-shadow:none;background:var(--surface-2);margin-bottom:16px">' +
            '<div class="spread" style="margin-bottom:8px"><span class="small muted">以 <b>' + L.ui.esc(a.realName.name) + '</b> 的实名身份发言' + (a.realName.groupId ? ' · ' + L.ui.esc(L.store.name('groups', a.realName.groupId)) : '') + '</span>' + L.ui.badge('已实名', 'teal') + '</div>' +
            '<textarea id="hubPostText" class="field" style="width:100%;min-height:74px" placeholder="发布一条面向实验室的同步信息…（Ctrl+Enter 快速发布）"></textarea>' +
            '<div class="row" style="margin-top:10px"><select id="hubPostProject" class="field" style="width:260px">' + composeOpts + '</select>' +
            '<button class="btn primary" id="hubPostSend" style="margin-left:auto">发布</button></div></div>';
        } else {
          var reason = L.auth.postBlockReason();
          composer = '<div class="card card-pad" style="box-shadow:none;background:var(--surface-2);margin-bottom:16px">' +
            '<div class="spread"><div><b>实名发言</b><div class="small muted" style="margin-top:4px">' + L.ui.esc(reason) + '</div></div>' +
            '<button class="btn primary sm" data-nav="' + (L.auth.isLoggedIn() ? '#/account' : '#/login') + '">' + (L.auth.isLoggedIn() ? '完善实名信息' : '登录 / 注册') + '</button></div></div>';
        }
        body = composer + '<div id="hubPostList">' + (posts.length ? posts.map(postCard).join('') : L.ui.empty('暂无讨论')) + '</div>';
      }

      if (self.tab === 'notices') {
        var notices = L.store.all('notices').sort(function (a, b) { return String(b.publishAt || '').localeCompare(String(a.publishAt || '')); });
        body = '<div class="spread" style="margin-bottom:12px"><span class="small muted">共 ' + notices.length + ' 条信息公告</span><button class="btn sm primary" data-nav="#/notices">前往信息公告 <svg class="icon"><use href="#i-arrow"/></svg></button></div>' +
          (notices.length ? notices.map(function (n) {
            var st = L.store.noticeStats(n.id);
            return '<div class="post"><div class="post-head">' + L.ui.avatar(L.store.name('members', n.authorId), n.authorId) + '<div><span class="author">' + L.ui.esc(n.title) + '</span>' +
              '<span class="time"> · ' + L.ui.esc(L.ui.fmtDate(n.publishAt)) + '</span> ' + L.ui.badge(n.category || '公告', 'blue') + ' ' + L.ui.status(n.priority) + '</div></div>' +
              '<div class="post-body">' + L.ui.esc((n.content || '').slice(0, 180)) + '</div>' +
              '<div class="post-actions"><span class="small faint">查阅 ' + st.read + '/' + st.total + ' · ' + st.rate + '%</span>' +
              '<button class="btn ghost sm" data-nav="#/notices/' + n.id + '">查看详情</button></div></div>';
          }).join('') : L.ui.empty('暂无信息公告', '到“信息公告”模块发布')) + '</div>';
      }

      if (self.tab === 'resources') {
        var resources = L.store.all('resources').filter(function (x) { return !self.projectFilter || x.projectId === self.projectFilter; }).sort(function (a, b) { return String(b.createdAt).localeCompare(a.createdAt); });
        body = '<div class="spread" style="margin-bottom:12px"><span class="small muted">共 ' + resources.length + ' 份资料</span>' + (L.auth.isAdmin() ? '<button class="btn sm primary" data-action="new" data-entity="resources"><svg class="icon"><use href="#i-plus"/></svg>登记资料</button>' : '') + '</div>' +
          '<div class="grid cols-2">' + (resources.length ? resources.map(function (r) {
            return '<div class="card card-pad"><div class="spread"><div class="link-title">' + L.ui.esc(r.title) + '</div>' + L.ui.badge(r.type || '资料', 'blue') + '</div>' +
              '<div class="small muted" style="margin:8px 0;min-height:32px">' + L.ui.esc(r.description || '') + '</div>' +
              '<div class="small faint">' + L.ui.esc(L.store.name('projects', r.projectId)) + ' · ' + L.ui.esc(L.store.name('members', r.uploaderId)) + ' · ' + L.ui.fmtDate(r.createdAt) + '</div>' +
              '<div class="row" style="margin-top:12px">' + (r.url ? '<a class="btn sm" href="' + L.ui.esc(r.url) + '" target="_blank" rel="noopener">打开资料 <svg class="icon"><use href="#i-ext"/></svg></a>' : '') +
              (L.auth.isAdmin() ? '<button class="btn ghost sm" data-action="edit" data-entity="resources" data-id="' + r.id + '">编辑</button><button class="btn ghost sm" data-action="delete" data-entity="resources" data-id="' + r.id + '">删除</button>' : '') + '</div></div>';
          }).join('') : L.ui.empty('暂无共享资料')) + '</div>';
      }

      if (self.tab === 'activity') {
        var acts = L.store.all('activities').slice(0, 40);
        body = acts.length ? acts.map(function (a) {
          return '<div class="list-item spread"><div><div>' + L.ui.esc(a.text) + '</div><div class="small faint">' + L.ui.timeAgo(a.createdAt) + ' · ' + L.ui.esc(L.store.name('members', a.actorId)) + '</div></div>' +
            (a.link ? '<button class="btn sm" data-nav="' + a.link + '">查看</button>' : '') + '</div>';
        }).join('') : L.ui.empty('暂无动态记录', '在创建或编辑数据后自动生成');
      }

      return '<div class="page-head"><div><h1>信息广场</h1><p>汇总所有项目的讨论、资料与动态；所有发言均使用登录账号的实名身份。</p></div>' +
        '<div class="head-actions">' + (L.auth.canPost() ? '<button class="btn" data-action="new" data-entity="posts" data-defaults=\'{"authorId":"' + (L.auth.current().memberId || '') + '"}\'><svg class="icon"><use href="#i-chat"/></svg>发起讨论</button>' : '') +
        (L.auth.isAdmin() ? '<button class="btn primary" data-action="new" data-entity="resources"><svg class="icon"><use href="#i-plus"/></svg>登记资料</button>' : '') + '</div></div>' +
        '<section class="card"><div class="tabs">' + tabs.map(function (t) { return '<div class="tab ' + (self.tab === t[0] ? 'active' : '') + '" data-hubtab="' + t[0] + '">' + t[1] + '</div>'; }).join('') + '</div>' +
        '<div class="pane"><div class="toolbar"><div class="field" style="width:260px"><label>按项目筛选</label><select id="hubFilter">' + opts + '</select></div></div>' + body + '</div></section>';
    },

    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-hubtab]').forEach(function (el) { el.onclick = function () { self.tab = el.dataset.hubtab; L.app.refresh(); }; });
      var filter = root.querySelector('#hubFilter');
      if (filter) filter.onchange = function () { self.projectFilter = filter.value; L.app.refresh(); };
      var send = root.querySelector('#hubPostSend');
      var text = root.querySelector('#hubPostText');
      var project = root.querySelector('#hubPostProject');
      if (project) project.onchange = function () { self.composeProject = project.value; };
      if (send) send.onclick = function () { self.publish(root); };
      if (text) text.onkeydown = function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); self.publish(root); }
      };
    },

    publish: function (root) {
      if (!L.auth.canPost()) { L.ui.toast(L.auth.postBlockReason(), true); return; }
      var text = root.querySelector('#hubPostText');
      var project = root.querySelector('#hubPostProject');
      if (!text) return;
      var content = text.value.trim();
      if (!content) { L.ui.toast('请先填写内容', true); return; }
      var pid = project ? project.value : '';
      var item = Object.assign(L.auth.stamp(), {
        projectId: pid, content: content, pinned: false, createdAt: new Date().toISOString().slice(0, 16)
      });
      L.store.insert('posts', item);
      text.value = '';
      text.focus();
      /* 局部追加，保留输入焦点，支持实名成员连续发帖 */
      var list = root.querySelector('#hubPostList');
      if (list && (!this.projectFilter || this.projectFilter === pid)) {
        if (!list.querySelector('.post')) list.innerHTML = '';
        list.insertAdjacentHTML('afterbegin', postCard(item));
      }
      L.ui.toast('已以 ' + (item.authorName || '') + ' 的实名身份发布');
    }
  };
})(window.LabApp = window.LabApp || {});
