import type { components, operations } from './generated/schema';

type Schemas = components['schemas'];

export type AuthBootstrap = Schemas['AuthBootstrap'];
export type AuthenticationChallenge = Schemas['AuthenticationChallenge'];
export type AuthenticationCredential = Schemas['AuthenticationCredential'];
export type RegistrationChallenge = Schemas['RegistrationChallenge'];
export type RegistrationCredential = Schemas['RegistrationCredential'];
export type Session = Schemas['Session'];
export type ActiveSession = Schemas['ActiveSession'];
export type AuthMethod = Session['auth_method'];
export type NostrStart = Schemas['NostrStart'];
export type NostrChallenge = Schemas['NostrChallenge'];
export type NostrEventTemplate = Schemas['NostrEventTemplate'];
export type NostrEvent = Schemas['NostrEvent'];
export type NostrIdentity = Schemas['NostrIdentity'];
export type NostrAuthorizationStart = Schemas['NostrAuthorizationStart'];
export type PublicPolicy = Schemas['PublicPolicy'];
export type NodeSummary = Schemas['NodeSummary'];
export type NodeStatus = Schemas['NodeStatus'];
export type NodeInfo = Schemas['NodeInfo'];
export type NodePolicy = Schemas['NodePolicy'];
export type AmountBounds = Schemas['AmountBounds'];
export type FeeEstimates = Schemas['FeeEstimates'];
export type Balances = Schemas['Balances'];
export type Capability = Schemas['Capability'];
export type Network = Schemas['Network'];
export type Invoice = Schemas['Invoice'];
export type InvoiceState = Schemas['InvoiceState'];
export type Payment = Schemas['Payment'];
export type PaymentState = Schemas['PaymentState'];
export type Peer = Schemas['Peer'];
export type Channel = Schemas['Channel'];
export type ChannelState = Schemas['ChannelState'];
export type Transaction = Schemas['Transaction'];
export type DecodedInvoice = Schemas['DecodedInvoice'];
export type OperationKind = Schemas['OperationKind'];
export type OperationState = Schemas['OperationState'];
export type OperationStage = Schemas['OperationStage'];
export type Operation = Schemas['Operation'];
export type OperationReview = Schemas['OperationReview'];
export type OperationResult = Schemas['OperationResult'];
export type OperationAuthorization = Schemas['OperationAuthorization'];
export type AuthorizationStart = Schemas['AuthorizationStart'];
export type CreateOperationRequest = Schemas['CreateOperationRequest'];
export type ErrorDetail = Schemas['ErrorDetail'];
export type ErrorCode = Schemas['ErrorCode'];
export type PageMeta = Schemas['PageMeta'];

export type CapabilityKey = keyof Schemas['Capabilities'];
export type CapabilityReason = Extract<Capability, { enabled: false }>['reason'];
export type OperationListState = NonNullable<
  NonNullable<operations['listOperations']['parameters']['query']>['state']
>;
