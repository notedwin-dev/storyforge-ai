const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized');
} else {
  console.log('Supabase configuration not found, using local storage only');
}

// Database table schemas
const TABLES = {
  USERS: 'users',
  CHARACTERS: 'characters',
  STORIES: 'stories',
  GENERATIONS: 'generations'
};

// User management functions

// Authentication functions
async function signUpUser(email, password) {
  if (!supabase) {
    return { error: { message: 'Supabase not configured' } };
  }
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    return { data, error };
  } catch (error) {
    console.error('Error signing up user:', error);
    return { error: { message: error.message } };
  }
}

async function signInUser(email, password) {
  if (!supabase) {
    return { error: { message: 'Supabase not configured' } };
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    return { data, error };
  } catch (error) {
    console.error('Error signing in user:', error);
    return { error: { message: error.message } };
  }
}

async function signOutUser() {
  if (!supabase) {
    return { error: { message: 'Supabase not configured' } };
  }
  
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    console.error('Error signing out user:', error);
    return { error: { message: error.message } };
  }
}

async function verifyUser(authHeader) {
  if (!supabase) return null;
  
  try {
    // Extract token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error verifying user:', error);
    return null;
  }
}

async function createUserProfile(userId, email, metadata = {}) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .insert([
        {
          id: userId,
          email: email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: metadata
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user profile:', error);
    return null;
  }
}

async function getUserProfile(userId) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

async function updateUserProfile(userId, updates) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null;
  }
}

// Character management functions
async function saveCharacter(userId, characterData) {
  if (!supabase) return null;
  
  try {
    console.log('Saving character to Supabase:', { userId, characterData });
    
    const { data, error } = await supabase
      .from(TABLES.CHARACTERS)
      .insert([
        {
          id: characterData.id,
          user_id: userId,
          name: characterData.name,
          description: characterData.description || '',
          tags: characterData.tags || [],
          traits: characterData.traits || [],
          embedding: characterData.dna_data?.embedding || characterData.embedding,
          image_url: characterData.image_url || characterData.imageUrl,
          thumbnail_url: characterData.thumbnail_url || characterData.thumbnailUrl,
          is_demo: characterData.is_demo || false,
          metadata: characterData.dna_data || characterData.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Character successfully saved to Supabase:', data);
    return data;
  } catch (error) {
    console.error('Error saving character to Supabase:', error);
    throw error; // Re-throw to trigger fallback in upload.js
  }
}

async function getUserCharacters(userId, limit = 50, offset = 0) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from(TABLES.CHARACTERS)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user characters:', error);
    return [];
  }
}

async function getCharacterById(characterId, userId = null, bypassRLS = false) {
  if (!supabase) {
    console.log(`❌ getCharacterById: Supabase not available`);
    return null;
  }
  
  try {
    console.log(`🔍 getCharacterById: Looking for character ${characterId} with userId: ${userId || 'none'}, bypassRLS: ${bypassRLS}`);
    
    // For story generation, we need to bypass RLS to access the character
    // This is safe because we're only reading character data, not modifying it
    let query;
    if (bypassRLS && process.env.SUPABASE_SERVICE_KEY) {
      console.log(`🔓 getCharacterById: Using service key to bypass RLS`);
      // Create a new client with service key for this query
      const { createClient } = require('@supabase/supabase-js');
      const serviceSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      query = serviceSupabase
        .from(TABLES.CHARACTERS)
        .select('*')
        .eq('id', characterId);
    } else {
      query = supabase
        .from(TABLES.CHARACTERS)
        .select('*')
        .eq('id', characterId);
      
      // If userId is provided, ensure the character belongs to the user
      if (userId) {
        query = query.eq('user_id', userId);
        console.log(`🔒 getCharacterById: Added user_id filter for ${userId}`);
      } else {
        console.log(`🔓 getCharacterById: No user_id filter, querying all characters`);
      }
    }

    console.log(`📊 getCharacterById: Executing Supabase query...`);
    const { data, error } = await query.single();
    
    console.log(`📊 getCharacterById: Query completed`, {
      hasData: !!data,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message
    });

    if (error) {
      console.error(`❌ getCharacterById: Supabase error:`, error);
      throw error;
    }
    
    if (data) {
      console.log(`✅ getCharacterById: Found character:`, {
        id: data.id,
        name: data.name,
        user_id: data.user_id
      });
    }
    
    return data;
  } catch (error) {
    console.error('❌ getCharacterById: Error fetching character:', {
      characterId,
      userId,
      bypassRLS,
      error: error.message,
      code: error.code
    });
    return null;
  }
}

async function updateCharacter(characterId, userId, updates) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from(TABLES.CHARACTERS)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', characterId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating character:', error);
    return null;
  }
}

async function deleteCharacter(characterId, userId) {
  if (!supabase) return false;
  
  try {
    const { error } = await supabase
      .from(TABLES.CHARACTERS)
      .delete()
      .eq('id', characterId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting character:', error);
    return false;
  }
}

// Story/Generation management functions
async function saveGeneration(userId, generationData) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from(TABLES.GENERATIONS)
      .insert([
        {
          id: generationData.jobId,
          user_id: userId,
          character_id: generationData.characterId,
          prompt: generationData.prompt,
          style: generationData.style,
          genre: generationData.genre,
          status: generationData.status || 'pending',
          progress: generationData.progress || 0,
          result_data: generationData.result || null,
          error_message: generationData.error || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving generation:', error);
    return null;
  }
}

async function updateGeneration(generationId, updates) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from(TABLES.GENERATIONS)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', generationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating generation:', error);
    return null;
  }
}

async function getUserGenerations(userId, limit = 20, offset = 0) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from(TABLES.GENERATIONS)
      .select(`
        *,
        character:characters(id, name, thumbnail_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user generations:', error);
    return [];
  }
}

// Authentication helper functions
async function verifyUser(authHeader) {
  if (!supabase || !authHeader) return null;
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error verifying user:', error);
    return null;
  }
}

// Database initialization (create tables if they don't exist)
async function initializeDatabase() {
  if (!supabase) {
    console.log('Skipping database initialization - Supabase not configured');
    return;
  }

  console.log('Checking database tables...');

  try {
    // Check if tables exist by trying to query them
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    const { data: charactersData, error: charactersError } = await supabase
      .from('characters')
      .select('id')
      .limit(1);

    const { data: generationsData, error: generationsError } = await supabase
      .from('generations')
      .select('id')
      .limit(1);

    const missingTables = [];
    if (usersError?.code === '42P01') missingTables.push('users');
    if (charactersError?.code === '42P01') missingTables.push('characters');
    if (generationsError?.code === '42P01') missingTables.push('generations');

    if (missingTables.length > 0) {
      console.error('❌ Missing database tables:', missingTables.join(', '));
      console.log('\n📝 To fix this, please run the following SQL in your Supabase SQL Editor:');
      console.log('\n' + '='.repeat(80));
      console.log(`
-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create characters table
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

-- Create generations table
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

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      `);
      console.log('='.repeat(80));
      console.log('\n📖 See database/README.md for complete setup instructions\n');
      return false;
    }

    console.log('✅ All database tables exist and are accessible');
    return true;
  } catch (error) {
    console.error('Error checking database tables:', error);
    return false;
  }
}

module.exports = {
  supabase,
  TABLES,
  
  // User functions
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  
  // Authentication functions
  signUpUser,
  signInUser,
  signOutUser,
  verifyUser,
  
  // Character functions
  saveCharacter,
  getUserCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter,
  
  // Generation functions
  saveGeneration,
  updateGeneration,
  getUserGenerations,
  
  // Utils
  initializeDatabase,
  isSupabaseEnabled: () => !!supabase
};
