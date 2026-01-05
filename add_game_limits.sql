-- Add limit columns to game_schedules table
ALTER TABLE game_schedules
ADD COLUMN max_single_limit INT DEFAULT 1000,
ADD COLUMN max_double_limit INT DEFAULT 500,
ADD COLUMN max_triple_straight_limit INT DEFAULT 50,
ADD COLUMN max_triple_box_limit INT DEFAULT 50,
ADD COLUMN hold_single_limit INT DEFAULT 250,
ADD COLUMN hold_double_limit INT DEFAULT 100,
ADD COLUMN hold_triple_straight_limit INT DEFAULT 20,
ADD COLUMN hold_triple_box_limit INT DEFAULT 20;
