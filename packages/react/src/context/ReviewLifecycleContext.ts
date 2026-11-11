import { createContext } from 'react';

/** Lets an outer guide provider observe the accepted review, including initial response loads. */
export const ReviewLifecycleContext = createContext<((identity: string) => void) | null>(null);
