-- Growth phase: generous free limits so early sellers never hit a wall.
-- Pro-only features (featuring, analytics) stay off for free plans; flip a row here when monetising.
update public.plan_limits set max_active_listings = 50, max_images = 6 where plan = 'free' and account_type = 'individual';
update public.plan_limits set max_active_listings = 100, max_images = 8 where plan = 'free' and account_type = 'business';
