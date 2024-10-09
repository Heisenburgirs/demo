import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';

const Home: NextPage = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 flex items-center justify-between bg-white shadow-md py-4 sticky top-0 z-10">
        <div className="text-2xl font-bold">Supercast</div>
        <ConnectButton />
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-8 overflow-auto">
        <h1 className="text-4xl font-bold text-center mb-4">
          Welcome to{' '}
          <a href="" className="text-blue-500 hover:underline">RainbowKit</a> +{' '}
          <a href="" className="text-blue-500 hover:underline">wagmi</a> +{' '}
          <a href="https://nextjs.org" className="text-blue-500 hover:underline">Next.js!</a>
        </h1>

        <p className="text-xl text-center mb-8">
          Get started by editing{' '}
          <code className="bg-gray-100 rounded p-1 font-mono">pages/index.tsx</code>
        </p>
      </main>

      <footer className="py-4">
        <div className="container mx-auto text-center">
          <a href="https://rainbow.me" rel="noopener noreferrer" target="_blank" className="text-blue-500 hover:underline">
            Made with ❤️ by Heisenburgir & Dayitva
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Home;
