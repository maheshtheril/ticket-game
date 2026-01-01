
ALTER TABLE game_schedules ADD COLUMN IF NOT EXISTS open_time TIME;
ALTER TABLE game_schedules ADD COLUMN IF NOT EXISTS close_time TIME;
ALTER TABLE game_schedules ADD COLUMN IF NOT EXISTS fill_time TIME;
ALTER TABLE game_schedules ADD COLUMN IF NOT EXISTS deletion_time TIME;
