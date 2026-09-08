import { describe, expect, it } from 'vitest';

import { PUBLISH_FORM_URLS, propertyMark, withPropertyMark } from './publish-handoff';

/**
 * Передача объекта из kleekTo в форму площадки.
 *
 * Проверяется то, ради чего метка вообще устроена именно так: площадка
 * не должна получить наш идентификатор, а расширение не должно верить
 * тому, что написано в адресной строке чужого сайта.
 */

const ID = '3301539d-f649-4671-87e7-de3e1ee092e7';
const FORM = 'https://home.ss.ge/ka/udzravi-qoneba/create';

describe('метка объекта в адресе формы', () => {
  it('едет туда и обратно', () => {
    expect(propertyMark(withPropertyMark(FORM, ID))).toBe(ID);
  });

  it('ЛЕЖИТ В ЯКОРЕ, А НЕ В ПАРАМЕТРЕ ЗАПРОСА', () => {
    /*
     * Ради этого всё и сделано так. Якорь браузер на сервер не отправляет:
     * площадка не получает ни одного нашего идентификатора и вообще
     * не узнаёт, что здесь замешана чужая система. Параметр `?kleekto=…`
     * попал бы в её журналы и аналитику.
     */
    const url = new URL(withPropertyMark(FORM, ID));

    expect(url.hash).toContain(ID);
    expect(url.search).toBe('');
  });

  it('адрес формы не портится', () => {
    const url = new URL(withPropertyMark(FORM, ID));

    expect(`${url.origin}${url.pathname}`).toBe(FORM);
  });

  it('чужой якорь не принимается за метку', () => {
    expect(propertyMark(`${FORM}#section=photos`)).toBeNull();
    expect(propertyMark(FORM)).toBeNull();
  });

  it('МУСОР ИЗ АДРЕСНОЙ СТРОКИ ОТВЕРГАЕТСЯ', () => {
    /*
     * Якорь правит кто угодно, а значение уходит дальше в запрос к нашему
     * серверу. Права он проверит сам, но отправлять туда произвольную строку
     * с чужого сайта незачем.
     */
    expect(propertyMark(`${FORM}#kleekto=../../admin`)).toBeNull();
    expect(propertyMark(`${FORM}#kleekto=`)).toBeNull();
    expect(propertyMark(`${FORM}#kleekto=<script>`)).toBeNull();
    expect(propertyMark('не адрес вовсе')).toBeNull();
  });

  it('адрес формы известен только для ss.ge', () => {
    /*
     * У myhome поля формы не имеют постоянных имён — адаптера заполнения
     * для неё нет намеренно, и открывать её форму с меткой было бы
     * обещанием помощи, которой не будет.
     */
    expect(PUBLISH_FORM_URLS['SS_GE']).toBeDefined();
    expect(PUBLISH_FORM_URLS['MYHOME_GE']).toBeUndefined();
  });
});
