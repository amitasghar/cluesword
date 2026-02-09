import { Devvit, useState, useWebView } from '@devvit/public-api';
import type { DevvitMessage, WebViewMessage, PuzzleData } from './messages.js';
import dailyPuzzles from './daily-puzzles.json' with { type: 'json' };

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// ─── Constants ───

const LAUNCH_DATE = new Date('2026-02-04');

function getDailyPuzzleIndex(totalPuzzles: number): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceLaunch = Math.floor((today.getTime() - LAUNCH_DATE.getTime()) / msPerDay);
  return ((daysSinceLaunch % totalPuzzles) + totalPuzzles) % totalPuzzles;
}

// ─── Scheduler: Daily Puzzle Auto-Post ───

Devvit.addSchedulerJob({
  name: 'daily-puzzle',
  onRun: async (_event, context) => {
    const subredditName = await context.redis.get('dailySchedule:subreddit');
    if (!subredditName) return;

    const index = getDailyPuzzleIndex(dailyPuzzles.length);
    const puzzle = dailyPuzzles[index] as PuzzleData;
    if (!puzzle) return;

    // Check if we already posted this puzzle today
    const today = new Date().toISOString().split('T')[0];
    const lastPosted = await context.redis.get('dailySchedule:lastDate');
    if (lastPosted === today) return;

    // Set date FIRST to prevent duplicate posts from concurrent runs
    await context.redis.set('dailySchedule:lastDate', today);

    const letterCount = puzzle.word.replace(/[\s-]/g, '').length;
    const mask = Array(letterCount).fill('_').join(' ');
    const dayNumber = Math.floor((new Date().getTime() - LAUNCH_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const post = await context.reddit.submitPost({
      title: `Daily CluesWord #${dayNumber}: ${puzzle.category} (${mask} — ${letterCount} letters)`,
      subredditName,
      preview: (
        <vstack grow alignment="middle center" padding="medium">
          <text size="xlarge" weight="bold">🧩 CluesWord</text>
          <spacer size="medium" />
          <text size="large">Loading daily puzzle...</text>
        </vstack>
      ),
    });

    // Store puzzle in Redis for this post
    const puzzleData: PuzzleData = {
      ...puzzle,
      id: `daily-${post.id}`,
      author: 'CluesWord Bot',
    };

    await context.redis.set(`puzzle:${post.id}`, JSON.stringify(puzzleData));
    await context.redis.set(`playcount:${post.id}`, '0');

  },
});

// ─── Menu Items ───

// Start daily schedule
Devvit.addMenuItem({
  label: 'Start Daily CluesWord',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();

    // Check if already scheduled
    const existing = await context.redis.get('dailySchedule:jobId');
    if (existing) {
      context.ui.showToast('Daily puzzle is already scheduled! Use "Stop Daily CluesWord" first.');
      return;
    }

    // Save subreddit name for the scheduler job
    await context.redis.set('dailySchedule:subreddit', subreddit.name);

    // Schedule daily at 8:00 AM UTC
    const jobId = await context.scheduler.runJob({
      name: 'daily-puzzle',
      cron: '0 8 * * *',
    });

    await context.redis.set('dailySchedule:jobId', jobId);

    // Only post today's puzzle if not already posted today
    const today = new Date().toISOString().split('T')[0];
    const lastPosted = await context.redis.get('dailySchedule:lastDate');
    if (lastPosted === today) {
      context.ui.showToast('Daily CluesWord started! Today\'s puzzle was already posted. Next one at 8 AM UTC.');
      return;
    }

    // Set date FIRST to prevent duplicate posts from concurrent runs
    await context.redis.set('dailySchedule:lastDate', today);

    const index = getDailyPuzzleIndex(dailyPuzzles.length);
    const puzzle = dailyPuzzles[index] as PuzzleData;
    const letterCount = puzzle.word.replace(/[\s-]/g, '').length;
    const mask = Array(letterCount).fill('_').join(' ');
    const dayNumber = Math.floor((new Date().getTime() - LAUNCH_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const post = await context.reddit.submitPost({
      title: `Daily CluesWord #${dayNumber}: ${puzzle.category} (${mask} — ${letterCount} letters)`,
      subredditName: subreddit.name,
      preview: (
        <vstack grow alignment="middle center" padding="medium">
          <text size="xlarge" weight="bold">🧩 CluesWord</text>
          <spacer size="medium" />
          <text size="large">Loading daily puzzle...</text>
        </vstack>
      ),
    });

    const puzzleData: PuzzleData = {
      ...puzzle,
      id: `daily-${post.id}`,
      author: 'CluesWord Bot',
    };

    await context.redis.set(`puzzle:${post.id}`, JSON.stringify(puzzleData));
    await context.redis.set(`playcount:${post.id}`, '0');

    context.ui.showToast('Daily CluesWord started! A new puzzle will post every day at 8 AM UTC.');
  },
});

// Stop daily schedule
Devvit.addMenuItem({
  label: 'Stop Daily CluesWord',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const jobId = await context.redis.get('dailySchedule:jobId');
    if (!jobId) {
      context.ui.showToast('No daily schedule is active.');
      return;
    }

    await context.scheduler.cancelJob(jobId);
    await context.redis.del('dailySchedule:jobId');
    await context.redis.del('dailySchedule:lastDate');

    context.ui.showToast('Daily CluesWord schedule stopped.');
  },
});

// ─── Create Puzzle Form ───

const createPuzzleForm = Devvit.createForm(
  {
    title: 'Create a CluesWord Puzzle',
    fields: [
      { name: 'word', label: 'Answer Word (e.g. TIGER)', type: 'string', required: true },
      { name: 'category', label: 'Category', type: 'select', required: true, multiSelect: false, defaultValue: ['Countries'], options: [
        { label: 'Countries', value: 'Countries' },
        { label: 'Cities', value: 'Cities' },
        { label: 'Animals', value: 'Animals' },
        { label: 'Movies', value: 'Movies' },
        { label: 'Famous People', value: 'Famous People' },
        { label: 'Other', value: 'Other' },
      ]},
      { name: 'clue1', label: 'Clue 1 — Vague', type: 'string', required: true },
      { name: 'clue2', label: 'Clue 2 — Specific', type: 'string', required: true },
      { name: 'clue3', label: 'Clue 3 — Giveaway', type: 'string', required: true },
      { name: 'factoid', label: 'Fun Fact (optional)', type: 'string', required: false },
    ],
  },
  async (event, context) => {
    const { word, category, clue1, clue2, clue3, factoid } = event.values;
    const cleanWord = (word as string).toUpperCase().trim();
    const categoryValue = Array.isArray(category) ? category[0] : category;
    const letterCount = cleanWord.replace(/[\s-]/g, '').length;

    if (letterCount < 2) {
      context.ui.showToast('Word must be at least 2 letters');
      return;
    }

    if (!/^[A-Z\s-]+$/.test(cleanWord)) {
      context.ui.showToast('Word can only contain letters, spaces, and hyphens');
      return;
    }

    const username = await context.reddit.getCurrentUsername();
    const subreddit = await context.reddit.getCurrentSubreddit();

    // Build masked title
    const mask = Array(letterCount).fill('_').join(' ');

    // Create the post
    const post = await context.reddit.submitPost({
      title: `CluesWord: ${categoryValue} (${mask} — ${letterCount} letters)`,
      subredditName: subreddit.name,
      preview: (
        <vstack grow alignment="middle center" padding="medium">
          <text size="xlarge" weight="bold">🧩 CluesWord</text>
          <spacer size="medium" />
          <text size="large">Loading puzzle...</text>
        </vstack>
      ),
    });

    // Store puzzle data in Redis
    const puzzle: PuzzleData = {
      id: `custom-${post.id}`,
      category: categoryValue as string,
      word: cleanWord,
      clues: [clue1 as string, clue2 as string, clue3 as string],
      factoid: (factoid as string) || `Puzzle created by u/${username}`,
      author: username ?? 'anonymous',
    };

    await context.redis.set(`puzzle:${post.id}`, JSON.stringify(puzzle));
    await context.redis.set(`playcount:${post.id}`, '0');

    context.ui.showToast(`Puzzle created! Check your subreddit.`);
  }
);

// ─── Custom Post Type ───

Devvit.addCustomPostType({
  name: 'CluesWord Puzzle',
  height: 'tall',
  render: (context) => {
    const [username] = useState(async () => {
      return (await context.reddit.getCurrentUsername()) ?? 'anonymous';
    });

    const [puzzleDataRaw] = useState(async () => {
      const raw = await context.redis.get(`puzzle:${context.postId}`);
      if (!raw) return '';
      return raw;
    });
    const puzzleData: PuzzleData | null = puzzleDataRaw ? JSON.parse(puzzleDataRaw as string) : null;

    const [playCount] = useState(async () => {
      const count = await context.redis.get(`playcount:${context.postId}`);
      return Number(count ?? 0);
    });

    const [puzzleStatsRaw] = useState(async () => {
      return await context.redis.get(`puzzlestats:${context.postId}`) ?? '';
    });
    const puzzleStats = puzzleStatsRaw ? JSON.parse(puzzleStatsRaw as string) : null;

    // Track which mode the user selected from the hub
    const [launchMode, setLaunchMode] = useState('custom');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webView = useWebView<WebViewMessage, any>({
      url: 'index.html',

      async onMessage(message, webView) {
        switch (message.type) {
          case 'webViewReady': {
            // Load global user stats
            const uid = username ?? 'anonymous';
            const rawUserStats = await context.redis.get(`userstats:${uid}`);
            const userStats = rawUserStats ? JSON.parse(rawUserStats) : null;

            webView.postMessage({
              type: 'initialData',
              data: {
                username: uid,
                puzzle: launchMode === 'custom' ? puzzleData : null,
                mode: launchMode as string,
                postId: context.postId ?? '',
                userStats,
              },
            });
            break;
          }

          case 'getGameState': {
            const userId = username ?? 'anonymous';
            const value = await context.redis.get(`state:${context.postId}:${userId}:${message.data.key}`);
            webView.postMessage({
              type: 'gameStateResponse',
              data: { key: message.data.key, value: value ?? null },
            });
            break;
          }

          case 'setGameState': {
            const userId = username ?? 'anonymous';
            await context.redis.set(
              `state:${context.postId}:${userId}:${message.data.key}`,
              message.data.value
            );
            webView.postMessage({
              type: 'gameStateSaved',
              data: { key: message.data.key, success: true },
            });
            break;
          }

          case 'removeGameState': {
            const userId = username ?? 'anonymous';
            await context.redis.del(`state:${context.postId}:${userId}:${message.data.key}`);
            break;
          }

          case 'shareAsComment': {
            if (context.postId) {
              await context.reddit.submitComment({
                id: context.postId,
                text: message.data.text,
              });
              webView.postMessage({
                type: 'commentPosted' as any,
                data: { success: true },
              });
            }
            break;
          }

          case 'createPuzzle': {
            const { word, category, clue1, clue2, clue3, factoid } = message.data;
            const cleanWord = word.toUpperCase().trim();
            const letterCount = cleanWord.replace(/[\s-]/g, '').length;

            if (letterCount < 2 || !/^[A-Z\s-]+$/.test(cleanWord)) {
              webView.postMessage({
                type: 'puzzleCreated',
                data: { success: false, message: 'Invalid word. Use only letters, spaces, and hyphens (min 2 letters).' },
              });
              break;
            }

            const creatorName = username ?? 'anonymous';
            const subreddit = await context.reddit.getCurrentSubreddit();
            const mask = Array(letterCount).fill('_').join(' ');

            const newPost = await context.reddit.submitPost({
              title: `CluesWord Community Puzzle by u/${creatorName}: ${category} (${mask} — ${letterCount} letters)`,
              subredditName: subreddit.name,
              preview: (
                <vstack grow alignment="middle center" padding="medium">
                  <text size="xlarge" weight="bold">🧩 CluesWord</text>
                  <spacer size="medium" />
                  <text size="large">Loading puzzle...</text>
                </vstack>
              ),
            });

            const newPuzzle: PuzzleData = {
              id: `custom-${newPost.id}`,
              category,
              word: cleanWord,
              clues: [clue1, clue2, clue3],
              factoid: factoid || `Puzzle created by u/${creatorName}`,
              author: creatorName,
            };

            await context.redis.set(`puzzle:${newPost.id}`, JSON.stringify(newPuzzle));
            await context.redis.set(`playcount:${newPost.id}`, '0');

            webView.postMessage({
              type: 'puzzleCreated',
              data: {
                success: true,
                message: 'Puzzle created!',
                postUrl: `https://www.reddit.com${newPost.permalink}`,
              },
            });
            break;
          }

          case 'saveScore': {
            const userId = username ?? 'anonymous';
            const scoreData = JSON.stringify({
              userId,
              score: message.data.score,
              cluesRevealed: message.data.cluesRevealed,
              guesses: message.data.guesses,
              completedAt: new Date().toISOString(),
            });
            await context.redis.set(`score:${context.postId}:${userId}`, scoreData);

            // Increment play count
            const current = await context.redis.get(`playcount:${context.postId}`);
            await context.redis.set(`playcount:${context.postId}`, String(Number(current ?? 0) + 1));

            // Update aggregate stats
            const statsKey = `puzzlestats:${context.postId}`;
            const rawStats = await context.redis.get(statsKey);
            const stats = rawStats ? JSON.parse(rawStats) : {
              totalScore: 0, solves: 0,
              clue1: 0, clue2: 0, clue3: 0,
              totalGuesses: 0,
            };
            stats.solves += 1;
            stats.totalScore += message.data.score;
            stats.totalGuesses += message.data.guesses.length;
            const clueKey = `clue${message.data.cluesRevealed}` as keyof typeof stats;
            if (clueKey in stats) stats[clueKey] += 1;
            await context.redis.set(statsKey, JSON.stringify(stats));

            // Add to leaderboard (sorted set)
            await context.redis.zAdd(`leaderboard:${context.postId}`, {
              member: userId,
              score: message.data.score,
            });

            // Update global user stats (across all puzzles)
            const userStatsKey = `userstats:${userId}`;
            const rawUserStats = await context.redis.get(userStatsKey);
            const userStats = rawUserStats ? JSON.parse(rawUserStats) : {
              played: 0, won: 0, totalScore: 0,
              currentStreak: 0, maxStreak: 0,
              clue1: 0, clue2: 0, clue3: 0,
            };
            userStats.played += 1;
            userStats.won += 1;
            userStats.totalScore += message.data.score;
            userStats.currentStreak += 1;
            if (userStats.currentStreak > userStats.maxStreak) {
              userStats.maxStreak = userStats.currentStreak;
            }
            const userClueKey = `clue${message.data.cluesRevealed}` as keyof typeof userStats;
            if (userClueKey in userStats) userStats[userClueKey] += 1;
            await context.redis.set(userStatsKey, JSON.stringify(userStats));

            // Send updated stats back to webview
            webView.postMessage({
              type: 'userStats' as any,
              data: userStats,
            });
            break;
          }

          default:
            break;
        }
      },

      onUnmount() {
        // No-op
      },
    });

    // ─── Blocks UI — Hub Screen ───

    const wordLength = puzzleData?.word.replace(/[\s-]/g, '').length ?? '?';
    const categoryDisplay = puzzleData?.category ?? 'Mystery';
    const isDaily = puzzleData?.author === 'CluesWord Bot';
    const puzzleLabel = isDaily ? '⭐ TODAY\'S PUZZLE' : '✏️ COMMUNITY PUZZLE';
    const puzzleCardBg = isDaily ? '#2a1f4e' : '#1f3d4e';
    const puzzleLabelColor = isDaily ? '#f0d060' : '#60d0b0';
    const puzzleTextColor = isDaily ? '#e8dff5' : '#d4eef0';
    const puzzleSubColor = isDaily ? '#b0a3cc' : '#8cb8c4';

    return (
      <vstack grow padding="medium" backgroundColor="#1a1128">
        <vstack grow alignment="middle center" gap="medium">

          {/* Header */}
          <vstack alignment="center middle" gap="small">
            <text size="xxlarge" weight="bold" color="#e8dff5">
              🧩 CluesWord
            </text>
            <text size="small" color="#b0a3cc">
              Guess the word from progressive clues!
            </text>
          </vstack>

          {/* Daily/Custom puzzle section */}
          {puzzleData ? (
            <vstack alignment="center middle" padding="xsmall" backgroundColor={isDaily ? '#f0d060' : 'transparent'} cornerRadius="large" width={100}>
            <vstack alignment="center middle" gap="small" padding="medium" backgroundColor={puzzleCardBg} cornerRadius="large" width={100}>
              <text size="small" weight="bold" color={puzzleLabelColor}>
                {puzzleLabel}
              </text>
              <hstack alignment="center middle" gap="small">
                <text size="xlarge" weight="bold" color={puzzleTextColor}>
                  {categoryDisplay}
                </text>
                <text size="medium" color={puzzleSubColor}>
                  · {wordLength} letters
                </text>
              </hstack>
              {isDaily ? (
                <text size="small" color={puzzleSubColor}>
                  {playCount} {playCount === 1 ? 'play' : 'plays'}
                </text>
              ) : puzzleData.author ? (
                <text size="small" color={puzzleSubColor}>
                  by u/{puzzleData.author} · {playCount} {playCount === 1 ? 'play' : 'plays'}
                </text>
              ) : (
                <text size="small" color={puzzleSubColor}>
                  {playCount} {playCount === 1 ? 'play' : 'plays'}
                </text>
              )}
              {puzzleStats && puzzleStats.solves > 0 ? (
                <text size="small" color={puzzleSubColor}>
                  Avg: {Math.round(puzzleStats.totalScore / puzzleStats.solves)} pts · {(puzzleStats.totalGuesses / puzzleStats.solves).toFixed(1)} tries
                </text>
              ) : null}
              <button
                appearance="primary"
                onPress={() => {
                  setLaunchMode('custom');
                  webView.mount();
                }}
              >
                🎯 Play Puzzle
              </button>
            </vstack>
            </vstack>
          ) : null}

          {/* Quick Play + Create side by side */}
          <hstack gap="medium" width={100}>
            <vstack alignment="center middle" gap="small" padding="medium" backgroundColor="#2e1a4e" cornerRadius="large" grow>
              <text size="xlarge">🎲</text>
              <text size="medium" weight="bold" color="#d0c0f0">
                Quick Play
              </text>
              <text size="xsmall" color="#9a88bb" alignment="center">
                Random puzzles from 5 categories
              </text>
              <button
                appearance="primary"
                onPress={() => {
                  setLaunchMode('quickplay');
                  webView.mount();
                }}
              >
                Play Now
              </button>
            </vstack>

            <vstack alignment="center middle" gap="small" padding="medium" backgroundColor="#1f3d4e" cornerRadius="large" grow>
              <text size="xlarge">✏️</text>
              <text size="medium" weight="bold" color="#d4eef0">
                Create
              </text>
              <text size="xsmall" color="#8cb8c4" alignment="center">
                Write clues for others to solve
              </text>
              <button
                appearance="primary"
                onPress={() => {
                  setLaunchMode('create');
                  webView.mount();
                }}
              >
                Create
              </button>
            </vstack>
          </hstack>

        </vstack>
      </vstack>
    );
  },
});

export default Devvit;
