import { useEffect } from 'react';
import SSHBus, { ConnectionStatus } from '../workflow/ssh_bus';


/**
 * Hook for subscribing to any SSH connection status change
 * 
 * @param callback - Function to call when any connection status changes
 */
export function useAnySSHConnectionChange(
  callback: (data: { connectionString: string, status: ConnectionStatus }) => void
) {
  useEffect(() => {
    const unsubscribe = SSHBus.get().subscribeAnyConnectionStatus(callback);
    
    return () => {
      unsubscribe();
    };
  }, [callback]);
} 