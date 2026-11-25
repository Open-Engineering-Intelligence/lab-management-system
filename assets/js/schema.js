/* 数据结构定义：新增实体时只需在此登记，表单、校验与通用增删改查会自动继承 */
(function (L) {
  'use strict';

  var STATUS = ['进行中', '预研', '暂停', '已结题'];
  var MEMBER_ROLE = ['项目负责人', '核心成员', '参与成员', '顾问'];
  var MEMBER_TITLE = ['教授', '副教授', '讲师', '博士后', '博士生', '硕士生', '访问学者', '研究员', '工程师'];
  var PROJECT_ROLE = ['负责人', '核心参与', '一般参与', '顾问'];
  var LINK_TYPE = ['数据关联', '技术依赖', '共同技术', '成果延伸', '设备/平台共享'];
  var RES_TYPE = ['文档', '数据集', '代码', '图纸', '外部链接', '会议纪要'];
  var MEMBER_STATUS = ['在读', '在职', '毕业', '离职', '访问学者'];
  var ASSET_CATEGORY = ['仪器设备', '工具耗材', '电子模块', '软件授权', '外协服务', '办公设备'];
  var ASSET_STATUS = ['在用', '库存', '借用中', '维修中', '已报废'];
  var ASSET_UNIT = ['台', '套', '件', '个', '批', '年'];
  var LOCATION_TYPE = ['实验室', '办公室', '库房', '工坊', '会议室', '其他'];
  var ACCESS_DIRECTION = ['进入', '离开'];
  var ACCESS_METHOD = ['刷卡', '人脸识别', '二维码', '人工登记'];
  var ACCESS_RESULT = ['正常', '拒绝', '异常'];
  var PERM_LEVEL = ['准入', '受限', '禁止', '待审批'];
  var FLOW_TYPE = ['领用', '归还', '位置转移', '维修送检', '报废', '盘点'];
  var FLOW_STATUS = ['完成', '在途', '逾期', '取消'];
  var NOTICE_CATEGORY = ['通知公告', '安全提示', '制度规范', '项目进展', '成果分享'];
  var NOTICE_PRIORITY = ['普通', '重要', '紧急'];
  var NOTICE_SCOPE = ['全体', '指定课题组', '指定项目组'];
  var NOTICE_STATUS = ['草稿', '已发布', '已归档'];
  var RECEIPT_STATUS = ['未读', '已读', '已确认', '失败'];
  var CHANNEL = ['站内', '微信', '邮件', '公告栏'];
  var TASK_STATUS = ['未开始', '进行中', '已完成', '暂停', '取消'];
  var TASK_PRIORITY = ['普通', '重要', '紧急'];
  var COLORS = ['#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#15803d'];

  var ref = function (entity, labelField) { return { type: 'ref', entity: entity, labelField: labelField || 'name' }; };
  var text = function (key, label, opts) { return Object.assign({ key: key, label: label, type: 'text' }, opts || {}); };

  L.schema = {
    entities: {
      groups: {
        label: '课题组', singular: '课题组', icon: 'i-groups',
        titleField: 'name',
        fields: [
          text('name', '课题组名称', { required: true, full: true, placeholder: '如：智能感知与信号处理组' }),
          text('code', '组别代号', { placeholder: '如：G1' }),
          { key: 'leaderId', label: '组长', type: 'ref', entity: 'members' },
          text('focus', '研究方向', { full: true, placeholder: '如：机器视觉、信号处理' }),
          { key: 'description', label: '简介', type: 'textarea', full: true },
          { key: 'color', label: '标识色', type: 'color', options: COLORS }
        ]
      },
      members: {
        label: '成员', singular: '成员', icon: 'i-users',
        titleField: 'name',
        fields: [
          text('name', '姓名', { required: true }),
          text('studentNo', '学号 / 工号'),
          { key: 'groupId', label: '所属课题组', type: 'ref', entity: 'groups' },
          { key: 'role', label: '组内角色', type: 'combo', options: MEMBER_ROLE, optionKey: 'memberRole', hint: '可选建议项，也可直接输入自定义角色；输入过的值会自动记住' },
          { key: 'title', label: '职称 / 身份', type: 'combo', options: MEMBER_TITLE, optionKey: 'memberTitle', placeholder: '如：博士生、副教授，可直接输入', hint: '可选建议项，也可直接输入自定义身份；输入过的值会自动记住' },
          { key: 'status', label: '状态', type: 'combo', options: MEMBER_STATUS, optionKey: 'memberStatus', hint: '可选建议项，也可直接输入自定义状态；输入过的值会自动记住' },
          text('email', '邮箱', { full: true }),
          text('phone', '电话'),
          text('joinedAt', '加入日期', { type: 'date' }),
          text('tags', '技能标签', { full: true, placeholder: '多个标签用逗号分隔，如：Python, 图像处理' }),
          { key: 'leftAt', label: '离组日期', type: 'date', hint: '填写后视为已离组；离组只做标记，历史记录会完整保留，可随时恢复' },
          text('leftNote', '离组说明', { full: true, placeholder: '如：毕业 / 交换结束 / 转组' }),
          { key: 'bio', label: '备注', type: 'textarea', full: true }
        ]
      },
      projects: {
        label: '项目', singular: '项目', icon: 'i-projects',
        titleField: 'name',
        fields: [
          text('name', '项目名称', { required: true, full: true }),
          text('code', '项目编号', { placeholder: '如：P-2026-01' }),
          { key: 'status', label: '项目状态', type: 'select', options: STATUS },
          { key: 'type', label: '项目类型', type: 'select', options: ['纵向课题', '横向课题', '自拟课题', '企业合作', '平台建设'] },
          { key: 'leadMemberId', label: '项目牵头人', type: 'ref', entity: 'members' },
          text('startDate', '开始日期', { type: 'date' }),
          text('endDate', '结束日期', { type: 'date' }),
          { key: 'progress', label: '进度（%）', type: 'number', hint: '0 - 100；按任务刷新后由任务进度自动汇总' },
          { key: 'progressUpdatedAt', label: '进度刷新时间', type: 'datetime-local', hint: '手动刷新进度时自动记录' },
          { key: 'groups', label: '涉及课题组', type: 'multiRef', entity: 'groups', full: true },
          text('tags', '关键词', { full: true, placeholder: '多个关键词用逗号分隔' }),
          { key: 'description', label: '项目说明', type: 'textarea', full: true },
          text('source', '来源 / 合作方', { full: true }),
          text('funding', '经费信息')
        ]
      },
      tasks: {
        label: '任务', singular: '任务', icon: 'i-check',
        titleField: 'title',
        fields: [
          text('title', '任务名称', { required: true, full: true, placeholder: '如：完成机械臂运动控制调试' }),
          { key: 'projectId', label: '所属项目', type: 'ref', entity: 'projects', required: true },
          { key: 'ownerId', label: '负责人', type: 'ref', entity: 'members' },
          { key: 'status', label: '任务状态', type: 'select', options: TASK_STATUS },
          { key: 'priority', label: '优先级', type: 'select', options: TASK_PRIORITY },
          { key: 'progress', label: '进度（%）', type: 'number', hint: '0 - 100' },
          text('dueDate', '截止日期', { type: 'date' }),
          text('note', '任务说明', { type: 'textarea', full: true })
        ]
      },
      assets: {
        label: '资产物品', singular: '资产', icon: 'i-box',
        titleField: 'name',
        fields: [
          text('name', '物品名称', { required: true, full: true, placeholder: '如：FDM 3D 打印机' }),
          text('assetNo', '资产编号', { placeholder: '如：A-2026-01' }),
          { key: 'category', label: '类别', type: 'select', options: ASSET_CATEGORY },
          text('spec', '规格 / 型号', { full: true, placeholder: '如：Creality Ender-3 / STM32F103' }),
          { key: 'quantity', label: '数量', type: 'number', hint: '填写数字' },
          { key: 'unit', label: '单位', type: 'select', options: ASSET_UNIT },
          { key: 'unitPrice', label: '单价（元）', type: 'number' },
          text('purchaseDate', '采购日期', { type: 'date' }),
          text('budgetSource', '经费来源'),
          text('supplier', '供应商 / 采购渠道', { full: true }),
          text('location', '存放位置'),
          { key: 'custodianId', label: '负责人 / 保管人', type: 'ref', entity: 'members' },
          { key: 'status', label: '使用状态', type: 'select', options: ASSET_STATUS },
          text('tags', '标签', { full: true, placeholder: '多个标签用逗号分隔' }),
          { key: 'notes', label: '备注', type: 'textarea', full: true }
        ]
      },
      assetProjects: {
        label: '物品-项目关系', singular: '物品关联', icon: 'i-link',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'assetId', label: '物品', type: 'ref', entity: 'assets', required: true },
          { key: 'projectId', label: '项目', type: 'ref', entity: 'projects', required: true },
          text('purpose', '用途 / 配置说明', { full: true, placeholder: '如：用于机械臂运动控制调试' }),
          text('assignedAt', '关联日期', { type: 'date' })
        ]
      },
      projectMembers: {
        label: '项目成员关系', singular: '成员关系', icon: 'i-link',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'projectId', label: '项目', type: 'ref', entity: 'projects', required: true },
          { key: 'memberId', label: '成员', type: 'ref', entity: 'members', required: true },
          { key: 'role', label: '项目角色', type: 'select', options: PROJECT_ROLE },
          text('responsibility', '承担工作', { full: true, placeholder: '如：算法设计、样品制备、系统联调' }),
          text('joinedAt', '加入日期', { type: 'date' })
        ]
      },
      projectGroups: {
        label: '项目-组别关系', singular: '组别关系', icon: 'i-link',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'projectId', label: '项目', type: 'ref', entity: 'projects', required: true },
          { key: 'groupId', label: '课题组', type: 'ref', entity: 'groups', required: true },
          text('note', '协作说明', { full: true })
        ]
      },
      projectLinks: {
        label: '项目关联', singular: '项目关联', icon: 'i-link',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'from', label: '项目 A', type: 'ref', entity: 'projects', required: true },
          { key: 'type', label: '关联类型', type: 'select', options: LINK_TYPE, required: true },
          { key: 'to', label: '项目 B', type: 'ref', entity: 'projects', required: true },
          text('note', '关联说明', { full: true })
        ]
      },
      locations: {
        label: '场所位置', singular: '场所', icon: 'i-location',
        titleField: 'name',
        fields: [
          text('name', '场所名称', { required: true, full: true, placeholder: '如：机器人实验室 301' }),
          text('code', '场所编号', { placeholder: '如：L-301' }),
          { key: 'type', label: '场所类型', type: 'select', options: LOCATION_TYPE },
          text('building', '楼宇'),
          text('room', '房间号'),
          { key: 'custodianId', label: '场所负责人', type: 'ref', entity: 'members' },
          { key: 'accessRule', label: '准入规则', type: 'select', options: ['自由进入', '需审批', '仅组成员'] },
          text('capacity', '容纳人数', { type: 'number' }),
          { key: 'notes', label: '备注', type: 'textarea', full: true }
        ]
      },
      permissions: {
        label: '出入权限', singular: '权限', icon: 'i-shield',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'memberId', label: '成员', type: 'ref', entity: 'members', required: true },
          { key: 'locationId', label: '场所', type: 'ref', entity: 'locations', required: true },
          { key: 'level', label: '权限等级', type: 'select', options: PERM_LEVEL, required: true },
          text('validFrom', '生效日期', { type: 'date' }),
          text('validTo', '失效日期', { type: 'date' }),
          { key: 'approvedBy', label: '审批人', type: 'ref', entity: 'members' },
          { key: 'notes', label: '说明', type: 'textarea', full: true }
        ]
      },
      accessRecords: {
        label: '人员进出', singular: '进出记录', icon: 'i-door',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'memberId', label: '人员', type: 'ref', entity: 'members', required: true },
          { key: 'locationId', label: '场所', type: 'ref', entity: 'locations', required: true },
          { key: 'direction', label: '方向', type: 'select', options: ACCESS_DIRECTION, required: true },
          text('at', '进出时间', { type: 'datetime-local' }),
          { key: 'method', label: '通行方式', type: 'select', options: ACCESS_METHOD },
          { key: 'result', label: '结果', type: 'select', options: ACCESS_RESULT },
          { key: 'projectId', label: '关联项目', type: 'ref', entity: 'projects' },
          { key: 'notes', label: '备注', type: 'textarea', full: true }
        ]
      },
      assetFlows: {
        label: '物品流转', singular: '流转记录', icon: 'i-swap',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'assetId', label: '物品', type: 'ref', entity: 'assets', required: true },
          { key: 'memberId', label: '经办人', type: 'ref', entity: 'members', required: true },
          { key: 'type', label: '流转类型', type: 'select', options: FLOW_TYPE, required: true },
          text('at', '流转时间', { type: 'datetime-local' }),
          { key: 'fromLocationId', label: '来源位置', type: 'ref', entity: 'locations' },
          { key: 'toLocationId', label: '目标位置', type: 'ref', entity: 'locations' },
          { key: 'quantity', label: '数量', type: 'number' },
          { key: 'projectId', label: '关联项目', type: 'ref', entity: 'projects' },
          { key: 'status', label: '状态', type: 'select', options: FLOW_STATUS },
          text('purpose', '用途 / 说明', { full: true }),
          { key: 'notes', label: '备注', type: 'textarea', full: true }
        ]
      },
      notices: {
        label: '信息公告', singular: '信息', icon: 'i-megaphone',
        titleField: 'title',
        fields: [
          text('title', '标题', { required: true, full: true }),
          { key: 'category', label: '分类', type: 'select', options: NOTICE_CATEGORY, required: true },
          { key: 'priority', label: '优先级', type: 'select', options: NOTICE_PRIORITY },
          { key: 'scope', label: '发布范围', type: 'select', options: NOTICE_SCOPE },
          text('scopeRef', '指定对象', { placeholder: '如：智能车辆与电控组 / p07', full: true }),
          { key: 'authorId', label: '发布人', type: 'ref', entity: 'members', required: true },
          text('publishAt', '发布时间', { type: 'datetime-local' }),
          { key: 'locationId', label: '关联场所', type: 'ref', entity: 'locations' },
          { key: 'projectId', label: '关联项目', type: 'ref', entity: 'projects' },
          text('expireAt', '有效期至', { type: 'date' }),
          { key: 'status', label: '状态', type: 'select', options: NOTICE_STATUS },
          { key: 'content', label: '正文', type: 'textarea', required: true, full: true },
          { key: 'needConfirm', label: '是否需确认', type: 'select', options: ['是', '否'] }
        ]
      },
      noticeReceipts: {
        label: '信息触达', singular: '触达记录', icon: 'i-eye',
        titleField: 'id', hidden: true,
        fields: [
          { key: 'noticeId', label: '信息', type: 'ref', entity: 'notices', required: true },
          { key: 'memberId', label: '接收人', type: 'ref', entity: 'members', required: true },
          { key: 'channel', label: '送达渠道', type: 'select', options: CHANNEL },
          text('deliveredAt', '送达时间', { type: 'datetime-local' }),
          text('readAt', '查阅时间', { type: 'datetime-local' }),
          { key: 'status', label: '状态', type: 'select', options: RECEIPT_STATUS },
          { key: 'locationId', label: '查阅地点', type: 'ref', entity: 'locations' }
        ]
      },
      posts: {
        label: '讨论', singular: '讨论', icon: 'i-chat',
        titleField: 'content', hidden: true,
        fields: [
          { key: 'projectId', label: '关联项目', type: 'ref', entity: 'projects' },
          { key: 'content', label: '内容', type: 'textarea', required: true, full: true, placeholder: '同步进展、提出问题或分享想法…（发布人由登录账号自动记录）' }
        ]
      },
      resources: {
        label: '资料', singular: '资料', icon: 'i-folder',
        titleField: 'title', hidden: true,
        fields: [
          text('title', '资料名称', { required: true, full: true }),
          { key: 'projectId', label: '关联项目', type: 'ref', entity: 'projects' },
          { key: 'type', label: '资料类型', type: 'select', options: RES_TYPE },
          text('url', '链接地址', { full: true, placeholder: 'https://…（本地路径也可以）' }),
          { key: 'uploaderId', label: '登记人', type: 'ref', entity: 'members' },
          { key: 'description', label: '说明', type: 'textarea', full: true }
        ]
      }
    },
    options: { STATUS: STATUS, MEMBER_ROLE: MEMBER_ROLE, MEMBER_TITLE: MEMBER_TITLE, PROJECT_ROLE: PROJECT_ROLE, LINK_TYPE: LINK_TYPE, RES_TYPE: RES_TYPE, MEMBER_STATUS: MEMBER_STATUS, ASSET_CATEGORY: ASSET_CATEGORY, ASSET_STATUS: ASSET_STATUS, ASSET_UNIT: ASSET_UNIT, LOCATION_TYPE: LOCATION_TYPE, ACCESS_DIRECTION: ACCESS_DIRECTION, ACCESS_METHOD: ACCESS_METHOD, ACCESS_RESULT: ACCESS_RESULT, PERM_LEVEL: PERM_LEVEL, FLOW_TYPE: FLOW_TYPE, FLOW_STATUS: FLOW_STATUS, NOTICE_CATEGORY: NOTICE_CATEGORY, NOTICE_PRIORITY: NOTICE_PRIORITY, NOTICE_SCOPE: NOTICE_SCOPE, NOTICE_STATUS: NOTICE_STATUS, RECEIPT_STATUS: RECEIPT_STATUS, CHANNEL: CHANNEL, TASK_STATUS: TASK_STATUS, TASK_PRIORITY: TASK_PRIORITY, COLORS: COLORS },
    statusClass: function (s) { return ({ '进行中': 'blue', '预研': 'amber', '暂停': 'rose', '已结题': 'green', '未开始': '', '已完成': 'green', '在用': 'green', '库存': 'blue', '借用中': 'amber', '维修中': 'rose', '已报废': '', '准入': 'green', '受限': 'amber', '禁止': 'rose', '待审批': 'blue', '正常': 'green', '拒绝': 'rose', '异常': 'amber', '完成': 'green', '在途': 'blue', '逾期': 'rose', '取消': '', '草稿': 'amber', '已发布': 'green', '已归档': '', '未读': 'amber', '已读': 'blue', '已确认': 'teal', '失败': 'rose', '紧急': 'rose', '重要': 'amber', '普通': '' })[s] || ''; },
    entityLabel: function (entity) { return this.entities[entity] ? this.entities[entity].label : entity; }
  };
})(window.LabApp = window.LabApp || {});
