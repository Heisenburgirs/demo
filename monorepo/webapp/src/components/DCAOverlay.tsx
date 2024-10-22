import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import cUSD from "../public/cUSD.png"
import CELO from "../public/CELO.png"
import { useAccount } from 'wagmi';
import { ethers } from "ethers"

interface DCAOverlayProps {
  onClose: () => void;
}

const DCAOverlay: React.FC<DCAOverlayProps> = ({ onClose }) => {
  const [sendingStream, setSendingStream] = useState(false);

  const { address, isConnected } = useAccount();
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
  const [isTorexValid, setIsTorexValid] = useState(false);
  const [inTokenAddress, setInTokenAddress] = useState('');
  const [underlyingTokenAddress, setUnderlyingTokenAddress] = useState<string>('');

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

  const torexABI = [
    'function getPairedTokens() external view returns (address inToken, address outToken)',
  ];

  const superTokenABI = [
    'function getUnderlyingToken() external view returns (address)',
  ];

  const erc20ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function decimals() external view returns (uint8)',
  ];

  useEffect(() => {
    if (isConnected && address) {
      validateTorexAndFetchTokenInfo();
    }
  }, [isConnected, address]);

  const validateTorexAndFetchTokenInfo = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    try {
      const torex = new ethers.Contract(torexAddr, torexABI, provider);
      const [inTokenAddr, outTokenAddr] = await torex.getPairedTokens();
      setInTokenAddress(inTokenAddr);
      console.log('inTokenAddr', inTokenAddr);
      console.log('outTokenAddr', outTokenAddr);

      const superToken = new ethers.Contract(inTokenAddr, superTokenABI, provider);
      const underlyingAddr = await superToken.getUnderlyingToken();
      setUnderlyingTokenAddress(underlyingAddr);
      console.log('underlyingAddr', underlyingAddr);

      setIsTorexValid(true);
      await fetchBalanceAndAllowance(underlyingAddr);
      console.log('underlyingAddr', underlyingAddr);
    } catch (error) {
      console.error("Error validating Torex address:", error);
      setIsTorexValid(false);
      setStatus("Invalid Torex address");
    }
  };

  const fetchBalanceAndAllowance = async (tokenAddress: string) => {
    const provider = new ethers.providers.JsonRpcProvider('https://base.llamarpc.com');
    try {
      if (tokenAddress === ethers.constants.AddressZero) {
        // Native token (ETH)
        const balance = await provider.getBalance(address || '');
        setMaxBalance(ethers.utils.formatEther(balance));
        setAllowance('');
      } else {
        // ERC20 token
        const erc20 = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await erc20.balanceOf(address);
        const decimals = await erc20.decimals();
        const formattedBalance = ethers.utils.formatUnits(balance, decimals);
        console.log("balance", formattedBalance);

        const allowance = await erc20.allowance(address, SB_MACRO_ADDRESS);
        const formattedAllowance = ethers.utils.formatUnits(allowance, decimals);
        console.log("allowance for SB_MACRO_ADDRESS", formattedAllowance);
        
        setMaxBalance(formattedBalance);
        setBalance(balance);
        setAllowance(formattedAllowance);
      }
    } catch (error) {
      console.error("Error fetching balance and allowance:", error);
    }
  };

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

      // Handle very small flow rate values
      const flowRateBN = flowRate && parseFloat(flowRate) > 0
      ? ethers.utils.parseEther(flowRate)
      : ethers.BigNumber.from(0);

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

      // Check allowance
      //if (allowance !== null && upgradeAmountBN.gt(ethers.utils.parseEther(allowance))) {
        /*if (underlyingTokenAddress !== ethers.constants.AddressZero) {
          const erc20 = new ethers.Contract(underlyingTokenAddress, erc20ABI, signer);
          const approveTx = await erc20.approve(SB_MACRO_ADDRESS, ethers.constants.MaxUint256, {
            gasLimit: 1000000 // Set a gas limit for the approve transaction
          });
          await approveTx.wait();
          const approveTx2 = await erc20.approve(MACRO_FORWARDER_ADDRESS, ethers.constants.MaxUint256, {
            gasLimit: 1000000 // Set a gas limit for the approve transaction
          });
          await approveTx2.wait();
          setStatus('Approval successful. Starting DCA position...');
        }*/
      //}

      const params = await sbMacro.getParams(
        torexAddr,
        flowRateBN,
        ethers.constants.AddressZero, // No distributor
        ethers.constants.AddressZero, // No referrer
        balance
      );
      console.log('Generated params:', params);

      console.log('Submitting runMacro transaction...');
      const tx = await macroForwarder.runMacro(SB_MACRO_ADDRESS, params, { gasLimit: 210000 });
      await tx.wait();

      setStatus('DCA position started successfully!');
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
    setSendingStream(false);
  }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-black rounded-lg py-6 px-4 w-96 text-white shadow-[inset_0_0_30px_rgba(255,255,255,0.2)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Trade</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-4">Initiate Automatic DCAing</p>
        <div className="mb-4 bg-black py-2 px-4 rounded-[8px]">
          <p className="text-sm text-gray-400">I'm allocating a monthly</p>
          <div className="flex items-center justify-between bg-black">
            <input
              type="number"
              value={flowRate}
              onChange={(e) => {setFlowRate(e.target.value); handleUpgradeAmountChange(e)}}
              className="bg-black text-3xl font-bold w-1/2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center bg-black">
              <Image src={cUSD.src} alt="cUSDx" width={24} height={24} />
              <span className="ml-2">cUSDx</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">${parseFloat(flowRate).toFixed(2)}</p>
        </div>
        <div className="flex justify-between items-center mb-4 bg-black py-2 px-4 rounded-[8px]">
          <span className="text-gray-400">to DCA into</span>
          <div className="flex items-center bg-black">
            <Image src={CELO.src} alt="CELOx" width={24} height={24} />
            <span className="ml-2">CELOx</span>
          </div>
        </div>
        <div className="bg-[#000] text-[0.75rem] rounded p-4 mb-4 rounded-[8px]">
          <div className="flex justify-between items-center mb-2">
            <span>1 cUSDC = 0.000417521415 CELO</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Minimum Flowrate</span>
            <span>0.002628 USDCX</span>
          </div>
          <div className="flex flex-col gap-2 mt-4 text-gray-400">
            <div className="flex justify-between">
              <span>Fee ℹ</span>
              <span>0.500 cUSDC / month</span>
            </div>
            <div className="flex justify-between">
              <span>Avg. Payout ℹ</span>
              <span>~52 minutes</span>
            </div>
            <div className="flex justify-between">
              <span>Reward ℹ</span>
              <span>273.8463 BORING / month</span>
            </div>
            <div className="flex justify-between">
              <span>Stream ends ℹ</span>
              <span>10th Oct, 2024 15:10</span>
            </div>
          </div>
        </div>
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

      
    </div>
  );
};

export default DCAOverlay;