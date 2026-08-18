'use client';

import { SWRConfig } from 'swr';
import { toast } from 'sonner';

export function SWRProvider({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url) => fetch(url).then((res) => res.json()),
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        shouldRetryOnError: true,
        errorRetryCount: 3,
        errorRetryInterval: 3000,
        onError: (error, key) => {
          if (error.status !== 403 && error.status !== 404) {
            console.error(`SWR Fetch Error [${key}]:`, error);
            // We only show a toast for actual systemic failures, not simple empty states
            if (error.message && error.message !== 'Failed to fetch') {
              toast.error(`Network Error: ${error.message}`);
            }
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
