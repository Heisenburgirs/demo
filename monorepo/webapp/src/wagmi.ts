import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  celo,
  celoAlfajores,
  base,
  baseSepolia
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Flowcentive',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    base,
    baseSepolia,
    celo,
    celoAlfajores,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [celoAlfajores] : []),
  ],
  ssr: true,
});