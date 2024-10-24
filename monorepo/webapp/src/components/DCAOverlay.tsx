import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import usdc from "../public/usdc.png"
import eth from "../public/eth.webp"
import { useAccount } from 'wagmi';
import { ethers } from "ethers"
import { useEth } from './EthContext';
import { useTokenContext } from './TokenContext';
import { usePosition } from './PositionContext';

interface DCAOverlayProps {
  onClose: () => void;
}

const DCAOverlay: React.FC<DCAOverlayProps> = ({ onClose }) => {
  const [sendingStream, setSendingStream] = useState(false);
  const [txSuccessful, setTxSuccessful] = useState(false);

  const { positionData, refetchWithDelay } = usePosition();
  const { address, isConnected } = useAccount();
  const { ethPrice } = useEth();
  const tokenContext = useTokenContext();

  // Ensure tokenContext is not null before destructuring
  const { inTokenAddress, underlyingTokenAddress, tokenBalance, tokenAllowance } = tokenContext || {
    inTokenAddress: null,
    underlyingTokenAddress: null,
    tokenBalance: '',
    tokenAllowance: ''
  };

  // States
  const [torexAddr, setTorexAddr] = useState('0x269f9ef6868f70fb20ddf7cfdf69fe1dbfd307de');
  const [flowRate, setFlowRate] = useState('');
  const [distributor, setDistributor] = useState('');
  const [referrer, setReferrer] = useState('');
  const [upgradeAmount, setUpgradeAmount] = useState('');
  const [status, setStatus] = useState('');
  const [chainId, setChainId] = useState(null);
  const [maxBalance, setMaxBalance] = useState<string>('');
  const [balance, setBalance] = useState<string>('');
  const [allowance, setAllowance] = useState<string>('');

  // Addresses
  const SB_MACRO_ADDRESS  = "0xe581e09a9c2a9188c3e6f0fab5a0b3ec88ca39ae";
  const MACRO_FORWARDER_ADDRESS  = "0xfD01285b9435bc45C243E5e7F978E288B2912de6";
  const TOREX_ADDRESS = "0x269f9ef6868f70fb20ddf7cfdf69fe1dbfd307de";

  // ABIs
  const macroForwarderABI = [
    'function runMacro(address macro, bytes memory params) external',
  ];

  const sbMacroABI = [
    'function getParams(address torexAddr, int96 flowRate, address distributor, address referrer, uint256 upgradeAmount) public pure returns (bytes memory)',
  ];

  const erc20ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
  ];

  const handleUpgradeAmountChange = (e: any) => {
    const value = e.target.value;
    setUpgradeAmount(value);
    if (value.toLowerCase() === 'max' && maxBalance) {
      setUpgradeAmount(maxBalance);
    }
  };

  const handleSubmit = async (e: any) => {
    if (!isConnected || !address) {
      setStatus('Please connect your wallet first.');
      return;
    }

    e.preventDefault();
    setStatus('Processing...');

    try {
      if (!window.ethereum) throw new Error('No crypto wallet found');

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const macroForwarder = new ethers.Contract(MACRO_FORWARDER_ADDRESS, macroForwarderABI, signer);
      const sbMacro = new ethers.Contract(SB_MACRO_ADDRESS, sbMacroABI, provider);

      // Convert monthly flow rate to wei per second
      const monthlyFlowRate = parseFloat(flowRate);
      const secondsInMonth = 30 * 24 * 60 * 60; // Approximate seconds in a month
      const flowRatePerSecond = monthlyFlowRate / secondsInMonth;

      // Convert to wei per second
      const flowRateBN = ethers.utils.parseEther(flowRatePerSecond.toFixed(18));

      // Handle very small upgrade amount values
      const upgradeAmountBN = upgradeAmount && parseFloat(upgradeAmount) > 0
      ? ethers.utils.parseEther(upgradeAmount)
      : ethers.BigNumber.from(0);

      // Log all relevant values
      console.log('Submitting transaction with the following values:');
      console.log('Connected Address:', address);
      console.log('Torex Address:', torexAddr);
      console.log('Flow Rate:', flowRate, '(', flowRateBN.toString(), ')');
      console.log('Upgrade Amount:', upgradeAmount, '(', balance, ')');
      console.log('Underlying Token Address:', underlyingTokenAddress);
      console.log('Allowance:', allowance);
      console.log('SB_MACRO_ADDRESS:', SB_MACRO_ADDRESS);
      console.log('MACRO_FORWARDER_ADDRESS:', MACRO_FORWARDER_ADDRESS);

      if (underlyingTokenAddress !== ethers.constants.AddressZero) {
        const erc20 = new ethers.Contract(underlyingTokenAddress!, erc20ABI, signer)

        const approveTx2 = await erc20.approve(MACRO_FORWARDER_ADDRESS, ethers.constants.MaxUint256, {
          gasLimit: 1000000 // Set a gas limit for the approve transaction
        });
        await approveTx2.wait();
        
        setStatus('Approval successful. Starting DCA position...');
      }

      const params = await sbMacro.getParams(
        torexAddr,
        flowRateBN,
        ethers.constants.AddressZero, // No distributor
        ethers.constants.AddressZero, // No referrer
        ethers.constants.MaxUint256
      );
      console.log('Generated params:', params);

      console.log('Submitting runMacro transaction...');
      const tx = await macroForwarder.runMacro(SB_MACRO_ADDRESS, params);
      await tx.wait();

      setStatus('DCA position started successfully!');
      setTxSuccessful(true);
      
      // Trigger a refetch after 3 seconds
      refetchWithDelay(3000);
    } catch (err) {
      console.error(err);
      setStatus('Transaction failed. Please try again.');
      setTxSuccessful(false);
    } finally {
      setSendingStream(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-black rounded-lg py-6 px-4 w-96 text-white shadow-[inset_0_0_30px_rgba(255,255,255,0.2)]">
        <div onClick={() => {console.log(positionData)}} className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Dollar-Cost-Average</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-2 mb-4 bg-black py-2 px-4 rounded-[8px]">
          <p className="text-sm text-gray-400">Monthly Rate</p>
          <div className="flex items-center justify-between bg-black">
            <input
              type="number"
              value={flowRate}
              onChange={(e) => {setFlowRate(e.target.value); handleUpgradeAmountChange(e)}}
              className="bg-black text-2xl font-bold w-1/2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center bg-black">
              <Image src={usdc.src} alt="USDC" width={24} height={24} />
              <span className="ml-2 min-w-[50px] flex justify-end">USDC</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">${flowRate ? parseFloat(flowRate).toFixed(2) : '0.00'}</p>
        </div>
        <div className="flex justify-between items-center mb-4 bg-black py-2 px-4 rounded-[8px]">
          <span className="text-gray-400">to DCA into</span>
          <div className="flex items-center bg-black">
            <Image src={eth.src} alt="ETH" width={24} height={24} />
            <span className="ml-2 min-w-[50px] flex justify-end">ETH</span>
          </div>
        </div>

        {txSuccessful ? (
          <div className="text-center">
            <p className="text-lg font-bold text-green-500 mb-4">Transaction Successful!</p>
            <p className="mb-4">Your DCA position has been started successfully.</p>
            <button 
              onClick={onClose}
              className="w-full bg-[#36be91] text-white rounded-md py-3 font-bold hover:bg-[#2ea17d]"
            >
              Close
            </button>
          </div>
        ) : (
          <div>
            {isConnected ? (
          <button 
            onClick={handleSubmit}
            className={`w-full bg-[#36be91] text-white rounded-md py-3 font-bold ${
              sendingStream ? 'opacity-75 cursor-not-allowed animate-pulse' : 'hover:bg-[#2ea17d]'
            }`}
            disabled={sendingStream}
          >
            {sendingStream ? 'Starting stream' : 'Start Stream'}
          </button>
        ) : (
          <button className="w-full bg-[#36be91] text-white rounded-md py-3 font-bold hover:bg-[#2ea17d]">
            Connect Wallet
          </button>
        )}
        {status && (
          <div className="mt-4 p-2 bg-gray-800 rounded-md">
            <p className="text-sm">{status}</p>
          </div>
            )}
          </div>
        )}
      </div>
      
    </div>
  );
};

export default DCAOverlay;