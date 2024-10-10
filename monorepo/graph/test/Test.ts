import assert from "assert";
import { 
  TestHelpers,
  SBIncentivesApp_FlowCreated
} from "generated";
const { MockDb, SBIncentivesApp } = TestHelpers;

describe("SBIncentivesApp contract FlowCreated event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for SBIncentivesApp contract FlowCreated event
  const event = SBIncentivesApp.FlowCreated.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("SBIncentivesApp_FlowCreated is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await SBIncentivesApp.FlowCreated.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualSBIncentivesAppFlowCreated = mockDbUpdated.entities.SBIncentivesApp_FlowCreated.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedSBIncentivesAppFlowCreated: SBIncentivesApp_FlowCreated = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      sender: event.params.sender,
      flowRate: event.params.flowRate,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualSBIncentivesAppFlowCreated, expectedSBIncentivesAppFlowCreated, "Actual SBIncentivesAppFlowCreated should be the same as the expectedSBIncentivesAppFlowCreated");
  });
});
