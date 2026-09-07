-- Default global exercise library (user_id = NULL)
INSERT INTO exercises (id, user_id, name, category, muscle_group) VALUES
    ('ex_bench_press', NULL, 'Bench Press', 'strength', 'chest'),
    ('ex_squat', NULL, 'Squat', 'strength', 'legs'),
    ('ex_deadlift', NULL, 'Deadlift', 'strength', 'back'),
    ('ex_overhead_press', NULL, 'Overhead Press', 'strength', 'shoulders'),
    ('ex_pull_up', NULL, 'Pull Up', 'strength', 'back'),
    ('ex_barbell_row', NULL, 'Barbell Row', 'strength', 'back'),
    ('ex_bicep_curl', NULL, 'Bicep Curl', 'strength', 'arms'),
    ('ex_tricep_dip', NULL, 'Tricep Dip', 'strength', 'arms'),
    ('ex_plank', NULL, 'Plank', 'core', 'core'),
    ('ex_running', NULL, 'Running', 'cardio', 'full_body'),
    ('ex_cycling', NULL, 'Cycling', 'cardio', 'legs'),
    ('ex_jump_rope', NULL, 'Jump Rope', 'cardio', 'full_body');

-- Default global expense categories (user_id = NULL)
INSERT INTO expense_categories (id, user_id, name, kind, icon) VALUES
    ('cat_salary', NULL, 'Salary', 'income', 'wallet'),
    ('cat_freelance', NULL, 'Freelance', 'income', 'briefcase'),
    ('cat_other_income', NULL, 'Other Income', 'income', 'plus-circle'),
    ('cat_groceries', NULL, 'Groceries', 'expense', 'shopping-cart'),
    ('cat_rent', NULL, 'Rent', 'expense', 'home'),
    ('cat_gym', NULL, 'Gym & Fitness', 'expense', 'dumbbell'),
    ('cat_supplements', NULL, 'Supplements', 'expense', 'pill'),
    ('cat_dining', NULL, 'Dining Out', 'expense', 'utensils'),
    ('cat_transport', NULL, 'Transport', 'expense', 'car'),
    ('cat_utilities', NULL, 'Utilities', 'expense', 'zap'),
    ('cat_entertainment', NULL, 'Entertainment', 'expense', 'film'),
    ('cat_health', NULL, 'Health & Medical', 'expense', 'heart-pulse'),
    ('cat_shopping', NULL, 'Shopping', 'expense', 'shopping-bag'),
    ('cat_other_expense', NULL, 'Other', 'expense', 'more-horizontal');

-- Default global food library (small starter set; user_id = NULL)
INSERT INTO foods (id, user_id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g) VALUES
    ('food_chicken_breast', NULL, 'Chicken Breast (cooked)', 165, 31, 0, 3.6),
    ('food_egg', NULL, 'Egg (whole)', 155, 13, 1.1, 11),
    ('food_rice_white', NULL, 'White Rice (cooked)', 130, 2.7, 28, 0.3),
    ('food_oats', NULL, 'Oats (dry)', 389, 16.9, 66, 6.9),
    ('food_banana', NULL, 'Banana', 89, 1.1, 23, 0.3),
    ('food_paneer', NULL, 'Paneer', 265, 18, 1.2, 20.8),
    ('food_dal', NULL, 'Dal (cooked)', 116, 9, 20, 0.4),
    ('food_roti', NULL, 'Roti (whole wheat)', 297, 11, 61, 3.7),
    ('food_milk', NULL, 'Milk (whole)', 61, 3.2, 4.8, 3.3),
    ('food_almonds', NULL, 'Almonds', 579, 21, 22, 50);
