
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type HuddlePlay = Tables<'huddle_plays'>;
export type HuddlePlayInsert = TablesInsert<'huddle_plays'>;
type PeopleOverrideInsert = TablesInsert<'people_overrides'>;
type HuddlePersonOverrideInsert = TablesInsert<'huddle_person_overrides'>;

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
  maxRows: number = 100,
  screenshotSnippet?: number
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

    const screenshotSelect = screenshotSnippet
      ? `screenshot_text:left(screenshot_text, ${Math.max(1, screenshotSnippet)})`
      : 'screenshot_text';

    const { data, error } = await supabase
      .from('huddle_plays')
      .select(`id, created_at, user_id, final_reply, selected_tone, user_draft, generated_reply, ${screenshotSelect}`)
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

export const deleteHuddlePlaysByName = async (name: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ids = new Set<string>();

    // Grab ids from person overrides matching this name.
    const { data: overrideMatches, error: overrideMatchError } = await supabase
      .from('huddle_person_overrides')
      .select('huddle_play_id')
      .eq('user_id', user.id)
      .or(`override.eq.${name},raw_name.eq.${name}`);
    if (overrideMatchError) {
      console.error('Error fetching override matches for deletion', overrideMatchError);
    } else {
      (overrideMatches || []).forEach((row: { huddle_play_id: string }) => ids.add(row.huddle_play_id));
    }

    // Grab ids whose screenshot_text contains the name (best-effort).
    const { data: screenshotMatches, error: screenshotError } = await supabase
      .from('huddle_plays')
      .select('id')
      .eq('user_id', user.id)
      .ilike('screenshot_text', `%${name}%`);
    if (screenshotError) {
      console.error('Error fetching screenshot matches for deletion', screenshotError);
    } else {
      (screenshotMatches || []).forEach((row: { id: string }) => ids.add(row.id));
    }

    const idList = Array.from(ids);
    if (!idList.length) return;

    const { error: deleteError } = await supabase
      .from('huddle_plays')
      .delete()
      .eq('user_id', user.id)
      .in('id', idList);

    if (deleteError) {
      console.error('Error deleting huddle plays by name:', deleteError);
    }
  } catch (error) {
    console.error('Error in deleteHuddlePlaysByName:', error);
  }
};

export const getTrelloNamePositions = async (): Promise<Record<string, string>> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('trello_name_positions')
      .select('name, column_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching trello name positions:', error);
      return {};
    }

    return (data || []).reduce<Record<string, string>>((acc, row) => {
      acc[row.name] = row.column_id;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error in getTrelloNamePositions:', error);
    return {};
  }
};

export const saveTrelloNamePosition = async (name: string, columnId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      name,
      column_id: columnId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('trello_name_positions')
      .upsert(payload, { onConflict: 'user_id,name' });

    if (error) {
      console.error('Error saving trello name position:', error);
    }
  } catch (error) {
    console.error('Error in saveTrelloNamePosition:', error);
  }
};

export const deleteTrelloNamePosition = async (name: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('trello_name_positions')
      .delete()
      .eq('user_id', user.id)
      .eq('name', name);

    if (error) {
      console.error('Error deleting trello name position:', error);
    }
  } catch (error) {
    console.error('Error in deleteTrelloNamePosition:', error);
  }
};

export const getTrelloBoardState = async (): Promise<Record<string, unknown>> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('trello_board_state')
      .select('board_state')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // no rows found
        console.error('Error fetching trello board state:', error);
      }
      return {};
    }

    return (data?.board_state as Record<string, unknown>) || {};
  } catch (error) {
    console.error('Error in getTrelloBoardState:', error);
    return {};
  }
};

export const saveTrelloBoardState = async (boardState: Record<string, unknown>): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      board_state: boardState,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('trello_board_state')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.error('Error saving trello board state:', error);
    }
  } catch (error) {
    console.error('Error in saveTrelloBoardState:', error);
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
