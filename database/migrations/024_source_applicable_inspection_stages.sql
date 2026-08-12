-- Map inspection-type categories to Part I Source (Indigenous / Imported / COTS item).
-- NULL/empty applicable_sources = category applies to all non-COTS sources.
-- COTS-only categories use applicable_sources containing 'cots_item' (or legacy 'cots').

ALTER TABLE inspection_type_groups
  ADD COLUMN IF NOT EXISTS applicable_sources TEXT[] DEFAULT NULL;

COMMENT ON COLUMN inspection_type_groups.applicable_sources IS
  'Part I Source values this category applies to (indigenous, imported, cots_item). NULL/empty = non-COTS sources. COTS-only = {cots_item}.';

-- Normalize any early 'cots' tags to 'cots_item'
UPDATE inspection_type_groups
SET applicable_sources = ARRAY(
  SELECT DISTINCT CASE WHEN lower(s) = 'cots' THEN 'cots_item' ELSE lower(s) END
  FROM unnest(applicable_sources) AS s
)
WHERE applicable_sources IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(applicable_sources) AS s WHERE lower(s) = 'cots'
  );

-- Ensure a COTS Inspection category with default stages (Admin can add more items later).
INSERT INTO inspection_type_groups (name, description, sort_order, status)
SELECT
  'COTS Inspection',
  'Inspection stages for Part I Source = COTS item (Physical / Visual / Functional). Admin may add further tests.',
  900,
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM inspection_type_groups WHERE lower(name) = 'cots inspection'
);

UPDATE inspection_type_groups
SET applicable_sources = ARRAY['cots_item']::TEXT[],
    updated_at = CURRENT_TIMESTAMP
WHERE lower(name) = 'cots inspection';

-- Default COTS stage items
INSERT INTO inspection_type_items (group_id, name, code, sort_order, status)
SELECT g.id, v.name, v.code, v.sort_order, 'active'
FROM inspection_type_groups g
CROSS JOIN (
  VALUES
    ('Physical Inspection', 'COTS-PHY', 1),
    ('Visual Inspection', 'COTS-VIS', 2),
    ('Functional Inspection', 'COTS-FUN', 3)
) AS v(name, code, sort_order)
WHERE lower(g.name) = 'cots inspection'
  AND NOT EXISTS (
    SELECT 1
    FROM inspection_type_items i
    WHERE i.group_id = g.id
      AND lower(i.name) = lower(v.name)
  );
