-- ══════════════════════════════════════════════════════════
-- Coach Stats — Subscriptions Table
-- Run this once in your Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Create the subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'trialing',
    -- trialing | active | expired | canceled | past_due
  trial_end               TIMESTAMPTZ,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id)
);

-- 2. Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Row Level Security — users can only read their own row
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Service role bypass (needed for webhook updates)
-- The webhook uses SUPABASE_SERVICE_KEY which bypasses RLS automatically.
-- No additional policy needed.

-- 5. Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);

-- ══════════════════════════════════════════════════════════
-- Verification query — run after creating the table
-- ══════════════════════════════════════════════════════════
-- SELECT * FROM public.subscriptions LIMIT 5;
