-- I4: profiles created before the pet system existed get their default cat.
INSERT INTO pet (profile_id, name, xp_total, max_xp_reached, stage, mood, mood_updated_date, treats, equipped_accessory_ids, created_at)
SELECT p.id, 'Michi', 0, 0, 'newborn', 70, substr(p.created_at, 1, 10), 0, '[]', p.created_at
FROM profile p
WHERE NOT EXISTS (SELECT 1 FROM pet WHERE pet.profile_id = p.id);
