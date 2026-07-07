export interface Domain {
  id: number;
  domainUrl: string;
  verificationToken: string;
  verified: boolean;
  createdAt: string;
  serviceName?: string;
}
