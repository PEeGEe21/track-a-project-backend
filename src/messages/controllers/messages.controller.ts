import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Headers,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MessagesService } from '../services/messages.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { MarkConversationReadDto } from '../dto/mark-conversation-read.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterFile } from 'src/types/multer.types';
import { UploadMessageAttachmentDto } from '../dto/upload-message-attachment.dto';
import { AddMessageReactionDto } from '../dto/add-message-reaction.dto';
import { UpdateConversationPreferencesDto } from '../dto/update-conversation-preferences.dto';
import { ReorderPinnedConversationsDto } from '../dto/reorder-pinned-conversations.dto';

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

  @Get('sidebar-conversations')
  getSidebarConversations(
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.getSidebarConversations(req.user, organizationId);
  }

  @Post('sidebar-conversations/order')
  reorderSidebarConversations(
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
    @Body(ValidationPipe) dto: ReorderPinnedConversationsDto,
  ) {
    return this.messagesService.reorderSidebarConversations(
      req.user,
      organizationId,
      dto.conversationIds,
    );
  }

  @Get('search')
  search(
    @Req() req,
    @Query('q') query: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.search(req.user, organizationId, query);
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
    @Query('beforeId') beforeId: string | undefined,
    @Query('beforeCreatedAt') beforeCreatedAt: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    return this.messagesService.getConversationMessages(
      req.user,
      id,
      organizationId,
      {
        beforeId,
        beforeCreatedAt,
        limit,
      },
    );
  }

  @Get('conversation/:id/context')
  getConversationContext(
    @Req() req,
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.getConversationContext(
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
    @Body(ValidationPipe) dto: CreateMessageDto,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.sendMessage(req.user, dto, organizationId);
  }

  @Post('conversation/:id/read')
  markConversationRead(
    @Req() req,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: MarkConversationReadDto,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.markConversationRead(
      req.user,
      id,
      organizationId,
      dto.lastReadMessageId,
    );
  }

  @Post('conversation/:id/preferences')
  updateConversationPreferences(
    @Req() req,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateConversationPreferencesDto,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.updateConversationPreferences(
      req.user,
      id,
      organizationId,
      dto,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Req() req,
    @Body(ValidationPipe) dto: UploadMessageAttachmentDto,
    @Headers('x-organization-id') organizationId: string,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.messagesService.uploadAttachment(
      req.user,
      file,
      organizationId,
      dto.fileName,
    );
  }

  @Get(':id/attachment')
  async getAttachment(
    @Req() req,
    @Res() response: Response,
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    const attachment = await this.messagesService.getAttachment(
      req.user,
      id,
      organizationId,
    );
    response.setHeader(
      'Content-Type',
      attachment.fileType || 'application/octet-stream',
    );
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.fileName.replace(/["\\\r\n]/g, '_')}"`,
    );
    response.send(attachment.content);
  }

  @Post(':id/reactions')
  addReaction(
    @Req() req,
    @Param('id') id: string,
    @Body(ValidationPipe) dto: AddMessageReactionDto,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.addReaction(
      req.user,
      id,
      dto.emoji,
      organizationId,
    );
  }

  @Post(':id/star')
  toggleStar(
    @Req() req,
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.messagesService.toggleMessageStar(req.user, id, organizationId);
  }
}
