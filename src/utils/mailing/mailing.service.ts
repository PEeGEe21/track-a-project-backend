import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as sendGrid from '@sendgrid/mail';
import * as fs from 'fs';
import { User } from 'src/typeorm/entities/User';
import { AddPeerDto } from 'src/users/dtos/AddPeer.dto';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Mail } from 'nodemailer/lib/mailer';
import * as handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { MailTemplateParams } from '../types';
import { Queue, Worker } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { config } from 'src/config';
import { AppLogger } from 'src/common/logging/app-logger';
// import * as mustache from 'mustache';

@Injectable()
export class MailingService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // sendGrid.setApiKey(config.sendGrid.apiKey);
  }

  async onModuleInit() {
    if (config.queue.driver !== 'redis') {
      return;
    }

    const connection = this.redisService.getBullConnection();
    if (!connection) {
      AppLogger.warn(
        'MailingService',
        'QUEUE_DRIVER=redis is configured but Redis is unavailable. Falling back to inline email delivery.',
      );
      return;
    }

    this.queue = new Queue('mail', {
      connection,
      prefix: config.redis.prefix,
    });
    this.worker = new Worker(
      'mail',
      async (job) => this.sendEmailDirect(job.data),
      {
        connection,
        prefix: config.redis.prefix,
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  mailTransport() {
    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USERNAME'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });

    return transporter;
  }

  async sendEmail(message): Promise<string> {
    if (config.queue.driver === 'redis' && this.queue) {
      await this.queue.add('send', message, {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
      return 'success';
    }

    return this.sendEmailDirect(message);
  }

  private async sendEmailDirect(message): Promise<string> {
    const transport = this.mailTransport();
    const options: Mail.Options = {
      from: message.from ?? {
        name: this.configService.get<string>('APP_NAME'),
        address: this.configService.get<string>('DEFAULT_FROM_EMAIL'),
      },
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: `${message.html}`,
    };

    try {
      await transport.sendMail(options);
      return 'success';
    } catch (error) {
      AppLogger.error('MailingService', 'Message not sent');
      return 'error';
    }
  }

  async returnMailTemplate(data: MailTemplateParams) {
    try {
      const template_type = data?.template;

      let html = '';
      switch (template_type) {
        case 'peer_invite':
          html = await this.compilePeerTemplate('peer-invite', {
            inviterEmail: data.inviterEmail,
            inviteLink: data.inviteLink,
          });
          break;
        case 'new_peer_invite':
          html = await this.compilePeerTemplate('new-user-peer-invite', {
            inviterEmail: data.inviterEmail,
            inviteLink: data.inviteLink,
          });
          break;
        case 'project_peer_invite':
          html = await this.compileProjectPeerTemplate('project-peer-invite', {
            inviterEmail: data.inviterEmail,
            inviteLink: data.inviteLink,
            inviterName: data.inviterName,
            project: data?.project?.title,
          });
          break;
        default:
          break;
      }

      return html;
    } catch (err) {}
  }

  // PEER
  private async compilePeerTemplate(templateName: string, context: any) {
    const templatePath = path.resolve(
      process.cwd(),
      'src/utils/mailing/templates/peer',
      `${templateName}.hbs`,
    );
    const templateContent = await readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    return template(context);
  }

  async sendPeerInvite(
    inviterEmail: string,
    user: User,
    eventLink: string,
    peerAccount: boolean,
    peerEmail: string,
  ): Promise<string> {
    let template = '';
    if (peerAccount) {
      template = 'peer_invite';
    } else {
      template = 'new_peer_invite';
    }

    const data = {
      template: template,
      inviterEmail: inviterEmail,
      inviteLink: eventLink,
    };

    const html = await this.returnMailTemplate(data);

    const msg = {
      subject: `${user?.first_name} ${user?.last_name} has added you as a peer`,
      text: peerEmail,
      template: '',
      to: inviterEmail,
      from: user.email,
      eventLink: eventLink,
      html,
    };

    return this.sendEmail(msg);
  }

  // peer projects
  private async compileProjectPeerTemplate(templateName: string, context: any) {
    const templatePath = path.resolve(
      process.cwd(),
      'src/utils/mailing/templates/project',
      `${templateName}.hbs`,
    );
    const templateContent = await readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    return template(context);
  }

  async sendProjectPeerInvite(
    inviterEmail: string,
    user: User,
    eventLink: string,
    peerAccount: boolean,
    peerEmail: string,
    project = null,
  ): Promise<string> {
    let template = '';

    const data = {
      template: 'project_peer_invite',
      inviterEmail: inviterEmail,
      inviterName: user?.fullName,
      inviteLink: eventLink,
      project: project,
    };

    const html = await this.returnMailTemplate(data);

    const msg = {
      subject: `${user?.fullName} has added you as a project peer`,
      text: peerEmail,
      template: '',
      to: inviterEmail,
      from: user.email,
      eventLink: eventLink,
      html,
    };

    return this.sendEmail(msg);
  }
  // end peer project

  async sendMessage(message): Promise<string> {
    try {
      await sendGrid.send(message);
      return 'Successful';
    } catch (error) {
      AppLogger.error('MailingService', 'SendGrid message not sent');
      return 'Unsuccessful';
    }
  }

  async sendPasswordResetOtp(
    email: string,
    otp: string,
    firstName?: string | null,
  ): Promise<string> {
    const displayName = firstName?.trim() || 'there';
    const html = `
      <div style="background:#F8FAFC; padding:32px 16px; font-family:Arial, sans-serif; color:#102A43;">
        <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:20px; overflow:hidden;">
          <div style="padding:24px 28px; background:linear-gradient(135deg,#0F172A 0%,#102A43 55%,#2563EB 140%); color:#FFFFFF;">
            <p style="margin:0; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.8;">Trackr Security</p>
            <h2 style="margin:12px 0 0; font-size:28px; line-height:1.2;">Password reset code</h2>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 12px; font-size:16px; line-height:1.7;">Hi ${displayName},</p>
            <p style="margin:0; font-size:16px; line-height:1.7;">
              We received a request to reset your password. Use the verification code below to continue.
            </p>
            <div style="margin:28px 0; padding:18px 20px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:16px; text-align:center;">
              <span style="font-size:34px; font-weight:700; letter-spacing:10px; color:#0F172A;">${otp}</span>
            </div>
            <p style="margin:0 0 10px; font-size:14px; line-height:1.7; color:#486581;">
              This code expires in a few minutes. If you did not request this change, you can safely ignore this email.
            </p>
            <p style="margin:0; font-size:14px; line-height:1.7; color:#486581;">
              For security, never share this code with anyone.
            </p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Your password reset code',
      text: `Your password reset code is ${otp}`,
      html,
    });
  }

  private async compileTemplate2(templateName: string, context: any) {
    const templatePath = path.join(
      __dirname,
      'templates',
      `${templateName}.hbs`,
    );
    const templateContent = await readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    return template(context);
  }

  async sendPeerProject(
    addPeerDto: AddPeerDto,
    user: User,
    eventLink: string,
    peerAccount: boolean,
    peerEmail: string,
  ): Promise<string> {
    const msg = {
      subject: `${user?.profile?.firstname} ${user?.profile?.lastname} has added you as a peer`,
      text: peerEmail,
      template: '',
      to: addPeerDto,
      from: user.email,
      // templateId: peerAccount
      //   ? process.env.PEER_INVITE_EXISTING
      //   : process.env.PEER_INVITE,
      eventLink: eventLink,
      // dynamic_template_data: {
      //   // outfitBuyer: `${user.firstname} ${user.lastname}`,
      //   peerName: `${user?.profile?.firstname} ${user?.profile?.lastname}`,
      //   link: eventLink,
      //   name: `${user?.profile?.firstname} ${user?.profile?.lastname}`,
      //   loginUrl: `${process.env.PEER_LINK}/signin`,
      // },
    };

    return this.sendEmail(msg);
  }

  async sendPeerInvite2(
    inviterEmail: string,
    user: User,
    eventLink: string,
    peerAccount: boolean,
    peerEmail: string,
  ): Promise<string> {
    const html = await this.compilePeerTemplate('peer-invite', {
      inviterEmail,
      eventLink,
    });
    const msg = {
      subject: `${user?.profile?.firstname} ${user?.profile?.lastname} has added you as a peer`,
      text: peerEmail,
      template: '',
      to: inviterEmail,
      from: user.email,
      // templateId: peerAccount
      //   ? process.env.PEER_INVITE_EXISTING
      //   : process.env.PEER_INVITE,
      eventLink: eventLink,
      // dynamic_template_data: {
      //   // outfitBuyer: `${user.firstname} ${user.lastname}`,
      //   peerName: `${user?.profile?.firstname} ${user?.profile?.lastname}`,
      //   link: eventLink,
      //   name: `${user?.profile?.firstname} ${user?.profile?.lastname}`,
      //   loginUrl: `${process.env.PEER_LINK}/signin`,
      // },
    };

    console.log(msg, 'message');

    return this.sendEmail(msg);
  }
}
