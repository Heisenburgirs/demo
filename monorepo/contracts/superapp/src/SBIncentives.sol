// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SuperTokenV1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import {CFASuperAppBase} from "@superfluid-finance/ethereum-contracts/contracts/apps/CFASuperAppBase.sol";
import {ISuperfluid, ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { ISETH } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/tokens/ISETH.sol";
import { ITorex } from "./interfaces/ITorex.sol";

interface IMacroForwarder {
    function runMacro(address macroAddress, bytes memory params) external;
}

contract SBIncentives {
    using SuperTokenV1Library for ISuperToken;
    using SuperTokenV1Library for ISETH;

    IMacroForwarder public immutable macroForwarder; // 0xfD01285b9435bc45C243E5e7F978E288B2912de6 (on all networks)
    address public immutable sbMacroAddress; // 0x34Db26737185671215fB90E2F8C6fd8C4F8eB944 (On Optimism Sepolia)

    ITorex public torex;

    constructor(address _macroForwarder, address _sbMacroAddress) {
        macroForwarder = IMacroForwarder(_macroForwarder);
        sbMacroAddress = _sbMacroAddress;
    }

    /**
     * @dev A function which start or updates a SuperBoring DCA flow.
     * @param torexAddr address of the Torex contract. The token address is derived from this (inToken).
     * @param flowRate flowrate to be set for the flow to the Torex contract. The pre-existing flowrate must be 0 (no flow).
     * @param distributor address of the distributor, or zero address if none.
     * @param referrer address of the referrer, or zero address if none.
     * @param upgradeAmount amount (18 decimals) to upgrade from underlying ERC20 to SuperToken.
     *   - if `type(uint256).max`, the maximum possible amount is upgraded (current allowance).
     *   - otherwise, the specified amount is upgraded. Requires sufficient underlying balance and allowance, otherwise the transaction will revert.
     * Note that upgradeAmount shall be 0 if inToken has no underlying ERC20 token.
     */

    function startSuperBoringDCA(
        address torexAddr,
        int96 flowRate,
        address distributor,
        address referrer,
        uint256 upgradeAmount
    ) external {
        bytes memory params = abi.encode(torexAddr, flowRate, distributor, referrer, upgradeAmount);
        macroForwarder.runMacro(sbMacroAddress, params);
    }

    function startSuperBoringDCA(
        address torexAddr,
        int96 flowRate,
        address distributor,
        address referrer,
        uint256 upgradeAmount,
        ISuperToken incentivisedInToken,
        ISuperToken incentivisedOutToken
    ) external {
        bytes memory params = abi.encode(torexAddr, flowRate, distributor, referrer, upgradeAmount);
        macroForwarder.runMacro(sbMacroAddress, params);

        (ISuperToken inToken, ISuperToken outToken) = ITorex(torexAddr).getPairedTokens();

        if (inToken == incentivisedInToken && outToken == incentivisedOutToken) {
            // TODO: reward the user
            return;
        }
    }
}