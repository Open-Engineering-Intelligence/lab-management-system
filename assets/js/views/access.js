/* 人员进出：出入记录、出入权限与场所管理（人流） */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function opts(values, current, allLabel) {
    return '<option value="">' + (allLabel || '全部') + '</option>' + values.map(function (v) {
      return '<option value="' + L.ui.esc(v) + '"' + (current === v ? ' selected' : '') + '>' + L.ui.esc(v) + '</option>';
    }).join('');
  }
  function memberOpts(current, allLabel) {
    return '<option value="">' + (allLabel || '全部人员') + '</option>' + L.store.all('members').map(function (m) {
      return '<option value="' + m.id + '"' + (current === m.id ? ' selected' : '') + '>' + L.ui.esc(m.name) + '</option>';
    }).join('');
  }
  function locationOpts(current, allLabel) {
    return '<option value="">' + (allLabel || '全部场所') + '</option>' + L.store.all('locations').map(function (x) {
      return '<option value="' + x.id + '"' + (current === x.id ? ' selected' : '') + '>' + L.ui.esc(x.name) + '</option>';
    }).join('');
  }

  L.views.access = {
    title: '人员进出',
    tab: 'records',
    filters: { memberId: '', locationId: '', direction: '', result: '', from: '', to: '', q: '' },
    permFilters: { memberId: '', locationId: '', level: '' },

    render: function () {
      var self = this;
      var f = this.filters;
      var records = L.store.all('accessRecords').filter(function (x) {
        if (f.memberId && x.memberId !== f.memberId) return false;
        if (f.locationId && x.locationId !== f.locationId) return false;
        if (f.direction && x.direction !== f.direction) return false;
        if (f.result && x.result !== f.result) return false;
        var day = String(x.at || '').slice(0, 10);
        if (f.from && (!day || day < f.from)) return false;
        if (f.to && (!day || day > f.to)) return false;
        if (f.q && [L.store.name('members', x.memberId), L.store.name('locations', x.locationId), x.method, x.notes, L.store.name('projects', x.projectId)].join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      }).sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); }).slice(0, 300);

      var today = new Date().toISOString().slice(0, 10);
      var todayCount = L.store.all('accessRecords').filter(function (x) { return String(x.at || '').slice(0, 10) === today; }).length;
      var abnormal = L.store.all('accessRecords').filter(function (x) { return x.result === '拒绝' || x.result === '异常'; }).length;
      var pending = L.store.all('permissions').filter(function (x) { return x.level === '待审批'; }).length;
      var present = 0, last = {};
      L.store.all('accessRecords').slice().sort(function (a, b) { return String(a.at || '').localeCompare(String(b.at || '')); }).forEach(function (x) {
        last[x.memberId + '@' + x.locationId] = x.direction;
      });
      Object.keys(last).forEach(function (k) { if (last[k] === '进入') present++; });

      var tabs = [['records', '进出记录'], ['permissions', '出入权限'], ['locations', '场所管理']];
      var body = '';
      if (self.tab === 'records') {
        body = '<div class="toolbar"><div class="field"><label>人员</label><select data-filter="memberId">' + memberOpts(f.memberId) + '</select></div>' +
          '<div class="field"><label>场所</label><select data-filter="locationId">' + locationOpts(f.locationId) + '</select></div>' +
          '<div class="field"><label>方向</label><select data-filter="direction">' + opts(L.schema.options.ACCESS_DIRECTION, f.direction) + '</select></div>' +
          '<div class="field"><label>结果</label><select data-filter="result">' + opts(L.schema.options.ACCESS_RESULT, f.result) + '</select></div>' +
          '<div class="field"><label>起始日期</label><input type="date" data-filter="from" value="' + L.ui.esc(f.from) + '"></div>' +
          '<div class="field"><label>截止日期</label><input type="date" data-filter="to" value="' + L.ui.esc(f.to) + '"></div>' +
          '<div class="field"><label>关键词</label><input data-filter="q" value="' + L.ui.esc(f.q) + '" placeholder="人员 / 场所 / 备注"></div>' +
          '<button class="btn sm" data-action="clear-access-filter">重置筛选</button><span class="small faint" style="margin-left:auto">显示 ' + records.length + ' 条 · 按时间倒序</span></div>' +
          '<section class="card"><div class="table-wrap"><table><thead><tr><th>人员</th><th>场所</th><th>方向</th><th>时间</th><th>通行方式</th><th>结果</th><th>关联项目</th><th style="width:70px">操作</th></tr></thead><tbody>' +
          (records.length ? records.map(function (x) {
            return '<tr><td>' + L.ui.person(L.store.find('members', x.memberId)) + '</td>' +
              '<td>' + L.ui.esc(L.store.name('locations', x.locationId)) + '</td>' +
              '<td>' + L.ui.badge(x.direction || '—', x.direction === '进入' ? 'green' : 'blue') + '</td>' +
              '<td class="small">' + L.ui.esc(L.ui.fmtDate(x.at)) + '</td>' +
              '<td class="small">' + L.ui.esc(x.method || '—') + '</td>' +
              '<td>' + L.ui.status(x.result) + '</td>' +
              '<td class="small">' + (x.projectId ? '<a data-nav="#/projects/' + x.projectId + '">' + L.ui.esc(L.store.name('projects', x.projectId)) + '</a>' : '<span class="faint">—</span>') + '</td>' +
              '<td><button class="icon-btn" title="编辑" data-action="edit" data-entity="accessRecords" data-id="' + x.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
              '<button class="icon-btn" title="删除" data-action="delete" data-entity="accessRecords" data-id="' + x.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
          }).join('') : '<tr><td colspan="8">' + L.ui.empty('没有符合条件的进出记录', '调整筛选条件或登记一条新的进出记录') + '</td></tr>') + '</tbody></table></div></section>';
      } else if (self.tab === 'permissions') {
        var pf = this.permFilters;
        var perms = L.store.all('permissions').filter(function (x) {
          if (pf.memberId && x.memberId !== pf.memberId) return false;
          if (pf.locationId && x.locationId !== pf.locationId) return false;
          if (pf.level && x.level !== pf.level) return false;
          return true;
        });
        body = '<div class="toolbar"><div class="field"><label>成员</label><select data-perm="memberId">' + memberOpts(pf.memberId) + '</select></div>' +
          '<div class="field"><label>场所</label><select data-perm="locationId">' + locationOpts(pf.locationId) + '</select></div>' +
          '<div class="field"><label>权限等级</label><select data-perm="level">' + opts(L.schema.options.PERM_LEVEL, pf.level) + '</select></div>' +
          '<button class="btn sm" data-action="clear-perm-filter">重置筛选</button><span class="small faint" style="margin-left:auto">共 ' + perms.length + ' 条权限</span></div>' +
          '<section class="card"><div class="table-wrap"><table><thead><tr><th>成员</th><th>场所</th><th>权限等级</th><th>有效期</th><th>审批人</th><th>说明</th><th style="width:70px">操作</th></tr></thead><tbody>' +
          (perms.length ? perms.map(function (x) {
            return '<tr><td>' + L.ui.person(L.store.find('members', x.memberId)) + '</td>' +
              '<td>' + L.ui.esc(L.store.name('locations', x.locationId)) + '</td>' +
              '<td>' + L.ui.status(x.level) + '</td>' +
              '<td class="small">' + L.ui.esc(x.validFrom || '—') + ' ~ ' + L.ui.esc(x.validTo || '长期') + '</td>' +
              '<td class="small">' + L.ui.esc(L.store.name('members', x.approvedBy)) + '</td>' +
              '<td class="small faint">' + L.ui.esc((x.notes || '').slice(0, 24)) + '</td>' +
              '<td><button class="icon-btn" title="编辑" data-action="edit" data-entity="permissions" data-id="' + x.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
              '<button class="icon-btn" title="删除" data-action="delete" data-entity="permissions" data-id="' + x.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
          }).join('') : '<tr><td colspan="7">' + L.ui.empty('没有符合条件的权限') + '</td></tr>') + '</tbody></table></div></section>';
      } else {
        var locations = L.store.all('locations');
        body = '<div class="grid cols-3">' + (locations.length ? locations.map(function (x) {
          var inCount = L.store.locationAccess(x.id).filter(function (r) { return r.rec.direction === '进入'; }).length;
          var permCount = L.store.locationPermissions(x.id).length;
          var flowCount = L.store.locationFlows(x.id).length;
          return '<section class="card"><div class="card-head"><h2>' + L.ui.esc(x.name) + '</h2><div class="right">' + L.ui.badge(x.type || '场所', 'blue') + '</div></div>' +
            '<div class="card-pad"><div class="small muted">' + L.ui.esc([x.building, x.room].filter(Boolean).join(' ')) + ' · ' + L.ui.esc(x.code || '未编号') + '</div>' +
            '<div class="mini-stat" style="margin:14px 0"><div><b>' + inCount + '</b><span>进入记录</span></div><div><b>' + permCount + '</b><span>授权人数</span></div><div><b>' + flowCount + '</b><span>物品流转</span></div></div>' +
            '<div class="small faint">负责人：' + L.ui.esc(L.store.name('members', x.custodianId)) + ' · 准入：' + L.ui.esc(x.accessRule || '未设置') + '</div>' +
            '<div class="divider"></div><div class="row"><button class="btn sm" data-nav="#/flow?location=' + x.id + '">查看三流交叉</button>' +
            '<button class="icon-btn" title="编辑" data-action="edit" data-entity="locations" data-id="' + x.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn" title="删除" data-action="delete" data-entity="locations" data-id="' + x.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></div></div></section>';
        }).join('') : L.ui.empty('还没有登记场所', '点击右上角“新增场所”开始'));
        body += '</div>';
      }

      return '<div class="page-head"><div><h1>人员进出</h1><p>记录人员进出与出入权限，按人员、场所、时间查询；与物品流转和信息查阅共用场所维度，可在“三流交叉”中联动分析。</p></div>' +
        '<div class="head-actions"><button class="btn" data-action="new" data-entity="permissions"><svg class="icon"><use href="#i-shield"/></svg>配置权限</button>' +
        '<button class="btn" data-action="new" data-entity="locations"><svg class="icon"><use href="#i-location"/></svg>新增场所</button>' +
        '<button class="btn primary" data-action="new" data-entity="accessRecords"><svg class="icon"><use href="#i-plus"/></svg>登记进出</button></div></div>' +
        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('今日进出', todayCount, '按记录时间统计', 'i-door', 'primary') +
        L.ui.stat('当前在场', present, '按各场所最后一条记录估算', 'i-users', 'teal') +
        L.ui.stat('异常通行', abnormal, '拒绝与异常记录累计', 'i-info', 'rose') +
        L.ui.stat('待审批权限', pending, '需管理员确认', 'i-shield', 'amber') + '</div>' +
        '<div class="tabs">' + tabs.map(function (t) { return '<div class="tab' + (self.tab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join('') + '</div><div style="height:16px"></div>' + body;
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
      root.querySelectorAll('[data-perm]').forEach(function (el) {
        el.addEventListener('change', function () { self.permFilters[el.dataset.perm] = el.value.trim(); L.app.refresh(); });
      });
    }
  };
})(window.LabApp = window.LabApp || {});
