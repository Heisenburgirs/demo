import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRef, useState, useCallback } from 'react';
import background from "@/public/background.2bf00877.svg"
import noise from "@/public/noise.0eeb5824.png"
import { useAccount} from 'wagmi';
import usdc from "@/public/usdc.png"
import eth from "@/public/eth.webp"
import DCAOverlay from "../components/DCAOverlay";
import { ethers } from "ethers";
import { usePosition } from "../components/PositionContext";
import { useTokenContext } from '../components/TokenContext';

// Mock data for DCA rewards and portfolio
const dcaRewards = [
  { 
    name: 'USDC / ETH',
    tokens: { from: 'USDC', to: 'ETH' },
    monthlyVolume: '21,734.632',
    dailyRewards: { amount: '15000', token: 'FLOW' },
    apr: '3.15%',
    isLive: true 
  },
];

const cfaABI = [
  'function deleteFlow(address token, address sender, address receiver, bytes userData) external returns (bool)',
];

const Home: NextPage = () => {
  const [activeTab, setActiveTab] = useState('boosts');
  
  const [isDCAOverlayOpen, setIsDCAOverlayOpen] = useState(false);
  const [updateAmount, setUpdateAmount] = useState('');

  const [cfa, setCfa] = useState('0x19ba78B9cDB05A877718841c574325fdB53601bb');

  const { address } = useAccount();
  const { positionData, loading, error } = usePosition();
  
  const tokenContext = useTokenContext();

  // Ensure tokenContext is not null before destructuring
  const { inTokenAddress, underlyingTokenAddress, tokenBalance, tokenAllowance } = tokenContext || {
    inTokenAddress: null,
    underlyingTokenAddress: null,
    tokenBalance: '',
    tokenAllowance: ''
  };

  const deleteButtonRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const setDeleteButtonRef = useCallback((poolId: string) => (el: HTMLButtonElement | null) => {
    deleteButtonRef.current[poolId] = el;
  }, []);

  const calculateMonthlyFlowRate = (flowRate: string) => {
    const flowRateBN = ethers.BigNumber.from(flowRate);
    const secondsInMonth = 30 * 24 * 60 * 60;
    const monthlyFlowRateWei = flowRateBN.mul(secondsInMonth);
    return parseFloat(ethers.utils.formatUnits(monthlyFlowRateWei, 18)).toFixed(4); // Assuming 18 decimals for the flow rate
  };

  const calculateTotalStreamed = (flowRate: string, createdTimestamp: string) => {
    const flowRateBN = ethers.BigNumber.from(flowRate);
    const createdTime = parseInt(createdTimestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    const secondsElapsed = currentTime - createdTime;
    const totalStreamedWei = flowRateBN.mul(secondsElapsed);
    return parseFloat(ethers.utils.formatUnits(totalStreamedWei, 18)).toFixed(9); // Assuming 18 decimals for the flow rate
  };

  const handleDCAClick = () => {
    setIsDCAOverlayOpen(true);
  };

  const handleDelete = async (poolId: string) => {
    if (!window.ethereum) {
      console.error("Ethereum provider not found");
      return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const cfaContract = new ethers.Contract(cfa, cfaABI, signer);

    const poolAddress = poolId; // Assuming poolId is the pool address

    try {
      const tx = await cfaContract.deleteFlow(
        inTokenAddress,
        address,
        poolAddress,
        '0x',
        { gasLimit: 300000 }
      );

      // Disable the button and show loading state
      if (deleteButtonRef.current[poolId]) {
        deleteButtonRef.current[poolId]!.disabled = true;
        deleteButtonRef.current[poolId]!.textContent = 'Deleting...';
      }

      await tx.wait();
      console.log("Flow deleted successfully");
      // You might want to add some UI feedback here, like a success message
    } catch (error) {
      console.error("Error deleting flow:", error);
      // You might want to add some UI feedback here, like an error message
    } finally {
      // Re-enable the button and restore original text
      if (deleteButtonRef.current[poolId]) {
        deleteButtonRef.current[poolId]!.disabled = false;
        deleteButtonRef.current[poolId]!.textContent = 'Delete';
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen h-screen w-screen bg-[#1A1F3C] text-white">
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
            <h1 className="text-[22px] font-bold text-[#fff] opacity-90">SuperBoost</h1>
            <nav>
              <ul className="flex space-x-4">
                <li>
                  <button
                    className={`text-[18px] w-20 transition-colors duration-200 transition ${
                      activeTab === 'boosts' ? 'text-[#9E8CFF]' : 'text-[#fff]'
                    }`}
                    onClick={() => setActiveTab('boosts')}
                  >
                    Boosts
                  </button>
                </li>
                <li>
                  <button
                    className={`text-[18px] w-20 transition-colors duration-200 transition ${
                      activeTab === 'portfolio' ? 'text-[#9E8CFF]' : 'text-[#fff]'
                    }`}
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
                        <button onClick={openConnectModal} className="bg-[#1a1b1f] text-white rounded-md px-4 py-[6px] hover:bg-[#2c2d33] border border-[#00D6E5]">
                          Connect
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={openChainModal} 
                          className="text-white rounded-md px-3 py-2 text-sm hover:bg-[#2A2F4C] border border-[#9E8CFF] flex items-center justify-center gap-2 transition"
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
                          className="text-white rounded-md px-3 py-2 text-sm hover:bg-[#9E8CFF] border border-[#9E8CFF] flex items-center transition"
                        >
                          {account.balanceFormatted && parseFloat(account.balanceFormatted).toFixed(2)}
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
            <div className="overflow-x-auto bg-[#1A1F3C] rounded-[12px] border border-[#fff] border-opacity-10">
              <table className="w-full text-left">
                <thead className="hover:bg-[#3A3F5C] transition hover:cursor-pointer">
                  <tr className="text-[#7CFFD4] text-[12px]">
                    <th className="py-4 px-4">Pool</th>
                    <th className="py-4 px-4">Monthly Volume</th>
                    <th className="py-4 px-4">Reward Pool</th>
                    <th className="py-4 px-4">APR</th>
                    <th className="py-4 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dcaRewards.map((reward, index) => (
                    <tr key={index} className="border-t border-[#fff] border-opacity-10">
                      <td className="px-4 py-4 flex items-center relative gap-4">
                        <div className="flex items-center relative">
                          <img src={usdc.src} alt={reward.tokens.from} className="w-6 h-6 mr-2" />
                          <img src={eth.src} alt={reward.tokens.to} className="w-6 h-6 absolute right-0 left-[12px]" />
                        </div>
                        <span className="ml-8">{reward.name}</span>
                      </td>
                      <td className="px-4 py-4">{reward.monthlyVolume} {reward.tokens.to}</td>
                      <td className="px-4 py-4">{reward.dailyRewards.amount} {reward.dailyRewards.token}</td>
                      <td className="px-4 py-4">{reward.apr}</td>
                      <td className="px-4 py-4">
                        <button onClick={handleDCAClick} className="bg-[#6C3CE9] text-white rounded px-4 py-1 mr-2 hover:bg-[#5A32C7]">
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
                <h3 className="text-xl font-bold text-white">Positions</h3>
              </div>
              {loading && <p>Loading...</p>}
              {error && <p>Error: {error.message}</p>}
              {positionData && positionData.pools.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                  {positionData.pools.map((pool, poolIndex) => (
                    pool.poolMembers.map((member, memberIndex) => {
                      const latestOutflow = member.account.outflows
                        .filter(outflow => outflow.currentFlowRate !== "0")
                        .sort((a, b) => parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp))[0];

                      if (!latestOutflow) return null; // Skip if no active outflow

                      const monthlyFlowRate = calculateMonthlyFlowRate(latestOutflow.currentFlowRate);
                      const totalStreamed = calculateTotalStreamed(
                        latestOutflow.currentFlowRate,
                        latestOutflow.createdAtTimestamp
                      );

                      return (
                        <div key={`${poolIndex}-${memberIndex}`} className="bg-[#1A1F3C] rounded-lg p-4 border border-[#fff] border-opacity-10">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">USDC {">"} ETH</h3>
                          </div>
                          <div className="grid grid-cols-1 gap-4 mb-4">
                            <div>
                              <p className="text-[#9b9ba8] text-sm mb-1">Monthly Flow Rate</p>
                              <p className="text-white font-bold">{parseFloat(monthlyFlowRate).toFixed(2)} USDC / month</p>
                            </div>
                            <div>
                              <p className="text-[#9b9ba8] text-sm mb-1">Total Streamed</p>
                              <p className="text-white font-bold">{parseFloat(totalStreamed).toFixed(6)} USDC</p>
                            </div>
                            <div>
                              <p className="text-[#9b9ba8] text-sm mb-1">Total Received</p>
                              <p className="text-white font-bold">{ethers.utils.formatEther(member.account.poolMemberships[0].pool.perUnitSettledValue)} ETH</p>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <button
                              ref={setDeleteButtonRef(pool.id)}
                              onClick={() => handleDelete(pool.id)}
                              className="bg-[#ff4d4f] text-white rounded px-4 py-2 text-sm hover:bg-[#ff7875] transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ))}
                </div>
              )}
              {(!positionData || positionData.pools.length === 0 || positionData.pools.every(pool => pool.poolMembers.length === 0)) && (
                <p>No positions found.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {isDCAOverlayOpen && (
        <DCAOverlay onClose={() => setIsDCAOverlayOpen(false)} />
      )}

      <footer className="bg-[#6C3C9] py-4 z-50 border-t border-[#292932]">
        <div className="container mx-auto text-center text-[#4f4f55]">
          <span className="opacity-50 font-bold">Powered by Superfluid</span>
        </div>
      </footer>


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