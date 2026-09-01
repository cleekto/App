import type { DeepPartial, Dictionary } from '../types';

/**
 * Русский. Намеренно `DeepPartial`, а не полный `Dictionary`.
 *
 * Требовать полноты типом означало бы заставлять разработчика вписывать
 * заглушку при добавлении каждого ключа — и через месяц половина словаря
 * состояла бы из скопированного английского, неотличимого от перевода.
 *
 * Непереведённый ключ виден на экране как дыра (см. `translate`), попадает
 * в отчёт о покрытии и не подменяется другим языком молча (ADR-0008).
 */
export const ru: DeepPartial<Dictionary> = {
  app: {
    name: 'Cleekto',
    tagline: 'CRM для агентств недвижимости',
  },
  health: {
    ok: 'Все системы работают',
    databaseUnavailable: 'База данных недоступна',
  },
  common: {
    loading: 'Загрузка',
    retry: 'Повторить',
    cancel: 'Отмена',
    save: 'Сохранить',
    close: 'Закрыть',
    notSignedIn: 'Вход не выполнен',
  },
  extension: {
    signInPrompt: 'Войдите в Cleekto, чтобы импортировать объявления',
    signIn: 'Войти',
    email: 'Почта',
    password: 'Пароль',
    signedInAs: 'Вы вошли как',
    signOut: 'Выйти',

    notAListing: 'Откройте объявление на ss.ge или myhome.ge',
    detected: 'Объявление распознано',

    callResult: 'Результат разговора',

    outcome: {
      consent: 'Согласен — добавить в Cleekto',
      refused: 'Отказ / не звонить',
      noAnswer: 'Недозвон',
      callback: 'Перезвонить через…',
    },

    phoneNotRevealed:
      'Сначала откройте номер телефона на странице, затем нажмите «Согласен» ещё раз.',

    added: {
      title: 'Добавлено в Cleekto',
      status: 'В базе · закреплено за вами',
      open: 'Открыть в Cleekto',
    },

    refusedRecorded: {
      title: 'Отмечено: отказ',
      scope: 'Ваша команда больше не увидит это объявление в ленте. Другие команды — увидят.',
      doNotCall: 'Собственник просил больше не звонить',
      doNotCallScope: 'Действует на всё агентство',
    },

    noAnswerRecorded: {
      title: 'Отмечено: недозвон',
      scope: 'Вернётся в ленту примерно через сутки.',
    },

    callbackRecorded: {
      title: 'Перезвон запланирован',
    },
    callbackPrompt: 'Перезвонить через',
    callbackTomorrow: 'Завтра',
    callbackThreeDays: '3 дня',
    callbackWeek: 'Неделю',

    preview: {
      noDuplicate: 'Дублей нет',
      notFilled: 'Не заполнено',
      phone: 'Собственник',
    },

    duplicate: {
      blocked: 'Этот объект уже есть в базе вашей команды',
      warning: 'Похожий объект, возможно, уже есть',
      otherTeam: 'С этим собственником работает другая команда агентства',
      addAnyway: 'Всё равно добавить',
      linked: 'Привязано к существующему объекту',
    },

    fill: {
      publishingAs: 'От имени',
      filled: 'полей заполнено',
      leftForYou: 'Остаётся вам',
      clearForm: 'Очистить форму',
      cleared: 'Форма очищена',
      editedWarning: 'Эти поля вы правили после заполнения. Они оставлены как есть',
      clearAnyway: 'Откатить и их',
      notAForm: 'Откройте форму «новое объявление» на ss.ge или myhome.ge',
    },

    error: {
      network: 'Нет связи с Cleekto. Данные сохранены — попробуйте ещё раз.',
      session: 'Сессия истекла. Войдите заново.',
      unknown: 'Что-то пошло не так. Попробуйте ещё раз.',
    },
  },
};
