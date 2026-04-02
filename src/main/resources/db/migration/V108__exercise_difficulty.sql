-- Replace numeric progression_rank with a difficulty level
ALTER TABLE exercise DROP COLUMN progression_rank;
ALTER TABLE exercise ADD COLUMN difficulty VARCHAR(20) NOT NULL DEFAULT 'INTERMEDIATE';
