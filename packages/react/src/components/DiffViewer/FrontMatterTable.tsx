import React, { useMemo } from 'react';
import { useLocalization, type MessageKey } from '../../localization/LocalizationContext';
import { Table, TableBody, TableCell, TableHead, TableRow } from '../ui/table';
import { Separator } from '../ui/separator';
import {
  buildFrontMatterDisplay,
  type FrontMatterDisplayValue,
  type FrontMatterLimitReason,
} from '../../utils/front-matter';

interface FrontMatterTableProps {
  metadata: Record<string, unknown>;
}

const LIMIT_DESCRIPTIONS: Record<FrontMatterLimitReason, MessageKey> = {
  cycle:
    'Front matter too complex to display: it refers to itself. The document body is shown below.',
  depth:
    'Front matter too complex to display: it is nested too deeply. The document body is shown below.',
  nodes:
    'Front matter too complex to display: it has too many values. The document body is shown below.',
};

// Recursion is bounded: the display tree is acyclic and at most FRONT_MATTER_MAX_DEPTH deep.
function renderValue(
  value: FrontMatterDisplayValue,
  t: ReturnType<typeof useLocalization>['t']
): React.ReactNode {
  switch (value.kind) {
    case 'null':
      return <span className='italic text-muted-foreground'>{t('null')}</span>;
    case 'scalar':
      return <span>{value.text}</span>;
    case 'list':
      return (
        <ul className='m-0 list-disc pl-5'>
          {value.items.map((item, index) => (
            <li key={index}>{renderValue(item, t)}</li>
          ))}
        </ul>
      );
    case 'map':
      return (
        <Table className='mt-1'>
          <TableBody>
            {value.entries.map(([key, val]) => (
              <TableRow key={key}>
                <TableHead className='font-medium'>{key}</TableHead>
                <TableCell>{renderValue(val, t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
  }
}

export default function FrontMatterTable({ metadata }: FrontMatterTableProps) {
  const { t } = useLocalization();
  const display = useMemo(() => buildFrontMatterDisplay(metadata), [metadata]);

  if (display.ok && display.entries.length === 0) {
    return null;
  }

  return (
    <div className='not-prose'>
      {display.ok ? (
        <Table>
          <TableBody>
            {display.entries.map(([key, value]) => (
              <TableRow key={key}>
                <TableHead className='font-bold w-[120px]'>{key}</TableHead>
                <TableCell>{renderValue(value, t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div
          role='note'
          data-testid='front-matter-fallback'
          className='text-sm text-muted-foreground p-2 border border-border rounded'
        >
          {'reason' in display && t(LIMIT_DESCRIPTIONS[display.reason])}
        </div>
      )}
      <Separator className='my-6' />
    </div>
  );
}
