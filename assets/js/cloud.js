/* 微信扫码登录 + 人员绑定：仅在已发布的 HTTPS 站点启用；本地 file:// 打开时降级提示 */
(function (L) {
  'use strict';
  L.cloud = L.cloud || {};

  /* 由 workbuddy_cloud_service 返回的对外安全配置（可随前端发布，不含任何密钥） */
  var PUBLIC_CONFIG = {
    endpoint: 'https://lab-project-hub.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_iZYOfEd1Lm8AWH7NV84on1_yFPPFRhMoCev7p4JAjO4X7VGjSiKj7GN'
  };

  /* SDK 源：本地优先（不依赖外网），本地缺失时回退 CDN。
     本地副本放在 assets/js/vendor/，随站点一起发布，避免国内访问 jsdelivr 不稳定导致“登录组件加载失败”。 */
  var SDK_SOURCES = [
    'assets/js/vendor/workbuddy-cloud-sdk.global.js',
    'https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js'
  ];
  var client = null;
  var cloudSession = null;   /* 云端会话 { user: { id, name, avatarUrl } } */
  var autoLoginTried = false; /* 本次页面会话是否已消费过自动登录意图，防止循环 */

  function httpsPublished() {
    return location.protocol === 'https:' && location.hostname.indexOf('.workbuddy.') >= 0;
  }

  function sdkAvailable() {
    return !!(window.WorkBuddyCloud && typeof window.WorkBuddyCloud.createWorkBuddyCloud === 'function');
  }

  function initClient() {
    if (client || !sdkAvailable()) return client;
    try {
      client = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: PUBLIC_CONFIG.endpoint,
        oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
        publishableKey: PUBLIC_CONFIG.publishableKey
      });
    } catch (e) {
      client = null;
    }
    return client;
  }

  L.cloud.available = function () { return httpsPublished(); };
  L.cloud.client = function () { return initClient(); };
  L.cloud.session = function () { return cloudSession; };
  L.cloud.isSignedIn = function () { return !!cloudSession; };

  /* 依次尝试多个 SDK 源，直到某个加载后成功初始化客户端 */
  function loadScriptSeq(index) {
    if (index >= SDK_SOURCES.length) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      var settled = false;
      function done(ok) {
        if (settled) return;
        settled = true;
        if (s.parentNode) s.parentNode.removeChild(s);
        resolve(ok);
      }
      s.src = SDK_SOURCES[index];
      s.onload = function () {
        if (initClient()) return done(true);
        done(false); /* 脚本加载了但初始化失败，尝试下一个源 */
      };
      s.onerror = function () { done(false); };
      document.head.appendChild(s);
    }).then(function (ok) {
      return ok ? true : loadScriptSeq(index + 1);
    });
  }

  /* 载入 SDK 并初始化；返回 Promise<boolean> */
  L.cloud.load = function () {
    if (!httpsPublished()) return Promise.resolve(false);
    if (initClient()) return Promise.resolve(true);
    return loadScriptSeq(0);
  };

  /* 启动时调用：处理微信回调 / 恢复会话。必须在本地路由守卫之前完成 */
  L.cloud.restoreAuth = function () {
    if (!httpsPublished()) return Promise.resolve({ state: 'local' });
    return L.cloud.load().then(function (ok) {
      if (!ok) return { state: 'sdk-error' };
      var c = initClient();
      var url = new URL(location.href);
      var hasCb = url.searchParams.has('code') || url.searchParams.has('error');
      var provider = url.searchParams.get('provider');
      function clearParams() {
        ['code', 'state', 'provider'].forEach(function (k) { url.searchParams.delete(k); });
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      /* SDK 的返回结果统一是 { data, error }：成功时会话对象就在 data 上
         （形如 { accessToken, refreshToken, expiresAt, user }），data 内部
         并没有再套一层 .session。此前误读 result.session / r.data.session，
         导致回调登录成功后 cloudSession 仍为空、被路由守卫当成访客踢回扫码页。 */
      function sessionOf(r) {
        var d = r && r.data;
        if (!d || typeof d !== 'object') return null;
        /* 兼容极小概率出现的 { data: { session: {...} } } 嵌套结构 */
        if (d.session && typeof d.session === 'object') return d.session;
        return d.accessToken ? d : null;
      }
      function after(result) {
        var sess = sessionOf(result);
        if (sess) {
          cloudSession = sess;
          clearParams();
          return { state: 'signed-in', session: cloudSession };
        }
        if (result && result.error) return { state: 'error', error: result.error.message || '微信登录失败' };
        return c.auth.getSession().then(function (r) {
          cloudSession = sessionOf(r);
          return cloudSession ? { state: 'restored', session: cloudSession } : { state: 'signed-out' };
        });
      }
      if (!hasCb) {
        return c.auth.getSession().then(function (r) {
          cloudSession = sessionOf(r);
          return cloudSession ? { state: 'restored', session: cloudSession } : { state: 'signed-out' };
        });
      }
      if (provider !== 'wechat') return { state: 'error', error: '回调缺少有效的登录方式' };
      var handler = c.auth.handleWechatWebCallback;
      if (typeof handler !== 'function') return { state: 'error', error: '当前 SDK 不支持微信登录，请联系管理员' };
      return Promise.resolve(handler.call(c.auth)).then(after);
    }).catch(function (e) {
      return { state: 'error', error: (e && e.message) || '微信登录初始化失败' };
    });
  };

  /* 进站二维码自动登录：二维码内容带 autologin=1。
     微信内扫码打开后，若尚未登录且无回调参数，自动发起微信授权，
     省去“进登录页→点按钮→二次扫码”。参数一次性消费并从地址栏清除，
     避免授权回调后或刷新时重复触发造成循环。 */
  L.cloud.consumeAutoLogin = function () {
    if (autoLoginTried || !httpsPublished() || cloudSession) return false;
    var u;
    try { u = new URL(location.href); } catch (e) { return false; }
    if (u.searchParams.get('autologin') !== '1') return false;
    /* 回调参数存在时交给 restoreAuth 处理，不在这里重复发起 */
    if (u.searchParams.has('code') || u.searchParams.has('error') || u.searchParams.has('provider')) return false;
    u.searchParams.delete('autologin');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    autoLoginTried = true;
    return true;
  };

  /* 发起微信扫码登录：signInWithOAuth 只返回地址，需要同页跳转 */
  L.cloud.signInWithWechat = function () {
    if (!httpsPublished()) return Promise.reject(new Error('微信登录需要在已发布的网址中打开'));
    return L.cloud.load().then(function (ok) {
      if (!ok) throw new Error('登录组件加载失败，请稍后重试');
      var c = initClient();
      var back = new URL(location.href);
      back.pathname = '/';
      ['code', 'state', 'provider'].forEach(function (k) { back.searchParams.delete(k); });
      return c.auth.signInWithOAuth({ provider: 'wechat', redirectTo: back.toString() });
    }).then(function (r) {
      if (r && r.error) throw new Error(r.error.message || '无法发起微信登录');
      var target = r && r.data && r.data.url;
      if (!target) throw new Error('微信登录地址获取失败');
      location.assign(target);
      return true;
    });
  };

  L.cloud.signOut = function () {
    var c = initClient();
    cloudSession = null;
    if (!c) return Promise.resolve(true);
    return c.auth.signOut().then(function () { return true; }).catch(function () { return true; });
  };

  /* 按姓名 + 学号在花名册中精确匹配成员 */
  L.cloud.matchMember = function (name, studentNo) {
    var nm = String(name || '').trim();
    var sno = String(studentNo || '').trim();
    if (!nm || !sno) return null;
    var list = L.store.all('members') || [];
    var hit = list.find(function (m) {
      return String(m.name || '').trim() === nm && String(m.studentNo || '').trim() === sno;
    });
    return hit || null;
  };

  /* 进站登记：按姓名+学号精确匹配花名册后写入云端进站记录。
     访客无需微信登录即可登记（RLS 放行 INSERT、owner_id 允许为空），
     写操作用 insert（不带 .select），避免依赖仅管理员可见的 SELECT 策略。 */
  L.cloud.recordCheckin = function (name, studentNo) {
    var member = L.cloud.matchMember(name, studentNo);
    if (!member) return Promise.reject(new Error('姓名与学号未匹配到花名册成员'));
    return L.cloud.load().then(function (ok) {
      if (!ok) throw new Error('进站登记需要在已发布的网址中使用');
      var c = initClient();
      var row = {
        member_id: member.id,
        member_name: member.name,
        student_no: String(member.studentNo || studentNo || '').trim(),
        group_name: (member.groupId && L.store.name) ? (L.store.name('groups', member.groupId) || '') : '',
        source: 'qr',
        client: L.cloud.isSignedIn() ? 'wechat' : 'guest',
        note: ''
      };
      return c.database.from('lab_checkins').insert(row).then(function (r) {
        if (r && r.error) throw new Error(r.error.message || '进站记录写入失败');
        return { member: member, row: row, at: new Date().toISOString() };
      });
    });
  };

  /* 读取进站记录：RLS 仅允许管理员（wx_admins 白名单）读到数据 */
  L.cloud.listCheckins = function (limit) {
    return L.cloud.load().then(function (ok) {
      if (!ok) throw new Error('读取进站记录需要在已发布的网址中使用');
      var c = initClient();
      return c.database.from('lab_checkins').select('*')
        .order('checked_at', { ascending: false }).limit(limit || 100).then(function (r) {
          if (r && r.error) throw new Error(r.error.message || '读取进站记录失败');
          return (r && r.data) || [];
        });
    });
  };

  /* 读取当前微信身份的绑定记录 */
  L.cloud.myBinding = function () {
    var c = initClient();
    if (!c || !cloudSession) return Promise.resolve(null);
    return c.database.from('wx_binds').select('*').eq('owner_id', cloudSession.user.id).maybeSingle()
      .then(function (r) { return (r && r.data) || null; });
  };

  /* 提交绑定：姓名 + 学号 → 匹配成员 → 写入云端 */
  L.cloud.submitBinding = function (name, studentNo, groupName) {
    var c = initClient();
    if (!c || !cloudSession) return Promise.reject(new Error('请先使用微信登录'));
    var member = L.cloud.matchMember(name, studentNo);
    var row = {
      owner_name: (cloudSession.user && cloudSession.user.name) || '',
      member_id: member ? member.id : '',
      member_name: member ? member.name : String(name || '').trim(),
      student_no: String(studentNo || '').trim(),
      group_name: groupName || (member ? L.store.name('groups', member.groupId) : ''),
      status: member ? 'approved' : 'pending',
      reject_reason: '',
      reviewed_by: member ? '系统自动匹配花名册' : '',
      reviewed_at: member ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    return c.database.from('wx_binds').select('*').eq('owner_id', cloudSession.user.id).maybeSingle()
      .then(function (r) {
        if (r && r.data) {
          return c.database.from('wx_binds').update(row).eq('owner_id', cloudSession.user.id).select();
        }
        return c.database.from('wx_binds').insert(row).select();
      })
      .then(function (r) {
        if (r && r.error) throw new Error(r.error.message || '绑定提交失败');
        return { data: (r && r.data && r.data[0]) || null, matched: !!member, member: member };
      });
  };

  /* 认领管理员：仅当白名单为空时，首个微信登录者可认领 */
  L.cloud.claimAdmin = function () {
    var c = initClient();
    if (!c || !cloudSession) return Promise.reject(new Error('请先使用微信登录'));
    var uid = cloudSession.user.id;
    return c.database.from('wx_admins').select('uid').eq('uid', uid).maybeSingle().then(function (r) {
      if (r && r.data) return { ok: true, already: true };
      return c.database.from('wx_admins').insert({ uid: uid, label: (cloudSession.user.name || '') }).select()
        .then(function (x) {
          if (x && x.error) return { ok: false, error: x.error.message || '认领失败' };
          return { ok: true, already: false };
        });
    });
  };

  /* 管理员：判断当前微信身份是否在白名单 */
  L.cloud.isCloudAdmin = function () {
    var c = initClient();
    if (!c || !cloudSession) return Promise.resolve(false);
    return c.database.from('wx_admins').select('uid').eq('uid', cloudSession.user.id).maybeSingle()
      .then(function (r) { return !!(r && r.data); });
  };

  /* 管理员：读取全部绑定记录 */
  L.cloud.allBindings = function () {
    var c = initClient();
    if (!c || !cloudSession) return Promise.resolve([]);
    return c.database.from('wx_binds').select('*').order('created_at', { ascending: false })
      .then(function (r) { return (r && r.data) || []; });
  };

  /* 管理员：审核绑定 */
  L.cloud.reviewBinding = function (id, approve, reason) {
    var c = initClient();
    if (!c || !cloudSession) return Promise.reject(new Error('请先使用微信登录'));
    var patch = {
      status: approve ? 'approved' : 'rejected',
      reject_reason: approve ? '' : String(reason || '资料不匹配'),
      reviewed_by: (cloudSession.user && cloudSession.user.name) || '管理员',
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return c.database.from('wx_binds').update(patch).eq('id', id).select().then(function (r) {
      if (r && r.error) throw new Error(r.error.message || '审核失败');
      var affected = Array.isArray(r.data) ? r.data : [];
      if (!affected.length) throw new Error('未找到该记录，或你没有审核权限');
      return affected[0];
    });
  };
})(window.LabApp = window.LabApp || {});
