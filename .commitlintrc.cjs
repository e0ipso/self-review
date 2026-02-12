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

const aiAttributionPatterns = [
  /🤖.*generated/i,
  /co-authored-by:.*claude/i,
  /co-authored-by:.*anthropic/i,
  /co-authored-by:.*openai/i,
  /co-authored-by:.*copilot/i,
  /co-authored-by:.*gemini/i,
  /generated\s+with.*claude/i,
  /generated\s+with.*chatgpt/i,
  /generated\s+with.*copilot/i,
  /ai-generated/i,
  /generated\s+by\s+ai/i,
];

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-ai-attribution': (parsed) => {
          const { body, footer } = parsed;
          const fullMessage = [body, footer].filter(Boolean).join('\n');

          for (const pattern of aiAttributionPatterns) {
            if (pattern.test(fullMessage)) {
              return [
                false,
                'Commit message contains AI attribution. Please remove AI-generated markers and attribution lines.',
              ];
            }
          }

          return [true];
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
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'],
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
    'no-ai-attribution': [2, 'always'],
    'no-ai-author-email': [2, 'always'],
  },
};
