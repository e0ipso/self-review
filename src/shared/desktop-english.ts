import type { LocalizedMessage } from '../../packages/react/src/localization/formatter';

export const DESKTOP_ENGLISH: Record<string, LocalizedMessage> = {
  'Review size': {
    plural: 'files',
    forms: {
      one: {
        plural: 'lines',
        forms: {
          one: 'This review contains {files} file and approximately {lines} line.',
          other: 'This review contains {files} file and approximately {lines} lines.',
        },
      },
      other: {
        plural: 'lines',
        forms: {
          one: 'This review contains {files} files and approximately {lines} line.',
          other: 'This review contains {files} files and approximately {lines} lines.',
        },
      },
    },
  },
  'Review thresholds': {
    plural: 'files',
    forms: {
      one: {
        plural: 'lines',
        forms: {
          one: 'Thresholds: {files} file, {lines} line.\n\nLarge reviews may be slow. Continue in large-payload mode?',
          other:
            'Thresholds: {files} file, {lines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?',
        },
      },
      other: {
        plural: 'lines',
        forms: {
          one: 'Thresholds: {files} files, {lines} line.\n\nLarge reviews may be slow. Continue in large-payload mode?',
          other:
            'Thresholds: {files} files, {lines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?',
        },
      },
    },
  },
};
