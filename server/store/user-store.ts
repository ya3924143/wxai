/**
 * 用户权限和订阅管理
 */

import { USERS_PATH } from "../config.js";
import { readJsonFile, writeJsonFile } from "./json-file.js";

export interface UserConfig {
  readonly userId: string;
  readonly name: string;
  readonly permissions: {
    readonly chat: boolean;
  };
  readonly subscriptions: Record<string, boolean>;
  readonly createdAt: string;
}

type UsersData = Record<string, UserConfig>;

function readUsers(): UsersData {
  return readJsonFile<UsersData>(USERS_PATH, {});
}

function writeUsers(data: UsersData): void {
  writeJsonFile(USERS_PATH, data);
}

export function findUser(userId: string): UserConfig | undefined {
  return readUsers()[userId];
}

export function canChat(userId: string): boolean {
  const users = readUsers();
  const user = users[userId];

  // 如果没有任何用户配置，默认允许所有人（开放模式）
  if (Object.keys(users).length === 0) return true;

  return user?.permissions.chat ?? false;
}

export function addUser(
  userId: string,
  name: string,
  chat = true,
): UserConfig {
  const users = readUsers();
  const user: UserConfig = {
    userId,
    name,
    permissions: { chat },
    subscriptions: {},
    createdAt: new Date().toISOString(),
  };
  writeUsers({ ...users, [userId]: user });
  return user;
}

export function removeUser(userId: string): void {
  const users = readUsers();
  const { [userId]: _, ...rest } = users;
  writeUsers(rest);
}

export function setPermission(userId: string, chat: boolean): void {
  const users = readUsers();
  const user = users[userId];
  if (!user) return;
  writeUsers({
    ...users,
    [userId]: { ...user, permissions: { ...user.permissions, chat } },
  });
}

export function isSubscribed(userId: string, pluginId: string): boolean {
  return findUser(userId)?.subscriptions[pluginId] ?? false;
}

export function subscribe(userId: string, pluginId: string): void {
  const users = readUsers();
  const user = users[userId];
  if (!user) return;
  writeUsers({
    ...users,
    [userId]: {
      ...user,
      subscriptions: { ...user.subscriptions, [pluginId]: true },
    },
  });
}

export function unsubscribe(userId: string, pluginId: string): void {
  const users = readUsers();
  const user = users[userId];
  if (!user) return;
  const { [pluginId]: _, ...rest } = user.subscriptions;
  writeUsers({
    ...users,
    [userId]: { ...user, subscriptions: rest },
  });
}

export function getAllUsers(): readonly UserConfig[] {
  return Object.values(readUsers());
}
