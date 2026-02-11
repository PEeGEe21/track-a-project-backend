import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { MessagesService } from '../services/messages.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  getUserConversations(
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.getUserConversations(req.user, organizationId);
  }

  @Post('conversations')
  startConversation(
    @Req() req,
    @Body('peer_id') peerId: number,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.startConversationWithMember(
      req.user,
      peerId,
      organizationId,
    );
  }

  @Get('conversation/:id')
  getConversationMessages(
    @Req() req,
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.getConversationMessages(
      req.user,
      id,
      organizationId,
    );
  }

  @Get('get-peers')
  getPeers(@Req() req, @Headers('x-organization-id') organizationId: string) {
    return this.messagesService.getUnchattedMembers(req.user, organizationId);
  }

  @Post('send')
  sendMessage(
    @Req() req,
    @Body() body: { conversationId: string; content: string },
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.sendMessage(
      req.user,
      body.conversationId,
      body.content,
      organizationId,
    );
  }
}
