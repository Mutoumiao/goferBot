-- AlterTable
ALTER TABLE "folders" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
CREATE SEQUENCE knowledge_bases_sort_order_seq;
ALTER TABLE "knowledge_bases" ALTER COLUMN "sort_order" SET DEFAULT nextval('knowledge_bases_sort_order_seq');
ALTER SEQUENCE knowledge_bases_sort_order_seq OWNED BY "knowledge_bases"."sort_order";
