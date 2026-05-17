// Federation Gateway — exports for Hub and Runner
export {
  type FederationMessage,
  type FederationMessageType,
  type FederationRegisterPayload,
  type FederationRegisterResultPayload,
  type FederationHeartbeatPayload,
  type FederationMemberJoinedPayload,
  type FederationMemberLeftPayload,
  type FederationTaskBroadcastPayload,
  type FederationTaskClaimPayload,
  type FederationAgentWakePayload,
  type FederationRoleCard,
  buildFedMsg,
  parseFedMsg,
  genFedMsgId,
} from './protocol.js';

export {
  handleFederationConnection,
  registerFederationHubRoutes,
  startHubHeartbeat,
  stopHubHeartbeat,
  getPeers,
  wakeFederationAgent,
  indexGroupTask,
} from './hub.js';

export {
  initFederationRunner,
  isRunnerConnected,
  publishTaskToHub,
  claimTaskOnHub,
} from './runner.js';
