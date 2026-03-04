export type LaneKey = 'ALL' | 'P' | 'N' | 'AI' | 'I' | 'D' | 'IP';

export type NodeKey = keyof typeof nodes;

export interface NodeDef {
  lane: Exclude<LaneKey, 'ALL'>;
  title: string;
  subtitle: string;
  desc: string[];
  components: string[];
  fields: string[];
  state: string;
  next: string[];
}

export const laneMeta: Record<LaneKey, { label: string; color: string }> = {
  ALL: { label: '全部泳道', color: '#9aa3c4' },
  P: { label: '患者端', color: '#3e6fff' },
  N: { label: '护士端', color: '#18a378' },
  AI: { label: 'AI服务', color: '#8b63f2' },
  I: { label: '检查科室', color: '#f5a524' },
  D: { label: '医生端', color: '#3a7bd5' },
  IP: { label: '住院', color: '#cf4d8f' }
};

export const nodes: Record<string, NodeDef> = {
  P1: { lane: 'P', title: '到院报到/扫码建档', subtitle: '签到与排号', desc: ['定位到院后自动提示签到', '扫码建档并生成排号', '显示诊室与路线信息'], components: ['签到卡', '排号卡', '路线导航'], fields: ['patientId', 'checkinStatus', 'queueNo'], state: 'idle -> geofence_hit -> checked_in -> queued', next: ['P2'] },
  P2: { lane: 'P', title: 'AI问诊问卷', subtitle: '主诉与既往史', desc: ['采集主诉/疼痛/既往史', '语音转写为结构化字段', '提交后推送护士预问诊'], components: ['问卷步骤条', '症状输入', '提交确认'], fields: ['questionnaireId', 'chiefComplaint', 'painScoreVAS'], state: 'draft -> collecting -> submitted', next: ['N1', 'AI1'] },
  P3: { lane: 'P', title: '配合检查/拍片', subtitle: '执行检查流程', desc: ['患者按检查单完成拍片检验', '可查看检查地点与排队状态'], components: ['检查清单', '检查导航', '完成回执'], fields: ['examOrderId', 'examType', 'examStatus'], state: 'ordered -> in_exam -> completed', next: ['I1'] },
  P4: { lane: 'P', title: '接收处置结果', subtitle: '查看治疗安排', desc: ['接收诊断摘要和处置路径', '查看复诊/随访/PT安排'], components: ['处置摘要卡', '计划卡', '提醒开关'], fields: ['diagnosisSummary', 'planType', 'nextVisit'], state: 'pending_result -> received', next: ['P5'] },
  P5: { lane: 'P', title: '随访与训练打卡', subtitle: '长期管理', desc: ['按计划完成打卡和问卷', '上传康复资料并触发风险评估'], components: ['随访任务', '打卡按钮', '上传入口'], fields: ['followTaskId', 'adherenceScore', 'uploadCount'], state: 'scheduled -> in_followup -> alert_or_complete', next: ['AI5'] },

  N1: { lane: 'N', title: '预问诊接收患者', subtitle: '护士入口', desc: ['护士接收患者并核对信息', '进入病史补录与红旗判定'], components: ['预问诊卡片', '接收按钮', '患者摘要'], fields: ['triageTaskId', 'nurseId', 'patientId'], state: 'new -> accepted -> processing', next: ['N2', 'N3'] },
  N2: { lane: 'N', title: '补充病史+PE', subtitle: '结构化录入', desc: ['录入体征与PE结果', '同步PMS作为接诊输入'], components: ['体征录入', 'PE模板', '保存提交'], fields: ['temperature', 'bloodPressure', 'peResult'], state: 'editing -> validated -> submitted', next: ['N3', 'AI2'] },
  N3: { lane: 'N', title: '红旗症状判定', subtitle: '风险分流', desc: ['综合AI命中项进行红旗判定', '高风险可立即转急诊/直诊'], components: ['红旗命中列表', '分流选项', '确认按钮'], fields: ['riskScore', 'redFlagHits', 'triageDecision'], state: 'to_judge -> redflag_or_normal', next: ['N4', 'N5'] },
  N4: { lane: 'N', title: '标记红旗并分流', subtitle: '急诊/直诊', desc: ['记录分流类型与时间', '推送医生优先接诊队列'], components: ['分流按钮', '转诊记录', '通知条'], fields: ['transferType', 'transferTime', 'receiverDoctorId'], state: 'confirmed -> transferred', next: ['D1'] },
  N5: { lane: 'N', title: '无红旗提交分诊', subtitle: '进入常规分诊', desc: ['提交预问诊结果与分诊建议', '进入AI智能分诊'], components: ['分诊建议卡', '提交按钮'], fields: ['triageCategory', 'targetClinic', 'submitTime'], state: 'normal_confirmed -> routed', next: ['AI3'] },

  AI1: { lane: 'AI', title: 'AI病史结构化', subtitle: 'NLP抽取', desc: ['从问卷/对话抽取症状与病史', '生成结构化摘要'], components: ['症状标签', '结构化摘要', '置信度'], fields: ['nlpSymptoms', 'historySummary', 'confidence'], state: 'received -> parsed -> output', next: ['N1'] },
  AI2: { lane: 'AI', title: '红旗规则判别', subtitle: '规则+模型', desc: ['命中红旗规则并输出风险分', '返回护士判定页展示'], components: ['规则命中', '风险评分', '建议路径'], fields: ['ruleHits', 'riskLevel', 'recommendation'], state: 'input -> score -> decision_hint', next: ['N3'] },
  AI3: { lane: 'AI', title: 'AI智能分诊建议', subtitle: '专病与检查推荐', desc: ['推荐专病门诊与检查组合', '给医生工作台提供解释信息'], components: ['专病推荐', '检查推荐', '解释文本'], fields: ['clinicSuggestion', 'examSuggestion', 'reasoning'], state: 'triage_input -> recommend', next: ['D1'] },
  AI4: { lane: 'AI', title: 'AI影像分析', subtitle: '标注与测量', desc: ['对影像做自动标注和测量', '输出结构化结论待医生复核'], components: ['标注图层', '测量面板', 'AI结论'], fields: ['imageId', 'measurements', 'aiConclusion'], state: 'image_ready -> inferred -> pending_review', next: ['D4'] },
  AI5: { lane: 'AI', title: '随访风险评估', subtitle: '依从性预警', desc: ['根据打卡与问卷评估复发风险', '向医生/PT推送预警'], components: ['风险趋势图', '预警列表', '推送记录'], fields: ['followRisk', 'adherence', 'alerts'], state: 'collect -> score -> notify', next: ['D7', 'D8'] },
  AI6: { lane: 'AI', title: '手术规划辅助', subtitle: '术前风险提示', desc: ['生成术前规划建议与风险提示', '推送住院手术路径'], components: ['规划建议', '风险提示', '术前清单'], fields: ['surgeryPlanId', 'riskWarnings', 'checklist'], state: 'preop_input -> planning -> pushed', next: ['IP1'] },

  I1: { lane: 'I', title: '执行影像/检查', subtitle: '检查科室执行', desc: ['执行X光/MRI/CT等检查', '更新检查状态'], components: ['检查工单', '执行状态', '完成签收'], fields: ['examExecutionId', 'modality', 'endTime'], state: 'scheduled -> executing -> done', next: ['I2'] },
  I2: { lane: 'I', title: '上传检查结果', subtitle: '结果回传', desc: ['检查结果回传系统', '触发AI分析并通知患者'], components: ['报告上传', '同步状态', '通知卡'], fields: ['reportId', 'imageIds', 'syncStatus'], state: 'uploaded -> synced -> downstream_triggered', next: ['AI4', 'P4'] },

  D1: { lane: 'D', title: '接诊工作台打开患者', subtitle: '医生入口', desc: ['从待办队列进入患者上下文', '启动接诊流程'], components: ['待办队列', '患者摘要', '开始接诊'], fields: ['encounterId', 'queueStage', 'doctorId'], state: 'queued -> opened', next: ['D2'] },
  D2: { lane: 'D', title: '查看AI问诊/红旗/分诊', subtitle: '信息整合', desc: ['汇总查看AI、护士、历史检查信息', '确认接诊输入完整'], components: ['AI摘要', '红旗提示', '分诊建议'], fields: ['aiSummary', 'redFlagStatus', 'triageInfo'], state: 'opened -> reviewed', next: ['D3'] },
  D3: { lane: 'D', title: '开检查单/追加检查', subtitle: '开单操作', desc: ['移动端一键开检查单', '通知患者前往检查'], components: ['检查选择器', '优先级设置', '提交开单'], fields: ['orderId', 'examItems', 'priority'], state: 'draft -> ordered', next: ['I1', 'P3'] },
  D4: { lane: 'D', title: '查看影像+AI结果', subtitle: '复核诊断', desc: ['医生复核AI标注与测量', '生成最终影像意见'], components: ['影像视图', 'AI对照', '复核提交'], fields: ['reviewResult', 'adjustments', 'reviewedBy'], state: 'pending_review -> confirmed_or_adjusted', next: ['D5'] },
  D5: { lane: 'D', title: '诊断录入+处置决策', subtitle: '完成诊断', desc: ['录入诊断与处置建议', '进入路径选择'], components: ['诊断表单', '建议模板', '提交按钮'], fields: ['diagnosisCode', 'diagnosisText', 'advice'], state: 'editing -> validated -> submitted', next: ['D6'] },
  D6: { lane: 'D', title: '治疗路径选择', subtitle: 'Follow-up/PT/Surgery', desc: ['根据病情选择后续路径', '支持多路径并行计划'], components: ['路径卡片', '路径解释', '确认选择'], fields: ['planType', 'decisionBy', 'decisionTime'], state: 'pending_decision -> route_selected', next: ['D7', 'D8', 'D9'] },
  D7: { lane: 'D', title: '随访计划制定', subtitle: '任务与提醒', desc: ['设置随访频率和任务', '同步患者端提醒'], components: ['随访频率', '任务模板', '提醒策略'], fields: ['followPlanId', 'frequency', 'reminderRule'], state: 'planning -> active', next: ['P4'] },
  D8: { lane: 'D', title: 'PT介入', subtitle: '康复路径', desc: ['分配康复师并制定训练方案', '回传评估记录'], components: ['康复师分配', 'PT模板', '评估记录'], fields: ['ptPlanId', 'therapistId', 'assessmentDate'], state: 'assigned -> in_rehab', next: ['P4'] },
  D9: { lane: 'D', title: '手术路径', subtitle: '术前准备', desc: ['创建术前清单并进入规划', '衔接住院手术'], components: ['术前清单', '住院申请', '规划入口'], fields: ['surgeryPathId', 'preopChecklist', 'admissionStatus'], state: 'surgery_selected -> preop_ready', next: ['AI6'] },

  IP1: { lane: 'IP', title: '住院手术治疗', subtitle: '院内执行', desc: ['住院排期与术前准备', '完成手术记录'], components: ['住院排期', '术前核查', '手术记录'], fields: ['inpatientId', 'surgeryDate', 'operationRecordId'], state: 'admitted -> operated', next: ['IP2'] },
  IP2: { lane: 'IP', title: '术后出院与衔接', subtitle: '回归随访/PT', desc: ['生成出院小结', '衔接PT和随访任务'], components: ['出院小结', '衔接任务', '提醒同步'], fields: ['dischargeSummary', 'nextVisitDate', 'handoverId'], state: 'postop -> discharged -> followup_linked', next: ['D8'] }
};

export const dashboardCards = [
  { id: 'N1', cls: 'blue', title: '待预问诊', count: 5, text: '护士接待患者采集初步病情' },
  { id: 'N3', cls: 'red', title: '待红旗分流', count: 3, text: '伴随高风险需分流急症转诊' },
  { id: 'D4', cls: 'amber', title: '待复核影像', count: 7, text: '影像待医生复核并完成诊断' },
  { id: 'D5', cls: 'cyan', title: '待完成接诊', count: 12, text: '完成诊断并确定后续路径' }
];

export const queueData = [
  { name: '林子轩', no: '33 001', age: 14, wait: '15分钟前', stage: 'pre', node: 'N1' },
  { name: '王*文', no: '77 001', age: 20, wait: '20分钟前', stage: 'redflag', node: 'N3' },
  { name: '刘**', no: '25 004', age: 30, wait: '80分钟前', stage: 'review', node: 'D4' },
  { name: '赵青', no: '10 123', age: 17, wait: '5分钟前', stage: 'consult', node: 'D5' }
];

export const stageMap: Record<string, string> = {
  all: '全部',
  pre: '待预问诊',
  redflag: '待红旗分流',
  review: '待复核影像',
  consult: '待完成接诊'
};

export const actionMeta: Record<string, { title: string; desc: string }> = {
  remindLater: { title: '接口调用：稍后提醒', desc: '调用 notification.defer_checkin，写入提醒时间并同步患者端消息中心。' },
  submitQuestionnaire: { title: '接口调用：提交问卷', desc: '调用 encounter.upsert_history + triage.redflag.precheck，触发 GPT 对话解析与结构化入库。' },
  examNavigate: { title: '接口调用：检查导航', desc: '调用 navigation.route + exam.status.track，生成最短路线并开始检查状态追踪。' },
  examDone: { title: '接口调用：检查完成', desc: '调用 exam.complete + diagnosis.pull_latest，触发检查回传和结果同步。' },
  followupCheckin: { title: '接口调用：随访打卡', desc: '调用 followup.task.complete + risk.alert.push，触发 GPT 风险评估与医生通知。' },
  uploadVideo: { title: '接口调用：上传训练视频', desc: '调用 followup.media.upload + mcp.analysis.enqueue，上传训练素材并进入AI评估队列。' },
  nurseNote: { title: '接口调用：分流备注', desc: '调用 triage.note.create，写入分流备注与操作日志。' },
  saveVitalsAndPE: { title: '接口调用：保存病史与PE', desc: '调用 encounter.update_vitals + encounter.update_pe，并触发异常值检测。' },
  transferPriority: { title: '接口调用：红旗优先分流', desc: '调用 triage.transfer_priority + queue.reorder_doctor，患者进入优先接诊队列。' },
  submitNormalTriage: { title: '接口调用：常规分诊提交', desc: '调用 triage.submit_normal + ai.triage.recommend，转入AI智能分诊流程。' },
  openExamOrder: { title: '接口调用：开检查单', desc: '调用 exam.order.create + encounter.update_stage(EXAM_ORDERED)，同步患者端检查任务。' },
  submitDiagnosis: { title: '接口调用：提交诊断', desc: '调用 diagnosis.save + diagnosis.version.lock，提交并进入路径决策。' },
  choosePathFollowup: { title: '接口调用：选择随访路径', desc: '调用 treatment.path.select(followup) + followup.plan.create。' },
  choosePathPt: { title: '接口调用：选择PT路径', desc: '调用 treatment.path.select(pt) + rehab.plan.assign。' },
  choosePathSurgery: { title: '接口调用：选择手术路径', desc: '调用 treatment.path.select(surgery) + surgery.preop.create。' },
  createFollowPlan: { title: '接口调用：创建随访计划', desc: '调用 followup.plan.create + notification.schedule，生成随访任务并设置提醒。' },
  assignPt: { title: '接口调用：分配康复师', desc: '调用 rehab.therapist.assign + rehab.plan.create，进入PT执行。' },
  createSurgeryPath: { title: '接口调用：创建手术路径', desc: '调用 surgery.path.create + ai.surgery.plan，生成术前清单。' },
  aiHistoryParse: { title: '接口调用：AI病史结构化', desc: '调用 gpt.dialog.parse + encounter.upsert_history，生成结构化病史摘要。' },
  aiRedFlagEval: { title: '接口调用：AI红旗判别', desc: '调用 triage.redflag.evaluate + risk.score.calculate，返回命中规则和风险等级。' },
  aiImageInfer: { title: '接口调用：AI影像分析', desc: '调用 image.ai.infer + report.measurement.build，输出标注和测量结果。' },
  aiFollowRisk: { title: '接口调用：AI随访风险评估', desc: '调用 followup.risk.predict + doctor.alert.push，生成预警列表。' },
  aiSurgeryPlan: { title: '接口调用：AI手术规划', desc: '调用 surgery.plan.ai + preop.checklist.generate，输出术前规划建议。' },
  showMorePatients: { title: '接口调用：加载更多患者', desc: '调用 queue.patient.list(nextPage)，按当前筛选加载下一页患者数据。' },
  revokeRiskAlert: { title: '接口调用：撤销预警', desc: '调用 risk.alert.revoke，记录撤销原因并同步侧栏状态。' },
  costTracking: { title: '接口调用：费用跟踪', desc: '调用 billing.timeline.query，拉取患者账单阶段与费用趋势。' },
  smartRecord: { title: '接口调用：病历智能', desc: '调用 emr.smart.assist，生成病历补全建议与编码提示。' },
  followupWorkbench: { title: '接口调用：随访工作台', desc: '调用 followup.workbench.open，进入随访任务分发与复盘页面。' },
  toggleFullScreen: { title: '接口调用：全屏切换', desc: '调用 ui.window.toggle_fullscreen，切换工作台显示模式。' },
  openInbox: { title: '接口调用：消息中心', desc: '调用 message.inbox.list，打开站内消息与系统通知。' },
  openProfileCenter: { title: '接口调用：个人中心', desc: '调用 user.profile.open，进入个人设置与账户信息页面。' }
};
