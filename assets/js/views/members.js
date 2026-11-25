/* 成员列表与详情：重点支持“按成员查看负责项目” */
(function (L) {
  'use strict';
  L.views = L.views || {};
  L.views.members = {
    title: '成员',
    filters: { membership: 'active', groupId: '', status: '', q: '' },

    render: function (params) {
      if (params.id) return detail(params.id);
      var self = this;
      var f = this.filters;
      var groups = L.store.all('groups');
      var activeCount = L.store.activeMembers().length;
      var leftCount = L.store.leftMembers().length;
      var rows = L.store.all('members').filter(function (m) {
        var left = L.store.isLeft(m);
        if (f.membership === 'active' && left) return false;
        if (f.membership === 'left' && !left) return false;
        if (f.groupId && m.groupId !== f.groupId) return false;
        if (f.status && m.status !== f.status) return false;
        if (f.q && [m.name, m.studentNo, m.title, m.tags, m.leftNote].filter(Boolean).join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      });
      var options = function (arr, key, label) { return arr.map(function (x) { return '<option value="' + L.ui.esc(x[key]) + '"' + (f[label === 'groupId' ? 'groupId' : 'status'] === x[key] ? ' selected' : '') + '>' + L.ui.esc(x[label] || x.name) + '</option>'; }).join(''); };
      var chip = function (key, label, count) {
        return '<button class="chip ' + (f.membership === key ? 'active' : '') + '" data-membership="' + key + '">' + label + ' <span class="nav-count">' + count + '</span></button>';
      };

      return '<div class="page-head"><div><h1>成员</h1><p>招新可直接添加；成员离组只做标记、保留全部历史记录，可随时恢复。身份 / 角色 / 状态均可自由填写并自定义。</p></div><div class="head-actions"><button class="btn" data-nav="#/settings"><svg class="icon"><use href="#i-settings"/></svg>管理身份选项</button><button class="btn primary" data-action="new" data-entity="members"><svg class="icon"><use href="#i-plus"/></svg>招新 · 添加成员</button></div></div>' +
        '<div class="grid cols-3" style="margin-bottom:16px">' +
        L.ui.stat('在组成员', activeCount, '当前在组', 'i-users', 'primary') +
        L.ui.stat('已离组', leftCount, '历史保留，可恢复', 'i-door', 'amber') +
        L.ui.stat('成员总数', activeCount + leftCount, '含全部历史成员', 'i-groups', 'teal') + '</div>' +
        '<div class="toolbar"><div class="field"><label>成员范围</label><div class="row" style="gap:8px">' + chip('active', '在组', activeCount) + chip('left', '已离组', leftCount) + chip('all', '全部', activeCount + leftCount) + '</div></div>' +
        '<div class="field"><label>课题组</label><select data-filter="groupId"><option value="">全部组别</option>' + options(groups, 'id', 'name') + '</select></div>' +
        '<div class="field"><label>状态</label><select data-filter="status"><option value="">全部状态</option>' + options(L.store.optionsFor('memberStatus').map(function (x) { return { id: x, name: x }; }), 'id', 'name') + '</select></div>' +
        '<div class="field"><label>关键词</label><input data-filter="q" value="' + L.ui.esc(f.q) + '" placeholder="姓名 / 学号 / 技能标签"></div>' +
        '<button class="btn sm" data-action="clear-member-filter">重置筛选</button><span class="small faint" style="margin-left:auto">共 ' + rows.length + ' 位成员</span></div>' +
        '<section class="card"><div class="table-wrap"><table><thead><tr><th>成员</th><th>课题组</th><th>身份 / 角色</th><th>负责项目</th><th>参与项目</th><th>技能标签</th><th>状态</th><th style="width:110px">操作</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (m) {
          var lead = L.store.leadProjects(m.id).length;
          var all = L.store.memberProjects(m.id).length;
          var left = L.store.isLeft(m);
          var statusBadge = left ? L.ui.badge('已离组 · ' + (m.leftAt || ''), 'amber') : L.ui.badge(m.status || '—', m.status === '在读' ? 'teal' : '');
          var action = left
            ? '<button class="icon-btn" title="恢复在组" data-action="restore-member" data-id="' + m.id + '"><svg class="icon"><use href="#i-refresh"/></svg></button>'
            : '<button class="icon-btn" title="标记离组" data-action="mark-left" data-id="' + m.id + '"><svg class="icon"><use href="#i-door"/></svg></button>';
          return '<tr class="' + (left ? 'row-left' : '') + '"><td><a class="person" data-nav="#/members/' + m.id + '">' + L.ui.avatar(m.name, m.id) + '<div><div class="p-name">' + L.ui.esc(m.name) + '</div><div class="p-sub">' + L.ui.esc(m.studentNo || '') + (left && m.leftNote ? ' · ' + L.ui.esc(m.leftNote) : '') + '</div></div></a></td>' +
            '<td><a data-nav="#/groups/' + m.groupId + '">' + L.ui.esc(L.store.name('groups', m.groupId)) + '</a></td>' +
            '<td>' + L.ui.esc(m.title || '—') + '<div class="small faint">' + L.ui.esc(m.role || '') + '</div></td>' +
            '<td><b>' + lead + '</b></td><td><b>' + all + '</b></td><td>' + L.ui.tags(m.tags) + '</td><td>' + statusBadge + '</td>' +
            '<td>' + action +
            '<button class="icon-btn" title="编辑" data-action="edit" data-entity="members" data-id="' + m.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn" title="彻底删除" data-action="delete" data-entity="members" data-id="' + m.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
        }).join('') : '<tr><td colspan="8">' + L.ui.empty('没有符合筛选条件的成员', '可切换成员范围，或点击「招新 · 添加成员」') + '</td></tr>') + '</tbody></table></div></section>';
    },

    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-membership]').forEach(function (el) {
        el.onclick = function () { self.filters.membership = el.dataset.membership; L.app.refresh(); };
      });
      root.querySelectorAll('[data-filter]').forEach(function (el) {
        var handler = function () { self.filters[el.dataset.filter] = el.value.trim(); L.app.refresh(); };
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'change', handler);
        if (el.tagName === 'INPUT') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') handler(); });
      });
    }
  };

  function detail(id) {
    var m = L.store.find('members', id);
    if (!m) return '<div class="card">' + L.ui.empty('成员不存在') + '</div>';
    var lead = L.store.leadProjects(id);
    var joined = L.store.memberProjects(id);
    var group = L.store.find('groups', m.groupId);
    var ownedAssets = L.store.memberAssets(id);
    var posts = L.store.all('posts').filter(function (p) { return p.authorId === id; }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 5);
    var access = L.store.memberAccess(id);
    var flows = L.store.memberFlows(id);
    var notices = L.store.memberNotices(id);
    var left = L.store.isLeft(m);

    return '<div class="page-head"><div><button class="btn ghost sm" data-nav="#/members">← 返回成员</button><h1 style="margin-top:8px">' + L.ui.esc(m.name) + (left ? ' ' + L.ui.badge('已离组', 'amber') : '') + '</h1><p>' + L.ui.esc(m.title || '') + ' · ' + L.ui.esc(group ? group.name : '未分配课题组') + '</p></div>' +
      '<div class="head-actions"><button class="btn" data-nav="#/flow?member=' + id + '"><svg class="icon"><use href="#i-network"/></svg>三流交叉</button>' +
      (left
        ? '<button class="btn" data-action="restore-member" data-id="' + m.id + '"><svg class="icon"><use href="#i-refresh"/></svg>恢复在组</button>'
        : '<button class="btn" data-action="mark-left" data-id="' + m.id + '"><svg class="icon"><use href="#i-door"/></svg>标记离组</button>') +
      '<button class="btn" data-action="edit" data-entity="members" data-id="' + m.id + '"><svg class="icon"><use href="#i-edit"/></svg>编辑资料</button>' +
      '<button class="btn danger" data-action="delete" data-entity="members" data-id="' + m.id + '"><svg class="icon"><use href="#i-trash"/></svg>彻底删除</button></div></div>' +
      (left ? '<div class="schema-note" style="margin-bottom:16px">该成员已于 ' + L.ui.esc(m.leftAt) + ' 标记为离组' + (m.leftNote ? '（' + L.ui.esc(m.leftNote) + '）' : '') + '。其项目、任务、进出与流转等历史记录均完整保留；点击「恢复在组」可撤销离组标记。</div>' : '') +

      '<div class="grid cols-4" style="margin-bottom:16px">' + L.ui.stat('负责项目', lead.length, '牵头或担任负责人', 'i-projects', 'primary') + L.ui.stat('参与项目', joined.length, '含负责项目', 'i-users', 'teal') +
      L.ui.stat('跨组项目', joined.filter(function (x) { return (x.project.groups || []).length > 1; }).length, '', 'i-network', 'amber') + L.ui.stat('保管资产', ownedAssets.length, '负责或保管的物品', 'i-box', 'rose') + '</div>' +

      '<div class="grid cols-2"><section class="card"><div class="card-head"><h2>基本信息</h2></div><div class="card-pad"><div class="row" style="margin-bottom:16px">' + L.ui.avatar(m.name, m.id, 'lg') + '<div><b style="font-size:17px">' + L.ui.esc(m.name) + '</b><div class="small muted">' + L.ui.esc(m.role || '') + ' · ' + L.ui.esc(m.status || '') + '</div></div></div>' +
      '<dl class="kv"><dt>学号 / 工号</dt><dd>' + L.ui.esc(m.studentNo || '—') + '</dd><dt>所属课题组</dt><dd><a data-nav="#/groups/' + m.groupId + '">' + L.ui.esc(group ? group.name : '—') + '</a></dd>' +
      '<dt>邮箱</dt><dd>' + (m.email ? '<a href="mailto:' + L.ui.esc(m.email) + '">' + L.ui.esc(m.email) + '</a>' : '—') + '</dd><dt>电话</dt><dd>' + L.ui.esc(m.phone || '—') + '</dd>' +
      '<dt>加入时间</dt><dd>' + L.ui.esc(m.joinedAt || '—') + '</dd><dt>离组时间</dt><dd>' + (m.leftAt ? L.ui.esc(m.leftAt) + (m.leftNote ? '（' + L.ui.esc(m.leftNote) + '）' : '') : '—') + '</dd><dt>技能标签</dt><dd>' + (L.ui.tags(m.tags) || '—') + '</dd></dl>' +
      (m.bio ? '<div class="divider"></div><div class="small muted">' + L.ui.esc(m.bio) + '</div>' : '') + '</div></section>' +

      '<section class="card"><div class="card-head"><h2>负责的项目</h2><div class="right">' + L.ui.badge(lead.length) + '</div></div>' +
      (lead.length ? '<div class="table-wrap"><table><thead><tr><th>项目</th><th>状态</th><th>所属组别</th><th>进度</th></tr></thead><tbody>' + lead.map(function (p) {
        return '<tr><td><a class="link-title" data-nav="#/projects/' + p.id + '">' + L.ui.esc(p.name) + '</a></td><td>' + L.ui.status(p.status) + '</td><td class="small">' + L.ui.esc((p.groups || []).map(function (g) { return L.store.name('groups', g); }).join('、')) + '</td><td>' + L.ui.progress(p.progress) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : L.ui.empty('暂无负责项目')) + '</section></div>' +

      '<section class="card" style="margin-top:16px"><div class="card-head"><h2>参与的全部项目</h2><div class="right"><button class="btn sm" data-action="new" data-entity="projectMembers" data-defaults=\'{"memberId":"' + id + '"}\'>添加项目关系</button></div></div><div class="table-wrap"><table><thead><tr><th>项目</th><th>项目角色</th><th>承担工作</th><th>所属组别</th><th>项目状态</th><th style="width:70px">操作</th></tr></thead><tbody>' +
      (joined.length ? joined.map(function (x) {
        var p = x.project;
        return '<tr><td><a class="link-title" data-nav="#/projects/' + p.id + '">' + L.ui.esc(p.name) + '</a></td><td>' + L.ui.badge(x.rel.role || '参与成员', x.rel.role === '负责人' ? 'blue' : '') + '</td><td class="small">' + L.ui.esc(x.rel.responsibility || '—') + '</td>' +
          '<td class="small">' + L.ui.esc((p.groups || []).map(function (g) { return L.store.name('groups', g); }).join('、')) + '</td><td>' + L.ui.status(p.status) + '</td>' +
          '<td><button class="icon-btn" title="编辑关系" data-action="edit" data-entity="projectMembers" data-id="' + x.rel.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
          '<button class="icon-btn" title="移除关系" data-action="delete" data-entity="projectMembers" data-id="' + x.rel.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
      }).join('') : '<tr><td colspan="6">' + L.ui.empty('暂无参与项目') + '</td></tr>') + '</tbody></table></div></section>' +

      '<section class="card" style="margin-top:16px"><div class="card-head"><h2>负责 / 保管的资产</h2><div class="right"><button class="btn sm" data-action="new" data-entity="assets" data-defaults=\'{"custodianId":"' + id + '"}\'>登记资产</button></div></div>' +
      (ownedAssets.length ? '<div class="table-wrap"><table><thead><tr><th>物品</th><th>类别</th><th>规格</th><th>数量</th><th>状态</th><th>关联项目</th></tr></thead><tbody>' + ownedAssets.map(function (a) {
        return '<tr><td><a class="link-title" data-nav="#/assets/' + a.id + '">' + L.ui.esc(a.name) + '</a></td><td>' + L.ui.badge(a.category || '未分类', 'blue') + '</td><td class="small">' + L.ui.esc(a.spec || '—') + '</td>' +
          '<td>' + L.ui.esc(a.quantity || '—') + ' ' + L.ui.esc(a.unit || '') + '</td><td>' + L.ui.status(a.status) + '</td>' +
          '<td class="small">' + L.ui.esc(L.store.assetProjects(a.id).map(function (x) { return x.project.name; }).join('、') || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : L.ui.empty('暂无负责资产')) + '</section>' +

      '<section class="card" style="margin-top:16px"><div class="card-head"><h2>三流活动</h2><div class="right"><span class="small faint">进出 ' + access.length + ' · 流转 ' + flows.length + ' · 信息查阅 ' + notices.length + '</span></div></div>' +
      '<div class="grid cols-3" style="padding:16px">' +
      [['人流 · 最近进出', access.slice(0, 5).map(function (x) {
        return '<div class="small">' + L.ui.esc(L.ui.fmtDate(x.rec.at)) + ' · ' + L.ui.esc(x.rec.direction || '进出') + ' ' + L.ui.esc(x.location ? x.location.name : '—') + '</div>';
      })], ['物流 · 最近经办', flows.slice(0, 5).map(function (x) {
        return '<div class="small">' + L.ui.esc(L.ui.fmtDate(x.rec.at)) + ' · ' + L.ui.esc(x.rec.type || '流转') + ' ' + L.ui.esc(x.asset ? x.asset.name : '—') + '</div>';
      })], ['信息流 · 最近查阅', notices.slice(0, 5).map(function (x) {
        return '<div class="small">' + L.ui.esc(L.ui.fmtDate(x.rec.readAt || x.rec.deliveredAt)) + ' · ' + L.ui.esc(x.notice.title) + '</div>';
      })]].map(function (col) {
        return '<div><b class="small">' + col[0] + '</b><div class="stack" style="gap:7px;margin-top:8px">' + (col[1].join('') || '<span class="small faint">暂无记录</span>') + '</div></div>';
      }).join('') + '</div></section>' +

      (posts.length ? '<section class="card" style="margin-top:16px"><div class="card-head"><h2>最近交流</h2></div>' + posts.map(function (p) {
        return '<div class="list-item"><div class="small">' + L.ui.esc((p.content || '').slice(0, 140)) + '</div><div class="faint" style="font-size:11px;margin-top:4px">' + L.ui.esc(L.store.name('projects', p.projectId)) + ' · ' + L.ui.timeAgo(p.createdAt) + '</div></div>';
      }).join('') + '</section>' : '');
  }
})(window.LabApp = window.LabApp || {});
