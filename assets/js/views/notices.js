/* 信息公告：发布、查阅触达与通知回执（信息流） */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function opts(values, current, allLabel) {
    return '<option value="">' + (allLabel || '全部') + '</option>' + values.map(function (v) {
      return '<option value="' + L.ui.esc(v) + '"' + (current === v ? ' selected' : '') + '>' + L.ui.esc(v) + '</option>';
    }).join('');
  }
  function refOpts(entity, current, allLabel, field) {
    return '<option value="">' + (allLabel || '全部') + '</option>' + L.store.all(entity).map(function (x) {
      return '<option value="' + x.id + '"' + (current === x.id ? ' selected' : '') + '>' + L.ui.esc(x[field || 'name'] || x.title || x.id) + '</option>';
    }).join('');
  }
  function readBar(rate) {
    var n = Math.max(0, Math.min(100, Number(rate) || 0));
    return '<div class="row" style="flex-wrap:nowrap"><div class="progress" style="flex:1"><i style="width:' + n + '%"></i></div><span class="small faint">' + n + '%</span></div>';
  }

  L.views.notices = {
    title: '信息公告',
    tab: 'list',
    filters: { category: '', priority: '', status: '', q: '' },
    receiptFilters: { noticeId: '', memberId: '', status: '' },

    render: function (params) {
      if (params.id) return detail(params.id);
      var self = this, f = this.filters;
      var notices = L.store.all('notices').filter(function (n) {
        if (f.category && n.category !== f.category) return false;
        if (f.priority && n.priority !== f.priority) return false;
        if (f.status && n.status !== f.status) return false;
        if (f.q && [n.title, n.content, n.category, L.store.name('members', n.authorId), L.store.name('locations', n.locationId)].join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      }).sort(function (a, b) { return String(b.publishAt || '').localeCompare(String(a.publishAt || '')); });

      var allNotices = L.store.all('notices');
      var published = allNotices.filter(function (n) { return n.status === '已发布'; }).length;
      var allReceipts = L.store.all('noticeReceipts');
      var unread = allReceipts.filter(function (x) { return x.status === '未读'; }).length;
      var confirm = allReceipts.filter(function (x) { return x.status === '已确认'; }).length;
      var avgRate = allNotices.length ? Math.round(allNotices.reduce(function (s, n) { return s + L.store.noticeStats(n.id).rate; }, 0) / allNotices.length) : 0;

      var body = '';
      if (self.tab === 'list') {
        body = '<div class="toolbar"><div class="field"><label>分类</label><select data-filter="category">' + opts(L.schema.options.NOTICE_CATEGORY, f.category) + '</select></div>' +
          '<div class="field"><label>优先级</label><select data-filter="priority">' + opts(L.schema.options.NOTICE_PRIORITY, f.priority) + '</select></div>' +
          '<div class="field"><label>状态</label><select data-filter="status">' + opts(L.schema.options.NOTICE_STATUS, f.status) + '</select></div>' +
          '<div class="field"><label>关键词</label><input data-filter="q" value="' + L.ui.esc(f.q) + '" placeholder="标题 / 正文 / 发布人"></div>' +
          '<button class="btn sm" data-action="clear-notice-filter">重置筛选</button><span class="small faint" style="margin-left:auto">共 ' + notices.length + ' 条信息</span></div>' +
          '<section class="card"><div class="table-wrap"><table><thead><tr><th>标题</th><th>分类 / 优先级</th><th>发布人</th><th>发布时间</th><th>范围</th><th>关联场所 / 项目</th><th style="width:130px">查阅率</th><th>状态</th><th style="width:70px">操作</th></tr></thead><tbody>' +
          (notices.length ? notices.map(function (n) {
            var st = L.store.noticeStats(n.id);
            return '<tr><td><a class="link-title" data-nav="#/notices/' + n.id + '">' + L.ui.esc(n.title) + '</a><div class="small faint">' + L.ui.esc((n.content || '').slice(0, 30)) + '…</div></td>' +
              '<td>' + L.ui.badge(n.category || '未分类', 'blue') + '<div style="margin-top:3px">' + (n.priority === '紧急' ? L.ui.badge(n.priority, 'rose') : n.priority === '重要' ? L.ui.badge(n.priority, 'amber') : '<span class="small faint">' + L.ui.esc(n.priority || '普通') + '</span>') + '</div></td>' +
              '<td>' + L.ui.esc(L.store.name('members', n.authorId)) + '</td>' +
              '<td class="small">' + L.ui.esc(L.ui.fmtDate(n.publishAt)) + '</td>' +
              '<td class="small">' + L.ui.esc(n.scope || '全体') + '</td>' +
              '<td class="small">' + L.ui.esc(L.store.name('locations', n.locationId)) + (n.projectId ? ' / ' + L.ui.esc(L.store.name('projects', n.projectId)) : '') + '</td>' +
              '<td>' + readBar(st.rate) + '<div class="small faint">' + st.read + '/' + st.total + ' 已查阅</div></td>' +
              '<td>' + L.ui.status(n.status) + '</td>' +
              '<td><button class="icon-btn" title="编辑" data-action="edit" data-entity="notices" data-id="' + n.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
              '<button class="icon-btn" title="删除" data-action="delete" data-entity="notices" data-id="' + n.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
          }).join('') : '<tr><td colspan="9">' + L.ui.empty('没有符合条件的信息', '点击“发布信息”创建第一条公告') + '</td></tr>') + '</tbody></table></div></section>';
      } else {
        var rf = this.receiptFilters;
        var receipts = L.store.all('noticeReceipts').filter(function (x) {
          if (rf.noticeId && x.noticeId !== rf.noticeId) return false;
          if (rf.memberId && x.memberId !== rf.memberId) return false;
          if (rf.status && x.status !== rf.status) return false;
          return true;
        }).sort(function (a, b) { return String(b.deliveredAt || '').localeCompare(String(a.deliveredAt || '')); }).slice(0, 300);
        body = '<div class="toolbar"><div class="field"><label>信息</label><select data-receipt="noticeId">' + refOpts('notices', rf.noticeId, '全部信息', 'title') + '</select></div>' +
          '<div class="field"><label>接收人</label><select data-receipt="memberId">' + refOpts('members', rf.memberId, '全部人员') + '</select></div>' +
          '<div class="field"><label>状态</label><select data-receipt="status">' + opts(L.schema.options.RECEIPT_STATUS, rf.status) + '</select></div>' +
          '<button class="btn sm" data-action="clear-receipt-filter">重置筛选</button><span class="small faint" style="margin-left:auto">显示 ' + receipts.length + ' 条触达记录</span></div>' +
          '<section class="card"><div class="table-wrap"><table><thead><tr><th>接收人</th><th>信息</th><th>渠道</th><th>送达时间</th><th>查阅时间</th><th>查阅地点</th><th>状态</th><th style="width:70px">操作</th></tr></thead><tbody>' +
          (receipts.length ? receipts.map(function (x) {
            return '<tr><td>' + L.ui.person(L.store.find('members', x.memberId)) + '</td>' +
              '<td><a class="link-title" data-nav="#/notices/' + x.noticeId + '">' + L.ui.esc(L.store.name('notices', x.noticeId, 'title')) + '</a></td>' +
              '<td class="small">' + L.ui.esc(x.channel || '—') + '</td>' +
              '<td class="small">' + L.ui.esc(L.ui.fmtDate(x.deliveredAt)) + '</td>' +
              '<td class="small">' + L.ui.esc(x.readAt ? L.ui.fmtDate(x.readAt) : '—') + '</td>' +
              '<td class="small">' + L.ui.esc(L.store.name('locations', x.locationId)) + '</td>' +
              '<td>' + L.ui.status(x.status) + '</td>' +
              '<td><button class="icon-btn" title="编辑" data-action="edit" data-entity="noticeReceipts" data-id="' + x.id + '"><svg class="icon"><use href="#i-edit"/></svg></button>' +
              '<button class="icon-btn" title="删除" data-action="delete" data-entity="noticeReceipts" data-id="' + x.id + '"><svg class="icon"><use href="#i-trash"/></svg></button></td></tr>';
          }).join('') : '<tr><td colspan="8">' + L.ui.empty('没有符合条件的查阅记录') + '</td></tr>') + '</tbody></table></div></section>';
      }

      return '<div class="page-head"><div><h1>信息公告</h1><p>发布通知与安全提示，登记送达与查阅回执；信息可与场所、项目、发布人关联，形成信息流。</p></div>' +
        '<div class="head-actions"><button class="btn" data-action="new" data-entity="noticeReceipts"><svg class="icon"><use href="#i-eye"/></svg>登记查阅</button>' +
        '<button class="btn primary" data-action="new" data-entity="notices" data-defaults=\'{"authorId":"' + L.store.state.settings.currentUserId + '"}\'><svg class="icon"><use href="#i-plus"/></svg>发布信息</button></div></div>' +
        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('已发布信息', published, '当前有效公告', 'i-megaphone', 'primary') +
        L.ui.stat('平均查阅率', avgRate + '%', '按信息统计', 'i-eye', 'teal') +
        L.ui.stat('未读回执', unread, '待提醒查阅', 'i-info', 'amber') +
        L.ui.stat('已确认', confirm, '需确认信息回执', 'i-check', 'green') + '</div>' +
        '<div class="tabs"><div class="tab' + (self.tab === 'list' ? ' active' : '') + '" data-tab="list">信息列表</div>' +
        '<div class="tab' + (self.tab === 'receipts' ? ' active' : '') + '" data-tab="receipts">查阅触达</div></div><div style="height:16px"></div>' + body;
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
      root.querySelectorAll('[data-receipt]').forEach(function (el) {
        el.addEventListener('change', function () { self.receiptFilters[el.dataset.receipt] = el.value.trim(); L.app.refresh(); });
      });
    }
  };

  function detail(id) {
    var n = L.store.find('notices', id);
    if (!n) return '<div class="card">' + L.ui.empty('信息不存在') + '</div>';
    var st = L.store.noticeStats(id);
    var receipts = L.store.noticeReceiptsOf(id);
    return '<div class="page-head"><div><button class="btn ghost sm" data-nav="#/notices">← 返回信息列表</button>' +
      '<h1 style="margin-top:8px">' + L.ui.esc(n.title) + '</h1><p>' + L.ui.esc(n.category || '未分类') + ' · ' + L.ui.esc(L.store.name('members', n.authorId)) + ' 发布于 ' + L.ui.esc(L.ui.fmtDate(n.publishAt)) + '</p></div>' +
      '<div class="head-actions"><button class="btn" data-action="new" data-entity="noticeReceipts" data-defaults=\'{"noticeId":"' + id + '"}\'><svg class="icon"><use href="#i-plus"/></svg>登记查阅</button>' +
      '<button class="btn" data-action="edit" data-entity="notices" data-id="' + id + '"><svg class="icon"><use href="#i-edit"/></svg>编辑</button>' +
      '<button class="btn danger" data-action="delete" data-entity="notices" data-id="' + id + '"><svg class="icon"><use href="#i-trash"/></svg>删除</button></div></div>' +
      '<div class="grid cols-4" style="margin-bottom:16px">' +
      L.ui.stat('送达人数', st.total, '触达回执总数', 'i-users', 'primary') +
      L.ui.stat('已查阅', st.read, '含已确认', 'i-eye', 'teal') +
      L.ui.stat('查阅率', st.rate + '%', '已查阅 / 送达', 'i-check', 'green') +
      L.ui.stat('未读', st.unread, '需继续提醒', 'i-info', 'amber') + '</div>' +
      '<div class="grid cols-2"><section class="card"><div class="card-head"><h2>信息内容</h2></div><div class="card-pad"><dl class="kv">' +
      '<dt>分类</dt><dd>' + L.ui.badge(n.category || '未分类', 'blue') + '</dd><dt>优先级</dt><dd>' + L.ui.status(n.priority) + '</dd>' +
      '<dt>发布范围</dt><dd>' + L.ui.esc(n.scope || '全体') + ' ' + L.ui.esc(n.scopeRef || '') + '</dd>' +
      '<dt>发布人</dt><dd>' + L.ui.esc(L.store.name('members', n.authorId)) + '</dd>' +
      '<dt>关联场所</dt><dd>' + L.ui.esc(L.store.name('locations', n.locationId)) + '</dd>' +
      '<dt>关联项目</dt><dd>' + L.ui.esc(L.store.name('projects', n.projectId)) + '</dd>' +
      '<dt>有效期至</dt><dd>' + L.ui.esc(n.expireAt || '长期') + '</dd>' +
      '<dt>需确认</dt><dd>' + L.ui.esc(n.needConfirm || '否') + '</dd></dl>' +
      '<div class="divider"></div><div class="post-body" style="margin-left:0">' + L.ui.esc(n.content || '') + '</div></div></section>' +
      '<section class="card"><div class="card-head"><h2>查阅回执</h2><div class="right"><span class="small faint">' + st.total + ' 人</span></div></div>' +
      (receipts.length ? receipts.map(function (x) {
        return '<div class="list-item"><div class="spread"><div><b>' + L.ui.esc(L.store.name('members', x.rec.memberId)) + '</b>' +
          '<div class="small faint">' + L.ui.esc(x.rec.channel || '—') + ' · ' + L.ui.esc(x.rec.readAt ? L.ui.fmtDate(x.rec.readAt) : '未查阅') + ' · ' + L.ui.esc(L.store.name('locations', x.rec.locationId)) + '</div></div>' +
          '<div class="row">' + L.ui.status(x.rec.status) +
          '<button class="icon-btn" data-action="edit" data-entity="noticeReceipts" data-id="' + x.rec.id + '" title="编辑"><svg class="icon"><use href="#i-edit"/></svg></button>' +
          '<button class="icon-btn" data-action="delete" data-entity="noticeReceipts" data-id="' + x.rec.id + '" title="删除"><svg class="icon"><use href="#i-trash"/></svg></button></div></div></div>';
      }).join('') : L.ui.empty('还没有查阅回执', '登记查阅记录以统计信息触达情况')) + '</section></div>';
  }
})(window.LabApp = window.LabApp || {});
