/**
 * 对话路由 — 根据消息内容选择模型等级和最大轮次
 */

import type { ModelTier } from "../ai/types.js";

export interface ChatRoute {
  readonly modelTier: ModelTier;
  readonly maxTurns: number;
}

/** 需要强模型的关键词 */
const POWERFUL_PATTERNS: readonly RegExp[] = [
  /分析|评估|对比|比较|优劣|利弊|趋势|预测|策略|建议|总结|归纳/,
  /为什么|怎么看|如何理解|深入|详细|系统性|原理|本质/,
  /搜索|搜一下|查一下|查查|最新|今天|最近|现在|实时|刚刚/,
  /帮我写|帮我做|帮我找|生成|撰写|起草|翻译/,
  /代码|编程|算法|架构|设计|debug|报错/,
];

/** 追问/要求更详细 → 最强配置 */
const FOLLOWUP_PATTERNS: readonly RegExp[] = [
  /详细说|展开讲|深入分析|再详细|说详细|具体说|多说|细说/,
  /不够详细|太简单|再深入|更详细|再展开|继续说/,
];

export function routeChat(text: string): ChatRoute {
  if (FOLLOWUP_PATTERNS.some((p) => p.test(text))) {
    return { modelTier: "powerful", maxTurns: 8 };
  }

  if (POWERFUL_PATTERNS.some((p) => p.test(text))) {
    return { modelTier: "powerful", maxTurns: 5 };
  }

  return { modelTier: "balanced", maxTurns: 3 };
}
