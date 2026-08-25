/* ═══════════════════════════════════════════════════════════════
 *  face-i18n.js  –  Internationalization Module
 *  Supports: zh-CN (default), en-US
 *  Usage:  FaceI18n.t('key')  /  FaceI18n.setLocale('en-US')
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var _locale = 'zh-CN';
  var _listeners = [];

  // Restore persisted locale
  try {
    var stored = (typeof localStorage !== 'undefined') && localStorage.getItem('faceexpr_locale');
    if (stored && (stored === 'zh-CN' || stored === 'en-US')) _locale = stored;
  } catch (e) { void e; }

  /* ═══ Translation Dictionaries ═══ */
  var DICT = {
    'zh-CN': {
      /* ── Page / Titles ── */
      pageTitle:           'FaceVFX v3.11 — 可观察面部动作分析',
      cameraTitle:         '面部深度扫描 (78 Key Landmarks)',
      exprTitle:           '最强 AU 激活与置信区间',
      authTitle:           '贝叶斯时序 AU 状态',
      auTitle:             'FACS 动作单元拓扑',
      psyTitle:            '可观察动作摘要 (12D)',
      transTitle:          '逐帧质量标记',
      analysisTitle:       '质量、AU 区间与来源',
      microTitle:          '校准与模型状态',
      headPoseTitle:       '头部姿态阵列',

      /* ── Status ── */
      statusScanning:      '面部扫描中...',
      statusPaused:        '已暂停 (标签页不可见)',
      statusOnline:        '系统在线 — 深度分析中',
      statusQualityPaused: '当前帧质量不足，AU 输出已暂停',
      statusNoFace:        '未检测到面部',
      statusInit:          '系统神经网络初始化中...',
      statusNeedHTTPS:     '需要 HTTPS 或 localhost 环境',
      runtimeError:        '运行时错误，请刷新页面重试。',

      /* ── Camera Errors ── */
      cameraUnknown:       '未知摄像头错误',
      cameraNotAllowed:    '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问。',
      cameraNotFound:      '未检测到摄像头设备。',
      cameraNotReadable:   '摄像头被其他程序占用，请关闭后重试。',
      cameraError:         '摄像头错误: ',

      /* ── Authenticity ── */
      authDuchenne:        '关键点完整性',
      authTemporal:        '后验确定度',
      authSymmetry:        '姿态适用度',
      authDuration:        '状态持续时间',
      authConflict:        '光照质量',
      authLeakage:         '图像清晰度',
      calibrationLocked:   '个人基线已锁定',
      calibrationCollecting:'正在采集稳健个人基线',

      /* ── Expression Labels (29) ── */
      'expr.genuine_smile':    '真笑 (Duchenne)',
      'expr.social_smile':     '社交微笑',
      'expr.suppressed_smile': '抑制微笑',
      'expr.surprise':         '惊讶',
      'expr.fear':             '恐惧',
      'expr.anger':            '愤怒',
      'expr.disgust':          '厌恶',
      'expr.contempt':         '蔑视',
      'expr.sadness':          '悲伤',
      'expr.anxiety':          '焦虑',
      'expr.tension':          '紧张',
      'expr.concentration':    '专注',
      'expr.confusion':        '困惑',
      'expr.disdain':          '不屑',
      'expr.embarrassment':    '尴尬',
      'expr.pain':             '痛苦',
      'expr.fatigue':          '疲倦',
      'expr.boredom':          '厌烦',
      'expr.interest':         '兴趣/好奇',
      'expr.pleasure':         '愉悦',
      'expr.suppression':      '情绪抑制',
      'expr.au12_au14_asymmetry_pattern': 'AU12/AU14 不对称模式',
      'expr.masked_sadness':   '掩饰悲伤',
      'expr.nervous_smile':    '紧张微笑',
      'expr.irritation':         '烦躁',
      'expr.melancholy':         '忧郁',
      'expr.unease':             '不安',
      'expr.distaste':           '反感',
      'expr.neutral':          '中性',

      /* ── Psychology Labels (12) ── */
      'psy.valence':             '情绪效价',
      'psy.arousal':             '唤醒度',
      'psy.cognitiveLoad':       '认知负荷',
      'psy.stress':              '压力指数',
      'psy.confidence':          '自信度',
      'psy.engagement':          '专注度',
      'psy.comfort':             '舒适度',
      'psy.authenticity':        '表情一致度',
      'psy.tension':             '紧张度',
      'psy.patternAnomaly':      '模式异常',
      'psy.suppressionEffort':   '抑制努力',
      'psy.emotionalRegulation': '情绪调节力',

      /* ── Observable movement labels (v3.11) ── */
      'obs.browRaise':            '眉部上提',
      'obs.browLower':            '眉部下压',
      'obs.eyeOpening':           '眼睑张开',
      'obs.eyeClosure':           '眼睑闭合',
      'obs.cheekRaise':           '面颊上提',
      'obs.noseWrinkle':          '鼻部皱缩',
      'obs.lipCornerPull':        '嘴角上提',
      'obs.lipCornerDepress':     '嘴角下压',
      'obs.mouthOpening':         '口部张开',
      'obs.lipCompression':       '唇部压紧',
      'obs.bilateralAsymmetry':   '双侧不对称度',
      'obs.motionEnergy':         '动作变化量',

      /* ── UI Strings ── */
      blink:               '眨眼',
      leakage:             '泄露',
      /* ── Punctuation (locale-aware) ── */
      'p.lp': '（', 'p.rp': '）', 'p.comma': '，', 'p.semi': '；',

      /* ── Analysis Text Strings ── */
      'analysis.currentExpr':     '【当前表情】',
      'analysis.confidence':      '置信度',
      'analysis.authenticity':    '表情一致性',
      'analysis.authReal':        '高',
      'analysis.authSuspect':     '中',
      'analysis.authFake':        '低',
      'analysis.authWarning':     '⚠ 低一致性提示: ',
      'analysis.noDuchenne':      '缺少杜兴标记(眼轮匝肌不参与)',
      'analysis.temporalAnomaly': '时序特征异常',
      'analysis.asymmetry':       '面部不对称',
      'analysis.muscleConflict':  '检测到肌肉冲突',
      'analysis.leakageDetected': '检测到短时冲突模式',
      'analysis.dissonance':      '【模式冲突】',
      'analysis.dissonanceHigh':  '显著',
      'analysis.dissonanceMild':  '轻度',
      'analysis.transition':      '【表情转换】',
      'analysis.psyState':        '【实验性状态指标】',
      'analysis.negativeValence':  '情绪偏负面',
      'analysis.positiveValence':  '情绪积极',
      'analysis.highArousal':     '情绪唤醒度较高',
      'analysis.highCogLoad':     '认知负荷代理指标较高',
      'analysis.stressSign':      '压力代理指标较高',
      'analysis.facialTension':   '面部肌肉紧张',
      'analysis.deceptionSignal': '异常模式分数较高',
      'analysis.suppressing':     '抑制模式分数较高',
      'analysis.lowComfort':      '舒适度代理指标较低',
      'analysis.suppression':     '【抑制模式指标】',
      'analysis.suppressStrong':  '强烈',
      'analysis.suppressMid':     '中度',
      'analysis.suppressWord':    '抑制',
      'analysis.lipTight':        '嘴唇紧抿',
      'analysis.browSmile':       '皱眉同时微笑',
      'analysis.antagonist':      '对抗性肌肉活动',
      'analysis.regulation':      '【调节模式】',
      'analysis.inertia':         '【情绪惯性】',
      'analysis.inertiaLow':      '低 — 情绪变化频繁，可能处于不稳定状态',
      'analysis.inertiaHigh':     '高 — 情绪状态稳定持久',
      'analysis.baselineDeviation': '【基线偏离】',
      'analysis.microExpr':       '【微表情】',
      'analysis.headPose':        '【头部姿态】',
      'analysis.headLeft':        '头偏左',
      'analysis.headRight':       '头偏右',
      'analysis.headDown':        '低头',
      'analysis.headUp':          '抬头',
      'analysis.headTilt':        '头部倾斜',
      'analysis.blinkAnalysis':   '【眨眼分析】',
      'analysis.blinkPerMin':     '次/分',
      'analysis.blinkVeryHigh':   '异常偏高 — 强烈压力/焦虑信号',
      'analysis.blinkHigh':       '偏高 — 可能存在压力或认知负荷',
      'analysis.blinkSlightHigh': '略高 — 轻度唤醒',
      'analysis.blinkNormal':     '正常范围',
      'analysis.blinkLow':        '偏低 — 高度专注或抑制状态',
      'analysis.perclosExceed':   '⚠ 超过困倦阈值',
      'analysis.perclosNear':     '接近阈值',
      'analysis.perclosRef':      '(Dinges 1998: >15%=困倦)',
      'analysis.blinkCluster':    '检测到眨眼聚簇',
      'analysis.blinkClusterNote':'组) — 间歇性认知负荷波动',
      'analysis.ibiHigh':         '眨眼间隔变异系数高',
      'analysis.ibiNote':         ' — 情绪波动或注意力不稳定',
      'analysis.smileBrowFurrow': '微笑时眉头紧锁',
      'analysis.smileLipPress':   '微笑时嘴唇紧闭',
      'analysis.calmButTense':    '表面平静但面部肌肉紧张',
      'analysis.negativeSmileLeak':  '负面表情中检测到笑容AU泄漏，情绪表达可能并不真实',
      'analysis.sadnessWithCheekRaise': '悲伤伴随颔骨提升(AU6)，可能为刻意布置的悲伤表情',
      'analysis.fearWithControl':    '恐惧伴随下巴抬升+唇紧压，显示主动控制，可能非真实恐惧',
      'analysis.smileAsymmetric': '笑容不对称',
      'analysis.antagonistMuscle':'拮抗肌群同时激活',

      /* ── Transition Significance ── */
      'trans.genuineToNeutralSmooth': '自然的情绪回落，表明情绪体验真实',
      'trans.socialToNeutralAbrupt':  '社交面具突然卸下，可能的疲倦或不耐烦',
      'trans.neutralToSmileAbrupt':   '快速切换至笑容，可能是刻意表演',
      'trans.genuineToContempt':      '真笑转蔑视：优越感显露，暗示态度转变',
      'trans.socialToContempt':       '伪装友好后露出轻蔑，真实情绪泄露',
      'trans.angerToSocial':          '愤怒后强装微笑，情绪调节/社会掩饰',
      'trans.sadnessToGenuine':       '悲伤转真笑：情绪恢复或释然',
      'trans.sadnessToSocial':        '悲伤后社交微笑：试图掩饰内心痛苦',
      'trans.suppressionToSmile':     '抑制后微笑：压力释放或防御机制',
      'trans.fearToSocial':           '恐惧转社交笑：典型的恐惧掩饰行为',
      'trans.toSuppression':          '进入情绪抑制状态：主动控制情绪表达',
      'trans.concToSurprise':         '专注中被打断：注意力突然转移',
      'trans.neutralToAnxiety':       '从平静进入焦虑：可能感知到威胁或压力',
      'trans.neutralToAnger':         '平静转为愤怒：突发性情绪触发，可能的挫折激发',
      'trans.neutralToSadness':       '平静转为悲伤：可能回想起伤痛记忆或感受到失落',
      'trans.neutralToDisgust':       '平静转为双恶：对某事物产生本能反感',
      'trans.fearToAnger':            '恐惧转为愤怒：战或逃反应中的“战斗”激活',
      'trans.sadnessToAnger':         '悲伤转为愤怒：哀伤引发愤怒，常见于悲伤的中期阶段',
      'trans.angerToSadness':         '愤怒转为悲伤：愤怒消退后的后悔或无力感',
      'trans.suppressedType':         '转换过程中检测到肌肉冲突，情绪表达受到抑制',
      'trans.abruptNonNeutral':       '情绪间快速跳转，可能存在情绪不稳定或刻意切换',

      /* ── Blink Interpret Notes ── */
      'blink.drowsy':     'PERCLOS={0}%，眼睛长时间闭合，可能困倦或疲劳',
      'blink.elevated':   '眨眼频率偏高(>{0}/min)，可能有压力或焦虑',
      'blink.reduced':    '眨眼频率偏低(<{0}/min)，可能正在专注或疲劳',
      'blink.irregular':  '眨眼节律不规则(CV={0})，可能认知负荷波动',

      /* ── Regulation Styles ── */
      'reg.undetermined':  '未确定',
      'reg.suppressive':   '压抑型 (Response-focused)',
      'reg.adaptive':      '适应型 (Adaptive)',
      'reg.masking':       '伪装型 (Masking)',
      'reg.expressive':    '自然表达型 (Expressive)',
      'reg.mixed':         '混合型 (Mixed)',

      /* ── Toolbar / Export / History ── */
      langLabel:           '语言',
      exportJSON:          '导出 JSON',
      exportCSV:           '导出 CSV',
      exportTitle:         '数据导出',
      historyTitle:        '历史记录',
      historyOpen:         '历史',
      historyProfile:      '档案',
      historyClear:        '清除记录',
      historyClearAll:     '清除全部',
      historyNoData:       '暂无历史记录',
      historySession:      '会话',
      historyDuration:     '时长',
      historyFrames:       '帧数',
      historyAvg:          '平均',
      historyTrend:        '趋势',
      historyTrendUp:      '↑上升',
      historyTrendDown:    '↓下降',
      historyTrendStable:  '→稳定',
      historyNewProfile:   '新建档案',
      historyDefaultName:  '默认用户',
      historyDeleteProfile:'删除档案',
      historyConfirmDelete:'确定删除此档案及所有记录吗？',
      historyConfirmClear: '确定清除所有历史记录吗？',
      historyExport:       '导出历史',
      historySaving:       '保存中...',
      historySaved:        '已保存',
      historyStart:        '开始记录',
      historyStop:         '停止记录',
      historyRecording:    '● 记录中',
      historyUnavailable:  '当前环境不支持历史记录',
      installApp:          '⬇ 安装应用',
    },

    'en-US': {
      /* ── Page / Titles ── */
      pageTitle:           'FaceVFX v3.11 — Observable Facial Movement Analysis',
      cameraTitle:         'Face Deep Scan (78 Key Landmarks)',
      exprTitle:           'Strongest AU Activations & Intervals',
      authTitle:           'Bayesian Temporal AU State',
      auTitle:             'FACS Action Unit Topology',
      psyTitle:            'Observable Movement Summary (12D)',
      transTitle:          'Frame Quality Flags',
      analysisTitle:       'Quality, AU Intervals & Provenance',
      microTitle:          'Calibration & Model Status',
      headPoseTitle:       'Head Pose Array',

      /* ── Status ── */
      statusScanning:      'Scanning face...',
      statusPaused:        'Paused (tab hidden)',
      statusOnline:        'System online — deep analysis',
      statusQualityPaused: 'Frame quality insufficient; AU output paused',
      statusNoFace:        'No face detected',
      statusInit:          'Neural network initializing...',
      statusNeedHTTPS:     'HTTPS or localhost required',
      runtimeError:        'Runtime error, please refresh.',

      /* ── Camera Errors ── */
      cameraUnknown:       'Unknown camera error',
      cameraNotAllowed:    'Camera access denied. Please allow in browser settings.',
      cameraNotFound:      'No camera device found.',
      cameraNotReadable:   'Camera occupied by another app. Close it and retry.',
      cameraError:         'Camera error: ',

      /* ── Authenticity ── */
      authDuchenne:        'Landmark Integrity',
      authTemporal:        'Posterior Certainty',
      authSymmetry:        'Pose Suitability',
      authDuration:        'State Duration',
      authConflict:        'Lighting Quality',
      authLeakage:         'Sharpness',
      calibrationLocked:   'Personal baseline locked',
      calibrationCollecting:'Collecting robust personal baseline',

      /* ── Expression Labels (29) ── */
      'expr.genuine_smile':    'Genuine Smile (Duchenne)',
      'expr.social_smile':     'Social Smile',
      'expr.suppressed_smile': 'Suppressed Smile',
      'expr.surprise':         'Surprise',
      'expr.fear':             'Fear',
      'expr.anger':            'Anger',
      'expr.disgust':          'Disgust',
      'expr.contempt':         'Contempt',
      'expr.sadness':          'Sadness',
      'expr.anxiety':          'Anxiety',
      'expr.tension':          'Tension',
      'expr.concentration':    'Concentration',
      'expr.confusion':        'Confusion',
      'expr.disdain':          'Disdain',
      'expr.embarrassment':    'Embarrassment',
      'expr.pain':             'Pain',
      'expr.fatigue':          'Fatigue',
      'expr.boredom':          'Boredom',
      'expr.interest':         'Interest / Curiosity',
      'expr.pleasure':         'Pleasure',
      'expr.suppression':      'Emotion Suppression',
      'expr.au12_au14_asymmetry_pattern': 'AU12/AU14 Asymmetry Pattern',
      'expr.masked_sadness':   'Masked Sadness',
      'expr.nervous_smile':    'Nervous Smile',
      'expr.irritation':         'Irritation',
      'expr.melancholy':         'Melancholy',
      'expr.unease':             'Unease',
      'expr.distaste':           'Distaste',
      'expr.neutral':          'Neutral',

      /* ── Psychology Labels (12) ── */
      'psy.valence':             'Valence',
      'psy.arousal':             'Arousal',
      'psy.cognitiveLoad':       'Cognitive Load',
      'psy.stress':              'Stress',
      'psy.confidence':          'Confidence',
      'psy.engagement':          'Engagement',
      'psy.comfort':             'Comfort',
      'psy.authenticity':        'Expression Consistency',
      'psy.tension':             'Tension',
      'psy.patternAnomaly':      'Pattern Anomaly',
      'psy.suppressionEffort':   'Suppression Effort',
      'psy.emotionalRegulation': 'Emotional Regulation',

      /* ── Observable movement labels (v3.11) ── */
      'obs.browRaise':            'Brow Raise',
      'obs.browLower':            'Brow Lower',
      'obs.eyeOpening':           'Eye Opening',
      'obs.eyeClosure':           'Eye Closure',
      'obs.cheekRaise':           'Cheek Raise',
      'obs.noseWrinkle':          'Nose Wrinkle',
      'obs.lipCornerPull':        'Lip Corner Pull',
      'obs.lipCornerDepress':     'Lip Corner Depress',
      'obs.mouthOpening':         'Mouth Opening',
      'obs.lipCompression':       'Lip Compression',
      'obs.bilateralAsymmetry':   'Bilateral Asymmetry',
      'obs.motionEnergy':         'Motion Energy',

      /* ── UI Strings ── */
      blink:               'Blink',
      leakage:             'Leak',
      /* ── Punctuation (locale-aware) ── */
      'p.lp': '(', 'p.rp': ')', 'p.comma': ', ', 'p.semi': '; ',

      /* ── Analysis Text Strings ── */
      'analysis.currentExpr':     '[Expression] ',
      'analysis.confidence':      'confidence',
      'analysis.authenticity':    'expression consistency',
      'analysis.authReal':        'high',
      'analysis.authSuspect':     'medium',
      'analysis.authFake':        'low',
      'analysis.authWarning':     '⚠ Low-consistency note: ',
      'analysis.noDuchenne':      'no Duchenne marker (orbicularis oculi inactive)',
      'analysis.temporalAnomaly': 'temporal anomaly',
      'analysis.asymmetry':       'facial asymmetry',
      'analysis.muscleConflict':  'muscle conflict detected',
      'analysis.leakageDetected': 'brief conflicting pattern detected',
      'analysis.dissonance':      '[Pattern Conflict] ',
      'analysis.dissonanceHigh':  'Significant',
      'analysis.dissonanceMild':  'Mild',
      'analysis.transition':      '[Expression Transition] ',
      'analysis.psyState':        '[Experimental State Indicators] ',
      'analysis.negativeValence':  'negative valence',
      'analysis.positiveValence':  'positive valence',
      'analysis.highArousal':     'high arousal',
      'analysis.highCogLoad':     'elevated cognitive-load proxy',
      'analysis.stressSign':      'elevated stress proxy',
      'analysis.facialTension':   'facial muscle tension',
      'analysis.deceptionSignal': 'elevated anomaly-pattern score',
      'analysis.suppressing':     'elevated suppression-pattern score',
      'analysis.lowComfort':      'low comfort proxy',
      'analysis.suppression':     '[Suppression-pattern indicator] ',
      'analysis.suppressStrong':  'Strong',
      'analysis.suppressMid':     'Moderate',
      'analysis.suppressWord':    'suppression',
      'analysis.lipTight':        'lips tightly pressed',
      'analysis.browSmile':       'frowning while smiling',
      'analysis.antagonist':      'antagonist muscle activity',
      'analysis.regulation':      '[Regulation Mode] ',
      'analysis.inertia':         '[Emotional Inertia] ',
      'analysis.inertiaLow':      'Low — frequent emotional shifts, possibly unstable',
      'analysis.inertiaHigh':     'High — stable emotional state',
      'analysis.baselineDeviation': '[Baseline Deviation] ',
      'analysis.microExpr':       '[Micro-expression] ',
      'analysis.headPose':        '[Head Pose] ',
      'analysis.headLeft':        'head left',
      'analysis.headRight':       'head right',
      'analysis.headDown':        'head down',
      'analysis.headUp':          'head up',
      'analysis.headTilt':        'head tilt',
      'analysis.blinkAnalysis':   '[Blink Analysis] ',
      'analysis.blinkPerMin':     '/min',
      'analysis.blinkVeryHigh':   'abnormally high — severe stress/anxiety',
      'analysis.blinkHigh':       'elevated — possible stress or cognitive load',
      'analysis.blinkSlightHigh': 'slightly high — mild arousal',
      'analysis.blinkNormal':     'normal range',
      'analysis.blinkLow':        'low — intense focus or suppression',
      'analysis.perclosExceed':   '⚠ exceeds drowsiness threshold',
      'analysis.perclosNear':     'approaching threshold',
      'analysis.perclosRef':      '(Dinges 1998: >15%=drowsy)',
      'analysis.blinkCluster':    'blink clustering detected',
      'analysis.blinkClusterNote':'groups) — intermittent cognitive load fluctuation',
      'analysis.ibiHigh':         'high IBI coefficient of variation',
      'analysis.ibiNote':         ' — emotional fluctuation or attention instability',
      'analysis.smileBrowFurrow': 'brow furrowed while smiling',
      'analysis.smileLipPress':   'lips pressed while smiling',
      'analysis.calmButTense':    'calm surface but facial muscles tense',
      'analysis.negativeSmileLeak':  'smile AU leak during negative expression — possibly not genuine',
      'analysis.sadnessWithCheekRaise': 'sadness with cheek raise (AU6) — possibly posed sadness',
      'analysis.fearWithControl':    'fear with chin raise + lip press — deliberate control, possibly not genuine fear',
      'analysis.smileAsymmetric': 'asymmetric smile',
      'analysis.antagonistMuscle':'antagonist muscles co-activated',

      /* ── Transition Significance ── */
      'trans.genuineToNeutralSmooth': 'Natural emotional decline, indicating genuine emotional experience',
      'trans.socialToNeutralAbrupt':  'Social mask abruptly dropped — possible fatigue or impatience',
      'trans.neutralToSmileAbrupt':   'Quick switch to smile — possibly deliberate performance',
      'trans.genuineToContempt':      'Genuine smile → contempt: superiority emerging, attitude shift',
      'trans.socialToContempt':       'Feigned friendliness → contempt: true emotion leaking',
      'trans.angerToSocial':          'Forced smile after anger — emotion regulation / social masking',
      'trans.sadnessToGenuine':       'Sadness → genuine smile: emotional recovery or relief',
      'trans.sadnessToSocial':        'Social smile after sadness: attempting to conceal inner pain',
      'trans.suppressionToSmile':     'Smile after suppression: stress release or defense mechanism',
      'trans.fearToSocial':           'Fear → social smile: typical fear-masking behavior',
      'trans.toSuppression':          'Entering suppression: actively controlling emotional expression',
      'trans.concToSurprise':         'Concentration interrupted: sudden attention shift',
      'trans.neutralToAnxiety':       'Calm → anxiety: perceived threat or pressure',
      'trans.neutralToAnger':           'Calm → anger: sudden frustration trigger',
      'trans.neutralToSadness':         'Calm → sadness: painful memory recall or sense of loss',
      'trans.neutralToDisgust':         'Calm → disgust: instinctive aversion response',
      'trans.fearToAnger':              'Fear → anger: fight-or-flight "fight" activation',
      'trans.sadnessToAnger':           'Sadness → anger: grief triggering rage (mid-stage grief)',
      'trans.angerToSadness':           'Anger → sadness: post-anger regret or helplessness',
      'trans.suppressedType':         'Muscle conflict during transition — expression suppressed',
      'trans.abruptNonNeutral':       'Rapid emotion shift — possible instability or deliberate switch',

      /* ── Blink Interpret Notes ── */
      'blink.drowsy':     'PERCLOS={0}% — prolonged eye closure, possible drowsiness or fatigue',
      'blink.elevated':   'Blink rate elevated (>{0}/min) — possible stress or anxiety',
      'blink.reduced':    'Blink rate reduced (<{0}/min) — possible deep focus or fatigue',
      'blink.irregular':  'Irregular blink rhythm (CV={0}) — cognitive load fluctuation',

      /* ── Regulation Styles ── */
      'reg.undetermined':  'Undetermined',
      'reg.suppressive':   'Suppressive (Response-focused)',
      'reg.adaptive':      'Adaptive',
      'reg.masking':       'Masking',
      'reg.expressive':    'Expressive',
      'reg.mixed':         'Mixed',

      /* ── Toolbar / Export / History ── */
      langLabel:           'Lang',
      exportJSON:          'Export JSON',
      exportCSV:           'Export CSV',
      exportTitle:         'Data Export',
      historyTitle:        'History',
      historyOpen:         'History',
      historyProfile:      'Profile',
      historyClear:        'Clear Records',
      historyClearAll:     'Clear All',
      historyNoData:       'No history data',
      historySession:      'Session',
      historyDuration:     'Duration',
      historyFrames:       'Frames',
      historyAvg:          'Avg',
      historyTrend:        'Trend',
      historyTrendUp:      '↑ rising',
      historyTrendDown:    '↓ falling',
      historyTrendStable:  '→ stable',
      historyNewProfile:   'New Profile',
      historyDefaultName:  'Default User',
      historyDeleteProfile:'Delete Profile',
      historyConfirmDelete:'Delete this profile and all records?',
      historyConfirmClear: 'Clear all history records?',
      historyExport:       'Export History',
      historySaving:       'Saving...',
      historySaved:        'Saved',
      historyStart:        'Start Recording',
      historyStop:         'Stop Recording',
      historyRecording:    '● Recording',
      historyUnavailable:  'History unavailable in this environment',
      installApp:          '⬇ Install',
    },
  };

  /* ═══ Translate Function ═══ */
  function t(key) {
    var dict = DICT[_locale] || DICT['zh-CN'];
    if (dict[key] !== undefined) return dict[key];
    // Fallback to zh-CN
    if (DICT['zh-CN'][key] !== undefined) return DICT['zh-CN'][key];
    return key;
  }

  /* ═══ Expression label helper (maps expression name → localized label) ═══ */
  function exprLabel(exprName) {
    return t('expr.' + exprName) || exprName;
  }

  /* ═══ Psychology label helper ═══ */
  function psyLabel(psyKey) {
    return t('psy.' + psyKey) || psyKey;
  }

  function observableLabel(key) {
    return t('obs.' + key) || key;
  }

  /* ═══ Get / Set Locale ═══ */
  function getLocale() { return _locale; }

  function setLocale(locale) {
    if (!DICT[locale]) return;
    _locale = locale;
    // Persist choice
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('faceexpr_locale', locale); } catch (e) { void e; }
    for (var i = 0; i < _listeners.length; i++) {
      _listeners[i](locale);
    }
  }

  function getAvailableLocales() {
    return Object.keys(DICT);
  }

  /* ═══ Locale Change Listener ═══ */
  function onLocaleChange(fn) {
    _listeners.push(fn);
  }

  function removeLocaleListener(fn) {
    _listeners = _listeners.filter(function (f) { return f !== fn; });
  }

  global.FaceI18n = Object.freeze({
    t:                   t,
    exprLabel:           exprLabel,
    psyLabel:            psyLabel,
    observableLabel:     observableLabel,
    getLocale:           getLocale,
    setLocale:           setLocale,
    getAvailableLocales: getAvailableLocales,
    onLocaleChange:      onLocaleChange,
    removeLocaleListener:removeLocaleListener,
  });
})(typeof window !== 'undefined' ? window : globalThis);
