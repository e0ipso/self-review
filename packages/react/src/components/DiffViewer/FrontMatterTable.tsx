import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface FrontMatterTableProps {
  metadata: Record<string, unknown>;
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null) {
    return <span className="italic text-muted-foreground">null</span>;
  }

  if (typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="m-0 list-disc pl-5">
        {value.map((item, index) => (
          <li key={index}>{renderValue(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <Table className="mt-1">
        <TableBody>
          {entries.map(([key, val]) => (
            <TableRow key={key}>
              <TableCell className="font-medium">{key}</TableCell>
              <TableCell>{renderValue(val)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return <span>{String(value)}</span>;
}

export default function FrontMatterTable({ metadata }: FrontMatterTableProps) {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 not-prose">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">Key</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key}>
              <TableCell className="font-medium align-top">{key}</TableCell>
              <TableCell>{renderValue(value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
