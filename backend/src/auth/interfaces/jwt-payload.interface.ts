import { RoleType } from '../../user/entities/role.entity';

export interface JwtPayload {
  sub: number;
  orgId: string;
  roleType: RoleType;
}

// what every downstream service actually needs to scope its queries —
// see ubiqedge_tech_implementation_spec §1: orgId comes from here, never
// from the request body/params
export interface AuthenticatedUser {
  userId: number;
  orgId: string;
  roleType: RoleType;
}
