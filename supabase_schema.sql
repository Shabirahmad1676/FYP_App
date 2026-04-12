insert into public.campaigns
  (
    billboard_id,
    business_name,
    business_logo_url,
    title,
    offer_text,
    description,
    media_url,
    media_type,
    start_date,
    end_date,
    is_active
  )
values
  (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'Tandoori Nights',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=100&h=100&fit=crop',
    'Friday Special — Unlimited Karahi',
    'Unlimited Mutton Karahi for Rs. 1200 per head every Friday',
    'Join us every Friday evening for our famous unlimited Mutton Karahi night. Fresh ingredients, traditional recipe, unlimited servings. Valid for dine-in only.',
    'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'video',
    now(),
    now() + interval '30 days',
    true
  ),
  (
    'a1b2c3d4-0002-0002-0002-000000000002',
    'Pizza Point Mardan',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=100&h=100&fit=crop',
    'Buy 1 Get 1 Free — All Pizzas',
    'Buy any large pizza and get a medium pizza absolutely free today',
    'Valid on all large pizzas. Choose from Chicken Tikka, BBQ Chicken, Veggie Supreme, and Margarita. Free pizza must be of equal or lesser value.',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=400&fit=crop',
    'image',
    now(),
    now() + interval '7 days',
    true
  ),
  (
    'a1b2c3d4-0003-0003-0003-000000000003',
    'Mardan Sweets & Bakers',
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=100&h=100&fit=crop',
    'Eid Collection 2025 — Fresh Daily',
    '20% off on all Eid sweets and special gift boxes this week',
    'Celebrate Eid with our handcrafted sweets made fresh every morning. Special Eid gift boxes available in 3 sizes. Free delivery within Mardan on orders above Rs. 500.',
    'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'video',
    now(),
    now() + interval '14 days',
    true
  ),
  (
    'a1b2c3d4-0004-0004-0004-000000000004',
    'Khyber Karahi House',
    'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=100&h=100&fit=crop',
    'Lunch Deal — Karahi + Naan + Drink',
    'Complete lunch deal for only Rs. 450 — Karahi, 2 Naan, and cold drink included',
    'Available Monday to Saturday 12pm to 4pm only. Choose from Chicken Karahi, Beef Karahi, or Mixed Karahi. Includes 2 fresh naan and one 500ml cold drink.',
    'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&h=400&fit=crop',
    'image',
    now(),
    now() + interval '60 days',
    true
  ),
  (
    'a1b2c3d4-0005-0005-0005-000000000005',
    'CafeSon Coffee',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=100&h=100&fit=crop',
    'Student Deal — Coffee + Snack Combo',
    'Show your student ID and get coffee + any snack for Rs. 250 only',
    'Valid for all university and college students with valid ID. Choose any hot or cold coffee drink plus one snack from our menu. Free WiFi included.',
    'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'video',
    now(),
    now() + interval '90 days',
    true
  );