// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SuperTokenV1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import { CFASuperAppBase } from "@superfluid-finance/ethereum-contracts/contracts/apps/CFASuperAppBase.sol";
import { ISuperfluid, ISuperToken, ISuperfluidPool, PoolConfig } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
// import { ISuperfluidPool } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluidPool.sol";
import { ISETH } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/tokens/ISETH.sol";
// import { PoolConfig } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/gdav1/IGeneralDistributionAgreementV1.sol";
import { ITorex } from "./interfaces/ITorex.sol";
import { Scaler } from "./utils/Scaler.sol";
import { toInt96, UINT_100PCT_PM, INT_100PCT_PM } from "./utils/MathExtra.sol";

contract SBIncentivesApp is CFASuperAppBase {
    using SuperTokenV1Library for ISuperToken;
    using SuperTokenV1Library for ISETH;

    Scaler outPoolScaler;

    address public torexAddr;
    ITorex public torex;

    ISuperToken public immutable inToken;
    ISuperToken public immutable outToken;

    PoolConfig private poolConfig;
    ISuperfluidPool outPool;

    constructor(
        ISuperfluid host_,
        address _torexAddr
    ) CFASuperAppBase (host_) {
        
        torexAddr = _torexAddr;
        torex = ITorex(_torexAddr);
        (inToken, outToken) = ITorex(torexAddr).getPairedTokens();

        ISuperfluidPool pool = torex.outTokenDistributionPool();
        // ACCEPTED_SUPER_TOKEN.connectPool(pool);

        poolConfig.transferabilityForUnitsOwner = false;
        poolConfig.distributionFromAnyAddress = false;

        outPool = outToken.createPool(address(this), poolConfig);
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

        require(isAcceptedSuperToken(superToken_));

        // get inflow rate from sender_
        int96 inflowRate = superToken_.getFlowRate(sender_, address(this));

        // pool.updateMemberUnits(outPool, sender_, inflowRate/scaler);

        // if there's no outflow already, create outflows
        if (superToken_.getFlowRate(address(this), torexAddr) == 0) {
            newCtx = superToken_.createFlowWithCtx(
                torexAddr,
                inflowRate,
                newCtx
            );
        }

        // otherwise, there's already outflows which should be increased
        else {
            newCtx = superToken_.updateFlowWithCtx(
                torexAddr,
                superToken_.getFlowRate(address(this), torexAddr) +
                    inflowRate,
                newCtx
            );
        }

        // TODO: Create a stream for rewards token to the user

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
        int96 inflowChange = superToken_.getFlowRate(sender_, address(this)) - previousFlowRate_;

        // update outflows
        newCtx = superToken_.updateFlowWithCtx(
            torexAddr,
            superToken_.getFlowRate(address(this), torexAddr)
                + inflowChange,
            newCtx
        );
    }

    function onFlowDeleted(
        ISuperToken superToken_,
        address, /*sender_*/
        address receiver_,
        int96 previousFlowRate_,
        uint256, /*lastUpdated*/
        bytes calldata ctx_
    ) internal override returns (bytes memory newCtx) {
        newCtx = ctx_;

        // remaining inflow is equal to total outflow less the inflow that just got deleted
        int96 remainingInflow = superToken_.getFlowRate(address(this), torexAddr) - previousFlowRate_;

        // handle "rogue recipients" with sticky stream - see readme
        if (receiver_ == torexAddr) {
            newCtx = superToken_.createFlowWithCtx(receiver_, previousFlowRate_, newCtx);
        }

        // if there is no more inflow, outflows should be deleted
        if (remainingInflow <= 0) {
            newCtx = superToken_.deleteFlowWithCtx(address(this), torexAddr, newCtx);
        }
        // otherwise, there's still inflow left and outflows must be updated
        else {
            newCtx = superToken_.updateFlowWithCtx(torexAddr, remainingInflow, newCtx);
        }
    }

    function claimOutTokens() external {
        // TODO: Maybe add incentives for users to call this
        outToken.distributeToPool(address(this), outPool, outToken.balanceOf(address(this)));
    }
}


