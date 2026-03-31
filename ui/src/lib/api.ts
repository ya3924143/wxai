import type {
  Account,
  WechatUser,
  ManagedUser,
  Plugin,
  QrStatus,
  HealthData,
  ApiResponse,
} from "./types";

class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (response.status === 401) {
    window.location.href = "/";
    throw new ApiError(401, "未登录，请重新认证");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { error?: string }).error ?? "请求失败",
    );
  }

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiError(response.status, body.error ?? "请求失败");
  }

  return body.data as T;
}

// ── Auth ──

export async function login(password: string): Promise<void> {
  const response = await fetch("/api/web/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { error?: string }).error ?? "密码错误",
    );
  }
}

// ── Accounts ──

export async function getAccounts(): Promise<Account[]> {
  return request<Account[]>("/api/accounts");
}

export async function deleteAccount(token: string): Promise<void> {
  await request<void>(`/api/accounts/${encodeURIComponent(token)}`, {
    method: "DELETE",
  });
}

// ── Users ──

export async function getWechatUsers(): Promise<WechatUser[]> {
  return request<WechatUser[]>("/api/users");
}

export async function getManagedUsers(): Promise<ManagedUser[]> {
  return request<ManagedUser[]>("/api/manage/users");
}

export async function addManagedUser(
  userId: string,
  name: string,
  chat = true,
): Promise<ManagedUser> {
  return request<ManagedUser>("/api/manage/users", {
    method: "POST",
    body: JSON.stringify({ userId, name, chat }),
  });
}

export async function deleteManagedUser(userId: string): Promise<void> {
  await request<void>(`/api/manage/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function setUserPermission(
  userId: string,
  chat: boolean,
): Promise<void> {
  await request<void>(
    `/api/manage/users/${encodeURIComponent(userId)}/permissions`,
    {
      method: "PUT",
      body: JSON.stringify({ chat }),
    },
  );
}

// ── Plugins ──

export async function getPlugins(): Promise<Plugin[]> {
  return request<Plugin[]>("/api/plugins");
}

// ── Messages ──

export async function sendMessage(
  userId: string,
  text: string,
  accountToken?: string,
): Promise<void> {
  await request<void>("/api/send", {
    method: "POST",
    body: JSON.stringify({ userId, text, accountToken }),
  });
}

// ── QR Login ──

export async function startQrLogin(): Promise<{
  qrcode: string;
  qrcodeImgContent: string;
}> {
  return request<{ qrcode: string; qrcodeImgContent: string }>(
    "/api/accounts/qr/start",
    { method: "POST" },
  );
}

export async function pollQrStatus(qrcode: string): Promise<QrStatus> {
  return request<QrStatus>(
    `/api/accounts/qr/status?qrcode=${encodeURIComponent(qrcode)}`,
  );
}

// ── Health ──

export async function getHealth(): Promise<HealthData> {
  return request<HealthData>("/api/health");
}
