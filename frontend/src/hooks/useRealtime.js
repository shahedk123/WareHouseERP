import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function useRealtime(onInsert, onUpdate, onDelete) {
  const cbRef = useRef({ onInsert, onUpdate, onDelete });
  cbRef.current = { onInsert, onUpdate, onDelete };

  useEffect(() => {
    const channel = supabase
      .channel('pending_bills_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_bills' },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === 'INSERT') cbRef.current.onInsert?.(newRow);
          if (eventType === 'UPDATE') cbRef.current.onUpdate?.(newRow);
          if (eventType === 'DELETE') cbRef.current.onDelete?.(oldRow);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
