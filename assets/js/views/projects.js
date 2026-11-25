/* 项目列表与详情：项目维度查看参与人员、组别、讨论、资料与关联 */
(function (L) {
  'use strict';
  L.views = L.views || {};
  L.views.projects = {
    title: '项目',
    filters: { status: '', groupId: '', q: '' },
    memberFilter: { groupId: '', q: '' },
    tab: 'overview',

    render: function (params) {
      if (params && params.tab) this.tab = params.tab;
      if (params.id) return detail(params.id, this.tab);
      var f = this.filters;
      var rows = L.store.all('projects').filter(function (p) {
        if (f.status && p.status !== f.status) return false;
        if (f.groupId && !(p.groups || []).includes(f.groupId)) return false;
        if (f.q && [p.name, p.code, p.tags, p.description, p.source].filter(Boolean).join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      });
      var groupOpts = L.store.all('groups').map(function (g) { return '<option value="' + g.id + '"' + (f.groupId === g.id ? ' selected' : '') + '>' + L.ui.esc(g.name) + '</option>'; }).join('');
      var statusOpts = L.schema.options.STATUS.map(function (x) { return '<option value="' + x + '"' + (f.status === x ? ' selected' : '') + '>' + x + '</option>'; }).join('');

      return '<div class="page-head"><div><h1>项目</h1><p>一个项目可涉及多个组成员，成员也可参与多个项目。筛选后可快速定位跨组协作。</p></div>' +
        '<div class="head-actions"><button class="btn" data-action="new" data-entity="projectLinks"><svg class="icon"><use href="#i-link"/></svg>登记项目关联</button>' +
        '<button class="btn primary" data-action="new" data-entity="projects"><svg class="icon"><use href="#i-plus"/></svg>新建项目</button></div></div>' +
        '<div class="toolbar"><div class="field"><label>状态</label><select data-filter="status"><option value="">全部状态</option>' + statusOpts + '</select></div>' +
        '<div class="field"><label>涉及组别</label><select data-filter="groupId"><option value="">全部组别</option>' + groupOpts + '</select></div>' +
        '<div class="field"><label>关键词</label><input data-filter="q" value="' + L.ui.esc(f.q) + '" placeholder="项目名称 / 编号 / 关键词"></div>' +
        '<button class="btn sm" data-action="clear-project-filter">重置筛选</button><span class="small faint" style="margin-left:auto">共 ' + rows.length + ' 个项目</span></div>' +
        '<section class="card"><div class="table-wrap"><table><thead><tr><th>项目</th><th>牵头人</th><th>涉及组别</th><th>参与成员</th><th>任务</th><th>物品资产</th><th>状态</th><th style="width:120px">进度</th><th style="width:150px">操作</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (p) {
          return '<tr><td><a class="link-title" data-nav="#/projects/' + p.id + '">' + L.ui.esc(p.name) + '</a><div class="small faint">' + L.ui.esc(p.code || '') + ' · ' + L.ui.esc(p.type || '') + '</div></td>' +
            '<td>' + L.ui.esc(L.store.name('members', p.leadMemberId)) + '</td><td>' + (p.groups || []).map(function (g) { return L.ui.badge(L.store.name('groups', g), 'blue'); }).join(' ') + '</td>' +
            '<td>' + L.store.projectMembers(p.id).length + ' 人</td>' +
            '<td>' + (function () { var t = L.store.taskStats(p.id); return t.total ? '<a data-nav="#/projects/' + p.id + '?tab=tasks">' + t.done + '/' + t.total + ' 完成</a>' : '<span class="faint">—</span>'; })() + '</td>' +
            '<td>' + L.store.projectAssets(p.id).length + ' 项</td><td>' + L.ui.status(p.status) + '</td><td>' + L.ui.progress(p.progress) + '</td>' +
            '<td><button class="icon-btn" title="刷新进度" data-action="refresh-progress" data-id="' + p.id + '"><svg class="icon"><use href="#i-refresh"/></svg></button>' +
            '<button class="icon-btn" title="编辑" data-action="edit" data-entity="projects" data-id="' + p.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn" title="删除" data-action="delete" data-entity="projects" data-id="' + p.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
        }).join('') : '<tr><td colspan="9">' + L.ui.empty('没有符合条件的项目') + '</td></tr>') + '</tbody></table></div></section>';
    },

    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-filter]').forEach(function (el) {
        el.addEventListener('change', function () { self.filters[el.dataset.filter] = el.value.trim(); L.app.refresh(); });
        if (el.tagName === 'INPUT') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { self.filters[el.dataset.filter] = el.value.trim(); L.app.refresh(); } });
      });
      root.querySelectorAll('[data-pmfilter]').forEach(function (el) {
        el.addEventListener('change', function () { self.memberFilter[el.dataset.pmfilter] = el.value.trim(); L.app.refresh(); });
        if (el.tagName === 'INPUT') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { self.memberFilter[el.dataset.pmfilter] = el.value.trim(); L.app.refresh(); } });
      });
      var pmClear = root.querySelector('[data-pmclear]');
      if (pmClear) pmClear.onclick = function () { self.memberFilter = { groupId: '', q: '' }; L.app.refresh(); };
      root.querySelectorAll('[data-tab]').forEach(function (el) {
        el.onclick = function () { self.tab = el.dataset.tab; L.app.refresh(); };
      });
      var send = root.querySelector('#postSend');
      if (send) send.onclick = function () {
        if (!L.auth.canPost()) { L.ui.toast(L.auth.postBlockReason(), true); return; }
        var ta = root.querySelector('#postText');
        var content = ta.value.trim();
        var projectId = root.querySelector('#postProject').value;
        if (!content) { L.ui.toast('请先填写讨论内容', true); return; }
        L.store.insert('posts', Object.assign(L.auth.stamp(), { projectId: projectId, content: content, pinned: false, createdAt: new Date().toISOString().slice(0, 16) }));
        L.ui.toast('已以实名身份发布讨论');
        L.app.refresh();
      };
    }
  };

  function detail(id, tab) {
    var p = L.store.find('projects', id);
    if (!p) return '<div class="card">' + L.ui.empty('项目不存在') + '</div>';
    var members = L.store.projectMembers(id);
    var groups = L.store.projectGroups(id);
    var posts = L.store.all('posts').filter(function (x) { return x.projectId === id; }).sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.createdAt).localeCompare(a.createdAt);
    });
    var resources = L.store.all('resources').filter(function (x) { return x.projectId === id; });
    var assets = L.store.projectAssets(id);
    var related = L.store.relatedProjects(id);
    var taskStats = L.store.taskStats(id);
    var tabs = [['overview', '概览'], ['members', '成员与组别'], ['tasks', '任务与进度'], ['assets', '物品资产'], ['flows', '三流记录'], ['discussion', '讨论'], ['resources', '资料'], ['relations', '关联项目']];
    var flows = L.store.flowEvents({ projectId: id });

    var head = '<div class="page-head"><div><button class="btn ghost sm" data-nav="#/projects">← 返回项目列表</button>' +
      '<h1 style="margin-top:8px">' + L.ui.esc(p.name) + '</h1><p>' + L.ui.esc(p.code || '') + ' · ' + L.ui.esc(p.type || '未分类项目') + ' · ' + L.ui.esc(p.source || '来源未登记') + '</p></div>' +
      '<div class="head-actions"><button class="btn" data-action="refresh-progress" data-id="' + id + '"><svg class="icon"><use href="#i-refresh"/></svg>刷新进度</button>' +
      '<button class="btn" data-nav="#/flow?project=' + id + '"><svg class="icon"><use href="#i-network"/></svg>三流交叉</button>' +
      '<button class="btn" data-action="new" data-entity="tasks" data-defaults=\'{"projectId":"' + id + '"}\'><svg class="icon"><use href="#i-check"/></svg>新建任务</button>' +
      (L.auth.isAdmin() ? '<button class="btn" data-tab="members">管理成员</button>' : '') +
      (L.auth.isAdmin() ? '<button class="btn" data-action="new" data-entity="assetProjects" data-defaults=\'{"projectId":"' + id + '"}\'><svg class="icon"><use href="#i-box"/></svg>关联物品</button>' : '') +
      (L.auth.canPost() ? '<button class="btn" data-action="new" data-entity="posts" data-defaults=\'{"projectId":"' + id + '"}\'>发起讨论</button>' : '') +
      '<button class="btn primary" data-action="edit" data-entity="projects" data-id="' + id + '"><svg class="icon"><use href="#i-edit"/></svg>编辑项目</button></div></div>' +

      '<section class="card detail-hero"><div style="width:48px;height:48px;border-radius:13px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center"><svg class="icon" style="width:24px;height:24px"><use href="#i-projects"/></svg></div>' +
      '<div class="hero-main"><div class="row" style="gap:8px">' + L.ui.status(p.status) + L.ui.badge(p.type || '未分类', 'violet') + (p.funding ? L.ui.badge(p.funding, 'teal') : '') + '</div>' +
      '<h1 style="font-size:20px">' + L.ui.esc(p.description || '暂无项目说明') + '</h1>' +
      '<div class="row" style="gap:18px"><span class="small muted"><svg class="icon" style="vertical-align:-4px;width:15px"><use href="#i-cal"/></svg> ' + L.ui.esc(p.startDate || '—') + ' 至 ' + L.ui.esc(p.endDate || '—') + '</span>' +
      '<span class="small muted">牵头人：<a data-nav="#/members/' + p.leadMemberId + '">' + L.ui.esc(L.store.name('members', p.leadMemberId)) + '</a></span></div>' +
      '<div style="margin-top:10px">' + L.ui.tags(p.tags) + '</div></div>' +
      '<div style="min-width:210px"><div class="spread"><div class="small muted">项目进度</div><button class="btn ghost sm" data-action="refresh-progress" data-id="' + id + '" title="按任务完成情况重新汇总">刷新</button></div><div style="margin-top:6px">' + L.ui.progress(p.progress) + '</div>' +
      '<div class="small faint" style="margin-top:4px">' + (p.progressUpdatedAt ? '最后刷新：' + L.ui.fmtDate(p.progressUpdatedAt) : '尚未手动刷新') + ' · 任务完成 ' + taskStats.done + '/' + taskStats.total + '</div>' +
      '<div class="mini-stat" style="margin-top:14px"><div><b>' + members.length + '</b><span>参与成员</span></div><div><b>' + groups.length + '</b><span>涉及组别</span></div><div><b>' + taskStats.total + '</b><span>任务</span></div><div><b>' + assets.length + '</b><span>物品</span></div></div></div></section>' +

      '<section class="card" style="margin-top:16px"><div class="tabs">' + tabs.map(function (t) { return '<div class="tab ' + (tab === t[0] ? 'active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join('') + '</div>';

    if (tab === 'overview') {
      return head + '<div class="pane"><div class="grid cols-2"><div><h3 style="font-size:14px;margin:0 0 10px">项目说明</h3><p style="color:#475569;margin:0">' + L.ui.esc(p.description || '暂无说明') + '</p>' +
        '<div class="divider"></div><dl class="kv"><dt>项目编号</dt><dd>' + L.ui.esc(p.code || '—') + '</dd><dt>来源 / 合作方</dt><dd>' + L.ui.esc(p.source || '—') + '</dd><dt>经费信息</dt><dd>' + L.ui.esc(p.funding || '—') + '</dd><dt>涉及课题组</dt><dd>' + groups.map(function (x) { return '<a data-nav="#/groups/' + x.group.id + '">' + L.ui.esc(x.group.name) + '</a>'; }).join('、') + '</dd></dl></div>' +
        '<div><h3 style="font-size:14px;margin:0 0 10px">任务进度</h3>' +
        (taskStats.total ? '<div class="small muted" style="margin-bottom:8px">' + taskStats.done + ' / ' + taskStats.total + ' 项完成 · 平均进度 ' + taskStats.avg + '%' + (p.progressUpdatedAt ? ' · 刷新于 ' + L.ui.fmtDate(p.progressUpdatedAt) : '') + '</div>' + L.ui.progress(p.progress) +
          '<div style="margin-top:10px">' + L.store.projectTasks(id).slice(0, 5).map(function (x) {
            return '<div class="sw-row"><span class="t">' + L.ui.esc(x.rel.title) + '</span><span class="d">' + L.ui.esc(x.rel.status || '未开始') + ' · ' + (Number(x.rel.progress) || 0) + '%</span></div>';
          }).join('') + '</div><div style="margin-top:10px"><button class="btn sm" data-tab="tasks">查看全部任务</button></div>' : '<div class="small muted">尚未拆分任务。<button class="btn ghost sm" data-action="new" data-entity="tasks" data-defaults=\'{"projectId":"' + id + '"}\'>新建任务</button></div>') +
        '<div class="divider"></div><h3 style="font-size:14px;margin:0 0 10px">关联项目</h3>' + (related.length ? related.map(function (x) {
          return '<div class="list-item" style="padding:10px 0"><div class="spread"><a class="link-title" data-nav="#/projects/' + x.other.id + '">' + L.ui.esc(x.other.name) + '</a>' + L.ui.badge(x.link.type, 'blue') + '</div><div class="small faint">' + L.ui.esc(x.link.note || '') + '</div></div>';
        }).join('') : '<div class="small muted">尚未登记项目关联</div>') +
        '</div></div></div></section>';
    }

    if (tab === 'members') {
      var isAdmin = L.auth.isAdmin();
      var currentIds = {};
      members.forEach(function (x) { currentIds[x.member.id] = true; });
      var mf = L.views.projects.memberFilter;
      var candidates = L.store.all('members').filter(function (m) {
        if (L.store.isLeft && L.store.isLeft(m)) return false;
        if (currentIds[m.id]) return false;
        if (mf.groupId && m.groupId !== mf.groupId) return false;
        if (mf.q && [m.name, m.studentNo, m.title, m.tags].filter(Boolean).join(' ').toLowerCase().indexOf(mf.q.toLowerCase()) < 0) return false;
        return true;
      });
      var groupOpts = L.store.all('groups').map(function (g) { return '<option value="' + g.id + '"' + (mf.groupId === g.id ? ' selected' : '') + '>' + L.ui.esc(g.name) + '</option>'; }).join('');

      var addPanel = '';
      if (isAdmin) {
        addPanel = '<div class="card" style="box-shadow:none;background:var(--surface-2);margin-bottom:16px"><div class="card-head"><h2>添加人员</h2><div class="right"><span class="small faint">勾选后一键加入本项目</span></div></div><div class="card-pad">' +
          '<div class="toolbar" style="margin-bottom:10px"><div class="field"><label>按组别筛选</label><select data-pmfilter="groupId"><option value="">全部组别</option>' + groupOpts + '</select></div>' +
          '<div class="field"><label>搜索</label><input data-pmfilter="q" value="' + L.ui.esc(mf.q) + '" placeholder="姓名 / 学号 / 技能"></div>' +
          '<button class="btn sm" data-pmclear="1">重置</button><span class="small faint" style="margin-left:auto">可加入 ' + candidates.length + ' 人</span></div>' +
          '<div id="pmCandidates" class="pm-candidate-list">' + (candidates.length ? candidates.map(function (m) {
            return '<label class="pm-candidate"><input type="checkbox" data-member="' + m.id + '">' + L.ui.avatar(m.name, m.id) +
              '<span class="pm-candidate-meta"><b>' + L.ui.esc(m.name) + '</b><span class="small faint">' + L.ui.esc(L.store.name('groups', m.groupId)) + ' · ' + L.ui.esc(m.title || '') + '</span></span></label>';
          }).join('') : '<div class="small muted" style="padding:8px 0">没有可加入的成员（都已在本项目或已离组）</div>') + '</div>' +
          '<div class="row" style="margin-top:12px"><button class="btn primary" data-action="pm-add" data-project="' + id + '"><svg class="icon"><use href="#i-plus"/></svg>加入所选成员</button></div>' +
          '</div></div>';
      }

      return head + '<div class="pane">' + addPanel +
        '<div class="spread" style="margin-bottom:12px"><h3 style="font-size:14px;margin:0">参与人员（' + members.length + ' 人）</h3>' +
        (isAdmin ? '<button class="btn sm" data-action="new" data-entity="projectMembers" data-defaults=\'{"projectId":"' + id + '"}\'>单个添加 / 编辑关系</button>' : '') + '</div>' +
        '<div class="table-wrap"><table><thead><tr><th>成员</th><th>所属组别</th><th>项目角色</th><th>承担工作</th>' + (isAdmin ? '<th style="width:110px">操作</th>' : '') + '</tr></thead><tbody>' +
        (members.length ? members.map(function (x) {
          return '<tr><td><a class="person" data-nav="#/members/' + x.member.id + '">' + L.ui.avatar(x.member.name, x.member.id) + '<div><div class="p-name">' + L.ui.esc(x.member.name) + '</div><div class="p-sub">' + L.ui.esc(x.member.title || '') + '</div></div></a></td>' +
            '<td><a data-nav="#/groups/' + x.member.groupId + '">' + L.ui.esc(L.store.name('groups', x.member.groupId)) + '</a></td>' +
            '<td>' + L.ui.badge(x.rel.role || '参与成员', x.rel.role === '负责人' ? 'blue' : '') + '</td><td class="small">' + L.ui.esc(x.rel.responsibility || '—') + '</td>' +
            (isAdmin ? '<td><button class="icon-btn" data-action="edit" data-entity="projectMembers" data-id="' + x.rel.id + '" title="编辑角色 / 工作"><svg class="icon"><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn" data-action="pm-remove" data-project="' + id + '" data-member="' + x.member.id + '" title="从本项目移除"><svg class="icon"><use href="#i-trash"/></svg></button></td>' : '') + '</tr>';
        }).join('') : '<tr><td colspan="' + (isAdmin ? 5 : 4) + '">' + L.ui.empty('还没有参与成员', isAdmin ? '在上方勾选成员加入本项目' : '') + '</td></tr>') + '</tbody></table></div>' +
        (isAdmin ? '<div class="schema-note" style="margin-top:10px">移除只解除该成员与本项目的关系，不影响其他项目与成员档案；需要调整角色或承担工作请用编辑按钮。</div>' : '') +
        '<div class="divider"></div><div class="spread" style="margin-bottom:12px"><h3 style="font-size:14px;margin:0">涉及课题组</h3>' + (isAdmin ? '<button class="btn sm" data-action="new" data-entity="projectGroups" data-defaults=\'{"projectId":"' + id + '"}\'><svg class="icon"><use href="#i-plus"/></svg>添加组别</button>' : '') + '</div>' +
        '<div class="grid cols-3">' + (groups.length ? groups.map(function (x) {
          return '<div class="card card-pad" style="box-shadow:none;border-left:3px solid ' + x.group.color + '"><div class="spread"><b>' + L.ui.esc(x.group.name) + '</b>' +
            (isAdmin ? '<button class="icon-btn" data-action="delete" data-entity="projectGroups" data-id="' + x.rel.id + '" title="移除"><svg class="icon"><use href="#i-trash"/></svg></button>' : '') + '</div>' +
            '<div class="small faint" style="margin-top:6px">' + L.ui.esc(x.rel.note || x.group.focus || '') + '</div>' +
            '<div class="small muted" style="margin-top:8px">' + members.filter(function (pm) { return pm.member.groupId === x.group.id; }).length + ' 位成员参与</div></div>';
        }).join('') : L.ui.empty('尚未登记涉及组别')) + '</div></div></section>';
    }

    if (tab === 'tasks') {
      var tasks = L.store.projectTasks(id);
      return head + '<div class="pane">' +
        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('任务总数', taskStats.total, '本项目任务', 'i-check', 'blue') +
        L.ui.stat('进行中', taskStats.active, '正在推进', 'i-projects', 'amber') +
        L.ui.stat('已完成', taskStats.done, '完成率 ' + (taskStats.total ? Math.round(taskStats.done / taskStats.total * 100) : 0) + '%', 'i-check', 'green') +
        L.ui.stat('平均进度', taskStats.avg + '%', '任务进度均值', 'i-swap', 'violet') + '</div>' +
        '<div class="spread" style="margin-bottom:12px"><div><h3 style="font-size:14px;margin:0">任务清单</h3><div class="small faint">刷新进度将按各任务进度取平均值，写回项目进度（仅影响本项目）</div></div>' +
        '<div class="row"><button class="btn sm" data-action="refresh-progress" data-id="' + id + '"><svg class="icon"><use href="#i-refresh"/></svg>刷新进度</button>' +
        '<button class="btn sm primary" data-action="new" data-entity="tasks" data-defaults=\'{"projectId":"' + id + '"}\'><svg class="icon"><use href="#i-plus"/></svg>新建任务</button></div></div>' +
        (tasks.length ? '<div class="table-wrap"><table><thead><tr><th>任务</th><th>负责人</th><th>状态</th><th>优先级</th><th style="width:140px">进度</th><th>截止日期</th><th style="width:80px">操作</th></tr></thead><tbody>' +
          tasks.map(function (x) {
            var t = x.rel;
            return '<tr><td><b>' + L.ui.esc(t.title) + '</b>' + (t.note ? '<div class="small faint">' + L.ui.esc(t.note) + '</div>' : '') + '</td>' +
              '<td>' + (x.owner ? '<a data-nav="#/members/' + x.owner.id + '">' + L.ui.esc(x.owner.name) + '</a>' : '<span class="faint">未指定</span>') + '</td>' +
              '<td>' + L.ui.status(t.status) + '</td><td>' + (t.priority ? L.ui.badge(t.priority, t.priority === '紧急' ? 'rose' : t.priority === '重要' ? 'amber' : '') : '—') + '</td>' +
              '<td>' + L.ui.progress(t.progress) + '</td><td class="small">' + L.ui.esc(t.dueDate || '—') + '</td>' +
              '<td><button class="icon-btn" data-action="edit" data-entity="tasks" data-id="' + t.id + '" title="编辑"><svg class="icon"><use href="#i-edit"/></svg></button>' +
              '<button class="icon-btn" data-action="delete" data-entity="tasks" data-id="' + t.id + '" title="删除任务"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
          }).join('') + '</tbody></table></div>' : L.ui.empty('还没有任务', '点击“新建任务”拆分项目工作，再用“刷新进度”汇总到项目')) +
        '<div class="schema-note" style="margin-top:16px">任务进度用于汇总项目进度：删除任务会同步影响下次刷新结果；删除项目时其下所有任务会一并清理，其他项目不受影响。</div></div></section>';
    }

    if (tab === 'assets') {
      return head + '<div class="pane"><div class="spread" style="margin-bottom:12px"><h3 style="font-size:14px;margin:0">项目使用的物品资产</h3><button class="btn sm primary" data-action="new" data-entity="assetProjects" data-defaults=\'{"projectId":"' + id + '"}\'><svg class="icon"><use href="#i-plus"/></svg>关联物品</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>物品</th><th>类别 / 规格</th><th>负责人</th><th>数量</th><th>用途</th><th style="width:80px">操作</th></tr></thead><tbody>' +
        (assets.length ? assets.map(function (x) {
          return '<tr><td><a class="link-title" data-nav="#/assets/' + x.asset.id + '">' + L.ui.esc(x.asset.name) + '</a><div class="small faint">' + L.ui.esc(x.asset.assetNo || '') + '</div></td>' +
            '<td>' + L.ui.badge(x.asset.category || '未分类', 'blue') + '<div class="small faint">' + L.ui.esc(x.asset.spec || '') + '</div></td>' +
            '<td>' + (x.asset.custodianId ? '<a data-nav="#/members/' + x.asset.custodianId + '">' + L.ui.esc(L.store.name('members', x.asset.custodianId)) + '</a>' : '—') + '</td>' +
            '<td>' + L.ui.esc(x.asset.quantity || '—') + ' ' + L.ui.esc(x.asset.unit || '') + '</td><td class="small">' + L.ui.esc(x.rel.purpose || '—') + '</td>' +
            '<td><button class="icon-btn" data-action="edit" data-entity="assetProjects" data-id="' + x.rel.id + '" title="编辑用途"><svg class="icon"><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn" data-action="delete" data-entity="assetProjects" data-id="' + x.rel.id + '" title="移除关联"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
        }).join('') : '<tr><td colspan="6">' + L.ui.empty('还没有关联物品', '点击“关联物品”把设备或耗材登记到本项目') + '</td></tr>') + '</tbody></table></div>' +
        '<div class="schema-note" style="margin-top:16px">同一件物品可以关联多个项目；项目之间通过共用设备形成隐性协作，可在“关系视图 → 物品-项目关联”中查看。</div></div></section>';
    }

    if (tab === 'flows') {
      return head + '<div class="pane"><div class="spread" style="margin-bottom:12px"><h3 style="font-size:14px;margin:0">与本项目关联的人流、物流与信息流</h3><button class="btn sm" data-nav="#/flow?project=' + id + '">打开交叉透视 <svg class="icon"><use href="#i-arrow"/></svg></button></div>' +
        '<div class="grid cols-3" style="margin-bottom:16px">' +
        ['人流', '物流', '信息流'].map(function (k, i) {
          return L.ui.stat(k, flows.filter(function (e) { return e.kind === k; }).length, '与本项目关联', ['i-door', 'i-swap', 'i-megaphone'][i], ['blue', 'violet', 'teal'][i]);
        }).join('') + '</div>' +
        (flows.length ? flows.slice(0, 60).map(function (e) {
          return '<div class="flow-event"><div class="flow-kind kind-' + (e.kind === '人流' ? 'blue' : e.kind === '物流' ? 'violet' : 'teal') + '">' + e.kind + '</div>' +
            '<div class="flow-main"><b class="small">' + L.ui.esc(e.title) + '</b><div class="small faint">' + L.ui.esc(e.detail) + '</div></div>' +
            '<div class="flow-meta"><span>' + L.ui.esc(e.personName || '—') + '</span><span>' + L.ui.esc(e.assetName || '—') + '</span><span>' + L.ui.esc(e.locationName || '—') + '</span></div>' +
            '<div class="flow-when small">' + L.ui.esc(L.ui.fmtDate(e.at)) + '</div>' + L.ui.status(e.status) + '</div>';
        }).join('') : L.ui.empty('暂无三流记录', '在人员进出、物品流转或信息公告中关联本项目')) + '</div></section>';
    }

    if (tab === 'discussion') {
      var composer = L.auth.canPost()
        ? '<div class="card card-pad" style="box-shadow:none;background:var(--surface-2);margin-bottom:16px">' +
          '<div class="small muted" style="margin-bottom:8px">以 <b>' + L.ui.esc(L.auth.current().realName.name) + '</b> 的实名身份发言</div>' +
          '<textarea id="postText" class="field" style="width:100%;min-height:80px" placeholder="同步进展、提出协作问题或分享想法…"></textarea>' +
          '<div class="row" style="margin-top:10px"><select id="postProject" class="field" style="width:220px">' + L.store.all('projects').map(function (x) { return '<option value="' + x.id + '"' + (x.id === id ? ' selected' : '') + '>' + L.ui.esc(x.name) + '</option>'; }).join('') + '</select>' +
          '<button class="btn primary" id="postSend" style="margin-left:auto">发布讨论</button></div></div>'
        : '<div class="card card-pad" style="box-shadow:none;background:var(--surface-2);margin-bottom:16px"><div class="spread"><div><b>实名发言</b><div class="small muted" style="margin-top:4px">' + L.ui.esc(L.auth.postBlockReason()) + '</div></div>' +
          '<button class="btn primary sm" data-nav="' + (L.auth.isLoggedIn() ? '#/account' : '#/login') + '">' + (L.auth.isLoggedIn() ? '完善实名信息' : '登录 / 注册') + '</button></div></div>';
      return head + '<div class="pane">' + composer +
        (posts.length ? posts.map(function (post) {
          var info = L.auth.display(post);
          var canManage = L.auth.canManage(post);
          return '<div class="post"><div class="post-head">' + L.ui.avatar(info.name, post.authorAccountId || post.authorId) + '<div><span class="author">' + L.ui.esc(info.name) + '</span>' +
            (info.verified ? ' <span class="badge teal dot">实名</span>' : '') + '<span class="time"> · ' + L.ui.timeAgo(post.createdAt) + '</span>' + (post.pinned ? L.ui.badge('置顶', 'amber') : '') + '</div></div>' +
            '<div class="post-body">' + L.ui.esc(post.content) + '</div><div class="post-actions">' +
            (L.auth.isAdmin() ? '<button class="btn ghost sm" data-action="toggle-pin" data-id="' + post.id + '">' + (post.pinned ? '取消置顶' : '置顶') + '</button>' : '') +
            (canManage ? '<button class="btn ghost sm" data-action="edit" data-entity="posts" data-id="' + post.id + '">编辑</button><button class="btn ghost sm" data-action="delete" data-entity="posts" data-id="' + post.id + '">删除</button>' : '') +
            '</div></div>';
        }).join('') : L.ui.empty('还没有讨论', '发布第一条进展同步吧')) + '</div></section>';
    }

    if (tab === 'resources') {
      return head + '<div class="pane"><div class="spread" style="margin-bottom:12px"><h3 style="font-size:14px;margin:0">共享资料与链接</h3><button class="btn sm primary" data-action="new" data-entity="resources" data-defaults=\'{"projectId":"' + id + '","uploaderId":"' + L.store.state.settings.currentUserId + '"}\'><svg class="icon"><use href="#i-plus"/></svg>登记资料</button></div>' +
        (resources.length ? resources.map(function (r) {
          return '<div class="resource-item"><div class="r-icon soft-primary"><svg class="icon"><use href="#i-folder"/></svg></div><div style="flex:1">' +
            '<div class="link-title">' + L.ui.esc(r.title) + ' ' + L.ui.badge(r.type || '资料', 'blue') + '</div>' +
            '<div class="small muted" style="margin-top:4px">' + L.ui.esc(r.description || '') + '</div>' +
            '<div class="small faint" style="margin-top:4px">' + L.ui.esc(L.store.name('members', r.uploaderId)) + ' · ' + L.ui.fmtDate(r.createdAt) + '</div></div>' +
            '<div class="row">' + (r.url ? '<a class="btn sm" target="_blank" rel="noopener" href="' + L.ui.esc(r.url) + '">打开 <svg class="icon"><use href="#i-ext"/></svg></a>' : '') +
            '<button class="icon-btn" data-action="edit" data-entity="resources" data-id="' + r.id + '" title="编辑"><svg class="icon"><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn" data-action="delete" data-entity="resources" data-id="' + r.id + '" title="删除"><svg class="icon"><use href="#i-trash"/></svg></button></div></div>';
        }).join('') : L.ui.empty('暂无共享资料')) + '</div></section>';
    }

    return head + '<div class="pane"><div class="spread" style="margin-bottom:12px"><h3 style="font-size:14px;margin:0">与其他项目的关联</h3><button class="btn sm primary" data-action="new" data-entity="projectLinks" data-defaults=\'{"from":"' + id + '"}\'><svg class="icon"><use href="#i-plus"/></svg>登记关联</button></div>' +
      (related.length ? related.map(function (x) {
        return '<div class="list-item spread"><div><a class="link-title" data-nav="#/projects/' + x.other.id + '">' + L.ui.esc(x.other.name) + '</a>' +
          '<div class="small faint">' + L.ui.esc(x.link.note || '') + ' · ' + (x.outgoing ? '本项目 → 对方' : '对方 → 本项目') + '</div></div>' +
          '<div class="row">' + L.ui.badge(x.link.type, 'violet') + '<button class="icon-btn" data-action="delete" data-entity="projectLinks" data-id="' + x.link.id + '" title="删除关联"><svg class="icon"><use href="#i-trash"/></svg></button></div></div>';
      }).join('') : L.ui.empty('尚未登记项目关联')) +
      '<div class="schema-note" style="margin-top:16px">关联可以表达：数据依赖、技术共用、成果延伸、平台共享等。登记后会在“关系视图 → 项目关联网络”中自动呈现。</div></div></section>';
  }
})(window.LabApp = window.LabApp || {});
