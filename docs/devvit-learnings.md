# Devvit Learnings for Reddit Game Development

Technical patterns, architecture, and lessons learned for building Reddit games with Devvit.

---

## What is Devvit?

Devvit is Reddit's Developer Platform. It lets you build interactive apps that live inside Reddit posts. Two app types:

1. **Blocks** — JSX-like syntax with Devvit custom tags (`<vstack>`, `<text>`, `<button>`). Runs directly in feed without user interaction. Limited but visible.
2. **Web (WebView)** — Full web app (HTML/CSS/JS, React, etc.) that opens when user clicks a button. Richer but requires a "Launch" click.

**For games**: Use WebView for the game itself, Blocks for the post preview (category, word length, play count, "Play" button).

---

## Project Structure

```
my-devvit-app/
├── devvit.yaml           # App name + version (required)
├── package.json           # Dependencies (@devvit/public-api)
├── tsconfig.json          # Extends devvit.tsconfig.json
├── src/
│   └── main.tsx           # Devvit entry: custom post type, menu items, Redis
└── webroot/               # WebView files (served as static assets)
    ├── index.html          # Game HTML
    ├── style.css
    └── script.js
```

### devvit.yaml
```yaml
name: my-app-name    # 0-16 chars, lowercase, no spaces
version: 0.0.1
```

### tsconfig.json
```json
{
  "extends": "./node_modules/@devvit/public-api/devvit.tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "types": []  // Override vitest/globals if not using tests
  },
  "include": ["src/**/*"]
}
```

**Key**: The Devvit tsconfig uses `"jsx": "react"` with `"jsxFactory": "Devvit.createElement"`, NOT `react-jsx`. Always extend from `devvit.tsconfig.json`.

---

## Core Concepts

### 1. Devvit.configure()
Enable platform features:
```tsx
Devvit.configure({
  redditAPI: true,   // Access Reddit API (usernames, posts, subreddits)
  redis: true,       // Key-value storage
});
```

### 2. Custom Post Type
The interactive post users see in their feed:
```tsx
Devvit.addCustomPostType({
  name: 'My Game',
  height: 'tall',    // 'short' | 'regular' | 'tall'
  render: (context) => {
    // context.reddit — Reddit API
    // context.redis  — Redis storage
    // context.postId — Current post ID
    // context.ui     — UI helpers (showToast, showForm)

    const webView = useWebView({ url: 'index.html', onMessage: ... });

    return (
      <vstack grow alignment="middle center">
        <text size="xlarge">My Game</text>
        <button onPress={() => webView.mount()}>Play</button>
      </vstack>
    );
  },
});
```

### 3. WebView Communication (postMessage)

**Webview → Devvit** (from webroot JS):
```js
parent.postMessage({ type: 'myAction', data: { foo: 'bar' } }, '*');
```

**Devvit → Webview** (from main.tsx):
```tsx
webView.postMessage({ type: 'response', data: { result: 42 } });
```

**Webview receiving messages** (from webroot JS):
```js
addEventListener('message', (ev) => {
  if (ev.data.type !== 'devvit-message') return;
  const { message } = ev.data.data;
  // message.type, message.data
});
```

**Pattern**: Webview sends `webViewReady` on load → Devvit responds with `initialData`.

### 4. Redis Storage
```tsx
// Key-value strings
await context.redis.set('key', 'value');
const val = await context.redis.get('key');
await context.redis.del('key');

// Sorted sets (leaderboards)
await context.redis.zAdd('leaderboard', { member: 'user1', score: 100 });
const top10 = await context.redis.zRange('leaderboard', 0, 9, { reverse: true, by: 'rank' });
```

**Namespace by postId**: `puzzle:${context.postId}`, `score:${postId}:${userId}`

### 5. Menu Items & Forms

Add a menu item to subreddit context menu:
```tsx
Devvit.addMenuItem({
  label: 'Create Puzzle',
  location: 'subreddit',
  onPress: async (_event, context) => {
    context.ui.showForm(myForm);
  },
});
```

Create a form:
```tsx
const myForm = Devvit.createForm(
  {
    title: 'Create a Puzzle',
    fields: [
      { name: 'word', label: 'Word', type: 'string', required: true },
      { name: 'category', label: 'Category', type: 'select', options: [...] },
    ],
  },
  async (event, context) => {
    const { word, category } = event.values;
    // Create post, store in Redis, etc.
  }
);
```

### 6. Creating Posts Programmatically
```tsx
const post = await context.reddit.submitPost({
  title: 'My Game Post',
  subredditName: subreddit.name,
  preview: (
    <vstack><text>Loading...</text></vstack>
  ),
});
// post.id is available for Redis keys
```

### 7. useState Hook
```tsx
const [value] = useState(async () => {
  return await context.redis.get('key') ?? 'default';
});
```

**Gotcha**: `useState` requires `JSONValue` types. Use string serialization for complex objects, then parse separately:
```tsx
const [raw] = useState(async () => {
  return await context.redis.get('data') ?? '';
});
const parsed = raw ? JSON.parse(raw as string) : null;
```

---

## Deployment

### Development
```bash
# Create a test subreddit on reddit.com first (< 200 subscribers)
cd reddit/
devvit playtest <your-test-subreddit>
# Hot-reloads on file changes
```

### Production
```bash
devvit upload        # Upload to App Directory (only visible to you)
devvit publish       # Make available to others
```

---

## Architecture: Web + Reddit from Same Repo

For games that target both web (Netlify) and Reddit (Devvit):

```
project/
├── index.html          # Web entry (Netlify)
├── js/                 # Web JS (IIFE modules)
├── css/                # Shared CSS
├── data/               # Shared puzzle data
├── reddit/             # Devvit app (self-contained)
│   ├── devvit.yaml
│   ├── src/main.tsx    # Devvit backend
│   └── webroot/        # Game adapted for Reddit
│       ├── index.html
│       └── js/         # Adapted JS (storage-bridge instead of localStorage)
└── scripts/
    └── build-reddit.cjs  # Copies shared files into reddit/webroot/
```

**Key principle**: Web app stays untouched. Reddit app gets adapted copies. A build script syncs shared files.

### Storage Abstraction
- **Web**: `StorageManager` → `localStorage` (synchronous)
- **Reddit**: `StorageManager` → `postMessage` → Devvit → `context.redis` (async)

Both expose the same API. On Reddit, reads use request/response pattern:
```js
// Webview sends: { type: 'getGameState', data: { key: 'stats' } }
// Devvit responds: { type: 'gameStateResponse', data: { key: 'stats', value: '...' } }
```

---

## Blocks UI Quick Reference

```tsx
<vstack>          // Vertical stack
<hstack>          // Horizontal stack
<text>            // Text display (size: xsmall|small|medium|large|xlarge|xxlarge)
<button>          // Clickable button (appearance: primary|secondary|bordered)
<spacer>          // Flexible space (size: xsmall|small|medium|large)
<image>           // Image display
<icon>            // Built-in icon
```

Common props: `grow`, `padding`, `gap`, `alignment`, `backgroundColor`, `width`, `height`

---

## Gotchas & Tips

1. **TypeScript JSX**: Always extend `devvit.tsconfig.json`. Don't use `react-jsx` — use `react` with `Devvit.createElement`.
2. **useState types**: Must be `JSONValue`. Complex objects → serialize to string, parse separately.
3. **WebView files**: Served from `webroot/` folder. Reference as relative URLs (e.g., `url: 'index.html'`).
4. **postMessage envelope**: Devvit wraps messages in `{ type: 'devvit-message', data: { message } }`. Check for this in your webview listener.
5. **No fetch in webview to Devvit**: All communication is via `postMessage`. No HTTP requests to Devvit backend.
6. **Test subreddit**: Must have < 200 subscribers for `devvit playtest`.
7. **Form select values**: Come back as arrays — use `Array.isArray(val) ? val[0] : val`.
8. **Redis is string-only**: All values are strings. `JSON.stringify`/`JSON.parse` for objects.
9. **Post height**: Use `'tall'` for games that need more vertical space.
10. **User identity**: `context.reddit.getCurrentUsername()` gives you the logged-in Reddit user. No anonymous users on Reddit.

---

## Resources

- [Devvit WebView Template](https://github.com/reddit/devvit-template-web-view-post) — Official starter
- [Devvit React Template](https://github.com/reddit/devvit-template-react) — React-based webview
- [Devvit Corridor](https://github.com/reddit/devvit-corridor) — Example game (top-down shooter)
- [Devvit as Backend](https://github.com/sir-axolotl-alot/devvit-as-a-backend) — Web-first pattern
- [Devvit Kit](https://github.com/reddit/devvit-kit) — Helper library
- [Devvit Fiddlesticks](https://github.com/reddit/devvit-fiddlesticks) — Another game example
- [DEV.to Tutorial](https://dev.to/room_js/building-reddit-game-with-devvit-and-typescript-starter-included-3kcp) — Building a Reddit game

---

## Summary: What Carries Forward to Future Reddit Games

- **postMessage pattern**: webViewReady → initialData → game actions → score saving
- **Redis key namespacing**: `{entity}:{postId}:{userId}` for per-user per-post data
- **Menu item + Form → Custom post**: User-generated content flow
- **Blocks preview + WebView game**: Show metadata in feed, full experience on click
- **Build script approach**: Copy shared assets into webroot/ for dual deployment
- **Sorted sets for leaderboards**: `zAdd` / `zRange` with `{ reverse: true }`
