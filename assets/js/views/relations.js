/* 关系视图：跨组/跨项目网络、协作矩阵、交叉协作清单 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function shape(x, y, w, h, color, text, href, sub) {
    var nodeId = href.split('/').pop();
    return '<a href="' + href + '" data-a="' + L.ui.esc(nodeId) + '" class="net-node"><g><rect class="net-shape" x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '" fill="' + color + '" opacity=".95"/>' +
      '<text x="' + (x + (sub ? -10 : 0)) + '" y="' + (y + 4) + '" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">' + L.ui.esc(String(text).slice(0, 12)) + '</text>' +
      (sub ? '<text x="' + (x + w / 2 - 8) + '" y="' + (y + 4) + '" text-anchor="end" fill="#fff" font-size="9" opacity=".85">' + L.ui.esc(sub) + '</text>' : '') + '</g></a>';
  }

  function bipartite(left, right, edges, leftHref, rightHref, leftColor, rightColor) {
    var W = 900, H = Math.max(420, Math.max(left.length, right.length) * 58 + 80);
    var ly = function (i, n) { return H / 2 + (i - (n - 1) / 2) * Math.min(58, (H - 80) / Math.max(1, n)); };
    var lx = 145, rx = 755;
    var svg = '<svg class="network-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    edges.forEach(function (e) {
      var a = left.findIndex(function (n) { return n.id === e.a; });
      var b = right.findIndex(function (n) { return n.id === e.b; });
      if (a < 0 || b < 0) return;
      var y1 = ly(a, left.length), y2 = ly(b, right.length);
      svg += '<path class="net-edge' + (e.dash ? ' dash' : '') + '" data-a="' + e.a + '" data-b="' + e.b + '" d="M ' + (lx + 78) + ' ' + y1 + ' C ' + (lx + 300) + ' ' + y1 + ', ' + (rx - 300) + ' ' + y2 + ', ' + (rx - 78) + ' ' + y2 + '" fill="none"><title>' + L.ui.esc(e.tip || '') + '</title></path>';
    });
    left.forEach(function (n, i) { svg += shape(lx, ly(i, left.length), 156, 30, leftColor(n), n.name, leftHref(n), n.sub); });
    right.forEach(function (n, i) { svg += shape(rx, ly(i, right.length), 156, 30, rightColor(n), n.name, rightHref(n), n.sub); });
    return svg + '</svg>';
  }

  function circleGraph(nodes, edges) {
    var W = 900, H = 520, cx = 450, cy = 255, r = Math.min(190, 46 * nodes.length / Math.PI + 60);
    var pos = {};
    nodes.forEach(function (n, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / nodes.length;
      pos[n.id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
    var svg = '<svg class="network-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    edges.forEach(function (e) {
      var a = pos[e.a], b = pos[e.b];
      if (!a || !b) return;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      svg += '<line class="net-edge" data-a="' + e.a + '" data-b="' + e.b + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"><title>' + L.ui.esc(e.tip || '') + '</title></line>' +
        '<text class="net-label" x="' + mx + '" y="' + (my - 5) + '" text-anchor="middle">' + L.ui.esc(e.label || '') + '</text>';
    });
    nodes.forEach(function (n) {
      var p = pos[n.id];
      svg += '<a href="#/projects/' + n.id + '" data-a="' + n.id + '" class="net-node"><g><circle class="net-shape" cx="' + p.x + '" cy="' + p.y + '" r="21" fill="' + (n.color || '#2563eb') + '"/>' +
        '<text x="' + p.x + '" y="' + (p.y + 4) + '" text-anchor="middle" fill="#fff">' + L.ui.esc(n.name.slice(0, 3)) + '</text>' +
        '<text x="' + p.x + '" y="' + (p.y + 38) + '" text-anchor="middle">' + L.ui.esc(n.name.slice(0, 12)) + '</text></g></a>';
    });
    return svg + '</svg>';
  }

  function projectGroupGraph() {
    var projects = L.store.all('projects');
    var groups = L.store.all('groups');
    var edges = [];
    L.store.all('projectGroups').forEach(function (x) { edges.push({ a: x.groupId, b: x.projectId, tip: x.note || '' }); });
    projects.forEach(function (p) { (p.groups || []).forEach(function (g) { if (!edges.some(function (e) { return e.a === g && e.b === p.id; })) edges.push({ a: g, b: p.id, tip: '' }); }); });
    return bipartite(groups, projects, edges,
      function (g) { return '#/groups/' + g.id; }, function (p) { return '#/projects/' + p.id; },
      function (g) { return g.color || '#2563eb'; }, function () { return '#64748b'; },
      'left');
  }

  function projectLinkGraph() {
    var nodes = L.store.all('projects').map(function (p, i) { return { id: p.id, name: p.name, color: L.schema.options.COLORS[i % L.schema.options.COLORS.length] }; });
    var edges = L.store.all('projectLinks').map(function (x) { return { a: x.from, b: x.to, label: x.type, tip: x.note || '' }; });
    return circleGraph(nodes, edges);
  }

  function memberProjectGraph(groupId) {
    var members = L.store.all('members').filter(function (m) { return !groupId || m.groupId === groupId; });
    var memberIds = members.map(function (m) { return m.id; });
    var projects = L.store.all('projects').filter(function (p) {
      return L.store.all('projectMembers').some(function (pm) { return pm.projectId === p.id && memberIds.indexOf(pm.memberId) >= 0; });
    });
    var edges = L.store.all('projectMembers').filter(function (pm) { return memberIds.indexOf(pm.memberId) >= 0 && projects.some(function (p) { return p.id === pm.projectId; }); })
      .map(function (pm) { return { a: pm.memberId, b: pm.projectId, tip: pm.role + '：' + (pm.responsibility || '') }; });
    return bipartite(members, projects, edges,
      function (m) { return '#/members/' + m.id; }, function (p) { return '#/projects/' + p.id; },
      function (m) { return L.ui.colorOf(m.id); }, function (p) { return '#0f766e'; });
  }

  function assetProjectGraph() {
    var assets = L.store.all('assets');
    var projects = L.store.all('projects');
    var edges = L.store.all('assetProjects').map(function (x) { return { a: x.assetId, b: x.projectId, tip: x.purpose || '' }; });
    return bipartite(assets, projects, edges,
      function (a) { return '#/assets/' + a.id; }, function (p) { return '#/projects/' + p.id; },
      function (a) { return L.ui.colorOf(a.category || a.id); }, function () { return '#64748b'; });
  }

  function ownerAssetGraph() {
    var owners = L.store.all('members').filter(function (m) { return L.store.memberAssets(m.id).length; });
    var assets = L.store.all('assets').filter(function (a) { return a.custodianId; });
    var edges = assets.map(function (a) { return { a: a.custodianId, b: a.id, tip: a.name + ' · ' + (a.quantity || '') + (a.unit || '') }; });
    return bipartite(owners, assets, edges,
      function (m) { return '#/members/' + m.id; }, function (a) { return '#/assets/' + a.id; },
      function (m) { return L.ui.colorOf(m.id); }, function (a) { return L.ui.colorOf(a.category || a.id); });
  }

  function matrix() {
    var groups = L.store.all('groups');
    var counts = {};
    var detail = {};
    L.store.all('projects').forEach(function (p) {
      var gs = (p.groups || []).slice();
      for (var i = 0; i < gs.length; i++) for (var j = i + 1; j < gs.length; j++) {
        var key = [gs[i], gs[j]].sort().join('|');
        counts[key] = (counts[key] || 0) + 1;
        (detail[key] = detail[key] || []).push(p.id);
      }
    });
    var html = '<div class="table-wrap"><table class="matrix"><thead><tr><th>课题组</th>' + groups.map(function (g) { return '<th class="center">' + L.ui.esc(g.name.slice(0, 8)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    groups.forEach(function (a) {
      html += '<tr><td>' + L.ui.esc(a.name) + '</td>';
      groups.forEach(function (b) {
        if (a.id === b.id) { html += '<td class="center muted">—</td>'; return; }
        var key = [a.id, b.id].sort().join('|');
        var n = counts[key] || 0;
        html += '<td class="cell ' + (n ? '' : 'zero') + '" data-pair="' + key + '" title="' + L.ui.esc(n ? '点击查看共同项目' : '暂无共同项目') + '">' + (n || '·') + '</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function threeFlow() {
    var groups = {};
    L.store.flowEvents({}).forEach(function (e) {
      var key = e.memberId + '|' + (e.locationId || e.toLocationId || '');
      if (!groups[key]) groups[key] = { memberId: e.memberId, locationId: e.locationId || e.toLocationId || '', rows: [], kinds: {} };
      groups[key].rows.push(e);
      groups[key].kinds[e.kind] = (groups[key].kinds[e.kind] || 0) + 1;
    });
    var list = Object.keys(groups).map(function (k) { return groups[k]; })
      .filter(function (g) { return Object.keys(g.kinds).length > 1; })
      .sort(function (a, b) { return b.rows.length - a.rows.length; }).slice(0, 30);
    return '<div class="card"><div class="table-wrap"><table><thead><tr><th>人员</th><th>场所</th><th>人流</th><th>物流</th><th>信息流</th><th>交叉事件</th><th>最近事件</th><th style="width:90px">操作</th></tr></thead><tbody>' +
      (list.length ? list.map(function (g) {
        var recent = g.rows[0];
        return '<tr><td><a data-nav="#/members/' + g.memberId + '">' + L.ui.esc(L.store.name('members', g.memberId)) + '</a></td>' +
          '<td>' + L.ui.esc(L.store.name('locations', g.locationId)) + '</td>' +
          '<td>' + (g.kinds['人流'] || 0) + '</td><td>' + (g.kinds['物流'] || 0) + '</td><td>' + (g.kinds['信息流'] || 0) + '</td>' +
          '<td><b>' + g.rows.length + '</b></td><td class="small faint">' + L.ui.esc(recent.title.slice(0, 24)) + ' · ' + L.ui.esc(L.ui.fmtDate(recent.at)) + '</td>' +
          '<td><button class="btn sm" data-nav="#/flow?member=' + g.memberId + '&location=' + g.locationId + '">查看三流</button></td></tr>';
      }).join('') : '<tr><td colspan="8">' + L.ui.empty('暂无交叉记录') + '</td></tr>') + '</tbody></table></div>' +
      '<div class="schema-note" style="margin:16px">只列出至少同时出现两类流的“人员-场所”组合。三流事件共用人员、场所、物品、项目与时间维度，因此可以从任一节点反向追踪另外两类事件。</div></div>';
  }

  L.views.relations = {
    title: '关系视图',
    mode: 'group-project',
    groupFilter: '',
    render: function () {
      var self = this;
      var modes = [['group-project', '项目-组别协作网'], ['project-link', '项目关联网络'], ['member-project', '成员-项目参与网'], ['asset-project', '物品-项目关联网'], ['owner-asset', '负责人-物品网'], ['three-flow', '三流交叉关系'], ['matrix', '跨组协作矩阵'], ['list', '交叉协作清单']];
      var body = '';
      if (self.mode === 'group-project') body = '<div class="network-wrap">' + projectGroupGraph() + '<div class="legend"><span><i style="background:#2563eb"></i>课题组</span><span><i style="background:#64748b"></i>项目</span><span>连线表示项目涉及该组，点击节点可查看详情</span></div></div>';
      if (self.mode === 'project-link') body = '<div class="network-wrap">' + projectLinkGraph() + '<div class="legend"><span>连线上的文字为关联类型，点击节点进入项目详情</span></div></div>';
      if (self.mode === 'member-project') body = '<div class="toolbar"><div class="field"><label>只看课题组</label><select id="relGroup"><option value="">全部组别</option>' + L.store.all('groups').map(function (g) { return '<option value="' + g.id + '"' + (self.groupFilter === g.id ? ' selected' : '') + '>' + L.ui.esc(g.name) + '</option>'; }).join('') + '</select></div></div><div class="network-wrap">' + memberProjectGraph(self.groupFilter) + '<div class="legend"><span><i style="background:#7c3aed"></i>成员</span><span><i style="background:#0f766e"></i>项目</span><span>悬停节点可高亮其全部参与关系</span></div></div>';
      if (self.mode === 'asset-project') body = '<div class="network-wrap">' + assetProjectGraph() + '<div class="legend"><span><i style="background:#2563eb"></i>物品资产</span><span><i style="background:#64748b"></i>项目</span><span>连线表示物品被该项目使用，悬停可高亮</span></div></div>';
      if (self.mode === 'owner-asset') body = '<div class="network-wrap">' + ownerAssetGraph() + '<div class="legend"><span><i style="background:#7c3aed"></i>负责人</span><span><i style="background:#0f766e"></i>物品资产</span><span>连线表示成员负责或保管该物品</span></div></div>';
      if (self.mode === 'three-flow') body = threeFlow();
      if (self.mode === 'matrix') body = '<div class="card">' + matrix() + '<div class="schema-note" style="margin:16px">矩阵中的数字为两个课题组共同项目数，点击数字查看具体项目。共同项目由项目的“涉及课题组”字段自动统计。</div></div>';
      if (self.mode === 'list') body = crossList();

      return '<div class="page-head"><div><h1>关系视图</h1><p>从组别、成员、项目和物品四个角度查看交叉协作关系，所有关系均由登记信息自动生成。</p></div>' +
        '<div class="head-actions"><button class="btn" data-action="new" data-entity="assetProjects"><svg class="icon"><use href="#i-box"/></svg>关联物品到项目</button>' +
        '<button class="btn" data-action="new" data-entity="projectLinks"><svg class="icon"><use href="#i-link"/></svg>登记项目关联</button></div></div>' +
        '<section class="card"><div class="tabs">' + modes.map(function (m) { return '<div class="tab ' + (self.mode === m[0] ? 'active' : '') + '" data-mode="' + m[0] + '">' + m[1] + '</div>'; }).join('') + '</div><div class="pane">' + body + '</div></section>';
    },
    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-mode]').forEach(function (el) {
        el.onclick = function () { self.mode = el.dataset.mode; L.app.refresh(); };
      });
      var sel = root.querySelector('#relGroup');
      if (sel) sel.onchange = function () { self.groupFilter = sel.value; L.app.refresh(); };
      root.querySelectorAll('.net-node').forEach(function (node) {
        node.addEventListener('mouseenter', function () {
          root.querySelectorAll('.net-edge').forEach(function (edge) {
            if (edge.dataset.a === node.dataset.a || edge.dataset.b === node.dataset.a || edge.getAttribute('data-a') === node.getAttribute('data-a')) edge.classList.add('hot');
          });
        });
        node.addEventListener('mouseleave', function () { root.querySelectorAll('.net-edge.hot').forEach(function (e) { e.classList.remove('hot'); }); });
      });
      root.querySelectorAll('[data-pair]').forEach(function (cell) {
        cell.onclick = function () {
          var ids = cell.dataset.pair.split('|');
          var projects = L.store.all('projects').filter(function (p) { return ids.every(function (id) { return (p.groups || []).indexOf(id) >= 0; }); });
          L.ui.modal({
            title: L.store.name('groups', ids[0]) + ' × ' + L.store.name('groups', ids[1]), okText: '关闭', cancelText: '关闭',
            body: projects.length ? projects.map(function (p) { return '<div class="list-item"><a class="link-title" data-nav="#/projects/' + p.id + '">' + L.ui.esc(p.name) + '</a><div class="small faint">' + L.ui.esc(p.code || '') + '</div></div>'; }).join('') : L.ui.empty('暂无共同项目'),
            onOk: function () {}
          });
        };
      });
    }
  };

  function crossList() {
    var rows = L.store.crossGroupProjects();
    if (!rows.length) return L.ui.empty('暂无跨组项目');
    return '<div class="table-wrap"><table><thead><tr><th>项目</th><th>涉及组别</th><th>各组参与成员</th><th>状态</th><th>关联项目</th></tr></thead><tbody>' + rows.map(function (p) {
      var byGroup = {};
      L.store.projectMembers(p.id).forEach(function (x) { (byGroup[x.member.groupId] = byGroup[x.member.groupId] || []).push(x.member.name); });
      return '<tr><td><a class="link-title" data-nav="#/projects/' + p.id + '">' + L.ui.esc(p.name) + '</a></td><td>' + (p.groups || []).map(function (g) { return L.ui.badge(L.store.name('groups', g), 'blue'); }).join(' ') + '</td>' +
        '<td class="small">' + Object.keys(byGroup).map(function (g) { return L.ui.esc(L.store.name('groups', g)) + '：' + L.ui.esc(byGroup[g].join('、')); }).join('<br>') + '</td>' +
        '<td>' + L.ui.status(p.status) + '</td><td class="small">' + L.ui.esc(L.store.relatedProjects(p.id).map(function (x) { return x.other.name; }).join('、') || '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
})(window.LabApp = window.LabApp || {});
