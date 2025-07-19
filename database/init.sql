-- StoryForge AI Database Schema
-- Run this SQL in your Supabase SQL Editor to create the necessary tables

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create characters table with all required columns
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  traits TEXT[] DEFAULT '{}',
  embedding FLOAT[] DEFAULT '{}',
  image_url TEXT,
  thumbnail_url TEXT,
  is_demo BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generations table with all required columns
CREATE TABLE IF NOT EXISTS public.generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  style TEXT,
  genre TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  result_data JSONB DEFAULT '{}',
  error_message TEXT,
  parameters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If tables already exist, add missing columns
-- Add missing columns to characters table (will only add if they don't exist)
DO $$ 
BEGIN
  -- Add tags column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'tags') THEN
    ALTER TABLE public.characters ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
  
  -- Add traits column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'traits') THEN
    ALTER TABLE public.characters ADD COLUMN traits TEXT[] DEFAULT '{}';
  END IF;
  
  -- Add embedding column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'embedding') THEN
    ALTER TABLE public.characters ADD COLUMN embedding FLOAT[] DEFAULT '{}';
  END IF;
  
  -- Add thumbnail_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'thumbnail_url') THEN
    ALTER TABLE public.characters ADD COLUMN thumbnail_url TEXT;
  END IF;
  
  -- Add is_demo column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'is_demo') THEN
    ALTER TABLE public.characters ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add missing columns to generations table (will only add if they don't exist)
DO $$ 
BEGIN
  -- Add style column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generations' AND column_name = 'style') THEN
    ALTER TABLE public.generations ADD COLUMN style TEXT;
  END IF;
  
  -- Add genre column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generations' AND column_name = 'genre') THEN
    ALTER TABLE public.generations ADD COLUMN genre TEXT;
  END IF;
  
  -- Add progress column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generations' AND column_name = 'progress') THEN
    ALTER TABLE public.generations ADD COLUMN progress INTEGER DEFAULT 0;
  END IF;
  
  -- Add result_data column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generations' AND column_name = 'result_data') THEN
    ALTER TABLE public.generations ADD COLUMN result_data JSONB DEFAULT '{}';
  END IF;
  
  -- Add parameters column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generations' AND column_name = 'parameters') THEN
    ALTER TABLE public.generations ADD COLUMN parameters JSONB DEFAULT '{}';
  END IF;
END $$;

-- Update status column constraint to allow 'processing' status
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'generations_status_check') THEN
    ALTER TABLE public.generations DROP CONSTRAINT generations_status_check;
  END IF;
  
  -- Add updated constraint
  ALTER TABLE public.generations ADD CONSTRAINT generations_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_created_at ON public.characters(created_at);
CREATE INDEX IF NOT EXISTS idx_characters_is_demo ON public.characters(is_demo);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_character_id ON public.generations(character_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON public.generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.generations(created_at);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can manage own profile" ON public.users;
DROP POLICY IF EXISTS "Users can manage own characters" ON public.characters;
DROP POLICY IF EXISTS "Users can manage own generations" ON public.generations;

-- Create RLS policies
CREATE POLICY "Users can manage own profile" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage own characters" ON public.characters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own generations" ON public.generations FOR ALL USING (auth.uid() = user_id);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.characters TO anon, authenticated;
GRANT ALL ON public.generations TO anon, authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'StoryForge AI database initialization completed successfully!';
  RAISE NOTICE 'Tables created: users, characters, generations';
  RAISE NOTICE 'RLS policies enabled and configured';
  RAISE NOTICE 'Auto user profile creation trigger installed';
  RAISE NOTICE 'Performance indexes created';
END $$;

-- Create RLS policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for characters table
CREATE POLICY "Users can view own characters" ON public.characters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own characters" ON public.characters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own characters" ON public.characters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own characters" ON public.characters
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for generations table
CREATE POLICY "Users can view own generations" ON public.generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" ON public.generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations" ON public.generations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations" ON public.generations
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generations_updated_at BEFORE UPDATE ON public.generations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.characters TO authenticated;
GRANT ALL ON public.generations TO authenticated;
