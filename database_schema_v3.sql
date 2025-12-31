-- DATABASE SCHEMA V3 (Production Ready)
-- Covers: Recursive Hierarchy, Rates/Schemes, Risk Limits, Complex Prizes

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'main_agent', 'sub_agent', 'stockist', 'user');
-- ticket_type: 'single' (1 digit), 'double' (2 digits), 'triple_straight' (3 digits exact), 'triple_box' (3 digits any order)
CREATE TYPE ticket_type AS ENUM ('single', 'double', 'triple_straight', 'triple_box');
CREATE TYPE ticket_status AS ENUM ('active', 'won', 'lost', 'cancelled');
CREATE TYPE limit_period AS ENUM ('daily', 'weekly');

-- 2. USERS (Hierarchy & Auth)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Secure password storage
    role user_role NOT NULL,
    parent_id INT REFERENCES users(id), -- Recursive hierarchy (Admin -> Main -> Sub -> Stockist -> User)
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. FINANCIAL SCHEMES (Rates & Commissions)
-- Each user is assigned a scheme which dictates their buy rate and commission
CREATE TABLE schemes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- e.g. "Standard Agent Scheme", "VIP User Scheme"
    created_by INT REFERENCES users(id), -- Who created this scheme (Admin/Main Agent)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Defines rates for each ticket type within a scheme
CREATE TABLE scheme_rates (
    id SERIAL PRIMARY KEY,
    scheme_id INT REFERENCES schemes(id) ON DELETE CASCADE,
    ticket_type ticket_type NOT NULL,
    buy_rate DECIMAL(10, 2) NOT NULL, -- Cost to buy 1 unit (e.g. 10.00)
    commission_percent DECIMAL(5, 2) DEFAULT 0.00, -- Commission % given to this user
    UNIQUE(scheme_id, ticket_type)
);

-- Link Users to Schemes
ALTER TABLE users ADD COLUMN scheme_id INT REFERENCES schemes(id);

-- 4. RISK MANAGEMENT (Limits)
CREATE TABLE user_limits (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sales Limits
    daily_sales_limit DECIMAL(15, 2) DEFAULT 10000.00,
    weekly_sales_limit DECIMAL(15, 2) DEFAULT 70000.00,
    
    -- Number Limits (Risk Control)
    -- e.g. "Cannot sell more than 50 of '123' straight"
    max_single_number_count INT DEFAULT 100, -- Limit for 1 digit
    max_double_number_count INT DEFAULT 50,  -- Limit for 2 digits
    max_triple_number_count INT DEFAULT 20,  -- Limit for 3 digits (straight/box)
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. GAME CONFIGURATION
CREATE TABLE game_schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- 'LSK 3.00PM', 'DEAR 1.00PM'
    draw_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Prize Structure linked to Games
-- Defines "1st Prize", "2nd Box", "6th Prize" etc.
CREATE TABLE prize_definitions (
    id SERIAL PRIMARY KEY,
    schedule_id INT REFERENCES game_schedules(id),
    
    rank_name VARCHAR(50) NOT NULL, -- '1st Prize', '1st Box', '2nd Prize', '6th Prize'
    ticket_type ticket_type NOT NULL, -- Applies to which ticket type?
    
    -- Logic Type: 
    -- 'EXACT': Match typically for Straight
    -- 'ANY_ORDER': Match typically for Box
    -- 'LAST_2': Match last 2 digits (e.g. for Single/Double prizes derived from Triple)
    match_logic VARCHAR(20) DEFAULT 'EXACT', 
    
    winning_amount DECIMAL(12, 2) NOT NULL, -- e.g. 5000, 3000
    commission_amount DECIMAL(12, 2) DEFAULT 0.00, -- Commission on winning (e.g. +400)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. DAILY OPERATION
CREATE TABLE daily_draws (
    id SERIAL PRIMARY KEY,
    schedule_id INT REFERENCES game_schedules(id),
    draw_date DATE DEFAULT CURRENT_DATE,
    
    -- The Main Result Number (e.g. '123')
    result_number VARCHAR(4),
    
    -- Setup for multiple results (like 6th prize having 30 numbers)
    -- We can store extra results in a JSONB array or a separate table.
    -- For simplicity/flexibility, JSONB is good for "list of 30 numbers".
    extra_results JSONB DEFAULT '[]'::jsonb, 
    
    is_declared BOOLEAN DEFAULT FALSE,
    declared_at TIMESTAMP
);

-- 7. TICKETS (Modified)
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    draw_id INT REFERENCES daily_draws(id),
    user_id INT REFERENCES users(id),
    
    ticket_number VARCHAR(4) NOT NULL,
    ticket_type ticket_type NOT NULL,
    count INT NOT NULL DEFAULT 1,
    
    -- Snapshot cost at time of purchase
    cost_per_unit DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (count * cost_per_unit) STORED,
    
    status ticket_status DEFAULT 'active',
    
    -- If won
    winning_amount DECIMAL(12, 2) DEFAULT 0.00,
    winning_tax_commission DECIMAL(12, 2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- DATA SEEDING (Example)

-- 1. Create Game
INSERT INTO game_schedules (name, draw_time) VALUES ('DEAR 1.00PM', '13:00');

-- 2. Define Prizes for "DEAR 1.00PM" (ID 1)
-- 1st Straight (5000 + 400)
INSERT INTO prize_definitions (schedule_id, rank_name, ticket_type, match_logic, winning_amount, commission_amount)
VALUES (1, '1st Straight', 'triple_straight', 'EXACT', 5000.00, 400.00);

-- 1st Box (3000 + comm)
INSERT INTO prize_definitions (schedule_id, rank_name, ticket_type, match_logic, winning_amount, commission_amount)
VALUES (1, '1st Box', 'triple_box', 'ANY_ORDER', 3000.00, 200.00);

-- 2nd Straight (500 + comm)
INSERT INTO prize_definitions (schedule_id, rank_name, ticket_type, match_logic, winning_amount, commission_amount)
VALUES (1, '2nd Straight', 'triple_straight', 'EXACT', 500.00, 50.00);

-- Single Digit (Last digit match 100)
INSERT INTO prize_definitions (schedule_id, rank_name, ticket_type, match_logic, winning_amount, commission_amount)
VALUES (1, 'Single Prize', 'single', 'LAST_1', 100.00, 0.00);

-- 3. Create Admin User
INSERT INTO users (username, password_hash, role, balance)
VALUES ('admin', 'hashed_secret', 'admin', 1000000.00);

-- 4. Create "Main Agent Scheme"
INSERT INTO schemes (name, created_by) VALUES ('Default Main Agent', 1);
INSERT INTO scheme_rates (scheme_id, ticket_type, buy_rate, commission_percent) VALUES
(1, 'triple_straight', 11.00, 5.0),
(1, 'triple_box', 10.00, 5.0),
(1, 'single', 10.00, 0.0);

-- 5. Create Main Agent User (linked to Admin, using Scheme 1)
INSERT INTO users (username, password_hash, role, parent_id, scheme_id, balance)
VALUES ('main_agent_1', 'pass123', 'main_agent', 1, 1, 50000.00);

-- 6. Setup Limits for Main Agent
INSERT INTO user_limits (user_id, daily_sales_limit, max_triple_number_count)
VALUES (1, 20000.00, 50);

-- RLS (Open for now)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All Access" ON tickets FOR ALL USING (true);
