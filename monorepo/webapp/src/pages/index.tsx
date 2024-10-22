import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import background from "../public/background.2bf00877.svg"
import noise from "../public/noise.0eeb5824.png"
import { useAccount } from 'wagmi';
import cUSD from "../public/cUSD.png"
import CELO from "../public/CELO.png"
import DCAOverlay from "../components/DCAOverlay";
import { ethers } from "ethers";
import cfaABI from "../components/cfa.abi.json"
import sbIncentivesAppABI from "../components/abi.json"

// Mock data for DCA rewards and portfolio
const dcaRewards = [
  { name: 'CELOx / cUSDx', monthlyVolume: '21,734.632 cUSDx', monthlyRewards: '10 $FLOW', isLive: true },
];

const portfolio = [
  { name: 'ETH/USDC Pool', flowRate: '1 $FLOW/day', balance: '10 ETH', tokenAddress: '0x3acb9a08697b6db4cd977e8ab42b6f24722e6d6e', receiver: '0x2436029135AdeDcf55F346Da15e525B680b64545' }
];

const Home: NextPage = () => {
  const [activeTab, setActiveTab] = useState('boosts');
  
  const [isDCAOverlayOpen, setIsDCAOverlayOpen] = useState(false);
  const [updateAmount, setUpdateAmount] = useState('');

  const { address } = useAccount();

  const handleDCAClick = () => {
    setIsDCAOverlayOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen h-screen w-screen bg-[#000000] text-white">
      <Head>
        <title>Super Boring DCA</title>
        <meta
          content="Super Boring DCA with Superfluid"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <header className="py-4 sticky top-0 z-10 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-end space-x-6">
            <h1 className="text-[22px] font-bold">SuperBoost</h1>
            <nav>
              <ul className="flex space-x-4">
                <li>
                  <button
                    className={`text-[18px] ${activeTab === 'boosts' ? 'text-[#36be91] font-bold' : 'text-[#4f4f55]'}`}
                    onClick={() => setActiveTab('boosts')}
                  >
                    Boosts
                  </button>
                </li>
                <li>
                  <button
                    className={`text-[18px] ${activeTab === 'portfolio' ? 'text-[#36be91] font-bold' : 'text-[#4f4f55]'}`}
                    onClick={() => setActiveTab('portfolio')}
                  >
                    Portfolio
                  </button>
                </li>
              </ul>
            </nav>
          </div>
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button onClick={openConnectModal} className="bg-[#1a1b1f] text-white rounded-md px-4 py-[6px] hover:bg-[#2c2d33] border border-[#36be91]">
                          Connect
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={openChainModal} 
                          className="text-white rounded-md px-3 py-2 text-sm hover:bg-[#1a1b1f] border border-[#2c2d33] flex items-center justify-center gap-2 transition"
                        >
                          <div className="flex items-center gap-[2px]">
                            {chain.hasIcon && (
                              <div className="mr-2">
                                <div style={{
                                  background: chain.iconBackground,
                                  width: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  overflow: 'hidden',
                                }}>
                                  {chain.iconUrl && (
                                    <img
                                      alt={chain.name ?? 'Chain icon'}
                                      src={chain.iconUrl}
                                      style={{ width: 20, height: 20 }}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <svg className="h-full w-4" fill="none" height="7" width="14" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.75 1.54001L8.51647 5.0038C7.77974 5.60658 6.72026 5.60658 5.98352 5.0038L1.75 1.54001" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/>
                          </svg>
                        </button>

                        <button 
                          onClick={openAccountModal} 
                          className="text-white rounded-md px-3 py-2 text-sm hover:bg-[#36be91] border border-[#36be91] flex items-center transition"
                        >
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      <main className="flex-grow p-8 overflow-auto z-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-6 text-[#fff]">
            {activeTab === 'boosts' ? 'Discover Incentives' : activeTab === 'portfolio' && 'Your Portfolio'}
          </h2>
          {activeTab === 'boosts' && (
            <div className="mb-6 text-[#9b9ba8]">
              <p>
                When you DCA or stream one token into another (e.g., ETH to USDC), you can receive incentive tokens as a reward.
              </p>
            </div>
          )}
          {activeTab === 'boosts' && (
            <div className="overflow-x-auto bg-black rounded-[12px] border border-[#292932]">
              <table className="w-full text-left">
                <thead className="hover:bg-[#292932] transition hover:cursor-pointer">
                  <tr className="text-[#9b9ba8] text-[12px] text-[hsl(215,20.2%,65.1%)]">
                    <th className="py-4 px-4">Markets</th>
                    <th className="py-4 px-4">Monthly DCA Volume</th>
                    <th className="py-4 px-4">Monthly Rewards</th>
                    <th className="py-4 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dcaRewards.map((reward, index) => (
                    <tr key={index} className="border-t border-[#292932]">
                      <td className="px-4 py-4 flex items-center relative gap-4">
                        <div className="flex items-center relative">
                          <img src={CELO.src} alt="CELO" className="w-6 h-6 mr-2" />
                          <img src={cUSD.src} alt="cUSDx" className="w-6 h-6 absolute right-0 left-[12px]" />
                        </div>
                        {reward.name}
                      </td>
                      <td className="px-4 py-4">{reward.monthlyVolume}</td>
                      <td className="px-4 py-4">{reward.monthlyRewards}</td>
                      <td className="px-4 py-4">
                        <button onClick={handleDCAClick} className="bg-[#36be91] text-white rounded px-4 py-1 mr-2 hover:bg-[#2ea17d]">
                          DCA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="max-w-[400px] flex flex-col gap-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Positions (0.0)</h3>
                <button className="text-[#9b9ba8] text-sm flex items-center">
                  <span>Filters</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-[#000] rounded-lg p-8 border border-[#292932] flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#1a1b1f] transition-colors">
                  <div className="w-16 h-16 bg-[#1a1b1f] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">Add new Position</h4>
                  <p className="text-[#9b9ba8] text-sm">Start a new position with a new token</p>
                </div>
                {portfolio.map((item, index) => (
                  <div key={index} className="bg-[#000] rounded-lg p-4 border border-[#292932]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white">{item.name}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-[#9b9ba8] text-sm mb-1">Allocation</p>
                        <p className="text-white font-bold">290 USDCx / month</p>
                      </div>
                      <div>
                        <p className="text-[#9b9ba8] text-sm mb-1">Sent</p>
                        <p className="text-white font-bold">0.216811 USDCx</p>
                      </div>
                      <div>
                        <p className="text-[#9b9ba8] text-sm mb-1">Received</p>
                        <p className="text-white font-bold">0.00 ETHx</p>
                      </div>
                      <div>
                        <p className="text-[#9b9ba8] text-sm mb-1">Avg. price</p>
                        <p className="text-white font-bold">0 USDCx</p>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="New monthly amount"
                          value={updateAmount}
                          onChange={(e) => setUpdateAmount(e.target.value)}
                          className="bg-[#1a1b1f] w-[125px] text-white rounded px-3 py-2 text-sm"
                        />
                        <button 
                          className="bg-[#1a1b1f] text-white rounded px-4 py-2 text-sm hover:bg-[#2c2d33] transition-colors"
                          >
                            Update
                          </button>
                      </div>
                      <button 
                        className="bg-[#36be91] text-white rounded px-4 py-2 text-sm hover:bg-[#2ea17d] transition-colors"
                      >
                        Claim
                      </button>
                      <button 
                        className="bg-[#ff4d4f] text-white rounded px-4 py-2 text-sm hover:bg-[#ff7875] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {isDCAOverlayOpen && (
        <DCAOverlay onClose={() => setIsDCAOverlayOpen(false)} />
      )}

      <footer className="bg-[#000] py-4 z-50 border-t border-[#292932]">
        <div className="container mx-auto text-center text-[#4f4f55]">
          <span className="opacity-50 font-bold">Powered by Superfluid</span>
        </div>
      </footer>

      <div className="w-screen h-screen top-0 z-10 opacity-50 overflow-hidden fixed">
        <div 
          id="dynamic-background" 
          className="absolute w-full h-full bg-cover bg-[center_-30px]" 
          style={{
            scale: '1.15', 
            backgroundImage: `url(${background.src})`
          }}
        ></div>
        
      </div>

      <div className='w-screen h-screen top-0 z-30 opacity-90 fixed'>
        <div 
          className="w-screen h-screen top-0 bg-cover z-30 opacity-5 fixed" 
          style={{backgroundImage: `url(${noise.src})`}}
        ></div>
      </div>

      <div 
        className="w-screen h-screen top-0 bg-cover z-20 opacity-80 fixed" 
        style={{backgroundImage: "radial-gradient(circle, rgba(0, 0, 0, 0.2) 20%, rgba(0, 0, 0, 0.9) 50%, rgb(0, 0, 0) 90%)"}}
      ></div>
    </div>
  );
};

export default Home;