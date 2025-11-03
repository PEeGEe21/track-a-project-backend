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
} from '@nestjs/common';
import { MessagesService } from '../services/messages.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  getUserConversations(@Req() req) {
    return this.messagesService.getUserConversations(req.user);
  }

  @Post('conversations')
  startConversation(@Req() req, @Body('peer_id') peerId: number) {
    return this.messagesService.startConversationWithPeer(req.user, peerId);
  }

  @Get('conversation/:id')
  getConversationMessages(@Req() req, @Param('id') id: string) {
    return this.messagesService.getConversationMessages(req.user, id);
  }

  @Get('get-peers')
  getPeers(@Req() req) {
    return this.messagesService.getUnchattedPeers(req.user);
  }

  @Post('send')
  sendMessage(
    @Req() req,
    @Body() body: { conversationId: string; content: string },
  ) {
    return this.messagesService.sendMessage(
      req.user,
      body.conversationId,
      body.content,
    );
  }
}
