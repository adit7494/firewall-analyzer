-- Multi-Framework Support (Crosswalk Architecture) Migration
-- Defines tables for frameworks, framework controls, crosswalk mappings, and audit result snapshots.

create table if not exists frameworks (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- "CIS", "NIST_CSF", "NIST_800_41", "ISO_27001", "PCI_DSS", "CTM"
  name          text not null,                 -- e.g. "NIST Cybersecurity Framework 2.0"
  version       text,
  description   text,
  is_technical  boolean default false,         -- true=CIS (granular), false=governance/outcome-based
  active        boolean default true,
  created_at    timestamptz default now()
);

create table if not exists framework_controls (
  id             uuid primary key default gen_random_uuid(),
  framework_id   uuid not null references frameworks(id) on delete cascade,
  control_code   text not null,                -- e.g. "PR.AA-01", "A.8.20", "Req 1.2.1"
  title          text not null,
  category       text,                         -- function/domain: "Protect", "Access Control", etc.
  description    text,
  coverage_type  text not null default 'manual', -- 'automated' | 'partial' | 'manual' | 'not_covered'
  guidance       text,                         -- auditor instructions for manual/partial verification
  created_at     timestamptz default now(),
  unique (framework_id, control_code)
);

create table if not exists control_rule_mappings (
  id                   uuid primary key default gen_random_uuid(),
  framework_control_id uuid not null references framework_controls(id) on delete cascade,
  rule_code            text not null,           -- reference to rules.code (e.g. "2.4.4", "1.1")
  rule_vendor          text not null default 'fortigate',
  mapping_strength     text default 'full',     -- 'full' | 'partial'
  note                 text,
  created_at           timestamptz default now(),
  unique (framework_control_id, rule_code, rule_vendor)
);

create table if not exists audit_framework_results (
  id                   uuid primary key default gen_random_uuid(),
  audit_id             uuid not null references audits(id) on delete cascade,
  framework_id         uuid not null references frameworks(id),
  score                numeric,                 -- compliance score (0-100) over assessable controls
  covered_controls     int,                     -- number of automated + partial controls
  total_controls       int,
  coverage_percent     numeric,                 -- covered / total * 100
  breakdown_json       jsonb default '{}'::jsonb,
  created_at           timestamptz default now(),
  unique (audit_id, framework_id)
);
