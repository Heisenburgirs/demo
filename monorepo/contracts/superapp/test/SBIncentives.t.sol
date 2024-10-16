// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ISuperfluid, ISuperToken, IERC20, IERC20Metadata, ISuperfluidPool, IConstantFlowAgreementV1, ISETH} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {MacroForwarder} from "@superfluid-finance/ethereum-contracts/contracts/utils/MacroForwarder.sol";
import {SuperTokenV1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import {ITorex} from "../src/interfaces/ITorex.sol";
import {SBIncentives} from "../src/SBIncentives.sol";
import { SBMacro } from "../src/SBMacro.sol";
import { Scaler } from "../src/utils/Scaler.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {console} from "forge-std/console.sol";

using SuperTokenV1Library for ISuperToken;

/**
 * Fork test.
 * Configuration to be provided via env vars RPC, HOST_ADDR, TOREX1_ADDR, TOREX2_ADDR MACRO_FWD_ADDR.
 * TOREX1_ADDR shall point to a Torex where the inToken1 is an ERC20 wrapper.
 * TOREX2_ADDR shall point to a Torex where the inToken1 wraps the native token (ETHx).
 */
contract SBIncentivesTest is Test {
    ISuperfluid host;
    ITorex torex1;
    ITorex torex2;
    ISuperToken inToken1;
    ISuperToken inToken2;
    MacroForwarder macroFwd;
    SBIncentives i;
    SBMacro m;

    address alice = address(0x721);
    address bob = address(0x722);

    int96 constant DEFAULT_FLOWRATE = 4 ether;
    address DEFAULT_DISTRIBUTOR = address(0x69);
    address DEFAULT_REFERRER = address(0x70);

    uint256 constant upgradeAmount = 120000 ether;

    constructor() {
        string memory rpc = vm.envString("RPC");
        vm.createSelectFork(rpc);
        address hostAddr = vm.envAddress("HOST_ADDR");
        host = ISuperfluid(hostAddr);
        address torex1Addr = vm.envAddress("TOREX1_ADDR");
        torex1 = ITorex(torex1Addr);
        address torex2Addr = vm.envAddress("TOREX2_ADDR");
        torex2 = ITorex(torex2Addr);
        address macroFwdAddr = vm.envAddress("MACRO_FWD_ADDR");
        macroFwd = MacroForwarder(macroFwdAddr);
    }

    function setUp() public {
        (inToken1, ) = torex1.getPairedTokens();
        (inToken2, ) = torex2.getPairedTokens();
        
        // can't directly deal SuperTokens (see https://github.com/foundry-rs/forge-std/issues/570), thus using upgrade()
        vm.deal(alice, 1e20 ether);
        deal(inToken1.getUnderlyingToken(), alice, 1_500_000 ether);
        deal(inToken1.getUnderlyingToken(), bob, 1_500_000 ether);

        m = new SBMacro();
        i = new SBIncentives(address(torex1), inToken1);

        address underlyingToken = inToken1.getUnderlyingToken();

        vm.prank(alice);
        IERC20(underlyingToken).approve(address(inToken1), type(uint256).max);

        vm.startPrank(bob);
        IERC20(underlyingToken).approve(address(inToken1), type(uint256).max);
        inToken1.upgrade(upgradeAmount);
        inToken1.transfer(address(i), upgradeAmount);
        vm.stopPrank();

        // console.log(address(inToken1));
        // console.log(inToken1.balanceOf(alice));
        // console.log(inToken1.getUnderlyingToken());
        // console.log(IERC20(inToken1.getUnderlyingToken()).balanceOf(alice));
    }

    function testStreamToTorex() external {
        vm.prank(alice);
        macroFwd.runMacro(m, abi.encode(address(torex1), DEFAULT_FLOWRATE, DEFAULT_DISTRIBUTOR, DEFAULT_REFERRER, upgradeAmount));
        
        i.registerOrUpdateStream(alice);

        ISuperfluidPool outTokenDistributionPool = torex1.outTokenDistributionPool();
        ISuperfluidPool rewardTokenPool = i.rewardTokenPool();

        assertGt(
            outTokenDistributionPool.getUnits(alice),
            0,
            "no outTokenDistributionPool units assigned"
        );
        assertGt(
            rewardTokenPool.getUnits(alice),
            0,
            "no rewardTokenPool units assigned"
        );
        assertEq(
            inToken1.getFlowRate(alice, address(torex1)),
            DEFAULT_FLOWRATE,
            "wrong flowrate to torex"
        );
    }

    function testStreamToTorexAndConnectPool() external {
        vm.startPrank(alice);
        macroFwd.runMacro(m, abi.encode(address(torex1), DEFAULT_FLOWRATE, DEFAULT_DISTRIBUTOR, DEFAULT_REFERRER, upgradeAmount));
        i.registerOrUpdateStream(alice);
        i.connectToPool();
        vm.stopPrank();

        ISuperfluidPool outTokenDistributionPool = torex1.outTokenDistributionPool();
        ISuperfluidPool rewardTokenPool = i.rewardTokenPool();

        i.startStreamToPool(DEFAULT_FLOWRATE);

        assertGt(
            outTokenDistributionPool.getUnits(alice),
            0,
            "no outTokenDistributionPool units assigned"
        );
        assertGt(
            rewardTokenPool.getUnits(alice),
            0,
            "no rewardTokenPool units assigned"
        );
        assertEq(
            inToken1.getFlowRate(alice, address(torex1)),
            DEFAULT_FLOWRATE,
            "wrong flowrate to torex"
        );
        assertGt(
            rewardTokenPool.getMemberFlowRate(alice),
            0,
            "no rewardToken flowRate established"
        );
        assertGt(
            rewardTokenPool.getTotalFlowRate(),
            0,
            "no rewardToken flowRate established"
        );
        assertGt(
            rewardTokenPool.getTotalConnectedFlowRate(),
            rewardTokenPool.getTotalFlowRate(),
            "alice isn't getting the full connected flowRate"
        );
        assertEq(
            rewardTokenPool.getTotalDisconnectedFlowRate(),
            0,
            "disconnected rewardToken flowRate is not zero"
        );
        assertGt(
            rewardTokenPool.getTotalUnits(),
            0,
            "no rewardToken units assigned"
        );
        assertGt(
            rewardTokenPool.getTotalConnectedUnits(),
            rewardTokenPool.getTotalUnits(),
            "alice didn't get the full connected units"
        );
        assertEq(
            rewardTokenPool.getTotalDisconnectedUnits(),
            0,
            "disconnected rewardToken units is not zero"
        );


        console.log("Reward Pool Units:", rewardTokenPool.getUnits(alice));
        console.log("Distribution Pool Units:", outTokenDistributionPool.getUnits(alice));
        console.log("Reward Pool Flow Rate:", rewardTokenPool.getMemberFlowRate(alice));
        console.log("Distribution Pool Flow Rate:", outTokenDistributionPool.getMemberFlowRate(alice));

        console.log("Total Reward Units:", rewardTokenPool.getTotalUnits());
        console.log("Total Connected Units:", rewardTokenPool.getTotalConnectedUnits());
        console.log("Total Disconnected Units:", rewardTokenPool.getTotalDisconnectedUnits());
        console.log("Total Reward Flow Rate:", rewardTokenPool.getTotalFlowRate());
        console.log("Total Connected Flow Rate:", rewardTokenPool.getTotalConnectedFlowRate());
        console.log("Total Disconnected Flow Rate:", rewardTokenPool.getTotalDisconnectedFlowRate());

        assertEq(
            inToken1.getFlowRate(alice, address(torex1)),
            DEFAULT_FLOWRATE + 1 ether,
            "wrong flowrate to torex"
        );

        // console.log("Reward Pool Units:", rewardTokenPool.getUnits(alice));
        // console.log("Distribution Pool Units:", outTokenDistributionPool.getUnits(alice));
        // console.log("Reward Pool Flow Rate:", rewardTokenPool.getMemberFlowRate(alice));
        // console.log("Distribution Pool Flow Rate:", outTokenDistributionPool.getMemberFlowRate(alice));

        // console.log("Total Reward Units:", rewardTokenPool.getTotalUnits());
        // console.log("Total Connected Units:", rewardTokenPool.getTotalConnectedUnits());
        // console.log("Total Disconnected Units:", rewardTokenPool.getTotalDisconnectedUnits());
        // console.log("Total Reward Flow Rate:", rewardTokenPool.getTotalFlowRate());
        // console.log("Total Connected Flow Rate:", rewardTokenPool.getTotalConnectedFlowRate());
        // console.log("Total Disconnected Flow Rate:", rewardTokenPool.getTotalDisconnectedFlowRate());
    }

    function testStreamToTorexAndConnectPoolMultiple() external {
        vm.startPrank(alice);
        macroFwd.runMacro(m, abi.encode(address(torex1), DEFAULT_FLOWRATE, DEFAULT_DISTRIBUTOR, DEFAULT_REFERRER, upgradeAmount));
        i.registerOrUpdateStream(alice);
        i.connectToPool();
        vm.stopPrank();

        vm.startPrank(bob);
        macroFwd.runMacro(m, abi.encode(address(torex1), DEFAULT_FLOWRATE, DEFAULT_DISTRIBUTOR, DEFAULT_REFERRER, upgradeAmount));
        i.registerOrUpdateStream(bob);
        i.connectToPool();
        vm.stopPrank();

        ISuperfluidPool outTokenDistributionPool = torex1.outTokenDistributionPool();
        ISuperfluidPool rewardTokenPool = i.rewardTokenPool();

        i.startStreamToPool(DEFAULT_FLOWRATE);

        assertGt(
            outTokenDistributionPool.getUnits(alice),
            0,
            "no outTokenDistributionPool units assigned"
        );
        assertGt(
            rewardTokenPool.getUnits(alice),
            0,
            "no rewardTokenPool units assigned"
        );
        assertEq(
            inToken1.getFlowRate(alice, address(torex1)),
            DEFAULT_FLOWRATE,
            "wrong flowrate to torex"
        );
        assertGt(
            rewardTokenPool.getMemberFlowRate(alice),
            0,
            "no rewardToken flowRate established"
        );
        assertGt(
            rewardTokenPool.getTotalFlowRate(),
            0,
            "no rewardToken flowRate established"
        );
        assertGt(
            rewardTokenPool.getTotalConnectedFlowRate(),
            rewardTokenPool.getTotalFlowRate(),
            "alice isn't getting the full connected flowRate"
        );
        assertEq(
            rewardTokenPool.getTotalDisconnectedFlowRate(),
            0,
            "disconnected rewardToken flowRate is not zero"
        );
        assertGt(
            rewardTokenPool.getTotalUnits(),
            0,
            "no rewardToken units assigned"
        );
        assertGt(
            rewardTokenPool.getTotalConnectedUnits(),
            rewardTokenPool.getTotalUnits(),
            "alice didn't get the full connected units"
        );
        assertEq(
            rewardTokenPool.getTotalDisconnectedUnits(),
            0,
            "disconnected rewardToken units is not zero"
        );


        console.log("Reward Pool Units:", rewardTokenPool.getUnits(alice));
        console.log("Distribution Pool Units:", outTokenDistributionPool.getUnits(alice));
        console.log("Reward Pool Flow Rate:", rewardTokenPool.getMemberFlowRate(alice));
        console.log("Distribution Pool Flow Rate:", outTokenDistributionPool.getMemberFlowRate(alice));

        console.log("Total Reward Units:", rewardTokenPool.getTotalUnits());
        console.log("Total Connected Units:", rewardTokenPool.getTotalConnectedUnits());
        console.log("Total Disconnected Units:", rewardTokenPool.getTotalDisconnectedUnits());
        console.log("Total Reward Flow Rate:", rewardTokenPool.getTotalFlowRate());
        console.log("Total Connected Flow Rate:", rewardTokenPool.getTotalConnectedFlowRate());
        console.log("Total Disconnected Flow Rate:", rewardTokenPool.getTotalDisconnectedFlowRate());

        // assertEq(
        //     inToken1.getFlowRate(alice, address(torex1)),
        //     DEFAULT_FLOWRATE + 1 ether,
        //     "wrong flowrate to torex"
        // );

        // console.log("Reward Pool Units:", rewardTokenPool.getUnits(alice));
        // console.log("Distribution Pool Units:", outTokenDistributionPool.getUnits(alice));
        // console.log("Reward Pool Flow Rate:", rewardTokenPool.getMemberFlowRate(alice));
        // console.log("Distribution Pool Flow Rate:", outTokenDistributionPool.getMemberFlowRate(alice));

        // console.log("Total Reward Units:", rewardTokenPool.getTotalUnits());
        // console.log("Total Connected Units:", rewardTokenPool.getTotalConnectedUnits());
        // console.log("Total Disconnected Units:", rewardTokenPool.getTotalDisconnectedUnits());
        // console.log("Total Reward Flow Rate:", rewardTokenPool.getTotalFlowRate());
        // console.log("Total Connected Flow Rate:", rewardTokenPool.getTotalConnectedFlowRate());
        // console.log("Total Disconnected Flow Rate:", rewardTokenPool.getTotalDisconnectedFlowRate());
    }

    // function testWithoutUpgrade() external {
    //     SBIncentives m = new SBIncentives(macroFwd, macroAddress);

    //     vm.startPrank(alice);
    //     address underlyingToken = inToken1.getUnderlyingToken();
    //     IERC20(underlyingToken).approve(address(inToken1), type(uint256).max);
    //     inToken1.upgrade(1000 ether);

    //     macroFwd.runMacro(
    //         m,
    //         abi.encode(
    //             address(torex1),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             0
    //         )
    //     );
    //     vm.stopPrank();

    //     ISuperfluidPool outTokenDistributionPool = torex1
    //         .outTokenDistributionPool();
    //     assertGt(
    //         outTokenDistributionPool.getUnits(alice),
    //         0,
    //         "no outTokenDistributionPool units assigned"
    //     );
    //     assertEq(
    //         inToken1.getFlowRate(alice, address(torex1)),
    //         DEFAULT_FLOWRATE,
    //         "wrong flowrate to torex"
    //     );

    //     // TODO: verify distributor, referrer
    // }

    // function testWithoutUpgradeUsingConvenienceFunction() external {
    //     SBIncentives m = new SBIncentives();

    //     vm.startPrank(alice);
    //     address underlyingToken = inToken1.getUnderlyingToken();
    //     IERC20(underlyingToken).approve(address(inToken1), type(uint256).max);
    //     inToken1.upgrade(1000 ether);

    //     macroFwd.runMacro(
    //         m,
    //         m.getParams(
    //             address(torex1),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             0
    //         )
    //     );
    //     m.postCheck(
    //         host,
    //         m.getParams(
    //             address(torex1),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             0
    //         ),
    //         alice
    //     );
    //     vm.stopPrank();

    //     ISuperfluidPool outTokenDistributionPool = torex1
    //         .outTokenDistributionPool();
    //     assertGt(
    //         outTokenDistributionPool.getUnits(alice),
    //         0,
    //         "no outTokenDistributionPool units assigned"
    //     );
    //     assertEq(
    //         inToken1.getFlowRate(alice, address(torex1)),
    //         DEFAULT_FLOWRATE,
    //         "wrong flowrate to torex"
    //     );
    //     // TODO: verify distributor, referrer
    // }

    // function testWithExactUpgradeAmount() public {
    //     SBIncentives m = new SBIncentives();

    //     vm.startPrank(alice);
    //     address underlyingToken = inToken1.getUnderlyingToken();
    //     IERC20(underlyingToken).approve(address(inToken1), type(uint256).max);

    //     vm.expectRevert(); // revert bcs sender got no SuperTokens and upgradeAmount is 0
    //     macroFwd.runMacro(
    //         m,
    //         abi.encode(
    //             address(torex1),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             0
    //         )
    //     );

    //     uint256 upgradeAmount = 1000 ether;
    //     (uint256 underlyingAmount, ) = inToken1.toUnderlyingAmount(
    //         upgradeAmount
    //     );
    //     uint256 uBalanceBefore = IERC20(underlyingToken).balanceOf(alice);
    //     macroFwd.runMacro(
    //         m,
    //         abi.encode(
    //             address(torex1),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             1000 ether
    //         )
    //     );
    //     uint256 uBalanceAfter = IERC20(underlyingToken).balanceOf(alice);
    //     vm.stopPrank();

    //     assertEq(
    //         uBalanceBefore - uBalanceAfter,
    //         underlyingAmount,
    //         "wrong underlying token amount after upgrade"
    //     );
    //     assertEq(
    //         inToken1.getFlowRate(alice, address(torex1)),
    //         DEFAULT_FLOWRATE,
    //         "wrong flowrate to torex"
    //     );
    // }

    // function testWithMaxUpgradeAmount(uint256 allowance) public {
    //     // set the floor high enough to avoid failure due to insufficient funds for buffer and backcharging
    //     vm.assume(allowance > 1000 ether);
    //     SBIncentives m = new SBIncentives();

    //     vm.startPrank(alice);
    //     address underlyingToken = inToken1.getUnderlyingToken();
    //     IERC20(underlyingToken).approve(address(inToken1), allowance);
    //     uint256 uBalanceBefore = IERC20(underlyingToken).balanceOf(alice);
    //     macroFwd.runMacro(
    //         m,
    //         abi.encode(
    //             address(torex1),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             type(uint256).max
    //         )
    //     );
    //     uint256 uBalanceAfter = IERC20(underlyingToken).balanceOf(alice);
    //     vm.stopPrank();

    //     // note that this is underlying token amount, may have different decimals than SuperToken
    //     // This assertion may fail if the underlying token has MORE decimals than the SuperToken (more than 18!)
    //     // Since that's a very exotic case and it's a limitation of the test and not of the macro, so be it.
    //     uint256 expectedUpgradedAmount = Math.min(uBalanceBefore, allowance);
    //     assertEq(
    //         uBalanceBefore - uBalanceAfter,
    //         expectedUpgradedAmount,
    //         "wrong underlying token amount after upgrade"
    //     );
    // }

    // function testWithNativeTokenUnderlying() public {
    //     SBIncentives m = new SBIncentives();
    //     vm.deal(alice, 10000 ether);

    //     vm.startPrank(alice);
    //     ISETH(address(inToken2)).upgradeByETH{value: 1000 ether}();
    //     address underlyingToken = inToken2.getUnderlyingToken();
    //     assertEq(
    //         underlyingToken,
    //         address(0),
    //         "underlying token is not native token"
    //     );

    //     macroFwd.runMacro(
    //         m,
    //         abi.encode(
    //             address(torex2),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             0
    //         )
    //     );
    //     vm.stopPrank();

    //     assertEq(
    //         inToken2.getFlowRate(alice, address(torex2)),
    //         DEFAULT_FLOWRATE,
    //         "wrong flowrate to torex"
    //     );
    // }

    // function testWithPreexistingFlow() public {
    //     SBIncentives m = new SBIncentives();

    //     vm.startPrank(alice);
    //     address underlyingToken = inToken1.getUnderlyingToken();
    //     IERC20(underlyingToken).approve(address(inToken1), type(uint256).max);
    //     inToken1.approve(address(torex1), type(uint256).max);
    //     inToken1.upgrade(1000 ether);

    //     inToken1.createFlow(address(torex1), 1, new bytes(0));

    //     macroFwd.runMacro(
    //         m,
    //         abi.encode(
    //             address(torex1),
    //             DEFAULT_FLOWRATE,
    //             DEFAULT_DISTRIBUTOR,
    //             DEFAULT_REFERRER,
    //             0
    //         )
    //     );
    //     vm.stopPrank();

    //     assertEq(
    //         inToken1.getFlowRate(alice, address(torex1)),
    //         DEFAULT_FLOWRATE,
    //         "wrong flowrate to torex after update"
    //     );
    // }
}
