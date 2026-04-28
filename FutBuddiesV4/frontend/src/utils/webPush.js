// ============================================================
//  Web Push — helpers no cliente
// ============================================================
import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function webPushSuportado() {
  return typeof window !== 'undefined' &&
         'serviceWorker' in navigator &&
         'PushManager'   in window &&
         'Notification'  in window;
}

export async function estadoSubscricao() {
  if (!webPushSuportado()) return { suportado: false, ativa: false, permissao: 'unsupported' };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return {
    suportado: true,
    ativa: !!sub,
    permissao: Notification.permission, // 'default' | 'granted' | 'denied'
  };
}

export async function subscreverPush() {
  if (!webPushSuportado()) throw new Error('Browser não suporta Web Push.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permissão de notificações recusada.');

  const { data } = await api.get('/push/vapid-public-key');
  if (!data?.key) throw new Error('Servidor sem VAPID configurado.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.key),
    });
  }
  await api.post('/push/subscrever', sub.toJSON());
  return true;
}

export async function desinscreverPush() {
  if (!webPushSuportado()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try { await api.post('/push/desinscrever', { endpoint: sub.endpoint }); } catch {}
  await sub.unsubscribe();
}
