/* 微信扫码登录页面组：二维码入口 / 演示授权 / 回调处理 / 身份绑定 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  /* ---------- 扫码入口 ---------- */
  L.views.wxlogin = {
    title: '微信扫码登录',
    state: '',
    render: function () {
      var c = L.wechat.config();
      var self = this;
      if (!this.state) this.state = L.wechat.newState();
      var qr = '';
      try {
        qr = L.qr.svg(L.wechat.qrText(this.state), 230, { quiet: 3, fg: '#0f172a' });
      } catch (e) {
        qr = '<div class="wx-qr-error">' + L.ui.esc(e.message) + '</div>';
      }
      var isLive = c.mode === 'live';
      var configured = isLive ? !!(c.appId && c.apiBase) : true;
      var a = L.auth.current();
      return '<div class="page-head"><div><h1>微信扫码登录</h1><p>用微信扫一扫进入系统，微信身份与实验室成员一一绑定，发言实名归属到本人。</p></div>' +
        (L.auth.isAdmin() ? '<div class="head-actions"><button class="btn" data-nav="#/settings"><svg class="icon"><use href="#i-settings"/></svg>扫码配置</button></div>' : '') + '</div>' +
        '<div class="wx-login-wrap"><section class="card wx-qr-card"><div class="card-head"><h2>扫一扫登录</h2><div class="right">' +
        L.ui.badge(isLive ? '微信授权' : '演示模式', isLive ? 'green' : 'amber') + '</div></div><div class="card-pad wx-qr-pad">' +
        (configured ? '<div class="wx-qr">' + qr + '</div>' : '<div class="wx-qr-error">微信登录未配置完整，请到「设置 → 微信扫码登录」填写 AppID 与后端地址，或切换为演示模式。</div>') +
        '<div class="wx-qr-hint">' + (isLive ? '请使用微信扫码，并在手机上确认授权' : '演示模式：二维码为本地授权页，电脑浏览器可直接打开') + '</div>' +
        '<div class="wx-state">授权令牌：' + L.ui.esc(this.state.slice(0, 8)) + '…（5 分钟内有效，防重复提交）</div>' +
        (configured ? '<button class="btn primary wx-demo-btn" id="wxProceed">' + (isLive ? '我已用微信扫码授权' : '模拟微信扫码并授权') + '</button>' : '') +
        '</div></section>' +
        '<section class="card wx-info-card"><div class="card-head"><h2>登录说明</h2></div><div class="card-pad">' +
        '<div class="wx-flow"><div class="wx-flow-step"><span>1</span><div><b>微信扫码</b><div class="small faint">扫码后微信确认授权，系统获得该微信的唯一 openid</div></div></div>' +
        '<div class="wx-flow-step"><span>2</span><div><b>身份识别</b><div class="small faint">已绑定成员：直接登录；未绑定：选择花名册中的本人并确认</div></div></div>' +
        '<div class="wx-flow-step"><span>3</span><div><b>实名发言</b><div class="small faint">一个微信号绑定一名成员，发言以真实姓名展示</div></div></div></div>' +
        '<div class="divider"></div>' +
        '<div class="small faint">当前模式：<b>' + (isLive ? '真实微信授权' : '本地演示') + '</b>' + (a ? ' · 已登录：' + L.ui.esc(a.displayName) : '') + '</div>' +
        '<div class="schema-note" style="margin-top:12px">' +
        (isLive
          ? '真实微信登录需满足：微信开放平台网站应用 AppID/AppSecret、已备案的 HTTPS 回调域名、后端接口用 code 换取 openid（AppSecret 仅存后端，不能写在前端）。详见设置页「微信扫码登录」配置清单。'
          : '演示模式完全在本地运行，无需后端：openid 由演示授权码派生，可完整体验扫码→授权→绑定→登录流程。换电脑/浏览器不会共享绑定关系。') +
        '</div></div></section></div>' +
        (a ? '<div class="wx-current">当前已登录 <b>' + L.ui.esc(a.displayName) + '</b>，可到账号中心查看或解绑微信。<button class="btn sm" data-nav="#/account">前往账号中心</button></div>' : '');
    },
    mount: function (root) {
      var self = this;
      var btn = root.querySelector('#wxProceed');
      if (btn) btn.onclick = function () {
        var c = L.wechat.config();
        if (c.mode === 'live') {
          L.ui.toast('请在微信中完成扫码授权，系统会自动返回', true);
          return;
        }
        var code = L.wechat.demoCode(self.state);
        location.hash = '#/wx-authorize?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(self.state);
      };
    }
  };

  /* ---------- 演示授权页（模拟微信确认） ---------- */
  L.views['wx-authorize'] = {
    title: '微信授权',
    render: function (params) {
      var code = params.code || '', state = params.state || '';
      return '<div class="wx-auth-mock"><section class="card" style="max-width:420px;margin:6vh auto 0"><div class="card-pad" style="text-align:center;padding-top:34px">' +
        '<div class="wx-auth-icon">微</div><h2 style="margin:14px 0 8px">微信授权登录</h2>' +
        '<div class="small faint">实验室综合管理系统 申请获取你的微信身份标识（openid），用于登录与实名绑定</div>' +
        '<div class="divider"></div><div class="wx-auth-list"><div>✓ 获取你的微信唯一标识 openid</div><div>✓ 用于区分不同微信号并绑定实验室成员</div><div class="faint">✗ 不获取你的好友、聊天记录等隐私信息</div></div>' +
        '<div class="row" style="gap:10px;margin-top:24px;justify-content:center">' +
        '<button class="btn" id="wxDeny">取消</button><button class="btn primary" id="wxAllow">确认授权</button></div>' +
        '<div class="small faint" style="margin-top:18px">这是本地演示授权页，用于在没有微信服务器时走通完整流程</div>' +
        '</div></section></div>';
    },
    mount: function (root, params) {
      var allow = root.querySelector('#wxAllow');
      if (allow) allow.onclick = function () {
        location.hash = '#/wx-callback?code=' + encodeURIComponent(params.code || '') + '&state=' + encodeURIComponent(params.state || '');
      };
      var deny = root.querySelector('#wxDeny');
      if (deny) deny.onclick = function () { location.hash = '#/wx-error?reason=用户取消了微信授权'; };
    }
  };

  /* ---------- 回调处理 ---------- */
  L.views['wx-callback'] = {
    title: '授权回调',
    lastHandled: '',
    render: function () {
      return '<div class="wx-callback"><section class="card" style="max-width:520px;margin:8vh auto 0"><div class="card-pad" style="text-align:center;padding:40px 24px">' +
        '<div class="wx-spinner"></div><h2 style="margin-top:18px">正在识别微信身份…</h2>' +
        '<div class="small faint">校验授权令牌，换取 openid，查找或创建绑定账号</div></div></section></div>';
    },
    mount: function (root, params) {
      var code = params.code || '';
      var state = params.state || '';
      // 兼容微信回调：code/state 也可能在 location.search 中
      if (!code || !state) {
        var q = new URLSearchParams((location.search || '').replace(/^\?/, ''));
        code = code || q.get('code') || '';
        state = state || q.get('state') || '';
      }
      if (!code && !state) code = 'pending';
      var signature = code + '|' + state;
      if (this.lastHandled === signature) return;
      this.lastHandled = signature;
      L.wechat.exchange(code, state).then(function (profile) {
        var bound = L.wechat.findByOpenId(profile.openid);
        if (bound) {
          if (bound.status === 'disabled') return location.hash = '#/wx-error?reason=' + encodeURIComponent('该微信绑定的账号已停用，请联系管理员');
          L.auth.setSession(bound.id);
          L.store.log('微信扫码登录：' + bound.displayName, '#/account');
          L.ui.toast('微信登录成功：' + bound.displayName);
          return location.hash = '#/account';
        }
        // 未识别：进入绑定页
        location.hash = '#/wx-bind?openid=' + encodeURIComponent(profile.openid) + '&nickname=' + encodeURIComponent(profile.nickname || '微信用户') + '&demo=' + (profile.demo ? '1' : '0');
      }).catch(function (err) {
        location.hash = '#/wx-error?reason=' + encodeURIComponent(L.wechat.codeText(err));
      });
    }
  };

  /* ---------- 未识别用户：绑定成员 ---------- */
  L.views['wx-bind'] = {
    title: '绑定实验室成员',
    render: function (params) {
      var openid = params.openid || '';
      var nickname = params.nickname || '微信用户';
      var boundIds = L.wechat.boundMemberIds();
      var candidates = L.store.all('members').filter(function (m) {
        return !L.store.isLeft && !L.store.isLeft(m) && boundIds.indexOf(m.id) < 0;
      });
      var group = function (m) { return L.store.name('groups', m.groupId); };
      var a = L.auth.current();
      return '<div class="page-head"><div><h1>绑定实验室成员</h1><p>该微信尚未绑定成员，请选择花名册中的本人以确认身份。</p></div></div>' +
        '<div class="wx-bind-wrap"><section class="card"><div class="card-head"><h2>微信身份</h2></div><div class="card-pad">' +
        '<div class="wx-id-row"><div class="wx-auth-icon sm">微</div><div><b>' + L.ui.esc(nickname) + '</b><div class="small faint">openid：' + L.ui.esc(openid.slice(0, 12)) + '…' + (params.demo === '1' ? '（演示身份）' : '') + '</div></div></div>' +
        '<div class="schema-note" style="margin-top:12px">一个微信号只能绑定一名成员，绑定后即以该成员真实姓名实名发言；如需变更请联系管理员解绑。</div>' +
        '</div></section>' +
        '<section class="card"><div class="card-head"><h2>选择本人成员</h2><div class="right">' + L.ui.badge(candidates.length + ' 位可绑定') + '</div></div><div class="card-pad">' +
        (a ? '<div class="schema-note" style="margin-bottom:12px">当前已登录 ' + L.ui.esc(a.displayName) + '，也可直接把该微信绑定到当前账号。</div>' : '') +
        (candidates.length ? '<div class="wx-member-list">' + candidates.map(function (m) {
          return '<div class="wx-member-row" data-bind-member="' + m.id + '">' + L.ui.avatar(m.name, m.id) +
            '<div class="wx-member-meta"><b>' + L.ui.esc(m.name) + '</b><div class="small faint">' + L.ui.esc(group(m)) + ' · ' + L.ui.esc(m.title || '成员') + (m.studentNo ? ' · ' + L.ui.esc(m.studentNo) : '') + '</div></div>' +
            '<button class="btn sm primary">绑定</button></div>';
        }).join('') + '</div>' : '<div class="wx-empty">花名册成员均已绑定微信，如需解绑请联系管理员。</div>') +
        (a ? '<div class="divider"></div><button class="btn" id="wxBindCurrent">绑定为当前账号「' + L.ui.esc(a.displayName) + '」</button>' : '') +
        '</div></section></div>';
    },
    mount: function (root, params) {
      var openid = params.openid || '';
      var nickname = params.nickname || '微信用户';
      var profile = { openid: openid, unionid: '', nickname: nickname, avatar: '', demo: params.demo === '1' };
      root.querySelectorAll('[data-bind-member]').forEach(function (row) {
        row.onclick = function () {
          var res = L.wechat.loginOrCreate(profile, row.dataset.bindMember);
          if (!res.ok) return L.ui.toast(res.error, true);
          L.ui.toast(res.created ? '绑定成功，账号已创建（待实名审核）' : '微信登录成功');
          L.app.renderNav(); L.app.renderUser();
          location.hash = '#/account';
        };
      });
      var cur = root.querySelector('#wxBindCurrent');
      if (cur) cur.onclick = function () {
        var res = L.wechat.bindToCurrent(profile);
        if (!res.ok) return L.ui.toast(res.error, true);
        L.ui.toast('微信已绑定到当前账号'); L.app.renderUser(); location.hash = '#/account';
      };
    }
  };

  /* ---------- 授权失败 ---------- */
  L.views['wx-error'] = {
    title: '授权失败',
    render: function (params) {
      var reason = params.reason || '授权失败，请重新扫码';
      return '<div class="wx-callback"><section class="card" style="max-width:520px;margin:8vh auto 0"><div class="card-pad" style="text-align:center;padding:40px 24px">' +
        '<div class="wx-fail-icon">!</div><h2 style="margin-top:16px">微信登录未完成</h2>' +
        '<div class="wx-error-msg">' + L.ui.esc(reason) + '</div>' +
        '<div class="row" style="gap:10px;margin-top:24px;justify-content:center"><button class="btn" data-nav="#/login">返回登录</button><button class="btn primary" id="wxRetry">重新扫码</button></div>' +
        '</div></section></div>';
    },
    mount: function (root) {
      var retry = root.querySelector('#wxRetry');
      if (retry) retry.onclick = function () { L.views.wxlogin.state = ''; location.hash = '#/wxlogin'; };
    }
  };
})(window.LabApp = window.LabApp || {});
