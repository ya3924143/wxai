export interface Account {
  token: string;
  accountId: string;
  label: string;
  userId?: string;
  status: "online" | "offline" | "expired";
  lastKeepAlive: string | null;
  savedAt: string;
}

export interface WechatUser {
  userId: string;
  hasContextToken: boolean;
  accountLabel: string;
}

export interface ManagedUser {
  userId: string;
  name: string;
  permissions: { chat: boolean };
  subscriptions: Record<string, boolean>;
  createdAt: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  schedule: { cron: string; label: string } | null;
}

export type QrStatusCode =
  | "pending"
  | "scanned"
  | "confirmed"
  | "success"
  | "expired"
  | "error";

export interface QrStatus {
  status: QrStatusCode;
  message?: string;
  account?: Account;
}

export interface HealthData {
  status: string;
  uptime: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SendHistory {
  id: string;
  userId: string;
  userLabel: string;
  text: string;
  sentAt: string;
  success: boolean;
  error?: string;
}
