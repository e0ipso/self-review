import React, { useMemo } from 'react';
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

const LIMIT_DESCRIPTIONS: Record<FrontMatterLimitReason, string> = {
  cycle: 'it refers to itself',
  depth: 'it is nested too deeply',
  nodes: 'it has too many values',
};

// Recursion here is bounded: the display tree is acyclic and at most
// FRONT_MATTER_MAX_DEPTH levels deep by construction.
function renderValue(value: FrontMatterDisplayValue): React.ReactNode {
  switch (value.kind) {
    case 'null':
      return <span className='italic text-muted-foreground'>null</span>;
    case 'scalar':
      return <span>{value.text}</span>;
    case 'list':
      return (
        <ul className='m-0 list-disc pl-5'>
          {value.items.map((item, index) => (
            <li key={index}>{renderValue(item)}</li>
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
                <TableCell>{renderValue(val)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
  }
}

export default function FrontMatterTable({ metadata }: FrontMatterTableProps) {
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
                <TableCell>{renderValue(value)}</TableCell>
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
          Front matter too complex to display:{' '}
          {'reason' in display && LIMIT_DESCRIPTIONS[display.reason]}. The document body is shown
          below.
        </div>
      )}
      <Separator className='my-6' />
    </div>
  );
}
