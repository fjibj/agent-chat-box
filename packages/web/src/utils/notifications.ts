/**
 * Browser notification utilities.
 * Handles permission requests and showing notifications with click-to-navigate.
 */

let onNavigate: ((path: string) => void) | null = null;

/**
 * Set the navigation callback (called from router context).
 */
export function setNavigationCallback(fn: (path: string) => void) {
  onNavigate = fn;
}

/**
 * Request notification permission if not already granted.
 */
export function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Check if notifications are supported and permitted.
 */
export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Show a browser notification.
 * @param title - Notification title
 * @param body - Notification body text
 * @param navigateTo - Optional path to navigate to on click
 */
export function showNotification(title: string, body: string, navigateTo?: string): void {
  if (!canNotify()) return;

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: navigateTo || title, // Deduplicate by tag
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
    if (navigateTo && onNavigate) {
      onNavigate(navigateTo);
    }
  };
}

/**
 * Notify about task completion.
 */
export function notifyTaskComplete(taskTitle: string, _taskId: string): void {
  showNotification('Task Completed', taskTitle, `/tasks`);
}

/**
 * Notify about @mention in chat.
 */
export function notifyMention(senderName: string, _channelId: string): void {
  showNotification('Mentioned', `${senderName} mentioned you`, `/`);
}
