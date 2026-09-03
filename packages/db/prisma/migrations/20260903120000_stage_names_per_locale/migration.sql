-- У стадии воронки своё имя на каждом языке.
--
-- Решение владельца 2026-09-03: перевод стадий по коду отменён. Он работал,
-- пока стадии не переименовывали, — а переименованная стадия показывалась
-- одним словом всем, на языке того, кто её правил.
--
-- ПОРЯДОК ВАЖЕН: сначала колонки, потом перенос переводов, и только потом
-- снос флага. Иначе переводы, которые сейчас живут в словаре продукта,
-- потерялись бы, и грузинский агент увидел бы английское «In base» —
-- ровно тот дефект, ради которого перевод по коду когда-то и вводился.

-- 1. Имя на каждый язык. Пусто — берётся `name`.
ALTER TABLE "pipeline_statuses" ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameKa" TEXT,
ADD COLUMN     "nameRu" TEXT;

-- 2. Перенос: пять стадий, создаваемых при регистрации, уже переведены
--    в словаре продукта. Значения перекладываются в данные как есть.
--
--    Стадии, заведённые агентством (`nameIsCustom`), не трогаются: их никто
--    не переводил, и все три языка законно остаются пустыми — на экране
--    покажется `name`, то есть ровно то, что видно сейчас.
UPDATE "pipeline_statuses" SET
  "nameKa" = 'ბაზაში', "nameEn" = 'In base', "nameRu" = 'В базе'
WHERE "code" = 'IN_BASE' AND "nameIsCustom" = false;

UPDATE "pipeline_statuses" SET
  "nameKa" = 'მუშავდება', "nameEn" = 'In progress', "nameRu" = 'Принят в работу'
WHERE "code" = 'IN_PROGRESS' AND "nameIsCustom" = false;

UPDATE "pipeline_statuses" SET
  "nameKa" = 'შეთავაზებულია კლიენტს', "nameEn" = 'Offered to client', "nameRu" = 'Предложен клиенту'
WHERE "code" = 'OFFERED' AND "nameIsCustom" = false;

UPDATE "pipeline_statuses" SET
  "nameKa" = 'დახურული', "nameEn" = 'Closed', "nameRu" = 'Закрыт'
WHERE "code" = 'CLOSED' AND "nameIsCustom" = false;

UPDATE "pipeline_statuses" SET
  "nameKa" = 'არქივი', "nameEn" = 'Archived', "nameRu" = 'Архив'
WHERE "code" = 'ARCHIVED' AND "nameIsCustom" = false;

-- 3. Флаг больше не нужен: различать «переведено сидом» и «названо агентством»
--    незачем, когда имя каждого языка лежит своим полем.
ALTER TABLE "pipeline_statuses" DROP COLUMN "nameIsCustom";
