// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SuperTokenV1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import { ISuperfluid, ISuperToken, ISuperfluidPool, ISuperApp, PoolConfig, IERC20 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { ISETH } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/tokens/ISETH.sol";
import { ITorex } from "./interfaces/ITorex.sol";
import { Scaler } from "./utils/Scaler.sol";
import { toInt96, UINT_100PCT_PM, INT_100PCT_PM } from "./utils/MathExtra.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";



contract SBIncentives {
    using SuperTokenV1Library for ISuperToken;
    using SuperTokenV1Library for ISETH;

    ITorex public torex;

    ISuperToken public immutable inToken;
    ISuperToken public immutable outToken;
    ISuperToken public immutable rewardToken;

    PoolConfig private _rewardPoolConfig;
    ISuperfluidPool internal immutable _rewardPool;
    Scaler internal immutable _rewardPoolScaler;

    constructor(address torexAddr, ISuperToken rewardTokenAddr) {
        torex = ITorex(torexAddr);
        (inToken, outToken) = torex.getPairedTokens();

        rewardToken = rewardTokenAddr;

        _rewardPoolConfig.transferabilityForUnitsOwner = false;
        _rewardPoolConfig.distributionFromAnyAddress = false;

        _rewardPool = rewardToken.createPool(address(this), _rewardPoolConfig);
    }

    function rewardTokenPool() external view returns (ISuperfluidPool) {
        return _rewardPool;
    }

    function registerOrUpdateStream(address user) external {
        // int96 flowRate = inToken.getFlowRate(user, address(torex));
        // uint128 newUnits = uint128(SafeCast.toInt128(_rewardPoolScaler.scaleValue(flowRate)));

        uint128 newUnits = torex.outTokenDistributionPool().getUnits(user);
        _rewardPool.updateMemberUnits(user, newUnits);
    }

    function claimRewards(address user) external {
        // check if users can connect to rewards pool themselves and collect it beforehand
        _rewardPool.claimAll(user);
    }

    function startStreamToPool(int96 requestedFlowRate) external {
        rewardToken.distributeFlow(address(this), _rewardPool, requestedFlowRate);
    }

    function connectToPool() external {
        inToken.connectPool(_rewardPool);
    }

}