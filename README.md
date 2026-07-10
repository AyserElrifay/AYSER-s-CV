# MOMENTS — "Active Experiencing" Super-App · Prototype v1.0

> Don't scroll it. Live it.

Every piece of content is an invitation to move. Moments is a super-app prototype
built around that philosophy: a feed where every post is joinable, a live map of
people and campfires, entertainment delivered to your GPS pin, squad chats that
expire after the vibe, and a wallet/life-planner to hold it all together.

**Design system:** Neon-Glassmorphism on deep charcoal
`BG #121212` · `Purple #7C3AED` · `Neon Green #10B981` · `Yala Blue #3B82F6` · `Coral #F43F5E`

**Stack:** Expo SDK 52 · React Navigation (bottom tabs) · react-native-maps ·
expo-linear-gradient · @expo/vector-icons

## Getting started

```bash
npm install
npx expo start
```

| Target | Command | Maps |
| --- | --- | --- |
| Dev build (full experience) | `npx expo run:ios` / `npx expo run:android` | Real Google/Apple map with dark style |
| Expo Go | `npx expo start` | Falls back to the hand-built `FauxMap` |
| Web | `npx expo start --web` | Falls back to `FauxMap` |

`react-native-maps` is native-only; `src/utils/maps.js` lazy-requires it and the
app degrades gracefully everywhere else — the prototype never crashes over maps.

## Backend (Supabase)

Auth (accounts, sessions) is wired to [Supabase](https://supabase.com). Without
credentials the app runs in **demo mode** — the login button proceeds locally and
nothing is saved — so you can explore the UI first and connect the backend later.

To go live:

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it
   (creates `profiles`, `posts`, `squads` + row-level security + the signup trigger)
3. Copy `.env.example` to `.env` and fill in your **Project URL** and **anon key**
   (Dashboard → Settings → API)
4. Restart the dev server: `npx expo start -c`

Sign-up now creates a real account, a `profiles` row appears automatically, the
vibe you pick during onboarding is saved to your profile, and sessions persist
across app restarts. Sign out from **VAULT → Account**.

The HOME feed also goes live: it loads from the `posts` table (pull to refresh),
and keeps showing the built-in sample feed until your table has real rows —
insert one from the SQL editor to see it appear:

```sql
insert into public.posts (user_id, caption, place, type)
select id, 'My first real moment! 🎉', 'Cairo', 'post' from public.profiles limit 1;
```

> Tip: new Supabase projects have email confirmation ON by default
> (Dashboard → Authentication → Providers → Email). The app handles both settings,
> but for quick testing you may want to turn it off.

## Architecture

```
App.js                       Root: SafeAreaProvider + NavigationContainer + StatusBar
src/
├── constants/
│   ├── theme.js             C design tokens · R house radius · DARK_MAP style
│   └── mockData.js          ME, USERS, STORIES, FEED, MAP_PEOPLE, CAMPFIRES,
│                            VOD_ROWS, GAMES, QUESTS, SQUADS, DMS, INITIAL_TX,
│                            PLANNER_INIT, FIXERS, RIDES
├── lib/
│   └── supabase.js          Supabase client (or null → demo mode, no .env needed)
├── services/
│   ├── auth.js              signUp / signIn / signOut / session helpers
│   ├── profiles.js          getProfile, updateProfile
│   └── posts.js             fetchFeed (posts + author join), createPost
├── context/
│   └── AuthContext.js       AuthProvider + useAuth() — session state for the app
├── hooks/
│   ├── usePulse.js          Looping breathe animation (drives every neon glow)
│   └── useFeed.js           Feed source: Supabase rows → PostCard shape,
│                            mock fallback in demo mode / while DB is empty
├── utils/
│   ├── maps.js              Native-only react-native-maps loader + MAPS_READY
│   └── geo.js               regionFor, kmBetween
├── components/              One component per file, re-exported via index.js
│   ├── Glass, Micro, Chip, Tick, SectionHeader, ScreenHeader, Page
│   ├── NeonButton, GhostButton, RatingBar, VouchBadge
│   ├── AvatarRing, AvatarStack, PosterCard, FauxMap
│   ├── MapPins (PersonPin · CampfirePin · MePin · SOSButton)
│   ├── StoriesBar, PostCard
│   └── ProfileModal, RouteMap, MagicFlowModal
├── screens/
│   ├── AuthScreen.js        Login / sign-up + vibe-picker onboarding gate
│   ├── HomeScreen.js        TAB 1 · The action feed + Magic Flow entry
│   ├── MapScreen.js         TAB 2 · The living world: pins, campfires, SOS
│   ├── ReelsScreen.js       TAB 3 · Standalone vertical reels + sponsored reels
│   ├── ChillScreen.js       TAB 4 · VOD rows, order-to-pin, AR quests
│   ├── ChatsScreen.js       TAB 5 · Squads + DMs (with translation hints)
│   ├── ProfileScreen.js     TAB 6 · Your Space — profile, highlights, moment grid
│   └── SettingsScreen.js    Settings drawer — wallet, planner, fixers, account
└── navigation/
    └── TabNavigator.js      Bottom-tab shell, icons, unread badge, NavTheme
```

### Conventions

- **Tokens, not magic numbers** — all colors come from `C` in `src/constants/theme.js`;
  the house border-radius is `R`.
- **Glass primitives compose everything** — screens are assembled from `Glass`,
  `Chip`, `Micro`, `NeonButton`, etc. New UI should reuse them before adding new ones.
- **Mock data lives in one place** — `src/constants/mockData.js` is the single
  source for all fixture content, ready to be swapped for a real API layer.
- **Animations use the native driver** — `usePulse` is the shared heartbeat;
  interpolate it rather than creating new loops.

### The Magic Flow

The signature interaction: tap **JOIN THE VIBE** on any post → a 3D route plots
from your live pin to the moment (`RouteMap`) → pick a YalaGo ride (mock) → a
Roam Mates squad is created and the post flips to *VIBE JOINED*. The whole flow
lives in `src/components/MagicFlowModal.js`.
