import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type AuthValue = {
  session: Session | null;
  ready: boolean;
  profiles: Map<string, Profile>;
  profileFor: (id?: string | null) => Profile | undefined;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  ready: false,
  profiles: new Map(),
  profileFor: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('user db')
      .select('id, username, display_name')
      .then(({ data }) => {
        if (!cancelled && data) {
          setProfiles(new Map((data as Profile[]).map((p) => [p.id, p])));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      ready,
      profiles,
      profileFor: (id) => (id ? profiles.get(id) : undefined),
    }),
    [session, ready, profiles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
