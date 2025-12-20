
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type HuddlePlay = Tables<'huddle_plays'>;
export type HuddlePlayInsert = TablesInsert<'huddle_plays'>;
type PeopleOverrideInsert = TablesInsert<'people_overrides'>;
type HuddlePersonOverrideInsert = TablesInsert<'huddle_person_overrides'>;

export const saveHuddlePlay = async (huddlePlay: Omit<HuddlePlayInsert, 'user_id'>): Promise<HuddlePlay | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('huddle_plays')
      .insert({
        ...huddlePlay,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving huddle play:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in saveHuddlePlay:', error);
    return null;
  }
};

export const getUserHuddlePlays = async (limit: number = 100): Promise<HuddlePlay[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('huddle_plays')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching huddle plays:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserHuddlePlays:', error);
    return [];
  }
};

export const updateHuddlePlayFinalReply = async (id: string, finalReply: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('huddle_plays')
      .update({ 
        final_reply: finalReply,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating huddle play:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateHuddlePlayFinalReply:', error);
    return false;
  }
};

export const getPeopleOverrides = async (): Promise<Record<string, string>> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('people_overrides')
      .select('raw_name, override')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching people overrides:', error);
      return {};
    }

    return (data || []).reduce<Record<string, string>>((acc, row) => {
      acc[row.raw_name] = row.override;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error in getPeopleOverrides:', error);
    return {};
  }
};

export const savePeopleOverrides = async (
  overrides: { raw_name: string; override: string }[]
): Promise<boolean> => {
  if (!overrides.length) return true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const payload: PeopleOverrideInsert[] = overrides.map((entry) => ({
      user_id: user.id,
      raw_name: entry.raw_name,
      override: entry.override,
    }));

    const { error } = await supabase
      .from('people_overrides')
      .upsert(payload, { onConflict: 'user_id,raw_name' });

    if (error) {
      console.error('Error saving people overrides:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in savePeopleOverrides:', error);
    return false;
  }
};

export const getHuddlePersonOverrides = async (): Promise<Record<string, string>> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('huddle_person_overrides')
      .select('huddle_play_id, override')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching huddle person overrides:', error);
      return {};
    }

    return (data || []).reduce<Record<string, string>>((acc, row) => {
      acc[row.huddle_play_id] = row.override;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error in getHuddlePersonOverrides:', error);
    return {};
  }
};

export const saveHuddlePersonOverride = async (
  huddlePlayId: string,
  override: string,
  rawName?: string
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const payload: HuddlePersonOverrideInsert = {
      user_id: user.id,
      huddle_play_id: huddlePlayId,
      override,
      raw_name: rawName ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('huddle_person_overrides')
      .upsert(payload, { onConflict: 'user_id,huddle_play_id' });

    if (error) {
      console.error('Error saving huddle person override:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveHuddlePersonOverride:', error);
    return false;
  }
};

export const clearHuddlePersonOverride = async (huddlePlayId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('huddle_person_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('huddle_play_id', huddlePlayId);

    if (error) {
      console.error('Error clearing huddle person override:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in clearHuddlePersonOverride:', error);
    return false;
  }
};
