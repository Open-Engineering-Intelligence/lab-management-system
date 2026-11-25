/* 账号中心：登录 / 注册、我的账号与实名、管理员审核台 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  /* 账号分组：注册与实名时选择的固定分组，区别于花名册成员来自问卷的课题组 */
  var LAB_GROUPS = ['软件组', '硬件组', '商务组', '其他'];

  function groupOptions(value) {
    return '<option value="">— 未选择 —</option>' + LAB_GROUPS.map(function (g) {
      return '<option value="' + L.ui.esc(g) + '"' + (value === g ? ' selected' : '') + '>' + L.ui.esc(g) + '</option>';
    }).join('');
  }
  /* 展示分组：新数据直接存分组名；兼容旧数据中存的是课题组 id 的情况 */
  function groupLabel(gid) {
    if (!gid) return '—';
    if (LAB_GROUPS.indexOf(gid) >= 0) return gid;
    var g = L.store.find('groups', gid);
    return g ? g.name : gid;
  }

  L.views.login = {
    title: '登录',
    mode: 'login',
    /* 注册页一打开就预分配的账号，同一注册会话内保持稳定 */
    pendingNo: '',
    render: function () {
      if (L.auth.isLoggedIn()) {
        var a = L.auth.current();
        return '<div class="page-head"><div><h1>账号</h1><p>当前已登录，可直接进入账号中心。</p></div></div>' +
          '<section class="card card-pad auth-card"><div class="row" style="gap:12px">' + L.ui.avatar(a.displayName, a.id, 'lg') +
          '<div><div style="font-size:16px;font-weight:500">' + L.ui.esc(a.displayName) + '</div><div class="small muted">@' + L.ui.esc(a.username) + ' · ' + L.ui.esc(L.auth.labelRole(a.role)) + '</div></div></div>' +
          '<div class="row" style="margin-top:20px"><button class="btn primary" data-nav="#/account">进入账号中心</button><button class="btn" data-action="auth-logout">退出登录</button></div></section>';
      }
      var self = this;
      var tabs = [['login', '登录'], ['register', '注册']];
      var body = '';
      if (self.mode === 'login') {
        body = '<div class="stack">' +
          '<div class="field"><label>账号</label><input id="lgUser" autocomplete="username" inputmode="numeric" maxlength="6" placeholder="6 位登录账号"></div>' +
          '<div class="field"><label>密码</label><input id="lgPass" type="password" autocomplete="current-password" placeholder="密码"></div>' +
          '<button class="btn primary" id="lgSubmit">登录</button>' +
          (L.cloud && L.cloud.available && L.cloud.available() ?
            '<button class="btn wx-login-btn" id="lgWx"><span class="wx-dot">微</span>微信扫码登录</button>' : '') +
          '</div>';
      } else {
        /* 打开注册页即生成账号并展示；同一会话内复用，避免切页/刷新后变化 */
        if (!/^\d{6}$/.test(self.pendingNo) || L.auth.findByUsername(self.pendingNo)) self.pendingNo = L.auth.newAccountNo();
        body = '<div class="stack">' +
          '<div class="field"><label>你的账号（系统分配）</label><div class="account-no">' + L.ui.esc(self.pendingNo) + '</div></div>' +
          '<div class="field"><label>真实姓名</label><input id="rgName" placeholder="姓名"></div>' +
          '<div class="field"><label>学号 / 工号</label><input id="rgNo" placeholder="选填"></div>' +
          '<div class="field"><label>分组</label><select id="rgGroup">' + groupOptions('') + '</select></div>' +
          '<div class="field"><label>密码</label><input id="rgPass" type="password" placeholder="至少 6 位"></div>' +
          '<div class="field"><label>确认密码</label><input id="rgPass2" type="password" placeholder="再次输入"></div>' +
          '<button class="btn primary" id="rgSubmit">注册</button>' +
          '</div>';
      }
      return '<section class="card auth-card"><div class="tabs">' + tabs.map(function (t) {
          return '<div class="tab ' + (self.mode === t[0] ? 'active' : '') + '" data-authmode="' + t[0] + '">' + t[1] + '</div>';
        }).join('') + '</div><div class="pane card-pad">' + body + '</div></section>';
    },
    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-authmode]').forEach(function (el) {
        el.onclick = function () { self.mode = el.dataset.authmode; L.app.refresh(); };
      });
      var login = root.querySelector('#lgSubmit');
      if (login) login.onclick = function () {
        var res = L.auth.login(root.querySelector('#lgUser').value, root.querySelector('#lgPass').value);
        if (!res.ok) return L.ui.toast(res.error, true);
        L.ui.toast('登录成功：' + res.account.displayName);
        L.app.refresh();
      };
      var lgWx = root.querySelector('#lgWx');
      if (lgWx) lgWx.onclick = function () {
        L.cloud.signInWithWechat().catch(function (e) { L.ui.toast(e.message || '微信登录失败', true); });
      };
      var reg = root.querySelector('#rgSubmit');
      if (reg) reg.onclick = function () {
        var res = L.auth.register({
          username: self.pendingNo,
          displayName: root.querySelector('#rgName').value,
          studentNo: root.querySelector('#rgNo').value, groupId: root.querySelector('#rgGroup').value,
          password: root.querySelector('#rgPass').value, password2: root.querySelector('#rgPass2').value
        });
        if (!res.ok) return L.ui.toast(res.error, true);
        var assigned = res.account.accountNo;
        self.pendingNo = '';
        L.ui.modal({
          title: '注册成功',
          body: '<div class="account-no-box"><div class="small muted">你的登录账号</div><div class="account-no">' + L.ui.esc(assigned) + '</div></div>',
          okText: '进入账号中心', cancelText: '留在登录页',
          onOk: function (modal, close) { close(); location.hash = '#/account'; }
        });
      };
    }
  };

  L.views.account = {
    title: '我的账号',
    render: function () {
      var a = L.auth.current();
      if (!a) return '<div class="page-head"><div><h1>我的账号</h1><p>请先登录。</p></div></div><section class="card">' +
        L.ui.empty('尚未登录', '登录后查看实名状态与我的发言') + '<div class="card-pad"><button class="btn primary" data-nav="#/login">前往登录</button></div></section>';
      var rn = a.realName || {};
      var verified = !!rn.verified;
      var myPosts = L.auth.myPosts().sort(function (x, y) { return String(y.createdAt).localeCompare(String(x.createdAt)); });
      var statusText = verified ? '已实名认证' : (rn.submittedAt ? '审核中' : '未提交');
      var statusCls = verified ? 'green' : (rn.submittedAt ? 'amber' : '');
      var realBody = verified
        ? '<dl class="kv"><dt>真实姓名</dt><dd>' + L.ui.esc(rn.name) + '</dd><dt>学号 / 工号</dt><dd>' + L.ui.esc(rn.studentNo || '—') + '</dd>' +
          '<dt>分组</dt><dd>' + L.ui.esc(groupLabel(rn.groupId)) + '</dd><dt>职称 / 身份</dt><dd>' + L.ui.esc(rn.title || '—') + '</dd>' +
          '<dt>审核通过</dt><dd>' + L.ui.esc(rn.reviewedAt || '—') + ' · ' + L.ui.esc(rn.reviewedBy || '—') + '</dd></dl>' +
          '<div class="schema-note" style="margin-top:12px">实名信息由管理员核对后确认，发言将以真实姓名展示。如需变更姓名或组别，请在下方重新提交审核。</div>'
        : '<div class="schema-note" style="margin-bottom:14px">' + (rn.rejectReason ? '上次审核未通过：' + L.ui.esc(rn.rejectReason) + '。请核对后重新提交。' : '提交真实姓名与所属组别，管理员通过后方可实名发言。') + '</div>' +
          '<div class="stack"><div class="field"><label>真实姓名 *</label><input id="acName" value="' + L.ui.esc(rn.name || a.displayName) + '"></div>' +
          '<div class="field"><label>学号 / 工号</label><input id="acNo" value="' + L.ui.esc(rn.studentNo || '') + '"></div>' +
          '<div class="field"><label>分组</label><select id="acGroup">' + groupOptions(rn.groupId) + '</select></div>' +
          '<div class="field"><label>职称 / 身份</label><input id="acTitle" value="' + L.ui.esc(rn.title || '') + '"></div>' +
          '<button class="btn primary" id="acSubmit" style="align-self:flex-start">' + (rn.submittedAt ? '重新提交审核' : '提交实名审核') + '</button></div>';
      return '<div class="page-head"><div><h1>我的账号</h1><p>管理本人实名信息、登录密码与已发布的发言。</p></div><div class="head-actions">' +
        (L.auth.isAdmin() ? '<button class="btn" data-nav="#/accounts"><svg class="icon"><use href="#i-shield"/></svg>账号审核台' + (L.auth.pendingCount() ? ' · ' + L.auth.pendingCount() : '') + '</button>' : '') +
        '<button class="btn" data-action="auth-logout">退出登录</button></div></div>' +
        '<div class="grid cols-2"><section class="card"><div class="card-head"><h2>账号信息</h2><div class="right">' + L.ui.badge(statusText, statusCls) + '</div></div><div class="card-pad">' +
        '<div class="row" style="gap:12px">' + L.ui.avatar(a.displayName, a.id, 'lg') + '<div><div style="font-size:16px;font-weight:500">' + L.ui.esc(a.displayName) + '</div>' +
        '<div class="small muted">@' + L.ui.esc(a.username) + ' · ' + L.ui.esc(L.auth.labelRole(a.role)) + ' · ' + L.ui.esc(L.auth.labelStatus(a.status)) + '</div></div></div>' +
        '<div class="divider"></div><dl class="kv"><dt>登录账号</dt><dd><code class="code">' + L.ui.esc(a.accountNo || a.username) + '</code> · ' + (a.role === 'owner' ? '实验室管理员账号' : '6 位数字，登录时使用') + '</dd>' +
        '<dt>角色权限</dt><dd>' + L.ui.esc(L.auth.labelRole(a.role)) + ' · ' + (L.auth.isAdmin() ? '可修改并保存内容、管理账号与配置' : '只读使用现有功能，不能修改或管理') + '</dd>' +
        '<dt>微信关联</dt><dd>' + (a.wxUid ? L.ui.badge('已关联微信', 'green') + ' · ' + L.ui.esc(a.wxName || '微信用户') : '未关联（可用账号密码登录）') + '</dd>' +
        '<dt>注册时间</dt><dd>' + L.ui.esc(a.createdAt || '—') + '</dd><dt>最近登录</dt><dd>' + L.ui.esc(a.lastLoginAt || '—') + '</dd>' +
        '<dt>发言权限</dt><dd>' + (L.auth.canPost() ? '可实名发言（发布后不能自行编辑/删除，需管理员处理）' : L.ui.esc(L.auth.postBlockReason())) + '</dd>' +
        '</dl></div></section>' +
        '<section class="card"><div class="card-head"><h2>修改密码</h2></div><div class="card-pad stack">' +
        (a.defaultPassword ? '<div class="schema-note">当前仍在使用初始密码 lab2026，请尽快修改。</div>' : '') +
        '<div class="field"><label>原密码</label><input id="pwOld" type="password"></div>' +
        '<div class="field"><label>新密码（至少 6 位）</label><input id="pwNew" type="password"></div>' +
        '<button class="btn" id="pwSubmit" style="align-self:flex-start">保存新密码</button></div></section></div>' +
        '<section class="card" style="margin-top:16px"><div class="card-head"><h2>实名信息</h2><div class="right">' + L.ui.badge(statusText, statusCls) + '</div></div><div class="card-pad">' + realBody + '</div></section>' +
        '<section class="card" style="margin-top:16px"><div class="card-head"><h2>我的发言</h2><div class="right">' + L.ui.badge(myPosts.length + ' 条') + '</div></div><div class="card-pad">' +
        (myPosts.length ? myPosts.map(function (p) {
          return '<div class="list-item spread"><div><div>' + L.ui.esc(String(p.content).slice(0, 120)) + '</div><div class="small faint">' + L.ui.fmtDate(p.createdAt) + ' · ' + L.ui.esc(L.store.name('projects', p.projectId)) + '</div></div>' +
            '<div class="row"><button class="btn ghost sm" data-nav="#/hub">在广场中查看</button></div></div>';
        }).join('') : L.ui.empty('还没有发言', '前往信息广场发布第一条实名信息')) + '</div></section>';
    },
    mount: function (root) {
      var sub = root.querySelector('#acSubmit');
      if (sub) sub.onclick = function () {
        var res = L.auth.submitRealName({
          name: root.querySelector('#acName').value, studentNo: root.querySelector('#acNo').value,
          groupId: root.querySelector('#acGroup').value, title: root.querySelector('#acTitle').value
        });
        if (!res.ok) return L.ui.toast(res.error, true);
        L.ui.toast('实名信息已提交，等待管理员审核'); L.app.refresh();
      };
      var pw = root.querySelector('#pwSubmit');
      if (pw) pw.onclick = function () {
        var res = L.auth.changePassword(root.querySelector('#pwOld').value, root.querySelector('#pwNew').value);
        if (!res.ok) return L.ui.toast(res.error, true);
        L.ui.toast('密码已修改'); L.app.refresh();
      };
    }
  };

  L.views.accounts = {
    title: '账号审核台',
    filters: { status: '', q: '' },
    render: function () {
      if (!L.auth.isAdmin()) return '<div class="page-head"><div><h1>账号审核台</h1><p>仅管理员可访问。</p></div></div><section class="card">' + L.ui.empty('无访问权限', '请使用管理员账号登录') + '</section>';
      var self = this, f = this.filters;
      var all = L.auth.accounts();
      var rows = all.filter(function (a) {
        var st = a.realName && a.realName.verified ? 'verified' : (a.realName && a.realName.submittedAt ? 'pending' : 'none');
        if (f.status && st !== f.status) return false;
        if (f.q && [a.username, a.displayName, (a.realName || {}).name, (a.realName || {}).studentNo].filter(Boolean).join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      });
      var options = [['', '全部'], ['pending', '待审核'], ['verified', '已实名'], ['none', '未提交']].map(function (o) {
        return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');
      var pending = all.filter(function (a) { return a.realName && !a.realName.verified && a.realName.submittedAt; });
      return '<div class="page-head"><div><h1>账号审核台</h1><p>核对成员真实姓名与组别，通过后该账号即可实名发言；可停用异常账号。</p></div></div>' +
        '<div class="grid cols-4" style="margin-bottom:16px">' +
        L.ui.stat('账号总数', all.length, '已注册账号', 'i-users', 'blue') +
        L.ui.stat('待审核', pending.length, '等待实名核对', 'i-shield', 'amber') +
        L.ui.stat('已实名', all.filter(function (a) { return a.realName && a.realName.verified; }).length, '可实名发言', 'i-check', 'green') +
        L.ui.stat('已停用', all.filter(function (a) { return a.status === 'disabled'; }).length, '禁止发言', 'i-close', 'rose') + '</div>' +
        '<section class="card"><div class="toolbar"><div class="field"><label>实名状态</label><select data-acfilter="status">' + options + '</select></div>' +
        '<div class="field"><label>关键词</label><input data-acfilter="q" value="' + L.ui.esc(f.q) + '" placeholder="账号 / 姓名 / 学号"></div>' +
        '<button class="btn sm" data-action="clear-account-filter">重置筛选</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>账号</th><th>真实姓名</th><th>组别 / 学号</th><th>角色</th><th>账号状态</th><th>发言</th><th style="width:230px">操作</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (a) {
          var rn = a.realName || {};
          var v = !!rn.verified, sub = !!rn.submittedAt;
          var st = v ? 'verified' : (sub ? 'pending' : 'none');
          var act = '';
          if (!v && sub) {
            act = '<button class="btn sm primary" data-auth-review="approve" data-id="' + a.id + '">通过</button>' +
              '<button class="btn sm" data-auth-review="reject" data-id="' + a.id + '">驳回</button>';
          } else if (v) {
            act = L.ui.badge('已实名', 'green');
          } else {
            act = '<span class="small faint">待提交</span>';
          }
          if (a.role !== 'owner') {
            act += '<button class="btn ghost sm" data-auth-status="' + (a.status === 'disabled' ? 'active' : 'disabled') + '" data-id="' + a.id + '">' + (a.status === 'disabled' ? '启用' : '停用') + '</button>';
            if (st === 'verified') act += '<button class="btn ghost sm" data-auth-role="' + (L.auth.roleOf(a) === 'admin' ? 'user' : 'admin') + '" data-id="' + a.id + '">' + (L.auth.roleOf(a) === 'admin' ? '降为普通用户' : '设为管理员') + '</button>';
          }
          return '<tr><td><b>' + L.ui.esc(a.displayName) + '</b><div class="small faint">@' + L.ui.esc(a.username) + (a.wxUid ? ' · 微信已关联' : '') + '</div></td>' +
            '<td>' + L.ui.esc(rn.name || a.displayName) + ' ' + L.ui.badge(({ verified: '已认证', pending: '待审核', none: '未提交' })[st], v ? 'green' : sub ? 'amber' : '') + '</td>' +
            '<td class="small">' + L.ui.esc(groupLabel(rn.groupId)) + '<div class="faint">' + L.ui.esc(rn.studentNo || '—') + '</div></td>' +
            '<td>' + L.ui.badge(L.auth.labelRole(a.role), L.auth.roleOf(a) === 'admin' ? 'blue' : '') + '</td>' +
            '<td>' + L.ui.status(a.status === 'disabled' ? '停用' : '正常') + '</td>' +
            '<td>' + (a.status === 'disabled' ? '已停用' : v ? '可发言' : '待实名') + '</td>' +
            '<td><div class="row" style="gap:4px;flex-wrap:wrap">' + act + '</div>' + (rn.rejectReason ? '<div class="small faint">驳回：' + L.ui.esc(rn.rejectReason) + '</div>' : '') + '</td></tr>';
        }).join('') : '<tr><td colspan="7">' + L.ui.empty('没有符合条件的账号') + '</td></tr>') + '</tbody></table></div></section>';
    },
    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-acfilter]').forEach(function (el) {
        el.addEventListener('change', function () { self.filters[el.dataset.acfilter] = el.value.trim(); L.app.refresh(); });
        if (el.tagName === 'INPUT') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { self.filters[el.dataset.acfilter] = el.value.trim(); L.app.refresh(); } });
      });
      root.querySelectorAll('[data-auth-review]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.dataset.id;
          var a = L.auth.findById(id);
          if (btn.dataset.authReview === 'approve') {
            L.ui.confirm('确认通过「' + (a ? a.displayName : '') + '」的实名认证？通过后即可实名发言。', function () {
              var res = L.auth.reviewRealName(id, true);
              if (!res.ok) return L.ui.toast(res.error, true);
              L.ui.toast('已通过实名认证'); L.app.refresh();
            }, '确认通过', 'primary');
          } else {
            L.ui.modal({
              title: '驳回实名认证 · ' + (a ? a.displayName : ''),
              body: '<div class="field"><label>驳回原因</label><input id="rvReason" placeholder="如：姓名与花名册不一致"></div>',
              okText: '确认驳回',
              onOk: function (modal) {
                var res = L.auth.reviewRealName(id, false, modal.querySelector('#rvReason').value);
                if (!res.ok) { L.ui.toast(res.error, true); return false; }
                L.ui.toast('已驳回实名认证'); L.app.refresh();
              }
            });
          }
        };
      });
      root.querySelectorAll('[data-auth-status]').forEach(function (btn) {
        btn.onclick = function () {
          var a = L.auth.findById(btn.dataset.id);
          var to = btn.dataset.authStatus;
          L.ui.confirm('确定将「' + (a ? a.displayName : '') + '」' + (to === 'disabled' ? '停用' : '启用') + '吗？停用后该账号无法登录与发言，历史发言保留。', function () {
            var res = L.auth.setStatus(btn.dataset.id, to);
            if (!res.ok) return L.ui.toast(res.error, true);
            L.ui.toast('账号状态已更新'); L.app.refresh();
          }, '确认', 'primary');
        };
      });
      root.querySelectorAll('[data-auth-role]').forEach(function (btn) {
        btn.onclick = function () {
          var a = L.auth.findById(btn.dataset.id);
          var to = btn.dataset.authRole;
          L.ui.confirm('确定将「' + (a ? a.displayName : '') + '」' + (to === 'admin' ? '设为管理员（可修改保存数据）' : '降为普通用户（只读使用）') + '吗？', function () {
            var res = L.auth.setRole(btn.dataset.id, to);
            if (!res.ok) return L.ui.toast(res.error, true);
            L.ui.toast('角色已更新'); L.app.refresh();
          }, '确认', 'primary');
        };
      });
    }
  };
})(window.LabApp = window.LabApp || {});
