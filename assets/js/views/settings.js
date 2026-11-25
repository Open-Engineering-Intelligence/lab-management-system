/* 设置：当前用户、实验室说明、数据备份与数据结构说明 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  function dataStructureTable() {
    return '<div class="table-wrap"><table><thead><tr><th>实体</th><th>说明</th><th>主要字段</th></tr></thead><tbody>' +
      Object.keys(L.schema.entities).map(function (k) {
        var def = L.schema.entities[k];
        return '<tr><td><code class="code">' + k + '</code></td><td>' + L.ui.esc(def.label) + (def.hidden ? '（关联表）' : '') + '</td><td class="small">' +
          def.fields.map(function (f) { return '<code class="code">' + f.key + '</code>'; }).join(' ') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* 成员身份选项：可自由增删，编辑成员时作为建议项，输入新值也会自动加入 */
  var OPTION_GROUPS = [
    { key: 'memberRole', label: '组内角色', hint: '如：负责人、骨干、访问学生等' },
    { key: 'memberTitle', label: '职称 / 身份', hint: '如：教授、博士生、工程师等' },
    { key: 'memberStatus', label: '成员状态', hint: '如：在读、在职、毕业等' }
  ];

  function optionManager() {
    return OPTION_GROUPS.map(function (g) {
      var list = L.store.optionsFor(g.key);
      return '<div class="opt-group" data-optgroup="' + g.key + '">' +
        '<div class="opt-head"><b>' + L.ui.esc(g.label) + '</b><span class="small faint">' + L.ui.esc(g.hint) + '</span></div>' +
        '<div class="opt-list">' + (list.length ? list.map(function (v) {
          return '<span class="opt-item"><span>' + L.ui.esc(v) + '</span><button class="opt-del" data-optdel="' + L.ui.esc(v) + '" title="删除该选项">×</button></span>';
        }).join('') : '<span class="small faint">暂无选项，可在下方添加</span>') + '</div>' +
        '<div class="opt-add"><input type="text" data-optinput placeholder="输入新的' + L.ui.esc(g.label) + '" aria-label="新增' + L.ui.esc(g.label) + '"><button class="btn sm" data-optadd>添加</button></div>' +
        '</div>';
    }).join('');
  }



  L.views.settings = {
    title: '设置',
    render: function () {
      var s = L.store.state.settings;
      var memberOpts = L.store.all('members').map(function (m) { return '<option value="' + m.id + '"' + (s.currentUserId === m.id ? ' selected' : '') + '>' + L.ui.esc(m.name) + ' · ' + L.ui.esc(L.store.name('groups', m.groupId)) + '</option>'; }).join('');
      return '<div class="page-head"><div><h1>设置</h1><p>配置当前使用者、维护实验室说明，并管理本地数据备份。</p></div></div>' +
        '<div class="grid cols-2"><section class="card"><div class="card-head"><h2>基础配置</h2></div><div class="card-pad stack">' +
        (L.auth.isLoggedIn() ? '<div class="schema-note">当前登录账号：<b>' + L.ui.esc(L.auth.current().displayName) + '</b>（' + L.ui.esc(L.auth.labelRole(L.auth.current().role)) + '），发言身份由账号实名信息决定；如需切换请到账号中心退出登录。</div><input type="hidden" id="setUser" value="' + L.ui.esc(L.auth.current().memberId || s.currentUserId) + '">' : '<div class="field"><label>默认关联成员（未登录时用于登记资料）</label><select id="setUser">' + memberOpts + '</select></div>') +
        '<div class="field"><label>实验室名称</label><input id="setLabName" value="' + L.ui.esc(s.labName || '') + '"></div>' +
        '<div class="field"><label>实验室简介（显示在总览页）</label><textarea id="setIntro" style="min-height:100px" placeholder="粘贴或填写实验室情况说明">' + L.ui.esc(s.labIntro || '') + '</textarea></div>' +
        '<div class="field"><label>补充说明 / 原文摘录</label><textarea id="setNotes" style="min-height:100px" placeholder="可粘贴邮件中的实验室说明原文，便于后续结构化录入">' + L.ui.esc(s.notes || '') + '</textarea></div>' +
        '<button class="btn primary" id="setSave" style="align-self:flex-start">保存配置</button></div></section>' +

        '<section class="card"><div class="card-head"><h2>数据管理</h2></div><div class="card-pad stack">' +
        '<div class="schema-note">数据保存在当前浏览器的本地存储中。清除浏览器数据会丢失内容，建议定期导出 JSON 备份。</div>' +
        '<div class="row"><button class="btn" id="btnExport"><svg class="icon"><use href="#i-download"/></svg>导出 JSON 备份</button>' +
        '<button class="btn" id="btnImport"><svg class="icon"><use href="#i-upload"/></svg>导入 JSON 备份</button>' +
        '<input type="file" id="importFile" accept=".json,application/json" hidden></div>' +
        '<div class="row" style="margin-top:6px"><button class="btn danger" id="btnReset"><svg class="icon"><use href="#i-refresh"/></svg>恢复初始数据</button></div>' +
        '<div class="divider"></div><div class="small muted">当前数据量：' + L.store.all('groups').length + ' 个课题组 · ' + L.store.all('members').length + ' 位成员 · ' + L.store.all('projects').length + ' 个项目 · ' + L.store.all('tasks').length + ' 项任务 · ' + L.store.all('assets').length + ' 项资产 · ' + L.store.all('locations').length + ' 个场所 · ' + L.store.all('accessRecords').length + ' 条进出 · ' + L.store.all('assetFlows').length + ' 条流转 · ' + L.store.all('notices').length + ' 条信息 · ' + L.store.all('noticeReceipts').length + ' 条触达 · ' + L.store.all('posts').length + ' 条讨论 · ' + L.store.all('resources').length + ' 份资料</div>' +
        '</div></section></div>' +

        '<section class="card" style="margin-top:16px"><div class="card-head"><h2>成员身份选项</h2><div class="right"><span class="small faint">编辑成员时作为建议项，也可直接输入新值</span></div></div><div class="card-pad">' +
        '<div class="schema-note" style="margin-bottom:14px">这里管理「组内角色 / 职称身份 / 成员状态」的下拉建议项。填写成员时既能选择这些选项，也能直接输入任意文本；输入的新身份会自动保存到对应列表，供以后复用。删除选项不会改动已填写成员的现有值。</div>' +
        '<div class="opt-manager">' + optionManager() + '</div></div></section>' +

        '<section class="card" style="margin-top:16px"><div class="card-head"><h2>数据结构</h2><div class="right">' + L.ui.badge('版本 v' + (L.store.state.version || 1)) + '</div></div><div class="card-pad">' + dataStructureTable() + '</div></section>' +

        '<section class="card card-pad" style="margin-top:16px"><h3 style="font-size:14px;margin:0 0 8px">扩展方式</h3><ul class="help-list">' +
        '<li>新增字段：<code class="code">assets/js/schema.js</code> 中对应实体的 <code class="code">fields</code> 增加一项，表单与编辑弹窗自动生效。</li>' +
        '<li>新增实体：在 schema 中登记实体与字段，在 <code class="code">store.js</code> 的 ENTITIES 数组中加入键名，然后新增一个视图文件并在 <code class="code">index.html</code> 引入。</li>' +
        '<li>接入后端：只需把 store 中的 all/find/insert/update/remove 改成 API 请求，页面代码无需改动。</li></ul></section>';
    },

    mount: function (root) {
      var self = this;
      root.querySelectorAll('[data-optgroup]').forEach(function (group) {
        var key = group.dataset.optgroup;
        var input = group.querySelector('[data-optinput]');
        var add = function () {
          var value = input.value.trim();
          if (!value) return;
          if (L.store.rememberOption(key, value)) L.ui.toast('已添加选项：' + value);
          else L.ui.toast('该选项已存在', true);
          input.value = '';
          L.app.refresh();
        };
        group.querySelector('[data-optadd]').onclick = add;
        input.onkeydown = function (e) { if (e.key === 'Enter') add(); };
        group.querySelectorAll('[data-optdel]').forEach(function (btn) {
          btn.onclick = function () {
            var v = btn.dataset.optdel;
            L.ui.confirm('删除选项「' + v + '」？已填写该身份的成员不受影响。', function () {
              L.store.removeOption(key, v);
              L.ui.toast('已删除选项：' + v);
              L.app.refresh();
            });
          };
        });
      });

      var save = root.querySelector('#setSave');
      if (save) save.onclick = function () {
        L.store.state.settings.currentUserId = root.querySelector('#setUser').value;
        L.store.state.settings.labName = root.querySelector('#setLabName').value.trim();
        L.store.state.settings.labIntro = root.querySelector('#setIntro').value.trim();
        L.store.state.settings.notes = root.querySelector('#setNotes').value.trim();
        L.store.save();
        L.ui.toast('配置已保存');
        L.app.refresh();
      };
      var exp = root.querySelector('#btnExport');
      if (exp) exp.onclick = function () {
        var blob = new Blob([L.store.exportJSON()], { type: 'application/json;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '实验室项目管理系统-备份-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        L.ui.toast('备份已导出');
      };
      var imp = root.querySelector('#btnImport');
      if (imp) imp.onclick = function () { root.querySelector('#importFile').click(); };
      var file = root.querySelector('#importFile');
      if (file) file.onchange = function () {
        var f = file.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try { L.store.importJSON(reader.result); L.auth.init(); L.ui.toast('导入成功'); L.app.refresh(); }
          catch (e) { L.ui.toast('导入失败：' + e.message, true); }
        };
        reader.readAsText(f, 'utf-8');
      };
      var reset = root.querySelector('#btnReset');
      if (reset) reset.onclick = function () {
        L.ui.confirm('将清空当前所有数据并恢复初始数据，确定继续吗？建议先导出备份。', function () {
          L.store.reset(); L.auth.clearSession(); L.auth.init(); L.ui.toast('已恢复初始数据'); L.app.refresh();
        });
      };
    }
  };
})(window.LabApp = window.LabApp || {});
