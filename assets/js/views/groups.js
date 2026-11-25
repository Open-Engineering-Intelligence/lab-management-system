/* 课题组列表与详情 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function list() {
    var groups = L.store.all('groups');
    if (!groups.length) return '<div class="card">' + L.ui.empty('还没有课题组', '点击“新建课题组”开始') + '</div>';
    return '<div class="grid cols-3">' + groups.map(function (g) {
      var members = L.store.groupMembers(g.id);
      var projects = L.store.groupProjects(g.id);
      var cross = projects.filter(function (p) { return (p.groups || []).length > 1; }).length;
      return '<div class="card card-pad" style="border-top:3px solid ' + (g.color || '#2563eb') + '">' +
        '<div class="spread"><div><div class="link-title" style="font-size:16px">' + L.ui.esc(g.name) + '</div><div class="small faint">' + L.ui.esc(g.code || '') + '</div></div>' +
        '<div class="row"><button class="icon-btn" title="编辑" data-action="edit" data-entity="groups" data-id="' + g.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
        '<button class="icon-btn" title="删除" data-action="delete" data-entity="groups" data-id="' + g.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></div></div>' +
        '<div class="small muted" style="margin:12px 0 8px;min-height:36px">' + L.ui.esc(g.focus || '暂未填写研究方向') + '</div>' +
        '<div>' + L.ui.tags((g.focus || '').replace(/、/g, ','), '') + '</div>' +
        '<div class="divider" style="margin:12px 0"></div>' +
        '<div class="row" style="gap:18px"><span class="small"><b>' + members.length + '</b> 位成员</span><span class="small"><b>' + projects.length + '</b> 个项目</span><span class="small"><b>' + cross + '</b> 个跨组</span></div>' +
        '<div style="margin-top:12px">' + L.ui.person(L.store.find('members', g.leaderId), '组长') + '</div>' +
        '<button class="btn sm" style="margin-top:14px;width:100%" data-nav="#/groups/' + g.id + '">查看组别详情 <svg class="icon"><use href="#i-arrow"/></svg></button></div>';
    }).join('') + '</div>';
  }

  function detail(id) {
    var g = L.store.find('groups', id);
    if (!g) return '<div class="card">' + L.ui.empty('课题组不存在') + '</div>';
    var members = L.store.groupMembers(id);
    var projects = L.store.groupProjects(id);
    var otherGroups = {};
    L.store.projectGroups(id).length;
    projects.forEach(function (p) {
      (p.groups || []).forEach(function (gid) { if (gid !== id) otherGroups[gid] = (otherGroups[gid] || 0) + 1; });
    });
    var partners = Object.keys(otherGroups).map(function (gid) { return { group: L.store.find('groups', gid), count: otherGroups[gid] }; }).filter(function (x) { return x.group; });

    return '<div class="page-head"><div><button class="btn ghost sm" data-nav="#/groups">← 返回课题组</button><h1 style="margin-top:8px">' + L.ui.esc(g.name) + '</h1><p>' + L.ui.esc(g.description || g.focus || '') + '</p></div>' +
      '<div class="head-actions"><button class="btn" data-action="edit" data-entity="groups" data-id="' + g.id + '"><svg class="icon"><use href="#i-edit"/></svg>编辑</button>' +
      '<button class="btn danger" data-action="delete" data-entity="groups" data-id="' + g.id + '"><svg class="icon"><use href="#i-trash"/></svg>删除</button></div></div>' +

      '<div class="grid cols-4" style="margin-bottom:16px">' + L.ui.stat('组内成员', members.length, '', 'i-users', 'primary') + L.ui.stat('参与项目', projects.length, '', 'i-projects', 'teal') +
      L.ui.stat('跨组项目', projects.filter(function (p) { return (p.groups || []).length > 1; }).length, '', 'i-network', 'amber') + L.ui.stat('协作组别', partners.length, '', 'i-groups', 'violet') + '</div>' +

      '<div class="grid cols-2"><section class="card"><div class="card-head"><h2>组内成员</h2><div class="right"><button class="btn sm" data-action="new" data-entity="members" data-defaults=\'{"groupId":"' + g.id + '"}\'>添加成员</button></div></div>' +
      (members.length ? '<table><thead><tr><th>姓名</th><th>身份</th><th>角色</th><th>参与项目</th></tr></thead><tbody>' + members.map(function (m) {
        return '<tr><td><a class="person" data-nav="#/members/' + m.id + '">' + L.ui.avatar(m.name, m.id) + '<div><div class="p-name">' + L.ui.esc(m.name) + '</div><div class="p-sub">' + L.ui.esc(m.studentNo || '') + '</div></div></a></td>' +
          '<td>' + L.ui.esc(m.title || '—') + '</td><td>' + L.ui.badge(m.role || '成员') + '</td><td>' + L.store.memberProjects(m.id).length + '</td></tr>';
      }).join('') + '</tbody></table>' : L.ui.empty('暂无成员')) + '</section>' +

      '<section class="card"><div class="card-head"><h2>协作课题组</h2></div>' + (partners.length ? partners.map(function (x) {
        return '<div class="list-item spread"><div><div class="link-title">' + L.ui.esc(x.group.name) + '</div><div class="small faint">共同项目 ' + x.count + ' 个</div></div><button class="btn sm" data-nav="#/groups/' + x.group.id + '">查看</button></div>';
      }).join('') : L.ui.empty('尚无跨组协作', '在项目中添加多个课题组即可建立协作关系')) + '</section></div>' +

      '<section class="card" style="margin-top:16px"><div class="card-head"><h2>参与项目</h2><div class="right">' + L.ui.badge(projects.length + ' 个项目') + '</div></div><div class="table-wrap"><table><thead><tr><th>项目</th><th>牵头人</th><th>状态</th><th>组内参与人</th><th>进度</th></tr></thead><tbody>' +
      (projects.length ? projects.map(function (p) {
        var names = L.store.projectMembers(p.id).filter(function (x) { return x.member.groupId === id; }).map(function (x) { return x.member.name; });
        return '<tr><td><a class="link-title" data-nav="#/projects/' + p.id + '">' + L.ui.esc(p.name) + '</a><div class="small faint">' + L.ui.esc(p.code || '') + '</div></td>' +
          '<td>' + L.ui.esc(L.store.name('members', p.leadMemberId)) + '</td><td>' + L.ui.status(p.status) + '</td><td class="small">' + L.ui.esc(names.join('、') || '—') + '</td><td>' + L.ui.progress(p.progress) + '</td></tr>';
      }).join('') : '<tr><td colspan="5">' + L.ui.empty('暂无项目') + '</td></tr>') + '</tbody></table></div></section>';
  }

  L.views.groups = {
    title: '课题组',
    render: function (params) { return params.id ? detail(params.id) : '<div class="page-head"><div><h1>课题组</h1><p>按研究方向组织团队，查看各组的项目与跨组协作。</p></div><div class="head-actions"><button class="btn primary" data-action="new" data-entity="groups"><svg class="icon"><use href="#i-plus"/></svg>新建课题组</button></div></div>' + list(); },
    mount: function () {}
  };
})(window.LabApp = window.LabApp || {});
