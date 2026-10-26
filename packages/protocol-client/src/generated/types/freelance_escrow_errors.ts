
export const FreelanceEscrowErrorCode = {
  InvalidAmount: 6000,
  InvalidWindow: 6001,
  InvalidRoles: 6002,
  InvalidState: 6003,
  Unauthorized: 6004,
  TermsHashMismatch: 6005,
  DeadlinePassed: 6006,
  DeadlineNotPassed: 6007,
  InvalidResolverStage: 6008,
  InsufficientEscrowBalance: 6009,
  RecipientNotWritable: 6010,
  TimeOverflow: 6011
};

export type FreelanceEscrowErrorName = keyof typeof FreelanceEscrowErrorCode;
