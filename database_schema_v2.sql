
-- 1. ENUMS and TYPES
CREATE TYPE user_role AS ENUM ('admin', 'main_agent', 'sub_agent', 'stockist', 'user');
CREATE TYPE ticket_type AS ENUM ('single', 'double', 'triple', 'quad');
CREATE TYPE ticket_status AS ENUM ('active', 'won', 'lost', 'cancelled');

-- 2. USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    parent_id INT REFERENCES users(id),
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. GAME SCHEDULES
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    draw_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    open_time TIME,
    close_time TIME,
    fill_time TIME,
    deletion_time TIME
);

-- 4. DAILY DRAWS
CREATE TABLE daily_draws (
    id SERIAL PRIMARY KEY,
    schedule_id INT REFERENCES game_schedules(id),
    draw_date DATE DEFAULT CURRENT_DATE,
    result_value VARCHAR(4),
    is_declared BOOLEAN DEFAULT FALSE
);

-- 5. TICKETS
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    draw_id INT REFERENCES daily_draws(id),
    user_id INT REFERENCES users(id),
    ticket_number VARCHAR(4) NOT NULL,
    ticket_type ticket_type NOT NULL,
    count INT NOT NULL DEFAULT 1,
    cost_per_unit DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (count * cost_per_unit) STORED,
    status ticket_status DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Insert Default Games (UPDATED NAMES)
INSERT INTO game_schedules (name, draw_time) VALUES 
('LSK 3.00PM', '15:00'),
('DEAR-1 PM', '13:00'),
('DEAR-6PM', '18:00'),
('DEAR-8PM', '20:00');

-- 7. Insert Dummy User (for testing)
INSERT INTO users (username, password_hash, role, balance) 
VALUES ('demo_agent', 'hashed_pass', 'sub_agent', 10000.00);

-- 8. Enable RLS (Security) but allow all for now (for easy testing)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for now" ON tickets FOR ALL USING (true);


-- 9. USER LIMITS
CREATE TABLE user_limits (
    user_id INT PRIMARY KEY REFERENCES users(id),
    daily_sales_limit DECIMAL(15, 2),
    weekly_sales_limit DECIMAL(15, 2),
    max_single_number_count INT,
    blocked_numbers TEXT, -- Comma separated list of blocked numbers
    special_number_limits JSONB DEFAULT '{}'::jsonb, -- {"786": 10}
    type_limits JSONB DEFAULT '{}'::jsonb, -- {"single": 100, "double": 50, "box": 50}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. SCHEMES
CREATE TABLE schemes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)
);

-- 11. SCHEME RATES
CREATE TABLE scheme_rates (
    id SERIAL PRIMARY KEY,
    scheme_id INT REFERENCES schemes(id),
    ticket_type VARCHAR(50),
    buy_rate DECIMAL(10, 2),
    sell_rate DECIMAL(10, 2),
    UNIQUE(scheme_id, ticket_type)
);

-- 12. Add scheme link to users
ALTER TABLE users ADD COLUMN scheme_id INT REFERENCES schemes(id);
