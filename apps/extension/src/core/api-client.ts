import type { FillResult, PublishedRef } from '@kleekto/contracts';
import { isLocale, type Locale } from '@kleekto/i18n';

import type { ImportRequestBody, ImportResponse } from './import-manager';
import type { DraftResponse } from './publish-manager';
import type { Session, StorageArea } from './storage';
import { clearSession, readSession, writeSession } from './storage';

/**
 * Единственная точка обращения к серверу (§6.3).
 *
 * Вызывается только из service worker. Content script в сеть не ходит: он
 * живёт в песочнице чужой страницы, и запрос оттуда шёл бы с origin площадки
 * со всеми вытекающими для CORS и для сохранности токена.
 */

/** Сессия истекла. Отдельный класс: §6.5 требует предложить вход, а не «сбой». */
export class UnauthenticatedError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'UnauthenticatedError';
  }
}

export interface ApiConfig {
  baseUrl: string;
  storage: StorageArea;
  /** Подменяется в тестах. */
  fetch: typeof globalThis.fetch;
  now?: () => number;
}

/** Ответ `/auth/login` и `/auth/refresh`. Плоский, без обёртки. */
interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Нужная расширению часть `/auth/me`. */
interface CurrentUser {
  email: string;
  locale: string;
}

/** Запас до истечения токена: обновляем заранее, а не в момент отказа. */
const REFRESH_MARGIN_MS = 30_000;

export class ApiClient {
  constructor(private readonly config: ApiConfig) {}

  private now(): number {
    return (this.config.now ?? Date.now)();
  }

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/+$/u, '')}${path}`;
  }

  /**
   * Вход. Два запроса: токены и профиль.
   *
   * Профиль нужен не для красоты — в нём язык пользователя. Расширение обязано
   * говорить на языке агента (ADR-0008), а не на языке его браузера: агент мог
   * поставить систему на русском, а работать на грузинском.
   */
  async login(email: string, password: string): Promise<Session> {
    const response = await this.config.fetch(this.url('/api/v1/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new UnauthenticatedError();
    }

    const tokens = (await response.json()) as SessionTokens;
    const profile = await this.fetchProfile(tokens.accessToken);

    const session: Session = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: this.now() + tokens.expiresIn * 1000,
      email: profile.email,
      locale: toLocale(profile.locale),
    };

    await writeSession(this.config.storage, session);
    return session;
  }

  async logout(): Promise<void> {
    await clearSession(this.config.storage);
  }

  private async fetchProfile(accessToken: string): Promise<CurrentUser> {
    const response = await this.config.fetch(this.url('/api/v1/auth/me'), {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new UnauthenticatedError();
    return (await response.json()) as CurrentUser;
  }

  /**
   * Действующий access-токен.
   *
   * Обновление идёт заранее, по времени жизни, а не по ответу 401. Иначе
   * первый запрос после истечения обязательно провалился бы — и агент увидел
   * бы ошибку там, где ничего не сломано.
   */
  private async accessToken(): Promise<string> {
    const session = await readSession(this.config.storage);
    if (session === null) throw new UnauthenticatedError();

    if (session.expiresAt - REFRESH_MARGIN_MS > this.now()) {
      return session.accessToken;
    }

    const response = await this.config.fetch(this.url('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    if (!response.ok) {
      // Refresh отклонён — в том числе при обнаружении кражи токена
      // (ротация с детекцией, фаза 3). Сессию стираем: держать заведомо
      // мёртвый токен значит показывать агенту ошибку на каждом действии.
      await clearSession(this.config.storage);
      throw new UnauthenticatedError();
    }

    const tokens = (await response.json()) as SessionTokens;

    const refreshed: Session = {
      ...session,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: this.now() + tokens.expiresIn * 1000,
    };
    await writeSession(this.config.storage, refreshed);
    return refreshed.accessToken;
  }

  /**
   * Просит сервер собрать черновик публикации.
   *
   * Профиль публикации не передаётся: §6А.7 требует «одного клика», поэтому
   * берётся профиль по умолчанию, без диалога. Какой именно применён, агент
   * увидит в отчёте о заполнении.
   */
  async createPublicationDraft(propertyId: string, targetSource: string): Promise<DraftResponse> {
    return this.send<DraftResponse>(
      `/api/v1/properties/${encodeURIComponent(propertyId)}/publications`,
      { targetSource },
    );
  }

  /**
   * Отчёт о заполнении. Он же сигнал метрики `fill failure rate`.
   *
   * Уходит и при полном успехе, и при частичном: иначе о смене вёрстки формы
   * мы узнаем от агента, а не из метрики.
   */
  async reportPublicationFilled(publicationId: string, result: FillResult): Promise<void> {
    await this.send(`/api/v1/publications/${encodeURIComponent(publicationId)}/filled`, {
      formVersion: result.formVersion,
      filled: result.filled,
      unfilled: result.unfilled,
      snapshotId: result.snapshotId,
    });
  }

  /**
   * Подтверждение публикации человеком (§6А.7, инвариант 13).
   *
   * Расширение не знает, нажал ли агент «Опубликовать»: форму отправляет
   * площадка. Без этого подтверждения статус остаётся `filled`.
   */
  async confirmPublication(publicationId: string, ref: PublishedRef): Promise<void> {
    await this.send(`/api/v1/publications/${encodeURIComponent(publicationId)}/confirm`, {
      externalUrl: ref.externalUrl,
      externalId: ref.externalId,
    });
  }

  /**
   * Импорт объявления — все четыре исхода разговора.
   *
   * Токен идёт заголовком `Authorization`, а не cookie: cookie нашего домена
   * расширению на странице площадки недоступны. Серверный `requireAuth` это
   * учитывает и принимает оба способа.
   */
  async importListing(body: ImportRequestBody): Promise<ImportResponse> {
    return this.send<ImportResponse>('/api/v1/import/listing', body);
  }

  /**
   * Запрос с токеном к нашему API.
   *
   * Общий путь для всех вызовов публикации: обновление токена, 401 со стиранием
   * сессии и разбор ответа выглядят одинаково, и три копии этого кода разошлись
   * бы при первой же правке.
   */
  private async send<T>(path: string, body: unknown): Promise<T> {
    const token = await this.accessToken();

    const response = await this.config.fetch(this.url(path), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      await clearSession(this.config.storage);
      throw new UnauthenticatedError();
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Сервер отклонил ${path}: ${response.status} ${detail.slice(0, 200)}`);
    }

    return (await response.json()) as T;
  }
}

function toLocale(value: string): Locale {
  return isLocale(value) ? value : 'en';
}
