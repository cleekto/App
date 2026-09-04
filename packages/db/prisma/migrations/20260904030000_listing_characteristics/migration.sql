-- Характеристики объявления, выбранные владельцем из того, что отдают
-- площадки. Все колонки необязательные: частичное заполнение — штатный
-- режим (правило 14), и «балкона нет» отличается от «про балкон не сказано».
--
-- Миграция только добавляет: существующие объекты остаются как есть,
-- новые поля у них пусты, пока объявление не переимпортируют.

-- CreateEnum
CREATE TYPE "SellerKind" AS ENUM ('owner', 'agency');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "balconies" INTEGER,
ADD COLUMN     "balconyArea" DECIMAL(10,2),
ADD COLUMN     "bathrooms" TEXT,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "buildingStatus" TEXT,
ADD COLUMN     "cadastralCode" TEXT,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "houseArea" DECIMAL(10,2),
ADD COLUMN     "projectType" TEXT,
ADD COLUMN     "sellerKind" "SellerKind",
ADD COLUMN     "yardArea" DECIMAL(10,2);
