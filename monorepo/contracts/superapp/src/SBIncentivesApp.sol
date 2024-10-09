// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SuperTokenV1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import { CFASuperAppBase } from "@superfluid-finance/ethereum-contracts/contracts/apps/CFASuperAppBase.sol";
import { ISuperfluid, ISuperToken, ISuperfluidPool, ISuperApp, PoolConfig, IERC20 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
// import { ISuperfluidPool } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluidPool.sol";
import { ISETH } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/tokens/ISETH.sol";
// import { PoolConfig } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/gdav1/IGeneralDistributionAgreementV1.sol";
import { ITorex } from "./interfaces/ITorex.sol";
import { Scaler } from "./utils/Scaler.sol";
import { toInt96, UINT_100PCT_PM, INT_100PCT_PM } from "./utils/MathExtra.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";


contract SBIncentivesApp is CFASuperAppBase {
    using SuperTokenV1Library for ISuperToken;
    using SuperTokenV1Library for ISETH;

    address public ADMIN;

    address public torexAddr;
    ITorex public torex;

    ISuperfluid host;

    ISuperToken public immutable inToken;
    ISuperToken public immutable outToken;
    ISuperToken public immutable rewardToken;

    PoolConfig private outPoolConfig;
    PoolConfig private rewardPoolConfig;
    ISuperfluidPool internal immutable outPool;
    ISuperfluidPool internal immutable rewardPool;

    Scaler internal immutable outPoolScaler;
    Scaler internal immutable rewardPoolScaler;

    event FlowCreated(address indexed sender, int96 flowRate);
    event FlowUpdated(address indexed sender, int96 inflowChange);
    event FlowDeleted(address indexed sender, int96 remainingInflow);

    constructor(
        ISuperfluid host_,
        address _torexAddr,
        ISuperToken _rewardToken,
        address admin
    ) CFASuperAppBase (host_) {
        // host_.registerApp(getConfigWord(true, true, true));
        selfRegister(true, true, true);

        ADMIN = admin;

        host = host_;

        torexAddr = _torexAddr;
        torex = ITorex(_torexAddr);
        (inToken, outToken) = ITorex(torexAddr).getPairedTokens();

        ISuperfluidPool pool = torex.outTokenDistributionPool();
        // ACCEPTED_SUPER_TOKEN.connectPool(pool);

        rewardToken = _rewardToken;

        outPoolConfig.transferabilityForUnitsOwner = false;
        outPoolConfig.distributionFromAnyAddress = false;

        rewardPoolConfig.transferabilityForUnitsOwner = false;
        rewardPoolConfig.distributionFromAnyAddress = false;

        outPool = outToken.createPool(address(this), outPoolConfig);
        rewardPool = rewardToken.createPool(address(this), rewardPoolConfig);
    }

    modifier onlyAdmin() {
        require(msg.sender == ADMIN, "SBIncentivesApp: only admin");
        _;
    }

    function approveSpending(uint256 upgradeAmount) external {
        IERC20 underlyingToken = IERC20(inToken.getUnderlyingToken());
        underlyingToken.approve(address(inToken), type(uint256).max);
        inToken.upgrade(upgradeAmount);
        inToken.approve(torexAddr, type(uint256).max);
    }

    /// @dev checks that only the acceptedToken is used when sending streams into this contract
    /// @param superToken_ the token being streamed into the contract
    function isAcceptedSuperToken(ISuperToken superToken_) public view override returns (bool) {
        return superToken_ == inToken;
    }

    function onFlowCreated(
        ISuperToken superToken_,
        address sender_,
        bytes calldata ctx_
    ) internal override returns (bytes memory newCtx) {
        newCtx = ctx_;

        // get inflow rate from sender_
        int96 inflowRate = superToken_.getFlowRate(sender_, address(this));

        //Scale the value from int96 to uint128 correctly
        uint128 newUnits = uint128(SafeCast.toInt128(outPoolScaler.scaleValue(inflowRate)));

        outPool.updateMemberUnits(sender_, newUnits);
        rewardPool.updateMemberUnits(sender_, newUnits);

        emit FlowCreated(sender_, inflowRate);

        // host.allowCompositeApp(ISuperApp(torexAddr));

        // // if there's no outflow already, create outflows
        // if (superToken_.getFlowRate(address(this), torexAddr) == 0) {
        //     newCtx = superToken_.createFlowWithCtx(
        //         torexAddr,
        //         inflowRate,
        //         newCtx
        //     );
        // }

        // // otherwise, there's already outflows which should be increased
        // else {
        //     newCtx = superToken_.updateFlowWithCtx(
        //         torexAddr,
        //         superToken_.getFlowRate(address(this), torexAddr) +
        //             inflowRate,
        //         newCtx
        //     );
        // }

        // // TODO: Do we create a stream of rewards token to the user or just assign units to the Pool?
        // if (rewardToken.getFlowRate(address(this), sender_) == 0) {
        //     newCtx = rewardToken.createFlowWithCtx(
        //         sender_,
        //         inflowRate,
        //         newCtx
        //     );
        // }

        // // otherwise, there's already outflows which should be increased
        // else {
        //     newCtx = superToken_.updateFlowWithCtx(
        //         sender_,
        //         rewardToken.getFlowRate(address(this), sender_) +
        //             inflowRate,
        //         newCtx
        //     );
        // }

    }

    function onFlowUpdated(
        ISuperToken superToken_,
        address sender_,
        int96 previousFlowRate_,
        uint256, /*lastUpdated*/
        bytes calldata ctx_
    ) internal override returns (bytes memory newCtx) {
        newCtx = ctx_;

        // get inflow rate change from sender_
        int96 currentFlowRate = superToken_.getFlowRate(sender_, address(this));
        int96 inflowChange = currentFlowRate - previousFlowRate_;
        
        // Claim the tokens before assigning the new units
        outPool.claimAll(sender_);
        rewardPool.claimAll(sender_);

        //Scale the value from int96 to uint128 correctly
        uint128 newUnits = uint128(SafeCast.toInt128(outPoolScaler.scaleValue(currentFlowRate)));

        outPool.updateMemberUnits(sender_, newUnits);
        rewardPool.updateMemberUnits(sender_, newUnits);

        emit FlowUpdated(sender_, inflowChange);

        // // update outflows
        // newCtx = superToken_.updateFlowWithCtx(
        //     torexAddr,
        //     superToken_.getFlowRate(address(this), torexAddr) + inflowChange,
        //     newCtx
        // );
    }

    function onFlowDeleted(
        ISuperToken superToken_,
        address sender_,
        address receiver_,
        int96 previousFlowRate_,
        uint256, /*lastUpdated*/
        bytes calldata ctx_
    ) internal override returns (bytes memory newCtx) {
        newCtx = ctx_;

        // remaining inflow is equal to total outflow less the inflow that just got deleted
        int96 remainingInflow = superToken_.getFlowRate(address(this), torexAddr) - previousFlowRate_;

        // Claim all the tokens before updating the units
        outPool.claimAll(sender_);
        rewardPool.claimAll(sender_);
        
        // update outPool and rewardPool units
        outPool.updateMemberUnits(sender_, 0);
        rewardPool.updateMemberUnits(sender_, 0);

        emit FlowDeleted(sender_, remainingInflow);

        // // handle "rogue recipients" with sticky stream - see readme
        // if (receiver_ == torexAddr) {
        //     newCtx = superToken_.createFlowWithCtx(receiver_, previousFlowRate_, newCtx);
        // }

        // // if there is no more inflow, outflows should be deleted
        // if (remainingInflow <= 0) {
        //     newCtx = superToken_.deleteFlowWithCtx(address(this), torexAddr, newCtx);
        // }
        // // otherwise, there's still inflow left and outflows must be updated
        // else {
        //     newCtx = superToken_.updateFlowWithCtx(torexAddr, remainingInflow, newCtx);
        // }
    }

    function createStreamToTorex(int96 flowRate) external onlyAdmin {
        int96 currentOutFlowRate = inToken.getFlowRate(address(this), torexAddr);
        
        // if there's no outflow already, create outflows
        if (currentOutFlowRate == 0) {
            inToken.createFlow(torexAddr, flowRate);
        }

        // otherwise, there's already outflows which should be increased
        else {
            inToken.updateFlow(torexAddr, currentOutFlowRate + flowRate);
        }
    }

    function updateStreamToTorex(int96 inflowChange) external onlyAdmin {
        // update outflows
        inToken.updateFlow(torexAddr, inToken.getFlowRate(address(this), torexAddr) + inflowChange);
    }

    function deleteStreamToTorex(int96 remainingInflow) external onlyAdmin {
        // if there is no more inflow, outflows should be deleted
        if (remainingInflow <= 0) {
            inToken.deleteFlow(address(this), torexAddr);
        }
        // otherwise, there's still inflow left and outflows must be updated
        else {
            inToken.updateFlow(torexAddr, remainingInflow);
        }
    }

    function claimAllTokens() external {
        outToken.distributeToPool(address(this), outPool, outToken.balanceOf(address(this)));
        outPool.claimAll(msg.sender);
        rewardPool.claimAll(msg.sender);
    }
}


