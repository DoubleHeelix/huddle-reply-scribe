
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type HuddlePlay = Tables<'huddle_plays'>;
export type HuddlePlayInsert = TablesInsert<'huddle_plays'>;
type PeopleOverrideInsert = TablesInsert<'people_overrides'>;
type HuddlePersonOverrideInsert = TablesInsert<'huddle_person_overrides'>;
type TrelloBoardPositionInsert = TablesInsert<'trello_board_positions'>;
type TrelloBoardPositionRow = Tables<'trello_board_positions'>;

export type HuddlePlayPreview = Pick<
  HuddlePlay,
  'id' | 'created_at' | 'user_id' | 'final_reply' | 'selected_tone'
> & {
  screenshot_text?: string | null;
  user_draft?: string | null;
  generated_reply?: string | null;
};

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

export const getHuddlePlayDetail = async (id: string): Promise<HuddlePlay | null> => {
  try {
    const { data, error } = await supabase
      .from('huddle_plays')
      .select('id, created_at, updated_at, user_id, screenshot_text, user_draft, generated_reply, final_reply, selected_tone')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching huddle play detail:', error);
      return null;
    }

    return data as HuddlePlay;
  } catch (error) {
    console.error('Error in getHuddlePlayDetail:', error);
    return null;
  }
};

export const getHuddlePlayPreviews = async (
  page: number = 0,
  pageSize: number = 25,
  maxRows: number = 100
): Promise<HuddlePlayPreview[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const safePageSize = Math.max(1, Math.min(pageSize, maxRows));
    const start = Math.max(0, page * safePageSize);
    if (start >= maxRows) {
      return [];
    }
    const end = Math.min(start + safePageSize - 1, maxRows - 1);

    const { data, error } = await supabase
      .from('huddle_plays')
      .select('id, created_at, user_id, final_reply, selected_tone, screenshot_text, user_draft, generated_reply')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) {
      console.error('Error fetching huddle play previews:', error);
      throw error;
    }

    return (data || []) as HuddlePlayPreview[];
  } catch (error) {
    console.error('Error in getHuddlePlayPreviews:', error);
    return [];
  }
};

export const getUserHuddlePlays = async (
  page: number = 0,
  pageSize: number = 25,
  maxRows: number = 100
): Promise<HuddlePlay[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const safePageSize = Math.max(1, Math.min(pageSize, maxRows));
    const start = Math.max(0, page * safePageSize);
    if (start >= maxRows) {
      return [];
    }
    const end = Math.min(start + safePageSize - 1, maxRows - 1);

    const { data, error } = await supabase
      .from('huddle_plays')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(start, end);

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

export const deletePersonAssociations = async (name: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Remove people_overrides entries where the raw name or override matches.
    const { error: peopleRawError } = await supabase
      .from('people_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('raw_name', name);
    if (peopleRawError) {
      console.error('Error deleting people overrides (raw_name) for name:', name, peopleRawError);
    }

    const { error: peopleOverrideError } = await supabase
      .from('people_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('override', name);
    if (peopleOverrideError) {
      console.error('Error deleting people overrides (override) for name:', name, peopleOverrideError);
    }

    // Remove per-huddle overrides that match this name.
    const { error: huddleOverrideError } = await supabase
      .from('huddle_person_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('override', name);
    if (huddleOverrideError) {
      console.error('Error deleting huddle person overrides (override) for name:', name, huddleOverrideError);
    }

    const { error: huddleRawError } = await supabase
      .from('huddle_person_overrides')
      .delete()
      .eq('user_id', user.id)
      .eq('raw_name', name);
    if (huddleRawError) {
      console.error('Error deleting huddle person overrides (raw_name) for name:', name, huddleRawError);
    }
  } catch (error) {
    console.error('Error in deletePersonAssociations:', error);
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

export type TrelloBoardPosition = Pick<TrelloBoardPositionRow, 'name' | 'column_id' | 'mode'>;

export const getTrelloBoardPositions = async (): Promise<TrelloBoardPosition[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('trello_board_positions')
      .select('name, column_id, mode')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching trello board positions:', error);
      return [];
    }

    return (data || []) as TrelloBoardPosition[];
  } catch (error) {
    console.error('Error in getTrelloBoardPositions:', error);
    return [];
  }
};

export const upsertTrelloBoardPositions = async (
  positions: TrelloBoardPosition[]
): Promise<boolean> => {
  if (!positions.length) return true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const payload: TrelloBoardPositionInsert[] = positions.map((p) => ({
      user_id: user.id,
      name: p.name,
      column_id: p.column_id,
      mode: p.mode,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('trello_board_positions')
      .upsert(payload, { onConflict: 'user_id,name,mode' });

    if (error) {
      console.error('Error saving trello board positions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in upsertTrelloBoardPositions:', error);
    return false;
  }
};

export const deleteTrelloBoardPositions = async (
  names: string[],
  mode?: string
): Promise<boolean> => {
  if (!names.length) return true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('trello_board_positions')
      .delete()
      .eq('user_id', user.id)
      .in('name', names);

    if (mode) {
      query = query.eq('mode', mode);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting trello board positions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteTrelloBoardPositions:', error);
    return false;
  }
};

export const clearAllTrelloBoardPositions = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('trello_board_positions')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing trello board positions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in clearAllTrelloBoardPositions:', error);
    return false;
  }
};
