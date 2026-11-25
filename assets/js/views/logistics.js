/* 物品流转：领用归还、位置转移与库存台账（物流） */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function optList(values, current, allLabel) {
    return '<option value="">' + (allLabel || '全部') + '</option>' + values.map(function (v) {
      return '<option value="' + L.ui.esc(v) + '"' + (current === v ? ' selected' : '') + '>' + L.ui.esc(v) + '</option>';
    }).join('');
  }
  function refOpts(entity, current, allLabel, field) {
    return '<option value="">' + (allLabel || '全部') + '</option>' + L.store.all(entity).map(function (x) {
      return '<option value="' + x.id + '"' + (current === x.id ? ' selected' : '') + '>' + L.ui.esc(x[field || 'name'] || x.title || x.id) + '</option>';
    }).join('');
  }

  L.views.logistics = {
    title: '物品流转',
    tab: 'records',
    filters: { assetId: '', memberId: '', type: '', status: '', locationId: '', from: '', to: '', q: '' },

    render: function () {
      var self = this, f = this.filters;
      var all = L.store.all('assetFlows');
      var rows = all.filter(function (x) {
        if (f.assetId && x.assetId !== f.assetId) return false;
        if (f.memberId && x.memberId !== f.memberId) return false;
        if (f.type && x.type !== f.type) return false;
        if (f.status && x.status !== f.status) return false;
        if (f.locationId && x.fromLocationId !== f.locationId && x.toLocationId !== f.locationId) return false;
        var day = String(x.at || '').slice(0, 10);
        if (f.from && (!day || day < f.from)) return false;
        if (f.to && (!day || day > f.to)) return false;
        if (f.q && [L.store.name('assets', x.assetId), L.store.name('members', x.memberId), x.purpose, x.notes, L.store.name('projects', x.projectId)].join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      }).sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });

      var today = new Date().toISOString().slice(0, 10);
      var todayCount = all.filter(function (x) { return String(x.at || '').slice(0, 10) === today; }).length;
      var active = all.filter(function (x) { return x.status === '在途'; }).length;
      var overdue = all.filter(function (x) { return x.status === '逾期'; }).length;
      var loan = all.filter(function (x) { return x.type === '领用'; }).length;

      var body = '';
      if (self.tab === 'records') {
        body = '<div class="toolbar"><div class="field"><label>物品</label><select data-filter="assetId">' + refOpts('assets', f.assetId, '全部物品') + '</select></div>' +
          '<div class="field"><label>经办人</label><select data-filter="memberId">' + refOpts('members', f.memberId, '全部人员') + '</select></div>' +
          '<div class="field"><label>流转类型</label><select data-filter="type">' + optList(L.schema.options.FLOW_TYPE, f.type) + '</select></div>' +
          '<div class="field"><label>状态</label><select data-filter="status">' + optList(L.schema.options.FLOW_STATUS, f.status) + '</select></div>' +
          '<div class="field"><label>涉及场所</label><select data-filter="locationId">' + refOpts('locations', f.locationId, '全部场所') + '</select></div>' +
          '<div class="field"><label>起始日期</label><input type="date" data-filter="from" value="' + L.ui.esc(f.from) + '"></div>' +
          '<div class="field"><label>截止日期</label><input type="date" data-filter="to" value="' + L.ui.esc(f.to) + '"></div>' +
          '<div class="field"><label>关键词</label><input data-filter="q" value="' + L.ui.esc(f.q) + '" placeholder="物品 / 人员 / 用途"></div>' +
          '<button class="btn sm" data-action="clear-flow-filter">重置筛选</button><span class="small faint" style="margin-left:auto">共 ' + rows.length + ' 条</span></div>' +
          '<section class="card"><div class="table-wrap"><table><thead><tr><th>物品</th><th>类型</th><th>经办人</th><th>来源 → 目标</th><th>数量</th><th>时间</th><th>关联项目</th><th>状态</th><th style="width:70px">操作</th></tr></thead><tbody>' +
          (rows.length ? rows.map(function (x) {
            var a = L.store.find('assets', x.assetId);
            return '<tr><td><a class="link-title" data-nav="#/assets/' + x.assetId + '">' + L.ui.esc(L.store.name('assets', x.assetId)) + '</a><div class="small faint">' + L.ui.esc(a ? a.assetNo : '') + '</div></td>' +
              '<td>' + L.ui.badge(x.type || '—', x.type === '领用' ? 'green' : x.type === '归还' ? 'blue' : 'violet') + '</td>' +
              '<td>' + L.ui.esc(L.store.name('members', x.memberId)) + '</td>' +
              '<td class="small">' + L.ui.esc(L.store.name('locations', x.fromLocationId)) + ' → ' + L.ui.esc(L.store.name('locations', x.toLocationId)) + '</td>' +
              '<td class="small">' + L.ui.esc(x.quantity || '—') + '</td>' +
              '<td class="small">' + L.ui.esc(L.ui.fmtDate(x.at)) + '</td>' +
              '<td class="small">' + (x.projectId ? '<a data-nav="#/projects/' + x.projectId + '">' + L.ui.esc(L.store.name('projects', x.projectId)) + '</a>' : '<span class="faint">—</span>') + '</td>' +
              '<td>' + L.ui.status(x.status) + '</td>' +
              '<td><button class="icon-btn" title="编辑" data-action="edit" data-entity="assetFlows" data-id="' + x.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
              '<button class="icon-btn" title="删除" data-action="delete" data-entity="assetFlows" data-id="' + x.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
          }).join('') : '<tr><td colspan="9">' + L.ui.empty('没有符合条件的流转记录') + '</td></tr>') + '</tbody></table></div></section>';
      } else {
        var assets = L.store.all('assets').map(function (a) {
          var flows = L.store.assetFlowsOf(a.id);
          var last = flows[0];
          var where = last && last.rec.toLocationId ? L.store.name('locations', last.rec.toLocationId) : (a.location || '未登记');
          return { asset: a, last: last, where: where, count: flows.length };
        });
        var byLoc = {};
        assets.forEach(function (x) { (byLoc[x.where] = byLoc[x.where] || []).push(x); });
        body = '<div class="grid cols-3">' + Object.keys(byLoc).sort().map(function (loc) {
          var items = byLoc[loc];
          return '<section class="card"><div class="card-head"><h2>' + L.ui.esc(loc) + '</h2><div class="right">' + L.ui.badge(items.length + ' 项', 'blue') + '</div></div>' +
            '<div class="card-pad">' + items.map(function (x) {
              return '<div class="list-item" style="padding:10px 0"><div class="spread"><div><a class="link-title" data-nav="#/assets/' + x.asset.id + '">' + L.ui.esc(x.asset.name) + '</a>' +
                '<div class="small faint">' + L.ui.esc(x.asset.assetNo || '') + ' · ' + L.ui.esc(L.store.name('members', x.asset.custodianId)) + '</div></div>' +
                '<div class="small faint">' + (x.last ? L.ui.fmtDate(x.last.rec.at) : '暂无流转') + '</div></div></div>';
            }).join('') + '</div></section>';
        }).join('') + '</div>';
      }

      return '<div class="page-head"><div><h1>物品流转</h1><p>记录设备与耗材的领用、归还、位置转移、维修送检，所有流转都关联人员、物品、场所、项目和时间。</p></div>' +
        '<div class="head-actions"><button class="btn" data-nav="#/flow?kind=%E7%89%A9%E6%B5%81">三流交叉分析</button>' +
        '<button class="btn primary" data-action="new" data-entity="assetFlows"><svg class="icon"><use href="#i-plus"/></svg>登记流转</button></div></div>' +
        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('今日流转', todayCount, '按登记时间统计', 'i-swap', 'primary') +
        L.ui.stat('在途', active, '待接收确认', 'i-box', 'blue') +
        L.ui.stat('逾期', overdue, '需尽快处理', 'i-info', 'rose') +
        L.ui.stat('累计领用', loan, '领用登记次数', 'i-check', 'green') + '</div>' +
        '<div class="tabs"><div class="tab' + (self.tab === 'records' ? ' active' : '') + '" data-tab="records">流转记录</div>' +
        '<div class="tab' + (self.tab === 'ledger' ? ' active' : '') + '" data-tab="ledger">位置台账</div></div><div style="height:16px"></div>' + body;
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
    }
  };
})(window.LabApp = window.LabApp || {});
