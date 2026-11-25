/* 总览页 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  L.views.dashboard = {
    title: '总览',
    render: function () {
      var s = L.store.state;
      var active = s.projects.filter(function (p) { return p.status === '进行中'; }).length;
      var cross = L.store.crossGroupProjects().length;
      var recent = s.activities.slice(0, 6);
      var assets = L.store.all('assets');
      var assetRows = assets.slice().sort(function (a, b) { return L.store.assetProjects(b.id).length - L.store.assetProjects(a.id).length; }).slice(0, 5).map(function (a) {
        return '<div class="list-item" style="padding:10px 0"><div class="spread"><div><div class="link-title">' + L.ui.esc(a.name) + '</div><div class="small faint">' + L.ui.esc(a.assetNo || '') + ' · ' + L.ui.esc(L.store.name('members', a.custodianId)) + '</div></div>' + L.ui.badge(a.status || '未设置', L.schema.statusClass(a.status)) + '</div></div>';
      }).join('');
      var topProjects = s.projects.slice().sort(function (a, b) { return (b.progress || 0) - (a.progress || 0); }).slice(0, 6);
      var fs = L.store.flowStats();
      var flowRows = L.store.flowEvents({}).slice(0, 6).map(function (e) {
        return '<div class="list-item" style="padding:10px 0"><div class="spread"><div><div class="small"><b>' + L.ui.esc(e.kind) + '</b> · ' + L.ui.esc(e.title) + '</div>' +
          '<div class="small faint">' + L.ui.esc(e.personName || '—') + ' · ' + L.ui.esc(e.locationName || '—') + ' · ' + L.ui.esc(L.ui.fmtDate(e.at)) + '</div></div>' +
          '<button class="btn ghost sm" data-nav="' + (e.entity === 'accessRecords' ? '#/access' : e.entity === 'assetFlows' ? '#/logistics' : '#/notices/' + e.id) + '">查看</button></div></div>';
      }).join('');
      var crossRows = L.store.crossGroupProjects().slice(0, 5).map(function (p) {
        return '<div class="list-item"><div class="spread"><div><div class="link-title">' + L.ui.esc(p.name) + '</div><div class="small faint">' + (p.groups || []).map(function (g) { return L.ui.esc(L.store.name('groups', g)); }).join(' · ') + '</div></div>' +
          '<button class="btn sm" data-nav="#/projects/' + p.id + '">查看 <svg class="icon"><use href="#i-arrow"/></svg></button></div></div>';
      }).join('');

      return '<div class="page-head"><div><h1>' + L.ui.esc(s.settings.labName || '实验室') + '</h1><p>人员、物品与信息的协作全景，重点呈现人流、信息流、物流的交叉关系。数据保存在本机浏览器，可随时导入导出备份。</p></div>' +
        '<div class="head-actions"><button class="btn" data-action="new" data-entity="accessRecords"><svg class="icon"><use href="#i-door"/></svg>登记进出</button>' +
        '<button class="btn" data-action="new" data-entity="members"><svg class="icon"><use href="#i-users"/></svg>添加成员</button>' +
        '<button class="btn primary" data-action="new" data-entity="projects"><svg class="icon"><use href="#i-plus"/></svg>新建项目</button></div></div>' +

        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('课题组', s.groups.length, '跨组协作是主要组织形态', 'i-groups', 'primary') +
        L.ui.stat('在册成员', s.members.length, s.members.filter(function (m) { return m.status === '在读'; }).length + ' 人在读', 'i-users', 'violet') +
        L.ui.stat('进行中项目', active, '共 ' + s.projects.length + ' 个项目', 'i-projects', 'teal') +
        L.ui.stat('跨组项目', cross, '涉及两个及以上课题组', 'i-network', 'amber') + '</div>' +
        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('今日进出', fs.today, '三流事件 ' + fs.total + ' 条', 'i-door', 'blue') +
        L.ui.stat('在途 / 逾期', fs.overdue, '物品流转待处理', 'i-swap', 'violet') +
        L.ui.stat('未读信息', fs.unread, '信息查阅待提醒', 'i-megaphone', 'teal') +
        L.ui.stat('异常通行', fs.abnormal, '含待审批权限 ' + fs.pending + ' 条', 'i-shield', 'rose') + '</div>' +

        '<div class="grid cols-2">' +
        '<section class="card"><div class="card-head"><h2>项目进展</h2><div class="right"><button class="btn ghost sm" data-nav="#/projects">全部项目 <svg class="icon"><use href="#i-arrow"/></svg></button></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>项目</th><th>牵头人</th><th>状态</th><th style="width:130px">进度</th></tr></thead><tbody>' +
        (topProjects.length ? topProjects.map(function (p) {
          return '<tr><td><a class="link-title" data-nav="#/projects/' + p.id + '">' + L.ui.esc(p.name) + '</a><div class="small faint">' + L.ui.esc(p.code || '') + '</div></td>' +
            '<td>' + L.ui.esc(L.store.name('members', p.leadMemberId)) + '</td><td>' + L.ui.status(p.status) + '</td><td>' + L.ui.progress(p.progress) + '</td></tr>';
        }).join('') : '<tr><td colspan="4">' + L.ui.empty('暂无项目') + '</td></tr>') + '</tbody></table></div></section>' +

        '<div class="stack">' +
        '<section class="card"><div class="card-head"><h2>三流动态</h2><div class="right"><button class="btn ghost sm" data-nav="#/flow">三流交叉</button></div></div>' +
        '<div style="padding:6px 18px 12px">' + (flowRows || L.ui.empty('暂无三流事件')) + '</div></section>' +
        '<section class="card"><div class="card-head"><h2>跨组协作项目</h2><div class="right"><button class="btn ghost sm" data-nav="#/relations">关系视图</button></div></div>' + (crossRows || L.ui.empty('暂无跨组项目')) + '</section>' +
        '<section class="card"><div class="card-head"><h2>资产物品</h2><div class="right"><button class="btn ghost sm" data-nav="#/assets">全部资产 <svg class="icon"><use href="#i-arrow"/></svg></button></div></div>' +
        '<div style="padding:6px 18px 12px">' + (assetRows || L.ui.empty('暂无资产')) + '</div></section>' +
        '<section class="card"><div class="card-head"><h2>最近动态</h2></div><div style="padding:6px 18px 12px">' +
        (recent.length ? recent.map(function (a) {
          return '<div class="list-item" style="padding:9px 0"><div class="small">' + L.ui.esc(a.text) + '</div><div class="faint" style="font-size:11px">' + L.ui.timeAgo(a.createdAt) + '</div></div>';
        }).join('') : '<div class="small muted" style="padding:10px 0">暂无动态，创建内容后会自动记录。</div>') + '</div></section></div></div>' +

        (s.settings.labIntro || s.settings.notes ? '<section class="card card-pad" style="margin-top:16px"><div class="intro-box"><h3>实验室情况说明</h3><p>' + L.ui.esc(s.settings.labIntro || s.settings.notes) + '</p></div></section>' : '') +

        '<section class="card card-pad" style="margin-top:16px"><div class="row"><svg class="icon soft-primary" style="color:var(--primary)"><use href="#i-info"/></svg><b>使用提示</b></div>' +
        '<ul class="help-list" style="margin-top:8px"><li>在“人员进出 / 物品流转 / 信息公告”中登记事件，三流共用人员、物品、场所、项目与时间维度。</li><li>“三流交叉”可按任一维度查看另外两类关联事件，并查看人员 × 场所交叉矩阵。</li><li>每个项目详情页都有独立讨论区和资料区，交流内容同时汇总到“信息广场”。</li><li>“设置”中可导出 JSON 备份、导入数据，并把实验室说明原文粘贴进来。</li></ul></section>';
    },
    mount: function () {}
  };
})(window.LabApp = window.LabApp || {});
