const SESSION_KEY = 'session_uid';

export function getSessionUID() {
    let uid = sessionStorage.getItem(SESSION_KEY);
    if (!uid) {
        uid = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, uid);
    }
    return uid;
}