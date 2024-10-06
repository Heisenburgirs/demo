// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ISuperfluid, ISuperToken, IERC20, IERC20Metadata, ISuperfluidPool, IConstantFlowAgreementV1, ISETH }
    from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { MacroForwarder } from "@superfluid-finance/ethereum-contracts/contracts/utils/MacroForwarder.sol";
import { SuperTokenV1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import { ITorex } from "../src/interfaces/ITorex.sol";
import { SBIncentivesApp } from "../src/SBIncentivesApp.sol";
import { console } from "forge-std/console.sol";

using SuperTokenV1Library for ISuperToken;

/**
 * Fork test.
 * Configuration to be provided via env vars RPC, HOST_ADDR, TOREX1_ADDR, TOREX2_ADDR MACRO_FWD_ADDR.
 * TOREX1_ADDR shall point to a Torex where the inToken is an ERC20 wrapper.
 * TOREX2_ADDR shall point to a Torex where the inToken wraps the native token (ETHx).
 */
contract SBIncentivesAppTest is Test {
    ISuperfluid host;
    ITorex torex;
    ISuperToken inToken;
    ISuperToken outToken;
    address alice = address(0x721);
    int96 constant DEFAULT_FLOWRATE = 4 ether;
    address DEFAULT_DISTRIBUTOR = address(0x69);
    address DEFAULT_REFERRER = address(0x70);

    constructor() {
        string memory rpc = vm.envString("CELO_RPC");
        vm.createSelectFork(rpc);
        address hostAddr = vm.envAddress("CELO_HOST_ADDR");
        host = ISuperfluid(hostAddr);
        address torexAddr = vm.envAddress("CELOCUSD_TOREX1");
        torex = ITorex(torexAddr);
    }

    function setUp() public {
        (inToken, outToken) = torex.getPairedTokens();
        // can't directly deal SuperTokens (see https://github.com/foundry-rs/forge-std/issues/570), thus using upgrade()
        address underlyingToken = inToken.getUnderlyingToken();
        deal(underlyingToken, alice, 150000 ether); // make her a trillionaire
    }

    function testWithExactUpgradeAmount() public {
        SBIncentivesApp app = new SBIncentivesApp(host, address(torex));

        vm.startPrank(alice);

        console.log(address(inToken));
        console.log(inToken.balanceOf(alice));
        console.log(inToken.getUnderlyingToken());
        console.log(IERC20(inToken.getUnderlyingToken()).balanceOf(alice));

        uint256 upgradeAmount = 120000 ether;
        address underlyingToken = inToken.getUnderlyingToken();
        IERC20(underlyingToken).approve(address(inToken), type(uint256).max);
        inToken.upgrade(upgradeAmount);

        console.log(address(inToken));
        console.log(inToken.balanceOf(alice));
        console.log(inToken.getUnderlyingToken());
        console.log(IERC20(inToken.getUnderlyingToken()).balanceOf(alice));

        (uint256 underlyingAmount,) = inToken.toUnderlyingAmount(upgradeAmount);
        uint256 uBalanceBefore = IERC20(underlyingToken).balanceOf(alice);
        inToken.createFlow(address(app), DEFAULT_FLOWRATE);
        uint256 uBalanceAfter = IERC20(underlyingToken).balanceOf(alice);

        console.log(address(inToken));
        console.log(inToken.balanceOf(alice));
        console.log(inToken.getUnderlyingToken());
        console.log(IERC20(inToken.getUnderlyingToken()).balanceOf(alice));

        vm.stopPrank();

        console.log("uBalanceBefore", uBalanceBefore);
        console.log("uBalanceAfter", uBalanceAfter);
        console.log("underlyingAmount", underlyingAmount);

        assertEq(inToken.getFlowRate(alice, address(app)), DEFAULT_FLOWRATE, "wrong flowrate to app");
        assertEq(inToken.getFlowRate(address(app), address(torex)), DEFAULT_FLOWRATE, "wrong flowrate to torex");
        assertEq(uBalanceBefore - uBalanceAfter, underlyingAmount, "wrong underlying token amount after upgrade");
    }
}