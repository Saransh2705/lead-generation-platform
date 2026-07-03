-- Custom categories can have any key; the original CHECK limited leads.category
-- to the 5 built-ins and rejected custom-category inserts. The `categories`
-- table is the source of truth now, so drop the constraint.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_category_check;
