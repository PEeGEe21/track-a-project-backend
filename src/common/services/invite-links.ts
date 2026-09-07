import { config } from 'src/config';

const url = config.isDevelopment ? config.feDevBaseUrl : config.frontendUrl;

export class InviteLinks {
  static peerLogin(inviteCode: string): string {
    return `${url}/auth/login?inviteCode=${encodeURIComponent(inviteCode)}`;
  }

  static peerOnboarding(inviteCode: string, email: string): string {
    return `${url}/auth/peer-invite?refCode=${encodeURIComponent(
      inviteCode,
    )}&refEmail=${encodeURIComponent(email)}`;
  }

  static orgJoin(invitationToken: string): string {
    console.log(url)
    return `${url}/auth/signup/join-org?invite=${encodeURIComponent(
      invitationToken,
    )}`;
  }

  static orgSignup(invitationToken: string): string {
    return `${url}/auth/signup?invite=${encodeURIComponent(invitationToken)}`;
  }

  static projectLogin(): string {
    return `${url}/auth/login`;
  }

  static projectInvite(inviteCode: string, projectId: string | number): string {
    return `${url}/auth/project-invite/${encodeURIComponent(
      inviteCode,
    )}/${encodeURIComponent(String(projectId))}`;
  }
}
