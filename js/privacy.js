// js/privacy.js — Privacy Manager and Access Matrix

const PrivacyManager = {

  /**
   * Determine the relationship status between two users.
   */
  async getRelationship(viewerId, ownerId) {
    if (!viewerId) return 'NONE';
    if (viewerId === ownerId) return 'OWNER';

    const { data: perms } = await supabase.from('permissions')
      .select('*')
      .match({ user_id: ownerId, target_id: viewerId })
      .maybeSingle();

    if (perms?.is_blocked) return 'BLOCKED';
    if (perms?.is_close_friend) return 'CLOSE_FRIEND';
    if (perms?.is_follower) return 'FOLLOWER';

    const { data: req } = await supabase.from('notifications')
      .select('*')
      .match({ actor_id: viewerId, recipient_id: ownerId, type: 'FOLLOW_REQUEST' })
      .maybeSingle();

    if (req) return 'REQUESTED';

    return 'NONE';
  },

  /**
   * Universal check for viewing content.
   */
  async canUserViewContent(viewerId, ownerId, contentType = 'posts') {
    const owner = await getUser(ownerId);
    const rel = await this.getRelationship(viewerId, ownerId);

    if (rel === 'OWNER') return true;
    if (rel === 'BLOCKED') return false;

    const privacy = owner.privacy_state || 'PUBLIC';

    if (privacy === 'PUBLIC') return true;
    if (privacy === 'PRIVATE') return rel === 'FOLLOWER' || rel === 'CLOSE_FRIEND';

    return false;
  },

  /**
   * Checks if user can comment on a target's content.
   */
  async canComment(viewerId, ownerId) {
    const rel = await this.getRelationship(viewerId, ownerId);
    return !['BLOCKED', 'NONE', 'REQUESTED'].includes(rel);
  },

  async canDM(viewerId, ownerId) {
    const rel = await this.getRelationship(viewerId, ownerId);
    return ['OWNER', 'CLOSE_FRIEND', 'FOLLOWER'].includes(rel);
  },

  // ── Privacy State Transitions ──────────────────────────────

  /**
   * Elevate privacy or handle transitions like switching to Public.
   */
  async updatePrivacyState(userId, newState) {
    const user = await getUser(userId);
    const oldState = user.privacy_state;

    const { error } = await supabase.from('profiles')
      .update({ privacy_state: newState })
      .eq('id', userId);

    if (error) return;

    if (newState === 'PUBLIC' && oldState === 'PRIVATE') {
      // Delete all pending follow requests as they are no longer needed
      await supabase.from('notifications')
        .delete()
        .match({ recipient_id: userId, type: 'FOLLOW_REQUEST' });
    }
  },

  /**
   * Block a user: removes all permissions and followership.
   */
  async blockUser(userId, targetId) {
    // Remove existing permissions both ways
    await supabase.from('permissions').delete().or(`and(user_id.eq.${userId},target_id.eq.${targetId}),and(user_id.eq.${targetId},target_id.eq.${userId})`);

    // Add block entry
    await supabase.from('permissions').insert([{
      user_id: userId,
      target_id: targetId,
      is_blocked: true,
      is_follower: false
    }]);

    // Also delete requests
    await supabase.from('notifications').delete().or(`and(actor_id.eq.${userId},recipient_id.eq.${targetId}),and(actor_id.eq.${targetId},recipient_id.eq.${userId})`).eq('type', 'FOLLOW_REQUEST');
  }
};
