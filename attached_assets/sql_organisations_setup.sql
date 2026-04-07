-- =====================================================
-- NCV Mail — Organisation / Team layer
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Organisations table
CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text DEFAULT 'business',
  seats_total integer DEFAULT 3,
  emails_quota integer DEFAULT 30000,
  emails_used integer DEFAULT 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- 2. Organisation members table
CREATE TABLE IF NOT EXISTS public.organisation_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);
ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;

-- 3. Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 4. Add organisation_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL;

-- 5. RLS Policies

-- Organisations: members can read their own org
CREATE POLICY "org_select_members" ON public.organisations
  FOR SELECT USING (
    id IN (SELECT organisation_id FROM public.organisation_members WHERE user_id = auth.uid())
  );

-- Organisations: admin can update
CREATE POLICY "org_update_admin" ON public.organisations
  FOR UPDATE USING (
    id IN (SELECT organisation_id FROM public.organisation_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Organisation members: members can read their org members
CREATE POLICY "members_select" ON public.organisation_members
  FOR SELECT USING (
    organisation_id IN (SELECT organisation_id FROM public.organisation_members AS om WHERE om.user_id = auth.uid())
  );

-- Organisation members: admin can insert/delete
CREATE POLICY "members_insert_admin" ON public.organisation_members
  FOR INSERT WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM public.organisation_members AS om WHERE om.user_id = auth.uid() AND om.role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.organisation_members AS om WHERE om.organisation_id = organisation_id)
  );

CREATE POLICY "members_delete_admin" ON public.organisation_members
  FOR DELETE USING (
    organisation_id IN (SELECT organisation_id FROM public.organisation_members AS om WHERE om.user_id = auth.uid() AND om.role = 'admin')
  );

-- Invitations: admin can manage
CREATE POLICY "invitations_select" ON public.invitations
  FOR SELECT USING (
    organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE user_id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "invitations_insert_admin" ON public.invitations
  FOR INSERT WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "invitations_update" ON public.invitations
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR organisation_id IN (SELECT organisation_id FROM public.organisation_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organisation_members(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organisation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organisation_id);
