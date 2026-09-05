export const HouseholdRoles = {
  OWNER: 'OWNER',
  PARENT: 'PARENT'
} as const;

export type HouseholdRole = (typeof HouseholdRoles)[keyof typeof HouseholdRoles];

export const ChildStatuses = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED'
} as const;

export type ChildStatus = (typeof ChildStatuses)[keyof typeof ChildStatuses];

export interface Household {
  id: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChildProfile {
  id: string;
  householdId: string;
  preferredName: string;
  gradeBand: string;
  status: ChildStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHouseholdInput {
  name?: string | null;
}

export interface CreateHouseholdMemberInput {
  householdId: string;
  userId: string;
  role: HouseholdRole;
}

export interface CreateChildProfileInput {
  householdId: string;
  preferredName: string;
  gradeBand: string;
  status?: ChildStatus;
}

export interface UpdateChildProfileInput {
  preferredName?: string;
  gradeBand?: string;
  status?: ChildStatus;
}

export interface HouseholdNotificationPreferences {
  parentPhone: string | null;
  whatsappConsent: boolean;
  whatsappConsentAt: Date | null;
}

export interface UpdateHouseholdNotificationInput {
  parentPhone?: string | null;
  whatsappConsent?: boolean;
}

