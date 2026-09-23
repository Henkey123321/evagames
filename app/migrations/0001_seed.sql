-- Seed: the two games from the original site as presets, footer links, hub copy.
-- Preset configs are '{}' so they pick up the plugin defaults (which match the original games).

INSERT INTO `game_presets` (`id`, `slug`, `type`, `title`, `instructions`, `config`, `visibility`, `hub_state`, `hub_order`, `hub_label`, `art_left`, `art_right`)
VALUES
	('preset-2048', '2048', '2048', '2048',
		'Slide the room with arrow keys, WASD, or a swipe. Matching tiles merge. Reach 2048 and the game ends.',
		'{}', 'public', 'available', 1, 'Play', '/games/2048/body-left.png', '/games/2048/body-right.png'),
	('preset-memory', 'memory', 'memory', 'Memory',
		'Turn over two cards. Keep the pair, remember the room, clear the board with as few moves as possible.',
		'{}', 'public', 'available', 2, 'Play', '/games/memory/body-left.png', '/games/memory/body-right.png');
--> statement-breakpoint
INSERT INTO `footer_links` (`id`, `label`, `url`, `icon`, `group`, `extra_class`, `sort_order`)
VALUES
	('fl-iwantclips', 'IWantClips', 'https://iwantclips.com/store/174442/Eva-de-Vil', '/icons/iwantclips.svg', 'store', 'footer-link-iwc', 1),
	('fl-onlyfans', 'OnlyFans', 'https://onlyfans.com/evadevil', '/icons/onlyfans.svg', 'store', 'footer-link-wide', 2),
	('fl-clips4sale', 'Clips4Sale', 'https://www.clips4sale.com/studio/122965/eva-de-vil', '/icons/clips4sale.svg', 'store', 'footer-link-wide', 3),
	('fl-loyalfans', 'LoyalFans', 'https://www.loyalfans.com/theevadevil', '/icons/loyalfans.svg', 'store', 'footer-link-wide', 4),
	('fl-bluesky', 'Bluesky', 'https://bsky.app/profile/theevadevil.bsky.social', '/icons/bluesky.svg', 'social', '', 5),
	('fl-reddit', 'Reddit', 'https://www.reddit.com/r/EvaDeVil/', '/icons/reddit.svg', 'social', '', 6),
	('fl-x', 'X.com', 'https://x.com/TheEvaDeVil', '/icons/x.svg', 'social', '', 7),
	('fl-instagram', 'Instagram', 'https://www.instagram.com/evadevilgoddess', '/icons/instagram.svg', 'social', '', 8);
