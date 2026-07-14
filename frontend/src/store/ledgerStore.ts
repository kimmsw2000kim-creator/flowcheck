import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { fetchCreditsLedger } from '../api/paymentApi';
import { supabase } from '../lib/supabaseClient';
import type { LedgerItem } from '../types/payment';

type LedgerStatus = 'idle' | 'loading' | 'ready' | 'error';
type OptimisticLedgerInput = Omit<LedgerItem, 'id' | 'createdAt' | 'source'>;

interface LedgerState {
  serverEntries: LedgerItem[];
  optimisticEntries: LedgerItem[];
  entries: LedgerItem[];
  status: LedgerStatus;
  error: string | null;
  ownerUserId: string | null;
  requestGeneration: number;
  loadForSession: (session: Session, signal?: AbortSignal) => Promise<void>;
  refreshServerEntries: () => Promise<void>;
  addOptimisticReward: (entry: OptimisticLedgerInput) => void;
  clear: () => void;
}

let nextOptimisticId = -1;

function withSource(entries: LedgerItem[]): LedgerItem[] {
  return entries.map((entry) => ({ ...entry, source: 'server' as const }));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '원장 정보를 불러오지 못했습니다.';
}

export const useLedgerStore = create<LedgerState>((set, get) => {
  const loadEntries = async (session: Session, signal?: AbortSignal) => {
    const ownerUserId = session.user.id;
    const requestGeneration = get().requestGeneration + 1;

    set({
      status: 'loading',
      error: null,
      ownerUserId,
      requestGeneration,
    });

    try {
      const serverEntries = withSource(await fetchCreditsLedger({
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal,
      }));
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const state = get();

      if (
        signal?.aborted ||
        currentSession?.user.id !== ownerUserId ||
        currentSession.access_token !== session.access_token ||
        state.requestGeneration !== requestGeneration ||
        state.ownerUserId !== ownerUserId
      ) {
        return;
      }

      set({
        serverEntries,
        entries: [...state.optimisticEntries, ...serverEntries],
        status: 'ready',
        error: null,
      });
    } catch (error) {
      if (signal?.aborted) return;
      const state = get();
      if (state.requestGeneration !== requestGeneration || state.ownerUserId !== ownerUserId) return;

      set({ status: 'error', error: getErrorMessage(error) });
      throw error;
    }
  };

  return {
    serverEntries: [],
    optimisticEntries: [],
    entries: [],
    status: 'idle',
    error: null,
    ownerUserId: null,
    requestGeneration: 0,
    loadForSession: loadEntries,
    refreshServerEntries: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) {
        get().clear();
        return;
      }
      await loadEntries(session);
    },
    addOptimisticReward: (entry) => {
      const ownerUserId = get().ownerUserId;
      if (!ownerUserId) return;

      const optimisticEntry: LedgerItem = {
        ...entry,
        id: nextOptimisticId--,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        source: 'optimistic',
      };

      set((state) => {
        const optimisticEntries = [optimisticEntry, ...state.optimisticEntries];
        return {
          optimisticEntries,
          entries: [...optimisticEntries, ...state.serverEntries],
        };
      });
    },
    clear: () => {
      nextOptimisticId = -1;
      set((state) => ({
        serverEntries: [],
        optimisticEntries: [],
        entries: [],
        status: 'idle',
        error: null,
        ownerUserId: null,
        requestGeneration: state.requestGeneration + 1,
      }));
    },
  };
});
