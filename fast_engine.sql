-- WORLD'S FASTEST SAVING ENGINE (v1.1)
-- Added balance check skip for Admin role.

CREATE OR REPLACE FUNCTION buy_tickets_bulk(
    p_user_id UUID,
    p_game_id UUID,
    p_tickets JSONB,
    p_cost NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_draw_id UUID;
    v_today DATE := CURRENT_DATE;
    v_user_bal NUMERIC;
    v_user_role TEXT;
    v_admin_id UUID;
    v_admin_limits RECORD;
    v_user_limits RECORD;
    v_item RECORD;
    v_sold_count INT;
    v_max_limit INT;
    v_hold_val INT;
    v_is_admin BOOLEAN;
    v_bill_no BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
BEGIN
    -- 1. Get Draw (or create)
    SELECT id INTO v_draw_id FROM daily_draws WHERE schedule_id = p_game_id AND draw_date = v_today;
    IF v_draw_id IS NULL THEN
        INSERT INTO daily_draws (schedule_id, draw_date) VALUES (p_game_id, v_today) RETURNING id INTO v_draw_id;
    END IF;

    -- 2. Check Balance (Skip for Admin)
    SELECT balance, role INTO v_user_bal, v_user_role FROM users WHERE id = p_user_id FOR UPDATE;
    
    IF v_user_role <> 'admin' THEN
        IF v_user_bal < p_cost THEN
            RETURN jsonb_build_object('error', 'Insufficient balance. Need ' || p_cost || ', have ' || v_user_bal);
        END IF;
    END IF;

    -- 3. Get Limits
    SELECT id INTO v_admin_id FROM users WHERE role = 'admin' LIMIT 1;
    SELECT * INTO v_admin_limits FROM user_limits WHERE user_id = v_admin_id;
    SELECT * INTO v_user_limits FROM user_limits WHERE user_id = p_user_id;
    v_is_admin := (p_user_id = v_admin_id);

    -- 4. Validate Each Ticket Batch in JSON
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_tickets) AS x(number TEXT, type TEXT, count INT)
    LOOP
        -- A. Calculate Main Limit (Admin's Global Setting)
        v_max_limit := 1000; -- Default
        IF v_item.type LIKE '%single%' THEN v_max_limit := COALESCE(v_admin_limits.max_single_number_count, 1000);
        ELSIF v_item.type LIKE '%double%' THEN v_max_limit := COALESCE(v_admin_limits.max_double_number_count, 500);
        ELSIF v_item.type = 'triple_straight' THEN v_max_limit := COALESCE(v_admin_limits.max_triple_straight_count, 50);
        ELSIF v_item.type = 'triple_box' THEN v_max_limit := COALESCE(v_admin_limits.max_triple_box_count, 50);
        END IF;

        -- B. Apply Hold (If not admin)
        IF NOT v_is_admin THEN
            v_hold_val := 0;
            IF v_item.type LIKE '%single%' THEN v_hold_val := COALESCE(v_admin_limits.hold_single_number_count, 0);
            ELSIF v_item.type LIKE '%double%' THEN v_hold_val := COALESCE(v_admin_limits.hold_double_number_count, 0);
            ELSIF v_item.type = 'triple_straight' THEN v_hold_val := COALESCE(v_admin_limits.hold_triple_straight_count, 0);
            ELSIF v_item.type = 'triple_box' THEN v_hold_val := COALESCE(v_admin_limits.hold_triple_box_count, 0);
            END IF;
            v_max_limit := GREATEST(0, v_max_limit - v_hold_val);
        END IF;

        -- C. Check against DB
        SELECT COALESCE(SUM(count), 0) INTO v_sold_count FROM tickets 
        WHERE draw_id = v_draw_id AND ticket_number = v_item.number AND ticket_type = v_item.type AND status = 'active';

        IF (v_sold_count + v_item.count) > v_max_limit THEN
            RETURN jsonb_build_object('error', 'Limit Exceeded for ' || v_item.number || ' (' || v_item.type || '). Limit: ' || v_max_limit);
        END IF;
    END LOOP;

    -- 5. If all passed, perform Action
    -- Insert tickets
    INSERT INTO tickets (draw_id, user_id, ticket_number, ticket_type, count, cost_per_unit, bill_number)
    SELECT v_draw_id, p_user_id, x.number, x.type, x.count, (p_cost / (SELECT SUM(count) FROM jsonb_to_recordset(p_tickets) AS y(count INT))), v_bill_no
    FROM jsonb_to_recordset(p_tickets) AS x(number TEXT, type TEXT, count INT);

    -- Deduct Balance (Skip for Admin)
    IF v_user_role <> 'admin' THEN
        UPDATE users SET balance = balance - p_cost WHERE id = p_user_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'bill_number', v_bill_no);
END;
$$ LANGUAGE plpgsql;
