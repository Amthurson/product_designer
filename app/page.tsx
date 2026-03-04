'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { actionMeta, dashboardCards, laneMeta, nodes, queueData, stageMap } from '../lib/prototypeData';

type Tooltip = { text: string; x: number; y: number } | null;
type ActionDialog = { title: string; desc: string; target?: string } | null;
type WorkspaceTab = 'todo' | 'consult' | 'patient' | 'tools';
const NOTE_STORAGE_KEY = 'pms_next_node_notes_v1';

function tipText(tip: string, state?: string) {
  return state ? `${tip}\n状态机: ${state}` : tip;
}

function useHover() {
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const bind = (tip: string, state?: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
      setTooltip({ text: tipText(tip, state), x: e.clientX + 12, y: e.clientY + 12 }),
    onMouseMove: (e: React.MouseEvent<HTMLElement>) =>
      setTooltip((prev) => (prev ? { ...prev, x: e.clientX + 12, y: e.clientY + 12 } : prev)),
    onMouseLeave: () => setTooltip(null)
  });
  return { tooltip, bind };
}

function formatTodoCount(value: string | number) {
  const raw = String(value ?? '').trim();
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    if (parsed > 999) return '999+';
    return String(Math.max(0, Math.floor(parsed)));
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw || '0';
  if (digits.length > 3) return '999+';
  return digits;
}

export default function Page() {
  const [previewDevice, setPreviewDevice] = useState<'pc' | 'pad' | 'mobile'>('mobile');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('todo');
  const [laneFilter, setLaneFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState('all');
  const [imagingFilter, setImagingFilter] = useState<'todo' | 'uploaded' | 'ai' | 'review'>('todo');
  const [currentNode, setCurrentNode] = useState('D1');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowType, setFlowType] = useState<'user' | 'agent'>('user');
  const [flowScale, setFlowScale] = useState(1);
  const [flowOffset, setFlowOffset] = useState({ x: 0, y: 0 });
  const [flowDragging, setFlowDragging] = useState(false);
  const flowViewportRef = useRef<HTMLDivElement | null>(null);
  const flowDragRef = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteKey, setNoteKey] = useState('HOME');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [view, setView] = useState<'home' | 'node'>('home');
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const { tooltip, bind } = useHover();
  const isPc = previewDevice === 'pc';
  const showNodePanel = panelOpen && !isPc;
  const isPadPortrait = previewDevice === 'pad' && previewSize.height > previewSize.width;

  useEffect(() => {
    if (previewDevice === 'mobile') return;
    const el = previewFrameRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setPreviewSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [previewDevice]);

  useEffect(() => {
    if (!flowOpen) return;
    setFlowScale(1);
    setFlowOffset({ x: 0, y: 0 });
    setFlowDragging(false);
    flowDragRef.current.dragging = false;
  }, [flowOpen, flowType]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setNoteMap(parsed as Record<string, string>);
      }
    } catch (_) {
      // ignore bad storage payload
    }
  }, []);

  const node = nodes[currentNode];
  const nodeKeys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(nodes).filter((k) => {
      const n = nodes[k];
      if (laneFilter !== 'ALL' && n.lane !== laneFilter) return false;
      if (!q) return true;
      return `${k}${n.title}${laneMeta[n.lane].label}`.toLowerCase().includes(q);
    });
  }, [laneFilter, search]);

  const rows = useMemo(
    () => (queueFilter === 'all' ? queueData : queueData.filter((r) => r.stage === queueFilter)),
    [queueFilter]
  );
  const stageCounts = useMemo(() => {
    return queueData.reduce<Record<string, number>>((acc, row) => {
      acc[row.stage] = (acc[row.stage] || 0) + 1;
      return acc;
    }, {});
  }, []);
  const stageTagClass: Record<string, string> = {
    pre: 'status-pre',
    redflag: 'status-redflag',
    review: 'status-review',
    consult: 'status-consult'
  };
  const tabCountClass: Record<string, string> = {
    all: 'count-all',
    pre: 'count-pre',
    redflag: 'count-redflag',
    review: 'count-review',
    consult: 'count-consult'
  };

  const tabByNode = (key: string): WorkspaceTab => {
    if (key.startsWith('P')) return 'patient';
    if (key.startsWith('AI')) return 'tools';
    return 'consult';
  };

  const noteLabel = (key: string) => {
    if (key === 'HOME') return '首页工作台';
    return nodes[key] ? `${key} · ${nodes[key].title}` : key;
  };

  const clampFlowScale = (v: number) => Math.min(3, Math.max(0.4, Number(v.toFixed(3))));
  const updateFlowScale = (next: number) => setFlowScale((prev) => clampFlowScale(typeof next === 'number' ? next : prev));
  const resetFlowView = () => {
    setFlowScale(1);
    setFlowOffset({ x: 0, y: 0 });
  };

  const openNoteModal = (key?: string) => {
    const finalKey = key || (view === 'home' ? 'HOME' : currentNode);
    setNoteKey(finalKey);
    setNoteDraft(noteMap[finalKey] || '');
    setNoteOpen(true);
  };

  const openNode = (key: string) => {
    setCurrentNode(key);
    setView('node');
    setWorkspaceTab(tabByNode(key));
  };

  const goWorkspace = (tab: WorkspaceTab) => {
    setWorkspaceTab(tab);
    if (tab === 'todo') {
      setView('home');
      return;
    }
    if (tab === 'consult') {
      openNode('D1');
      return;
    }
    if (tab === 'patient') {
      openNode('P1');
      return;
    }
    openNode('AI3');
  };

  const handleAction = (action?: string, target?: string) => {
    if (action === 'nurseNote') {
      openNoteModal(currentNode);
      return;
    }
    if (action && actionMeta[action]) {
      setActionDialog({ ...actionMeta[action], target });
      return;
    }
    if (target) openNode(target);
  };

  const buttonHover = (action?: string, target?: string) => {
    if (action && actionMeta[action]) {
      return bind(`点击触发${actionMeta[action].title}，弹出接口回执说明`, 'click -> api_request -> response');
    }
    if (target && nodes[target]) {
      return bind(`点击跳转到 ${target} · ${nodes[target].title} 页面`, 'click -> route_transition');
    }
    return bind('点击执行交互', 'click -> interaction');
  };

  const patientBanner = (name: string, meta: string, right: string) => (
    <section className="mobile-card patient-banner" {...bind('患者上下文卡', 'loaded')}>
      <div className="patient-avatar">林</div>
      <div className="patient-main">
        <h4>{name}</h4>
        <p>{meta} · 就诊号 D1817360202</p>
      </div>
      <div className="patient-right">{right}</div>
    </section>
  );

  const renderNodePage = () => {
    const renderRedFlagStyledPage = (yesTarget: string, noTarget: string, laneHint: string) => (
      <>
        {patientBanner('林子轩', '33岁 · 男', 'AI重度 3分')}
        <section className="mobile-card rf-card" {...bind('红旗症状命中：展示命中项与风险等级，支持快速分流', 'to_judge -> redflag_or_normal')}>
          <div className="rf-head-line">
            <h5>红旗症状命中 <span className="rf-count">3项</span></h5>
            <b className="rf-risk">中度风险</b>
          </div>
          <div className="rf-list">
            <div className="rf-list-item"><span>下肢运动障碍</span><em className="hit-tag">命中</em></div>
            <div className="rf-list-item"><span>尿便失禁</span><em className="hit-tag">命中</em></div>
            <div className="rf-list-item"><span>持续疼痛 &gt; 6周</span><em className="hit-tag">命中</em></div>
          </div>
        </section>
        <section className="mobile-card suggest-card" {...bind('处理建议：直转接诊/急诊或进入AI智能分诊', 'decision_pending -> routed')}>
          <h5>处理建议</h5>
          <div className="option-grid">
            <button className="option-btn warn" {...buttonHover(undefined, yesTarget)} onClick={() => handleAction(undefined, yesTarget)}>直转医生接诊</button>
            <button className="option-btn info" {...buttonHover(undefined, 'D1')} onClick={() => handleAction(undefined, 'D1')}>急诊转诊</button>
          </div>
          <label className="radio-line">
            <input type="radio" name="rf-next" /> 暂无红旗，进入下一步
          </label>
          <button className="major full primary-wide" {...buttonHover(undefined, noTarget)} onClick={() => handleAction(undefined, noTarget)}>进入AI智能分诊</button>
        </section>
        <section className="bottom-meta" {...bind(`分流操作补充（${laneHint}）`, 'confirmed')}>
          <span>分流时间 14:32</span>
          <button className="ghost" {...buttonHover('nurseNote')} onClick={() => handleAction('nurseNote')}>填写备注</button>
        </section>
      </>
    );

    if (currentNode === 'P1') {
      return (
        <>
          <section className="mobile-card" {...bind('签到流程：扫码或定位触发签到，生成 encounterId 并进入待接诊队列', 'idle -> checked_in -> queued')}>
            <h5>到院签到</h5>
            <p>已到达骨科门诊，是否签到并获取排号？</p>
            <div className="btn-row">
              <button className="major" {...buttonHover(undefined, 'P2')} onClick={() => handleAction(undefined, 'P2')}>立即签到</button>
              <button className="ghost" {...buttonHover('remindLater')} onClick={() => handleAction('remindLater')}>稍后提醒</button>
            </div>
          </section>
          <section className="mobile-card" {...bind('系统自动化：MCP function call 调用 checkin.create、queue.fetch_position、clinic.route.get', 'checked_in -> waiting')}>
            <div className="kv"><span>当前排号</span><b>A-023</b></div>
            <div className="kv"><span>预计等待</span><b>15分钟</b></div>
            <div className="kv"><span>诊室位置</span><b>2号楼 3层 14诊区</b></div>
          </section>
        </>
      );
    }

    if (currentNode === 'P2') {
      return (
        <section className="mobile-card" {...bind('AI能力：GPT用户对话解析并结构化；MCP function call: encounter.upsert_history、triage.redflag.precheck', 'draft -> collecting -> submitted')}>
          <h5>AI问诊问卷</h5>
          <label>主诉</label>
          <textarea placeholder="例如：腰背痛2个月，近期加重" />
          <label>疼痛评分 VAS</label>
          <div className="chips"><span>2</span><span>4</span><span className="active">6</span><span>8</span></div>
          <label>对话摘要（AI）</label>
          <p className="summary">持续腰背痛，活动后加重，无明显外伤史。</p>
          <button
            className="major full"
            {...buttonHover('submitQuestionnaire', 'N1')}
            onClick={() => handleAction('submitQuestionnaire', 'N1')}
          >
            提交并进入预问诊
          </button>
        </section>
      );
    }

    if (currentNode === 'P3') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '待检查')}
          <section className="mobile-card" {...bind('AI能力：GPT将检查单转为患者可理解步骤；MCP function call: exam.appointment.create、exam.status.track、navigation.route', 'ordered -> in_exam -> completed')}>
            <h5>检查引导</h5>
            <div className="kv"><span>检查项目</span><b>X-ray (AP/PA)</b></div>
            <div className="kv"><span>检查地点</span><b>影像中心 1层 3号室</b></div>
            <div className="kv"><span>预约时间</span><b>14:45</b></div>
            <div className="btn-row">
              <button className="major" {...buttonHover('examNavigate')} onClick={() => handleAction('examNavigate')}>开始前往检查室</button>
              <button className="ghost" {...buttonHover('examDone', 'P4')} onClick={() => handleAction('examDone', 'P4')}>已完成检查</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'P4') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '回诊中')}
          <section className="mobile-card" {...bind('AI能力：GPT将影像结构化结果翻译为患者可读结论；MCP function call: diagnosis.pull_latest、plan.sync_patient、notification.revisit', 'exam_done -> diagnosis_ready -> result_received')}>
            <h5>处置结果</h5>
            <div className="kv"><span>医生结论</span><b>建议保守治疗，2周复诊</b></div>
            <div className="kv"><span>AI辅助结果</span><b>Cobb角 18°，需随访观察</b></div>
            <div className="kv"><span>下一步</span><b>康复训练 + 随访问卷</b></div>
            <button className="major full" {...buttonHover(undefined, 'P5')} onClick={() => handleAction(undefined, 'P5')}>查看随访计划</button>
          </section>
        </>
      );
    }

    if (currentNode === 'P5') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '随访执行中')}
          <section className="mobile-card" {...bind('AI能力：GPT解析患者随访对话与问卷，生成风险等级；MCP function call: followup.task.complete、risk.alert.push、doctor.notify', 'scheduled -> in_followup -> alert_or_complete')}>
            <h5>随访与训练打卡</h5>
            <div className="kv"><span>本周任务</span><b>3/5 已完成</b></div>
            <div className="kv"><span>依从性评分</span><b>82 分</b></div>
            <div className="kv"><span>风险评估</span><b>低风险（持续观察）</b></div>
            <div className="btn-row">
              <button className="major" {...buttonHover('followupCheckin')} onClick={() => handleAction('followupCheckin')}>今日打卡</button>
              <button className="ghost" {...buttonHover('uploadVideo')} onClick={() => handleAction('uploadVideo')}>上传训练视频</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'N1') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '40分钟内到院')}
          <section className="mobile-card" {...bind('AI预问诊摘要', 'submitted -> reviewed')}>
            <div className="card-title">AI预问诊</div>
            <div className="line-item"><span>专病门诊建议</span><b>脊柱专病门诊</b></div>
            <div className="line-item"><span>红旗规则命中</span><b>3项高风险分流</b></div>
            <div className="danger-list">
              <span>下肢运动障碍</span>
              <span>尿便失禁</span>
            </div>
          </section>
          <section className="mobile-card" {...bind('预问诊队列', 'queued -> triaging')}>
            <h5>待分流患者</h5>
            <div className="queue-mini-row"><span>林子轩 33.001</span><button className="ghost" {...buttonHover(undefined, 'N3')} onClick={() => handleAction(undefined, 'N3')}>开始分流</button></div>
            <div className="queue-mini-row"><span>王*文 77.001</span><button className="ghost" {...buttonHover(undefined, 'N3')} onClick={() => handleAction(undefined, 'N3')}>开始分流</button></div>
            <div className="queue-mini-row"><span>刘** 25.004</span><button className="ghost" {...buttonHover(undefined, 'N3')} onClick={() => handleAction(undefined, 'N3')}>开始分流</button></div>
          </section>
          <section className="decision-stack">
            <button className="major danger" {...buttonHover(undefined, 'N4')} onClick={() => handleAction(undefined, 'N4')}>是，直转医生接诊/急诊</button>
            <button className="major" {...buttonHover(undefined, 'N5')} onClick={() => handleAction(undefined, 'N5')}>否，进入AI智能分诊</button>
          </section>
        </>
      );
    }

    if (currentNode === 'N2') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '补录中')}
          <section className="mobile-card" {...bind('护士补录：体征与PE结构化录入，保存后同步 encounter 并触发异常检测', 'editing -> validated -> submitted')}>
            <h5>补充病史 + PE</h5>
            <label>体温 / 血压 / VAS</label>
            <textarea placeholder="例：体温 37.2℃；血压 126/82；VAS 6分" />
            <label>体格检查（PE）</label>
            <textarea placeholder="例：腰椎活动受限，直腿抬高试验阳性" />
            <div className="btn-row">
              <button className="major" {...buttonHover('saveVitalsAndPE', 'N3')} onClick={() => handleAction('saveVitalsAndPE', 'N3')}>保存并进入红旗判定</button>
              <button className="ghost" {...buttonHover(undefined, 'N1')} onClick={() => handleAction(undefined, 'N1')}>返回预问诊队列</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'N3') {
      return renderRedFlagStyledPage('N4', 'N5', '护士端');
    }

    if (currentNode === 'N4') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '红旗已命中')}
          <section className="mobile-card danger-card" {...bind('红旗转诊：确认优先接诊/急诊，写入分流类型和接收医生', 'confirmed -> transferred')}>
            <h5>标记红旗并分流</h5>
            <ul>
              <li>分流类型 <em>医生优先接诊</em></li>
              <li>接收医生 <em>孙医生</em></li>
              <li>分流时间 <em>14:32</em></li>
            </ul>
            <div className="btn-row">
              <button className="major danger" {...buttonHover('transferPriority', 'D1')} onClick={() => handleAction('transferPriority', 'D1')}>确认转入优先队列</button>
              <button className="ghost" {...buttonHover(undefined, 'N3')} onClick={() => handleAction(undefined, 'N3')}>返回修改</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'N5') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '常规分诊')}
          <section className="mobile-card" {...bind('无红旗路径：提交分诊结论并触发AI智能分诊建议', 'normal_confirmed -> routed')}>
            <h5>无红旗提交分诊</h5>
            <div className="line-item"><span>目标专科</span><b>脊柱专病门诊</b></div>
            <div className="line-item"><span>优先级</span><b>常规 NORMAL</b></div>
            <div className="line-item"><span>备注</span><b>建议先行X-ray</b></div>
            <div className="btn-row">
              <button className="major" {...buttonHover('submitNormalTriage', 'AI3')} onClick={() => handleAction('submitNormalTriage', 'AI3')}>提交并进入AI分诊</button>
              <button className="ghost" {...buttonHover(undefined, 'N3')} onClick={() => handleAction(undefined, 'N3')}>返回红旗判定</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'AI3') {
      return (
        <>
          {patientBanner('林子轩', '14岁 · 男', '待红旗分流')}
          <section className="mobile-card" {...bind('AI智能分诊建议', 'triage_input -> recommend')}>
            <div className="card-title">AI智能分诊</div>
            <p className="summary">建议挂号脊柱专病门诊，阅片后接诊</p>
            <div className="exam-item">
              <div>
                <h6>X-ray (AP/PA)</h6>
                <small>推荐用量适中</small>
              </div>
              <span>›</span>
            </div>
            <button className="major full" {...buttonHover(undefined, 'D3')} onClick={() => handleAction(undefined, 'D3')}>一键开检查单</button>
            <button className="ghost full" {...buttonHover(undefined, 'D1')} onClick={() => handleAction(undefined, 'D1')}>转入专病队列</button>
          </section>
        </>
      );
    }

    if (currentNode === 'AI1') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', 'AI解析中')}
          <section className="mobile-card" {...bind('AI病史结构化：解析问卷和对话，输出主诉/现病史/既往史摘要', 'received -> parsed -> output')}>
            <h5>AI病史结构化</h5>
            <div className="kv"><span>主诉摘要</span><b>腰背痛2月，近期加重</b></div>
            <div className="kv"><span>风险提示</span><b>建议红旗复核</b></div>
            <button className="major full" {...buttonHover('aiHistoryParse', 'N1')} onClick={() => handleAction('aiHistoryParse', 'N1')}>应用解析结果</button>
          </section>
        </>
      );
    }

    if (currentNode === 'AI2') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '规则判别')}
          <section className="mobile-card danger-card" {...bind('AI红旗规则判别：命中规则并输出风险等级', 'input -> score -> decision_hint')}>
            <h5>红旗规则判别</h5>
            <ul>
              <li>下肢运动障碍 <em>命中</em></li>
              <li>尿便失禁 <em>命中</em></li>
              <li>风险等级 <em>中高风险</em></li>
            </ul>
            <button className="major full" {...buttonHover('aiRedFlagEval', 'N3')} onClick={() => handleAction('aiRedFlagEval', 'N3')}>推送到红旗判定</button>
          </section>
        </>
      );
    }

    if (currentNode === 'AI4') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '影像分析中')}
          <section className="mobile-card" {...bind('AI影像分析：自动标注与测量，生成待复核结果', 'image_ready -> inferred -> pending_review')}>
            <h5>AI影像分析</h5>
            <div className="review-split">
              <div className="left">
                <div className="img-thumb" />
                <div className="img-thumb" />
              </div>
              <div className="right">
                <p>自动测量：Cobb角 18°</p>
                <p>建议：医生复核后确认诊断结论</p>
              </div>
            </div>
            <button className="major full" {...buttonHover('aiImageInfer', 'D4')} onClick={() => handleAction('aiImageInfer', 'D4')}>提交医生复核</button>
          </section>
        </>
      );
    }

    if (currentNode === 'AI5') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '随访评估')}
          <section className="mobile-card" {...bind('AI随访风险评估：依从性+症状趋势，推送预警', 'collect -> score -> notify')}>
            <h5>随访风险评估</h5>
            <div className="kv"><span>依从性</span><b>82 分</b></div>
            <div className="kv"><span>症状趋势</span><b>轻度改善</b></div>
            <div className="kv"><span>预警等级</span><b>低风险</b></div>
            <button className="major full" {...buttonHover('aiFollowRisk', 'D7')} onClick={() => handleAction('aiFollowRisk', 'D7')}>推送医生随访页</button>
          </section>
        </>
      );
    }

    if (currentNode === 'AI6') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '术前规划')}
          <section className="mobile-card" {...bind('AI手术规划：术前风险与清单建议', 'preop_input -> planning -> pushed')}>
            <h5>手术规划辅助</h5>
            <div className="kv"><span>术前风险</span><b>中风险</b></div>
            <div className="kv"><span>建议术式</span><b>椎体矫形+内固定</b></div>
            <button className="major full" {...buttonHover('aiSurgeryPlan', 'IP1')} onClick={() => handleAction('aiSurgeryPlan', 'IP1')}>推送住院路径</button>
          </section>
        </>
      );
    }

    if (currentNode === 'D1') {
      return (
        <>
          <section className="mobile-card" {...bind('影像队列搜索', 'idle -> searching')}>
            <input placeholder="输入姓名/就诊号/检查号" />
            <div className="chips row">
              <button
                className={imagingFilter === 'todo' ? 'active' : ''}
                {...bind('筛选：待检查列表', 'filter -> todo')}
                onClick={() => setImagingFilter('todo')}
              >
                待检查
              </button>
              <button
                className={imagingFilter === 'uploaded' ? 'active' : ''}
                {...bind('筛选：已上传结果列表', 'filter -> uploaded')}
                onClick={() => setImagingFilter('uploaded')}
              >
                已上传
              </button>
              <button
                className={imagingFilter === 'ai' ? 'active' : ''}
                {...bind('筛选：AI分析中列表', 'filter -> ai')}
                onClick={() => setImagingFilter('ai')}
              >
                AI分析中
              </button>
              <button
                className={imagingFilter === 'review' ? 'active' : ''}
                {...bind('筛选：待医生复核列表', 'filter -> review')}
                onClick={() => setImagingFilter('review')}
              >
                待医生复核 3
              </button>
            </div>
          </section>
          <section className="mobile-card" {...bind('影像生分诊卡', 'queued -> exam_ordered')}>
            <h5>影像生分诊</h5>
            <div className="exam-item">
              <div>
                <h6>脊柱专病门诊</h6>
                <small>X-r (AP/PA)</small>
              </div>
              <div className="xray-thumb" />
            </div>
            <button className="major full" {...buttonHover(undefined, 'D3')} onClick={() => handleAction(undefined, 'D3')}>一键开检查单</button>
            <button className="ghost full" {...buttonHover(undefined, 'D2')} onClick={() => handleAction(undefined, 'D2')}>转入专病队列</button>
          </section>
        </>
      );
    }

    if (currentNode === 'D2') {
      return renderRedFlagStyledPage('D1', 'AI3', '医生端');
    }

    if (currentNode === 'D3') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '开单操作')}
          <section className="mobile-card" {...bind('开检查单：选择项目和优先级，提交后同步患者端', 'draft -> ordered')}>
            <h5>开检查单</h5>
            <div className="exam-item">
              <div>
                <h6>X-ray (AP/PA)</h6>
                <small>优先级：常规</small>
              </div>
              <span>✓</span>
            </div>
            <div className="btn-row">
              <button className="major" {...buttonHover('openExamOrder', 'I1')} onClick={() => handleAction('openExamOrder', 'I1')}>提交检查单</button>
              <button className="ghost" {...buttonHover(undefined, 'P3')} onClick={() => handleAction(undefined, 'P3')}>通知患者检查</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'D4') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '待医生复核')}
          <section className="mobile-card" {...bind('影像复核页面', 'pending_review -> confirmed_or_adjusted')}>
            <h5>影像复核</h5>
            <div className="review-split">
              <div className="left">
                <div className="img-thumb" />
                <div className="img-thumb" />
              </div>
              <div className="right">
                <p>AI结论：疑似脊柱侧弯，建议进一步评估。</p>
                <p>测量：Cobb角 18°，骨盆倾斜 4°</p>
              </div>
            </div>
            <div className="btn-row">
              <button className="ghost" {...buttonHover(undefined, 'D5')} onClick={() => handleAction(undefined, 'D5')}>驳回并修改</button>
              <button className="major" {...buttonHover(undefined, 'D5')} onClick={() => handleAction(undefined, 'D5')}>确认复核</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'D5') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '诊断录入')}
          <section className="mobile-card" {...bind('诊断录入与处置建议：保存后进入路径决策', 'editing -> validated -> submitted')}>
            <h5>诊断录入</h5>
            <label>诊断结论</label>
            <textarea placeholder="例：青少年特发性脊柱侧弯，建议保守治疗" />
            <label>处置建议</label>
            <textarea placeholder="例：康复训练+2周随访复诊" />
            <button className="major full" {...buttonHover('submitDiagnosis', 'D6')} onClick={() => handleAction('submitDiagnosis', 'D6')}>提交并进入路径决策</button>
          </section>
        </>
      );
    }

    if (currentNode === 'D6') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '路径决策')}
          <section className="mobile-card" {...bind('治疗路径选择：随访/PT/手术三选一，可回落到处方执行与随访管理', 'pending_decision -> route_selected')}>
            <h5>治疗路径选择</h5>
            <div className="path-grid">
              <button className="ghost" {...buttonHover('choosePathFollowup', 'D7')} onClick={() => handleAction('choosePathFollowup', 'D7')}>随访路径</button>
              <button className="ghost" {...buttonHover('choosePathPt', 'D8')} onClick={() => handleAction('choosePathPt', 'D8')}>PT康复路径</button>
              <button className="ghost" {...buttonHover('choosePathSurgery', 'D9')} onClick={() => handleAction('choosePathSurgery', 'D9')}>手术路径</button>
            </div>
          </section>
        </>
      );
    }

    if (currentNode === 'D7') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '随访计划')}
          <section className="mobile-card" {...bind('随访计划制定：频率、任务与提醒规则', 'planning -> active')}>
            <h5>随访计划制定</h5>
            <div className="kv"><span>随访频率</span><b>每周2次</b></div>
            <div className="kv"><span>提醒方式</span><b>患者端消息 + 短信</b></div>
            <button className="major full" {...buttonHover('createFollowPlan', 'P4')} onClick={() => handleAction('createFollowPlan', 'P4')}>保存并同步患者端</button>
          </section>
        </>
      );
    }

    if (currentNode === 'D8') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', 'PT介入')}
          <section className="mobile-card" {...bind('PT介入：分配康复师并创建训练方案', 'assigned -> in_rehab')}>
            <h5>PT介入</h5>
            <div className="kv"><span>康复师</span><b>张治疗师</b></div>
            <div className="kv"><span>计划模板</span><b>脊柱侧弯基础模板</b></div>
            <button className="major full" {...buttonHover('assignPt', 'P4')} onClick={() => handleAction('assignPt', 'P4')}>分配并开始康复路径</button>
          </section>
        </>
      );
    }

    if (currentNode === 'D9') {
      return (
        <>
          {patientBanner('林子轩', '33岁 · 男', '手术路径')}
          <section className="mobile-card" {...bind('手术路径：创建术前清单并对接AI规划与住院', 'surgery_selected -> preop_ready')}>
            <h5>手术路径</h5>
            <div className="kv"><span>术前检查</span><b>已完成 4/6</b></div>
            <div className="kv"><span>住院申请</span><b>待提交</b></div>
            <button className="major full" {...buttonHover('createSurgeryPath', 'AI6')} onClick={() => handleAction('createSurgeryPath', 'AI6')}>创建术前路径并调用AI规划</button>
          </section>
        </>
      );
    }

    return (
      <section className="mobile-card" {...bind(node.title, node.state)}>
        <h5>{currentNode} · {node.title}</h5>
        <ul>
          {node.components.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
    );
  };

  const renderQueueSection = () => (
    <section className="mobile-card">
      <div className="queue-head">
        <h4>患者队列</h4>
        <span>今日需接诊 {rows.length} 人</span>
      </div>
      <div className="chips row">
        {Object.keys(stageMap).map((k) => (
          <button key={k} className={queueFilter === k ? 'active' : ''} onClick={() => setQueueFilter(k)}>
            {stageMap[k]}
            <span className={`chip-count ${tabCountClass[k] || 'count-all'}`}>
              {formatTodoCount(k === 'all' ? queueData.length : (stageCounts[k] || 0))}
            </span>
          </button>
        ))}
      </div>
      <div className="patient-list-wrap">
        {rows.map((r) => (
          <div key={`${r.no}${r.stage}`} className="patient-card" {...bind('患者队列行：点击开始接诊', `${r.stage} -> in_consultation`)}>
            <div className="patient-card-left">
              <div className="patient-card-head">
                <div className="mini-avatar">{r.name.slice(0, 1)}</div>
                <h5>{r.name} <span>{r.no}</span></h5>
              </div>
              <p>{r.age} 岁 · {r.wait}</p>
              <em className={`status-chip ${stageTagClass[r.stage] || 'status-pre'}`}>{stageMap[r.stage]}</em>
            </div>
            <button className="major small" {...buttonHover(undefined, r.node)} onClick={() => handleAction(undefined, r.node)}>开始接诊</button>
          </div>
        ))}
      </div>
      <div className="queue-more">
        <button
          className="ghost"
          {...buttonHover('showMorePatients')}
          onClick={() => handleAction('showMorePatients')}
        >
          + 10位患者
        </button>
      </div>
      {rows.length === 0 && (
        <div className="queue-empty">当前筛选暂无患者</div>
      )}
    </section>
  );

  const renderHomeScreen = () => {
    if (previewDevice === 'mobile') {
      return (
        <div className="screen-body">
          {renderQueueSection()}
        </div>
      );
    }

    return (
      <div className="workspace-content">
        <section className="workspace-main-col">
          <h4 className="workspace-title">待办</h4>
          <div className="todo-stack desktop">
            {dashboardCards.map((c) => (
              <button key={c.id} className={`todo ${c.cls}`} {...bind(`点击进入${nodes[c.id].title}节点`, 'queued -> opened')} onClick={() => openNode(c.id)}>
                <h4>{c.title}</h4>
                <p><span>{formatTodoCount(c.count)}</span>{c.text}</p>
              </button>
            ))}
          </div>
          {renderQueueSection()}
        </section>
        <aside className="workspace-side-col">
          <section className="mobile-card" {...bind('高危患者侧栏', 'monitoring')}>
            <div className="queue-head">
              <h4>高危风险预警</h4>
              <button
                className="ghost"
                {...buttonHover('revokeRiskAlert')}
                onClick={() => handleAction('revokeRiskAlert')}
              >
                撤销
              </button>
            </div>
            <div className="patient-card">
              <div className="patient-card-left">
                <div className="patient-card-head">
                  <div className="mini-avatar">林</div>
                  <h5>林小强 <span>66岁</span></h5>
                </div>
                <p>63分钟前</p>
              </div>
            </div>
          </section>
          <section className="mobile-card" {...bind('常用工具入口', 'idle')}>
            <h5>常用工具</h5>
            <div className="tools-grid">
              <button className="ghost" {...buttonHover('openExamOrder', 'D3')} onClick={() => handleAction('openExamOrder', 'D3')}>开检查单</button>
              <button className="ghost" {...buttonHover('costTracking')} onClick={() => handleAction('costTracking')}>费用跟踪</button>
              <button className="ghost" {...buttonHover('smartRecord')} onClick={() => handleAction('smartRecord')}>病历智能</button>
              <button className="ghost" {...buttonHover('followupWorkbench', 'D7')} onClick={() => handleAction('followupWorkbench', 'D7')}>随访</button>
            </div>
          </section>
        </aside>
      </div>
    );
  };

  const renderNodeScreen = () => (
    <div className="screen-body">
      {renderNodePage()}
      <section className="mobile-card">
        <h5>下一步流程</h5>
        <div className="next">
          {node.next.map((n) => (
            <button key={n} className="ghost" {...buttonHover(undefined, n)} onClick={() => handleAction(undefined, n)}>
              {n} · {nodes[n]?.title || n}
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="root">
      <header className="top glass">
        <div>
          <h1>门诊流程高保真原型</h1>
          <p>一套信息架构，多端自适应 · 节点说明/状态机支持弹窗查看</p>
        </div>
        <div className="head-actions">
          <div className="device-switch">
            <button
              className={previewDevice === 'pc' ? 'active' : ''}
              onClick={() => setPreviewDevice('pc')}
              {...bind('切换到PC预览模式', 'device:mobile/pad -> pc')}
            >
              PC
            </button>
            <button
              className={previewDevice === 'pad' ? 'active' : ''}
              onClick={() => setPreviewDevice('pad')}
              {...bind('切换到Pad预览模式', 'device:mobile/pc -> pad')}
            >
              Pad
            </button>
            <button
              className={previewDevice === 'mobile' ? 'active' : ''}
              onClick={() => setPreviewDevice('mobile')}
              {...bind('切换到移动端预览模式', 'device:pc/pad -> mobile')}
            >
              移动端
            </button>
          </div>
          {previewDevice !== 'pc' && <button {...bind('打开/关闭节点面板', 'click -> panel_toggle')} onClick={() => setPanelOpen((v) => !v)}>节点面板</button>}
          <button {...bind('打开流程图弹窗', 'click -> flow_open')} onClick={() => setFlowOpen(true)}>流程图</button>
          <button {...bind('打开备注弹窗（可按节点保存）', 'click -> note_open')} onClick={() => openNoteModal()}>备注</button>
          <button {...bind('打开节点说明弹窗', 'click -> detail_open')} onClick={() => { setDetailCollapsed(false); setDetailOpen(true); }}>节点说明</button>
        </div>
      </header>

      <main className={`main ${isPc ? 'pc-mode' : ''}`}>
        {showNodePanel && (
          <aside className="left glass">
            <h2>泳道节点</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索节点，如 N3 / 红旗" />
            <div className="chips">
              {Object.keys(laneMeta).map((k) => (
                <button key={k} className={laneFilter === k ? 'active' : ''} onClick={() => setLaneFilter(k)}>
                  {laneMeta[k as keyof typeof laneMeta].label}
                </button>
              ))}
            </div>
            <div className="node-list">
              {nodeKeys.map((k) => (
                <button key={k} className="node-item" onClick={() => openNode(k)}>
                  <small>{k} · {laneMeta[nodes[k].lane].label}</small>
                  <strong>{nodes[k].title}</strong>
                </button>
              ))}
            </div>
          </aside>
        )}

        <section className={`phone-wrap ${isPc ? 'pc-full' : ''}`}>
          <div
            ref={previewFrameRef}
            className={`preview-stage ${previewDevice === 'mobile' ? '' : 'resizable'} preview-${previewDevice}`}
          >
            <div className={`device-shell preview-${previewDevice}`}>
            {previewDevice === 'mobile' && <div className="device-notch" />}
            <div className="phone">
              {previewDevice === 'mobile' ? (
                <>
                  <div className="status-bar">
                    <span>14:30</span>
                    <span>◔◌  📶  🔋</span>
                  </div>
                  <div className="screen-head">
                    <button className="icon-lite" onClick={() => { setView('home'); setWorkspaceTab('todo'); }}>←</button>
                    <div>
                      <h3>{view === 'home' ? '孙医生' : node.title}</h3>
                      <p>{view === 'home' ? '待办工作台' : `${laneMeta[node.lane].label} · ${node.subtitle}`}</p>
                    </div>
                    <div className="right-icons">
                      <button className="icon-lite" {...bind('快捷新增：扫码签到/拍照上传/开检查单', 'click -> quick_actions')} onClick={() => setActionDialog({ title: '快捷操作', desc: '示意：扫码签到 / 拍照上传 / 开检查单 / 新增患者' })}>＋</button>
                      <button className="icon-lite" {...bind('节点面板开关', 'click -> panel_toggle')} onClick={() => setPanelOpen((v) => !v)}>⌗</button>
                      <button className="icon-lite" {...bind('打开节点说明弹窗', 'click -> detail_open')} onClick={() => { setDetailCollapsed(false); setDetailOpen(true); }}>ⓘ</button>
                    </div>
                  </div>
                  {view === 'home' && (
                    <section className="search-box" {...bind('全局搜索：姓名/就诊号/手机号/检查号/影像号', 'idle -> typing -> results')}>
                      <span>⌕</span>
                      <input placeholder="输入姓名/就诊号/手机号" />
                    </section>
                  )}
                  {view === 'home' ? renderHomeScreen() : renderNodeScreen()}
                  <nav className="bottom-nav">
                    <button className={workspaceTab === 'todo' ? 'active' : ''} {...bind('切换到底部Tab：待办', 'tab -> todo')} onClick={() => goWorkspace('todo')}>待办</button>
                    <button className={workspaceTab === 'consult' ? 'active' : ''} {...bind('切换到底部Tab：接诊', 'tab -> consult')} onClick={() => goWorkspace('consult')}>接诊</button>
                    <button className={workspaceTab === 'patient' ? 'active' : ''} {...bind('切换到底部Tab：患者', 'tab -> patient')} onClick={() => goWorkspace('patient')}>患者</button>
                    <button className={workspaceTab === 'tools' ? 'active' : ''} {...bind('切换到底部Tab：我的', 'tab -> tools')} onClick={() => goWorkspace('tools')}>我的</button>
                  </nav>
                  <button className="fab" {...bind('快捷操作入口', 'click -> quick_actions')} onClick={() => setActionDialog({ title: '快捷操作', desc: '示意：扫码签到 / 拍照上传 / 开检查单 / 新增患者' })}>＋</button>
                </>
              ) : (
                <div className={`workspace ${previewDevice} ${isPadPortrait ? 'pad-portrait' : 'pad-landscape'}`}>
                  <aside className="workspace-sider">
                    <div className="workspace-brand">孙医生</div>
                    <div className="workspace-nav">
                      <button className={workspaceTab === 'todo' ? 'active' : ''} {...bind('切换左侧菜单：待办', 'menu -> todo')} onClick={() => goWorkspace('todo')}>待办</button>
                      <button className={workspaceTab === 'consult' ? 'active' : ''} {...bind('切换左侧菜单：接诊', 'menu -> consult')} onClick={() => goWorkspace('consult')}>接诊</button>
                      <button className={workspaceTab === 'patient' ? 'active' : ''} {...bind('切换左侧菜单：患者', 'menu -> patient')} onClick={() => goWorkspace('patient')}>患者</button>
                      <button className={workspaceTab === 'tools' ? 'active' : ''} {...bind('切换左侧菜单：工具', 'menu -> tools')} onClick={() => goWorkspace('tools')}>工具</button>
                    </div>
                    <button className="workspace-settings" {...bind('打开设置中心弹窗', 'click -> settings_open')} onClick={() => setActionDialog({ title: '设置中心', desc: '示意：个人设置 / 提醒策略 / 界面偏好 / 账户安全' })}>设置</button>
                  </aside>
                  <section className="workspace-main">
                    <header className="workspace-topbar">
                      <section className="search-box" {...bind('全局搜索：姓名/就诊号/手机号/检查号/影像号', 'idle -> typing -> results')}>
                        <span>⌕</span>
                        <input placeholder="输入姓名/就诊专/手机号" />
                      </section>
                      <div className="right-icons">
                        <button className="icon-lite" {...buttonHover('toggleFullScreen')} onClick={() => handleAction('toggleFullScreen')}>⤢</button>
                        <button className="icon-lite" {...buttonHover('openInbox')} onClick={() => handleAction('openInbox')}>✉</button>
                        <button className="icon-lite" {...buttonHover('openProfileCenter')} onClick={() => handleAction('openProfileCenter')}>◉</button>
                      </div>
                    </header>
                    {view === 'home' ? renderHomeScreen() : renderNodeScreen()}
                  </section>
                </div>
              )}
            </div>
          </div>
          </div>
        </section>
      </main>

      {detailOpen && (
        <div className="overlay detail-overlay" onClick={() => setDetailOpen(false)}>
          <div className={`dialog detail-dialog ${detailCollapsed ? 'collapsed' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head detail-head">
              <div>
                <h3 className="detail-title">{currentNode} · {node.title}</h3>
                <p className="detail-subtitle">{laneMeta[node.lane].label} · {node.subtitle}</p>
              </div>
              <div className="dialog-actions">
                <button className="ghost detail-action" onClick={() => setDetailCollapsed((v) => !v)}>{detailCollapsed ? '展开' : '收起'}</button>
                <button className="ghost detail-action" onClick={() => setDetailOpen(false)}>关闭</button>
              </div>
            </div>
            {!detailCollapsed && (
              <div className="grid">
                <section className="detail-block">
                  <h4>页面交互说明</h4>
                  <ul>{node.desc.map((d) => <li key={d}>{d}</li>)}</ul>
                </section>
                <section className="detail-block">
                  <h4>业务组件（可交互）</h4>
                  <ul>{node.components.map((c) => <li key={c}>{c}</li>)}</ul>
                </section>
                <section className="detail-block">
                  <h4>状态机</h4>
                  <div className="state-box"><code>{node.state}</code></div>
                </section>
                <section className="detail-block">
                  <h4>数据字段</h4>
                  <ul>{node.fields.map((f) => <li key={f}><code>{f}</code></li>)}</ul>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {flowOpen && (
        <div className="overlay" onClick={() => setFlowOpen(false)}>
          <div className="dialog flow-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flow-head">
              <div>
                <h3>流程图预览</h3>
                <p>{flowType === 'user' ? '纯用户角色泳道图' : '含 AI Agent 泳道图'}</p>
              </div>
              <div className="flow-tabs">
                <button className={flowType === 'user' ? 'active' : ''} onClick={() => setFlowType('user')}>纯用户角色</button>
                <button className={flowType === 'agent' ? 'active' : ''} onClick={() => setFlowType('agent')}>含AI Agent</button>
                <button onClick={() => setFlowOpen(false)}>关闭</button>
              </div>
            </div>
            <div className="flow-body">
              <div
                ref={flowViewportRef}
                className={`flow-viewport ${flowDragging ? 'dragging' : ''}`}
                onWheel={(e) => {
                  e.preventDefault();
                  const viewport = flowViewportRef.current;
                  if (!viewport) return;
                  const rect = viewport.getBoundingClientRect();
                  const mouseX = e.clientX - rect.left;
                  const mouseY = e.clientY - rect.top;
                  const nextScale = clampFlowScale(flowScale * (e.deltaY > 0 ? 0.9 : 1.1));
                  if (nextScale === flowScale) return;
                  const contentX = (mouseX - flowOffset.x) / flowScale;
                  const contentY = (mouseY - flowOffset.y) / flowScale;
                  const nextOffsetX = mouseX - contentX * nextScale;
                  const nextOffsetY = mouseY - contentY * nextScale;
                  setFlowScale(nextScale);
                  setFlowOffset({ x: nextOffsetX, y: nextOffsetY });
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  flowDragRef.current = {
                    dragging: true,
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: flowOffset.x,
                    originY: flowOffset.y
                  };
                  setFlowDragging(true);
                }}
                onMouseMove={(e) => {
                  if (!flowDragRef.current.dragging) return;
                  const dx = e.clientX - flowDragRef.current.startX;
                  const dy = e.clientY - flowDragRef.current.startY;
                  setFlowOffset({
                    x: flowDragRef.current.originX + dx,
                    y: flowDragRef.current.originY + dy
                  });
                }}
                onMouseUp={() => {
                  flowDragRef.current.dragging = false;
                  setFlowDragging(false);
                }}
                onMouseLeave={() => {
                  flowDragRef.current.dragging = false;
                  setFlowDragging(false);
                }}
              >
                <div
                  className="flow-pan-layer"
                  style={{ transform: `translate(${flowOffset.x}px, ${flowOffset.y}px) scale(${flowScale})` }}
                >
                  <img
                    src={flowType === 'user' ? '/flowcharts/user-role-swimlane-2026-03-04-042435.svg' : '/flowcharts/agent-swimlane.svg'}
                    alt={flowType === 'user' ? '纯用户角色泳道图' : '含AI Agent泳道图'}
                    draggable={false}
                  />
                </div>
              </div>
              <div className="flow-zoom-tools">
                <button onClick={() => updateFlowScale(flowScale - 0.1)}>-</button>
                <span>{Math.round(flowScale * 100)}%</span>
                <button onClick={() => updateFlowScale(flowScale + 0.1)}>+</button>
                <button onClick={resetFlowView}>重置</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {actionDialog && (
        <div className="overlay" onClick={() => setActionDialog(null)}>
          <div className="dialog small" onClick={(e) => e.stopPropagation()}>
            <h3>{actionDialog.title}</h3>
            <p>{actionDialog.desc}</p>
            <button
              className="major full"
              onClick={() => {
                const target = actionDialog.target;
                setActionDialog(null);
                if (target) openNode(target);
              }}
            >
              确定
            </button>
          </div>
        </div>
      )}

      {noteOpen && (
        <div className="overlay" onClick={() => setNoteOpen(false)}>
          <div className="dialog note-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>节点备注</h3>
            <p className="note-subtitle">{noteLabel(noteKey)}</p>
            <textarea
              className="note-textarea"
              value={noteDraft}
              maxLength={500}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="请输入备注，例如：交互问题、字段约束、后端接口要求、验收备注..."
            />
            <div className="note-count">{noteDraft.length}/500</div>
            <div className="note-actions">
              <button className="ghost" onClick={() => setNoteOpen(false)}>取消</button>
              <button className="ghost" onClick={() => setNoteDraft('')}>清空</button>
              <button
                className="major"
                onClick={() => {
                  const text = noteDraft.trim();
                  const nextMap = { ...noteMap };
                  if (text) nextMap[noteKey] = text;
                  else delete nextMap[noteKey];
                  setNoteMap(nextMap);
                  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(nextMap));
                  setNoteOpen(false);
                  setActionDialog({
                    title: '备注已保存',
                    desc: text ? `已保存到 ${noteLabel(noteKey)}` : `已清空 ${noteLabel(noteKey)} 的备注`
                  });
                }}
              >
                保存备注
              </button>
            </div>
          </div>
        </div>
      )}

      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
