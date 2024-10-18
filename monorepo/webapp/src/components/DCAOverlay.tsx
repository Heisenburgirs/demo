import React, { useState } from 'react';
import Image from 'next/image';
import cUSD from "../public/cUSD.png"
import CELO from "../public/CELO.png"
import { useAccount } from 'wagmi';
import { ethers } from "ethers"

const cfaABI = [
	{
		"inputs": [
			{"internalType": "address", "name": "token", "type": "address"},
			{"internalType": "address", "name": "sender", "type": "address"},
			{"internalType": "address", "name": "receiver", "type": "address"},
			{"internalType": "int96", "name": "flowRate", "type": "int96"},
			{"internalType": "bytes", "name": "userData", "type": "bytes"}
		],
		"name": "createFlow",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

interface DCAOverlayProps {
  onClose: () => void;
}

const DCAOverlay: React.FC<DCAOverlayProps> = ({ onClose }) => {
  const [amount, setAmount] = useState('0');
  const [sendingStream, setSendingStream] = useState(false);

  const { address, isConnected } = useAccount();

  // Mock ABI for the SBIncentivesApp contract
  const sbIncentivesAppABI = [
    "function createFlow(address recipient, int96 flowRate) external",
  ];

  const superTokenABI = [
    {
      "inputs": [
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "upgrade",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "spender", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "approve",
      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  // Function to handle starting a stream
  const handleStartStream = async (poolName: string, amount: string) => {
		console.log('Starting stream for:', poolName, 'Amount:', amount);
	
		if (!address) {
			console.log('No wallet address found');
			alert("Please connect your wallet first.");
			return;
		}
	
		if (!window.ethereum) {
			console.log('Ethereum provider not found');
			alert("Please install MetaMask!");
			return;
		}
	
		try {
			setSendingStream(true);
			console.log('Setting up provider and signer');
			const provider = new ethers.providers.Web3Provider(window.ethereum);
			const signer = provider.getSigner();
			
			const forwarderAddress = '0xcfA132E353cB4E398080B9700609bb008eceB125';
			console.log('Forwarder address:', forwarderAddress);
	
			console.log('Creating forwarder contract instance');
			const forwarderContract = new ethers.Contract(forwarderAddress, cfaABI, signer);
	
			const cUSDAddress = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
			const superCeloAddress = '0x3acb9a08697b6db4cd977e8ab42b6f24722e6d6e';
			console.log('cUSD address:', cUSDAddress);
			console.log('SuperCELO address:', superCeloAddress);
	
			const amountInWei = ethers.utils.parseEther(amount);
			console.log('Amount in Wei:', amountInWei.toString());
	
			// Create cUSD contract instance
			/*console.log('Creating cUSD contract instance');
			const cUSDContract = new ethers.Contract(cUSDAddress, superTokenABI, signer);
	
			// Approve cUSD spending
			console.log('Approving cUSD spending for SuperCELO');
			const approveUSDTx = await cUSDContract.approve(superCeloAddress, ethers.constants.MaxUint256);
			console.log('Approve cUSD transaction:', approveUSDTx.hash);
			await approveUSDTx.wait();
			console.log('Approve cUSD transaction confirmed');
	
			console.log('Creating SuperCELO contract instance');
			const superCeloContract = new ethers.Contract(superCeloAddress, superTokenABI, signer);
	
			console.log('Upgrading cUSD to SuperCELO');
			const upgradeTx = await superCeloContract.upgrade(amountInWei);
			console.log('Upgrade transaction:', upgradeTx.hash);
			await upgradeTx.wait();
			console.log('Upgrade transaction confirmed');
	
			console.log('Approving forwarder contract to spend SuperCELO');
			const approveTx = await superCeloContract.approve(forwarderAddress, ethers.constants.MaxUint256);
			console.log('Approve SuperCELO transaction:', approveTx.hash);
			await approveTx.wait();
			console.log('Approve SuperCELO transaction confirmed');*/
	
			const flowRate = amountInWei.div(30 * 24 * 60 * 60);
			console.log('Calculated flow rate:', flowRate.toString());
	
			const createFlow = async (tokenAddress: string, sender: string, receiver: string, flowRate: ethers.BigNumber) => {
				try {
					console.log('Creating flow with params:', { tokenAddress, sender, receiver, flowRate: flowRate.toString() });
					const tx = await forwarderContract.createFlow(
						tokenAddress,
						sender,
						receiver,
						10000000000,
						"0x",
						{ gasLimit: 1000000 }
					);
					console.log('Create flow transaction:', tx.hash);
					await tx.wait();
					console.log("Flow created successfully!");
				} catch (error) {
					console.error("Error creating flow:", error);
					throw error;
				}
			};
			
			// Use the correct order of arguments
			const receiverAddress = '0x2436029135AdeDcf55F346Da15e525B680b64545';
			await createFlow(superCeloAddress, address, receiverAddress, flowRate);
	
			console.log('Stream started successfully');
			alert(`Stream started successfully for ${poolName}`);
		} catch (error) {
			console.error("Error starting stream:", error);
			alert("Failed to start stream. Please try again.");
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-black text-3xl font-bold w-1/2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center bg-black">
              <Image src={cUSD.src} alt="cUSD" width={24} height={24} />
              <span className="ml-2">cUSD</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">${parseFloat(amount).toFixed(2)}</p>
        </div>
        <div className="flex justify-between items-center mb-4 bg-black py-2 px-4 rounded-[8px]">
          <span className="text-gray-400">to DCA into</span>
          <div className="flex items-center bg-black">
            <Image src={CELO.src} alt="ETH" width={24} height={24} />
            <span className="ml-2">CELO</span>
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
						onClick={() => {!sendingStream && handleStartStream("cUSD / CELO", amount)}} 
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
      </div>
    </div>
  );
};

export default DCAOverlay;