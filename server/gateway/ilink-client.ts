/**
 * iLink Bot HTTP 客户端 — 纯函数，无状态
 */

import type { QrInfo, QrStatus } from "../types.js";

const ILINK_DEFAULT_BASE = "https://ilinkai.weixin.qq.com";
const CHANNEL_VERSION = "0.2.0";

function makeWechatUin(): string {
  const n = Math.floor(Math.random() * 0xffffffff);
  return Buffer.from(String(n >>> 0), "utf-8").toString("base64");
}

function makeClientId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wxai:${Date.now()}-${hex}`;
}

export async function ilinkPost(
  baseUrl: string,
  path: string,
  body: unknown,
  token: string,
  timeoutMs = 40_000,
): Promise<unknown> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      AuthorizationType: "ilink_bot_token",
      "X-WECHAT-UIN": makeWechatUin(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ilink ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── 扫码登录 ────────────────────────────────────────────────────────

export async function getQrCode(): Promise<QrInfo> {
  const res = await fetch(
    `${ILINK_DEFAULT_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`,
  );
  if (!res.ok) throw new Error(`获取二维码失败: ${res.status}`);

  const data = (await res.json()) as Record<string, unknown>;
  if (!data.qrcode) throw new Error(`二维码数据为空`);

  return {
    qrcode: data.qrcode as string,
    qrcodeImgContent: (data.qrcode_img_content as string) ?? "",
  };
}

export async function pollQrStatus(qrcode: string): Promise<QrStatus> {
  const encoded = encodeURIComponent(qrcode);
  const res = await fetch(
    `${ILINK_DEFAULT_BASE}/ilink/bot/get_qrcode_status?qrcode=${encoded}`,
    {
      headers: {
        "iLink-App-ClientVersion": "1",
        "X-WECHAT-UIN": makeWechatUin(),
      },
      signal: AbortSignal.timeout(40_000),
    },
  );

  if (!res.ok) throw new Error(`轮询状态失败: ${res.status}`);

  const data = (await res.json()) as Record<string, unknown>;
  return {
    status: (data.status as QrStatus["status"]) ?? "wait",
    token: data.bot_token as string | undefined,
    accountId: data.ilink_bot_id as string | undefined,
    userId: data.ilink_user_id as string | undefined,
    baseUrl: data.baseurl as string | undefined,
  };
}

// ── 消息收发 ────────────────────────────────────────────────────────

export interface GetUpdatesResult {
  readonly msgs: readonly ILinkMessage[];
  readonly syncBuf: string;
}

export interface ILinkMessageItem {
  readonly type: number;
  readonly text_item?: { readonly text?: string };
  readonly voice_item?: {
    readonly text?: string;
    readonly aes_key?: string;
    readonly cdn_url?: string;
  };
  readonly image_item?: {
    readonly aes_key?: string;
    readonly cdn_url?: string;
    readonly media_id?: string;
  };
}

export interface ILinkMessage {
  readonly from_user_id?: string;
  readonly to_user_id?: string;
  readonly client_id?: string;
  readonly group_id?: string;
  readonly message_type?: number;
  readonly message_state?: number;
  readonly context_token?: string;
  readonly create_time_ms?: number;
  readonly item_list?: readonly ILinkMessageItem[];
}

export async function getUpdates(
  baseUrl: string,
  token: string,
  syncBuf: string,
  timeoutMs = 40_000,
): Promise<GetUpdatesResult> {
  const data = (await ilinkPost(
    baseUrl,
    "/ilink/bot/getupdates",
    {
      get_updates_buf: syncBuf,
      base_info: { channel_version: CHANNEL_VERSION },
    },
    token,
    timeoutMs,
  )) as Record<string, unknown>;

  return {
    msgs: (data.msgs as ILinkMessage[]) ?? [],
    syncBuf: (data.get_updates_buf as string) ?? syncBuf,
  };
}

export async function sendWechatMessage(
  baseUrl: string,
  token: string,
  recipientId: string,
  text: string,
  contextToken: string,
): Promise<{ success: boolean; error?: string }> {
  const data = (await ilinkPost(
    baseUrl,
    "/ilink/bot/sendmessage",
    {
      msg: {
        from_user_id: "",
        to_user_id: recipientId,
        client_id: makeClientId(),
        message_type: 2,
        message_state: 2,
        item_list: [{ type: 1, text_item: { text } }],
        context_token: contextToken,
      },
      base_info: { channel_version: CHANNEL_VERSION },
    },
    token,
    15_000,
  )) as Record<string, unknown>;

  if (data.ret !== undefined && data.ret !== 0) {
    return { success: false, error: `iLink ret=${data.ret}` };
  }

  return { success: true };
}
