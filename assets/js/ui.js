/* 通用 UI 组件：模态框、表单生成、提示、格式化工具 */
(function (L) {
  'use strict';

  var ui = {
    uid: function (prefix) {
      return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    },
    fmtDate: function (v) {
      if (!v) return '—';
      var s = String(v).replace('T', ' ');
      return s.length > 16 ? s.slice(0, 16) : s;
    },
    timeAgo: function (v) {
      if (!v) return '';
      var d = new Date(String(v).replace(' ', 'T'));
      if (isNaN(d.getTime())) return String(v);
      var diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
      if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
      return d.toLocaleDateString('zh-CN');
    },
    colorOf: function (id) {
      var s = String(id || '');
      var n = 0;
      for (var i = 0; i < s.length; i++) n += s.charCodeAt(i);
      return L.schema.options.COLORS[n % L.schema.options.COLORS.length];
    },
    avatar: function (name, id, size) {
      var text = String(name || '?').slice(-2);
      return '<span class="avatar ' + (size || '') + '" style="background:' + this.colorOf(id || name) + '">' + this.esc(text) + '</span>';
    },
    person: function (member, sub) {
      if (!member) return '<span class="muted">—</span>';
      return '<div class="person">' + this.avatar(member.name, member.id) + '<div><div class="p-name">' + this.esc(member.name) + '</div><div class="p-sub">' + this.esc(sub || member.title || '') + '</div></div></div>';
    },
    badge: function (text, cls) { return '<span class="badge ' + (cls || '') + '">' + this.esc(text) + '</span>'; },
    status: function (s) { return this.badge(s || '未设置', L.schema.statusClass(s) + ' dot'); },
    progress: function (n) {
      n = Math.max(0, Math.min(100, Number(n) || 0));
      return '<div class="progress"><i style="width:' + n + '%"></i></div><span class="small muted">' + n + '%</span>';
    },
    tags: function (str, cls) {
      return String(str || '').split(/[,，]/).map(function (t) {
        t = t.trim();
        return t ? '<span class="tag ' + (cls || '') + '">' + L.ui.esc(t) + '</span>' : '';
      }).join('');
    },
    empty: function (title, hint) {
      return '<div class="empty"><svg class="icon"><use href="#i-folder"/></svg><b>' + this.esc(title || '暂无数据') + '</b><div>' + this.esc(hint || '点击右上角按钮开始创建') + '</div></div>';
    },
    stat: function (label, value, hint, icon, cls) {
      return '<div class="card stat"><div class="label">' + this.esc(label) + '</div><div class="value">' + value + '</div>' + (hint ? '<div class="hint">' + this.esc(hint) + '</div>' : '') +
        '<div class="stat-icon soft-' + (cls || 'primary') + '"><svg class="icon"><use href="#' + icon + '"/></svg></div></div>';
    },
    toast: function (msg, isError) {
      var root = document.getElementById('toastRoot');
      var el = document.createElement('div');
      el.className = 'toast' + (isError ? ' error' : '');
      el.textContent = msg;
      root.appendChild(el);
      setTimeout(function () { el.remove(); }, 2800);
    },
    modal: function (opts) {
      var root = document.getElementById('modalRoot');
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + this.esc(opts.title || '') + '</h3><button class="icon-btn close" style="margin-left:auto"><svg class="icon"><use href="#i-close"/></svg></button></div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        '<div class="modal-foot"><button class="btn cancel">' + this.esc(opts.cancelText || '取消') + '</button><button class="btn primary ok">' + this.esc(opts.okText || '保存') + '</button></div></div>';
      root.innerHTML = '';
      root.appendChild(mask);
      var close = function () { root.innerHTML = ''; };
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
      mask.querySelector('.close').onclick = close;
      mask.querySelector('.cancel').onclick = close;
      mask.querySelector('.ok').onclick = function () {
        var result = opts.onOk ? opts.onOk(mask.querySelector('.modal'), close) : undefined;
        if (result !== false) close();
      };
      var first = mask.querySelector('input:not([type=checkbox]):not([type=radio]), textarea, select');
      if (first) setTimeout(function () { first.focus(); }, 40);
      return mask.querySelector('.modal');
    },
    confirm: function (message, onYes, okText, tone) {
      this.modal({
        title: '确认操作', okText: okText || '确认删除', body: '<p style="margin:0;color:#475569">' + this.esc(message) + '</p>',
        onOk: function () { onYes(); }
      });
      var ok = document.querySelector('#modalRoot .ok');
      if (ok && tone !== 'primary') { ok.classList.remove('primary'); ok.classList.add('danger'); }
    },

    /* 根据 schema 生成表单 */
    buildForm: function (entity, data) {
      var def = L.schema.entities[entity];
      var d = data || {};
      var html = '<div class="form-grid">';
      def.fields.forEach(function (f) {
        var v = d[f.key] == null ? '' : d[f.key];
        var full = f.full ? ' full' : '';
        var req = f.required ? ' data-required="1"' : '';
        html += '<div class="field' + full + '" data-field="' + f.key + '"' + req + '><label>' + L.ui.esc(f.label) + (f.required ? ' *' : '') + '</label>';
        if (f.type === 'textarea') {
          html += '<textarea data-key="' + f.key + '" placeholder="' + L.ui.esc(f.placeholder || '') + '">' + L.ui.esc(v) + '</textarea>';
        } else if (f.type === 'combo') {
          var dlId = 'dl-' + (f.optionKey || f.key);
          var opts = L.store.optionsFor(f.optionKey);
          html += '<input type="text" list="' + dlId + '" data-key="' + f.key + '" value="' + L.ui.esc(v) + '" placeholder="' + L.ui.esc(f.placeholder || '可直接输入自定义值') + '" autocomplete="off">';
          html += '<datalist id="' + dlId + '">' + opts.map(function (o) { return '<option value="' + L.ui.esc(o) + '"></option>'; }).join('') + '</datalist>';
        } else if (f.type === 'select' || f.type === 'color') {
          html += '<select data-key="' + f.key + '">';
          if (!f.required) html += '<option value="">— 未选择 —</option>';
          (f.options || []).forEach(function (o) { html += '<option value="' + L.ui.esc(o) + '"' + (String(v) === String(o) ? ' selected' : '') + '>' + L.ui.esc(o) + '</option>'; });
          html += '</select>';
        } else if (f.type === 'ref') {
          html += '<select data-key="' + f.key + '"><option value="">— 未选择 —</option>';
          L.store.all(f.entity).forEach(function (item) {
            var label = item[f.labelField || L.schema.entities[f.entity].titleField] || item.name || item.title || item.id;
            html += '<option value="' + L.ui.esc(item.id) + '"' + (v === item.id ? ' selected' : '') + '>' + L.ui.esc(String(label).slice(0, 40)) + '</option>';
          });
          html += '</select>';
        } else if (f.type === 'multiRef') {
          var chosen = Array.isArray(v) ? v : [];
          html += '<div class="check-list" data-multi="' + f.key + '">';
          L.store.all(f.entity).forEach(function (item) {
            html += '<label><input type="checkbox" value="' + L.ui.esc(item.id) + '"' + (chosen.indexOf(item.id) >= 0 ? ' checked' : '') + '>' + L.ui.esc(item.name || item.title || item.id) + '</label>';
          });
          html += '</div>';
        } else {
          html += '<input type="' + (f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime-local' ? 'datetime-local' : 'text') + '" data-key="' + f.key + '" value="' + L.ui.esc(v) + '" placeholder="' + L.ui.esc(f.placeholder || '') + '"' + (f.type === 'number' ? ' min="0" max="100"' : '') + '>';
        }
        if (f.hint) html += '<div class="hintline">' + L.ui.esc(f.hint) + '</div>';
        html += '</div>';
      });
      return html + '</div>';
    },
    readForm: function (root) {
      var out = {};
      root.querySelectorAll('[data-key]').forEach(function (el) { out[el.dataset.key] = el.value.trim(); });
      root.querySelectorAll('[data-multi]').forEach(function (box) {
        out[box.dataset.multi] = Array.from(box.querySelectorAll('input:checked')).map(function (i) { return i.value; });
      });
      return out;
    },
    validateForm: function (root) {
      var invalid = [];
      root.querySelectorAll('[data-required]').forEach(function (wrap) {
        var key = wrap.dataset.field;
        var el = wrap.querySelector('[data-key="' + key + '"]');
        var multi = wrap.querySelector('[data-multi="' + key + '"]');
        var val = el ? el.value.trim() : (multi ? multi.querySelectorAll('input:checked').length : 0);
        if (!val) { invalid.push(wrap.querySelector('label').textContent.replace(' *', '')); wrap.style.outline = '2px solid #fca5a5'; wrap.style.borderRadius = '8px'; }
        else { wrap.style.outline = ''; }
      });
      if (invalid.length) { this.toast('请填写：' + invalid.join('、'), true); return false; }
      return true;
    },
    formModal: function (opts) {
      var self = this;
      var entity = opts.entity;
      var def = L.schema.entities[entity];
      var modal = this.modal({
        title: opts.title || ((opts.data ? '编辑' : '新增') + def.singular), wide: !!def.fields.some(function (f) { return f.full; }),
        body: self.buildForm(entity, Object.assign({}, opts.defaults || {}, opts.data || {})),
        onOk: function (root, close) {
          if (!self.validateForm(root)) return false;
          var values = self.readForm(root);
          if (values.progress !== undefined) values.progress = Math.max(0, Math.min(100, Number(values.progress) || 0));
          if (opts.onSave) opts.onSave(values, opts.data);
        }
      });
      return modal;
    }
  };

  L.ui = ui;
})(window.LabApp = window.LabApp || {});
