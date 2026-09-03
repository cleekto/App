-- Агент публикует под своим именем и своим номером.
--
-- Решение владельца 2026-09-03: отдельной сущности «профиль публикации»
-- больше нет. Номер, который уходит в объявление, лежит на сотруднике,
-- а публикация хранит имя и телефон, под которыми объявление реально вышло
-- на площадку.
--
-- Порядок здесь важен: сначала новые колонки, потом перенос данных,
-- и только потом снос старого. Сгенерированный порядок сносил бы таблицу
-- раньше переноса, и номера, уже заведённые агентством, пропали бы.

-- 1. Новые колонки.
ALTER TABLE "users" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneNormalized" TEXT;

ALTER TABLE "publications" ADD COLUMN     "publisherName" TEXT,
ADD COLUMN     "publisherPhone" TEXT;

-- 2. Перенос. Личный профиль сотрудника становится его рабочим телефоном.
UPDATE "users" u
SET "phone" = p."phoneOriginal",
    "phoneNormalized" = p."phoneNormalized"
FROM "publish_profiles" p
WHERE p."userId" = u."id"
  AND u."phone" IS NULL;

-- Публикация запоминает контакт, под которым она вышла. Это запись о том,
-- что стоит в чужом объявлении, и переписывать её потом нечем.
UPDATE "publications" pub
SET "publisherName" = p."displayName",
    "publisherPhone" = p."phoneOriginal"
FROM "publish_profiles" p
WHERE pub."publishProfileId" = p."id";

-- 3. Снос.
ALTER TABLE "publications" DROP CONSTRAINT "publications_publishProfileId_fkey";
ALTER TABLE "publish_profiles" DROP CONSTRAINT "publish_profiles_companyId_fkey";
ALTER TABLE "publish_profiles" DROP CONSTRAINT "publish_profiles_userId_fkey";

ALTER TABLE "publications" DROP COLUMN "publishProfileId";

DROP TABLE "publish_profiles";

-- 4. Поиск «этот номер — наш» при импорте.
CREATE INDEX "users_companyId_phoneNormalized_idx" ON "users"("companyId", "phoneNormalized");
