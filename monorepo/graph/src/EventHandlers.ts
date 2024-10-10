/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  SBIncentivesApp,
  SBIncentivesApp_FlowCreated,
  SBIncentivesApp_FlowDeleted,
  SBIncentivesApp_FlowUpdated,
} from "generated";
import { ethers } from "ethers";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const WALLET_PRIVATE_KEY = process.env.WALLET;
const SB_INCENTIVES_APP_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE"; // Replace with actual address

const provider = new ethers.providers.JsonRpcProvider("YOUR_RPC_URL_HERE"); // Replace with your RPC URL
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY!, provider);

const sbIncentivesAppABI = [
  "function createStreamToTorex(int96 flowRate) external",
  "function updateStreamToTorex(int96 inflowChange) external",
  "function deleteStreamToTorex(int96 remainingInflow) external",
];

const sbIncentivesAppContract = new ethers.Contract(SB_INCENTIVES_APP_ADDRESS, sbIncentivesAppABI, wallet);

SBIncentivesApp.FlowCreated.handler(async ({ event, context }) => {
  const { sender, flowRate } = event.params;
  const entity: SBIncentivesApp_FlowCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    sender,
    flowRate,
  };

  /*try {
    const tx = await sbIncentivesAppContract.createStreamToTorex(flowRate);
    await tx.wait();
    context.log.info("createStreamToTorex transaction successful");
  } catch (error) {
    context.log.error("Error calling createStreamToTorex:", error);
  }*/

  await context.SBIncentivesApp_FlowCreated.set(entity);
});

SBIncentivesApp.FlowDeleted.handler(async ({ event, context }) => {
  const { sender, remainingInflow } = event.params;
  const entity: SBIncentivesApp_FlowDeleted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    sender,
    remainingInflow,
  };

  /*try {
    const tx = await sbIncentivesAppContract.deleteStreamToTorex(remainingInflow);
    await tx.wait();
    context.log.info("deleteStreamToTorex transaction successful");
  } catch (error) {
    context.log.error("Error calling deleteStreamToTorex:", error);
  }*/

  await context.SBIncentivesApp_FlowDeleted.set(entity);
});

SBIncentivesApp.FlowUpdated.handler(async ({ event, context }) => {
  const { sender, inflowChange } = event.params;
  const entity: SBIncentivesApp_FlowUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    sender,
    inflowChange,
  };

  /*try {
    const tx = await sbIncentivesAppContract.updateStreamToTorex(inflowChange);
    await tx.wait();
    context.log.info("updateStreamToTorex transaction successful");
  } catch (error) {
    context.log.error("Error calling updateStreamToTorex:", error);
  }*/

  await context.SBIncentivesApp_FlowUpdated.set(entity);
});
