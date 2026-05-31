import { config } from 'src/config';

export class InviteLinks {
  static peerLogin(inviteCode: string): string {
    return `${config.frontendUrl}/auth/login?${inviteCode}`;
  }

  static peerOnboarding(inviteCode: string, email: string): string {
    return `${config.frontendUrl}/auth/peer-invite?refCode=${inviteCode}&refEmail=${email}`;
  }

  static orgJoin(invitationToken: string): string {
    return `${config.frontendUrl}/signup/join-org?invite=${invitationToken}`;
  }

  static orgSignup(invitationToken: string): string {
    return `${config.frontendUrl}/signup?invite=${invitationToken}`;
  }

  static projectLogin(): string {
    return `${config.peerLinkMain || config.frontendUrl}/auth/login`;
  }

  static projectInvite(inviteCode: string, projectId: string | number): string {
    return `${config.peerLinkMain || config.frontendUrl}/peerinvites/${inviteCode}/${projectId}`;
  }
}
