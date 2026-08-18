import { auth } from '@/infrastructure/_legacy_firebase/client';

export async function apiFetch(url, options = {}) {
  const user = auth.currentUser;
  let token = '';
  
  if (user) {
    token = await user.getIdToken();
  } else if (process.env.NODE_ENV === 'development') {
    token = 'mock-token';
  }

  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}
