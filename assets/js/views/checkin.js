/* 轻量进站登记页：扫码一次 → 填姓名学号 → 花名册精确匹配 → 写入云端进站记录。
   不需微信登录；微信绑定作为可选入口放在页尾。 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  L.views['checkin'] = {
    title: '进站登记',
    state: { last: null, records: null, recordsOpen: false, loading: false },

    render: function () {
      var self = this;
      var st = this.state;
      var groups = L.store.all('groups') || [];
      var groupOpts = '<option value="">— 自动识别 —</option>' + groups.map(function (g) {
        return '<option value="' + L.ui.esc(g.name) + '">' + L.ui.esc(g.name) + '</option>';
      }).join('');

      var success = '';
      if (st.last && st.last.ok) {
        var m = st.last.member;
        success = '<section class="card card-pad checkin-ok">' +
          '<div class="checkin-ok-mark"><svg class="icon"><use href="#i-check"/></svg></div>' +
          '<h2>登记成功</h2>' +
          '<p class="small muted">欢迎回组，' + L.ui.esc(m.name) + '。进站记录已保存。</p>' +
          '<div class="kv" style="max-width:360px;margin:12px auto">' +
          '<dt>成员编号</dt><dd>' + L.ui.esc(m.id) + '</dd>' +
          '<dt>组别</dt><dd>' + L.ui.esc(st.last.groupName || '—') + '</dd>' +
          '<dt>进站时间</dt><dd>' + L.ui.esc(L.ui.fmtDate(st.last.at)) + '</dd>' +
          '</div>' +
          '<button class="btn primary" id="ckAgain">登记下一位</button>' +
          '</section>';
      } else if (st.last && !st.last.ok) {
        success = '<section class="card card-pad checkin-fail">' +
          '<div class="small" style="color:var(--danger,#c00)">' + L.ui.esc(st.last.error || '登记失败') + '</div>' +
          '</section>';
      }

      var adminSection = '';
      if (L.cloud.available() && L.cloud.isCloudAdmin) {
        adminSection = '<section class="card" style="margin-top:16px">' +
          '<div class="card-head"><h2>进站记录</h2><div class="right">' +
          '<button class="btn sm" id="ckToggleRecords">' + (st.recordsOpen ? '收起' : '查看') + '</button></div></div>' +
          (st.recordsOpen ? '<div class="card-pad" id="ckRecords">' + this.recordsHtml() + '</div>' : '') +
          '</section>';
      }

      return '<div class="page-head"><div><h1>进站登记</h1><p>填真实姓名与学号，系统对照花名册精确匹配后保存进站记录。</p></div></div>' +
        '<div class="checkin-wrap">' +
        '<section class="card card-pad checkin-card">' +
          '<div class="schema-note" style="margin-bottom:16px">请填写花名册中的<strong>姓名</strong>和<strong>学号 / 工号</strong>，两项都一致才算登记成功。信息不匹配不会写入记录。</div>' +
          '<div class="stack">' +
            '<div class="field"><label>真实姓名 *</label><input id="ckName" placeholder="花名册中的姓名" autocomplete="off"></div>' +
            '<div class="field"><label>学号 / 工号 *</label><input id="ckNo" placeholder="花名册中的学号" autocomplete="off"></div>' +
            '<div class="field"><label>组别（可选）</label><select id="ckGroup">' + groupOpts + '</select></div>' +
            '<button class="btn primary" id="ckSubmit"' + (st.loading ? ' disabled' : '') + '>' + (st.loading ? '正在登记…' : '确认进站登记') + '</button>' +
          '</div>' +
        '</section>' +
        success +
        adminSection +
        '<section class="card card-pad checkin-foot">' +
          '<p class="small muted" style="margin:0 0 10px">以上是进站登记。若还需要把微信身份绑定到实验室成员，可前往：</p>' +
          '<button class="btn" data-nav="#/wx-bind">微信登录与绑定（可选）</button>' +
        '</section>' +
        '</div>';
    },

    recordsHtml: function () {
      var st = this.state;
      if (st.records === null) return '<div class="small muted">点击「查看」加载进站记录（仅管理员可见）。</div>';
      if (!st.records.length) return L.ui.empty('暂无进站记录');
      return '<div class="table-wrap"><table><thead><tr><th>姓名</th><th>学号</th><th>组别</th><th>方式</th><th>时间</th></tr></thead><tbody>' +
        st.records.map(function (r) {
          return '<tr><td>' + L.ui.esc(r.member_name || '—') + '</td><td>' + L.ui.esc(r.student_no || '—') + '</td>' +
            '<td>' + L.ui.esc(r.group_name || '—') + '</td><td>' + (r.client === 'wechat' ? '微信' : '扫码') + '</td>' +
            '<td>' + L.ui.esc(L.ui.fmtDate(r.checked_at)) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    },

    mount: function (root) {
      var self = this;
      var submit = root.querySelector('#ckSubmit');
      if (submit) submit.onclick = function () {
        var name = root.querySelector('#ckName').value.trim();
        var no = root.querySelector('#ckNo').value.trim();
        var group = root.querySelector('#ckGroup') ? root.querySelector('#ckGroup').value : '';
        if (!name || !no) return L.ui.toast('请填写姓名和学号', true);

        var member = L.cloud.matchMember(name, no);
        if (!member) {
          self.state.last = { ok: false, error: '花名册中没有找到"' + name + ' / ' + no + '"，请核对姓名与学号后重试。' };
          return L.app.refresh();
        }
        self.state.loading = true;
        L.app.refresh();
        L.cloud.recordCheckin(name, no).then(function (r) {
          self.state.loading = false;
          self.state.last = {
            ok: true,
            member: r.member,
            groupName: group || (r.row && r.row.group_name) || '',
            at: r.at
          };
          L.app.refresh();
        }).catch(function (e) {
          self.state.loading = false;
          self.state.last = { ok: false, error: (e && e.message) || '进站登记失败，请稍后重试' };
          L.app.refresh();
        });
      };

      var again = root.querySelector('#ckAgain');
      if (again) again.onclick = function () { self.state.last = null; L.app.refresh(); };

      var toggle = root.querySelector('#ckToggleRecords');
      if (toggle) toggle.onclick = function () {
        self.state.recordsOpen = !self.state.recordsOpen;
        if (self.state.recordsOpen && self.state.records === null) {
          L.cloud.listCheckins(100).then(function (list) { self.state.records = list; L.app.refresh(); })
            .catch(function (e) { L.ui.toast((e && e.message) || '读取失败', true); });
          return;
        }
        L.app.refresh();
      };
    }
  };
})(window.LabApp = window.LabApp || {});
