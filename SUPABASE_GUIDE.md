# Supabase Deployment & Integration Guide for ERA

This guide provides the necessary steps and SQL schema to migrate the ERA Single Page Application from local storage to a Supabase BaaS (Backend as a Service).

## 1. Database Schema (PostgreSQL)

Run the following SQL in your Supabase SQL Editor to set up the core tables.

```sql
-- Users Table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT CHECK (char_length(bio) <= 150),
  website TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  base_color TEXT DEFAULT '#00c6ff',
  vibe_color TEXT,
  privacy_state TEXT DEFAULT 'PUBLIC' CHECK (privacy_state IN ('PUBLIC', 'PRIVATE', 'SEMI_PRIVATE', 'HIDDEN')),
  searchable BOOLEAN DEFAULT TRUE,
  pinned_posts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts Table
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT CHECK (char_length(description) <= 300),
  images TEXT[] DEFAULT '{}',
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  repost_of UUID REFERENCES public.posts(id),
  reposter_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  pinned BOOLEAN DEFAULT FALSE
);

-- Comments Table
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  entity_type TEXT, -- 'POST', 'PROFILE', 'COMMENT'
  entity_id UUID,
  text TEXT,
  priority TEXT DEFAULT 'NORMAL',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions / Follows Table
CREATE TABLE public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  target_id UUID REFERENCES public.profiles(id) NOT NULL,
  is_follower BOOLEAN DEFAULT FALSE,
  is_close_friend BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id)
);
```

## 2. SDK Integration

Replace the local state persistence in `js/state.js` with Supabase SDK calls.

### Initialize Supabase
```javascript
const supabase = supabase.createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
```

### Authentication Example
```javascript
async function doLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
```

### Fetching Feed
```javascript
async function getSupabaseFeed() {
  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles(username, avatar_url, base_color)')
    .order('created_at', { ascending: false });
  return data;
}
```

## 3. Realtime Support
ERA is designed to benefit from Supabase Realtime for notifications and likes.
```javascript
const notifs = supabase.channel('custom-all-channel')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
    console.log('New notification!', payload);
    NotificationEngine.renderNotifBadge();
  })
  .subscribe();
```

## 4. Storage (Buckets)
Create two public buckets: `avatars` and `posts`. Use `supabase.storage.from('posts').upload()` instead of Base64 strings for better performance.
