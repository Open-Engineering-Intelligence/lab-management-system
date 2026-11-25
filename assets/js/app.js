/* 应用入口：路由、导航、全局操作与搜索 */
(function (L) {
  'use strict';

  var NAV = [
    { key: 'dashboard', label: '总览', icon: 'i-home', hash: '#/dashboard' },
    { key: 'groups', label: '课题组', icon: 'i-groups', hash: '#/groups', count: 'groups' },
    { key: 'members', label: '成员', icon: 'i-users', hash: '#/members', count: 'members' },
    { key: 'projects', label: '项目', icon: 'i-projects', hash: '#/projects', count: 'projects' },
    { key: 'assets', label: '资产物品', icon: 'i-box', hash: '#/assets', count: 'assets' },
    { key: 'access', label: '人员进出', icon: 'i-door', hash: '#/access', count: 'accessRecords' },
    { key: 'logistics', label: '物品流转', icon: 'i-swap', hash: '#/logistics', count: 'assetFlows' },
    { key: 'notices', label: '信息公告', icon: 'i-megaphone', hash: '#/notices', count: 'notices' },
    { key: 'flow', label: '三流交叉', icon: 'i-network', hash: '#/flow' },
    { key: 'switcher', label: '三流开关', icon: 'i-eye', hash: '#/switcher' },
    { key: 'relations', label: '关系视图', icon: 'i-network', hash: '#/relations' },
    { key: 'hub', label: '信息广场', icon: 'i-chat', hash: '#/hub', count: 'posts' },
    { key: 'account', label: '账号中心', icon: 'i-shield', hash: '#/account' },
    { key: 'wx-bind', label: '微信登录与绑定', icon: 'i-shield', hash: '#/wx-bind', cloud: true },
    { key: 'qr', label: '扫码进站', icon: 'i-qr', hash: '#/qr', cloud: true },
    { key: 'checkin', label: '进站登记', icon: 'i-door', hash: '#/checkin', cloud: true },
    { key: 'accounts', label: '账号审核台', icon: 'i-check', hash: '#/accounts', admin: true },
    { key: 'settings', label: '设置', icon: 'i-settings', hash: '#/settings', admin: true }
  ];

  function parseHash() {
    var raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = raw.split('?');
    var seg = parts[0].split('/').filter(Boolean);
    var params = { id: seg[1] || '' };
    (parts[1] || '').split('&').filter(Boolean).forEach(function (kv) {
      var p = kv.split('=');
      params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    });
    return { key: seg[0] || 'dashboard', id: seg[1] || '', params: params };
  }

  var app = {
    current: null,

    init: function () {
      L.store.init();
      L.auth.init();
      this.renderNav();
      this.renderUser();
      this.bindGlobal();
      window.addEventListener('hashchange', this.refresh.bind(this));
      if (!location.hash) {
        var wantCheckin = false;
        try { wantCheckin = new URL(location.href).searchParams.get('checkin') === '1'; } catch (e) {}
        var guest = !L.auth.isLoggedIn() && !(L.cloud && L.cloud.isSignedIn && L.cloud.isSignedIn());
        location.hash = wantCheckin ? '#/checkin' : (guest ? '#/login' : '#/dashboard');
      }
      this.refresh();
    },

    renderNav: function () {
      var route = parseHash();
      var html = '<div class="nav-label">工作台</div>';
      var labels = { groups: '资源管理', access: '三流管理', relations: '协作与配置' };
      NAV.forEach(function (n) {
        if (n.admin && !L.auth.isAdmin()) return;
        if (n.cloud && !(L.cloud && L.cloud.available && L.cloud.available())) return;
        if (labels[n.key]) html += '<div class="nav-label">' + labels[n.key] + '</div>';
        var count = n.count ? L.store.all(n.count).length : '';
        html += '<div class="nav-item ' + (route.key === n.key ? 'active' : '') + '" data-nav="' + n.hash + '"><svg class="icon"><use href="#' + n.icon + '"/></svg>' + n.label +
          (count !== '' ? '<span class="nav-count">' + count + '</span>' : '') + '</div>';
      });
      document.getElementById('nav').innerHTML = html;
    },

    renderUser: function () {
      var a = L.auth.current();
      var chip = document.getElementById('userChip');
      if (!chip) return;
      var badge = document.getElementById('roleBadge');
      if (badge) {
        var admin = L.auth.isAdmin();
        badge.textContent = a ? L.auth.labelRole(a.role) : '未登录';
        badge.className = 'role-badge ' + (admin ? 'admin' : 'user');
        badge.title = admin ? '管理员：可修改并保存内容、管理账号与配置' : '普通用户：可浏览和实名发言，不能修改或管理';
      }
      var quick = document.querySelector('[data-action="quick-add"]');
      if (quick && !L.auth.isAdmin()) quick.style.display = 'none';
      if (a) {
        chip.textContent = a.displayName.slice(-2);
        chip.title = '当前账号：' + a.displayName + ' · ' + L.auth.labelRole(a.role) + (L.auth.canPost() ? '（已实名）' : '（未实名，点击完善）');
        chip.style.background = '';
      } else {
        chip.textContent = '登录';
        chip.title = '尚未登录（点击登录并实名发言）';
        chip.style.background = 'var(--primary)';
        chip.style.color = '#fff';
      }
    },

    refresh: function () {
      var route = parseHash();
      /* 认证界面一律全屏：未登录访客，或正处于登录页（含已登录用户误入）——都不显示侧栏与顶栏。
         wx-bind 路由保留给微信扫码回调，避免打断绑定流程。 */
      var guest = !L.auth.isLoggedIn() && !(L.cloud && L.cloud.isSignedIn && L.cloud.isSignedIn());
      /* 进站登记与微信绑定对访客开放，扫码进入时不被强制跳登录页 */
      var publicRoute = route.key === 'wx-bind' || route.key === 'checkin';
      var forceLogin = guest && !publicRoute;
      var authScreen = guest || route.key === 'login';
      document.body.classList.toggle('auth-mode', authScreen);
      var view = forceLogin ? L.views.login : (L.views[route.key] || L.views.dashboard);
      this.current = forceLogin ? { key: 'login', id: '', params: {} } : route;
      document.getElementById('crumb').textContent = view.title + (route.id ? ' / 详情' : '');
      var root = document.getElementById('view');
      var gate = L.auth.guardRoute('#/' + route.key);
      if (!gate.ok) {
        root.innerHTML = '<div class="page-head"><div><h1>无访问权限</h1><p>该页面仅管理员可访问。</p></div></div>' +
          '<section class="card card-pad" style="max-width:560px">' + L.ui.badge('普通用户 · 只读', 'amber') +
          '<p class="small muted" style="margin:14px 0">' + L.ui.esc(gate.error) + '</p>' +
          '<button class="btn primary" data-nav="#/dashboard">返回总览</button></section>';
      } else {
        root.innerHTML = view.render(route.params);
        if (view.mount) view.mount(root, route.params);
        this.applyPermissions(root);
      }
      this.renderNav();
      this.renderUser();
      window.scrollTo({ top: 0, behavior: 'instant' });
    },

    /* 界面层：普通用户看不到任何修改/管理按钮，避免误点 */
    applyPermissions: function (root) {
      if (!root || L.auth.isAdmin()) return;
      Array.prototype.forEach.call(root.querySelectorAll('[data-action]'), function (el) {
        var g = L.auth.guard(el.dataset.action, el.dataset.entity);
        if (!g.ok) { el.setAttribute('data-denied', '1'); el.style.display = 'none'; }
      });
      Array.prototype.forEach.call(root.querySelectorAll('[data-nav]'), function (el) {
        if (!L.auth.guardRoute(el.dataset.nav).ok) { el.setAttribute('data-denied', '1'); el.style.display = 'none'; }
      });
    },

    closeModal: function () { var r = document.getElementById('modalRoot'); if (r) r.innerHTML = ''; },

    bindGlobal: function () {
      var self = this;

      document.addEventListener('click', function (e) {
        var nav = e.target.closest('[data-nav],a[href^="#/"]');
        if (nav) {
          var target = nav.dataset.nav || nav.getAttribute('href');
          var navGate = L.auth.guardRoute(target);
          if (!navGate.ok) { L.ui.toast(navGate.error, true); return; }
          self.closeModal();
          if (location.hash === target) self.refresh(); else location.hash = target;
          document.getElementById('sidebar').classList.remove('open');
          return;
        }
        var el = e.target.closest('[data-action]');
        if (!el) return;
        var action = el.dataset.action;
        var entity = el.dataset.entity;
        var id = el.dataset.id;
        var actionGate = L.auth.guard(action, entity);
        if (!actionGate.ok) { L.ui.toast(actionGate.error, true); return; }
        var defaults = {};
        try { defaults = el.dataset.defaults ? JSON.parse(el.dataset.defaults) : {}; } catch (err) { defaults = {}; }

        if (action === 'auth-logout') {
          L.auth.logout();
          L.ui.toast('已退出登录');
          if (location.hash !== '#/login') location.hash = '#/login'; else self.refresh();
          return;
        }
        if (action === 'clear-account-filter') { L.views.accounts.filters = { status: '', q: '' }; self.refresh(); }
        if (action === 'pm-add') {
          var projectId = el.dataset.project || id;
          var selected = [];
          document.querySelectorAll('#pmCandidates input[data-member]:checked').forEach(function (c) { selected.push(c.dataset.member); });
          if (!selected.length) { L.ui.toast('请先勾选要加入的成员', true); return; }
          L.ui.modal({
            title: '加入项目成员',
            body: '<div class="stack">' +
              '<div class="schema-note">将把选中的 <b>' + selected.length + '</b> 位成员加入本项目；已在本项目中的成员会被自动跳过。</div>' +
              '<div class="field"><label>项目角色</label><select id="pmRole">' + (L.schema.options.PROJECT_ROLE || []).map(function (r) { return '<option value="' + L.ui.esc(r) + '"' + (r === '一般参与' ? ' selected' : '') + '>' + L.ui.esc(r) + '</option>'; }).join('') + '</select></div></div>',
            okText: '确认加入',
            onOk: function (root) {
              var role = root.querySelector('#pmRole').value;
              var res = L.store.addProjectMembers(projectId, selected, role);
              if (!res.ok) { L.ui.toast((res.error || '加入失败'), true); return; }
              L.ui.toast('已加入 ' + res.added + ' 位成员' + (res.skipped ? '，跳过 ' + res.skipped + ' 位（已在本项目）' : ''));
              self.refresh();
            }
          });
          return;
        }
        if (action === 'pm-remove') {
          var projectId2 = el.dataset.project;
          var memberId = el.dataset.member;
          var memName = L.store.name('members', memberId);
          L.ui.confirm('确定从本项目移除「' + memName + '」吗？只解除本项目的参与关系，不会删除成员档案或其他项目中的关系。', function () {
            var res = L.store.removeProjectMember(projectId2, memberId);
            if (!res.ok) { L.ui.toast((res.error || '移除失败'), true); return; }
            L.ui.toast('已从本项目移除：' + memName);
            self.refresh();
          });
          return;
        }
        if (action === 'quick-add') return self.quickAdd();
        if (action === 'new') {
          if (entity === 'posts' && !L.auth.canPost()) { L.ui.toast(L.auth.postBlockReason(), true); return; }
          return self.openForm(entity, null, defaults);
        }
        if (action === 'edit') {
          if (entity === 'posts' && !L.auth.canManage(L.store.find(entity, id))) { L.ui.toast('只能编辑本人实名发布的讨论', true); return; }
          return self.openForm(entity, L.store.find(entity, id));
        }
        if (action === 'delete') {
          var label = (L.schema.entities[entity] || {}).singular || '记录';
          if (entity === 'posts' && !L.auth.canManage(L.store.find(entity, id))) { L.ui.toast('只能删除本人实名发布的讨论', true); return; }
          var doDelete = function () {
            L.store.remove(entity, id);
            L.ui.toast('已删除');
            var back = ({ groups: '#/groups', members: '#/members', projects: '#/projects', tasks: '#/projects', assets: '#/assets', posts: '#/hub', resources: '#/hub', projectMembers: '#/members', projectGroups: '#/relations', projectLinks: '#/relations', assetProjects: '#/assets', locations: '#/access', permissions: '#/access', accessRecords: '#/access', assetFlows: '#/logistics', notices: '#/notices', noticeReceipts: '#/notices' })[entity] || '#/dashboard';
            if (location.hash.indexOf('/' + id) >= 0) location.hash = back;
            else self.refresh();
          };
          if (entity === 'members') {
            var mem = L.store.find('members', id);
            var mi = L.store.memberImpact(id);
            var miParts = [];
            if (mi.lead) miParts.push('牵头项目 ' + mi.lead);
            if (mi.joined) miParts.push('参与项目 ' + mi.joined);
            if (mi.assets) miParts.push('保管资产 ' + mi.assets);
            if (mi.tasks) miParts.push('负责任务 ' + mi.tasks);
            if (mi.access) miParts.push('进出 ' + mi.access);
            if (mi.flows) miParts.push('流转 ' + mi.flows);
            if (mi.notices) miParts.push('信息 ' + mi.notices);
            if (mi.posts) miParts.push('讨论 ' + mi.posts);
            var miDetail = miParts.length ? '该成员关联的 ' + miParts.join('、') + ' 记录会被清理/解除。' : '该成员暂无其他关联数据。';
            L.ui.confirm('确定「彻底删除」成员「' + (mem ? mem.name : id) + '」吗？' + miDetail + '不可撤销。若只是成员毕业或离开，建议使用「标记离组」以保留历史记录。', doDelete);
            return;
          }
          if (entity === 'projects') {
            var p = L.store.find('projects', id);
            var im = L.store.projectImpact(id);
            var parts = [];
            if (im.tasks) parts.push('任务 ' + im.tasks);
            if (im.members) parts.push('成员关联 ' + im.members);
            if (im.groups) parts.push('组别关联 ' + im.groups);
            if (im.assets) parts.push('物品关联 ' + im.assets);
            if (im.posts) parts.push('讨论 ' + im.posts);
            if (im.resources) parts.push('资料 ' + im.resources);
            if (im.flows) parts.push('三流记录 ' + im.flows);
            if (im.notices) parts.push('信息 ' + im.notices + '（含触达 ' + im.receipts + '）');
            if (im.links) parts.push('项目关联 ' + im.links);
            var detail = parts.length ? '该项目下的 ' + parts.join('、') + ' 将一并清理。' : '该项目暂无其他关联数据。';
            L.ui.confirm('确定删除项目「' + (p ? p.name : id) + '」吗？' + detail + '此操作只影响该项目，不会删除其他项目、成员或物品本身，且不可撤销。', doDelete);
            return;
          }
          return L.ui.confirm('确定删除这条' + label + '吗？相关关联数据也会一并清理。', doDelete);
        }
        if (action === 'mark-left') {
          var mm = L.store.find('members', id);
          if (!mm) return;
          var im = L.store.memberImpact(id);
          var keep = [];
          if (im.lead) keep.push('牵头项目 ' + im.lead);
          if (im.joined) keep.push('参与项目 ' + im.joined);
          if (im.assets) keep.push('保管资产 ' + im.assets);
          if (im.tasks) keep.push('负责任务 ' + im.tasks);
          if (im.access || im.flows || im.notices || im.posts) keep.push('三流/交流记录 ' + (im.access + im.flows + im.notices + im.posts));
          L.ui.modal({
            title: '标记成员离组 · ' + mm.name,
            body: '<div class="stack">' +
              '<div class="schema-note">离组仅做标记，<b>不会删除任何数据</b>。该成员将从「在组」列表移出，并在「已离组」中可查；以上历史记录完整保留，随时可恢复。' + (keep.length ? '<br>将保留：' + L.ui.esc(keep.join('、')) + '。' : '') + '</div>' +
              '<div class="field"><label>离组日期</label><input type="date" id="mkLeftAt" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
              '<div class="field"><label>离组说明（选填）</label><input type="text" id="mkLeftNote" placeholder="如：毕业 / 交换结束 / 转组"></div>' +
              '<div class="field"><label>离组后状态</label><input type="text" value="毕业（自动设为毕业，可在编辑资料中修改）" disabled style="color:var(--muted)"></div>' +
              '</div>',
            okText: '确认离组',
            onOk: function (root) {
              var at = root.querySelector('#mkLeftAt').value;
              var note = root.querySelector('#mkLeftNote').value.trim();
              L.store.markLeft(id, at, note);
              L.ui.toast('已标记离组：' + mm.name + '（历史记录已保留）');
              self.refresh();
            }
          });
          return;
        }
        if (action === 'restore-member') {
          var rm = L.store.find('members', id);
          if (!rm) return;
          L.ui.confirm('确定将「' + rm.name + '」恢复为在组成员吗？历史记录不会改变。', function () {
            L.store.restoreMember(id);
            L.ui.toast('已恢复在组：' + rm.name);
            self.refresh();
          }, '确认恢复', 'primary');
          return;
        }
        if (action === 'refresh-progress') {
          var res = L.store.refreshProjectProgress(id);
          if (res) {
            L.ui.toast('进度已刷新：' + res.progress + '%（' + res.stats.done + '/' + res.stats.total + ' 项任务完成）');
            self.refresh();
          }
          return;
        }
        if (action === 'toggle-pin') {
          var post = L.store.find('posts', id);
          if (post) { L.store.update('posts', id, { pinned: !post.pinned }); self.refresh(); }
        }
        if (action === 'clear-member-filter') { L.views.members.filters = { membership: 'active', groupId: '', status: '', q: '' }; self.refresh(); }
        if (action === 'clear-project-filter') { L.views.projects.filters = { status: '', groupId: '', q: '' }; self.refresh(); }
        if (action === 'clear-asset-filter') { L.views.assets.filters = { category: '', status: '', custodianId: '', q: '' }; self.refresh(); }
        if (action === 'clear-access-filter') { L.views.access.filters = { memberId: '', locationId: '', direction: '', result: '', from: '', to: '', q: '' }; self.refresh(); }
        if (action === 'clear-perm-filter') { L.views.access.permFilters = { memberId: '', locationId: '', level: '' }; self.refresh(); }
        if (action === 'clear-flow-filter') { L.views.logistics.filters = { assetId: '', memberId: '', type: '', status: '', locationId: '', from: '', to: '', q: '' }; self.refresh(); }
        if (action === 'clear-notice-filter') { L.views.notices.filters = { category: '', priority: '', status: '', q: '' }; self.refresh(); }
        if (action === 'clear-receipt-filter') { L.views.notices.receiptFilters = { noticeId: '', memberId: '', status: '' }; self.refresh(); }
        if (action === 'clear-flow-cross-filter') { L.views.flow.filters = { kind: '', memberId: '', assetId: '', locationId: '', projectId: '', from: '', to: '', q: '' }; self.refresh(); }
      });

      var search = document.getElementById('globalSearch');
      var panel = document.getElementById('searchPanel');
      search.addEventListener('input', function () {
        var results = L.store.search(search.value);
        if (!search.value.trim()) { panel.classList.remove('show'); panel.innerHTML = ''; return; }
        var grouped = {};
        results.forEach(function (r) { (grouped[r.label] = grouped[r.label] || []).push(r); });
        panel.innerHTML = Object.keys(grouped).map(function (label) {
          return '<div class="search-group">' + label + '</div>' + grouped[label].map(function (r) {
            var href = r.href || (r.entity === 'resources' ? '#/hub' : r.entity === 'tasks' ? '#/projects/' + r.projectId : '#/' + ({ groups: 'groups', members: 'members', projects: 'projects', assets: 'assets' }[r.entity] || r.entity + 's') + '/' + r.id);
            return '<div class="search-row" data-nav="' + href + '"><svg class="icon" style="color:var(--primary)"><use href="#' + (L.schema.entities[r.entity] || {}).icon + '"/></svg><span>' + L.ui.esc(r.title) + '</span><span class="sr-meta">' + L.ui.esc(r.sub) + '</span></div>';
          }).join('');
        }).join('') || '<div class="search-row muted">没有找到匹配内容</div>';
        panel.classList.add('show');
      });
      search.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.classList.remove('show'); });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.search-wrap')) panel.classList.remove('show');
      });

      var menu = document.getElementById('menuBtn');
      if (menu) menu.onclick = function () { document.getElementById('sidebar').classList.toggle('open'); };
      var chip = document.getElementById('userChip');
      if (chip) chip.onclick = function () { location.hash = L.auth.isLoggedIn() ? '#/account' : '#/login'; };
    },

    openForm: function (entity, data, defaults) {
      if (!L.schema.entities[entity]) return L.ui.toast('未知的数据实体：' + entity, true);
      var gate = L.auth.guard('new', entity);
      if (!gate.ok) return L.ui.toast(gate.error, true);
      L.ui.formModal({
        entity: entity,
        data: data,
        defaults: defaults,
        onSave: function (values) {
          var saved;
          if (entity === 'posts' && !data) {
            if (!L.auth.canPost()) { L.ui.toast(L.auth.postBlockReason(), true); return; }
            values = Object.assign(values, L.auth.stamp());
          }
          if (data) { saved = L.store.update(entity, data.id, values); L.ui.toast('已保存修改'); }
          else { saved = L.store.insert(entity, values); L.ui.toast('已创建' + L.schema.entityLabel(entity)); }
          L.app.refresh();
          if (!data && ['groups', 'members', 'projects', 'assets', 'notices'].indexOf(entity) >= 0 && saved) location.hash = '#/' + entity + '/' + saved.id;
        }
      });
    },

    quickAdd: function () {
      if (!L.auth.isAdmin()) return L.ui.toast(L.auth.denyReason(), true);
      var items = [['projects', '新建项目', 'i-projects'], ['tasks', '新建任务', 'i-check'], ['assets', '登记资产', 'i-box'], ['members', '添加成员', 'i-users'], ['groups', '新建课题组', 'i-groups'], ['accessRecords', '登记进出', 'i-door'], ['assetFlows', '登记物品流转', 'i-swap'], ['notices', '发布信息', 'i-megaphone'], ['noticeReceipts', '登记查阅', 'i-eye'], ['locations', '新增场所', 'i-location'], ['permissions', '配置权限', 'i-shield'], ['posts', '发起实名讨论', 'i-chat']];
      items = items.concat([['resources', '登记资料', 'i-folder'], ['projectLinks', '登记项目关联', 'i-link'], ['assetProjects', '资产关联项目', 'i-link']]);
      var modal = L.ui.modal({
        title: '快速创建', okText: '关闭', cancelText: '关闭',
        body: '<div class="grid cols-2">' + items.map(function (x) {
          return '<button class="btn" style="justify-content:flex-start;padding:14px" data-quick="' + x[0] + '"><svg class="icon" style="color:var(--primary)"><use href="#' + x[2] + '"/></svg>' + x[1] + '</button>';
        }).join('') + '</div>',
        onOk: function () {}
      });
      modal.querySelectorAll('[data-quick]').forEach(function (b) {
        b.onclick = function () {
          L.app.closeModal();
          var uid = L.store.state.settings.currentUserId;
          var defaults = { posts: { authorId: uid }, resources: { uploaderId: uid }, notices: { authorId: uid }, accessRecords: { memberId: uid }, assetFlows: { memberId: uid }, noticeReceipts: { memberId: uid } }[b.dataset.quick] || {};
          L.app.openForm(b.dataset.quick, null, defaults);
        };
      });
    }
  };

  L.app = app;

  function bootstrap() {
    /* 微信回调必须在路由守卫之前处理（code 单次有效） */
    if (L.cloud && L.cloud.available && L.cloud.available()) {
      L.cloud.restoreAuth().then(function (res) {
        app.init();
        /* 微信授权成功（新登录或刷新恢复）后，先把云端身份关联到本地账号并建立会话，
           再决定跳转。必须先关联，否则本地仍是访客态、路由守卫会把用户踢回登录页。 */
        var authed = res && (res.state === 'signed-in' || res.state === 'restored');
        if (authed && L.auth.linkWechat) {
          var sess = (res.session || (L.cloud.session && L.cloud.session()));
          L.auth.linkWechat(sess).then(function (link) {
            if (link && link.needManual) {
              L.ui.toast(link.error || '请联系管理员关联系统账号', true);
              return;
            }
            consumeCheckinParam(); /* 从进站码发起登录时清除残留参数，避免刷新重复跳转 */
            if (res.state === 'signed-in') {
              L.ui.toast('微信登录成功' + (link && link.via === 'created' ? '，已自动关联系统账号' : ''));
              if (location.hash === '#/login' || !location.hash) location.hash = '#/wx-bind';
              else L.app.refresh();
            } else {
              /* restored：刷新后云端会话恢复、本地账号已关联登录，停留在原页面并刷新视角 */
              L.app.refresh();
            }
          }).catch(function (e) {
            L.ui.toast('账号关联失败：' + ((e && e.message) || '未知错误'), true);
          });
        } else if (res && res.state === 'error') {
          L.ui.toast(res.error || '微信登录失败', true);
        } else if (consumeCheckinParam()) {
          /* 进站二维码扫码进入：跳到轻量进站登记页 */
          location.hash = '#/checkin';
        } else if (L.cloud.consumeAutoLogin && L.cloud.consumeAutoLogin()) {
          /* 旧二维码残留的 autologin 参数：保留兼容，不再由新码产生 */
          L.cloud.signInWithWechat().catch(function (e) {
            L.ui.toast(e.message || '微信登录失败', true);
          });
        }
      });
    } else {
      if (consumeCheckinParam()) location.hash = '#/checkin';
      app.init();
    }
  }

  /* 消费进站二维码参数 checkin=1：清除参数防止刷新时重复跳转 */
  function consumeCheckinParam() {
    var u;
    try { u = new URL(location.href); } catch (e) { return false; }
    if (u.searchParams.get('checkin') !== '1') return false;
    if (u.searchParams.has('code') || u.searchParams.has('provider')) return false;
    u.searchParams.delete('checkin');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    return true;
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})(window.LabApp = window.LabApp || {});
