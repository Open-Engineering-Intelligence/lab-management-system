/* 微信扫码登录核心：授权 URL、state 防重放、回调换 openid、身份识别与绑定。
   双模式：
   - demo（默认，零后端可跑通）：二维码指向本地演示授权页，code 为 demo_ 前缀，openid 由 code 稳定派生。
   - live（真实微信）：二维码指向微信开放平台扫码授权地址，回调 code 由后端接口换取 openid（AppSecret 只在后端）。 */
(function (L) {
  'use strict';

  var STATE_KEY = 'lab-wx-state-v1';

  var DEFAULT_CONFIG = {
    mode: 'demo',              // demo | live
    appId: '',                 // 微信开放平台网站应用 AppID（live 必填）
    redirectUri: '',           // 授权回调地址，需与开放平台配置一致（live 必填）
    apiBase: '',               // 后端服务根地址，如 https://api.example.com（live 必填）
    scope: 'snsapi_login',     // 网站应用扫码登录固定 snsapi_login
    stateTtl: 5 * 60 * 1000    // state 有效期 5 分钟
  };

  function hex(n) {
    var s = '';
    while (s.length < n) s += Math.random().toString(16).slice(2);
    return s.slice(0, n);
  }
  function config() {
    var s = L.store.state.settings;
    if (!s.wechat || typeof s.wechat !== 'object' || Array.isArray(s.wechat)) s.wechat = {};
    var c = Object.assign({}, DEFAULT_CONFIG, s.wechat);
    // 未填回调地址时，用当前页面地址推导（便于部署后自动填充）
    if (!c.redirectUri) {
      try { c.redirectUri = location.href.split('#')[0]; } catch (e) { c.redirectUri = ''; }
    }
    return c;
  }

  var wechat = {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    config: config,

    /* 当前系统对外入口（需为微信可访问的 HTTPS 地址，本地 file:// 仅限演示） */
    entryUrl: function () {
      try { return location.href.split('#')[0] + '#/wxlogin'; } catch (e) { return '#/wxlogin'; }
    },
    /* 授权回调地址（含路由） */
    callbackUrl: function () {
      var c = config();
      var base = c.redirectUri || (location.href.split('#')[0]);
      return base.replace(/#.*$/, '') + '#/wx-callback';
    },

    newState: function () {
      var st = hex(16);
      try { localStorage.setItem(STATE_KEY, JSON.stringify({ state: st, at: Date.now() })); } catch (e) {}
      return st;
    },
    checkState: function (state) {
      if (!state) return { ok: false, error: '缺少 state 参数，可能不是从二维码跳转过来的' };
      var raw = null;
      try { raw = localStorage.getItem(STATE_KEY); } catch (e) {}
      var obj = null;
      try { obj = raw ? JSON.parse(raw) : null; } catch (e) {}
      if (!obj || !obj.state) return { ok: false, error: '授权已过期或已在其他设备打开，请重新扫码' };
      if (obj.state !== state) return { ok: false, error: 'state 校验失败，为防止重放攻击请重新扫码' };
      if (Date.now() - (obj.at || 0) > (config().stateTtl || 300000)) return { ok: false, error: '授权超时（超过 5 分钟），请重新扫码' };
      // 消费 state，防止重用
      try { localStorage.removeItem(STATE_KEY); } catch (e) {}
      return { ok: true };
    },

    /* 生成二维码内容：live 为微信授权 URL；demo 为本地演示授权页链接 */
    qrText: function (state) {
      var c = config();
      state = state || this.newState();
      if (c.mode === 'live') {
        if (!c.appId) throw new Error('尚未配置微信 AppID，请到设置页填写，或切换到演示模式');
        var redirect = encodeURIComponent(this.callbackUrl());
        return 'https://open.weixin.qq.com/connect/qrconnect?appid=' + encodeURIComponent(c.appId) +
          '&redirect_uri=' + redirect + '&response_type=code&scope=' + encodeURIComponent(c.scope || 'snsapi_login') +
          '&state=' + encodeURIComponent(state) + '#wechat_redirect';
      }
      // 演示模式：二维码打开本地演示授权页（同一浏览器可完整走通）
      var base = this.callbackUrl().replace(/#.*$/, '');
      return base + '#/wx-authorize?state=' + encodeURIComponent(state);
    },

    /* 演示模式：生成可被回调识别的假 code（openid 由 code 稳定派生） */
    demoCode: function (state) {
      return 'demo_' + hex(10) + '_' + String(state || '').slice(0, 6);
    },
    demoOpenId: function (code) {
      var h = 2166136261, s = String(code || ''), i;
      for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return 'demo_openid_' + ('00000000' + h.toString(16)).slice(-8);
    },

    /* 回调换身份：demo 本地派生；live 调后端接口，AppSecret 仅在后端 */
    exchange: function (code, state) {
      var self = this;
      var c = config();
      var st = this.checkState(state);
      if (!st.ok) return Promise.reject({ code: 'STATE_INVALID', message: st.error });
      if (!code) return Promise.reject({ code: 'CODE_MISSING', message: '微信未返回 code，可能取消了授权' });
      if (c.mode !== 'live' || String(code).indexOf('demo_') === 0) {
        var openid = c.mode === 'live' ? String(code) : this.demoOpenId(code);
        return Promise.resolve({
          openid: openid, unionid: '', nickname: '微信用户', avatar: '',
          provider: 'wechat', demo: c.mode !== 'live'
        });
      }
      if (!c.apiBase) return Promise.reject({ code: 'NO_BACKEND', message: '尚未配置后端服务地址，无法换取微信身份，请到设置页填写或切换到演示模式' });
      var url = String(c.apiBase).replace(/\/$/, '') + '/api/wechat/oauth?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state);
      return new Promise(function (resolve, reject) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; reject({ code: 'TIMEOUT', message: '微信身份校验超时，请稍后重试' }); } }, 12000);
        try {
          fetch(url, { credentials: 'include' }).then(function (r) {
            if (!r.ok) throw { code: 'HTTP_' + r.status, message: '微信授权服务返回错误（' + r.status + '）' };
            return r.json();
          }).then(function (data) {
            if (done) return; done = true; clearTimeout(timer);
            if (!data || !data.openid) throw { code: 'NO_OPENID', message: (data && data.error) || '后端未返回 openid' };
            resolve({ openid: data.openid, unionid: data.unionid || '', nickname: data.nickname || '微信用户', avatar: data.headimgurl || data.avatar || '', provider: 'wechat', demo: false });
          }).catch(function (err) {
            if (done) return; done = true; clearTimeout(timer);
            reject(err && err.code ? err : { code: 'NETWORK', message: '无法连接微信授权服务，请检查后端地址与网络' });
          });
        } catch (e) {
          if (!done) { done = true; clearTimeout(timer); reject({ code: 'NETWORK', message: '浏览器不支持 fetch 或请求被拦截' }); }
        }
      });
    },

    /* 按 openid 找已绑定账号 */
    findByOpenId: function (openid) {
      if (!openid) return null;
      return (L.store.state.accounts || []).find(function (a) {
        return a.openid === openid || (a.unionid && a.unionid === openid);
      }) || null;
    },
    /* 已被微信绑定的成员（用于绑定页排除） */
    boundMemberIds: function () {
      return (L.store.state.accounts || []).filter(function (a) { return !!a.openid; }).map(function (a) { return a.memberId; }).filter(Boolean);
    },

    /* 将微信身份绑定到已有账号（需当前已登录） */
    bindToCurrent: function (profile) {
      var a = L.auth.current();
      if (!a) return { ok: false, error: '请先登录后绑定微信' };
      var exist = this.findByOpenId(profile.openid);
      if (exist && exist.id !== a.id) return { ok: false, error: '该微信已绑定到其他账号，请先解绑后再试' };
      a.openid = profile.openid;
      a.unionid = profile.unionid || '';
      a.wxName = profile.nickname || '';
      a.wxAvatar = profile.avatar || '';
      a.wxBoundAt = new Date().toISOString().slice(0, 16);
      a.authProvider = 'wechat';
      L.store.save();
      L.store.log('绑定微信：' + a.displayName + '（' + (profile.demo ? '演示 openid' : '微信 openid') + '）', '#/account');
      return { ok: true, account: a };
    },

    /* 首次微信登录：按 openid 创建账号并绑定成员；已存在则直接登录 */
    loginOrCreate: function (profile, memberId) {
      var exist = this.findByOpenId(profile.openid);
      if (exist) {
        if (exist.status === 'disabled') return { ok: false, error: '该微信绑定的账号已被停用，请联系管理员' };
        L.auth.setSession(exist.id);
        L.store.log('微信扫码登录：' + exist.displayName, '#/account');
        return { ok: true, account: exist, created: false };
      }
      var m = L.store.find('members', memberId);
      if (!m) return { ok: false, error: '所选成员不存在，请重新选择' };
      var taken = L.auth.findByMemberId && L.auth.findByMemberId(memberId);
      if (taken) return { ok: false, error: '该成员已有系统账号，请先用该账号登录后在账号中心绑定微信' };
      var salt = Math.random().toString(36).slice(2, 10);
      var a = {
        id: L.ui.uid('u'), username: 'wx_' + profile.openid.slice(-8), displayName: m.name,
        passwordHash: '', salt: salt, memberId: memberId,
        phone: m.phone || '', email: m.email || '',
        role: 'member', status: 'active', defaultPassword: false,
        openid: profile.openid, unionid: profile.unionid || '', wxName: profile.nickname || '',
        wxAvatar: profile.avatar || '', wxBoundAt: new Date().toISOString().slice(0, 16), authProvider: 'wechat',
        realName: {
          name: m.name, studentNo: m.studentNo || '', groupId: m.groupId || '', title: m.title || '',
          verified: false, submittedAt: new Date().toISOString().slice(0, 16),
          reviewedAt: '', reviewedBy: '', rejectReason: ''
        },
        createdAt: new Date().toISOString().slice(0, 16), lastLoginAt: new Date().toISOString().slice(0, 16)
      };
      L.store.state.accounts.push(a);
      L.store.save();
      L.auth.setSession(a.id);
      L.store.log('微信扫码新建账号：' + a.displayName + '（待实名审核）', '#/account');
      return { ok: true, account: a, created: true };
    },

    unbind: function () {
      var a = L.auth.current();
      if (!a) return { ok: false, error: '请先登录' };
      delete a.openid; delete a.unionid; delete a.wxName; delete a.wxAvatar;
      delete a.wxBoundAt;
      a.authProvider = 'local';
      L.store.save();
      L.store.log('解绑微信：' + a.displayName, '#/account');
      return { ok: true };
    },

    codeText: function (e) {
      var map = {
        STATE_INVALID: '授权校验失败', CODE_MISSING: '微信未返回授权码', NO_BACKEND: '未配置后端服务',
        TIMEOUT: '请求超时', NETWORK: '网络连接失败', NO_OPENID: '身份识别失败'
      };
      return (e && e.message) || map[e && e.code] || '授权失败，请重新扫码';
    },

    bound: function (account) { return !!(account && account.openid); }
  };

  L.wechat = wechat;
})(window.LabApp = window.LabApp || {});
