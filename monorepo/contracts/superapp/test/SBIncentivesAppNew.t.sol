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
import { CFASuperAppBase } from "@superfluid-finance/ethereum-contracts/contracts/apps/CFASuperAppBase.sol";
import { Scaler } from "../src/utils/Scaler.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// host.registerApp(app, 4294967297);


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
    ITorex torex2;
    ISuperToken inToken;
    ISuperToken inToken2;
    ISuperToken outToken;
    ISuperToken outToken2;
    ISuperToken rewardToken;
    Scaler outPoolScaler;
    Scaler rewardPoolScaler;
    SBIncentivesApp app;
    address alice = address(0x721);
    address bob = address(0x722);
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

        address torexAddr2 = vm.envAddress("CELOWETH_TOREX1");
        torex2 = ITorex(torexAddr2);
    }

    function setUp() public {
        (inToken, outToken) = torex.getPairedTokens();
        (inToken2, outToken2) = torex2.getPairedTokens();
        rewardToken = inToken2;

        // can't directly deal SuperTokens (see https://github.com/foundry-rs/forge-std/issues/570), thus using upgrade()
        address underlyingToken = inToken.getUnderlyingToken();
        deal(underlyingToken, alice, 3100000 ether); // make her a trillionaire
        deal(underlyingToken, address(app), 1500000 ether);

        address underlyingToken2 = inToken2.getUnderlyingToken();
        deal(underlyingToken2, alice, 1500000 ether);// make her a trillionaire
        deal(underlyingToken2, address(app), 1500000 ether);

        app = new SBIncentivesApp(host, address(torex), rewardToken, bob);

        vm.startPrank(alice);

        uint256 upgradeAmount = 2400000 ether;
        IERC20(underlyingToken).approve(address(inToken), type(uint256).max);
        inToken.upgrade(upgradeAmount);
        inToken.transfer(address(app), 1200000 ether);
        app.approveSpending(1200000 ether);

        vm.stopPrank();

        console.log(address(inToken));
        console.log(inToken.balanceOf(alice));
        console.log(inToken.getUnderlyingToken());
        console.log(IERC20(inToken.getUnderlyingToken()).balanceOf(alice));

        console.log(address(inToken));
        console.log(inToken.balanceOf(address(app)));
        console.log(inToken.getUnderlyingToken());
        console.log(IERC20(inToken.getUnderlyingToken()).balanceOf(address(app)));
    }

    function testCreateStreamToTorex() public {
        vm.prank(alice);
        inToken.createFlow(address(app), DEFAULT_FLOWRATE);

        assertEq(inToken.getFlowRate(alice, address(app)), DEFAULT_FLOWRATE, "wrong flowrate to app");

        vm.prank(alice);
        app.createStreamToTorex(DEFAULT_FLOWRATE);

        assertEq(inToken.getFlowRate(address(app), address(torex)), DEFAULT_FLOWRATE, "wrong flowrate to torex");

        // ISuperfluidPool outPool = app.outPool();

        // // Assertions: Check if the member's units are updated
        // uint128 newUnits = uint128(SafeCast.toInt128(outPoolScaler.scaleValue(DEFAULT_FLOWRATE)));
        // uint128 updatedUnits = outPool.getMemberUnits(alice);
        // assertEq(updatedUnits, newUnits, "Member units should be updated to the new value");
    }

    function testUpdateStreamToTorex() public {
        vm.prank(alice);
        inToken.createFlow(address(app), DEFAULT_FLOWRATE);

        assertEq(inToken.getFlowRate(alice, address(app)), DEFAULT_FLOWRATE, "wrong flowrate to app");

        vm.prank(bob);
        app.createStreamToTorex(DEFAULT_FLOWRATE);

        assertEq(inToken.getFlowRate(address(app), address(torex)), DEFAULT_FLOWRATE, "wrong flowrate to torex");

        vm.prank(alice);
        inToken.updateFlow(address(app), DEFAULT_FLOWRATE + 1 ether);

        assertEq(inToken.getFlowRate(alice, address(app)), DEFAULT_FLOWRATE + 1 ether, "wrong flowrate to app");
        
        vm.prank(bob);
        app.updateStreamToTorex(1 ether);

        assertEq(inToken.getFlowRate(address(app), address(torex)), DEFAULT_FLOWRATE + 1 ether, "wrong flowrate to torex");
    }

    function testDeleteStreamToTorex() public {
        vm.prank(alice);
        inToken.createFlow(address(app), DEFAULT_FLOWRATE);

        assertEq(inToken.getFlowRate(alice, address(app)), DEFAULT_FLOWRATE, "wrong flowrate to app");

        vm.prank(bob);
        app.createStreamToTorex(DEFAULT_FLOWRATE);

        assertEq(inToken.getFlowRate(address(app), address(torex)), DEFAULT_FLOWRATE, "wrong flowrate to torex");

        vm.prank(alice);
        inToken.deleteFlow(alice, address(app));

        assertEq(inToken.getFlowRate(alice, address(app)), 0, "wrong flowrate to app");
        
        vm.prank(bob);
        app.deleteStreamToTorex(0);

        assertEq(inToken.getFlowRate(address(app), address(torex)), 0, "wrong flowrate to torex");
    }

    function tesCreateAndUpdateStreamToTorex() public {
        SBIncentivesApp app = new SBIncentivesApp(host, address(torex), rewardToken, bob);

        vm.startPrank(alice);

        uint256 upgradeAmount = 1200000 ether;
        address underlyingToken = inToken.getUnderlyingToken();
        IERC20(underlyingToken).approve(address(inToken), type(uint256).max);
        inToken.upgrade(upgradeAmount);

        deal(underlyingToken, address(app), 1500000 ether);
        app.approveSpending(upgradeAmount);
        
        console.log(address(inToken));
        console.log(inToken.balanceOf(alice));
        console.log(inToken.getUnderlyingToken());
        console.log(IERC20(inToken.getUnderlyingToken()).balanceOf(alice));

        console.log(address(inToken));
        console.log(inToken.balanceOf(address(app)));
        console.log(inToken.getUnderlyingToken());
        console.log(IERC20(inToken.getUnderlyingToken()).balanceOf(address(app)));

        (uint256 underlyingAmount,) = inToken.toUnderlyingAmount(upgradeAmount);
        uint256 uBalanceBefore = inToken.balanceOf(alice);
        inToken.createFlow(address(app), DEFAULT_FLOWRATE);
        uint256 uBalanceAfter = inToken.balanceOf(alice);

        vm.stopPrank();

        vm.startPrank(bob);
        app.createStreamToTorex(DEFAULT_FLOWRATE);
        vm.stopPrank();

        console.log("uBalanceBefore", uBalanceBefore);
        console.log("uBalanceAfter", uBalanceAfter);
        console.log("underlyingAmount", underlyingAmount);

        // ISuperfluidPool outPool = app.outPool();

        // // Assertions: Check if the member's units are updated
        // uint128 newUnits = uint128(SafeCast.toInt128(outPoolScaler.scaleValue(DEFAULT_FLOWRATE)));
        // uint128 updatedUnits = outPool.getMemberUnits(alice);
        // assertEq(updatedUnits, newUnits, "Member units should be updated to the new value");

        assertEq(inToken.getFlowRate(alice, address(app)), DEFAULT_FLOWRATE, "wrong flowrate to app");
        assertEq(inToken.getFlowRate(address(app), address(torex)), DEFAULT_FLOWRATE, "wrong flowrate to torex");
    }
} 

