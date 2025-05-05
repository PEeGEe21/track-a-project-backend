import { BadRequestException, Injectable } from '@nestjs/common';
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
// import * as mustache from 'mustache';

@Injectable()
export class MailingService {
  constructor(private readonly configService: ConfigService) {
    // sendGrid.setApiKey(config.sendGrid.apiKey);
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

  private async compileTemplate(templateName: string, context: any) {
    const templatePath = path.resolve(
      process.cwd(),
      'src/utils/mailing/templates',
      `${templateName}.hbs`,
    );
    const templateContent = await readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    return template(context);
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

  async sendMessage(message): Promise<string> {
    console.log(message);
    try {
      const sendMail = await sendGrid.send(message);
      console.log('Message Sent');
      return 'Successful';
    } catch (error) {
      console.log('Message Not Sent');
      console.log(error.response.body.errors);
      return 'Unsuccessful';
    }
  }

  async sendPeerEmail(message): Promise<string> {
    console.log(message);

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

    console.log(options, 'ooptions');

    try {
      const sendMail = await transport.sendMail(options);
      // const sendMail = await sendGrid.sendMail(message);
      console.log(sendMail, 'Message Sent');
      return 'success';
    } catch (error) {
      console.log('Message Not Sent');
      console.log(error);
      return 'error';
    }
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

    console.log(msg, 'message');

    return this.sendPeerEmail(msg);
  }

  async sendPeerInvite(
    inviterEmail: string,
    user: User,
    eventLink: string,
    peerAccount: boolean,
    peerEmail: string,
  ): Promise<string> {
    const html = await this.returnPeerInviteTemplate(
      peerAccount,
      user?.email,
      eventLink,
    );

    console.log(html, 'htmlll')

    const msg = {
      subject: `${user?.first_name} ${user?.last_name} has added you as a peer`,
      text: peerEmail,
      template: '',
      to: inviterEmail,
      from: user.email,
      eventLink: eventLink,
      html,
    };

    return this.sendPeerEmail(msg);
  }

  async returnPeerInviteTemplate(peerAccount, inviterEmail, inviteLink) {
    let html = '';
    if (peerAccount) {
      html = await this.compileTemplate('peer-invite', {
        inviterEmail,
        inviteLink,
      });
    } else {
      html = await this.compileTemplate('new-user-peer-invite', {
        inviterEmail,
        inviteLink,
      });
    }

    return html;
  }

  async sendPeerInvite2(
    inviterEmail: string,
    user: User,
    eventLink: string,
    peerAccount: boolean,
    peerEmail: string,
  ): Promise<string> {
    const html = await this.compileTemplate('peer-invite', {
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

    return this.sendPeerEmail(msg);
  }

  // async send_email(dynamic_data: any): Promise<string> {
  //   console.log(dynamic_data);
  //   const msg = {
  //     to: dynamic_data.email,
  //     from: config.sendGrid.fromEmail,
  //     templateId: dynamic_data.template_id,
  //     subject: dynamic_data.subject,
  //     dynamic_template_data: {
  //       ...dynamic_data,
  //     },
  //   };
  //   return this.sendMessage(msg);
  // }
}
