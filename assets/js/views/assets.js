/* 资产物品：采购物品与实验设备的登记、筛选、详情及项目关联 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function options(values, current) {
    return values.map(function (v) { return '<option value="' + L.ui.esc(v) + '"' + (current === v ? ' selected' : '') + '>' + L.ui.esc(v) + '</option>'; }).join('');
  }

  L.views.assets = {
    title: '资产物品',
    filters: { category: '', status: '', custodianId: '', q: '' },

    render: function (params) {
      if (params.id) return detail(params.id);
      var f = this.filters;
      var rows = L.store.all('assets').filter(function (a) {
        if (f.category && a.category !== f.category) return false;
        if (f.status && a.status !== f.status) return false;
        if (f.custodianId && a.custodianId !== f.custodianId) return false;
        if (f.q && [a.name, a.assetNo, a.spec, a.tags, a.supplier, a.location, a.notes].filter(Boolean).join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      });
      var memberOpts = L.store.all('members').map(function (m) { return '<option value="' + m.id + '"' + (f.custodianId === m.id ? ' selected' : '') + '>' + L.ui.esc(m.name) + '</option>'; }).join('');
      var total = rows.reduce(function (n, a) { return n + (Number(a.quantity) || 0); }, 0);

      return '<div class="page-head"><div><h1>资产物品</h1><p>登记实验设备、工具耗材、软件授权与外协服务，关联到项目和负责人。</p></div>' +
        '<div class="head-actions"><button class="btn" data-action="new" data-entity="assetProjects"><svg class="icon"><use href="#i-link"/></svg>关联到项目</button>' +
        '<button class="btn primary" data-action="new" data-entity="assets"><svg class="icon"><use href="#i-plus"/></svg>新增资产</button></div></div>' +

        '<div class="toolbar"><div class="field"><label>类别</label><select data-filter="category"><option value="">全部类别</option>' + options(L.schema.options.ASSET_CATEGORY, f.category) + '</select></div>' +
        '<div class="field"><label>使用状态</label><select data-filter="status"><option value="">全部状态</option>' + options(L.schema.options.ASSET_STATUS, f.status) + '</select></div>' +
        '<div class="field"><label>负责人</label><select data-filter="custodianId"><option value="">全部负责人</option>' + memberOpts + '</select></div>' +
        '<div class="field"><label>关键词</label><input data-filter="q" value="' + L.ui.esc(f.q) + '" placeholder="名称 / 编号 / 型号 / 供应商"></div>' +
        '<button class="btn sm" data-action="clear-asset-filter">重置筛选</button><span class="small faint" style="margin-left:auto">共 ' + rows.length + ' 项 · ' + total + ' 件</span></div>' +

        '<section class="card"><div class="table-wrap"><table><thead><tr><th>资产</th><th>类别 / 规格</th><th>数量</th><th>负责人</th><th>关联项目</th><th>状态</th><th style="width:80px">操作</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (a) {
          var linked = L.store.assetProjects(a.id);
          return '<tr><td><a class="link-title" data-nav="#/assets/' + a.id + '">' + L.ui.esc(a.name) + '</a><div class="small faint">' + L.ui.esc(a.assetNo || '未编号') + '</div></td>' +
            '<td>' + L.ui.badge(a.category || '未分类', 'blue') + '<div class="small faint">' + L.ui.esc(a.spec || '') + '</div></td>' +
            '<td>' + L.ui.esc(a.quantity || '—') + ' ' + L.ui.esc(a.unit || '') + '</td>' +
            '<td>' + (a.custodianId ? '<a data-nav="#/members/' + a.custodianId + '">' + L.ui.esc(L.store.name('members', a.custodianId)) + '</a>' : '<span class="faint">未指定</span>') + '</td>' +
            '<td>' + (linked.length ? linked.slice(0, 2).map(function (x) { return '<a class="small" data-nav="#/projects/' + x.project.id + '">' + L.ui.esc(x.project.name.slice(0, 12)) + '</a>'; }).join('、') + (linked.length > 2 ? ' 等 ' + linked.length + ' 项' : '') : '<span class="faint">—</span>') + '</td>' +
            '<td>' + L.ui.status(a.status) + '</td>' +
            '<td><button class="icon-btn" title="编辑" data-action="edit" data-entity="assets" data-id="' + a.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
            '<button class="icon-btn" title="删除" data-action="delete" data-entity="assets" data-id="' + a.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
        }).join('') : '<tr><td colspan="7">' + L.ui.empty('没有符合条件的资产', '点击“新增资产”登记第一件物品') + '</td></tr>') + '</tbody></table></div></section>';
    },

    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-filter]').forEach(function (el) {
        var apply = function () { self.filters[el.dataset.filter] = el.value.trim(); L.app.refresh(); };
        el.addEventListener('change', apply);
        if (el.tagName === 'INPUT') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
      });
    }
  };

  function detail(id) {
    var a = L.store.find('assets', id);
    if (!a) return '<div class="card">' + L.ui.empty('资产不存在') + '</div>';
    var linked = L.store.assetProjects(id);
    var owner = L.store.find('members', a.custodianId);
    var flows = L.store.assetFlowsOf(id);

    return '<div class="page-head"><div><button class="btn ghost sm" data-nav="#/assets">← 返回资产列表</button>' +
      '<h1 style="margin-top:8px">' + L.ui.esc(a.name) + '</h1><p>' + L.ui.esc(a.assetNo || '未编号') + ' · ' + L.ui.esc(a.category || '未分类') + ' · ' + L.ui.esc(a.spec || '无规格信息') + '</p></div>' +
      '<div class="head-actions"><button class="btn" data-nav="#/flow?asset=' + id + '"><svg class="icon"><use href="#i-network"/></svg>三流交叉</button>' +
      '<button class="btn" data-action="new" data-entity="assetFlows" data-defaults=\'{"assetId":"' + id + '"}\'><svg class="icon"><use href="#i-swap"/></svg>登记流转</button>' +
      '<button class="btn" data-action="new" data-entity="assetProjects" data-defaults=\'{"assetId":"' + id + '"}\'><svg class="icon"><use href="#i-link"/></svg>关联项目</button>' +
      '<button class="btn" data-action="edit" data-entity="assets" data-id="' + id + '"><svg class="icon"><use href="#i-edit"/></svg>编辑</button>' +
      '<button class="btn danger" data-action="delete" data-entity="assets" data-id="' + id + '"><svg class="icon"><use href="#i-trash"/></svg>删除</button></div></div>' +

      '<div class="grid cols-4" style="margin-bottom:16px">' +
      L.ui.stat('数量', L.ui.esc(a.quantity || '—') + ' ' + L.ui.esc(a.unit || ''), '', 'i-box', 'primary') +
      L.ui.stat('关联项目', linked.length, '通过项目关联表统计', 'i-projects', 'teal') +
      L.ui.stat('使用状态', L.ui.esc(a.status || '未设置'), '', 'i-check', 'green') +
      L.ui.stat('单价（元）', a.unitPrice ? Number(a.unitPrice).toLocaleString('zh-CN') : '待登记', '', 'i-tag', 'amber') + '</div>' +

      '<div class="grid cols-2"><section class="card"><div class="card-head"><h2>基本信息</h2></div><div class="card-pad"><dl class="kv">' +
      '<dt>资产编号</dt><dd>' + L.ui.esc(a.assetNo || '—') + '</dd><dt>类别</dt><dd>' + L.ui.badge(a.category || '未分类', 'blue') + '</dd>' +
      '<dt>规格 / 型号</dt><dd>' + L.ui.esc(a.spec || '—') + '</dd><dt>数量</dt><dd>' + L.ui.esc(a.quantity || '—') + ' ' + L.ui.esc(a.unit || '') + '</dd>' +
      '<dt>采购日期</dt><dd>' + L.ui.esc(a.purchaseDate || '待登记') + '</dd><dt>经费来源</dt><dd>' + L.ui.esc(a.budgetSource || '—') + '</dd>' +
      '<dt>供应商</dt><dd>' + L.ui.esc(a.supplier || '—') + '</dd><dt>存放位置</dt><dd>' + L.ui.esc(a.location || '—') + '</dd>' +
      '<dt>负责人 / 保管人</dt><dd>' + (owner ? '<a data-nav="#/members/' + owner.id + '">' + L.ui.esc(owner.name) + '</a>' : '未指定') + '</dd>' +
      '<dt>标签</dt><dd>' + (L.ui.tags(a.tags) || '—') + '</dd></dl>' +
      (a.notes ? '<div class="divider"></div><div class="small muted">' + L.ui.esc(a.notes) + '</div>' : '') + '</div></section>' +

      '<section class="card"><div class="card-head"><h2>关联项目</h2><div class="right"><button class="btn sm" data-action="new" data-entity="assetProjects" data-defaults=\'{"assetId":"' + id + '"}\'><svg class="icon"><use href="#i-plus"/></svg>添加关联</button></div></div>' +
      (linked.length ? linked.map(function (x) {
        return '<div class="list-item"><div class="spread"><div><a class="link-title" data-nav="#/projects/' + x.project.id + '">' + L.ui.esc(x.project.name) + '</a>' +
          '<div class="small faint">' + L.ui.esc(x.rel.purpose || '') + '</div></div><div class="row">' + L.ui.status(x.project.status) +
          '<button class="icon-btn" data-action="edit" data-entity="assetProjects" data-id="' + x.rel.id + '" title="编辑用途"><svg class="icon"><use href="#i-edit"/></svg></button>' +
          '<button class="icon-btn" data-action="delete" data-entity="assetProjects" data-id="' + x.rel.id + '" title="移除关联"><svg class="icon"><use href="#i-trash"/></svg></button></div></div></div>';
      }).join('') : L.ui.empty('还没有关联项目', '把这件物品登记到具体项目中')) + '</section></div>' +

      '<section class="card" style="margin-top:16px"><div class="card-head"><h2>流转轨迹</h2><div class="right"><button class="btn sm" data-action="new" data-entity="assetFlows" data-defaults=\'{"assetId":"' + id + '"}\'><svg class="icon"><use href="#i-plus"/></svg>登记流转</button></div></div>' +
      (flows.length ? '<div class="table-wrap"><table><thead><tr><th>时间</th><th>类型</th><th>经办人</th><th>位置变化</th><th>数量</th><th>关联项目</th><th>状态</th><th style="width:70px">操作</th></tr></thead><tbody>' + flows.map(function (x) {
        return '<tr><td class="small">' + L.ui.esc(L.ui.fmtDate(x.rec.at)) + '</td><td>' + L.ui.badge(x.rec.type || '流转', 'violet') + '</td>' +
          '<td>' + L.ui.esc(L.store.name('members', x.rec.memberId)) + '</td>' +
          '<td class="small">' + L.ui.esc(x.from ? x.from.name : '—') + ' → ' + L.ui.esc(x.to ? x.to.name : '—') + '</td>' +
          '<td class="small">' + L.ui.esc(x.rec.quantity || '—') + '</td>' +
          '<td class="small">' + L.ui.esc(x.project ? x.project.name : '—') + '</td><td>' + L.ui.status(x.rec.status) + '</td>' +
          '<td><button class="icon-btn" data-action="edit" data-entity="assetFlows" data-id="' + x.rec.id + '" title="编辑"><svg class="icon"><use href="#i-edit"/></svg></button>' +
          '<button class="icon-btn" data-action="delete" data-entity="assetFlows" data-id="' + x.rec.id + '" title="删除"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
      }).join('') + '</tbody></table></div>' : L.ui.empty('还没有流转记录', '登记领用、归还或位置转移')) + '</section>';
  }
})(window.LabApp = window.LabApp || {});
