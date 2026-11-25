/* 本地账号体系：注册、登录、会话、实名审核、发言权限与内容归属。
   说明：无服务端环境下，账号保存在本机浏览器数据中；密码为加盐摘要，非生产级加密。 */
(function (L) {
  'use strict';

  var SESSION_KEY = 'lab-account-session-v1';
  var DEFAULT_PW = 'lab2026';
  var ADMIN_NAME = '王晓寒';
  var _firstRun = false;

  function digest(pw, salt) {
    var s = salt + '|' + pw + '|lab-hub';
    var h1 = 2166136261, h2 = 5381, i, j;
    for (i = 0; i < s.length; i++) {
      h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
      h2 = ((h2 << 5) + h2 + s.charCodeAt(i)) >>> 0;
    }
    for (j = 0; j < 3; j++) {
      h1 = ((h1 ^ (h2 + j)) * 16777619) >>> 0;
      h2 = ((h2 << 5) + h2 + (h1 & 255)) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }
  function stampNow() { return new Date().toISOString().slice(0, 16); }
  function newSalt() { return Math.random().toString(36).slice(2, 10); }

  var auth = {
    STATUS: ['active', 'pending', 'disabled'],
    /* 系统只有两类角色：管理员可修改与保存，普通用户只读使用现有功能 */
    ROLE: ['user', 'admin'],
    currentId: '',

    /* 兼容历史数据：owner/admin → admin，member/其他 → user */
    roleOf: function (account) {
      var r = account && account.role;
      return (r === 'owner' || r === 'admin') ? 'admin' : 'user';
    },

    init: function () {
      if (!L.store.state.accounts || !Array.isArray(L.store.state.accounts)) L.store.state.accounts = [];
      if (!L.store.state.accounts.length) this.seedOwner();
      this.ensureAdminIdentity();
      var sid = '';
      try { sid = localStorage.getItem(SESSION_KEY) || ''; } catch (e) { sid = ''; }
      var acc = sid ? this.findById(sid) : null;
      /* 在线发布站点：首次打开保持未登录，让访客先看到登录/注册页；本地 file:// 版保留开箱即用的管理员登录 */
      var online = !!(L.cloud && L.cloud.available && L.cloud.available());
      if (!acc && !sid && _firstRun && !online) acc = this.owner() || L.store.state.accounts[0];
      this.currentId = acc && acc.status !== 'disabled' ? acc.id : '';
      if (this.currentId) this.setSession(this.currentId); else this.clearSession();
      this.syncMember();
    },

    /* 按姓名定位实验室管理员对应的花名册成员 */
    adminMember: function () {
      var found = (L.store.all('members') || []).find(function (m) { return m.name === ADMIN_NAME; });
      return found || null;
    },

    /* 新装初始化与旧缓存迁移：确保管理员账号始终绑定王晓寒的真实档案 */
    ensureAdminIdentity: function () {
      var owner = this.owner();
      var m = this.adminMember();
      if (!owner || !m) return;
      var changed = false;
      if (owner.displayName !== m.name) { owner.displayName = m.name; changed = true; }
      if (owner.memberId !== m.id) { owner.memberId = m.id; changed = true; }
      if (owner.phone !== (m.phone || '')) { owner.phone = m.phone || ''; changed = true; }
      if (owner.email !== (m.email || '')) { owner.email = m.email || ''; changed = true; }
      var rn = owner.realName || (owner.realName = {});
      if (rn.name !== m.name) { rn.name = m.name; changed = true; }
      if ((rn.studentNo || '') !== (m.studentNo || '')) { rn.studentNo = m.studentNo || ''; changed = true; }
      if ((rn.groupId || '') !== (m.groupId || '')) { rn.groupId = m.groupId || ''; changed = true; }
      if ((rn.title || '') !== (m.title || '')) { rn.title = m.title || ''; changed = true; }
      if (rn.verified !== true) { rn.verified = true; changed = true; }
      if (changed) L.store.save();
    },

    seedOwner: function () {
      _firstRun = true;
      var m = this.adminMember() || L.store.find('members', L.store.state.settings.currentUserId || '') || L.store.all('members')[0] || {};
      var mid = m.id || '';
      var salt = newSalt();
      L.store.state.accounts.push({
        id: L.ui.uid('u'), username: 'admin', displayName: m.name || '实验室管理员',
        passwordHash: digest(DEFAULT_PW, salt), salt: salt,
        memberId: mid, phone: m.phone || '', email: m.email || '',
        role: 'owner', status: 'active', defaultPassword: true,
        realName: {
          name: m.name || '实验室管理员', studentNo: m.studentNo || '', groupId: m.groupId || '',
          title: m.title || '负责人', verified: true, submittedAt: stampNow(),
          reviewedAt: stampNow(), reviewedBy: '系统初始账号', rejectReason: ''
        },
        createdAt: stampNow(), lastLoginAt: ''
      });
      L.store.save();
    },

    accounts: function () { return (L.store.state.accounts || []).slice(); },
    findById: function (id) { return (L.store.state.accounts || []).find(function (a) { return a.id === id; }) || null; },
    findByUsername: function (name) {
      var n = String(name || '').trim().toLowerCase();
      return (L.store.state.accounts || []).find(function (a) { return String(a.username).toLowerCase() === n; }) || null;
    },
    findByMemberId: function (memberId) {
      if (!memberId) return null;
      return (L.store.state.accounts || []).find(function (a) { return a.memberId === memberId; }) || null;
    },
    /* 按微信云端 uid 找已关联的本地账号（打通两套账号体系的核心键） */
    findByWxUid: function (uid) {
      if (!uid) return null;
      return (L.store.state.accounts || []).find(function (a) { return String(a.wxUid || '') === String(uid); }) || null;
    },
    /* 注册时生成 6 位数字账号，确保不与已有账号重复 */
    newAccountNo: function () {
      var used = {};
      (L.store.state.accounts || []).forEach(function (a) {
        used[String(a.username)] = true;
        if (a.accountNo) used[String(a.accountNo)] = true;
      });
      for (var i = 0; i < 200; i++) {
        var no = String(Math.floor(100000 + Math.random() * 900000));
        if (!used[no]) return no;
      }
      /* 极端情况下的兜底：顺序分配 */
      for (var n = 100000; n <= 999999; n++) if (!used[String(n)]) return String(n);
      return String(Date.now()).slice(-6);
    },
    findByAccountNo: function (no) { return this.findByUsername(no); },
    current: function () { return this.currentId ? this.findById(this.currentId) : null; },
    isLoggedIn: function () { return !!this.current(); },
    owner: function () { return (L.store.state.accounts || []).find(function (a) { return a.role === 'owner'; }) || null; },
    /* 内部保留 owner 作为初始管理员标记，对外仍显示为"管理员" */
    isOwner: function () { var a = this.current(); return !!(a && a.role === 'owner'); },
    isAdmin: function () { return this.roleOf(this.current()) === 'admin'; },
    isReadOnly: function () { return !this.isAdmin(); },

    setSession: function (id) { try { localStorage.setItem(SESSION_KEY, id); } catch (e) {} this.currentId = id; this.syncMember(); },
    clearSession: function () { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} this.currentId = ''; },
    syncMember: function () {
      var a = this.current();
      if (!a || !a.memberId) return;
      if (L.store.find('members', a.memberId)) L.store.state.settings.currentUserId = a.memberId;
    },

    login: function (username, password) {
      var a = this.findByUsername(username);
      if (!a) return { ok: false, error: '账号不存在' };
      if (a.status === 'disabled') return { ok: false, error: '账号已被停用，请联系管理员' };
      if (a.passwordHash !== digest(String(password || ''), a.salt)) return { ok: false, error: '密码不正确' };
      a.lastLoginAt = stampNow();
      L.store.save();
      this.setSession(a.id);
      L.store.log('账号登录：' + a.displayName, '#/account');
      return { ok: true, account: a };
    },

    logout: function () {
      var a = this.current();
      this.clearSession();
      if (a) L.store.log('账号退出：' + a.displayName, '#/login');
    },

    register: function (data) {
      data = data || {};
      var pw = String(data.password || '');
      /* 前端注册不传账号：系统随机分配 6 位数字账号；显式传入账号仅用于程序兼容 */
      var explicit = String(data.username || '').trim();
      var username = explicit || this.newAccountNo();
      if (!explicit && !/^\d{6}$/.test(username)) return { ok: false, error: '账号需为 6 位数字' };
      if (this.findByUsername(username)) return { ok: false, error: '该登录账号已被注册' };
      if (pw.length < 6) return { ok: false, error: '密码至少 6 位' };
      if (pw !== String(data.password2 || '')) return { ok: false, error: '两次密码不一致' };
      var name = String(data.displayName || data.realName || '').trim();
      if (!name) return { ok: false, error: '请填写真实姓名' };
      var salt = newSalt();
      var a = {
        id: L.ui.uid('u'), username: username, accountNo: username, displayName: name,
        passwordHash: digest(pw, salt), salt: salt,
        memberId: data.memberId || '', phone: data.phone || '', email: data.email || '',
        role: 'member', status: 'active', defaultPassword: false,
        realName: {
          name: name, studentNo: data.studentNo || '', groupId: data.groupId || '', title: data.title || '',
          verified: false, submittedAt: stampNow(), reviewedAt: '', reviewedBy: '', rejectReason: ''
        },
        createdAt: stampNow(), lastLoginAt: ''
      };
      L.store.state.accounts.push(a);
      L.store.save();
      this.setSession(a.id);
      L.store.log('新账号注册：' + a.displayName + '（待实名审核）', '#/account');
      return { ok: true, account: a };
    },

    /* 微信授权成功后，把云端微信身份关联到本地账号并登录。
       关联键为账号上的 wxUid（云端 user.id），花名册 member_id 作为第二连接键。
       规则：
         1) 该 wxUid 已关联本地账号 → 直接登录（重复授权幂等）；
         2) 未关联 → 读云端绑定记录，借 member_id 找本地账号并写入 wxUid 后登录；
         3) 找到管理员/初始管理员档案 → 拒绝自动登录，防止微信提权；
         4) 都没有 → 新建一个关联账号（6 位账号、随机密码，实名状态依绑定是否 approved），并登录。 */
    linkWechat: function (session) {
      var self = this;
      var uid = session && session.user && session.user.id;
      if (!uid) return Promise.resolve({ ok: false, error: '微信身份信息不完整' });
      var wxName = (session.user && session.user.name) || '微信用户';

      var linked = self.findByWxUid(uid);
      if (linked) {
        if (linked.status === 'disabled') return Promise.resolve({ ok: false, error: '关联账号已停用，请联系管理员' });
        linked.lastLoginAt = stampNow();
        L.store.save();
        self.setSession(linked.id);
        return Promise.resolve({ ok: true, account: linked, via: 'existing' });
      }

      var bindingP = (L.cloud && L.cloud.myBinding) ? L.cloud.myBinding() : Promise.resolve(null);
      return Promise.resolve(bindingP).catch(function () { return null; }).then(function (binding) {
        var memberId = binding && binding.member_id;
        if (memberId) {
          var acc = self.findByMemberId(memberId);
          if (acc) {
            /* 管理员档案不允许被微信自动登录；否则任何人填管理员姓名学号即可提权 */
            if (self.roleOf(acc) === 'admin') {
              return { ok: false, needManual: true, error: '该微信绑定了管理员档案，请联系管理员手动关联账号' };
            }
            acc.wxUid = uid;
            acc.wxName = wxName;
            acc.linkedAt = stampNow();
            acc.lastLoginAt = stampNow();
            L.store.save();
            self.setSession(acc.id);
            return { ok: true, account: acc, via: 'member' };
          }
          var m = L.store.find('members', memberId) || {};
          return self.createWechatAccount({
            uid: uid, wxName: wxName, memberId: memberId,
            name: (binding && binding.member_name) || m.name || wxName,
            studentNo: (binding && binding.student_no) || m.studentNo || '',
            groupId: m.groupId || '',
            verified: !!(binding && binding.status === 'approved')
          });
        }
        /* 未绑定任何成员：先建一个待完善实名的关联账号 */
        return self.createWechatAccount({
          uid: uid, wxName: wxName, memberId: '',
          name: wxName, studentNo: '', groupId: '', verified: false
        });
      });
    },

    /* 新建一个由微信授权关联的本地账号（内部方法，供 linkWechat 调用） */
    createWechatAccount: function (data) {
      var salt = newSalt();
      var pw = Math.random().toString(36).slice(2, 12); /* 随机密码：微信登录不依赖密码，仅保证账号体系完整 */
      var username = this.newAccountNo();
      var verified = !!data.verified;
      var a = {
        id: L.ui.uid('u'), username: username, accountNo: username, displayName: data.name || '微信用户',
        passwordHash: digest(pw, salt), salt: salt,
        memberId: data.memberId || '', phone: '', email: '',
        wxUid: data.uid, wxName: data.wxName, linkedAt: stampNow(),
        role: 'user', status: 'active', defaultPassword: false,
        realName: {
          name: data.name || '微信用户', studentNo: data.studentNo || '', groupId: data.groupId || '', title: '',
          verified: verified, submittedAt: stampNow(),
          reviewedAt: verified ? stampNow() : '',
          reviewedBy: verified ? '微信绑定自动关联' : '', rejectReason: ''
        },
        createdAt: stampNow(), lastLoginAt: stampNow()
      };
      L.store.state.accounts.push(a);
      L.store.save();
      this.setSession(a.id);
      L.store.log('微信授权关联账号：' + a.displayName, '#/account');
      return { ok: true, account: a, via: 'created' };
    },

    submitRealName: function (data) {
      var a = this.current();
      if (!a) return { ok: false, error: '请先登录' };
      data = data || {};
      var name = String(data.name || '').trim();
      if (!name) return { ok: false, error: '请填写真实姓名' };
      a.realName = {
        name: name, studentNo: data.studentNo || '', groupId: data.groupId || '', title: data.title || '',
        verified: false, submittedAt: stampNow(), reviewedAt: '', reviewedBy: '', rejectReason: ''
      };
      a.displayName = name;
      L.store.save();
      L.store.log('提交实名审核：' + name, '#/account');
      return { ok: true };
    },

    reviewRealName: function (id, approve, reason) {
      if (!this.isAdmin()) return { ok: false, error: '仅管理员可审核' };
      var a = this.findById(id);
      if (!a) return { ok: false, error: '账号不存在' };
      var me = this.current();
      a.realName.verified = !!approve;
      a.realName.reviewedAt = stampNow();
      a.realName.reviewedBy = me.displayName;
      a.realName.rejectReason = approve ? '' : String(reason || '资料不匹配');
      a.status = 'active';
      L.store.save();
      L.store.log((approve ? '实名通过：' : '实名驳回：') + a.displayName, '#/accounts');
      return { ok: true };
    },

    setStatus: function (id, status) {
      if (!this.isAdmin()) return { ok: false, error: '仅管理员可操作' };
      var a = this.findById(id);
      if (!a) return { ok: false, error: '账号不存在' };
      if (a.role === 'owner' && status !== 'active') return { ok: false, error: '不能停用实验室管理员账号' };
      a.status = status;
      if (status === 'disabled' && this.currentId === id) this.clearSession();
      L.store.save();
      L.store.log('账号状态变更：' + a.displayName + ' → ' + status, '#/accounts');
      return { ok: true };
    },

    setRole: function (id, role) {
      if (!this.isAdmin()) return { ok: false, error: '仅管理员可调整角色' };
      var a = this.findById(id);
      if (!a) return { ok: false, error: '账号不存在' };
      if (a.role === 'owner') return { ok: false, error: '不能修改初始管理员角色' };
      var r = (role === 'admin' || role === 'owner') ? 'admin' : 'user';
      a.role = r;
      L.store.save();
      L.store.log('账号角色变更：' + a.displayName + ' → ' + this.labelRole(r), '#/accounts');
      return { ok: true };
    },

    changePassword: function (oldPw, newPw) {
      var a = this.current();
      if (!a) return { ok: false, error: '请先登录' };
      if (a.passwordHash !== digest(String(oldPw || ''), a.salt)) return { ok: false, error: '原密码不正确' };
      if (String(newPw || '').length < 6) return { ok: false, error: '新密码至少 6 位' };
      a.salt = newSalt();
      a.passwordHash = digest(String(newPw), a.salt);
      a.defaultPassword = false;
      L.store.save();
      L.store.log('修改登录密码：' + a.displayName, '#/account');
      return { ok: true };
    },

    /* 发言权限：登录 + 正常状态 + 实名已认证 */
    canPost: function () {
      var a = this.current();
      return !!(a && a.status === 'active' && a.realName && a.realName.verified);
    },
    postBlockReason: function () {
      var a = this.current();
      if (!a) return '请先登录账号后再发言';
      if (a.status === 'disabled') return '账号已停用，无法发言';
      if (!a.realName || !a.realName.verified) return '实名信息待审核，通过后方可实名发言';
      return '';
    },
    /* 内容管理：仅管理员；普通用户即使本人发布也不能编辑/删除 */
    canManage: function () {
      var a = this.current();
      return !!(a && a.status === 'active' && this.roleOf(a) === 'admin');
    },
    canEdit: function () { return this.canManage(); },
    /* 新发言的归属信息 */
    stamp: function () {
      var a = this.current();
      if (!a) return {};
      return {
        authorAccountId: a.id,
        authorId: a.memberId || L.store.state.settings.currentUserId,
        authorName: a.realName && a.realName.verified ? a.realName.name : a.displayName,
        authorVerified: !!(a.realName && a.realName.verified)
      };
    },
    /* 展示名：新数据取实名快照，旧数据回退成员姓名 */
    display: function (post) {
      if (!post) return { name: '未知成员', verified: false };
      if (post.authorName) return { name: post.authorName, verified: !!post.authorVerified };
      var m = L.store.find('members', post.authorId);
      return { name: m ? m.name : '未知成员', verified: false };
    },
    myPosts: function () {
      var a = this.current();
      if (!a) return [];
      return L.store.all('posts').filter(function (p) { return p.authorAccountId === a.id; });
    },
    pendingCount: function () {
      return (L.store.state.accounts || []).filter(function (a) { return a.realName && !a.realName.verified && a.status !== 'disabled'; }).length;
    },
    labelRole: function (r) { return this.roleOf({ role: r }) === 'admin' ? '管理员' : '普通用户'; },
    labelStatus: function (s) { return ({ active: '正常', disabled: '已停用' })[s] || s || '正常'; },

    /* 统一权限门禁：action 为全局 data-action 名称，entity 为实体名 */
    ADMIN_ACTIONS: ['new', 'edit', 'delete', 'quick-add', 'mark-left', 'restore-member', 'refresh-progress', 'toggle-pin', 'pm-add', 'pm-remove'],
    ADMIN_ROUTES: ['#/accounts', '#/settings'],
    denyReason: function () {
      if (!this.isLoggedIn()) return '尚未登录，请先登录后再操作';
      if (!this.isAdmin()) return '当前为普通用户，仅有浏览和使用权限；修改、删除与管理操作需管理员账号';
      return '当前账号状态异常，无法执行该操作';
    },
    guard: function (action, entity) {
      if (this.ADMIN_ACTIONS.indexOf(action) < 0) return { ok: true };
      /* 实名成员在广场/项目讨论中发新帖属于"使用功能"，不是管理修改 */
      if (action === 'new' && entity === 'posts' && this.canPost()) return { ok: true };
      if (this.isAdmin()) return { ok: true };
      return { ok: false, error: this.denyReason() };
    },
    guardRoute: function (hash) {
      var h = String(hash || '').split('?')[0];
      if (this.ADMIN_ROUTES.indexOf(h) >= 0 && !this.isAdmin()) return { ok: false, error: this.denyReason() };
      return { ok: true };
    },
    /* 数据层写入权限：仅管理员可增删改；普通用户只允许发布自己的实名讨论 */
    canMutate: function (entity, op) {
      if (!L.store || !L.store.state) return { ok: true };
      var a = this.current();
      if (!a) return { ok: false, error: this.denyReason() };
      if (a.status !== 'active') return { ok: false, error: '账号已停用，无法修改数据' };
      if (this.roleOf(a) === 'admin') return { ok: true };
      if (op === 'insert' && entity === 'posts' && this.canPost()) return { ok: true };
      return { ok: false, error: this.denyReason() };
    }
  };

  L.auth = auth;
})(window.LabApp = window.LabApp || {});
