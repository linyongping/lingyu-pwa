// data.jsx — 示例文本、演示用 AI 返回数据与工具函数
const LY_SAMPLES = [
  {
    id: "s1",
    lang: "zh",
    text: "我们把上线时间定在下周五，如果风险太高，可以先灰度一部分用户，随时都能回滚。另外这次改动的负责人是陈晓，有问题直接找他。",
    mocks: {
      translate: {
        result: "We're targeting next Friday for the launch. If the risk looks too high, we can canary it to a subset of users first — and roll back at any time. Chen Xiao owns this change; reach out to him directly if anything comes up.",
        changes: null,
      },
    },
  },
  {
    id: "s2",
    lang: "en",
    text: "Me and my colleague was reviewing the deploy log this morning, and we finded several errors which could of been avoided if the config was checked more careful. The service have been restarted at 9am, everything looks normal now but we should monitors it closely.",
    mocks: {
      grammar: {
        result: "My colleague and I were reviewing the deploy log this morning, and we found several errors that could have been avoided if the config had been checked more carefully. The service was restarted at 9 am. Everything looks normal now, but we should monitor it closely.",
        changes: [
          { original: "Me and my colleague was", revised: "My colleague and I were", reason: "英语礼貌语序把对方放在前面；主语为复数，be 动词用 were。" },
          { original: "finded", revised: "found", reason: "find 的过去式是不规则变化 found，不加 -ed。" },
          { original: "which could of been", revised: "that could have been", reason: "限定性从句用 that 更规范；“could of”是“could have”的口误拼写。" },
          { original: "was checked", revised: "had been checked", reason: "“避免”发生在“检查”之前，需要过去完成时表达先后关系。" },
          { original: "more careful", revised: "more carefully", reason: "修饰动词 checked 要用副词 carefully。" },
          { original: "The service have been restarted", revised: "The service was restarted", reason: "主语 service 是单数；给出具体时间点用一般过去时更自然。" },
          { original: "we should monitors", revised: "we should monitor", reason: "情态动词 should 后接动词原形。" },
        ],
      },
      translate: {
        result: "今天早上，我和同事在排查部署日志时发现了几个错误。如果当时更仔细地检查配置，这些错误本来是可以避免的。服务已在早上 9 点重启，目前一切正常，不过我们仍需密切监控。",
        changes: null,
      },
      polish: {
        result: "This morning, my colleague and I reviewed the deployment logs and identified several errors that could have been prevented through more careful configuration checks. The service has since been restarted (9:00 am) and is currently operating normally; however, we recommend continued close monitoring.",
        changes: [
          { original: "Me and my colleague was reviewing", revised: "my colleague and I reviewed", reason: "正式文体避免口语化开头，动词改为更精确的 reviewed。" },
          { original: "finded several errors", revised: "identified several errors", reason: "identified 在正式语境中更专业。" },
          { original: "everything looks normal now but", revised: "is currently operating normally; however,", reason: "以正式词汇与分号衔接，避免口语化的 everything / looks。" },
          { original: "we should monitors it closely", revised: "we recommend continued close monitoring", reason: "转为建议式表达，符合正式书面语。" },
        ],
      },
    },
  },
  {
    id: "s3",
    lang: "en",
    text: "So basically the new caching thing we shipped last week is working pretty well and latency is way better now, but there are still some edge cases where the cache doesn't get busted properly and users end up seeing stale data, which is kind of annoying. We should probably figure out a better invalidation strategy soon.",
    mocks: {
      polish: {
        result: "The caching layer we shipped last week is performing well, and latency has improved significantly. However, a few edge cases remain in which the cache is not properly invalidated, causing users to see stale content. We should prioritize a more robust invalidation strategy.",
        changes: [
          { original: "So basically the new caching thing", revised: "The caching layer", reason: "删除口语填充词，改用准确的技术术语。" },
          { original: "working pretty well and latency is way better", revised: "performing well, and latency has improved significantly", reason: "以正式表达替代程度副词 pretty / way。" },
          { original: "which is kind of annoying", revised: "（删除）", reason: "主观情绪表达不宜出现在正式汇报中。" },
          { original: "We should probably figure out", revised: "We should prioritize", reason: "将模糊的建议改为明确的行动导向表述。" },
        ],
      },
    },
  },
  {
    id: "s4",
    lang: "zh",
    text: "首先感谢各位参加今天的会议，由于时间关系，我们把重点放再三个问题上：第一是预算超支的问题，第二是人员的安排，第三是接来下一个季度的计划。请大家踊跃发表意见。",
    mocks: {
      grammar: {
        result: "首先感谢各位参加今天的会议。由于时间关系，我们把重点放在三个问题上：第一是预算超支，第二是人员安排，第三是接下来一个季度的计划。请大家踊跃发表意见。",
        changes: [
          { original: "放再", revised: "放在", reason: "“再”表示重复或继续；此处是介词“在”，用于指示位置。" },
          { original: "，由于", revised: "。由于", reason: "前后是两个完整句子，用句号断开层次更清晰。" },
          { original: "预算超支的问题", revised: "预算超支", reason: "与后文“人员安排”保持结构对仗，删去冗余的“的问题”。" },
          { original: "接来下", revised: "接下来", reason: "语序错误，正确词形为“接下来”。" },
        ],
      },
      polish: {
        result: "感谢各位拨冗出席今日会议。鉴于时间有限，本次会议将聚焦三项议题：预算超支、人员安排，以及下一季度的工作计划。欢迎各位畅所欲言。",
        changes: [
          { original: "参加今天的会议", revised: "拨冗出席今日会议", reason: "使用敬语，更符合正式书面礼仪。" },
          { original: "由于时间关系", revised: "鉴于时间有限", reason: "书面化表达。" },
          { original: "请大家踊跃发表意见", revised: "欢迎各位畅所欲言", reason: "更委婉得体的会议用语。" },
        ],
      },
    },
  },
];

// 「模拟切回 App」自动轮换的示例顺序
const LY_AUTO_SAMPLES = [LY_SAMPLES[0], LY_SAMPLES[1], LY_SAMPLES[2], LY_SAMPLES[3]];

const LY_STYLES = [
  { id: "formal", label: "正式" },
  { id: "academic", label: "学术" },
  { id: "concise", label: "简洁" },
  { id: "casual", label: "口语" },
  { id: "custom", label: "自定义" },
];

const LY_MODE_LABELS = { translate: "翻译", grammar: "语法检查", polish: "润色" };

// 超长文本演示用（>4000 字符）
const LY_LONG_TEXT = ("这段文字用于演示超过 4000 字符上限时的拒绝处理。系统应当提示缩短文本，而不是浪费额度强行处理。原型环境会直接返回错误状态并给出建议。").repeat(62);

function lyDetectLang(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (cjk + latin === 0) return "zh";
  return cjk / (cjk + latin) > 0.3 ? "zh" : "en";
}

function lyIsSkippable(text) {
  const t = (text || "").trim();
  return t.length < 2 || /^https?:\/\/\S+$/i.test(t);
}

// 生成演示结果：优先使用当前文本的预置数据；任意文本回退到同语言示例并标注「演示数据」
function lyMockFor(mode, text, directionPref) {
  const detected = lyDetectLang(text);
  const direction = directionPref === "auto" ? (detected === "zh" ? "zh2en" : "en2zh") : directionPref;
  const exact = LY_SAMPLES.find((s) => s.text === text);
  const curated = exact && exact.mocks[mode];
  if (curated) {
    return Object.assign({ detected: exact.lang, direction: mode === "translate" ? direction : null, demo: false }, curated);
  }
  const alt = LY_SAMPLES.find((s) => s.mocks[mode] && (mode === "translate" || s.lang === detected));
  const base = alt && alt.mocks[mode];
  return {
    result: base ? base.result : "（演示数据）原型环境未连接真实模型，正式版本将在此显示完整结果。",
    changes: base ? base.changes : null,
    detected,
    direction: mode === "translate" ? direction : null,
    demo: true,
  };
}

// 用「改动列表」在修正后文本上做高亮分段（演示数据保证 revised 可整串匹配）
function lyBuildDiffSegments(corrected, changes) {
  if (!changes || !changes.length) return [{ text: corrected, changeIdx: null }];
  const segs = [];
  let pos = 0;
  changes.forEach((c, i) => {
    const needle = (c.revised || "").trim();
    if (!needle || needle === "（删除）") return;
    const idx = corrected.indexOf(needle, pos);
    if (idx === -1) return;
    if (idx > pos) segs.push({ text: corrected.slice(pos, idx), changeIdx: null });
    segs.push({ text: corrected.slice(idx, idx + needle.length), changeIdx: i });
    pos = idx + needle.length;
  });
  if (pos < corrected.length) segs.push({ text: corrected.slice(pos), changeIdx: null });
  return segs.length ? segs : [{ text: corrected, changeIdx: null }];
}

function lyFormatTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getHours()) + ":" + p(d.getMinutes());
}

Object.assign(window, {
  LY_SAMPLES, LY_AUTO_SAMPLES, LY_STYLES, LY_MODE_LABELS, LY_LONG_TEXT,
  lyDetectLang, lyIsSkippable, lyMockFor, lyBuildDiffSegments, lyFormatTime,
});
