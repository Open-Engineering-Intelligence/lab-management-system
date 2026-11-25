/* 统一数据访问层：所有页面只通过 store 读写，后续替换为后端 API 时改动集中在这里 */
(function (L) {
  'use strict';

  var KEY = 'lab-project-hub-v1';
  var ENTITIES = ['groups', 'members', 'projects', 'tasks', 'assets', 'locations', 'projectMembers', 'projectGroups', 'projectLinks', 'assetProjects', 'permissions', 'accessRecords', 'assetFlows', 'notices', 'noticeReceipts', 'posts', 'resources', 'activities'];

  var store = {
    state: null,

    init: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          var oldVersion = parsed && parsed.version;
          this.state = this.normalize(parsed);
          /* 迁移后版本变化，立即持久化，保证清理结果生效 */
          if (this.state.version !== oldVersion) this.save();
          return;
        } catch (e) { /* 数据损坏时使用种子数据 */ }
      }
      this.state = this.normalize(L.seed());
      this.save();
    },

    normalize: function (data) {
      var s = data && typeof data === 'object' ? data : {};
      ENTITIES.forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
      var seed = L.seed();
      var defaults = seed.settings;
      /* 从旧版（仅人员/项目/资产）备份升级时，自动补齐三流实体，避免用户手动重置 */
      if ((!s.version || s.version < 2) && !s.locations.length) {
        ['locations', 'permissions', 'accessRecords', 'assetFlows', 'notices', 'noticeReceipts'].forEach(function (k) {
          s[k] = (seed[k] || []).slice();
        });
        s.version = seed.version || 2;
      }
      /* 升级到任务管理（version 3）：旧缓存补齐任务数据，避免手动重置 */
      if ((!s.version || s.version < 3) && !s.tasks.length) {
        var projectIds = s.projects.map(function (p) { return p.id; });
        s.tasks = (seed.tasks || []).filter(function (t) { return projectIds.indexOf(t.projectId) >= 0; }).slice();
        s.version = 3;
      }
      /* 升级到 version 4：清除旧缓存中模拟生成的数据，只保留问卷真实内容。
         真实成员/课题组/项目、成员-项目关系与用户自定义身份选项全部保留。 */
      if ((!s.version || s.version < 4)) {
        ['tasks', 'assets', 'assetProjects', 'locations', 'permissions', 'accessRecords',
          'assetFlows', 'notices', 'noticeReceipts', 'projectLinks'].forEach(function (k) { s[k] = []; });
        /* 只保留由成员真实组别归属产生的项目-组别关系，去掉人为推断的支撑协作 */
        s.projectGroups = (s.projectGroups || []).filter(function (x) { return x.note === '成员参与'; });
        /* 项目进度由模拟任务汇总得出，清除后归零 */
        (s.projects || []).forEach(function (p) { p.progress = 0; delete p.progressUpdatedAt; });
        s.version = 4;
      }
      s.settings = Object.assign({}, defaults, s.settings || {});
      /* 旧缓存里带有"示例事件/模拟"字样的说明同步更新为问卷真实口径 */
      if (/示例|模拟/.test(s.settings.labIntro || '')) s.settings.labIntro = defaults.labIntro;
      if (/示例|模拟/.test(s.settings.notes || '')) s.settings.notes = defaults.notes;
      if (!s.members.some(function (m) { return m.id === s.settings.currentUserId; })) s.settings.currentUserId = (s.members[0] || {}).id || '';
      /* 自定义可选项：首次使用时用预设值 + 现有数据中出现过的值初始化，之后完全由用户维护 */
      if (!s.fieldOptions || typeof s.fieldOptions !== 'object' || Array.isArray(s.fieldOptions)) s.fieldOptions = {};
      Object.keys(L.schema.entities).forEach(function (ent) {
        (L.schema.entities[ent].fields || []).forEach(function (f) {
          if (f.type !== 'combo' || !f.optionKey) return;
          if (Array.isArray(s.fieldOptions[f.optionKey])) return;
          var list = (f.options || []).slice();
          (s[ent] || []).forEach(function (row) {
            var v = row[f.key];
            if (v && list.indexOf(v) < 0) list.push(v);
          });
          s.fieldOptions[f.optionKey] = list;
        });
      });
      return s;
    },

    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        if (document.getElementById('saveState')) document.getElementById('saveState').textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return true;
      } catch (e) {
        if (window.LabApp.ui) L.ui.toast('保存失败：本地存储空间不足', true);
        return false;
      }
    },

    all: function (entity) { return (this.state[entity] || []).slice(); },
    find: function (entity, id) { return (this.state[entity] || []).find(function (x) { return x.id === id; }) || null; },
    name: function (entity, id, field) {
      var item = this.find(entity, id);
      if (!item) return '—';
      return item[field || (L.schema.entities[entity] || {}).titleField || 'name'] || item.id;
    },

    /* 动态可选项：combo 字段的建议值，完全由用户维护 */
    optionsFor: function (optionKey) {
      return ((this.state.fieldOptions || {})[optionKey] || []).slice();
    },
    rememberOption: function (optionKey, value) {
      value = String(value == null ? '' : value).trim();
      if (!value) return false;
      if (!this.state.fieldOptions) this.state.fieldOptions = {};
      var list = this.state.fieldOptions[optionKey] || (this.state.fieldOptions[optionKey] = []);
      if (list.indexOf(value) >= 0) return false;
      list.push(value);
      this.save();
      return true;
    },
    removeOption: function (optionKey, value) {
      var list = (this.state.fieldOptions || {})[optionKey];
      if (!list) return false;
      var i = list.indexOf(value);
      if (i < 0) return false;
      list.splice(i, 1);
      this.save();
      return true;
    },
    /* 保存记录时，自动把 combo 字段里新输入的值记忆为可选项 */
    rememberComboValues: function (entity, obj) {
      var def = L.schema.entities[entity];
      if (!def) return;
      var self = this;
      (def.fields || []).forEach(function (f) {
        if (f.type === 'combo' && f.optionKey && obj[f.key]) self.rememberOption(f.optionKey, obj[f.key]);
      });
    },

    /* 数据层权限校验：普通用户只读，仅实名发布新讨论属于允许的使用行为 */
    checkWrite: function (entity, op) {
      if (!L.auth || !L.auth.canMutate) return true;
      var res = L.auth.canMutate(entity, op);
      if (!res.ok && L.ui && L.ui.toast) L.ui.toast(res.error, true);
      return res.ok;
    },

    insert: function (entity, obj) {
      if (!this.checkWrite(entity, 'insert')) return null;
      var item = Object.assign({}, obj);
      item.id = item.id || L.ui.uid(entity.slice(0, 2));
      this.rememberComboValues(entity, item);
      if (entity === 'posts' || entity === 'resources') item.createdAt = item.createdAt || new Date().toISOString().slice(0, 16);
      if (['accessRecords', 'assetFlows', 'notices', 'noticeReceipts'].indexOf(entity) >= 0) {
        var t = new Date().toISOString().slice(0, 16);
        ['at', 'publishAt', 'deliveredAt'].forEach(function (k) { if (item[k]) item[k] = String(item[k]).replace(' ', 'T').slice(0, 16); });
        if (entity === 'accessRecords') item.at = item.at || t;
        if (entity === 'assetFlows') item.at = item.at || t;
        if (entity === 'notices') { item.publishAt = item.publishAt || t; item.status = item.status || '已发布'; }
        if (entity === 'noticeReceipts') { item.deliveredAt = item.deliveredAt || t; item.status = item.status || '未读'; }
      }
      (this.state[entity] || (this.state[entity] = [])).push(item);
      var listLink = ({ tasks: '#/projects/' + item.projectId, assets: '#/assets', assetProjects: '#/assets', projectMembers: '#/members', projectGroups: '#/relations', projectLinks: '#/relations', posts: '#/hub', resources: '#/hub', locations: '#/access', permissions: '#/access', accessRecords: '#/access', assetFlows: '#/logistics', notices: '#/notices', noticeReceipts: '#/notices' })[entity] || ('#/' + entity + '/' + item.id);
      this.log('新增' + L.schema.entityLabel(entity) + '：' + (item.name || item.title || (item.content || '').slice(0, 24)), listLink);
      this.save();
      return item;
    },

    update: function (entity, id, patch) {
      if (!this.checkWrite(entity, 'update')) return null;
      var item = this.find(entity, id);
      if (!item) return null;
      Object.assign(item, patch);
      this.rememberComboValues(entity, item);
      this.save();
      return item;
    },

    remove: function (entity, id) {
      if (!this.checkWrite(entity, 'remove')) return false;
      var self = this;
      this.state[entity] = (this.state[entity] || []).filter(function (x) { return x.id !== id; });
      if (entity === 'projects') {
        self.state.tasks = self.state.tasks.filter(function (x) { return x.projectId !== id; });
        ['projectMembers', 'projectGroups', 'projectLinks'].forEach(function (k) {
          self.state[k] = self.state[k].filter(function (x) { return x.projectId !== id && x.from !== id && x.to !== id; });
        });
        self.state.posts = self.state.posts.filter(function (x) { return x.projectId !== id; });
        self.state.resources = self.state.resources.filter(function (x) { return x.projectId !== id; });
        self.state.assetProjects = self.state.assetProjects.filter(function (x) { return x.projectId !== id; });
        self.state.accessRecords = self.state.accessRecords.filter(function (x) { return x.projectId !== id; });
        self.state.assetFlows = self.state.assetFlows.filter(function (x) { return x.projectId !== id; });
        self.state.notices = self.state.notices.filter(function (x) { return x.projectId !== id; });
        self.state.noticeReceipts = self.state.noticeReceipts.filter(function (x) { return !self.find('notices', x.noticeId); });
      }
      if (entity === 'assets') {
        self.state.assetProjects = self.state.assetProjects.filter(function (x) { return x.assetId !== id; });
        self.state.assetFlows = self.state.assetFlows.filter(function (x) { return x.assetId !== id; });
      }
      if (entity === 'locations') {
        self.state.accessRecords = self.state.accessRecords.filter(function (x) { return x.locationId !== id; });
        self.state.assetFlows = self.state.assetFlows.filter(function (x) { return x.fromLocationId !== id && x.toLocationId !== id; });
        self.state.permissions = self.state.permissions.filter(function (x) { return x.locationId !== id; });
        self.state.notices = self.state.notices.filter(function (x) { return x.locationId !== id; });
        self.state.noticeReceipts = self.state.noticeReceipts.filter(function (x) { return x.locationId !== id; });
      }
      if (entity === 'notices') {
        self.state.noticeReceipts = self.state.noticeReceipts.filter(function (x) { return x.noticeId !== id; });
      }
      if (entity === 'members') {
        self.state.projectMembers = self.state.projectMembers.filter(function (x) { return x.memberId !== id; });
        self.state.tasks.forEach(function (t) { if (t.ownerId === id) t.ownerId = ''; });
        self.state.assets.forEach(function (a) { if (a.custodianId === id) a.custodianId = ''; });
        self.state.locations.forEach(function (a) { if (a.custodianId === id) a.custodianId = ''; });
        self.state.accessRecords = self.state.accessRecords.filter(function (x) { return x.memberId !== id; });
        self.state.permissions = self.state.permissions.filter(function (x) { return x.memberId !== id && x.approvedBy !== id; });
        self.state.assetFlows = self.state.assetFlows.filter(function (x) { return x.memberId !== id; });
        self.state.notices = self.state.notices.filter(function (x) { return x.authorId !== id; });
        self.state.noticeReceipts = self.state.noticeReceipts.filter(function (x) { return x.memberId !== id; });
        /* 账号保留但解除与已删除成员的绑定，避免发言署名指向不存在的成员 */
        (self.state.accounts || []).forEach(function (a) { if (a.memberId === id) a.memberId = ''; });
      }
      if (entity === 'groups') {
        self.state.projectGroups = self.state.projectGroups.filter(function (x) { return x.groupId !== id; });
      }
      this.log('删除' + L.schema.entityLabel(entity), '#/' + entity + 's');
      this.save();
    },

    log: function (text, link) {
      this.state.activities.unshift({ id: L.ui.uid('ac'), text: text, link: link || '', createdAt: new Date().toISOString(), actorId: this.state.settings.currentUserId });
      if (this.state.activities.length > 80) this.state.activities.length = 80;
    },

    /* ---- 项目人员增减 ---- */
    /* 单个项目批量加入成员：自动跳过已在本项目的人、无效成员，写日志 */
    addProjectMembers: function (projectId, memberIds, role) {
      if (!this.checkWrite('projectMembers', 'insert')) return { ok: false, added: 0, skipped: 0 };
      var project = this.find('projects', projectId);
      if (!project) return { ok: false, error: '项目不存在', added: 0, skipped: 0 };
      var ids = Array.isArray(memberIds) ? memberIds : [memberIds];
      var existing = {};
      this.all('projectMembers').forEach(function (x) { if (x.projectId === projectId) existing[x.memberId] = true; });
      var added = 0, skipped = 0, names = [];
      var self = this;
      ids.forEach(function (mid) {
        if (!mid || existing[mid] || !self.find('members', mid)) { skipped++; return; }
        self.state.projectMembers.push({
          id: L.ui.uid('pm'), projectId: projectId, memberId: mid,
          role: role || '一般参与', responsibility: '',
          joinedAt: new Date().toISOString().slice(0, 10)
        });
        existing[mid] = true;
        added++;
        names.push(self.name('members', mid));
      });
      if (added) {
        this.log('项目「' + project.name + '」加入成员：' + names.join('、'), '#/projects/' + projectId + '?tab=members');
        this.save();
      }
      return { ok: true, added: added, skipped: skipped, names: names };
    },

    /* 从单个项目精确移除一名成员，只删当前项目的关系，不动成员档案与其他项目 */
    removeProjectMember: function (projectId, memberId) {
      if (!this.checkWrite('projectMembers', 'remove')) return { ok: false, removed: 0 };
      var project = this.find('projects', projectId);
      if (!project) return { ok: false, error: '项目不存在', removed: 0 };
      var before = this.state.projectMembers.length;
      var name = this.name('members', memberId);
      this.state.projectMembers = this.state.projectMembers.filter(function (x) {
        return !(x.projectId === projectId && x.memberId === memberId);
      });
      var removed = before - this.state.projectMembers.length;
      if (removed) {
        this.log('项目「' + project.name + '」移除成员：' + name, '#/projects/' + projectId + '?tab=members');
        this.save();
      }
      return { ok: true, removed: removed };
    },

    /* ---- 关系查询 ---- */
    projectMembers: function (projectId) {
      var self = this;
      return this.all('projectMembers').filter(function (x) { return x.projectId === projectId; }).map(function (x) {
        return { rel: x, member: self.find('members', x.memberId) };
      }).filter(function (x) { return x.member; });
    },
    memberProjects: function (memberId) {
      var self = this;
      return this.all('projectMembers').filter(function (x) { return x.memberId === memberId; }).map(function (x) {
        return { rel: x, project: self.find('projects', x.projectId) };
      }).filter(function (x) { return x.project; });
    },
    leadProjects: function (memberId) {
      var self = this;
      return this.all('projects').filter(function (p) { return p.leadMemberId === memberId || self.all('projectMembers').some(function (pm) { return pm.projectId === p.id && pm.memberId === memberId && pm.role === '负责人'; }); });
    },
    projectGroups: function (projectId) {
      var self = this;
      var rows = this.all('projectGroups').filter(function (x) { return x.projectId === projectId; });
      if (!rows.length) {
        var p = this.find('projects', projectId);
        rows = ((p && p.groups) || []).map(function (gid) { return { groupId: gid, note: '' }; });
      }
      return rows.map(function (x) { return { rel: x, group: self.find('groups', x.groupId) }; }).filter(function (x) { return x.group; });
    },
    groupProjects: function (groupId) {
      var self = this;
      return this.all('projects').filter(function (p) {
        return (p.groups || []).indexOf(groupId) >= 0 || self.all('projectGroups').some(function (pg) { return pg.projectId === p.id && pg.groupId === groupId; });
      });
    },
    groupMembers: function (groupId) { return this.all('members').filter(function (m) { return m.groupId === groupId; }); },
    relatedProjects: function (projectId) {
      var self = this;
      return this.all('projectLinks').filter(function (x) { return x.from === projectId || x.to === projectId; }).map(function (x) {
        return { link: x, other: self.find('projects', x.from === projectId ? x.to : x.from), outgoing: x.from === projectId };
      }).filter(function (x) { return x.other; });
    },
    crossGroupProjects: function () {
      return this.all('projects').filter(function (p) { return (p.groups || []).length > 1; });
    },
    memberGroupIds: function (projectId) {
      var self = this;
      var ids = {};
      this.projectMembers(projectId).forEach(function (x) { if (x.member.groupId) ids[x.member.groupId] = true; });
      return Object.keys(ids);
    },

    /* ---- 资产关系查询 ---- */
    projectAssets: function (projectId) {
      var self = this;
      return this.all('assetProjects').filter(function (x) { return x.projectId === projectId; }).map(function (x) {
        return { rel: x, asset: self.find('assets', x.assetId) };
      }).filter(function (x) { return x.asset; });
    },
    assetProjects: function (assetId) {
      var self = this;
      return this.all('assetProjects').filter(function (x) { return x.assetId === assetId; }).map(function (x) {
        return { rel: x, project: self.find('projects', x.projectId) };
      }).filter(function (x) { return x.project; });
    },
    memberAssets: function (memberId) {
      return this.all('assets').filter(function (a) { return a.custodianId === memberId; });
    },

    /* ---- 成员变动：在组 / 离组 ---- */
    isLeft: function (m) { return !!(m && m.leftAt); },
    activeMembers: function () { return this.all('members').filter(function (m) { return !m.leftAt; }); },
    leftMembers: function () { return this.all('members').filter(function (m) { return !!m.leftAt; }); },
    /* 离组影响清单：仅统计，不删除任何关联数据 */
    memberImpact: function (memberId) {
      return {
        lead: this.leadProjects(memberId).length,
        joined: this.memberProjects(memberId).length,
        assets: this.memberAssets(memberId).length,
        tasks: this.all('tasks').filter(function (t) { return t.ownerId === memberId; }).length,
        access: this.all('accessRecords').filter(function (x) { return x.memberId === memberId; }).length,
        flows: this.all('assetFlows').filter(function (x) { return x.memberId === memberId; }).length,
        notices: this.all('notices').filter(function (x) { return x.authorId === memberId; }).length,
        posts: this.all('posts').filter(function (x) { return x.authorId === memberId; }).length
      };
    },
    /* 标记离组：只加标记，历史关系完整保留 */
    markLeft: function (id, leftAt, note) {
      var m = this.find('members', id);
      if (!m) return null;
      m.leftAt = leftAt || new Date().toISOString().slice(0, 10);
      m.leftNote = note || '';
      if (m.status !== '毕业' && m.status !== '离职') m.status = '毕业';
      this.log('成员离组：' + m.name + '（' + m.leftAt + '）', '#/members/' + id);
      this.save();
      return m;
    },
    /* 恢复在组：清除离组标记，历史关系保留 */
    restoreMember: function (id) {
      var m = this.find('members', id);
      if (!m) return null;
      delete m.leftAt;
      delete m.leftNote;
      this.log('成员恢复在组：' + m.name, '#/members/' + id);
      this.save();
      return m;
    },

    /* ---- 任务与项目进度 ---- */
    projectTasks: function (projectId) {
      var self = this;
      return this.all('tasks').filter(function (t) { return t.projectId === projectId; }).map(function (t) {
        return { rel: t, owner: self.find('members', t.ownerId) };
      }).sort(function (a, b) {
        var order = { '进行中': 0, '未开始': 1, '暂停': 2, '已完成': 3, '取消': 4 };
        return (order[a.rel.status] == null ? 9 : order[a.rel.status]) - (order[b.rel.status] == null ? 9 : order[b.rel.status]);
      });
    },
    taskStats: function (projectId) {
      var tasks = this.projectTasks(projectId).map(function (x) { return x.rel; });
      var done = tasks.filter(function (t) { return t.status === '已完成'; }).length;
      var active = tasks.filter(function (t) { return t.status === '进行中'; }).length;
      var sum = tasks.reduce(function (a, t) { return a + (Math.max(0, Math.min(100, Number(t.progress) || 0))); }, 0);
      return { total: tasks.length, done: done, active: active, avg: tasks.length ? Math.round(sum / tasks.length) : 0 };
    },
    /* 手动刷新：按任务进度汇总更新项目进度，仅影响指定项目 */
    refreshProjectProgress: function (projectId) {
      var project = this.find('projects', projectId);
      if (!project) return null;
      var st = this.taskStats(projectId);
      var now = new Date().toISOString().slice(0, 16);
      var patch = { progress: st.total ? st.avg : (Number(project.progress) || 0), progressUpdatedAt: now };
      this.update('projects', projectId, patch);
      this.log('刷新项目进度：' + project.name + ' → ' + patch.progress + '%（' + st.done + '/' + st.total + ' 任务完成）', '#/projects/' + projectId);
      this.save();
      return { progress: patch.progress, updatedAt: now, stats: st };
    },
    /* 删除项目前统计将被清理的关联数据，用于确认提示 */
    projectImpact: function (projectId) {
      var self = this;
      var receiptsOfNotices = this.all('noticeReceipts').filter(function (r) {
        return self.all('notices').some(function (n) { return n.id === r.noticeId && n.projectId === projectId; });
      });
      return {
        tasks: this.all('tasks').filter(function (x) { return x.projectId === projectId; }).length,
        members: this.all('projectMembers').filter(function (x) { return x.projectId === projectId; }).length,
        groups: this.all('projectGroups').filter(function (x) { return x.projectId === projectId; }).length,
        assets: this.all('assetProjects').filter(function (x) { return x.projectId === projectId; }).length,
        posts: this.all('posts').filter(function (x) { return x.projectId === projectId; }).length,
        resources: this.all('resources').filter(function (x) { return x.projectId === projectId; }).length,
        flows: this.all('accessRecords').filter(function (x) { return x.projectId === projectId; }).length + this.all('assetFlows').filter(function (x) { return x.projectId === projectId; }).length,
        notices: this.all('notices').filter(function (x) { return x.projectId === projectId; }).length,
        receipts: receiptsOfNotices.length,
        links: this.all('projectLinks').filter(function (x) { return x.from === projectId || x.to === projectId; }).length
      };
    },

    /* ---- 三流关系查询 ---- */
    memberAccess: function (memberId) {
      var self = this;
      return this.all('accessRecords').filter(function (x) { return x.memberId === memberId; })
        .map(function (x) { return { rec: x, location: self.find('locations', x.locationId), project: self.find('projects', x.projectId) }; });
    },
    locationAccess: function (locationId) {
      var self = this;
      return this.all('accessRecords').filter(function (x) { return x.locationId === locationId; })
        .map(function (x) { return { rec: x, member: self.find('members', x.memberId) }; });
    },
    memberPermissions: function (memberId) {
      var self = this;
      return this.all('permissions').filter(function (x) { return x.memberId === memberId; })
        .map(function (x) { return { rec: x, location: self.find('locations', x.locationId) }; });
    },
    locationPermissions: function (locationId) {
      var self = this;
      return this.all('permissions').filter(function (x) { return x.locationId === locationId; })
        .map(function (x) { return { rec: x, member: self.find('members', x.memberId) }; });
    },
    assetFlowsOf: function (assetId) {
      var self = this;
      return this.all('assetFlows').filter(function (x) { return x.assetId === assetId; })
        .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); })
        .map(function (x) {
          return { rec: x, member: self.find('members', x.memberId), from: self.find('locations', x.fromLocationId), to: self.find('locations', x.toLocationId), project: self.find('projects', x.projectId) };
        });
    },
    memberFlows: function (memberId) {
      var self = this;
      return this.all('assetFlows').filter(function (x) { return x.memberId === memberId; })
        .map(function (x) { return { rec: x, asset: self.find('assets', x.assetId), to: self.find('locations', x.toLocationId) }; });
    },
    locationFlows: function (locationId) {
      var self = this;
      return this.all('assetFlows').filter(function (x) { return x.fromLocationId === locationId || x.toLocationId === locationId; })
        .map(function (x) { return { rec: x, asset: self.find('assets', x.assetId), member: self.find('members', x.memberId) }; });
    },
    noticeReceiptsOf: function (noticeId) {
      var self = this;
      return this.all('noticeReceipts').filter(function (x) { return x.noticeId === noticeId; })
        .map(function (x) { return { rec: x, member: self.find('members', x.memberId), location: self.find('locations', x.locationId) }; });
    },
    memberNotices: function (memberId) {
      var self = this;
      return this.all('noticeReceipts').filter(function (x) { return x.memberId === memberId; })
        .map(function (x) { return { rec: x, notice: self.find('notices', x.noticeId) }; })
        .filter(function (x) { return x.notice; });
    },
    noticeStats: function (noticeId) {
      var rows = this.noticeReceiptsOf(noticeId);
      var read = rows.filter(function (x) { return x.rec.status === '已读' || x.rec.status === '已确认'; }).length;
      var confirmed = rows.filter(function (x) { return x.rec.status === '已确认'; }).length;
      return { total: rows.length, read: read, confirmed: confirmed, unread: rows.length - read, rate: rows.length ? Math.round(read / rows.length * 100) : 0 };
    },
    flowMatch: function (f, e) {
      f = f || {};
      if (f.kind && f.kind !== e.kind) return false;
      if (f.memberId && f.memberId !== e.memberId) return false;
      if (f.assetId && f.assetId !== e.assetId) return false;
      if (f.locationId && f.locationId !== e.locationId && f.locationId !== e.toLocationId) return false;
      if (f.projectId && f.projectId !== e.projectId) return false;
      if (f.noticeId && f.noticeId !== e.noticeId) return false;
      var day = String(e.at || '').slice(0, 10);
      if (f.from && day && day < f.from) return false;
      if (f.to && day && day > f.to) return false;
      if (f.q) {
        var hay = [e.title, e.detail, e.personName, e.assetName, e.locationName, e.projectName].filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(String(f.q).toLowerCase()) < 0) return false;
      }
      return true;
    },
    /* 三流统一事件：人流 / 物流 / 信息流共用 人员-物品-地点-时间 四个维度 */
    flowEvents: function (f) {
      var self = this, out = [];
      this.all('accessRecords').forEach(function (x) {
        var loc = self.find('locations', x.locationId), mem = self.find('members', x.memberId), p = self.find('projects', x.projectId);
        var e = { kind: '人流', entity: 'accessRecords', id: x.id, at: x.at, memberId: x.memberId, locationId: x.locationId,
          toLocationId: '', assetId: '', noticeId: '', projectId: x.projectId,
          title: (x.direction || '进出') + ' · ' + (loc ? loc.name : '未指定场所'),
          detail: [x.method, x.result].filter(Boolean).join(' · '), status: x.result,
          personName: mem ? mem.name : '', locationName: loc ? loc.name : '', projectName: p ? p.name : '', assetName: '' };
        if (self.flowMatch(f, e)) out.push(e);
      });
      this.all('assetFlows').forEach(function (x) {
        var a = self.find('assets', x.assetId), mem = self.find('members', x.memberId), to = self.find('locations', x.toLocationId), p = self.find('projects', x.projectId);
        var e = { kind: '物流', entity: 'assetFlows', id: x.id, at: x.at, memberId: x.memberId, locationId: x.fromLocationId,
          toLocationId: x.toLocationId, assetId: x.assetId, noticeId: '', projectId: x.projectId,
          title: (x.type || '流转') + ' · ' + (a ? a.name : '未指定物品'),
          detail: [x.quantity ? x.quantity + (x.unit || '') : '', to ? '→ ' + to.name : '', x.purpose].filter(Boolean).join(' · '), status: x.status,
          personName: mem ? mem.name : '', locationName: to ? to.name : self.name('locations', x.fromLocationId), projectName: p ? p.name : '', assetName: a ? a.name : '' };
        if (self.flowMatch(f, e)) out.push(e);
      });
      this.all('noticeReceipts').forEach(function (x) {
        var n = self.find('notices', x.noticeId), mem = self.find('members', x.memberId), loc = self.find('locations', x.locationId);
        var e = { kind: '信息流', entity: 'noticeReceipts', id: x.id, at: x.readAt || x.deliveredAt, memberId: x.memberId,
          locationId: x.locationId, toLocationId: '', assetId: '', noticeId: x.noticeId, projectId: n ? n.projectId : '',
          title: (x.status === '未读' ? '送达 · ' : '查阅 · ') + (n ? n.title : '未指定信息'),
          detail: [x.channel, x.status].filter(Boolean).join(' · '), status: x.status,
          personName: mem ? mem.name : '', locationName: loc ? loc.name : '', projectName: n ? self.name('projects', n.projectId) : '', assetName: '' };
        if (self.flowMatch(f, e)) out.push(e);
      });
      this.all('notices').forEach(function (x) {
        var mem = self.find('members', x.authorId), loc = self.find('locations', x.locationId), p = self.find('projects', x.projectId);
        var e = { kind: '信息流', entity: 'notices', id: x.id, at: x.publishAt, memberId: x.authorId, locationId: x.locationId,
          toLocationId: '', assetId: '', noticeId: x.id, projectId: x.projectId,
          title: '发布 · ' + x.title, detail: [x.category, x.priority].filter(Boolean).join(' · '), status: x.status,
          personName: mem ? mem.name : '', locationName: loc ? loc.name : '', projectName: p ? p.name : '', assetName: '' };
        if (self.flowMatch(f, e)) out.push(e);
      });
      return out.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    },
    flowStats: function () {
      var today = new Date().toISOString().slice(0, 10);
      var events = this.flowEvents({});
      return {
        total: events.length,
        people: events.filter(function (x) { return x.kind === '人流'; }).length,
        goods: events.filter(function (x) { return x.kind === '物流'; }).length,
        info: events.filter(function (x) { return x.kind === '信息流'; }).length,
        today: events.filter(function (x) { return String(x.at || '').slice(0, 10) === today; }).length,
        abnormal: this.all('accessRecords').filter(function (x) { return x.result === '拒绝' || x.result === '异常'; }).length,
        overdue: this.all('assetFlows').filter(function (x) { return x.status === '逾期' || x.status === '在途'; }).length,
        unread: this.all('noticeReceipts').filter(function (x) { return x.status === '未读'; }).length,
        pending: this.all('permissions').filter(function (x) { return x.level === '待审批'; }).length
      };
    },

    tags: function (entity) {
      var set = {};
      this.all(entity).forEach(function (x) { (x.tags || '').split(/[,，]/).forEach(function (t) { t = t.trim(); if (t) set[t] = true; }); });
      return Object.keys(set);
    },

    search: function (q) {
      q = (q || '').trim().toLowerCase();
      if (!q) return [];
      var out = [];
      [['projects', '项目'], ['tasks', '任务'], ['members', '成员'], ['groups', '课题组'], ['assets', '资产物品'], ['locations', '场所'], ['notices', '信息公告'], ['resources', '资料']].forEach(function (pair) {
        var entity = pair[0], label = pair[1];
        this.all(entity).forEach(function (x) {
          var hay = [x.name, x.code, x.assetNo, x.spec, x.title, x.focus, x.tags, x.description, x.content, x.url, x.supplier, x.location, x.building, x.room, x.category, x.note].filter(Boolean).join(' ').toLowerCase();
          if (hay.indexOf(q) >= 0) {
            var target = entity === 'locations' ? '#/access' : entity === 'notices' ? '#/notices' : entity === 'tasks' ? '#/projects/' + x.projectId : '#/' + entity + '/' + x.id;
            out.push({ entity: entity, label: label, id: x.id, projectId: x.projectId, href: target, title: x.name || x.title || (x.content || '').slice(0, 30), sub: (entity === 'tasks' ? L.store.name('projects', x.projectId) : '') || x.assetNo || x.code || x.spec || x.focus || x.category || (x.building || '') + (x.room || '') });
          }
        });
      }, this);
      return out.slice(0, 24);
    },

    exportJSON: function () { return JSON.stringify(this.state, null, 2); },
    importJSON: function (text) {
      var parsed = JSON.parse(text);
      var normalized = this.normalize(parsed);
      if (!normalized.members.length && !normalized.projects.length) throw new Error('文件中没有可识别的数据');
      this.state = normalized;
      this.log('导入数据备份');
      this.save();
    },
    reset: function () { this.state = this.normalize(L.seed()); this.save(); }
  };

  L.store = store;
})(window.LabApp = window.LabApp || {});
