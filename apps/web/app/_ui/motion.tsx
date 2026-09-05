'use client';

import { motion, useInView, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';

/**
 * Движение интерфейса.
 *
 * ПОЧЕМУ ЗДЕСЬ БИБЛИОТЕКА, А НЕ CSS. Появление одной карточки CSS делает
 * лучше — `@starting-style` короче и не стоит ни килобайта (так сделан
 * `.reveal` в `globals.css`). Но две вещи ниже CSS не умеет: считать число
 * пружиной от старого значения к новому и запускать очередь появления,
 * когда блок доехал до экрана. Ради них и взята `motion`.
 *
 * ПРАВИЛА, КОТОРЫЕ ЗДЕСЬ НЕ НАРУШАЮТСЯ:
 *   — двигаются только `transform` и `opacity`, ничего, что заставляет
 *     браузер пересчитывать раскладку;
 *   — длительности короткие: агент кликает быстрее, чем заканчивается
 *     длинный переход, и упирается в него сто раз за день;
 *   — кто выключил анимацию в системе, получает сразу конечное состояние,
 *     а не замедленное движение.
 */

/** Кривая появления: быстрый старт, мягкая остановка. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Очередь появления: дети выезжают снизу друг за другом.
 *
 * Задержка между соседями маленькая (55 мс). При большей очередь начинает
 * читаться как загрузка — будто интерфейс не успевает, — а не как движение.
 */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.055 } } }}
    >
      {children}
    </motion.div>
  );
}

/** Один участник очереди. Вне `Stagger` появляется сам по себе. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Число, доезжающее до значения пружиной.
 *
 * ЗАЧЕМ. Показатель, который просто появился, читается как картинка.
 * Доехавший до значения читается как измеренная величина — взгляд
 * задерживается на нём, а это ровно то, чего ждут от сводки.
 *
 * ФОРМАТИРОВАНИЕ ОСТАЁТСЯ НА СЕРВЕРЕ, и это правило проекта, а не мелочь:
 * у браузера агента может не быть данных грузинской локали, и разошедшийся
 * формат ломает гидратацию (`tests/foundation.test.ts` это стережёт).
 * Поэтому `Intl` здесь нет вовсе — сервер передаёт готовый разделитель
 * разрядов, а клиент только расставляет его через каждые три цифры.
 * Знание о локали приходит с сервера; здесь остаётся арифметика.
 */
export function AnimatedNumber({
  value,
  groupSeparator,
  className,
}: {
  value: number;
  /** Разделитель разрядов, вычисленный на сервере по языку агента. */
  groupSeparator: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  const raw = useMotionValue(0);
  const spring = useSpring(raw, { stiffness: 90, damping: 20, mass: 0.6 });

  const format = useMemo(() => {
    return (current: number): string => {
      const digits = String(Math.abs(Math.round(current)));
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/gu, groupSeparator);
      return current < 0 ? `-${grouped}` : grouped;
    };
  }, [groupSeparator]);

  useEffect(() => {
    if (inView) raw.set(value);
  }, [inView, raw, value]);

  useEffect(() => {
    // Пишем в узел напрямую: перерисовывать React шестьдесят раз в секунду
    // ради одной строки — самый дорогой способ анимировать число.
    const stop = spring.on('change', (current) => {
      if (ref.current !== null) ref.current.textContent = format(current);
    });
    return () => {
      stop();
    };
  }, [spring, format]);

  // Начальное содержимое — конечное значение: без JS и при выключенной
  // анимации на экране сразу правильное число, а не ноль.
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
