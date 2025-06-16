
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type HuddlePlay = Tables<'huddle_plays'>;
export type HuddlePlayInsert = TablesInsert<'huddle_plays'>;

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
