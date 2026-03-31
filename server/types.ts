/**
 * wxai — 全局共享类型
 */

export interface WechatAccount {
  readonly token: string;
  readonly baseUrl: string;
  readonly accountId: string;
  readonly userId?: string;
  readonly label: string;
  readonly savedAt: string;
  readonly status: "online" | "offline" | "expired";
  readonly lastKeepAlive?: string;
  /** 若为 true，keepalive 服务跳过此账号 */
  readonly keepaliveExclude?: boolean;
}

export interface ContextTokenMap {
  readonly [userId: string]: string;
}

export interface WxaiConfig {
  readonly port: number;
  readonly host: string;
  readonly keepAliveIntervalMs: number;
  readonly keepAliveMaxFailures: number;
}

export interface SendRequest {
  readonly userId: string;
  readonly text: string;
  readonly accountToken?: string;
}

export interface SendResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface QrInfo {
  readonly qrcode: string;
  readonly qrcodeImgContent: string;
}

export interface QrStatus {
  readonly status: "wait" | "scaned" | "confirmed" | "expired";
  readonly token?: string;
  readonly accountId?: string;
  readonly userId?: string;
  readonly baseUrl?: string;
}

/**
 * 解析后的消息（内部流转用，替代原 WebhookMessage）
 */
export interface ParsedMessage {
  readonly messageId: string;
  readonly senderId: string;
  readonly chatId: string;
  readonly chatType: "p2p" | "group";
  readonly text: string;
  readonly messageType: "text" | "audio" | "image" | "file" | "video";
  readonly imageBase64?: string;
  readonly contextToken: string;
  readonly timestamp: number;
  /** 消息来自哪个 bot 账号 */
  readonly accountToken: string;
  readonly accountId: string;
}
