/* 三流交叉：把人流、物流、信息流统一为事件，按人员/物品/地点/时间交叉查询与统计 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function optValues(values, current, allLabel) {
    return '<option value="">' + (allLabel || '全部') + '</option>' + values.map(function (v) {
      return '<option value="' + L.ui.esc(v) + '"' + (current === v ? ' selected' : '') + '>' + L.ui.esc(v) + '</option>';
    }).join('');
  }
  function refOpts(entity, current, allLabel, field) {
    return '<option value="">' + (allLabel || '全部') + '</option>' + L.store.all(entity).map(function (x) {
      return '<option value="' + x.id + '"' + (current === x.id ? ' selected' : '') + '>' + L.ui.esc(x[field || 'name'] || x.title || x.id) + '</option>';
    }).join('');
  }
  function kindBadge(kind) {
    return L.ui.badge(kind, kind === '人流' ? 'blue' : kind === '物流' ? 'violet' : 'teal');
  }
  function bar(label, value, max, cls) {
    var w = max ? Math.max(2, Math.round(value / max * 100)) : 0;
    return '<div class="bar-row"><span class="bar-label">' + L.ui.esc(label) + '</span><div class="bar-track"><i class="' + (cls || '') + '" style="width:' + w + '%"></i></div><b>' + value + '</b></div>';
  }

  function pivotRows(type, id) {
    var S = L.store, out = { people: [], goods: [], info: [] };
    var go = function (entity, eid) { return '#/' + entity + '/' + eid; };
    if (type === 'member') {
      S.memberAccess(id).forEach(function (x) {
        out.people.push({ at: x.rec.at, title: (x.rec.direction || '进出') + ' · ' + S.name('locations', x.rec.locationId), sub: x.rec.method + ' · ' + (x.rec.result || ''), status: x.rec.result, href: '#/access', entity: 'accessRecords', eid: x.rec.id });
      });
      S.memberFlows(id).forEach(function (x) {
        out.goods.push({ at: x.rec.at, title: (x.rec.type || '流转') + ' · ' + S.name('assets', x.rec.assetId), sub: '→ ' + S.name('locations', x.rec.toLocationId), status: x.rec.status, href: '#/assets/' + x.rec.assetId, entity: 'assetFlows', eid: x.rec.id });
      });
      S.memberNotices(id).forEach(function (x) {
        out.info.push({ at: x.rec.readAt || x.rec.deliveredAt, title: S.name('notices', x.rec.noticeId, 'title'), sub: x.rec.channel + ' · 查阅地点 ' + S.name('locations', x.rec.locationId), status: x.rec.status, href: '#/notices/' + x.rec.noticeId, entity: 'noticeReceipts', eid: x.rec.id });
      });
    } else if (type === 'asset') {
      var pids = S.assetProjects(id).map(function (x) { return x.project.id; });
      S.assetFlowsOf(id).forEach(function (x) {
        out.goods.push({ at: x.rec.at, title: (x.rec.type || '流转') + ' · ' + S.name('locations', x.rec.toLocationId), sub: S.name('members', x.rec.memberId) + ' · ' + (x.rec.purpose || ''), status: x.rec.status, href: '#/assets/' + id, entity: 'assetFlows', eid: x.rec.id });
      });
      S.all('accessRecords').filter(function (x) { return pids.indexOf(x.projectId) >= 0; }).forEach(function (x) {
        out.people.push({ at: x.at, title: S.name('members', x.memberId) + ' ' + (x.direction || '进出'), sub: S.name('locations', x.locationId) + ' · ' + S.name('projects', x.projectId), status: x.result, href: '#/access', entity: 'accessRecords', eid: x.id });
      });
      S.all('notices').filter(function (n) { return pids.indexOf(n.projectId) >= 0 || n.locationId === (S.find('assets', id) || {}).location; }).forEach(function (n) {
        out.info.push({ at: n.publishAt, title: n.title, sub: n.category + ' · ' + S.name('members', n.authorId), status: n.status, href: '#/notices/' + n.id, entity: 'notices', eid: n.id });
      });
    } else if (type === 'location') {
      S.locationAccess(id).forEach(function (x) {
        out.people.push({ at: x.rec.at, title: S.name('members', x.rec.memberId) + ' ' + (x.rec.direction || '进出'), sub: x.rec.method + ' · ' + (x.rec.result || ''), status: x.rec.result, href: '#/access', entity: 'accessRecords', eid: x.rec.id });
      });
      S.locationFlows(id).forEach(function (x) {
        out.goods.push({ at: x.rec.at, title: (x.rec.rec.type || '流转') + ' · ' + S.name('assets', x.rec.rec.assetId), sub: S.name('members', x.rec.memberId) + ' · ' + S.name('locations', x.rec.rec.toLocationId), status: x.rec.rec.status, href: '#/assets/' + x.rec.rec.assetId, entity: 'assetFlows', eid: x.rec.rec.id });
      });
      S.all('notices').filter(function (n) { return n.locationId === id; }).forEach(function (n) {
        out.info.push({ at: n.publishAt, title: n.title, sub: n.category + ' · ' + S.name('members', n.authorId), status: n.status, href: '#/notices/' + n.id, entity: 'notices', eid: n.id });
      });
      S.all('noticeReceipts').filter(function (x) { return x.locationId === id; }).forEach(function (x) {
        out.info.push({ at: x.readAt || x.deliveredAt, title: '查阅 · ' + S.name('notices', x.noticeId, 'title'), sub: S.name('members', x.memberId) + ' · ' + x.channel, status: x.status, href: '#/notices/' + x.noticeId, entity: 'noticeReceipts', eid: x.id });
      });
    } else if (type === 'project') {
      S.all('accessRecords').filter(function (x) { return x.projectId === id; }).forEach(function (x) {
        out.people.push({ at: x.at, title: S.name('members', x.memberId) + ' ' + (x.direction || '进出'), sub: S.name('locations', x.locationId), status: x.result, href: '#/access', entity: 'accessRecords', eid: x.id });
      });
      S.all('assetFlows').filter(function (x) { return x.projectId === id; }).forEach(function (x) {
        out.goods.push({ at: x.at, title: (x.type || '流转') + ' · ' + S.name('assets', x.assetId), sub: S.name('members', x.memberId) + ' · ' + S.name('locations', x.toLocationId), status: x.status, href: '#/assets/' + x.assetId, entity: 'assetFlows', eid: x.id });
      });
      S.all('notices').filter(function (n) { return n.projectId === id; }).forEach(function (n) {
        out.info.push({ at: n.publishAt, title: n.title, sub: n.category + ' · ' + S.name('members', n.authorId), status: n.status, href: '#/notices/' + n.id, entity: 'notices', eid: n.id });
        S.noticeReceiptsOf(n.id).forEach(function (r) {
          out.info.push({ at: r.rec.readAt || r.rec.deliveredAt, title: '查阅 · ' + n.title, sub: S.name('members', r.rec.memberId) + ' · ' + r.rec.channel, status: r.rec.status, href: '#/notices/' + n.id, entity: 'noticeReceipts', eid: r.rec.id });
        });
      });
    }
    Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); }); });
    return out;
  }

  L.views.flow = {
    title: '三流交叉',
    tab: 'timeline',
    filters: { kind: '', memberId: '', assetId: '', locationId: '', projectId: '', from: '', to: '', q: '' },
    pivot: { type: 'member', id: '' },

    render: function (params) {
      var self = this;
      if (params && params.kind) this.filters.kind = params.kind;
      if (params && params.location) this.filters.locationId = params.location;
      if (params && params.member) this.filters.memberId = params.member;
      if (params && params.asset) this.filters.assetId = params.asset;
      if (params && params.project) this.filters.projectId = params.project;

      var f = this.filters;
      var events = L.store.flowEvents(f);
      var stats = L.store.flowStats();
      var body = '';

      if (self.tab === 'timeline') {
        body = '<div class="toolbar"><div class="field"><label>事件类型</label><select data-filter="kind">' + optValues(['人流', '物流', '信息流'], f.kind, '全部三流') + '</select></div>' +
          '<div class="field"><label>人员</label><select data-filter="memberId">' + refOpts('members', f.memberId, '全部人员') + '</select></div>' +
          '<div class="field"><label>物品</label><select data-filter="assetId">' + refOpts('assets', f.assetId, '全部物品') + '</select></div>' +
          '<div class="field"><label>场所</label><select data-filter="locationId">' + refOpts('locations', f.locationId, '全部场所') + '</select></div>' +
          '<div class="field"><label>项目</label><select data-filter="projectId">' + refOpts('projects', f.projectId, '全部项目') + '</select></div>' +
          '<div class="field"><label>起始日期</label><input type="date" data-filter="from" value="' + L.ui.esc(f.from) + '"></div>' +
          '<div class="field"><label>截止日期</label><input type="date" data-filter="to" value="' + L.ui.esc(f.to) + '"></div>' +
          '<div class="field"><label>关键词</label><input data-filter="q" value="' + L.ui.esc(f.q) + '" placeholder="人员 / 物品 / 场所 / 备注"></div>' +
          '<button class="btn sm" data-action="clear-flow-cross-filter">重置筛选</button><span class="small faint" style="margin-left:auto">命中 ' + events.length + ' 条事件</span></div>' +
          '<section class="card"><div class="card-head"><h2>统一事件时间线</h2><div class="right"><span class="small faint">人流 / 物流 / 信息流按同一时间轴合并</span></div></div>' +
          (events.length ? events.slice(0, 200).map(function (e) {
            var href = e.entity === 'accessRecords' ? '#/access' : e.entity === 'assetFlows' ? '#/logistics' : e.entity === 'notices' ? '#/notices/' + e.id : '#/notices/' + e.noticeId;
            return '<div class="flow-event"><div class="flow-kind kind-' + (e.kind === '人流' ? 'blue' : e.kind === '物流' ? 'violet' : 'teal') + '">' + e.kind + '</div>' +
              '<div class="flow-main"><a class="link-title" data-nav="' + href + '">' + L.ui.esc(e.title) + '</a>' +
              '<div class="small faint">' + L.ui.esc(e.detail) + '</div></div>' +
              '<div class="flow-meta"><span>' + L.ui.esc(e.personName || '—') + '</span><span>' + L.ui.esc(e.assetName || '—') + '</span><span>' + L.ui.esc(e.locationName || '—') + '</span></div>' +
              '<div class="flow-when small">' + L.ui.esc(L.ui.fmtDate(e.at)) + '</div>' +
              '<div>' + L.ui.status(e.status) + '</div>' +
              '<button class="icon-btn" title="编辑源记录" data-action="edit" data-entity="' + e.entity + '" data-id="' + e.id + '"><svg class="icon"><use href="#i-edit"/></svg></button></div>';
          }).join('') : L.ui.empty('没有符合条件的事件', '调整筛选条件，或到各模块登记记录')) + '</section>';
      } else if (self.tab === 'pivot') {
        var p = this.pivot;
        var types = [['member', '按人员', 'members'], ['asset', '按物品', 'assets'], ['location', '按场所', 'locations'], ['project', '按项目', 'projects']];
        var entity = ({ member: 'members', asset: 'assets', location: 'locations', project: 'projects' })[p.type];
        var labelField = p.type === 'project' ? 'name' : 'name';
        var selector = '<div class="toolbar"><div class="field"><label>透视维度</label><select id="pivotType">' + types.map(function (t) { return '<option value="' + t[0] + '"' + (p.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>选择对象</label><select id="pivotId"><option value="">请选择</option>' + L.store.all(entity).map(function (x) {
            return '<option value="' + x.id + '"' + (p.id === x.id ? ' selected' : '') + '>' + L.ui.esc(String(x[labelField] || x.title || x.id).slice(0, 30)) + '</option>';
          }).join('') + '</select></div><span class="small faint" style="margin-left:auto">选定对象后，下方分别显示与其关联的人流、物流与信息流记录。</span></div>';
        if (!p.id) {
          body = selector + '<div class="card">' + L.ui.empty('请选择一个对象', '例如选择某位成员，查看其进出、领用与查阅的全部记录') + '</div>';
        } else {
          var data = pivotRows(p.type, p.id);
          var objName = L.store.name(entity, p.id);
          var cols = [['people', '人流 · 进出与在场', 'blue', 'i-door'], ['goods', '物流 · 领用与流转', 'violet', 'i-swap'], ['info', '信息流 · 发布与查阅', 'teal', 'i-megaphone']];
          body = selector + '<div class="intro-box" style="margin-bottom:16px"><h3>' + L.ui.esc(objName) + ' 的三流交叉视图</h3><p>人流 ' + data.people.length + ' 条 · 物流 ' + data.goods.length + ' 条 · 信息流 ' + data.info.length + ' 条。三类事件通过人员、物品、场所、项目与时间相互关联。</p></div>' +
            '<div class="grid cols-3">' + cols.map(function (c) {
              var rows = data[c[0]];
              return '<section class="card"><div class="card-head"><h2><svg class="icon" style="vertical-align:-3px;color:var(--' + (c[2] === 'blue' ? 'primary' : c[2]) + ')"><use href="#' + c[3] + '"/></svg> ' + c[1] + '</h2><div class="right">' + L.ui.badge(rows.length + ' 条', c[2]) + '</div></div>' +
                (rows.length ? rows.slice(0, 14).map(function (r) {
                  return '<div class="list-item"><div class="spread"><div><a class="link-title" data-nav="' + r.href + '">' + L.ui.esc(r.title) + '</a>' +
                    '<div class="small faint">' + L.ui.esc(r.sub || '') + '</div></div>' +
                    '<div class="small faint nowrap">' + L.ui.esc(L.ui.fmtDate(r.at)) + '</div></div>' +
                    '<div style="margin-top:5px">' + L.ui.status(r.status) + '</div></div>';
                }).join('') : L.ui.empty('暂无关联记录')) + '</section>';
            }).join('') + '</div>';
        }
      } else {
        var allEvents = L.store.flowEvents({});
        var members = L.store.all('members');
        var locations = L.store.all('locations');
        var counts = {};
        allEvents.forEach(function (e) { counts[e.memberId] = (counts[e.memberId] || 0) + 1; });
        var topMembers = members.slice().sort(function (a, b) { return (counts[b.id] || 0) - (counts[a.id] || 0); }).slice(0, 10);
        var locCounts = {};
        allEvents.forEach(function (e) {
          [e.locationId, e.toLocationId].forEach(function (id) { if (id) locCounts[id] = (locCounts[id] || 0) + 1; });
        });
        var topLocs = locations.slice().sort(function (a, b) { return (locCounts[b.id] || 0) - (locCounts[a.id] || 0); }).slice(0, 8);
        var maxCount = Math.max(1, counts[topMembers[0] && topMembers[0].id] || 1);
        var maxLoc = Math.max(1, topLocs.length ? locCounts[topLocs[0].id] : 1);

        var matrix = '<section class="card"><div class="card-head"><h2>人员 × 场所 交叉矩阵</h2><div class="right"><span class="small faint">单元格为该人员在相关场所的三流事件数，点击可下钻</span></div></div><div class="table-wrap"><table class="matrix"><thead><tr><th>成员</th>' + topLocs.map(function (l) { return '<th>' + L.ui.esc(l.name) + '</th>'; }).join('') + '<th>合计</th></tr></thead><tbody>' +
          topMembers.map(function (m) {
            var cells = topLocs.map(function (l) {
              var n = allEvents.filter(function (e) { return e.memberId === m.id && (e.locationId === l.id || e.toLocationId === l.id); }).length;
              return '<td class="cell' + (n ? '' : ' zero') + '" data-cross-member="' + m.id + '" data-cross-location="' + l.id + '">' + n + '</td>';
            });
            return '<tr><td>' + L.ui.esc(m.name) + '</td>' + cells.join('') + '<td><b>' + (counts[m.id] || 0) + '</b></td></tr>';
          }).join('') + '</tbody></table></div></section>';

        var kindBars = [['人流', stats.people, 'blue'], ['物流', stats.goods, 'violet'], ['信息流', stats.info, 'teal']];
        var maxKind = Math.max(1, stats.people, stats.goods, stats.info);
        var locBars = topLocs.map(function (l) { return [l.name, locCounts[l.id] || 0, 'primary']; });
        var distribution = '<div class="grid cols-2"><section class="card"><div class="card-head"><h2>三流事件分布</h2></div><div class="card-pad">' +
          kindBars.map(function (b) { return bar(b[0], b[1], maxKind, 'bar-' + b[2]); }).join('') +
          '<div class="divider"></div><div class="small muted">异常通行 ' + stats.abnormal + ' 条 · 在途/逾期流转 ' + stats.overdue + ' 条 · 未读信息 ' + stats.unread + ' 条 · 待审批权限 ' + stats.pending + ' 条</div></div></section>' +
          '<section class="card"><div class="card-head"><h2>场所活跃度</h2></div><div class="card-pad">' +
          locBars.map(function (b) { return bar(b[0], b[1], maxLoc, 'bar-teal'); }).join('') + '</div></section></div>';

        body = '<div class="grid cols-2" style="margin-bottom:16px"><section class="card"><div class="card-head"><h2>三流交叉关系说明</h2></div><div class="card-pad"><ul class="help-list">' +
          '<li><b>人流</b>：进出记录携带人员、场所、时间、关联项目；权限决定可进入的场所。</li>' +
          '<li><b>物流</b>：流转记录携带物品、经办人、来源/目标场所、数量、项目和时间。</li>' +
          '<li><b>信息流</b>：公告携带发布人、场所、项目；查阅回执携带接收人、查阅地点与时间。</li>' +
          '<li>三类事件共用 <span class="code">memberId / locationId / assetId / projectId / at</span>，因此可沿任一维度反向查询另外两类事件。</li>' +
          '</ul></div></section><section class="card"><div class="card-head"><h2>统计口径</h2></div><div class="card-pad"><dl class="kv">' +
          '<dt>事件总数</dt><dd>' + stats.total + ' 条</dd><dt>今日事件</dt><dd>' + stats.today + ' 条</dd>' +
          '<dt>人流 / 物流 / 信息流</dt><dd>' + stats.people + ' / ' + stats.goods + ' / ' + stats.info + '</dd>' +
          '<dt>场所数</dt><dd>' + locations.length + ' 个</dd><dt>登记物品</dt><dd>' + L.store.all('assets').length + ' 项</dd>' +
          '<dt>信息触达</dt><dd>' + L.store.all('noticeReceipts').length + ' 条回执</dd></dl></div></section></div>' +
          distribution + '<div style="height:16px"></div>' + matrix;
      }

      return '<div class="page-head"><div><h1>三流交叉</h1><p>人流、物流、信息流统一为带“人员-物品-场所-时间”维度的事件，支持交叉透视、统一检索与统计。</p></div>' +
        '<div class="head-actions"><button class="btn" data-nav="#/access">登记进出</button><button class="btn" data-nav="#/logistics">登记流转</button>' +
        '<button class="btn primary" data-nav="#/notices">发布信息</button></div></div>' +
        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('三流事件', stats.total, '全部统一事件', 'i-network', 'primary') +
        L.ui.stat('人流', stats.people, '进出与权限记录', 'i-door', 'blue') +
        L.ui.stat('物流', stats.goods, '领用与位置流转', 'i-swap', 'violet') +
        L.ui.stat('信息流', stats.info, '发布与查阅触达', 'i-megaphone', 'teal') + '</div>' +
        '<div class="tabs">' + [['timeline', '统一时间线'], ['pivot', '交叉透视'], ['matrix', '统计矩阵']].map(function (t) {
          return '<div class="tab' + (self.tab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</div>';
        }).join('') + '</div><div style="height:16px"></div>' + body;
    },

    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-tab]').forEach(function (el) {
        el.onclick = function () { self.tab = el.dataset.tab; L.app.refresh(); };
      });
      root.querySelectorAll('[data-filter]').forEach(function (el) {
        var apply = function () { self.filters[el.dataset.filter] = el.value.trim(); L.app.refresh(); };
        el.addEventListener('change', apply);
        if (el.tagName === 'INPUT') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
      });
      var pt = root.querySelector('#pivotType'), pi = root.querySelector('#pivotId');
      if (pt) pt.onchange = function () { self.pivot = { type: pt.value, id: '' }; L.app.refresh(); };
      if (pi) pi.onchange = function () { self.pivot.id = pi.value; L.app.refresh(); };
      root.querySelectorAll('[data-cross-member]').forEach(function (el) {
        el.onclick = function () {
          self.filters.memberId = el.dataset.crossMember;
          self.filters.locationId = el.dataset.crossLocation;
          self.tab = 'timeline';
          L.app.refresh();
        };
      });
    }
  };
})(window.LabApp = window.LabApp || {});
