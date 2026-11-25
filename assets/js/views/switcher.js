/* 三流开关面板：人流/物流/信息流三个独立开关，初始全隐藏，点击切换显示，展示真实三流数据 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  var DEFS = [
    { key: 'people', label: '人流', icon: 'i-door', color: '#185FA5', badge: 'blue',
      kind: '人流', desc: '记录人员的进入、离开与在场状态，以及场所与权限信息。',
      stats: 'accessRecords', statLabel: '进出记录', nav: '#/access', navLabel: '人员进出' },
    { key: 'goods', label: '物流', icon: 'i-swap', color: '#BA7517', badge: 'amber',
      kind: '物流', desc: '记录物品的领用、归还与位置流转，体现物品在场所间的移动。',
      stats: 'assetFlows', statLabel: '流转记录', nav: '#/logistics', navLabel: '物品流转' },
    { key: 'info', label: '信息流', icon: 'i-megaphone', color: '#534AB7', badge: 'violet',
      kind: '信息流', desc: '记录通知发布、送达与查阅触达，展示信息从发布方传向接收方。',
      stats: 'notices', statLabel: '信息记录', nav: '#/notices', navLabel: '信息公告' }
  ];

  function shownCount() {
    return DEFS.filter(function (d) { return L.views.switcher.show[d.key]; }).length;
  }

  function cardHtml(d) {
    var on = L.views.switcher.show[d.key];
    return '<div class="sw-card ' + (on ? 'on' : '') + '" data-sw="' + d.key + '" aria-pressed="' + on + '" role="button" tabindex="0">' +
      '<i class="sw-dot-lg" style="background:' + d.color + '"></i>' +
      '<div><div class="sw-label">' + d.label + '</div><div class="sw-sub">' + d.statLabel + ' · 点击切换显示</div></div>' +
      '<i class="sw-track"></i></div>';
  }

  function panelHtml(d, stat, events) {
    var on = L.views.switcher.show[d.key];
    var rows = events.length ? events.slice(0, 5).map(function (e) {
      return '<div class="sw-row"><span class="t">' + L.ui.esc(e.title) + '</span><span class="d">' + L.ui.esc(e.detail || e.personName || '') + '</span></div>';
    }).join('') : '<div class="sw-row muted">暂无记录</div>';
    return '<section class="card sw-panel" data-panel="' + d.key + '"' + (on ? '' : ' hidden') + '>' +
      '<div class="card-head"><div class="ph"><i class="sw-dot-lg" style="background:' + d.color + '"></i><h2>' + d.label + '</h2></div>' +
      '<div class="right"><span class="badge ' + d.badge + '">' + stat + ' 条</span></div></div>' +
      '<div class="card-pad">' +
      '<p style="margin:0 0 12px;color:var(--muted);font-size:13px;line-height:1.6">' + d.desc + '</p>' +
      L.ui.stat(d.statLabel, stat, '当前累计', d.icon, d.badge) +
      '<div class="small muted" style="margin:16px 0 2px">最近记录</div>' +
      rows +
      '<div style="margin-top:14px"><button class="btn sm" data-nav="' + d.nav + '">进入' + d.navLabel + '</button></div>' +
      '</div></section>';
  }

  L.views.switcher = {
    title: '三流开关面板',
    show: { people: false, goods: false, info: false },

    render: function () {
      var stats = L.store.flowStats();
      var counts = { people: stats.people, goods: stats.goods, info: stats.info };
      var events = L.store.flowEvents({});
      var n = shownCount();

      return '<div class="page-head"><div><h1>三流开关面板</h1>' +
        '<p>人流、物流、信息流三个开关相互独立：点击显示对应内容，再次点击隐藏。可任意组合；三项同时开启时并排展示，互不重叠。</p></div>' +
        '<div class="head-actions"><span class="small muted" id="swStatus">当前显示 ' + n + ' / 3 组内容</span></div></div>' +

        '<div class="sw-grid">' + DEFS.map(cardHtml).join('') + '</div>' +
        '<div class="sw-panels">' + DEFS.map(function (d) {
          return panelHtml(d, counts[d.key], events.filter(function (e) { return e.kind === d.kind; }));
        }).join('') + '</div>' +
        '<div class="sw-empty" id="swEmpty"' + (n ? ' hidden' : '') + '>三项内容均已隐藏，点击上方开关进行切换</div>';
    },

    mount: function (root) {
      var self = this;
      var stats = L.store.flowStats();
      var counts = { people: stats.people, goods: stats.goods, info: stats.info };

      function apply() {
        DEFS.forEach(function (d) {
          var on = self.show[d.key];
          var card = root.querySelector('[data-sw="' + d.key + '"]');
          if (card) { card.classList.toggle('on', on); card.setAttribute('aria-pressed', String(on)); }
          var panel = root.querySelector('[data-panel="' + d.key + '"]');
          if (panel) panel.hidden = !on;
        });
        var n = shownCount();
        var status = root.querySelector('#swStatus');
        if (status) status.textContent = '当前显示 ' + n + ' / 3 组内容';
        var empty = root.querySelector('#swEmpty');
        if (empty) empty.hidden = n > 0;
      }

      function toggle(key) {
        self.show[key] = !self.show[key];
        apply();
      }

      root.querySelectorAll('[data-sw]').forEach(function (card) {
        card.addEventListener('click', function () { toggle(card.getAttribute('data-sw')); });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(card.getAttribute('data-sw')); }
        });
      });
      void counts;
    }
  };
})(window.LabApp = window.LabApp || {});
