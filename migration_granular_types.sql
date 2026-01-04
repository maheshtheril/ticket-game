-- MIGRATION: Support Granular Ticket Types
-- This is required to support A/B/C and AB/AC/BC positions in the ticket game.
-- Run this in your Supabase SQL Editor.

-- 1. Add new values to the ENUM
ALTER TYPE ticket_type ADD VALUE IF NOT EXISTS 'single_a';
ALTER TYPE ticket_type ADD VALUE IF NOT EXISTS 'single_b';
ALTER TYPE ticket_type ADD VALUE IF NOT EXISTS 'single_c';
ALTER TYPE ticket_type ADD VALUE IF NOT EXISTS 'double_ab';
ALTER TYPE ticket_type ADD VALUE IF NOT EXISTS 'double_ac';
ALTER TYPE ticket_type ADD VALUE IF NOT EXISTS 'double_bc';

-- 2. (Optional) If you have existing 'single' or 'double' tickets that need conversion, 
-- you would updates them here, but for now we leave them as legacy 'single'/'double'.
