-- Migration: Add CABS Inspection Form Part-I fields to inspection_requests

-- Project/Subsystem/LRU linkage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='project_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='subsystem_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN subsystem_id INTEGER REFERENCES subsystems(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='lru_id') THEN
    ALTER TABLE inspection_requests ADD COLUMN lru_id INTEGER REFERENCES lrus(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Item classification fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='item_pertains_to') THEN
    ALTER TABLE inspection_requests ADD COLUMN item_pertains_to JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='test_type') THEN
    ALTER TABLE inspection_requests ADD COLUMN test_type JSONB;
  END IF;
END $$;

-- Supply order and source
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='so_details') THEN
    ALTER TABLE inspection_requests ADD COLUMN so_details TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='delivery_period') THEN
    ALTER TABLE inspection_requests ADD COLUMN delivery_period TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='source') THEN
    ALTER TABLE inspection_requests ADD COLUMN source VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='oem_name') THEN
    ALTER TABLE inspection_requests ADD COLUMN oem_name VARCHAR(255);
  END IF;
END $$;

-- LRU details
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='lru_nomenclature') THEN
    ALTER TABLE inspection_requests ADD COLUMN lru_nomenclature VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='criticality') THEN
    ALTER TABLE inspection_requests ADD COLUMN criticality JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='part_number') THEN
    ALTER TABLE inspection_requests ADD COLUMN part_number VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='serial_number') THEN
    ALTER TABLE inspection_requests ADD COLUMN serial_number VARCHAR(100);
  END IF;
END $$;

-- Quantity fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='quantity') THEN
    ALTER TABLE inspection_requests ADD COLUMN quantity INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='quantity_per_set') THEN
    ALTER TABLE inspection_requests ADD COLUMN quantity_per_set INTEGER;
  END IF;
END $$;

-- Stage and mode
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='previous_stage_cleared') THEN
    ALTER TABLE inspection_requests ADD COLUMN previous_stage_cleared TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='logbook_attached') THEN
    ALTER TABLE inspection_requests ADD COLUMN logbook_attached VARCHAR(10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='inspection_stage') THEN
    ALTER TABLE inspection_requests ADD COLUMN inspection_stage TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='inspection_mode') THEN
    ALTER TABLE inspection_requests ADD COLUMN inspection_mode VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='inspection_datetime') THEN
    ALTER TABLE inspection_requests ADD COLUMN inspection_datetime TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='venue') THEN
    ALTER TABLE inspection_requests ADD COLUMN venue VARCHAR(255);
  END IF;
END $$;

-- Document details (JSONB table: TS, SOP/MDI, QAP, etc.)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='document_details') THEN
    ALTER TABLE inspection_requests ADD COLUMN document_details JSONB;
  END IF;
END $$;

-- Confirmations (field 19 a-f)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='confirmations') THEN
    ALTER TABLE inspection_requests ADD COLUMN confirmations JSONB;
  END IF;
END $$;

-- Designer representative details (field 20)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='designer_rep_name') THEN
    ALTER TABLE inspection_requests ADD COLUMN designer_rep_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='designer_rep_designation') THEN
    ALTER TABLE inspection_requests ADD COLUMN designer_rep_designation VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='designer_rep_contact') THEN
    ALTER TABLE inspection_requests ADD COLUMN designer_rep_contact VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='design_coordinator_name') THEN
    ALTER TABLE inspection_requests ADD COLUMN design_coordinator_name VARCHAR(255);
  END IF;
END $$;

-- Certification (field 21)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='certified_by_name') THEN
    ALTER TABLE inspection_requests ADD COLUMN certified_by_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspection_requests' AND column_name='certified_by_designation') THEN
    ALTER TABLE inspection_requests ADD COLUMN certified_by_designation VARCHAR(255);
  END IF;
END $$;

-- Indexes for new FK columns
CREATE INDEX IF NOT EXISTS idx_inspection_requests_project ON inspection_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_subsystem ON inspection_requests(subsystem_id);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_lru ON inspection_requests(lru_id);
