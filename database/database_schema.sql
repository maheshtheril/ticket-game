-- Database Schema for TicketGame App
-- Engineered for High Performance, Security, and Hierarchical Logic

-- 1. ENUMS and TYPES
CREATE TYPE user_role AS ENUM ('admin', 'tenant', 'main_dealer', 'agent', 'stockist', 'user');
CREATE TYPE ticket_type AS ENUM ('single', 'double', 'triple', 'quad');
CREATE TYPE ticket_status AS ENUM ('active', 'won', 'lost', 'cancelled');

-- 2. USERS TABLE (Hierarchical)
-- Uses parent_id to establish the tree structure (Tenant -> Dealer -> Agent -> Stockist -> User)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    parent_id INT REFERENCES users(id),
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    commission_sales_pct DECIMAL(5, 2) DEFAULT 0.00, -- Commission % for this user on sales
    commission_win_pct DECIMAL(5, 2) DEFAULT 0.00,   -- Commission % for this user on winnings
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_balance_positive CHECK (balance >= 0)
);

CREATE INDEX idx_users_parent ON users(parent_id);
CREATE INDEX idx_users_role ON users(role);

-- 3. GAME SCHEDULE MASTER
-- Stores the 4 daily games configuration (e.g., "1 PM Draw")
CREATE TABLE game_schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- e.g., "DEAR 1 PM", "DEAR 6 PM"
    draw_time TIME NOT NULL,
    cutoff_minutes INT DEFAULT 2, -- Minutes before draw time to stop sales (e.g., 2 mins)
    is_active BOOLEAN DEFAULT TRUE
);

-- 3.1 GAME RATES CONFIGURATION (New Requirement)
-- Defines the pricing and winning logic for each Game + Ticket Type combination
CREATE TABLE game_rates (
    id SERIAL PRIMARY KEY,
    schedule_id INT REFERENCES game_schedules(id) ON DELETE CASCADE,
    ticket_type ticket_type NOT NULL, -- 'single', 'double', 'triple'
    ticket_price DECIMAL(10, 2) NOT NULL, -- Cost to buy one ticket
    winning_amount DECIMAL(12, 2) NOT NULL, -- Prize if won
    commission_sales_pct DECIMAL(5, 2) DEFAULT 0.00, -- Base commission for sales
    commission_win_pct DECIMAL(5, 2) DEFAULT 0.00,   -- Base commission for wins
    UNIQUE(schedule_id, ticket_type) -- Ensure one rate per type per game
);

-- 4. DAILY DRAWS
-- Specific instances of games for a specific calendar date
CREATE TABLE daily_draws (
    id SERIAL PRIMARY KEY,
    schedule_id INT REFERENCES game_schedules(id),
    draw_date DATE NOT NULL,
    actual_draw_time TIMESTAMP NOT NULL, -- Combined Date + Time
    nomination_start TIMESTAMP, -- When ticket buying starts
    nomination_end TIMESTAMP,   -- When ticket buying ends (hard stop)
    result_value VARCHAR(4),    -- The winning number (e.g., "123", "95")
    is_declared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_draws_date ON daily_draws(draw_date);
CREATE INDEX idx_draws_active ON daily_draws(nomination_start, nomination_end);

-- 5. HOLIDAYS
CREATE TABLE holidays (
    id SERIAL PRIMARY KEY,
    holiday_date DATE UNIQUE NOT NULL,
    description VARCHAR(100)
);

-- 6. TICKETS ( The Core Transaction Table )
-- Optimized for high volume inserts
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    draw_id INT REFERENCES daily_draws(id),
    user_id INT REFERENCES users(id), -- The customer/stockist placing the bet
    ticket_number VARCHAR(4) NOT NULL, -- "1", "12", "123", "1234"
    ticket_type ticket_type NOT NULL,
    count INT NOT NULL DEFAULT 1,
    cost_per_unit DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (count * cost_per_unit) STORED,
    potential_win DECIMAL(12, 2) DEFAULT 0,
    status ticket_status DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tickets_draw_user ON tickets(draw_id, user_id);
CREATE INDEX idx_tickets_number ON tickets(draw_id, ticket_number);

-- 7. TRANSACTION LEDGER
-- Immutable record of all money movement
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    amount DECIMAL(15, 2) NOT NULL, -- Negative for debit (buy), Positive for credit (win/deposit)
    type VARCHAR(20) NOT NULL, -- 'TICKET_BUY', 'WIN_PAYOUT', 'COMMISSION_SALES', 'DEPOSIT'
    reference_id BIGINT, -- Links to ticket_id or draw_id
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- STORED PROCEDURES (BUSINESS LOGIC)
-- ---------------------------------------------------------

-- SP: BUY TICKET
-- Handles validation, balance deduction, and ticket creation in a single Transaction
CREATE OR REPLACE FUNCTION sp_buy_ticket(
    p_user_id INT,
    p_draw_id INT,
    p_number VARCHAR,
    p_count INT,
    p_cost_per_unit DECIMAL
) RETURNS BIGINT AS $$
DECLARE
    v_total_cost DECIMAL;
    v_balance DECIMAL;
    v_end_time TIMESTAMP;
    v_new_ticket_id BIGINT;
BEGIN
    -- 1. Calculate Total Cost
    v_total_cost := p_count * p_cost_per_unit;

    -- 2. Validate Draw Timing
    SELECT nomination_end INTO v_end_time FROM daily_draws WHERE id = p_draw_id;
    IF NOW() > v_end_time THEN
        RAISE EXCEPTION 'Betting for this draw is closed.';
    END IF;

    -- 3. Validate Balance
    SELECT balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE; -- Lock row
    IF v_balance < v_total_cost THEN
        RAISE EXCEPTION 'Insufficient balance.';
    END IF;

    -- 4. Deduct Balance
    UPDATE users SET balance = balance - v_total_cost WHERE id = p_user_id;

    -- 5. Create Transaction Record
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (p_user_id, -v_total_cost, 'TICKET_BUY', 'Ticket purchase: ' || p_number);

    -- 6. Insert Ticket
    INSERT INTO tickets (draw_id, user_id, ticket_number, ticket_type, count, cost_per_unit)
    VALUES (
        p_draw_id, 
        p_user_id, 
        p_number, 
        CASE LENGTH(p_number) 
            WHEN 1 THEN 'single'::ticket_type 
            WHEN 2 THEN 'double'::ticket_type 
            WHEN 3 THEN 'triple'::ticket_type 
            ELSE 'quad'::ticket_type 
        END, 
        p_count, 
        p_cost_per_unit
    ) RETURNING id INTO v_new_ticket_id;

    RETURN v_new_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER: AUTOMATIC DRAW GENERATION (Simplified Concept)
-- This would typically be run by a cron job or scheduled task 
-- to populate 'daily_draws' based on 'game_schedules' and 'holidays'

