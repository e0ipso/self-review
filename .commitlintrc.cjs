/**
 * Commitlint configuration with custom AI attribution prevention rules
 */

const { execSync } = require('child_process');

const aiKeywords = [
  'anthropic',
  'claude',
  'openai',
  'chatgpt',
  'copilot',
  'gemini',
  'codex',
  'gpt-',
  'ai-',
  'assistant',
  'bot@',
];

const aiTools = [
  'aider',
  'amp',
  'anthropic',
  'chatgpt',
  'claude',
  'codex',
  'copilot',
  'cursor',
  'devin',
  'gemini',
  'jules',
  'openai',
  'opencode',
  'qwen',
  'windsurf',
].join('|');

// Unicode-aware word boundaries, so "Ampère" or "OpenCoder" don't match.
const tool = `(?<![\\p{L}\\p{N}])(?:${aiTools})(?![\\p{L}\\p{N}])`;

const forbiddenPatterns = [
  // Any co-author, human or not.
  /^Co-authored-by:.*/im,
  // Made-with: Cursor, Assisted-by: Claude:claude-opus-5-5, ...
  new RegExp(`^(?:Assisted-by|Generated-by|Made-with|Signed-off-by):.*${tool}`, 'imu'),
  // Tool-specific trailers: Copilot-Session: ..., Amp-Thread: ...
  new RegExp(`^${tool}-[\\w-]+:`, 'imu'),
  // 🤖 Generated with [Claude Code](https://claude.com/claude-code)
  new RegExp(`(?:Generated|Made) (?:with|by|using)\\b.*${tool}`, 'iu'),
];

// Sift ticket IDs point at a private tracker. Built from parts so this file
// doesn't contain one.
const ticketId = new RegExp(['DASH', '-', '\\d{4}'].join(''));

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-ai-generated': parsed => {
          const message = parsed.raw;

          for (const pattern of forbiddenPatterns) {
            const match = message.match(pattern);
            if (match) {
              return [
                false,
                `Commit message contains forbidden AI-generated content: "${match[0]}"`,
              ];
            }
          }

          return [true, ''];
        },

        'no-sift-ticket-ids': parsed => {
          const match = parsed.raw.match(ticketId);
          if (match) {
            return [
              false,
              `Commit message cites a sift ticket ID, which is private: "${match[0]}"`,
            ];
          }

          return [true, ''];
        },

        'no-ai-author-email': () => {
          // Get author email from git config or environment
          let email;

          try {
            email =
              process.env.GIT_AUTHOR_EMAIL ||
              execSync('git config user.email', { encoding: 'utf-8' }).trim();
          } catch (e) {
            // If we can't get the email, skip this check
            return [true];
          }

          const emailLower = email.toLowerCase();

          for (const keyword of aiKeywords) {
            if (emailLower.includes(keyword)) {
              return [
                false,
                `Commit author email contains AI-related keyword "${keyword}". Please configure git with a proper author email: git config user.email "your@email.com"`,
              ];
            }
          }

          return [true];
        },
      },
    },
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 100],
    'no-ai-generated': [2, 'always'],
    'no-sift-ticket-ids': [2, 'always'],
    'no-ai-author-email': [2, 'always'],
  },
};
