-- Seed data: imports the current hardcoded Eva Games site into the database.
-- Run once after initial migration.

-- Site config
INSERT OR IGNORE INTO site_config (key, value) VALUES ('site_title', 'Eva Games | Eva de Vil');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('meta_description', 'A simple Eva de Vil games hub with 2048, Memory, and future game placeholders.');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('canonical_url', 'https://evagames.org/');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('theme_color', '#FFE0F6');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('og_title', 'Eva Games | Eva de Vil');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('og_description', 'A simple Eva de Vil games hub.');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('brand_text', 'Eva Games');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('brand_link', 'https://evagames.org/');

-- Games
INSERT OR IGNORE INTO games (slug, template_id, title, tile_number, status, status_label, sort_order)
VALUES ('2048', '2048', '2048', '01', 'available', 'Play', 1);

INSERT OR IGNORE INTO games (slug, template_id, title, tile_number, status, status_label, sort_order)
VALUES ('memory', 'memory', 'Memory', '02', 'available', 'Play', 2);

INSERT OR IGNORE INTO games (slug, template_id, title, tile_number, status, status_label, sort_order, tile_css_class)
VALUES ('coming-soon', '2048', 'More coming soon', '03', 'reserved', 'Reserved', 3, 'game-tile-wide');

-- 2048 settings
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'board_size', '4');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'win_value', '2048');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'four_spawn_chance', '0.1');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'move_duration_ms', '100');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'bg_toggle_default', 'true');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'instructions', '"Slide the room with arrow keys, WASD, or a swipe. Matching tiles merge. Reach 2048 and the game ends."');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'win_message', '"2048"');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'win_copy', '"The room is complete."');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'lose_message', '"Game over"');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (1, 'lose_copy', '"No more moves."');

-- Memory settings
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (2, 'pairs', '8');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (2, 'flip_back_delay_ms', '760');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (2, 'card_back_text', '"E"');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (2, 'instructions', '"Turn over two cards. Keep the pair, remember the room, clear the board with as few moves as possible."');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (2, 'win_message', '"Cleared"');
INSERT OR IGNORE INTO game_settings (game_id, setting_key, setting_value) VALUES (2, 'win_copy', '"The room is yours."');

-- Design tokens
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-pink', 'oklch(93.849% 0.0444 336.32)', 'palette', 'Eva Pink');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-red', 'oklch(34.318% 0.13946 25.95)', 'palette', 'Eva Red');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-red-dark', 'oklch(21.501% 0.08675 22.79)', 'palette', 'Eva Red Dark');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-blush', 'oklch(86.531% 0.03854 13.9)', 'palette', 'Eva Blush');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-rose', 'oklch(64.512% 0.07793 13.13)', 'palette', 'Eva Rose');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-mauve', 'oklch(60.096% 0.05978 13.37)', 'palette', 'Eva Mauve');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-bg', 'oklch(28.804% 0.02431 14.52)', 'palette', 'Eva Background');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-black', 'oklch(30.221% 0.00143 17.24)', 'palette', 'Eva Black');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('eva-white', 'oklch(100.000% 0 89.88)', 'palette', 'Eva White');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('ink', 'var(--eva-red)', 'semantic', 'Primary Ink');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('ink-soft', 'oklch(42% 0.071 18)', 'semantic', 'Soft Ink');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('field', 'oklch(80.94% 0.052 15.15)', 'semantic', 'Field Background');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('panel', 'oklch(93% 0.029 336)', 'semantic', 'Panel');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('panel-muted', 'oklch(86% 0.042 15)', 'semantic', 'Muted Panel');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('line', 'oklch(42% 0.09 20 / 0.42)', 'semantic', 'Line/Border');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('footer-adult', 'var(--eva-black)', 'semantic', 'Footer Adult BG');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('footer-social', 'oklch(98% 0.006 336)', 'semantic', 'Footer Social BG');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('footer-social-field', 'var(--eva-red-dark)', 'semantic', 'Footer Social Field');
INSERT OR IGNORE INTO design_tokens (token_name, token_value, category, label) VALUES ('focus-ring', '0 0 0 0.22rem oklch(34.318% 0.13946 25.95 / 0.28)', 'semantic', 'Focus Ring');

-- Footer links: stores
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, extra_css_class, sort_order)
VALUES ('IWantClips', 'https://iwantclips.com/store/174442/Eva-de-Vil', 'iwantclips.svg', 'store', 'footer-link-iwc', 1);
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, extra_css_class, sort_order)
VALUES ('OnlyFans', 'https://onlyfans.com/evadevil', 'onlyfans.svg', 'store', 'footer-link-wide', 2);
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, extra_css_class, sort_order)
VALUES ('Clips4Sale', 'https://www.clips4sale.com/studio/122965/eva-de-vil', 'clips4sale.svg', 'store', 'footer-link-wide', 3);
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, extra_css_class, sort_order)
VALUES ('LoyalFans', 'https://www.loyalfans.com/theevadevil', 'loyalfans.svg', 'store', 'footer-link-wide', 4);

-- Footer links: socials
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, sort_order)
VALUES ('Bluesky', 'https://bsky.app/profile/theevadevil.bsky.social', 'bluesky.svg', 'social', 1);
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, sort_order)
VALUES ('Reddit', 'https://www.reddit.com/r/EvaDeVil/', 'reddit.svg', 'social', 2);
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, sort_order)
VALUES ('X.com', 'https://x.com/TheEvaDeVil', 'x.svg', 'social', 3);
INSERT OR IGNORE INTO footer_links (label, url, icon_filename, group_name, sort_order)
VALUES ('Instagram', 'https://www.instagram.com/evadevilgoddess', 'instagram.svg', 'social', 4);

-- Body art
INSERT OR IGNORE INTO body_art (page_ref, position, image_filename) VALUES ('home', 'left', 'body-left.png');
INSERT OR IGNORE INTO body_art (page_ref, position, image_filename) VALUES ('home', 'right', 'body-right.png');
INSERT OR IGNORE INTO body_art (page_ref, position, image_filename) VALUES ('2048', 'left', 'body-left.png');
INSERT OR IGNORE INTO body_art (page_ref, position, image_filename) VALUES ('2048', 'right', 'body-right.png');
INSERT OR IGNORE INTO body_art (page_ref, position, image_filename) VALUES ('memory', 'left', 'body-left.png');
INSERT OR IGNORE INTO body_art (page_ref, position, image_filename) VALUES ('memory', 'right', 'body-right.png');

-- Mark initial seed as published so dashboard starts clean
UPDATE publish_status SET last_published_at = last_modified_at WHERE id = 1;
