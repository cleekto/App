import { formatMoney, formatNumber, translator, type Locale, type MessageKey } from '@cleekto/i18n';

import type { CallOutcome, ListingPreview } from '../core/import-manager';

/**
 * Интерфейс расширения на странице площадки.
 *
 * ЖИВЁТ В SHADOW DOM. Причина не в моде: страница ss.ge и наш блок иначе
 * делят одно пространство стилей, и любой их `* { box-sizing }` или
 * `div { margin }` перекроил бы нам вёрстку — а наш сброс сломал бы им.
 * §6.5 требует, чтобы расширение никогда не роняло страницу сайта.
 *
 * Разметка собирается через `document.createElement` и `textContent`, а не
 * через `innerHTML` со склейкой строк: в предпросмотре есть заголовок
 * объявления и адрес, то есть чужой текст. Один `innerHTML` с ним — и мы
 * выполняем на странице то, что написал автор объявления.
 */

export type UiAction =
  | { type: 'outcome'; outcome: CallOutcome }
  | { type: 'confirm'; acknowledgedDuplicateOf?: string[] }
  | { type: 'callback'; days: number }
  | { type: 'do-not-call' }
  | { type: 'retry' }
  | { type: 'close' };

const HOST_ID = 'cleekto-root';

export class Ui {
  private readonly host: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly panel: HTMLElement;
  private t: (key: MessageKey) => string;
  private locale: Locale;

  constructor(
    locale: Locale,
    private readonly onAction: (action: UiAction) => void,
  ) {
    this.locale = locale;
    this.t = translator(locale);

    const existing = document.getElementById(HOST_ID);
    existing?.remove();

    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    this.root.append(style);

    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    this.root.append(this.panel);

    document.body.append(this.host);
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.t = translator(locale);
  }

  /**
   * Отрисованная панель — для тестов.
   *
   * Через shadow root её содержимое не прочитать: реализация DOM, на которой
   * гоняются тесты, поддерживает `attachShadow`, но не отдаёт текст сквозь
   * него. Панель — обычный элемент, и читается обычным способом.
   *
   * Открыто ради проверки, что интерфейс действительно говорит на трёх
   * языках. Без этого перевод оставался бы непроверенным утверждением.
   */
  get content(): HTMLElement {
    return this.panel;
  }

  hide(): void {
    this.host.style.display = 'none';
  }

  private show(): void {
    this.host.style.display = 'block';
  }

  private clear(): HTMLElement {
    this.panel.replaceChildren();
    this.show();
    return this.panel;
  }

  private head(text: string, tone: 'normal' | 'quiet' = 'normal'): HTMLElement {
    const h = document.createElement('div');
    h.className = tone === 'quiet' ? 'title quiet' : 'title';
    h.textContent = text;
    return h;
  }

  private line(text: string): HTMLElement {
    const p = document.createElement('p');
    p.className = 'line';
    p.textContent = text;
    return p;
  }

  private button(text: string, kind: 'primary' | 'plain', action: UiAction): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = kind === 'primary' ? 'btn primary' : 'btn plain';
    b.textContent = text;
    b.addEventListener('click', () => this.onAction(action));
    return b;
  }

  private closeButton(): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'close';
    b.setAttribute('aria-label', this.t('common.close'));
    b.textContent = '×';
    b.addEventListener('click', () => this.onAction({ type: 'close' }));
    return b;
  }

  /**
   * Меню исхода разговора — DESIGN §25.4.
   *
   * Один заметный пункт и три спокойных. Это не рейтинг важности: все четыре
   * записываются. Это отражение последствия — только первый пишет контакт
   * собственника в базу агентства. Ничего не выбрано заранее.
   */
  outcomeMenu(preview: ListingPreview | null): void {
    const panel = this.clear();
    panel.append(this.closeButton(), this.head(this.t('extension.callResult')));

    if (preview !== null) {
      panel.append(this.summary(preview));
    }

    panel.append(
      this.button(this.t('extension.outcome.consent'), 'primary', {
        type: 'outcome',
        outcome: 'consent',
      }),
    );

    const quiet = document.createElement('div');
    quiet.className = 'quiet-group';
    quiet.append(
      this.button(this.t('extension.outcome.refused'), 'plain', {
        type: 'outcome',
        outcome: 'refused',
      }),
      this.button(this.t('extension.outcome.noAnswer'), 'plain', {
        type: 'outcome',
        outcome: 'no_answer',
      }),
      this.button(this.t('extension.outcome.callback'), 'plain', {
        type: 'outcome',
        outcome: 'callback',
      }),
    );
    panel.append(quiet);
  }

  /** Предпросмотр перед созданием объекта. Только для «Согласен». */
  confirmConsent(preview: ListingPreview): void {
    const panel = this.clear();
    panel.append(
      this.closeButton(),
      this.head(this.t('extension.detected')),
      this.summary(preview),
    );
    panel.append(this.button(this.t('extension.outcome.consent'), 'primary', { type: 'confirm' }));
  }

  /**
   * ПРАВИЛО 11 и DESIGN §25.1.
   *
   * Блокирующее состояние, а не ошибка: ничего не сломалось, пропущен шаг.
   * Поэтому спокойный тон, без красного и без слова «ошибка», и одно
   * очевидное следующее действие. Предпросмотр остаётся на месте — ничего
   * из сделанного агентом не потеряно.
   */
  phoneNotRevealed(preview: ListingPreview | null): void {
    const panel = this.clear();
    panel.append(this.closeButton(), this.head(this.t('extension.phoneNotRevealed'), 'quiet'));
    if (preview !== null) panel.append(this.summary(preview));
    panel.append(this.button(this.t('common.retry'), 'primary', { type: 'retry' }));
  }

  /**
   * Не вошли.
   *
   * Отдельно от `error('session')`: «сессия истекла» тому, кто ни разу
   * не входил, — неправда, и агент пойдёт искать несуществующую проблему.
   */
  signInRequired(): void {
    const panel = this.clear();
    panel.append(this.closeButton(), this.head(this.t('extension.signInPrompt'), 'quiet'));
  }

  added(openUrl: string | null): void {
    const panel = this.clear();
    panel.append(
      this.closeButton(),
      this.head(this.t('extension.added.title')),
      this.line(this.t('extension.added.status')),
    );

    if (openUrl !== null) {
      const link = document.createElement('a');
      link.className = 'link';
      link.href = openUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = this.t('extension.added.open');
      panel.append(link);
    }
  }

  /**
   * После отказа. Галочка «просил не звонить» появляется ПОСЛЕ действия,
   * а не до (DESIGN §25.4): случай редкий, и ставить его на пути каждого
   * отказа значит замедлить частое ради исключения. Область у него другая —
   * компания, а не команда, — поэтому и момент другой.
   */
  refusedRecorded(): void {
    const panel = this.clear();
    panel.append(
      this.closeButton(),
      this.head(this.t('extension.refusedRecorded.title')),
      this.line(this.t('extension.refusedRecorded.scope')),
    );

    const label = document.createElement('label');
    label.className = 'check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => {
      if (box.checked) this.onAction({ type: 'do-not-call' });
    });
    const text = document.createElement('span');
    text.textContent = this.t('extension.refusedRecorded.doNotCall');
    label.append(box, text);

    panel.append(label, this.line(this.t('extension.refusedRecorded.doNotCallScope')));
  }

  noAnswerRecorded(): void {
    const panel = this.clear();
    panel.append(
      this.closeButton(),
      this.head(this.t('extension.noAnswerRecorded.title')),
      this.line(this.t('extension.noAnswerRecorded.scope')),
    );
  }

  /** Пресеты вперёд, календарь последним: почти всегда это день или три. */
  callbackPicker(): void {
    const panel = this.clear();
    panel.append(this.closeButton(), this.head(this.t('extension.callbackPrompt')));

    const row = document.createElement('div');
    row.className = 'row';
    row.append(
      this.button(this.t('extension.callbackTomorrow'), 'plain', { type: 'callback', days: 1 }),
      this.button(this.t('extension.callbackThreeDays'), 'plain', { type: 'callback', days: 3 }),
      this.button(this.t('extension.callbackWeek'), 'plain', { type: 'callback', days: 7 }),
    );
    panel.append(row);
  }

  callbackRecorded(): void {
    const panel = this.clear();
    panel.append(this.closeButton(), this.head(this.t('extension.callbackRecorded.title')));
  }

  /**
   * Дубль. Блокирующий — область команды; предупреждение — область компании.
   * Смешивать нельзя: первое запрещает, второе только сообщает (инвариант 9).
   */
  duplicate(kind: 'blocked' | 'warning' | 'other_team', matchIds: string[]): void {
    const panel = this.clear();
    const key: MessageKey =
      kind === 'blocked'
        ? 'extension.duplicate.blocked'
        : kind === 'warning'
          ? 'extension.duplicate.warning'
          : 'extension.duplicate.otherTeam';

    panel.append(this.closeButton(), this.head(this.t(key), 'quiet'));

    // «Добавить всё равно» не предлагается при жёсткой блокировке: вторая
    // копия того же объекта в базе своей же команды бессмысленна.
    if (kind !== 'blocked') {
      panel.append(
        this.button(this.t('extension.duplicate.addAnyway'), 'primary', {
          type: 'confirm',
          acknowledgedDuplicateOf: matchIds,
        }),
      );
    }
  }

  error(kind: 'network' | 'session' | 'unknown'): void {
    const panel = this.clear();
    const key: MessageKey =
      kind === 'network'
        ? 'extension.error.network'
        : kind === 'session'
          ? 'extension.error.session'
          : 'extension.error.unknown';

    panel.append(this.closeButton(), this.head(this.t(key), 'quiet'));
    if (kind !== 'session') {
      panel.append(this.button(this.t('common.retry'), 'primary', { type: 'retry' }));
    }
  }

  /**
   * Цена.
   *
   * Валюта передаётся явно и не выводится из языка (Q13): агентство в Тбилиси
   * ведёт объекты в долларах, а интерфейс при этом может быть грузинским.
   * Валюты может не быть — на посуточной аренде ss.ge её нет в заголовке
   * вместе с ценой; тогда показывается голое число, а не выдуманный знак.
   */
  private money(price: number, currency: string | null): string {
    return currency === null
      ? formatNumber(this.locale, price)
      : formatMoney(this.locale, price, currency);
  }

  /** Компактная сводка: цена, площадь, комнаты, адрес, телефон, незаполненное. */
  private summary(preview: ListingPreview): HTMLElement {
    const box = document.createElement('div');
    box.className = 'summary';

    const facts = [
      preview.price === null ? null : this.money(preview.price, preview.currency),
      preview.area === null ? null : `${preview.area} m²`,
      preview.rooms === null ? null : `${preview.rooms}`,
    ].filter((value): value is string => value !== null);

    if (facts.length > 0) {
      const row = document.createElement('div');
      row.className = 'facts';
      row.textContent = facts.join(' · ');
      box.append(row);
    }

    const place = preview.address ?? preview.district;
    if (place !== null) box.append(this.line(place));

    if (preview.phone !== null) {
      box.append(this.line(`${this.t('extension.preview.phone')}: ${preview.phone}`));
    }

    // Честный список того, что прочитать не удалось (§6.5, требование D9).
    // Частичный успех — норма, а не сбой: агент дозаполнит поля в CRM.
    if (preview.missingFields.length > 0) {
      const missing = document.createElement('div');
      missing.className = 'missing';
      missing.textContent = `${this.t('extension.preview.notFilled')}: ${preview.missingFields.join(', ')}`;
      box.append(missing);
    }

    return box;
  }
}

/**
 * Стили. `text-transform` не используется нигде: у грузинского нет заглавных
 * букв, и правило 18 запрещает `uppercase` во всём интерфейсе.
 */
const STYLES = `
  :host { all: initial; }
  .panel {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    width: 320px;
    box-sizing: border-box;
    padding: 16px;
    border: 1px solid #e8eaed;
    border-radius: 12px;
    background: #ffffff;
    color: #2b2f38;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
    font-family: system-ui, -apple-system, 'Segoe UI', 'Noto Sans', 'Noto Sans Georgian', sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .title { font-size: 15px; font-weight: 600; padding-right: 20px; }
  .title.quiet { font-weight: 500; color: #4b5563; }
  .line { margin: 6px 0 0; color: #6b7280; }
  .summary { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e8eaed; }
  .facts { font-weight: 600; }
  .missing { margin-top: 8px; font-size: 13px; color: #92722a; }
  .btn {
    display: block;
    width: 100%;
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    font: inherit;
    cursor: pointer;
  }
  .btn.primary { border: none; background: #1f6feb; color: #ffffff; font-weight: 600; }
  .btn.plain { border: none; background: transparent; color: #4b5563; text-align: left; padding: 8px 4px; }
  .btn.plain:hover { color: #2b2f38; }
  .quiet-group { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e8eaed; }
  .row { display: flex; gap: 6px; }
  .row .btn { margin-top: 10px; text-align: center; border: 1px solid #e8eaed; border-radius: 8px; }
  .close {
    position: absolute; top: 10px; right: 10px;
    border: none; background: transparent; cursor: pointer;
    font-size: 18px; line-height: 1; color: #9ca3af;
  }
  .check { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; }
  .link { display: inline-block; margin-top: 10px; color: #1f6feb; }
`;
