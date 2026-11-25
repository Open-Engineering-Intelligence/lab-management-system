/* 微信登录与人员绑定：扫码登录 → 填姓名学号 → 对照花名册绑定成员 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  L.views['wx-bind'] = {
    title: '微信登录与绑定',
    state: { tab: 'bind', mine: null, all: [], isAdmin: false, loading: false, loaded: false },

    render: function () {
      var self = this;
      var st = this.state;
      if (!L.cloud.available()) {
        return '<div class="page-head"><div><h1>微信登录与绑定</h1><p>使用微信扫码识别身份并绑定实验室成员。</p></div></div>' +
          '<section class="card card-pad" style="max-width:640px">' +
          '<div class="wx-tip-title">需要在已发布的网址中使用</div>' +
          '<p class="small muted">你现在是通过本地文件打开的系统。微信扫码登录属于在线功能，需要在系统发布后的网址里打开才能使用。本地版本仍可照常使用账号密码登录与全部管理功能。</p>' +
          '<div class="wx-flow">' +
          '<div class="wx-flow-step"><span>1</span><div>系统发布到在线网址</div></div>' +
          '<div class="wx-flow-step"><span>2</span><div>打开在线网址，点“微信扫码登录”</div></div>' +
          '<div class="wx-flow-step"><span>3</span><div>填写姓名与学号，自动绑定实验室成员</div></div>' +
          '</div></section>';
      }

      var signed = L.cloud.isSignedIn();
      var sess = L.cloud.session();
      var head = '<div class="page-head"><div><h1>微信登录与绑定</h1><p>微信扫码识别身份，填写姓名与学号后自动绑定到花名册中的实验室成员。</p></div></div>';

      if (!signed) {
        return head + '<section class="card card-pad" style="max-width:560px">' +
          '<div class="wx-login-box">' +
          '<div class="wx-login-mark">微</div>' +
          '<div style="font-size:16px;font-weight:600;margin:12px 0 6px">使用微信扫码登录</div>' +
          '<p class="small muted" style="margin:0 0 18px">扫码后填写真实姓名与学号，系统会对照花名册完成成员绑定。</p>' +
          '<button class="btn primary" id="wxSignIn">微信扫码登录</button>' +
          '</div></section>';
      }

      var tabs = [['bind', '我的绑定'], ['review', '绑定审核' + (st.isAdmin && st.all.filter(function (b) { return b.status === 'pending'; }).length ? ' · ' + st.all.filter(function (b) { return b.status === 'pending'; }).length : '')]];
      var name = (sess.user && sess.user.name) || '微信用户';
      var body = '';
      if (st.tab === 'bind') {
        var m = st.mine;
        var statusText = !m ? '未绑定' : ({ approved: '已绑定成员', pending: '待管理员核对', rejected: '已驳回' })[m.status] || m.status;
        var statusCls = !m ? '' : (m.status === 'approved' ? 'green' : m.status === 'pending' ? 'amber' : '');
        body = '<section class="card"><div class="card-head"><h2>当前微信身份</h2><div class="right">' + L.ui.badge(statusText, statusCls) + '</div></div><div class="card-pad">' +
          '<div class="kv"><dt>微信昵称</dt><dd>' + L.ui.esc(name) + '</dd>' +
          '<dt>绑定成员</dt><dd>' + (m && m.member_name ? L.ui.esc(m.member_name) : '—') + '</dd>' +
          '<dt>学号</dt><dd>' + (m && m.student_no ? L.ui.esc(m.student_no) : '—') + '</dd>' +
          '<dt>分组</dt><dd>' + (m && m.group_name ? L.ui.esc(m.group_name) : '—') + '</dd>' +
          (m && m.reject_reason ? '<dt>驳回原因</dt><dd>' + L.ui.esc(m.reject_reason) + '</dd>' : '') +
          '</div></section>' +
          '<section class="card" style="margin-top:16px"><div class="card-head"><h2>' + (m ? '重新绑定' : '绑定到实验室成员') + '</h2></div><div class="card-pad">' +
          '<div class="schema-note" style="margin-bottom:14px">请填写花名册中的真实姓名与学号。两项都匹配时自动绑定为对应成员；匹配不到会提交给管理员核对。</div>' +
          '<div class="stack">' +
          '<div class="field"><label>真实姓名 *</label><input id="wxName" value="' + L.ui.esc(m ? (m.member_name || '') : '') + '" placeholder="花名册中的姓名"></div>' +
          '<div class="field"><label>学号 / 工号 *</label><input id="wxNo" value="' + L.ui.esc(m ? (m.student_no || '') : '') + '" placeholder="花名册中的学号"></div>' +
          '<div class="field"><label>分组</label><select id="wxGroup">' + groupOpts(m ? m.group_name : '') + '</select></div>' +
          '<button class="btn primary" id="wxSubmit" style="align-self:flex-start">' + (m ? '更新绑定' : '提交绑定') + '</button>' +
          '</div></div></section>';
      } else if (st.isAdmin) {
        var pending = st.all.filter(function (b) { return b.status === 'pending'; });
        body = '<section class="card"><div class="card-head"><h2>待核对绑定</h2><div class="right">' + L.ui.badge(pending.length + ' 条') + '</div></div><div class="card-pad">' +
          (pending.length ? pending.map(function (b) {
            return '<div class="list-item spread"><div><div><b>' + L.ui.esc(b.member_name || '未填姓名') + '</b> · ' + L.ui.esc(b.student_no || '未填学号') + '</div>' +
              '<div class="small faint">微信：' + L.ui.esc(b.owner_name || '—') + ' · 提交：' + L.ui.fmtDate(b.created_at) + '</div></div>' +
              '<div class="row"><button class="btn sm primary" data-wxreview="approve" data-id="' + b.id + '">通过</button>' +
              '<button class="btn sm" data-wxreview="reject" data-id="' + b.id + '">驳回</button></div></div>';
          }).join('') : L.ui.empty('没有待核对的绑定申请', '姓名与学号都能匹配花名册时会自动绑定')) +
          '</div></section>' +
          '<section class="card" style="margin-top:16px"><div class="card-head"><h2>全部绑定记录</h2><div class="right">' + L.ui.badge(st.all.length + ' 条') + '</div></div><div class="card-pad">' +
          (st.all.length ? '<div class="table-wrap"><table><thead><tr><th>姓名</th><th>学号</th><th>分组</th><th>微信</th><th>状态</th></tr></thead><tbody>' +
            st.all.map(function (b) {
              var sc = b.status === 'approved' ? 'green' : b.status === 'pending' ? 'amber' : '';
              var sl = ({ approved: '已绑定', pending: '待核对', rejected: '已驳回' })[b.status] || b.status;
              return '<tr><td>' + L.ui.esc(b.member_name || '—') + '</td><td>' + L.ui.esc(b.student_no || '—') + '</td><td>' + L.ui.esc(b.group_name || '—') + '</td><td>' + L.ui.esc(b.owner_name || '—') + '</td><td>' + L.ui.badge(sl, sc) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : L.ui.empty('暂无微信绑定记录')) +
          '</div></section>';
      } else {
        body = '<section class="card card-pad"><p class="small muted">绑定审核仅管理员可查看。</p></section>';
      }

      return head + '<section class="card" style="margin-bottom:16px"><div class="tabs">' + tabs.map(function (t) {
        return '<div class="tab ' + (st.tab === t[0] ? 'active' : '') + '" data-wxtab="' + t[0] + '">' + t[1] + '</div>';
      }).join('') + '</div><div class="card-pad row" style="gap:10px"><span class="small muted">已用微信登录：' + L.ui.esc(name) + '</span>' +
        '<button class="btn sm" id="wxSignOut">退出微信登录</button>' +
        (st.isAdmin ? '' : '<button class="btn sm ghost" id="wxClaim">认领管理员</button>') + '</div></section>' + body;
    },

    mount: function (root) {
      var self = this;
      var signIn = root.querySelector('#wxSignIn');
      if (signIn) signIn.onclick = function () {
        L.cloud.signInWithWechat().catch(function (e) { L.ui.toast(e.message || '微信登录失败', true); });
      };
      var signOut = root.querySelector('#wxSignOut');
      if (signOut) signOut.onclick = function () {
        L.cloud.signOut().then(function () { self.state.loaded = false; self.state.mine = null; L.app.refresh(); });
      };
      var claim = root.querySelector('#wxClaim');
      if (claim) claim.onclick = function () {
        L.ui.confirm('认领本系统的微信管理员？仅当尚无管理员时可认领，认领后可审核成员绑定。', function () {
          L.cloud.claimAdmin().then(function (r) {
            if (!r.ok) return L.ui.toast(r.error || '认领失败', true);
            L.ui.toast(r.already ? '你已是管理员' : '已认领管理员');
            self.state.loaded = false;
            L.app.refresh();
          });
        }, '确认认领', 'primary');
      };
      root.querySelectorAll('[data-wxtab]').forEach(function (el) {
        el.onclick = function () { self.state.tab = el.dataset.wxtab; if (self.state.tab === 'review' && !self.state.loaded) self.load(); else L.app.refresh(); };
      });
      var submit = root.querySelector('#wxSubmit');
      if (submit) submit.onclick = function () {
        var nm = root.querySelector('#wxName').value.trim();
        var no = root.querySelector('#wxNo').value.trim();
        var grp = root.querySelector('#wxGroup').value;
        if (!nm || !no) return L.ui.toast('请填写真实姓名和学号', true);
        var hit = L.cloud.matchMember(nm, no);
        var doIt = function () {
          L.ui.toast('正在提交…');
          L.cloud.submitBinding(nm, no, grp).then(function (r) {
            self.state.mine = r.data;
            var msg = r.matched ? ('已自动绑定到成员：' + (r.member && r.member.name)) : '已提交，等待管理员核对';
            L.ui.modal({
              title: '绑定提交结果',
              body: '<div class="schema-note">' + L.ui.esc(msg) + '</div>',
              okText: '知道了', cancelText: '关闭',
              onOk: function () {}
            });
            L.app.refresh();
          }).catch(function (e) { L.ui.toast(e.message || '提交失败', true); });
        };
        if (!hit) {
          L.ui.confirm('花名册中没有找到“' + nm + ' / ' + no + '”，仍要提交给管理员核对吗？', doIt, '仍要提交', 'primary');
        } else {
          L.ui.confirm('将绑定到花名册成员「' + hit.name + '」[' + hit.id + ']，确认吗？', doIt, '确认绑定', 'primary');
        }
      };
      root.querySelectorAll('[data-wxreview]').forEach(function (btn) {
        btn.onclick = function () {
          var id = Number(btn.dataset.id);
          var approve = btn.dataset.wxreview === 'approve';
          var apply = function (reason) {
            L.cloud.reviewBinding(id, approve, reason).then(function () {
              L.ui.toast(approve ? '已通过绑定' : '已驳回绑定');
              self.state.loaded = false;
              self.load();
            }).catch(function (e) { L.ui.toast(e.message || '审核失败', true); });
          };
          if (approve) {
            L.ui.confirm('确认通过该成员的微信绑定申请？', function () { apply(''); }, '确认通过', 'primary');
          } else {
            L.ui.modal({
              title: '驳回绑定申请',
              body: '<div class="field"><label>驳回原因</label><input id="wxRejectReason" placeholder="如：姓名与花名册不一致"></div>',
              okText: '确认驳回',
              onOk: function (modal) { apply(modal.querySelector('#wxRejectReason').value); }
            });
          }
        };
      });
      if (!self.state.loaded) self.load();
    },

    load: function () {
      var self = this;
      if (!L.cloud.isSignedIn()) return;
      self.state.loaded = true;
      L.cloud.isCloudAdmin().then(function (adm) {
        self.state.isAdmin = adm;
        return L.cloud.myBinding();
      }).then(function (mine) {
        self.state.mine = mine;
        if (self.state.isAdmin) return L.cloud.allBindings().then(function (all) { self.state.all = all; });
      }).then(function () { L.app.refresh(); })
        .catch(function () { L.ui.toast('读取云端绑定信息失败', true); });
    }
  };

  function groupOpts(value) {
    var groups = L.store.all('groups') || [];
    return '<option value="">— 未选择 —</option>' + groups.map(function (g) {
      return '<option value="' + L.ui.esc(g.name) + '"' + (value === g.name ? ' selected' : '') + '>' + L.ui.esc(g.name) + '</option>';
    }).join('');
  }
})(window.LabApp = window.LabApp || {});
