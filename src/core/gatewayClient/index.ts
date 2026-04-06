import { loadGatewayBootstrapConfig } from './bootstrap';
import { NativeGatewayClient } from './gatewayClient';

export * from './types';
export { NativeGatewayClient };

let sharedClient: NativeGatewayClient | null = null;

export function createNativeGatewayClient() {
  if (!sharedClient) {
    sharedClient = new NativeGatewayClient(loadGatewayBootstrapConfig);
  }
  return sharedClient;
}
