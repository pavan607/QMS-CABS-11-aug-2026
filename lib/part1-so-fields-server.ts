import { query } from '@/lib/db';

let soInvolvementColumnsEnsured = false;

/** Ensure Part I field 4 involvement columns exist (server-only; safe to call repeatedly). */
export async function ensurePart1SoInvolvementColumns(): Promise<void> {
  if (soInvolvementColumnsEnsured) return;
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS so_involves_dgaqa BOOLEAN DEFAULT FALSE`
  );
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS so_involves_rqa BOOLEAN DEFAULT FALSE`
  );
  soInvolvementColumnsEnsured = true;
}

let quantityNumericEnsured = false;

/** Field 11. Qty and field 10 Qty/set may be decimals (e.g. 2.5). */
export async function ensureQuantityNumericColumn(): Promise<void> {
  if (quantityNumericEnsured) return;
  await query(
    `ALTER TABLE inspection_requests
     ALTER COLUMN quantity TYPE NUMERIC(14, 4)
     USING quantity::numeric`
  );
  await query(
    `ALTER TABLE inspection_requests
     ALTER COLUMN quantity_per_set TYPE NUMERIC(14, 4)
     USING quantity_per_set::numeric`
  );
  quantityNumericEnsured = true;
}

export {
  parsePart1Bool,
  isSupplyOrderAttachment,
  SUPPLY_ORDER_ATTACHMENT_DESCRIPTION,
} from '@/lib/part1-so-fields';
