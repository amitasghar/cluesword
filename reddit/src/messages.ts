/**
 * Message types for communication between Devvit backend and webview.
 *
 * WebViewMessage: webview → Devvit (sent via parent.postMessage)
 * DevvitMessage:  Devvit → webview (sent via webView.postMessage)
 */

// === Webview → Devvit ===

export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'getGameState'; data: { key: string } }
  | { type: 'setGameState'; data: { key: string; value: string } }
  | { type: 'removeGameState'; data: { key: string } }
  | { type: 'saveScore'; data: { postId: string; score: number; cluesRevealed: number; guesses: string[] } }
  | { type: 'shareAsComment'; data: { text: string } }
  | { type: 'requestQuickPlayPuzzle'; data: { category: string } }
  | { type: 'createPuzzle'; data: { word: string; category: string; clue1: string; clue2: string; clue3: string; factoid: string } };

// === Devvit → Webview ===

export type DevvitMessage =
  | { type: 'initialData'; data: { username: string; puzzle: PuzzleData | null; mode: string; postId: string } }
  | { type: 'gameStateResponse'; data: { key: string; value: string | null } }
  | { type: 'gameStateSaved'; data: { key: string; success: boolean } }
  | { type: 'quickPlayPuzzle'; data: { puzzle: PuzzleData } }
  | { type: 'error'; data: { message: string } }
  | { type: 'puzzleCreated'; data: { success: boolean; message: string; postUrl?: string } };

// === Shared types ===

export interface PuzzleData {
  [key: string]: unknown; // Index signature for JSONValue compatibility
  id: string;
  category: string;
  word: string;
  clues: [string, string, string];
  factoid?: string;
  author?: string;
}

/**
 * System wrapper that Devvit uses for postMessage.
 * Webview receives messages in this envelope.
 */
export type DevvitSystemMessage = {
  type: 'devvit-message';
  data: { message: DevvitMessage };
};
