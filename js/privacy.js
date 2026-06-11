// js/privacy.js — Менеджер приватності та Матриця доступу (Privacy & Security)
// Цей модуль відповідає за те, хто і що може бачити в мережі ERA

const PrivacyManager = {

  /**
   * Визначає статус відносин між двома користувачами
   * Використовується для побудови Матриці доступу
   */
  async getRelationship(viewerId, ownerId) {
    if (!viewerId) return 'NONE';
    if (viewerId === ownerId) return 'OWNER';

    // В майбутньому тут буде запит до Supabase таблиці 'permissions'
    // Зараз імітуємо через існуючу логіку соціальних зв'язків
    const isF = getFollowStatus(ownerId) === 'following';
    const isFollowerOfMe = FOLLOWERS.get(viewerId) === true;

    // Перевірка на "Друзів" (взаємна підписка)
    if (isF && isFollowerOfMe) return 'FRIEND';
    if (isF) return 'FOLLOWING';
    if (isFollowerOfMe) return 'FOLLOWER';

    const isReq = getFollowStatus(ownerId) === 'requested';
    if (isReq) return 'REQUESTED';

    return 'NONE';
  },

  /**
   * Універсальна перевірка: чи може користувач бачити контент іншого користувача
   */
  async canUserViewContent(viewerId, ownerId, contentType = 'posts') {
    const owner = getUser(ownerId);
    const rel = await this.getRelationship(viewerId, ownerId);

    // Власник завжди бачить свій контент
    if (rel === 'OWNER') return true;
    if (rel === 'BLOCKED') return false;

    const privacy = owner.privacy || 'public';

    // Публічні акаунти бачать усі
    if (privacy === 'public') return true;

    // Приватні акаунти бачать лише схвалені підписники (Action 1) або друзі
    if (privacy === 'private') {
      return rel === 'FOLLOWER' || rel === 'FRIEND';
    }

    return false;
  },

  /**
   * Перевірка: чи може користувач залишати коментарі
   */
  async canComment(viewerId, ownerId) {
    const rel = await this.getRelationship(viewerId, ownerId);
    // Коментувати можуть лише ті, хто має доступ до перегляду (не заблоковані і не сторонні для приватних)
    const canView = await this.canUserViewContent(viewerId, ownerId);
    return canView && !['BLOCKED', 'NONE', 'REQUESTED'].includes(rel);
  },

  /**
   * Оновлення статусу приватності акаунта (Public/Private)
   */
  async updatePrivacyState(userId, newState) {
    // newState: 'public' | 'private'
    if (!APP.user || APP.user.id !== userId) return;

    APP.user.privacy = newState;
    if (!APP.user.settings) APP.user.settings = {};
    APP.user.settings.private = (newState === 'private');

    await saveUserData();

    // Якщо акаунт стає публічним — всі запити на підписку можна автоматично схвалити
    if (newState === 'public') {
      // Логіка для автоматичного схвалення або видалення запитів
    }
  },

  /**
   * Блокування користувача (повне розірвання зв'язків)
   */
  async blockUser(userId, targetId) {
    // В майбутньому — запит до Supabase для видалення пермішенів
    FOLLOWS.delete(targetId);
    FOLLOWERS.delete(targetId);
    await saveFollowsToStorage();

    // Повідомляємо систему
    showToast('Користувача заблоковано');
  }
};
