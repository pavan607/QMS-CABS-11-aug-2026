/** Mark observation thread read and clear related bell notifications. */
export async function acknowledgeObservationChat(threadId: number): Promise<void> {
  await fetch(`/api/observation-chats/${threadId}/read`, { method: 'POST' });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('observation-chat-acknowledged'));
  }
}

export const OBSERVATION_CHAT_ACK_EVENT = 'observation-chat-acknowledged';
