-- Accent- and case-insensitive full-text search over food names, aliases and brand (FR-022).
CREATE VIRTUAL TABLE `food_search` USING fts5(
	food_id UNINDEXED,
	name_es,
	name_en,
	aliases,
	brand,
	tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `food_search_ai` AFTER INSERT ON `food` BEGIN
	INSERT INTO food_search (food_id, name_es, name_en, aliases, brand)
	VALUES (new.id, new.name_es, coalesce(new.name_en, ''),
		coalesce((SELECT group_concat(alias, ' ') FROM food_alias WHERE food_id = new.id), ''),
		coalesce(new.brand, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `food_search_au` AFTER UPDATE OF name_es, name_en, brand ON `food` BEGIN
	DELETE FROM food_search WHERE food_id = old.id;
	INSERT INTO food_search (food_id, name_es, name_en, aliases, brand)
	VALUES (new.id, new.name_es, coalesce(new.name_en, ''),
		coalesce((SELECT group_concat(alias, ' ') FROM food_alias WHERE food_id = new.id), ''),
		coalesce(new.brand, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `food_search_ad` AFTER DELETE ON `food` BEGIN
	DELETE FROM food_search WHERE food_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER `food_alias_ai` AFTER INSERT ON `food_alias` BEGIN
	UPDATE food_search
	SET aliases = coalesce((SELECT group_concat(alias, ' ') FROM food_alias WHERE food_id = new.food_id), '')
	WHERE food_id = new.food_id;
END;
--> statement-breakpoint
CREATE TRIGGER `food_alias_ad` AFTER DELETE ON `food_alias` BEGIN
	UPDATE food_search
	SET aliases = coalesce((SELECT group_concat(alias, ' ') FROM food_alias WHERE food_id = old.food_id), '')
	WHERE food_id = old.food_id;
END;
